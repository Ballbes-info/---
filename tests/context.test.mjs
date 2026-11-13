import test from 'node:test';import assert from 'node:assert/strict';
import '../extension/task-context.js';
test('extracts current question and preserves blank cells',()=>{
 const table={rows:[{cells:[{innerText:''},{innerText:'F'}]},{cells:[{innerText:' '},{innerText:'0'}]}]};
 const root={innerText:'Задание №1. Полное условие',getBoundingClientRect:()=>({x:10,y:20,width:700,height:150,top:20,bottom:170,left:10,right:710}),querySelectorAll:selector=>selector==='table'?[table]:[{innerText:'x ∧ ¬y'}]};
 const doc={querySelector:selector=>{assert.equal(selector,'#div_question');return root;}};
 const context=GrTaskContext.extract(doc,{location:{hostname:'vgaranov.ru'},innerWidth:1000,innerHeight:800});
 assert.equal(context.formula,'x ∧ ¬y');assert.deepEqual(context.tables,[[['','F'],['','0']]]);assert.equal(context.clipped,false);
 assert.equal(GrTaskContext.extract(doc,{location:{hostname:'example.com'}}),null);
});
