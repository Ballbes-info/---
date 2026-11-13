import test from 'node:test';
import assert from 'node:assert/strict';
import '../extension/vault.js';
test('vault encrypts with random salt and authenticated ciphertext',async()=>{
 const key='test-authorization-key-123456',password='test-access';
 const a=await GrVault.seal(key,password),b=await GrVault.seal(key,password);
 assert.equal(a.iterations,1200000);assert.equal(a.cipher,'AES-256-GCM');
 assert.notEqual(a.salt,b.salt);assert.notEqual(a.iv,b.iv);assert.notEqual(a.ciphertext,b.ciphertext);
 assert.equal(await GrVault.open(a,password),key);
 assert.ok(!JSON.stringify(a).includes(key));assert.ok(!JSON.stringify(a).includes(password));
 await assert.rejects(()=>GrVault.open(a,'wrong-password'),/пароль/);
 const tampered={...a,ciphertext:(a.ciphertext[0]==='A'?'B':'A')+a.ciphertext.slice(1)};
 await assert.rejects(()=>GrVault.open(tampered,password),/пароль/);
 assert.throws(()=>GrVault.validate({...a,iterations:100}),/формат/);
});
