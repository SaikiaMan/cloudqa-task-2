// Generic runner regression on a new local workflow; --ai uses real Gemini decisions.
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { runTest } from '../src/runner.js';
import { createModel } from '../src/model.js';
const key='control-'+randomUUID();
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html');
 if(req.url==='/note') return res.end(`<!doctype html><h2>Delivery instructions</h2><label>Delivery note<input id="note"></label><button id="save">Save note</button><p role="status" id="status"></p><script>save.onclick=()=>document.getElementById('status').textContent='Note saved: '+note.value;</script>`);
 if(req.url==='/receipt') return res.end('<!doctype html><h1>Rental summary</h1><p>Preview only; no order placed</p>');
 res.end(`<!doctype html><title>Equipment rental playground</title><h1>Equipment rental</h1>
<button id="${key}">Pickup depot</button><div id="picker" hidden><label>Find depot<input id="query"></label><div id="results"></div></div>
<p id="selected">No depot selected</p><div hidden>Riverside depot</div>
<label>Rental length<select><option value="day">One day</option><option value="fortnight">Two weeks</option></select></label>
<label>Pickup date<input readonly id="date"></label><div hidden id="calendar"><button id="day">24 November 2026</button></div>
<label><input type="checkbox">Insurance</label>
<iframe title="Delivery instructions" src="/note"></iframe><a href="/receipt" target="_blank">Open summary</a>
<script>
document.getElementById('${key}').onclick=()=>picker.hidden=false;
let timer;query.oninput=()=>{clearTimeout(timer);results.innerHTML='';timer=setTimeout(()=>{results.innerHTML='<div id="choice" tabindex="0">Riverside depot</div>';choice.onclick=()=>{selected.textContent='Selected depot: Riverside';picker.hidden=true;};},750);};
date.onclick=()=>calendar.hidden=false;day.onclick=()=>{date.value='2026-11-24';calendar.hidden=true;};
</script>`);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const goals=[{id:'depot',description:'Riverside depot is selected'},{id:'length',description:'Rental length is Two weeks'},{id:'date',description:'Pickup date is November 24, 2026'},{id:'insurance',description:'Insurance is checked'},{id:'note',description:'Delivery note Leave at reception is saved inside the frame'},{id:'summary',description:'Rental summary opens in another tab'}];
const steps=[
 ()=>({action:'plan',goals}),
 s=>({action:'click',goal:'depot',target:ref(s,e=>e.tag==='button'&&e.text==='Pickup depot')}),
 s=>({action:'fill',goal:'depot',target:ref(s,e=>e.labels?.includes('Find depot')),value:'River'}),
 s=>({action:'wait_for',goal:'depot',target:{by:'text',name:'Riverside depot'},condition:'visible'}),
 s=>({action:'click',goal:'depot',target:ref(s,e=>e.text==='Riverside depot')}),
 s=>({action:'assert',goal:'depot',target:{by:'text',name:'Selected depot: Riverside'},condition:'visible'}),
 s=>({action:'select',goal:'length',target:ref(s,e=>e.tag==='select'),value:'Two weeks'}),
 s=>({action:'assert',goal:'length',target:ref(s,e=>e.tag==='select'),condition:'value_equals',value:'fortnight'}),
 s=>({action:'click',goal:'date',target:ref(s,e=>e.labels?.includes('Pickup date'))}),
 s=>({action:'click',goal:'date',target:ref(s,e=>e.tag==='button'&&e.text==='24 November 2026')}),
 s=>({action:'assert',goal:'date',target:ref(s,e=>e.labels?.includes('Pickup date')),condition:'value_equals',value:'2026-11-24'}),
 s=>({action:'check',goal:'insurance',target:ref(s,e=>e.type==='checkbox')}),
 s=>({action:'assert',goal:'insurance',target:ref(s,e=>e.type==='checkbox'),condition:'checked'}),
 s=>({action:'fill',goal:'note',target:ref(s,e=>e.labels?.includes('Delivery note'),1),value:'Leave at reception'}),
 s=>({action:'click',goal:'note',target:ref(s,e=>e.tag==='button'&&e.text==='Save note',1)}),
 s=>({action:'assert',goal:'note',target:{by:'text',name:'Note saved: Leave at reception',frame:1},condition:'visible'}),
 s=>({action:'click',goal:'summary',target:ref(s,e=>e.tag==='a'&&e.text==='Open summary')}),
 s=>({action:'assert',goal:'summary',target:{by:'role',role:'heading',name:'Rental summary'},condition:'visible'}),
 s=>({action:'switch_tab',index:0}),
 s=>({action:'switch_tab',index:1}),
 s=>({action:'finish',reason:'All six outcomes have successful browser assertions.'})
];
function ref(state,predicate,index=0){
 const element=state.frames.find(f=>f.index===index)?.elements.find(predicate);
 assert.ok(element,'Expected observed control not found');return {ref:element.ref};
}
const ai=process.argv.includes('--ai');
try {
 const result=await runTest({url:`http://127.0.0.1:${server.address().port}`,requirePlan:true,headed:process.argv.includes('--headed'),maxSteps:36,
  test:'On this equipment rental page, select Riverside depot through its picker, set Rental length to Two weeks, choose pickup date November 24 2026, check Insurance, save Delivery note Leave at reception inside the embedded frame, then open summary and verify Rental summary in the new tab. Verify every requested value. This is a local preview; do not place any order.',
  decide:ai?createModel():async state=>{const next=steps.shift(); if(!next) return {action:'fail',reason:'Scripted verification did not complete'};return next(state);}});
 console.log(`${ai?'Live Gemini':'Scripted executor'}: ${result.status}: ${result.reason}\nReport: ${result.directory}`);
 if(ai && result.status!=='PASS') {process.exitCode=1;}
 else assert.equal(result.status,'PASS',result.reason);
 if(!ai) {assert.equal(result.goals.length,6);assert.ok(result.goals.every(g=>g.verified));}
 if(!ai) assert.equal(result.steps.filter(s=>s.ok===false).length,0);
} finally {server.close();}
