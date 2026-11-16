let observationNumber = 0;


// A short DOM quiet period catches debounced widgets without waiting for analytics/network idle.
export async function settle(page) {
  await page.evaluate(() => new Promise(resolve => {
    let quiet;
    const done = () => { clearTimeout(quiet); clearTimeout(limit); observer.disconnect(); resolve(); };
    const observer = new MutationObserver(() => { clearTimeout(quiet); quiet = setTimeout(done, 500); });
    const limit = setTimeout(done, 1800);
    observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
    quiet = setTimeout(done, 500);
  })).catch(() => {}); // Navigation may replace the document while settling.
}

export async function observe(page, allowedOrigins) {
  const references = new Map();
  const frames = [];
  let sequence = 0;
  const observationId=++observationNumber;
  for (const [index, frame] of page.frames().entries()) {
    let originFrame=frame;
    while (originFrame.parentFrame() && originFrame.url().startsWith('about:')) originFrame=originFrame.parentFrame();
    if (index && !allowedOrigins.has(new URL(originFrame.url() || 'about:blank').origin)) continue;
    try {
      const snapshot = await frame.locator('body').ariaSnapshot({ timeout: 5000 });
      const elements = await frame.locator('body').evaluate(body => {
        const visible = el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden';
        const selector = el => {
          if (el.id && document.querySelectorAll('#' + CSS.escape(el.id)).length === 1) return '#' + CSS.escape(el.id);
          const parts = [];
          while (el && el.nodeType === 1) {
            let part = el.tagName.toLowerCase();
            const siblings = [...(el.parentElement?.children || [])].filter(s => s.tagName === el.tagName);
            if (siblings.length > 1) part += ':nth-of-type(' + (siblings.indexOf(el) + 1) + ')';
            parts.unshift(part); el = el.parentElement;
          }
          return parts.join(' > ');
        };
        return [...body.querySelectorAll('input, textarea, select, button, a[href], [role], [tabindex], [onclick], [id], td, [class*="cursor-pointer"]')]
          .filter(el => visible(el) && el.tagName !== 'SCRIPT' && el.tagName !== 'STYLE')
          .slice(0, 240).map(el => ({ selector: selector(el), tag: el.tagName.toLowerCase(),
            interactive: el.matches('input,textarea,select,button,a[href],[tabindex]') || typeof el.onclick==='function' || el.hasAttribute('@click') || getComputedStyle(el).cursor==='pointer',
            role: el.getAttribute('role'), name: el.getAttribute('aria-label') || el.getAttribute('title'),
            labels: [...(el.labels || [])].map(l => l.innerText.trim()), placeholder: el.getAttribute('placeholder'),
            type: el.getAttribute('type'), text: el.innerText?.trim().slice(0, 220),
            value: el.type === 'password' ? undefined : el.value,
            checked: el.matches('input[type=checkbox],input[type=radio]') ? el.checked : undefined,
            disabled: el.disabled, readOnly: el.readOnly,
            href: el.tagName === 'A' ? el.getAttribute('href') : undefined,
            options: el.tagName === 'SELECT' ? [...el.options].map(o => ({label:o.label,value:o.value})) : undefined }));
      });
      for (const element of elements) {
        element.ref = 'o'+observationId+'e'+(++sequence);
        references.set(element.ref, frame.locator(element.selector).filter({visible:true}));
      }
      frames.push({ index, url: frame.url(), snapshot: snapshot.slice(0, 18000), elements });
    } catch (error) { frames.push({index, url:frame.url(), error:'Frame unavailable: '+error.message.slice(0,150)}); }
  }
  return { references, observation: { title: await page.title(), frames, snapshot: frames[0]?.snapshot || '' } };
}

export function fingerprint(action) {
  // Refs change each observation; goal identity is the stable recovery key in planned runs.
  return JSON.stringify([action.action, action.goal || '', action.target, action.condition, action.value, action.url]);
}

export function createProgress(requirePlan = false) {
  const goals = [];
  const failures = new Map();
  return {
    goals, failures,
    plan(items) {
      if (goals.length) throw new Error('The plan is already set; goals cannot be removed or rewritten.');
      if (!Array.isArray(items) || !items.length || items.length > 20 || items.some(g => !g || typeof g.id !== 'string' || !g.id.trim() || typeof g.description !== 'string' || !g.description.trim()) || new Set(items.map(g => g.id)).size !== items.length) throw new Error('Plan needs 1-20 unique goals with id and description.');
      goals.push(...items.map(g => ({id:g.id,description:g.description,verified:false,evidence:[]})));
    },
    validate(action) {
      if (requirePlan && !goals.length && !['plan','fail'].includes(action.action)) throw new Error('First create a plan covering every requested outcome.');
      if (goals.length && !['plan','finish','fail','wait','scroll','switch_tab','back'].includes(action.action) && !goals.some(g => g.id === action.goal)) throw new Error('Action must identify an existing goal.');
    },
    failed(action, step) {
      if ((requirePlan && !goals.length) || (goals.length && !goals.some(g=>g.id===action.goal))) return;
      failures.set(fingerprint(action), {step,goal:action.goal,action:action.action});
      const goal=goals.find(g=>g.id===action.goal); if(goal) goal.verified=false;
    },
    succeeded(action, step) {
      failures.delete(fingerprint(action));
      const changedGoal=goals.find(g=>g.id===action.goal);
      if(changedGoal && ['fill','select','check','uncheck','press','click','goto','back'].includes(action.action)) changedGoal.verified=false;
      if (action.action === 'assert') {
        const goal=goals.find(g=>g.id===action.goal);
        if(goal) {
          goal.verified=true; goal.evidence.push(step);
          for(const [key,failure] of failures) if(failure.goal===action.goal) failures.delete(key);
        }
      }
    },
    finish(assertions) {
      if (!assertions || failures.size || (requirePlan && !goals.length) || goals.some(g=>!g.verified)) throw new Error('Cannot pass: every planned goal needs successful browser evidence and no unresolved failures.');
    }
  };
}
