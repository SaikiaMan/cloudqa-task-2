import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProgress } from '../src/browser-state.js';
import { validateAction } from '../src/actions.js';

test('a later unrelated assertion cannot erase a failed goal', () => {
 const p=createProgress(true);p.plan([{id:'login',description:'Dashboard'},{id:'settings',description:'Saved settings'}]);
 p.failed({action:'assert',goal:'login',condition:'visible',target:{by:'text',name:'Dashboard'}},2);
 p.succeeded({action:'assert',goal:'settings'},3);
 assert.equal(p.failures.size,1); assert.throws(()=>p.finish(1),/every planned goal/);
 p.succeeded({action:'assert',goal:'login'},4); p.finish(2);
});
test('every planned goal must be verified, and plans cannot be weakened', () => {
 const p=createProgress(true); assert.throws(()=>p.validate({action:'click'}),/First create a plan/);
 p.plan([{id:'one',description:'First outcome'},{id:'two',description:'Final outcome'}]);
 p.succeeded({action:'assert',goal:'one'},2); assert.throws(()=>p.finish(1),/every planned goal/);
 assert.throws(()=>p.plan([{id:'one',description:'Less work'}]),/already set/);
 assert.throws(()=>p.validate({action:'assert',goal:'invented'}),/existing goal/);
});
test('legacy failures also survive unrelated assertions', () => {
 const p=createProgress();const failed={action:'assert',target:{by:'text',name:'Expected'}};
 p.failed(failed,1);p.succeeded({action:'assert',target:{by:'text',name:'Other'}},2);
 assert.throws(()=>p.finish(1),/unresolved/);p.succeeded(failed,3);p.finish(2);
});
test('malformed actions are rejected before browser execution', () => {
 for(const action of [
  {action:'fill',target:{ref:'e1'}},
  {action:'click',target:{by:'css',name:'#guessed'}},
  {action:'assert',condition:'url_contains',value:''},
  {action:'switch_tab',index:-1},
  {action:'goto',url:'javascript:alert(1)'},
  {action:'wait_for',condition:'value_equals',value:'x',target:{ref:'e1'}}
 ]) assert.throws(()=>validateAction(action),/Invalid model action/);
 assert.deepEqual(validateAction({action:'click',target:{ref:'e1'}}),{action:'click',target:{ref:'e1'}});
});

test('editing a verified goal invalidates its old evidence until rechecked', () => {
 const p=createProgress(true);p.plan([{id:'query',description:'Correct search query'}]);
 p.succeeded({action:'assert',goal:'query'},1);p.finish(1);
 p.succeeded({action:'fill',goal:'query'},2);assert.throws(()=>p.finish(1),/every planned goal/);
 p.succeeded({action:'assert',goal:'query'},3);p.finish(2);
});

test('page-title assertions do not require an element target', () => {
 assert.deepEqual(validateAction({action:'assert',condition:'title_contains',value:'GitHub'}),{action:'assert',condition:'title_contains',value:'GitHub'});
 assert.throws(()=>validateAction({action:'assert',condition:'title_contains',value:''}),/assertion value required/);
});
