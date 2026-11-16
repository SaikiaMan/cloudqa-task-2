export const ACTIONS = ['plan','click','fill','select','press','check','uncheck','hover','goto','back','scroll','switch_tab','wait','wait_for','assert','finish','fail'];
export const CONDITIONS = ['visible','hidden','text_contains','value_equals','url_contains','title_contains','checked','unchecked','enabled'];
export const ACTION_SCHEMA = {
 type:'OBJECT', required:['action','goal','reason','condition'], properties:{
  action:{type:'STRING',enum:ACTIONS}, reason:{type:'STRING'}, goal:{type:'STRING'},
  goals:{type:'ARRAY',items:{type:'OBJECT',required:['id','description'],properties:{id:{type:'STRING'},description:{type:'STRING'}}}},
  target:{type:'OBJECT',properties:{ref:{type:'STRING'},frame:{type:'INTEGER'},by:{type:'STRING',enum:['role','label','placeholder','text','testId','css']},role:{type:'STRING'},name:{type:'STRING'},selector:{type:'STRING'}}},
  value:{type:'STRING'},condition:{type:'STRING',enum:['none',...CONDITIONS]},url:{type:'STRING'},index:{type:'INTEGER'},direction:{type:'STRING',enum:['up','down']}
 }
};
export function validateAction(action) {
 const invalid = message => { throw new Error('Invalid model action: '+message); };
 if(!action || Array.isArray(action) || !ACTIONS.includes(action.action)) invalid('unsupported browser action');
 if(action.action==='plan' && (!Array.isArray(action.goals)||!action.goals.length)) invalid('plan requires goals');
 if(['fill','select','press'].includes(action.action) && typeof action.value!=='string') invalid('value must be a string');
 if(action.action==='goto') { try { if(!['http:','https:'].includes(new URL(action.url).protocol)) invalid('HTTP(S) URL required'); } catch { invalid('HTTP(S) URL required'); } }
 if(action.action==='switch_tab' && (!Number.isInteger(action.index)||action.index<0)) invalid('tab index required');
 if(['assert','wait_for'].includes(action.action)) {
  if(!CONDITIONS.includes(action.condition)) invalid('unsupported assertion condition '+String(action.condition).slice(0,80)+'; use '+CONDITIONS.join(', '));
  if(action.action==='wait_for' && !['visible','hidden','url_contains'].includes(action.condition)) invalid('wait_for needs visible, hidden or url_contains');
  if(['url_contains','title_contains','text_contains','value_equals'].includes(action.condition) && (typeof action.value!=='string'||(action.condition!=='value_equals'&&!action.value))) invalid('assertion value required');
 }
 const needsTarget=['click','fill','select','press','check','uncheck','hover'].includes(action.action)||(['assert','wait_for'].includes(action.action)&&!['url_contains','title_contains'].includes(action.condition));
 if(needsTarget) {
  const t=action.target;
  if(!t || typeof t!=='object') invalid('target required');
  if(t.ref) { if(typeof t.ref!=='string') invalid('ref must be a string'); }
  else {
   if(!['role','label','placeholder','text','testId','css'].includes(t.by)) invalid('unsupported locator');
   if(t.by==='css' ? typeof t.selector!=='string'||!t.selector.trim() : typeof t.name!=='string') invalid('target name or CSS selector required');
   if(t.by==='role' && typeof t.role!=='string') invalid('role required');
  }
  if(t.frame!==undefined && (!Number.isInteger(t.frame)||t.frame<0)) invalid('frame index must be nonnegative');
 }
 return action;
}
