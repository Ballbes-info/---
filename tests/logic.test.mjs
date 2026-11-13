import test from 'node:test';import assert from 'node:assert/strict';
import '../extension/logic.js';
const task=(text,formula)=>({text,formula,tables:[]});
test('reported screenshot: full condition has minimum 195, not missing data',()=>{
 const t=task('На числовой прямой P = [298; 349], Q = [168; 363], R = [214; 430]. Укажите наименьшую возможную длину отрезка А.', '((x ∈ Q) ∧ ¬(x ∈ A)) → ¬(((x ∈ P) → ¬(x ∈ R)) ∧ (x ∈ Q))');
 assert.equal(GrLogic.solve(t),'195');
});
test('live site formula with nested implications',()=>{
 assert.equal(GrLogic.solve(task('P = [308; 450], Q = [340; 480], R = [39; 251]. Укажите наименьшую длину отрезка А.', '(¬(x ∈ A) ∧ ¬(x ∈ R)) → ¬(¬(x ∈ R) → ((x ∈ Q) ∧ (x ∈ P)))')),'110');
});
test('parser precedence, implication and equivalence',()=>{
 const f=GrLogic.parse('¬x ∧ y ∨ (z → w) ≡ x').evaluate;
 for(let mask=0;mask<16;mask++){
  const [x,y,z,w]=[0,1,2,3].map(i=>!!(mask&(1<<i)));
  assert.equal(f({x,y,z,w}),((!x&&y)||(!z||w))===x);
 }
 assert.throws(()=>GrLogic.parse('globalThis.x=1'));
});
test('truth tables preserve variable order and do not treat blanks as zero',()=>{
 const order=['z','x','y'];
 const rows=Array.from({length:8},(_,mask)=>{
  const x=!!(mask&1),y=!!(mask&2),z=!!(mask&4),env={x,y,z};
  return [...order.map(v=>String(Number(env[v]))),String(Number((x&&!y)||z))];
 });
 const t={text:'Определите столбцы таблицы истинности',formula:'x ∧ ¬y ∨ z',tables:[[['','','','F'],...rows]]};
 assert.equal(GrLogic.solve(t),'zxy');
 const ambiguous={...t,tables:[[['','','','F'],['','','','1']]]};
 assert.equal(GrLogic.solve(ambiguous),null);
});
test('minimum interval results agree with independent endpoint enumeration',()=>{
 let checked=0;
 for(let seed=0;seed<80;seed++){
  const p=[seed%7,10+seed%9],q=[2+seed%11,22+seed%5];
  const points=[...new Set([...p,...q])].sort((a,b)=>a-b);
  const samples=[points[0]-1,points.at(-1)+1,...points,...points.slice(1).map((v,i)=>(v+points[i])/2)];
  const pred=(x,a,b)=>{const P=x>=p[0]&&x<=p[1],Q=x>=q[0]&&x<=q[1],A=x>=a&&x<=b;return !(Q&&!A)||!((!P)&&Q);};
  let best=Infinity;
  for(const a of points)for(const b of points)if(b>=a&&samples.every(x=>pred(x,a,b)))best=Math.min(best,b-a);
  const actual=GrLogic.solve(task(`P = [${p.join('; ')}], Q = [${q.join('; ')}]. Наименьшая длина отрезка А.`, '(Q ∧ ¬A) → ¬(¬P ∧ Q)'));
  if(actual!==null){assert.equal(Number(actual),best);checked++;}
 }
 assert.ok(checked>20);
});
test('unsupported and incomplete questions fall back to AI',()=>{
 assert.equal(GrLogic.solve(task('Наибольшая длина отрезка P=[1;4]', 'P→A')),null);
 assert.equal(GrLogic.solve(task('Наименьшая длина отрезка P=[1;4]', 'P→A !!!')),null);
 assert.equal(GrLogic.solve({text:'Другое задание'}),null);
});
