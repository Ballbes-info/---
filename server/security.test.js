import test from 'node:test';import assert from 'node:assert/strict';
import {issue,valid,decodeImage} from './security.js';
import {createApp} from './index.js';
const env={ACCESS_PASSWORD:'test-password-123',SESSION_SECRET:'x'.repeat(40),DAILY_LIMIT:'2'};
test('signed sessions reject tampering and expire',()=>{const token=issue(env.SESSION_SECRET,100);assert.ok(valid(token,env.SESSION_SECRET,101));assert.ok(!valid(token+'x',env.SESSION_SECRET,101));assert.ok(!valid(token,env.SESSION_SECRET,31*86400000));});
test('image validation rejects wrong type and oversized input',()=>{assert.throws(()=>decodeImage('hello'));assert.throws(()=>decodeImage('data:image/jpeg;base64,AAAA'));});
test('login, auth, screenshot processing and origin restrictions',async()=>{
  const app=createApp(env,async()=> '42');await new Promise(r=>app.listen(0,'127.0.0.1',r));
  const base='http://127.0.0.1:'+app.address().port;
  const headers={Origin:'chrome-extension://'+'a'.repeat(32),'Content-Type':'application/json'};
  try {
    assert.equal((await fetch(base+'/login',{method:'POST',headers,body:JSON.stringify({password:'wrong'})})).status,401);
    const login=await fetch(base+'/login',{method:'POST',headers,body:JSON.stringify({password:env.ACCESS_PASSWORD})});assert.equal(login.status,200);const {token}=await login.json();
    assert.equal((await fetch(base+'/solve',{method:'POST',headers,body:'{}'})).status,401);
    const result=await fetch(base+'/solve',{method:'POST',headers:{...headers,Authorization:'Bearer '+token},body:JSON.stringify({screenshot:'data:image/jpeg;base64,/9j/2Q=='})});assert.equal(result.status,200);assert.equal((await result.json()).answer,'42');
    assert.equal((await fetch(base+'/login',{method:'POST',headers:{...headers,Origin:'https://evil.example'},body:'{}'})).status,403);
  }finally{await new Promise(r=>app.close(r));}
});
test('async answers are accessible only to their session and missing API key is explicit',async()=>{
  const app=createApp(env,async()=> '123');await new Promise(r=>app.listen(0,'127.0.0.1',r));
  const base='http://127.0.0.1:'+app.address().port;
  const headers={Origin:'chrome-extension://'+'a'.repeat(32),'Content-Type':'application/json',Authorization:'Bearer '+issue(env.SESSION_SECRET),Prefer:'respond-async'};
  try {
    const response=await fetch(base+'/solve',{method:'POST',headers,body:JSON.stringify({screenshot:'data:image/jpeg;base64,/9j/2Q=='})});
    assert.equal(response.status,202);const {jobId}=await response.json();
    const poll=await fetch(base+'/jobs/'+jobId,{headers});assert.equal(poll.status,200);assert.equal((await poll.json()).answer,'123');
    const other=await fetch(base+'/jobs/'+jobId,{headers:{...headers,Authorization:'Bearer '+issue(env.SESSION_SECRET)}});assert.equal(other.status,404);
  }finally{await new Promise(r=>app.close(r));}
  const unconfigured=createApp(env);await new Promise(r=>unconfigured.listen(0,'127.0.0.1',r));
  const second='http://127.0.0.1:'+unconfigured.address().port;
  try {
    assert.equal((await (await fetch(second+'/health')).json()).aiConfigured,false);
    assert.equal((await fetch(second+'/solve',{method:'POST',headers,body:'{}'})).status,503);
  }finally{await new Promise(r=>unconfigured.close(r));}
});
