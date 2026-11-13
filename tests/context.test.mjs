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
test('layout tables are excluded and turtle code is preserved',()=>{
 const leaf={querySelector:()=>null,rows:[{cells:[{innerText:''},{innerText:'F'}]}]};
 const layout={querySelector:()=>leaf};
 const root={innerText:'Условие',getBoundingClientRect:()=>({x:0,y:0,width:700,height:200,top:0,bottom:200,left:0,right:700}),querySelectorAll:selector=>selector==='table'?[layout,leaf]:selector==='pre'?[{innerText:'Повтори 2 [Вперед 10 Налево 90]'}]:[]};
 const context=GrTaskContext.extract({querySelector:()=>root},{location:{hostname:'vgaranov.ru'},innerWidth:1000,innerHeight:800});
 assert.equal(context.tables.length,1);assert.deepEqual(context.code,['Повтори 2 [Вперед 10 Налево 90]']);
});
test('superscripts and numeral bases are not flattened into digits',()=>{
 const text=value=>({nodeType:3,textContent:value});
 const root={tagName:'DIV',childNodes:[text('4'),{tagName:'SUP',textContent:'7849'},text(' и 6xy'),{tagName:'SUB',textContent:'46'}],querySelector:()=>({}),querySelectorAll:()=>[],getBoundingClientRect:()=>({x:0,y:0,width:500,height:100,top:0,bottom:100,left:0,right:500})};
 const result=GrTaskContext.extract({querySelector:()=>root},{location:{hostname:'vgaranov.ru'},innerWidth:1000,innerHeight:800});
 assert.equal(result.text,'4^(7849) и 6xy_(46)');
});
