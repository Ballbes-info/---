import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
test('extension makes a new screenshot for every click and clears expired auth',async()=>{
  let listener, captures=0, removed=false;const submitted=[];
  const context={Set,console,AbortSignal,chrome:{
    commands:{onCommand:{addListener(){}}},action:{onClicked:{addListener(){}}},
    runtime:{onMessage:{addListener(fn){listener=fn;}}},
    storage:{local:{get:async()=>({serverUrl:'https://server.example',token:'token'}),remove:async()=>{removed=true;}}},
    tabs:{query:async()=>[{id:7}],sendMessage:async()=>{},captureVisibleTab:async()=> 'shot-'+(++captures)}
  },fetch:async(url,options)=>{submitted.push(JSON.parse(options.body).screenshot);return {status:submitted.length===3?401:200,ok:submitted.length!==3,json:async()=>submitted.length===3?{error:'Войдите заново'}:{answer:'42'}};}};
  vm.runInNewContext(await readFile(new URL('../extension/background.js',import.meta.url),'utf8'),context);
  const request=()=>new Promise(resolve=>listener({type:'GR_SOLVE'},{tab:{id:7,windowId:1}},resolve));
  assert.equal((await request()).answer,'42');assert.equal((await request()).answer,'42');
  assert.deepEqual(submitted,['shot-1','shot-2']);
  assert.equal((await request()).error,'Войдите заново');assert.ok(removed);
});
