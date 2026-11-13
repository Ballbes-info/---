import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../extension/background.js',import.meta.url),'utf8');
function setup(){
 let listener,captures=0,apiCalls=0,downloads=0;const session={};const screenshots=[];
 const context={Set,console,importScripts(){},GrLogic:{solve:()=> '195'},GrVault:{open:async(v,p)=>{if(p!=='test-pass')throw Error('Wrong password');return 'secret-key';}},GrGiga:{solve:async(s,key)=>{assert.equal(key,'secret-key');apiCalls++;screenshots.push(s);return '42';}},
 fetch:async()=>{downloads++;return Response.json({encrypted:true});},chrome:{
  commands:{onCommand:{addListener(){}}},action:{onClicked:{addListener(){}}},
  runtime:{getURL:p=>'chrome-extension://test/'+p,onMessage:{addListener(fn){listener=fn;}}},
  storage:{session:{setAccessLevel:async value=>assert.equal(value.accessLevel,'TRUSTED_CONTEXTS'),get:async()=>session,set:async value=>Object.assign(session,value)}},
  tabs:{query:async()=>[{id:7}],sendMessage:async()=>{},captureVisibleTab:async()=> 'shot-'+(++captures)}
 }};
 vm.runInNewContext(source,context);
 return {call:(message,url)=>new Promise(resolve=>listener(message,{tab:{id:7,windowId:1,url},frameId:0},resolve)),session,screenshots,counts:()=>({captures,apiCalls,downloads})};
}
test('startup and status do not capture or call AI; login stays inside extension',async()=>{
 const p=setup();assert.deepEqual(p.counts(),{captures:0,apiCalls:0,downloads:0});
 assert.equal((await p.call({type:'GR_STATUS'})).authenticated,false);
 assert.ok((await p.call({type:'GR_LOGIN',password:'wrong'})).error);
 const answer=await p.call({type:'GR_LOGIN',password:'test-pass'});
 assert.equal(answer.authenticated,true);assert.ok(!JSON.stringify(answer).includes('secret-key'));
 assert.equal(p.session.grAuthKey,'secret-key');assert.equal(p.counts().apiCalls,0);
 assert.equal((await p.call({type:'GR_STATUS'})).authenticated,true);
});
test('recognised local logic question avoids AI and screenshot upload',async()=>{
 const p=setup();await p.call({type:'GR_LOGIN',password:'test-pass'});
 assert.equal((await p.call({type:'GR_SOLVE',taskContext:{text:'Полное условие',formula:'Q→A'}},'https://vgaranov.ru/')).answer,'195');
 assert.equal(p.counts().apiCalls,0);assert.equal(p.counts().captures,0);
});
test('unsupported task only offers AI, without screenshots or API calls',async()=>{
 const p=setup();await p.call({type:'GR_LOGIN',password:'test-pass'});
 const before=p.counts();
 assert.equal((await p.call({type:'GR_SOLVE'})).needsAi,true);
 assert.deepEqual(p.counts(),before);
});
test('explicit AI request captures again and a new browser session starts locked',async()=>{
 const p=setup();assert.equal((await p.call({type:'GR_SOLVE'})).authRequired,true);
 await p.call({type:'GR_LOGIN',password:'test-pass'});
 assert.equal((await p.call({type:'GR_SOLVE_AI'})).answer,'42');
 assert.equal((await p.call({type:'GR_SOLVE_AI'})).answer,'42');
 assert.deepEqual(p.screenshots,['shot-1','shot-2']);
 assert.equal((await setup().call({type:'GR_STATUS'})).authenticated,false);
});
