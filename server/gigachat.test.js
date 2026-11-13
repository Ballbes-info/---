import test from 'node:test';
import assert from 'node:assert/strict';
import {createSolver} from './gigachat.js';
test('uploads each screenshot, reuses access token and deletes uploaded files',async()=>{
  const calls=[];let count=0;
  const request=async(url,options)=>{
    calls.push({url,options});
    if(url.includes('/oauth'))return Response.json({access_token:'test-token',expires_at:Date.now()+3600000});
    if(url.endsWith('/files'))return Response.json({id:'image-'+(++count)});
    if(url.endsWith('/delete'))return Response.json({deleted:true});
    if(url.endsWith('/chat/completions')){
      const body=JSON.parse(options.body);assert.deepEqual(body.messages[0].attachments,['image-'+count]);
      return Response.json({choices:[{message:{content:String(count)}}]});
    }
    throw Error('Unexpected request');
  };
  const solve=createSolver({GIGACHAT_AUTH_KEY:'test'},request);
  assert.equal(await solve(Buffer.from([255,216,255,217])),'1');
  assert.equal(await solve(Buffer.from([255,216,255,217])),'2');
  assert.equal(calls.filter(x=>x.url.includes('/oauth')).length,1);
  assert.equal(calls.filter(x=>x.url.endsWith('/delete')).length,2);
});
test('cleans up image even if model fails',async()=>{
  let deleted=false;
  const solve=createSolver({GIGACHAT_AUTH_KEY:'test'},async(url)=>{
    if(url.includes('/oauth'))return Response.json({access_token:'test',expires_at:Date.now()+3600000});
    if(url.endsWith('/files'))return Response.json({id:'image'});
    if(url.endsWith('/delete')){deleted=true;return Response.json({});}
    return new Response('',{status:429});
  });
  await assert.rejects(()=>solve(Buffer.from([255,216,255,217])));assert.ok(deleted);
});
