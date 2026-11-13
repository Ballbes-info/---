/* Strict template recognisers with exact arithmetic. Unsupported tasks return null. */
(() => {
  const unitBytes=unit=>({К:1024n,М:1048576n,Г:1073741824n}[unit.toUpperCase()[0]] || 1n);
  const ceil=(a,b)=>(a+b-1n)/b;
  function bits(n){let value=0n,count=0n;while((1n<<count)<n){count++;if(count>256n)throw Error('limit');}return count;}
  function audio(text){
    if(!/минимально возможный объ[её]м заголовка трека/i.test(text) || !/без использования сжатия/i.test(text))return null;
    const f=text.match(/частотой дискретизации\s+(\d+)\s*Гц/i),depth=text.match(/разрешением\s+(\d+)\s*бит/i);
    const tracks=text.match(/В альбоме\s+(\d+)\s+трек/i),duration=text.match(/общей длительностью\s+(\d+)\s+секунд/i);
    const total=text.match(/общий объ[её]м альбома занимает\s+(не менее|более)\s+(\d+)\s+([КМГ]?байт[а-я]*)/i);
    const channels=/формате стерео/i.test(text)?2n:/формате моно/i.test(text)?1n:null;
    if(!f || !depth || !tracks || !duration || !total || !channels)return null;
    const count=BigInt(tracks[1]);if(!count)return null;
    const sound=BigInt(f[1])*BigInt(depth[1])*BigInt(duration[1])*channels;
    if(sound%8n)return null;
    const threshold=BigInt(total[2])*unitBytes(total[3])+(total[1].toLowerCase()==='более'?1n:0n);
    const difference=threshold-sound/8n;
    return String(difference<=0n?0n:ceil(difference,count));
  }
  function transparency(text){
    if(!/минимальное количество уровней прозрачности/i.test(text))return null;
    const memory=text.match(/сжатого изображения отведено\s+(более|не менее)\s+(\d+)\s+([КМГ]?байт[а-я]*)/i);
    const size=text.match(/размер\s+(\d+)\s*[×xх]\s*(\d+)\s+пиксел/i),palette=text.match(/палитру из\s+(\d+)\s+цвет/i);
    const ratio=text.match(/несжатым изображением,? на\s+(\d+)\s*%\s+больше/i);
    if(!memory||!size||!palette||!ratio)return null;
    const pixels=BigInt(size[1])*BigInt(size[2]),colorBits=bits(BigInt(palette[1]));
    const bound=BigInt(memory[2])*unitBytes(memory[3])*8n*(100n+BigInt(ratio[1]));
    for(let alpha=0n;alpha<=64n;alpha++){
      const raw=pixels*(colorBits+alpha)*100n;
      if(memory[1].toLowerCase()==='более'?raw>bound:raw>=bound)return String(alpha===0n?1n:(1n<<(alpha-1n))+1n);
    }
    return null;
  }
  function users(text){
    if(!/наименьшем количестве пользователей/i.test(text) || !/посимвольное кодирование/i.test(text))return null;
    const length=text.match(/пароль, состоящий из\s+(\d+)\s+символ/i),special=text.match(/из\s+(\d+)-символьного специального алфавита/i);
    const extra=text.match(/выделено\s+(\d+)\s+байт на одного пользователя/i);
    const storage=text.match(/выделено\s+(не менее|более)\s+(\d+)\s+([КМГ]?байт[а-я]*)/i);
    if(!length||!special||!extra||!storage || !/заглавные буквы латинского алфавита/i.test(text) || !/десятичные цифры/i.test(text) || /строчные/i.test(text))return null;
    const bytes=ceil(BigInt(length[1])*bits(36n+BigInt(special[1])),8n)+BigInt(extra[1]);
    if(!bytes)return null;
    const threshold=BigInt(storage[2])*unitBytes(storage[3])+(storage[1].toLowerCase()==='более'?1n:0n);
    return String(ceil(threshold,bytes));
  }
  function fano(text){
    if(!/условию Фано/i.test(text) || !/минимально возможным количеством двоичных знаков/i.test(text))return null;
    const word=text.match(/кодирования слова\s+([А-ЯЁA-Z]+)/);
    if(!word || word[1].length>100)return null;
    const known={};
    for(const m of text.matchAll(/([А-ЯЁA-Z])\s*[-–—]\s*([01]+)(?=[\s,.;]|$)/g)){if(m[2].length>24 || m[1] in known)return null;known[m[1]]=m[2];}
    if(!Object.keys(known).length)return null;
    const codes=Object.values(known);
    if(codes.some((a,i)=>codes.some((b,j)=>i!==j&&b.startsWith(a))))return null;
    const frequency={};for(const c of word[1])frequency[c]=(frequency[c] || 0)+1;
    let fixed=0;const weights=[];
    for(const [c,count] of Object.entries(frequency)){if(c in known)fixed+=count*known[c].length;else weights.push(count);}
    weights.sort((a,b)=>b-a);if(weights.length>12)return null;
    const trie={};for(const code of codes){let node=trie;for(const bit of code)node=node[bit] ||= {};node.leaf=true;}
    const free=[];
    function walk(node,depth){if(node.leaf)return;for(const bit of ['0','1']){if(node[bit])walk(node[bit],depth+1);else free[depth+1]=(free[depth+1] || 0)+1;}}
    walk(trie,0);
    const listed=text.match(/из набора:\s*([А-ЯЁA-Z](?:,\s*[А-ЯЁA-Z])*)/);
    const reserve=(/заглавные буквы русского алфавита/i.test(text) && new Set([...Object.keys(known),...Object.keys(frequency)]).size<33) || !!listed?.[1].split(/,\s*/).some(c=>!(c in known)&&!(c in frequency));
    if(!weights.length)return !reserve || free.some(Boolean)?String(fixed):null;
    const maxDepth=Math.max(...codes.map(c=>c.length))+Math.ceil(Math.log2(weights.length+2))+2;
    const sums=[0];weights.forEach(w=>sums.push(sums.at(-1)+w));
    let states=new Map([['0,'+(free[1] || 0),0]]),best=Infinity;
    for(let depth=1;depth<=maxDepth;depth++){
      const next=new Map();
      for(const [state,cost] of states){
        const [assigned,slots]=state.split(',').map(Number),remaining=weights.length-assigned;
        for(let count=0;count<=Math.min(slots,remaining);count++){
          const used=assigned+count,total=cost+(sums[used]-sums[assigned])*depth,left=slots-count;
          if(used===weights.length){if(!reserve || left>0 || free.slice(depth+1).some(Boolean))best=Math.min(best,total);continue;}
          const available=Math.min(weights.length-used+(reserve?1:0),2*left+(free[depth+1] || 0)),key=used+','+available;
          if(total<(next.get(key) ?? Infinity))next.set(key,total);
        }
      }
      states=next;
    }
    return Number.isFinite(best)?String(best+fixed):null;
  }
  function turtle(task){
    const text=task.text || '';
    if(!/площадь области (пересечения|объединения) фигур|точек с целочисленными координатами.*внутри (пересечения|объединения) фигур/i.test(text) || !/положительного направления оси ординат/i.test(text) || !/хвост опущен/i.test(text))return null;
    let code=task.code?.at(-1);
    if(!code)code=text.split(/следующий алгоритм:/i)[1]?.split(/Определите/i)[0];
    if(!code || code.length>4000)return null;
    code=code.toLowerCase().replace(/ё/g,'е');
    const tokens=code.match(/повтори|поднять|опустить|хвост|вперед|назад|налево|направо|-?\d+|\[|\]/g) || [];
    if(tokens.join('')!==code.replace(/\s/g,''))return null;
    let pos=0,steps=0;const paths=[];let path=[],x=0,y=0,heading=0,pen=true;
    const directions=[[0,1],[-1,0],[0,-1],[1,0]];
    const closePath=()=>{if(path.length>1)paths.push(path);path=[];};
    function parse(block=false){
      const ops=[];
      while(pos<tokens.length){const token=tokens[pos++];if(token===']'){if(!block)throw Error('bracket');return ops;}
        if(token==='повтори'){const count=Number(tokens[pos++]);if(!Number.isInteger(count)||count<1||count>1000||tokens[pos++]!=='[')throw Error('repeat');ops.push({token,count,body:parse(true)});}
        else if(['поднять','опустить'].includes(token)){if(tokens[pos++]!=='хвост')throw Error('pen');ops.push({token});}
        else if(['вперед','назад','налево','направо'].includes(token)){const value=Number(tokens[pos++]);if(!Number.isInteger(value)||Math.abs(value)>10000)throw Error('number');ops.push({token,value});}
        else throw Error('command');
      }
      if(block)throw Error('bracket');return ops;
    }
    function run(ops){for(const op of ops){if(++steps>10000)throw Error('steps');
      if(op.token==='повтори'){for(let i=0;i<op.count;i++)run(op.body);}
      else if(op.token==='поднять'){closePath();pen=false;}
      else if(op.token==='опустить'){if(!pen)path=[];pen=true;}
      else if(op.token==='налево'||op.token==='направо'){if(op.value%90)throw Error('angle');heading=((heading+(op.token==='налево'?1:-1)*op.value/90)%4+4)%4;}
      else {const distance=op.value*(op.token==='назад'?-1:1),[dx,dy]=directions[heading];if(pen&&!path.length)path.push([x,y]);x+=dx*distance;y+=dy*distance;if(pen)path.push([x,y]);}
    }}
    run(parse());closePath();if(paths.length!==2)return null;
    const rectangles=paths.map(points=>{
      const xs=[...new Set(points.map(p=>p[0]))],ys=[...new Set(points.map(p=>p[1]))];
      if(xs.length!==2||ys.length!==2)return null;
      const loX=Math.min(...xs),hiX=Math.max(...xs),loY=Math.min(...ys),hiY=Math.max(...ys);
      const corners=new Set(points.map(p=>p.join(',')));if(corners.size!==4)return null;
      for(let i=1;i<points.length;i++)if(points[i][0]!==points[i-1][0]&&points[i][1]!==points[i-1][1])return null;
      // All four boundary edges must have been traced at least once.
      const edges=new Set();for(let i=1;i<points.length;i++){if(points[i].join(',')!==points[i-1].join(','))edges.add([points[i].join(','),points[i-1].join(',')].sort().join('|'));}
      if(edges.size!==4)return null;
      return {loX,hiX,loY,hiY,area:(hiX-loX)*(hiY-loY)};
    });
    if(rectangles.some(r=>!r))return null;
    const [a,b]=rectangles,intersection=Math.max(0,Math.min(a.hiX,b.hiX)-Math.max(a.loX,b.loX))*Math.max(0,Math.min(a.hiY,b.hiY)-Math.max(a.loY,b.loY));
    if(/точек с целочисленными координатами/.test(text)){
      const include=/границ[^.]*учитывать(?! не)|включая.*границ/.test(text)&&!/учитывать не следует/.test(text);
      const count=r=>Math.max(0,include?Math.floor(r.hiX)-Math.ceil(r.loX)+1:Math.ceil(r.hiX)-Math.floor(r.loX)-1)*Math.max(0,include?Math.floor(r.hiY)-Math.ceil(r.loY)+1:Math.ceil(r.hiY)-Math.floor(r.loY)-1);
      const overlap={loX:Math.max(a.loX,b.loX),hiX:Math.min(a.hiX,b.hiX),loY:Math.max(a.loY,b.loY),hiY:Math.min(a.hiY,b.hiY)};
      return String(/внутри пересечения/.test(text)?count(overlap):count(a)+count(b)-count(overlap));
    }
    return String(/площадь области пересечения/i.test(text)?intersection:a.area+b.area-intersection);
  }
  function solve(task){try{const text=task?.text || '';return audio(text) ?? transparency(text) ?? users(text) ?? fano(text) ?? turtle(task || {});}catch{return null;}}
  globalThis.GrCalculations=Object.freeze({solve});
})();
