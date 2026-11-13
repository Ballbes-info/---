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
