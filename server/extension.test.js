import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
test('extension makes a new screenshot for every click and clears expired auth',async()=>{
  let listener, captures=0, removed=false;const submitted=[];
  const context={Set,console,AbortSignal,setTimeout,Date,importScripts(){},chrome:{
    commands:{onCommand:{addListener(){}}},action:{onClicked:{addListener(){}}},
    runtime:{onMessage:{addListener(fn){listener=fn;}}},
    storage:{local:{get:async()=>({serverUrl:'https://server.example',token:'token'}),remove:async()=>{removed=true;}}},
    tabs:{query:async()=>[{id:7}],sendMessage:async()=>{},captureVisibleTab:async()=> 'shot-'+(++captures)}
  },fetch:async(url,options)=>{if(url.endsWith('/health'))return {ok:true,json:async()=>({ok:true})};submitted.push(JSON.parse(options.body).screenshot);return {status:submitted.length===3?401:200,ok:submitted.length!==3,json:async()=>submitted.length===3?{error:'Войдите заново'}:{answer:'42'}};}};
  vm.runInNewContext(await readFile(new URL('../extension/background.js',import.meta.url),'utf8'),context);
  const request=()=>new Promise(resolve=>listener({type:'GR_SOLVE'},{tab:{id:7,windowId:1}},resolve));
  assert.equal((await request()).answer,'42');assert.equal((await request()).answer,'42');
  assert.deepEqual(submitted,['shot-1','shot-2']);
  assert.ok((await request()).authRequired);assert.ok(removed);
});
test('panel login saves session without opening a tab and does not capture the page',async()=>{
  let listener, saved, captures=0;
  const context={Set,console,AbortSignal,setTimeout,Date,importScripts(){},GR_DEFAULT_SERVER:'https://server.example',chrome:{
    commands:{onCommand:{addListener(){}}},action:{onClicked:{addListener(){}}},
    runtime:{onMessage:{addListener(fn){listener=fn;}}},
    storage:{local:{get:async()=> saved || {},set:async value=>{saved=value;}}},
    tabs:{sendMessage:async()=>{},captureVisibleTab:async()=>{captures++;}}
  },fetch:async(url,options)=>{
    if(url.endsWith('/health'))return {ok:true,json:async()=>({ok:true})};
    assert.equal(url,'https://server.example/login');
    assert.equal(JSON.parse(options.body).password,'test-access');
    return {ok:true,json:async()=>({token:'session'})};
  }};
  vm.runInNewContext(await readFile(new URL('../extension/background.js',import.meta.url),'utf8'),context);
  const call=message=>new Promise(resolve=>listener(message,{tab:{id:7}},resolve));
  assert.equal((await call({type:'GR_STATUS'})).authenticated,false);
  assert.equal((await call({type:'GR_LOGIN',password:'test-access'})).authenticated,true);
  assert.equal((await call({type:'GR_STATUS'})).authenticated,true);
  assert.equal(saved.token,'session');assert.equal(captures,0);
});
