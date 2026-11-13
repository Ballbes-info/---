import test from 'node:test';import assert from 'node:assert/strict';
import '../extension/graph.js';
export function task(edges,text){
 const n=8,matrix=Array.from({length:n+1},(_,i)=>Array.from({length:n+1},(_,j)=>i===0?(j?String(j):''):j===0?String(i):''));
 for(const [a,b,value='*'] of edges)matrix[a][b]=matrix[b][a]=String(value);
 return {text:'Нумерация населённых пунктов в таблице не связана с буквами на графе. '+text,tables:[matrix]};
}
export const graph1={vertices:[...'ABCDEFGH'],edges:['EH','ED','EA','HB','HG','BG','BD','DF','AF','FC','CG'].map(e=>[...e])};
export const task1=task([[1,3],[1,6],[1,8],[2,3],[2,5],[2,8],[3,7],[4,5],[4,7],[5,8],[6,7]],'Выпишите последовательно буквенные обозначения пунктов от пункта № 1 до пункта № 8.');
export const graph2={vertices:[...'ABCDEFGH'],edges:['AC','AB','AG','CB','CF','BE','ED','FD','DH','HG'].map(e=>[...e])};
export const task2=task([[1,6,46],[1,8,11],[2,7,16],[2,8,15],[3,4,22],[3,5,44],[3,6,19],[4,6,33],[4,7,11],[5,8,44]],'Определите сумму протяженностей дорог из пункта B в пункт C и из пункта H в пункт G.');
test('graph mapping accepted by site for live sr10 question',()=>{assert.equal(GrGraph.solve(task1,graph1),'EBDCGAFH');});
test('symmetric graph mappings agree on requested weighted sum',()=>{assert.equal(GrGraph.solve(task2,graph2),'35');});
test('graph matching rejects wrong topology and asymmetric matrix',()=>{
 assert.equal(GrGraph.solve(task1,{...graph1,edges:graph1.edges.slice(1)}),null);
 const broken=structuredClone(task1);broken.tables[0][1][3]='';assert.equal(GrGraph.solve(broken,graph1),null);
});
