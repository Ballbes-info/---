import test from 'node:test';import assert from 'node:assert/strict';
import '../extension/gigachat-direct.js';
const screenshot='data:image/jpeg;base64,/9j/2Q==';
function provider(fail=false){
 const calls=[];let count=0;
 return {calls,fetch:async(url,options)=>{
  calls.push({url,options});
  if(url.includes('/oauth'))return Response.json({access_token:'bearer-test'});
  if(url.endsWith('/files'))return Response.json({id:'image-'+(++count)});
  if(url.endsWith('/delete'))return Response.json({deleted:true});
  if(url.endsWith('/chat/completions')){
   assert.equal(JSON.parse(options.body).messages[0].attachments[0],'image-'+count);
   return fail?new Response('',{status:429}):Response.json({choices:[{message:{content:String(count)}}]});
  }
  throw Error('Unexpected URL');
 }};
}
test('direct client sends screenshots only to GigaChat and cleans files',async()=>{
 const p=provider();
 assert.equal(await GrGiga.solve(screenshot,'auth-test',()=>{},p.fetch),'1');
 assert.equal(await GrGiga.solve(screenshot,'auth-test',()=>{},p.fetch),'2');
 assert.equal(p.calls.filter(x=>x.url.endsWith('/delete')).length,2);
 assert.ok(p.calls.every(x=>new URL(x.url).hostname==='api.giga.chat'||new URL(x.url).hostname==='ngw.devices.sberbank.ru'));
 assert.equal(p.calls.find(x=>x.url.includes('/oauth')).options.headers.Authorization,'Basic auth-test');
});
test('model failure still deletes uploaded file',async()=>{
 const p=provider(true);await assert.rejects(()=>GrGiga.solve(screenshot,'auth-test',()=>{},p.fetch),/429/);
 assert.ok(p.calls.at(-1).url.endsWith('/delete'));
});
test('invalid screenshot never triggers network',async()=>{
 let calls=0;await assert.rejects(()=>GrGiga.solve('wrong','auth',()=>{},async()=>{calls++;}));assert.equal(calls,0);
});
