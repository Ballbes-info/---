import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import '../extension/logic.js';import '../extension/calculations.js';import '../extension/gia11.js';import '../extension/graph.js';
const main=JSON.parse(await readFile(new URL('fixtures/gia11-catalogue.json',import.meta.url)));
const extra=JSON.parse(await readFile(new URL('fixtures/gia11-extra.json',import.meta.url)));
const media=JSON.parse(await readFile(new URL('fixtures/gia11-media.json',import.meta.url)));
const storage=JSON.parse(await readFile(new URL('fixtures/gia11-storage.json',import.meta.url)));
const final=JSON.parse(await readFile(new URL('fixtures/gia11-final.json',import.meta.url)));
const solve=t=>GrLogic.solve(t) ?? GrCalculations.solve(t) ?? GrGia11.solve(t);
test('all 20 text-only GIA11 catalogue examples match visible site answers',()=>{
 let checked=0;for(const [i,t] of main.entries()){
  if([0,2,22].includes(i))continue;
  assert.equal(solve(t),t.expected,t.type);checked++;
 }assert.equal(checked,20);
});
test('21 further random catalogue examples match site answers',()=>{
 let checked=0;for(const t of extra){if(t.links.length)continue;assert.equal(solve(t),t.expected,t.text);checked++;}assert.equal(checked,21);
});
test('graph vertex pair supports descending-number answer',()=>{
 const matrix=main[0].tables[0],mapping={1:'C',2:'B',3:'E',4:'A',5:'F',6:'H',7:'G',8:'D'},edges=[];
 for(let i=1;i<matrix.length;i++)for(let j=i+1;j<matrix.length;j++)if(matrix[i][j])edges.push([mapping[i],mapping[j]]);
 assert.equal(GrGraph.solve(main[0],{vertices:[...'ABCDEFGH'],edges}),'86');
});
test('large positional arithmetic is exact and rejects executable input',()=>{
 assert.equal(GrGia11.arithmetic('4^(1000)+1'),4n**1000n+1n);
 assert.throws(()=>GrGia11.arithmetic('process.exit()'));
});
test('21 further multimedia and Fano examples match site answers',()=>{
 for(const t of media.slice(4))assert.equal(solve(t),t.expected,t.text);
});
test('eight audio and record-storage examples match site answers',()=>{
 for(const t of storage)assert.equal(solve(t),t.expected,t.text);
});
test('fresh release-control answers were accepted by the site on 8/8',()=>{
 for(const t of final)assert.equal(solve(t),t.expected,t.text);
});
