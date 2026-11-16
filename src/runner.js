import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { observe, settle, createProgress } from './browser-state.js';

export function locator(page, target, references = new Map()) {
  if (target?.ref) {
    if (!references.has(target.ref)) throw new Error('Unknown element ref; choose a ref from the current observation.');
    return references.get(target.ref);
  }
  if (target?.frame !== undefined) {
    page = page.frames()[target.frame];
    if (!page) throw new Error('Frame is no longer available');
  }
  if (!target || typeof target.name !== 'string' && target.by !== 'css') throw new Error('Invalid target');
  switch (target.by) {
    case 'role': return page.getByRole(target.role, { name: target.name, exact: true });
    case 'label': return page.getByLabel(target.name, { exact: true });
    case 'placeholder': return page.getByPlaceholder(target.name, { exact: true });
    case 'text': return page.getByText(target.name, { exact: true }).filter({ visible: true });
    case 'testId': return page.getByTestId(target.name);
    case 'css': {
      if (typeof target.selector !== 'string' || !target.selector.trim()) throw new Error('CSS target needs selector');
      return page.locator(target.selector);
    }
    default: throw new Error('Unsupported locator');
  }
}

export async function runTest({ url, test, decide, output = 'reports', headed = false, maxSteps = 30, allowedOrigins = [], credentials = {}, record = process.env.RECORD_VIDEO !== 'false', requirePlan = false }) {
  const origin = new URL(url).origin;
  const allowed = new Set([origin, ...allowedOrigins.map(x => new URL(x).origin)]);
  const dir = path.resolve(output, new Date().toISOString().replace(/[:.]/g, '-') + '-' + Math.random().toString(36).slice(2, 7));
  await mkdir(dir, { recursive: true });
  const secrets=Object.values(credentials).filter(Boolean).sort((a,b)=>b.length-a.length);
  const redactText = text => secrets.reduce((s,secret)=>s.split(secret).join('[REDACTED]'),text);
  const redact = value => typeof value === 'string' ? redactText(value) : JSON.stringify(value,(_,item)=>typeof item==='string'?redactText(item):item);
  const result = { status: 'FAIL', test, url, reason: '', steps: [], assertions: 0, startedAt: new Date().toISOString() };
  let browser, context, page, activePage;
  const progress = createProgress(requirePlan);
  result.goals = progress.goals;
  const expand = value => String(value ?? '').replace(/\{\{([A-Z_]+)\}\}/g, (_, key) => {
    if (!credentials[key]) throw new Error(`Missing credential ${key}`);
    return credentials[key];
  });
  try {
    browser = await chromium.launch({ headless: !headed, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
    context = await browser.newContext({ viewport: { width: 1280, height: 800 }, ...(record ? { recordVideo: { dir: path.join(dir, 'video') } } : {}) });
    // Block cross-origin document navigation; ordinary CDN/API assets remain usable.
    await context.route('**/*', route => {
      const req = route.request();
      if (req.isNavigationRequest() && !allowed.has(new URL(req.url()).origin)) return route.abort();
      return route.continue();
    });
    context.on('page', opened => { activePage=opened; });
    page = await context.newPage();
    page.setDefaultTimeout(8000);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await settle(page);
    let lastSignature = '', repeatCount = 0, previousState=new Map();
    for (let i = 0; i < maxSteps; i++) {
      const pages = context.pages().filter(p => !p.isClosed());
      page = activePage && !activePage.isClosed() ? activePage : pages.at(-1);
      if (!page) throw new Error('All browser tabs have been closed');
      await page.waitForLoadState('domcontentloaded',{timeout:10000}).catch(()=>{});
      const { references, observation } = await observe(page, allowed);
      const currentState=new Map(observation.frames.flatMap(f=>(f.elements||[]).map(e=>[f.index+':'+e.selector,JSON.stringify({text:e.text,value:e.value,checked:e.checked})])));
      const changes=[...currentState].filter(([key,value])=>previousState.get(key)!==value).slice(0,25).map(([element,state])=>({element,state:JSON.parse(state)}));
      previousState=currentState;
      const tabs = context.pages().filter(p => !p.isClosed()).map((p,index)=>({index,url:p.url()}));
      const action = await decide(JSON.parse(redact({ test, url:page.url(), ...observation, tabs,
        goals:progress.goals, nextGoal:progress.goals.find(g=>!g.verified), changes, unresolvedFailures:[...progress.failures.values()], requirePlan,
        allowedOrigins:[...allowed], availableCredentials:Object.keys(credentials), history:result.steps.slice(-16) })));
      const entry = { step: i + 1, ...JSON.parse(redact(action)) };
      result.steps.push(entry);
      console.log(`${i + 1}. ${action.action}: ${redact(action.reason || '')}`);
      try {
        progress.validate(action);
        const signature=JSON.stringify([action.action,action.target?.ref ? references.get(action.target.ref)?.toString() : action.target,action.value,action.condition]);
        repeatCount = signature===lastSignature ? repeatCount+1 : 1;
        lastSignature=signature;
        if (repeatCount>3 && !['assert','wait','finish'].includes(action.action)) throw new Error('Repeated action without progress. Reinspect the page and choose a different target or approach.');
        if (action.action === 'plan') {
          progress.plan(action.goals); entry.ok=true; continue;
        }
        if (action.action === 'switch_tab') {
          const selected=context.pages().filter(p=>!p.isClosed())[action.index];
          if(!selected) throw new Error('Invalid tab index');
          page=selected; await page.bringToFront(); entry.ok=true;
          // The selected tab becomes active for subsequent observations.
          activePage=selected; continue;
        }
        if (action.action === 'finish') {
          progress.finish(result.assertions);
          entry.ok=true;
          result.status = 'PASS'; result.reason = action.reason; break;
        }
        if (action.action === 'fail') { result.reason = action.reason || 'Agent reported failure'; break; }
        if (action.action === 'goto') {
          if (!allowed.has(new URL(action.url).origin)) throw new Error('Navigation origin not allowed');
          await page.goto(action.url, { waitUntil: 'domcontentloaded' });
        } else if (action.action === 'wait') await page.waitForTimeout(1000);
        else if (action.action === 'back') await page.goBack({waitUntil:'domcontentloaded'});
        else if (action.action === 'scroll') await page.mouse.wheel(0, action.direction === 'up' ? -600 : 600);
        else if (action.action === 'wait_for') {
          if(action.condition==='url_contains') await expect(page).toHaveURL(new RegExp(escapeRegex(action.value)),{timeout:15000});
          else await locator(page,action.target,references).waitFor({state:action.condition==='hidden'?'hidden':'visible',timeout:15000});
        }
        else if (action.action === 'assert') {
          if (action.condition === 'title_contains') {
            if(!action.value) throw new Error('Title assertion needs a nonempty value');
            await expect(page).toHaveTitle(new RegExp(escapeRegex(action.value)));
          } else if (action.condition === 'url_contains') {
            if (!action.value) throw new Error('URL assertion needs a nonempty value');
            await expect(page).toHaveURL(new RegExp(escapeRegex(action.value)));
          } else {
            const loc = locator(page, action.target, references);
            if (action.condition === 'visible') await expect(loc).toBeVisible();
            else if (action.condition === 'hidden') await expect(loc).toBeHidden();
            else if (action.condition === 'checked') await expect(loc).toBeChecked();
            else if (action.condition === 'unchecked') await expect(loc).not.toBeChecked();
            else if (action.condition === 'enabled') await expect(loc).toBeEnabled();
            else if (action.condition === 'text_contains' && action.value) await expect(loc).toContainText(action.value);
            else if (action.condition === 'value_equals' && action.value !== undefined) await expect(loc).toHaveValue(expand(action.value));
            else throw new Error('Unsupported assertion');
          }
          result.assertions++;
          const screenshot=`assertion-${i+1}.png`;
          await page.screenshot({path:path.join(dir,screenshot)}).catch(()=>{});
          entry.evidence={url:page.url(),screenshot};
        } else {
          const loc = locator(page, action.target, references);
          if (action.action === 'click') await loc.click();
          else if (action.action === 'fill') {
            await loc.fill(expand(action.value));
            await settle(page);
          }
          else if (action.action === 'select') {
            const value=expand(action.value);
            const values=await loc.locator('option').evaluateAll(es=>es.map(e=>e.value));
            await loc.selectOption(values.includes(value) ? {value} : {label:value});
          }
          else if (action.action === 'press') await loc.press(action.value);
          else if (action.action === 'check') await loc.check();
          else if (action.action === 'uncheck') await loc.uncheck();
          else if (action.action === 'hover') await loc.hover();
          else throw new Error('Unsupported action');
        }
        entry.ok = true;
        progress.succeeded(action, entry.step);
        if (!['assert','wait_for'].includes(action.action)) await settle(page);
      } catch (error) {
        entry.ok = false; entry.error = redact(error.message).slice(0, 1800);
        if (action.action !== 'finish') progress.failed(action,entry.step);
        await page.screenshot({path:path.join(dir,`error-${i+1}.png`)}).catch(()=>{});
      }
      await writeFile(path.join(dir,'report.json'),redact(result));
    }
    if (!result.reason) result.reason = `Step budget exhausted (${maxSteps})`;
  } catch (error) { result.reason = redact(error.message); }
  finally {
    if (page && !page.isClosed()) {
      try { await page.screenshot({ path: path.join(dir, 'final.png'), fullPage: true }); } catch {}
    }
    if (context) await context.close().catch(()=>{});
    if (browser) await browser.close().catch(()=>{});
    result.finishedAt = new Date().toISOString();
    await writeFile(path.join(dir, 'report.json'), redact(result));
    await writeFile(path.join(dir, 'report.html'), `<!doctype html><meta charset="utf-8"><title>QA report</title><style>body{font:16px system-ui;max-width:1000px;margin:40px auto}pre{white-space:pre-wrap}img{max-width:100%}</style><h1>${result.status}</h1><pre>${escapeHtml(redact(result))}</pre><a href="final.png">Final screenshot</a>`);
  }
  return { ...result, directory: dir };
}
function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function escapeHtml(s) { return s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }
