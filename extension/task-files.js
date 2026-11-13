/* Read-only downloads from links in the visible question. No executable content. */
(() => {
  const decoder=new TextDecoder(),cache=new Map();
  function crc32(data){let crc=0xffffffff;for(const byte of data){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
  const xml=text=>text.replace(/&(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);/gi,entity=>{
    const names={'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'"};
    return names[entity] ?? String.fromCodePoint(entity[2]?.toLowerCase()==='x'?parseInt(entity.slice(3),16):Number(entity.slice(2,-1)));
  });
  const attr=(text,name)=>xml(text.match(new RegExp('(?:^|\\s)'+name+'="([^"]*)"'))?.[1] || '');
  async function limited(stream,limit){const reader=stream.getReader(),chunks=[];let total=0;
    try{while(true){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>limit)throw Error('file size');chunks.push(value);}}
    finally{await reader.cancel().catch(()=>{});}
    const result=new Uint8Array(total);let p=0;for(const chunk of chunks){result.set(chunk,p);p+=chunk.length;}return result;
  }
  async function unzip(data){
    const view=new DataView(data.buffer,data.byteOffset,data.byteLength);let eocd=-1;
    for(let i=data.length-22;i>=Math.max(0,data.length-65558);i--)if(view.getUint32(i,true)===0x06054b50){eocd=i;break;}
    if(eocd<0)throw Error('zip');const count=view.getUint16(eocd+10,true);if(count>500)throw Error('entries');
    let offset=view.getUint32(eocd+16,true),total=0;const files={};
    for(let i=0;i<count;i++){
      if(view.getUint32(offset,true)!==0x02014b50)throw Error('directory');
      const method=view.getUint16(offset+10,true),checksum=view.getUint32(offset+16,true),compressed=view.getUint32(offset+20,true),size=view.getUint32(offset+24,true),nameSize=view.getUint16(offset+28,true),extra=view.getUint16(offset+30,true),comment=view.getUint16(offset+32,true),local=view.getUint32(offset+42,true);
      const name=decoder.decode(data.subarray(offset+46,offset+46+nameSize));offset+=46+nameSize+extra+comment;
      if(!name.endsWith('.xml')&&!name.endsWith('.rels'))continue;
      if(size>16000000||(total+=size)>30000000||compressed>10000000)throw Error('zip size');
      if(view.getUint32(local,true)!==0x04034b50)throw Error('local header');
      const start=local+30+view.getUint16(local+26,true)+view.getUint16(local+28,true);if(start+compressed>data.length)throw Error('zip bounds');
      const packed=data.subarray(start,start+compressed);
      const plain=method===0?packed:method===8?await limited(new Blob([packed]).stream().pipeThrough(new DecompressionStream('deflate-raw')),16000000):null;
      if(!plain||plain.length!==size||crc32(plain)!==checksum)throw Error('compression');const text=decoder.decode(plain);if(/<!DOCTYPE|<!ENTITY/i.test(text))throw Error('xml entities');files[name]=text;
    }return files;
  }
  async function workbook(data){
    const files=await unzip(data),strings=[...(files['xl/sharedStrings.xml'] || '').matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map(m=>[...m[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(t=>xml(t[1])).join(''));
    const relationships={};for(const m of (files['xl/_rels/workbook.xml.rels'] || '').matchAll(/<Relationship\b([^>]+)\/?\s*>/g)){const target=attr(m[1],'Target');relationships[attr(m[1],'Id')]=target.startsWith('/')?target.slice(1):'xl/'+target;}
    const result={};
    for(const sheet of (files['xl/workbook.xml'] || '').matchAll(/<sheet\b([^>]+)\/?\s*>/g)){
      const name=attr(sheet[1],'name'),path=relationships[attr(sheet[1],'r:id')];if(!files[path])throw Error('sheet');const rows=[];
      for(const row of files[path].matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)){
        const values=[];for(const cell of row[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)){
          const reference=attr(cell[1],'r'),type=attr(cell[1],'t');let column=0;for(const c of reference.match(/^[A-Z]+/)?.[0] || '')column=column*26+c.charCodeAt(0)-64;
          if(column<1||column>100)continue;
          const value=cell[2].match(/<v[^>]*>([\s\S]*?)<\/v>/)?.[1];
          values[column-1]=type==='s'?strings[Number(value)]:type==='inlineStr'?[...cell[2].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(m=>xml(m[1])).join(''):value===undefined?'':type==='str'?xml(value):Number(value);
        }rows.push(values);
      }result[name]=rows;
    }return result;
  }
  function sequence(task,source){
    const t=task.text;if(!/два идущих подряд элемента/.test(t))return null;
    const rule=t.match(/N [–—-] (минимальное|максимальное) по абсолютной величине число в последовательности, (не кратное|кратное) (\d+)/),pairs=t.match(/в которых (оба числа|хотя бы одно число|ровно одно число) (не кратны|кратны|не кратно|кратно) N/);
    if(!rule||!pairs)return null;const chunks=source.trim().split(/\s+/);if(chunks.length>2000000||chunks.some(s=>!/^[-+]?\d+$/.test(s)))return null;const values=chunks.map(Number);if(values.some(v=>!Number.isSafeInteger(v)))return null;
    const eligible=values.filter(v=>(v%Number(rule[3])===0)===(rule[2]==='кратное')).map(Math.abs);if(!eligible.length)return null;
    const n=eligible.reduce((a,b)=>rule[1]==='минимальное'?Math.min(a,b):Math.max(a,b));if(n===0)return null;
    let count=0,extreme=/максимальной из сумм/.test(t)?-Infinity:Infinity;
    for(let i=1;i<values.length;i++){
      const a=(values[i-1]%n===0)===!pairs[2].startsWith('не'),b=(values[i]%n===0)===!pairs[2].startsWith('не');
      const ok=pairs[1]==='оба числа'?a&&b:pairs[1]==='хотя бы одно число'?a||b:a!==b;if(!ok)continue;count++;
      const sum=values[i-1]+values[i];extreme=/максимальной из сумм/.test(t)?Math.max(extreme,sum):Math.min(extreme,sum);
    }
    return count?count+' '+(/абсолютное значение/.test(t)?Math.abs(extreme):extreme):null;
  }
  function products(task,book){
    const t=task.text,query=t.split(/Используя информацию/i)[1];if(!query)return null;
    const word=t.match(/есть слово «([^»]+)»/),dates=t.match(/с (\d+) по (\d+) (января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря) включительно/);
    if(!word||!dates)return null;
    const moves=book['Движение товаров'],goods=book['Товар'],shops=book['Магазин'];if(!moves||!goods||!shops)return null;
    const makeMap=(rows,key)=>new Map(rows.slice(1).map(r=>[r[key],Object.fromEntries(rows[0].map((h,i)=>[String(h).toLowerCase(),r[i]]))]));
    const goodsMap=makeMap(goods,0),shopsMap=makeMap(shops,0);
    const stem=s=>s.toLowerCase().replace(/(?:ого|ной|ная|ный|ной|ой|ый|ая|ий|ей)$/,'');
    const street=query.match(/на ([А-ЯЁ][а-яё]+) улице/),prospect=query.match(/на проспекте ([А-ЯЁ][а-яё]+)/),district=query.match(/магазин[а-я]* ([А-ЯЁ][а-яё]+) района/);
    if(!street&&!prospect&&!district)return null;
    const location=stem((street||prospect||district)[1]),month=['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'].indexOf(dates[3]);
    const op=/поставлено/.test(query)?'Поступление':/продано|проданных/.test(query)?'Продажа':null;if(!op)return null;
    const kind=/на какую сумму/.test(query)?'money':/общую массу/.test(query)?'mass':/сколько упаковок/.test(query)?'count':null;if(!kind)return null;
    let total=0;
    for(const row of moves.slice(1)){
      const [_,date,shop,article,quantity,operation]=row;if(operation!==op)continue;
      const d=typeof date==='number'?new Date(Date.UTC(1899,11,30)+date*86400000):new Date(date);
      if(d.getUTCMonth()!==month||d.getUTCDate()<Number(dates[1])||d.getUTCDate()>Number(dates[2]))continue;
      const product=goodsMap.get(article),store=shopsMap.get(shop);if(!product||!store)continue;
      if(!String(product['наименование товара']).toLowerCase().includes(word[1].toLowerCase()))continue;
      const address=String(district?store['район']:store['адрес']).toLowerCase();if(!address.includes(location) || (prospect&&!address.includes('просп')))continue;
      if(kind==='count')total+=quantity;
      else if(kind==='money')total+=quantity*Number(product['цена за упаковку']);
      else {const unit=String(product['ед_изм']).toLowerCase();if(!['грамм','кг','килограмм'].includes(unit))return null;total+=quantity*Number(product['количество в упаковке'])/(unit==='грамм'?1000:1);}
    }return String(/целую часть/.test(query)?Math.floor(total+1e-7):Number(total.toFixed(6)));
  }
  async function solve(task,fetcher=fetch,{throwOnError=false}={}){
    const link=task?.links?.find(l=>/^https:\/\/vgaranov\.ru\/download\/[^?#]+\.(xlsx|txt)$/i.test(l.href));if(!link)return null;
    if(!/два идущих подряд элемента|базы данных «Продукты»/.test(task.text))return null;
    try{
      let data=cache.get(link.href);if(!data){const response=await fetcher(link.href,{signal:AbortSignal.timeout(20000),credentials:'omit',redirect:'error'});if(!response.ok)throw Error('download');const bytes=await limited(response.body,10000000);data=link.href.endsWith('.xlsx')?await workbook(bytes):decoder.decode(bytes);if(cache.size>3)cache.clear();cache.set(link.href,data);}
      return typeof data==='string'?sequence(task,data):products(task,data);
    }catch{if(throwOnError)throw new Error('Не удалось прочитать файл задания. Проверьте сеть и разрешение расширения на доступ к vgaranov.ru');return null;}
  }
  globalThis.GrTaskFiles=Object.freeze({solve,workbook,sequence,products});
})();
