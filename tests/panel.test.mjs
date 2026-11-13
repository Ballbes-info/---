import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../extension/panel.js',import.meta.url),'utf8');
function setup(){
 const element=()=>({style:{},hidden:false,value:'',textContent:'',addEventListener(){},focus(){},click(){return this.onclick?.();}});
 const primary=element(),ai=element(),output=element(),password=element(),notice=element(),handle=element(),host=element();
 const elements={'button':primary,'#ai':ai,'output':output,'input':password,'small':notice,'header':handle};
 host.attachShadow=()=>({set innerHTML(value){},querySelector:selector=>elements[selector]});
 let listener,question='Первая задача';const calls=[];
 const context={location:{href:'https://vgaranov.ru/'},setInterval,clearInterval,requestAnimationFrame:fn=>fn(),
  GrTaskContext:{extract:()=>({text:question})},document:{createElement:()=>host,documentElement:{append(){}}},
  chrome:{runtime:{onMessage:{addListener:fn=>{listener=fn;}},sendMessage:async message=>{
   calls.push(message);if(message.type==='GR_STATUS')return {authenticated:true};
   return message.type==='GR_SOLVE'?{needsAi:true}:{answer:'42'};
  }}}
 };
 vm.runInNewContext(source,context);
 return {primary,ai,output,calls,toggle:async()=>{listener({type:'GR_TOGGLE'});await new Promise(r=>setImmediate(r));},change:()=>{question='Другая задача';}};
}
test('AI button appears only after unsupported result and sends only on click',async()=>{
 const p=setup();await p.toggle();assert.equal(p.ai.hidden,true);
 await p.primary.click();assert.equal(p.calls.at(-1).type,'GR_SOLVE');assert.equal(p.ai.hidden,false);
 assert.ok(!p.calls.some(c=>c.type==='GR_SOLVE_AI'));
 await p.ai.click();assert.equal(p.calls.at(-1).type,'GR_SOLVE_AI');assert.equal(p.output.textContent,'42');assert.equal(p.ai.hidden,true);
});
test('changing question invalidates previous AI offer',async()=>{
 const p=setup();await p.toggle();await p.primary.click();p.change();
 await p.ai.click();assert.equal(p.ai.hidden,true);assert.match(p.output.textContent,/изменилось/);
 assert.ok(!p.calls.some(c=>c.type==='GR_SOLVE_AI'));
});
test('hiding panel clears unsupported prompt and AI offer',async()=>{
 const p=setup();await p.toggle();await p.primary.click();await p.toggle();
 assert.equal(p.output.textContent,'');assert.equal(p.ai.hidden,true);
 await p.toggle();assert.equal(p.ai.hidden,true);
});
