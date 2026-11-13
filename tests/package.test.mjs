import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,cp,readFile,rm,readdir} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {spawnSync} from 'node:child_process';
test('local packer creates ZIP with ciphertext and no plaintext credentials',async()=>{
 const temporary=await mkdtemp(join(tmpdir(),'gr-vasya-test-'));
 try {
  await cp(new URL('../extension/',import.meta.url),join(temporary,'extension'),{recursive:true});
  await cp(new URL('../tools/',import.meta.url),join(temporary,'tools'),{recursive:true});
  const key='test-authorization-key-for-packaging',password='test-access';
  const seal=spawnSync(process.execPath,[join(temporary,'tools/seal-key.mjs')],{input:JSON.stringify({authKey:key,password}),encoding:'utf8'});
  assert.equal(seal.status,0,seal.stderr);
  const build=spawnSync(process.execPath,[join(temporary,'tools/build.mjs')],{encoding:'utf8'});assert.equal(build.status,0,build.stderr);
  const [name]=await readdir(join(temporary,'dist'));const archive=await readFile(join(temporary,'dist',name));
  assert.equal(archive.readUInt32LE(0),0x04034b50);
  assert.ok(archive.includes(Buffer.from('private-key.vault.json')));
  assert.ok(!archive.includes(Buffer.from(key)));assert.ok(!archive.includes(Buffer.from(password)));
  assert.ok(!archive.includes(Buffer.from('server/')));
 }finally{await rm(temporary,{recursive:true,force:true});}
});
