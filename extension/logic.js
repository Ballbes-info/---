/* Exact evaluators for strictly recognised templates; no eval or generated code. */
(() => {
  function parse(source) {
    if(typeof source!=='string' || source.length>2000)throw Error('formula');
    const normal=source.replace(/х/g,'x').replace(/А/g,'A').replace(/\s/g,'').replace(/x∈([A-Z])/g,'$1');
    const tokens=normal.match(/<->|->|[()!¬∧&∨|⊕^→↔≡01A-Za-z]/g) || [];
    if(tokens.join('')!==normal)throw Error('syntax');
    const variables=new Set();let pos=0;
    const take=()=>tokens[pos++];
    function atom(){
      const token=take();
      if(token==='!' || token==='¬'){const f=atom();return e=>!f(e);}
      if(token==='('){const f=equiv();if(take()!==')')throw Error('bracket');return f;}
      if(token==='0' || token==='1')return ()=>token==='1';
      if(/^[A-Za-z]$/.test(token || '')){variables.add(token);return e=>{if(!(token in e))throw Error('variable');return !!e[token];};}
      throw Error('atom');
    }
    function and(){let f=atom();while(['∧','&'].includes(tokens[pos])){take();const a=f,b=atom();f=e=>a(e)&&b(e);}return f;}
    function or(){let f=and();while(['∨','|','⊕','^'].includes(tokens[pos])){const op=take(),a=f,b=and();f=e=>['⊕','^'].includes(op)?a(e)!==b(e):a(e)||b(e);}return f;}
    function implies(){const a=or();if(['→','->'].includes(tokens[pos])){take();const b=implies();return e=>!a(e)||b(e);}return a;}
    function equiv(){let f=implies();while(['≡','↔','<->'].includes(tokens[pos])){take();const a=f,b=implies();f=e=>a(e)===b(e);}return f;}
    const evaluate=equiv();if(pos!==tokens.length)throw Error('trailing');return {evaluate,variables:[...variables]};
  }
  function intervals(task) {
    const text=task?.text || '';
    if(!/наименьш|наибольш/i.test(text) || !/длин/i.test(text) || !/отрез/i.test(text) || /целых|целом|натуральн/i.test(text))return null;
    const ranges={};
    const regex=/([A-Z])\s*=\s*\[\s*(-?\d+(?:[.,]\d+)?)\s*;\s*(-?\d+(?:[.,]\d+)?)\s*\]/g;
    for(const match of text.matchAll(regex)){
      const a=Number(match[2].replace(',','.')),b=Number(match[3].replace(',','.'));
      if(a>b)return null;ranges[match[1]]=[a,b];
    }
    if(Object.keys(ranges).length<1 || 'A' in ranges)return null;
    const formula=parse(task.formula);
    if(!formula.variables.includes('A') || formula.variables.some(v=>v!=='A' && !(v in ranges)))return null;
    const points=[...new Set(Object.values(ranges).flat())].sort((a,b)=>a-b);
    const atoms=[{x:points[0]-1,lo:-Infinity,hi:points[0]}];
    points.forEach((point,i)=>{
      atoms.push({x:point,lo:point,hi:point});
      if(i+1<points.length)atoms.push({x:(point+points[i+1])/2,lo:point,hi:points[i+1]});
    });
    atoms.push({x:points.at(-1)+1,lo:points.at(-1),hi:Infinity});
    const evaluate=(x,a)=>formula.evaluate(Object.fromEntries([['A',a],...Object.entries(ranges).map(([v,[lo,hi]])=>[v,x>=lo&&x<=hi])]));
    if(/наибольш/i.test(text)){
      let best=null;
      for(const lo of points)for(const hi of points){if(hi<lo)continue;if(atoms.every(a=>evaluate(a.x,a.x>=lo&&a.x<=hi))&&(!best||hi-lo>best.hi-best.lo))best={lo,hi};}
      if(!best)return null;
      const before=atoms.filter(a=>a.x<best.lo).at(-1),after=atoms.find(a=>a.x>best.hi);
      if((before&&evaluate(before.x,true))||(after&&evaluate(after.x,true)))return null;
      return String(Number((best.hi-best.lo).toPrecision(12)));
    }
    const required=[];
    for(const atom of atoms){const no=evaluate(atom.x,false),yes=evaluate(atom.x,true);if(!no&&!yes)return null;if(!no)required.push(atom);}
    if(!required.length)return atoms.some(a=>evaluate(a.x,true))?'0':null;
    const lo=Math.min(...required.map(a=>a.lo)),hi=Math.max(...required.map(a=>a.hi));
    if(!Number.isFinite(lo)||!Number.isFinite(hi))return null;
    if(!atoms.every(a=>evaluate(a.x,a.x>=lo&&a.x<=hi)))return null;
    return String(Number((hi-lo).toPrecision(12)));
  }
  function permutations(items){if(!items.length)return [[]];return items.flatMap((v,i)=>permutations(items.filter((_,j)=>i!==j)).map(t=>[v,...t]));}
  function truthTable(task) {
    if(!/столбц/i.test(task?.text || '') || !/таблиц/i.test(task.text))return null;
    const formula=parse(task.formula),vars=formula.variables.sort(),n=vars.length;
    if(n<2 || n>5 || vars.some(v=>!/[a-z]/.test(v)) || task.tables?.length!==1)return null;
    const table=task.tables[0];
    if(table.length<2 || table[0].length!==n+1 || table.at(0).at(-1).trim()!=='F')return null;
    const rows=table.slice(1).map(row=>row.map(v=>v.trim()));
    if(rows.length>2**n || rows.some(row=>row.length!==n+1 || !/^[01]$/.test(row[n]) || row.slice(0,n).some(v=>!/^([01])?$/.test(v))))return null;
    const assignments=Array.from({length:2**n},(_,mask)=>({mask,env:Object.fromEntries(vars.map((v,i)=>[v,!!(mask&(1<<i))]))}));
    const matches=[];
    for(const order of permutations(vars)){
      const possibilities=rows.map(row=>assignments.filter(a=>Number(formula.evaluate(a.env))===Number(row[n]) && order.every((v,i)=>row[i]==='' || Number(a.env[v])===Number(row[i]))).map(a=>a.mask));
      const owner=new Map();
      function augment(row,seen){for(const mask of possibilities[row]){if(seen.has(mask))continue;seen.add(mask);if(!owner.has(mask) || augment(owner.get(mask),seen)){owner.set(mask,row);return true;}}return false;}
      if(possibilities.every((_,row)=>augment(row,new Set())))matches.push(order.join(''));
      if(matches.length>1)return null;
    }
    return matches.length===1?matches[0]:null;
  }
  function solve(task){try{return intervals(task) ?? truthTable(task);}catch{return null;}}
  globalThis.GrLogic=Object.freeze({parse,solve});
})();
