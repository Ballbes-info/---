/* Graph matching is computed locally; image recognition supplies edges only. */
(() => {
  function table(task){
    if(!/граф/i.test(task?.text || '') || !/нумерация насел[её]нных пунктов/i.test(task.text))return null;
    const candidates=(task.tables || []).filter(t=>t.length>=3&&t.length<=11&&t.every(r=>r.length===t.length));
    if(candidates.length!==1)return null;
    const data=candidates[0],n=data.length-1;
    if(data[0][0]!=='' || data[0].slice(1).some((v,i)=>v!==String(i+1)) || data.slice(1).some((r,i)=>r[0]!==String(i+1)))return null;
    const matrix=data.slice(1).map(r=>r.slice(1));
    for(let i=0;i<n;i++)for(let j=0;j<n;j++){
      const value=matrix[i][j];if(!/^(?:|\*|[1-9]\d*)$/.test(value) || value!==matrix[j][i] || (i===j&&value!==''))return null;
    }
    return {n,matrix};
  }
  function isTask(task){return !!table(task);}
  function solve(task,topology){
    try{
      const data=table(task);if(!data)return null;const {n,matrix}=data;
      const vertices=topology?.vertices,edges=topology?.edges;
      if(!Array.isArray(vertices)||vertices.length!==n||new Set(vertices).size!==n||vertices.some(v=>typeof v!=='string'||!(/^[A-ZА-ЯЁ]$/u.test(v)))||!Array.isArray(edges)||edges.length>n*(n-1)/2)return null;
      const graph=vertices.map(()=>Array(n).fill(false));
      for(const pair of edges){if(!Array.isArray(pair)||pair.length!==2)return null;const a=vertices.indexOf(pair[0]),b=vertices.indexOf(pair[1]);if(a<0||b<0||a===b||graph[a][b])return null;graph[a][b]=graph[b][a]=true;}
      const adjacency=matrix.map(r=>r.map(Boolean)),degree=adjacency.map(r=>r.filter(Boolean).length),targetDegree=graph.map(r=>r.filter(Boolean).length);
      const signature=(array,degrees,index)=>degrees[index]+':'+array[index].flatMap((edge,i)=>edge?[degrees[i]]:[]).sort((a,b)=>a-b).join(',');
      const options=degree.map((_,i)=>vertices.flatMap((v,j)=>signature(adjacency,degree,i)===signature(graph,targetDegree,j)?[j]:[]));
      if(options.some(x=>!x.length))return null;
      let kind,pairs=[],selected;
      const range=task.text.match(/от пункта\s*№?\s*(\d+)\s*до пункта\s*№?\s*(\d+)/i);
      if(/выпишите последовательно/i.test(task.text)&&range&&Number(range[1])===1&&Number(range[2])===n)kind='mapping';
      else if(/какие номера насел[её]нных пунктов/i.test(task.text)){
        selected=task.text.match(/насел[её]нным пунктам\s+([A-ZА-ЯЁ])\s+и\s+([A-ZА-ЯЁ])/);
        if(!selected)return null;kind='numbers';
      }else if(/сумму протяж[её]нностей дорог/i.test(task.text)){
        pairs=[...task.text.matchAll(/из пункта\s+([A-ZА-ЯЁ])\s+в пункт\s+([A-ZА-ЯЁ])/g)].map(m=>[m[1],m[2]]);
        if(pairs.length!==2)return null;kind='sum';
      }else return null;
      const order=Array.from({length:n},(_,i)=>i).sort((a,b)=>options[a].length-options[b].length),mapping=Array(n).fill(-1),used=new Set(),answers=new Set();let visits=0,aborted=false;
      function answer(){
        if(kind==='mapping')return mapping.map(i=>vertices[i]).join('');
        if(kind==='numbers'){
          const result=selected.slice(1).map(v=>mapping.indexOf(vertices.indexOf(v))+1);if(result.some(n=>n===0))return null;
          result.sort((a,b)=>/убывания/.test(task.text)?b-a:a-b);return result.join('');
        }
        let sum=0;for(const [a,b] of pairs){const i=mapping.indexOf(vertices.indexOf(a)),j=mapping.indexOf(vertices.indexOf(b));if(i<0||j<0||!/^\d+$/.test(matrix[i][j]))return null;sum+=Number(matrix[i][j]);}return String(sum);
      }
      function search(depth){
        if(++visits>50000){aborted=true;return;}
        if(depth===n){const value=answer();if(value===null){aborted=true;return;}answers.add(value);return;}
        const i=order[depth];
        for(const candidate of options[i]){
          if(used.has(candidate)||mapping.some((mapped,j)=>mapped>=0&&adjacency[i][j]!==graph[candidate][mapped]))continue;
          mapping[i]=candidate;used.add(candidate);search(depth+1);used.delete(candidate);mapping[i]=-1;
          if(aborted||answers.size>1)return;
        }
      }
      search(0);return !aborted&&answers.size===1?[...answers][0]:null;
    }catch{return null;}
  }
  globalThis.GrGraph=Object.freeze({isTask,solve});
})();
