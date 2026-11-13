/* Catalogue solvers. Text is data: no eval, scripts, or generated executable code. */
(() => {
  const ceil=(a,b)=>(a+b-1n)/b;
  const bytes=u=>({К:1024n,М:1048576n,Г:1073741824n}[u.toUpperCase()[0]] || 1n);
  function bits(n){let b=0n;while(2n**b<n){if(++b>256n)throw Error('limit');}return b;}
  function prefixCost(codes,weights){
    if(!codes.length || codes.some((a,i)=>codes.some((b,j)=>i!==j&&b.startsWith(a))))return null;
    const root={};for(const code of codes){let n=root;for(const c of code)n=n[c] ||= {};n.end=true;}
    const free=[];function walk(n,d){if(n.end)return;for(const c of ['0','1']){if(n[c])walk(n[c],d+1);else free[d+1]=(free[d+1] || 0)+1;}}walk(root,0);
    weights.sort((a,b)=>b-a);let states=new Map([['0,'+(free[1] || 0),0]]),best=Infinity;const sums=[0];weights.forEach(w=>sums.push(sums.at(-1)+w));
    for(let depth=1;depth<=Math.max(...codes.map(c=>c.length))+8;depth++){
      const next=new Map();for(const [state,cost] of states){const [done,slots]=state.split(',').map(Number);
        for(let k=0;k<=Math.min(slots,weights.length-done);k++){
          const assigned=done+k,total=cost+(sums[assigned]-sums[done])*depth;
          if(assigned===weights.length){best=Math.min(best,total);continue;}
          const available=Math.min(weights.length-assigned,2*(slots-k)+(free[depth+1] || 0)),key=assigned+','+available;
          if(total<(next.get(key) ?? Infinity))next.set(key,total);
        }
      }states=next;
    }return Number.isFinite(best)?best:null;
  }
  function fano(task){
    const text=task.text;if(!/код/i.test(text))return null;
    const rows=(task.tables || []).flatMap(t=>t.slice(1)).filter(r=>r.length===2&&/^[01]*$/.test(r[1]));
    const codes=rows.filter(r=>r[1]).map(r=>r[1]);if(!codes.length)return null;
    if(/код минимальной длины для буквы/i.test(text)){
      let queue=['0','1'];while(queue.length){const candidate=queue.shift();if(codes.some(c=>candidate.startsWith(c)))continue;
        if(!codes.some(c=>c.startsWith(candidate)))return candidate;
        if(candidate.length<25)queue.push(candidate+'0',candidate+'1');
      }return null;
    }
    if(/кодирования всех знаков арифметических действий/i.test(text)&&/\(\+,\s*-,\s*\*,\s*\/\)/.test(text)){const answer=prefixCost(codes,[1,1,1,1]);return answer===null?null:String(answer);}
    return null;
  }
  function binaryMachine(task){
    const text=task.text;if(!/Автомат обрабатывает натуральное число N/i.test(text)||!/Строится двоичная запись/i.test(text))return null;
    const actions=[...text.matchAll(/если ([\s\S]*?), то ([^;\n]+)[;\n.]/g)];if(actions.length!==2)return null;
    function operation(action){
      const added=action.match(/слева дописывается ([01]+) и справа ([01]+)/);if(added)return b=>added[1]+b+added[2];
      const replaced=action.match(/справа дописывается ([01]+), а (два|три|четыре|\d+) левых разряда заменяются на ([01]+)/);
      if(replaced){const n=({два:2,три:3,четыре:4}[replaced[2]] || Number(replaced[2]));if(n<1||n>8)return null;return b=>replaced[3]+(b+replaced[1]).slice(n);}
      return null;
    }
    const ops=actions.map(m=>operation(m[2]));if(ops.some(o=>!o))return null;
    const bound=text.match(/число, (большее|меньшее) (\d+)/),wantMin=/Для какого наименьшего N/.test(text),wantMax=/Для какого наибольшего N/.test(text);
    if(!bound||(!wantMin&&!wantMax))return null;
    const limit=Number(bound[2]);if(limit>100000)return null;let answer=null;
    const parity=/сумма цифр в двоичной записи/.test(actions[0][1]);
    const maxN=Math.min(1048576,2**(Math.ceil(Math.log2(limit+1))+8));
    for(let n=1;n<=maxN;n++){
      const b=n.toString(2),even=parity?b.replace(/0/g,'').length%2===0:n%2===0;
      const value=parseInt(ops[even?0:1](b),2),ok=bound[1]==='большее'?value>limit:value<limit;
      if(ok){answer=n;if(wantMin)break;}
    }return answer===null||answer===maxN?null:String(answer);
  }
  function image(task){
    const t=task.text,dimensions=t.match(/(\d+)\s*(?:[×xх]|на)\s*(\d+)\s*(?:точек|пиксел)/i),palette=t.match(/(?:из|палитр[а-я]*\s+из)\s*(\d+)\s+цвет/i);
    if(!dimensions)return null;
    const pixels=BigInt(dimensions[1])*BigInt(dimensions[2]);
    if(/минимальное количество цветов.*в палитре/.test(t)){
      const m=t.match(/отвел[иа] (более|не менее) (\d+) ([КМГ]?байт[а-я]*)/i);if(!m)return null;
      const memory=BigInt(m[2])*bytes(m[3])*8n,b=m[1]==='более'?memory/pixels+1n:ceil(memory,pixels);return String(b===0n?1n:2n**(b-1n)+1n);
    }
    if(/максимальное количество цветов \(без уч[её]та степени прозрачности\)/.test(t)){
      const m=t.match(/отведено не более (\d+) ([КМГ]?байт[а-я]*)/i),a=t.match(/также используется (\d+) бит/i);if(!m||!a)return null;
      const b=BigInt(m[1])*bytes(m[2])*8n/pixels-BigInt(a[1]);return b>=0n&&b<=64n?String(2n**b):null;
    }
    if(!palette)return null;const colors=bits(BigInt(palette[1]));
    if(/максимальное количество снимков/.test(t)){
      const card=t.match(/вмещает(?:ся)? не более (\d+) ([КМГ]?байт[а-я]*)/i),count=t.match(/фотограф использовал (\d+) карт/i),last=t.match(/на последней (?:было|был|находилось) (\d+) сним/i);
      if(!card||!count||!last)return null;
      const perCard=BigInt(card[1])*bytes(card[2])/ceil(pixels*colors,8n),cards=BigInt(count[1]),remaining=BigInt(last[1]);
      if(perCard<1n||cards<1n||remaining<1n||remaining>perCard)return null;
      return String((cards-1n)*perCard+remaining);
    }
    if(/минимальное количество карт/.test(t)){
      const card=t.match(/вмещает не более (\d+) ([КМГ]?байт[а-я]*)/i),count=t.match(/фотограф сделал (\d+) снимков/i);if(!card||!count)return null;
      const perCard=BigInt(card[1])*bytes(card[2])/ceil(pixels*colors,8n);return perCard>0n?String(ceil(BigInt(count[1]),perCard)):null;
    }
    if(/уровней прозрачности/.test(t)){
      const m=t.match(/сжатого изображения отведено (не более|менее|более|не менее) (\d+) ([КМГ]?байт[а-я]*)/i),r=t.match(/несжатым изображением,? на (\d+)\s*% больше/i);
      if(!m||!r)return null;const limit=BigInt(m[2])*bytes(m[3])*8n*(100n+BigInt(r[1]));
      if(/максимальное количество/.test(t)){
        let best=null;for(let a=0n;a<=64n;a++){const value=pixels*(colors+a)*100n;if(m[1]==='менее'?value<limit:value<=limit)best=String(2n**a);}return best;
      }return null;
    }
    if(/минимальный объ[её]м видеопамяти/i.test(t)){
      const u=t.match(/компьютера\s*\(([КМГ]?байт)/i)?.[1];if(!u)return null;return String(ceil(pixels*colors,8n*bytes(u)));
    }return null;
  }
  function duration(t){
    const d=t.match(/(?:общей длительностью|продолжительностью|Длительность записи)\s*(?:(\d+)\s*(?:час[а-я]*))?\s*(?:(\d+)\s*минут[а-я]*)?\s*(?:(\d+)\s*секунд[а-я]*)?/i);
    if(!d || !d.slice(1).some(Boolean))return null;return BigInt(d[1] || 0)*3600n+BigInt(d[2] || 0)*60n+BigInt(d[3] || 0);
  }
  function sound(task){
    const t=task.text,f=t.match(/частот(?:ой|у) дискретизации (\d+)\s*(к?Гц)/i),depth=t.match(/(?:разрешением|глубин(?:ой|у) кодирования) (\d+) бит/i)||t.match(/(\d+)-битным разрешением/i),channels=/стерео/i.test(t)?2n:/моно/i.test(t)?1n:/квадро/i.test(t)?4n:null;
    if(!f||!depth||!channels)return null;const rate=BigInt(f[1])*(f[2].toLowerCase()==='кгц'?1000n:1n)*BigInt(depth[1])*channels;
    if(/(?:минимально|максимально) возможный объ[её]м заголовка трека/i.test(t)){
      const time=duration(t),n=t.match(/В альбоме (\d+) трек/i),total=t.match(/общий объ[её]м альбома (?:занимает )?(не менее|более|не превышает|менее) (\d+) ([КМГ]?байт[а-я]*)/i),unit=t.match(/объ[её]м заголовка трека в ([КМГ]?байт[а-я]*)/i);
      if(time===null||!n||!total||!unit)return null;const need=BigInt(total[2])*bytes(total[3])*8n+(total[1]==='более'?8n:total[1]==='менее'?-8n:0n)-rate*time,denom=BigInt(n[1])*8n*bytes(unit[1]);
      return /максимально/.test(t)?(need>=0n?String(need/denom):null):String(need>0n?ceil(need,denom):0n);
    }
    if(/количество полученных фрагментов/.test(t)){
      const size=t.match(/информационный объ[её]м (\d+) ([КМГ]?байт[а-я]*)/i),reading=t.match(/прочитать (\d+) ([КМГ]?байт[а-я]*) текста/i),compression=t.match(/сократился на (\d+)\s*%/i),fragment=t.match(/фрагменты размером (\d+) ([КМГ]?байт[а-я]*)/i);
      if(!size||!reading||!compression||!fragment)return null;
      return String(ceil(BigInt(size[1])*bytes(size[2])*60n*rate*(100n-BigInt(compression[1])),BigInt(reading[1])*bytes(reading[2])*8n*100n*BigInt(fragment[1])*bytes(fragment[2])));
    }
    if(/продолжительность голосового сообщения в секундах|длительность звукозаписи \(в (секундах|минутах)\)/i.test(t)){
      const size=t.match(/(?:выделено|занимает) (\d+) ([КМГ]?байт[а-я]*)/i);if(!size)return null;return String(BigInt(size[1])*bytes(size[2])*8n/rate/(/в минутах/.test(t)?60n:1n));
    }
    if(/минимальное целое количество [КМГ]?байт памяти необходимо зарезервировать/.test(t)){
      const time=duration(t),u=t.match(/минимальное целое количество ([КМГ]?байт)/);if(time===null||!u)return null;return String(ceil(rate*time,8n*bytes(u[1])));
    }return null;
  }
  function serial(task){
    const t=task.text;if(!/(?:минимально|максимально) возможную длину серийного номера/i.test(t))return null;
    const special=t.match(/из (\d+)-символьного специального алфавита/i),total=t.match(/(\d+) серийных номеров занимают (не более|не менее|более|менее) (\d+) ([КМГ]?байт[а-я]*)/i);
    if(!special||!total||!/десятичные цифры/.test(t)||!/латинские буквы/.test(t))return null;
    const alphabet=BigInt(special[1])+10n+(/строчные/.test(t)&&/заглавные/.test(t)?52n:26n),b=bits(alphabet),storage=BigInt(total[3])*bytes(total[4]);
    if(/максимально/.test(t))return String(((storage-(total[2]==='менее'?1n:0n))/BigInt(total[1]))*8n/b);
    const per=total[2]==='более'?storage/BigInt(total[1])+1n:ceil(storage,BigInt(total[1]));
    return String((per-1n)*8n/b+1n);
  }
  function records(task){
    const t=task.text;if(!/посимвольное кодирование/.test(t))return null;
    const length=t.match(/(?:пароль|серийный номер), состоящий из (\d+) символ/),special=t.match(/из (\d+)-символьного специального алфавита/);if(!length||!special||!/десятичные цифры/.test(t)||!/латинск/.test(t))return null;
    const alphabet=10n+BigInt(special[1])+(/строчные/.test(t)&&/прописные|заглавные/.test(t)?52n:26n),password=ceil(BigInt(length[1])*bits(alphabet),8n);
    if(/количество байт для дополнительных сведений/.test(t)){
      const known=t.match(/данные о (\d+) пользователях занимают (?:(не менее|не более|более|менее) )?(\d+) ([КМГ]?байт[а-я]*)/i);if(!known)return null;
      const capacity=BigInt(known[3])*bytes(known[4])+(known[2]==='более'?1n:known[2]==='менее'?-1n:0n),count=BigInt(known[1]);
      const minimum=/наименьшее количество байт/.test(t),result=(minimum?ceil(capacity,count):capacity/count)-password;
      return result>=0n?String(result):null;
    }
    const storage=t.match(/выделено (не более|не менее|более|менее) (\d+) ([КМГ]?байт[а-я]*)/i);if(!storage)return null;
    const extra=t.match(/выделено (\d+) байт на одного пользователя/i),per=password+BigInt(extra?.[1] || 0),capacity=BigInt(storage[2])*bytes(storage[3])+(storage[1]==='более'?1n:storage[1]==='менее'?-1n:0n);
    return /наибольшем количестве/.test(t)?String(capacity/per):/наименьшем количестве/.test(t)?String(ceil(capacity,per)):null;
  }
  const ipv4=s=>{const a=s.split('.').map(Number);if(a.length!==4||a.some(n=>n<0||n>255))throw Error('ip');return a.reduce((v,n)=>(v<<8n)+BigInt(n),0n);};
  const octets=n=>[24n,16n,8n,0n].map(shift=>Number(n>>shift&255n));
  const mask=p=>p===0?0n:((1n<<BigInt(p))-1n)<<BigInt(32-p);
  function compare(a,b,op){return op==='больше'?a>b:op==='меньше'?a<b:op==='не больше'||op==='не более'?a<=b:op==='не меньше'||op==='не менее'?a>=b:op==='не равно'?a!==b:a===b;}
  function network(task){
    const t=task.text;if(!/TCP\/IP/.test(t))return null;
    const ips=t.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g);if(!ips||ips.length<2)return null;
    if(/находятся в (одной|разных) сет/.test(t)){
      const a=ipv4(ips[0]),b=ipv4(ips[1]),same=/находятся в одной сети/.test(t),index=/третьего/.test(t)?2:/второго/.test(t)?1:/четв[её]ртого/.test(t)?3:null;
      if(index===null)return null;const candidates=[];for(let p=0;p<=32;p++){const m=mask(p);if(((a&m)===(b&m))===same)candidates.push(octets(m)[index]);}
      return candidates.length?String(/наибольш/.test(t)?Math.max(...candidates):Math.min(...candidates)):null;
    }
    const a=ipv4(ips[0]),m=ipv4(ips[1]);let prefix=-1;for(let p=0;p<=32;p++)if(mask(p)===m)prefix=p;if(prefix<0)return null;
    const net=a&m,broadcast=net|((1n<<32n)-1n)^m;
    if(/Определите номер узла/.test(t))return String(a&(((1n<<32n)-1n)^m));
    if(/Найдите (наименьший|наибольший) IP-адрес/.test(t)){
      const host=/может быть назначен компьютеру/.test(t),result=/Найдите наименьший/.test(t)?net+(host?1n:0n):broadcast-(host?1n:0n),o=octets(result);
      return /сумму числовых значений октетов/.test(t)?String(o.reduce((a,b)=>a+b,0)):o.join('');
    }
    if(!/Сколько в этой сети IP-адресов/.test(t))return null;
    const pop=n=>n.toString(2).replace(/0/g,'').length;
    let predicate;
    const halves=t.match(/количество (нулей|единиц) в левых двух байтах (не больше|не меньше|больше|меньше|равно|не равно) суммарного количества (нулей|единиц) в правых двух байтах/);
    const mod=t.match(/количество (нулей|единиц) в двоичной записи IP-адреса (не кратно|кратно) (\d+)/);
    if(halves)predicate=(l,r)=>compare(halves[1]==='нулей'?16-l:l,halves[3]==='нулей'?16-r:r,halves[2]);
    else if(mod)predicate=(l,r)=>((mod[1]==='нулей'?32-l-r:l+r)%Number(mod[3])===0)===(mod[2]==='кратно');
    else return null;
    function histogram(fixed,free){let combinations=[1];for(let i=1;i<=free;i++)combinations[i]=combinations[i-1]*(free-i+1)/i;return combinations.map((count,extra)=>[fixed+extra,count]);}
    const highFree=Math.max(0,16-prefix),lowFree=Math.min(16,32-prefix),highFixed=pop(net>>16n),lowFixed=pop(net&65535n);
    let count=0;for(const [l,lc] of histogram(highFixed,highFree))for(const [r,rc] of histogram(lowFixed,lowFree))if(predicate(l,r))count+=lc*rc;
    if(/IP-адресов узлов/.test(t)){for(const ip of [net,broadcast])if(predicate(pop(ip>>16n),pop(ip&65535n)))count--;}
    return String(Math.round(count));
  }
  function arithmetic(source,x=0n){
    const normal=source.replace(/\s/g,'').replace(/\*\*/g,'^'),tokens=normal.match(/\d+|X|[()+\-*/^]/g) || [];if(tokens.join('')!==normal)throw Error('expression');let p=0;
    function atom(){const token=tokens[p++];if(token==='X')return x;if(token==='('){const v=add();if(tokens[p++]!==')')throw Error('bracket');return v;}if(token==='-')return -atom();if(!/^\d+$/.test(token || ''))throw Error('number');return BigInt(token);}
    function power(){let v=atom();if(tokens[p]==='^'){p++;const exponent=power();if(exponent<0n||exponent>100000n||v>100000n)throw Error('power');v**=exponent;}return v;}
    function multiply(){let v=power();while(['*','/'].includes(tokens[p])){const op=tokens[p++],b=power();v=op==='*'?v*b:v/b;}return v;}
    function add(){let v=multiply();while(['+','-'].includes(tokens[p])){const op=tokens[p++],b=multiply();v=op==='+'?v+b:v-b;}return v;}
    const value=add();if(p!==tokens.length)throw Error('trailing');return value;
  }
  function baseExpression(task){
    const t=task.text,expression=t.match(/Значение выражения ([\s\S]+?) записали в системе счисления с основанием (\d+)/);if(!expression)return null;
    const base=Number(expression[2]);if(base<2||base>36)return null;
    const stats=x=>{const value=arithmetic(expression[1],BigInt(x));if(value<0n)return null;const s=value.toString(base),counts=Array(base).fill(0);for(const c of s)counts[parseInt(c,36)]++;return {s,counts,sum:counts.reduce((a,n,i)=>a+n*i,0)};};
    if(expression[1].includes('X')){
      const sum=t.match(/сумма цифр в такой записи равн[ао] (\d+)/),diff=t.match(/цифр «([0-9A-Z])» в такой записи на (\d+) больше, чем цифр «([0-9A-Z])»/i);
      if(!/минимальное натуральное значение X/.test(t)||(!sum&&!diff))return null;
      for(let x=1;x<=5000;x++){const st=stats(x);if(!st)continue;if(sum&&st.sum===Number(sum[1]))return String(x);if(diff){const a=st.counts[parseInt(diff[1],36)],b=st.counts[parseInt(diff[3],36)];if(a>0&&b>0&&a-b===Number(diff[2]))return String(x);}}return null;
    }
    const st=stats(0);if(!st)return null;
    if(/Какая из цифр чаще всего/.test(t))return st.counts.indexOf(Math.max(...st.counts)).toString(36).toUpperCase();
    if(/Сколько различных цифр/.test(t))return String(st.counts.filter(Boolean).length);
    if(/сумм[ау] цифр/.test(t))return String(st.sum);
    const digit=t.match(/(?:сколько|количество)\s+цифр\s*[«"']?([0-9A-Z])[»"']?/i);if(digit)return String(st.counts[parseInt(digit[1],36)]);
    return null;
  }
  function numeral(word,base,x,y){let n=0n;for(const c of word){const d=c==='x'?x:c==='y'?y:parseInt(c,36);if(!Number.isInteger(d)||d<0||d>=base)throw Error('digit');n=n*BigInt(base)+BigInt(d);}return n;}
  function unknownDigits(task){
    const t=task.text;if(!/символы x и y|переменными x и y/.test(t))return null;
    const ms=t.match(/M\s*=\s*([0-9A-Za-z]+)_\((\d+)\)/),ns=t.match(/N\s*=\s*([0-9A-Za-z]+)_\((\d+)\)/);
    if(ms&&ns&&/наименьшее значение натурального числа A/.test(t)){
      const b1=Number(ms[2]),b2=Number(ns[2]);if(Math.max(b1,b2)>100)return null;let best=null;
      for(let x=0;x<Math.min(b1,b2);x++)for(let y=0;y<Math.min(b1,b2);y++){const m=numeral(ms[1],b1,x,y),n=numeral(ns[1],b2,x,y);if(!n)continue;const a=(n-m%n)%n || n;if(best===null||a<best)best=a;}
      return best===null?null:String(best);
    }
    const input=t.match(/В записи числа ([0-9A-Za-z]+)_\((\d+)\)/),divisor=t.match(/число кратно (\d+)/),objective=t.match(/число ([xy]{2})_\(\d+\) (?:имеет|является)/),out=t.match(/значение числа ([xy]{2})_\(\d+\) в десятичной/);
    if(!input||!divisor||!objective||!out)return null;const base=Number(input[2]);if(base>100)return null;let best=null,result=null;
    for(let x=1;x<base;x++)for(let y=1;y<base;y++){
      const value=numeral(input[1],base,x,y);if(value%BigInt(divisor[1]))continue;
      const objectiveValue=numeral(objective[1],base,x,y);if(/полным квадратом/.test(t)&&BigInt(Math.floor(Math.sqrt(Number(objectiveValue))))**2n!==objectiveValue)continue;
      if(best===null||objectiveValue<best){best=objectiveValue;result=numeral(out[1],base,x,y);}
    }return result===null?null:String(result);
  }
  function words(task){
    const t=task.text,letters=t.match(/могут быть только буквы ([А-ЯЁA-Z](?:,\s*[А-ЯЁA-Z])*)/),first=t.match(/1\.\s*([А-ЯЁA-Z]{2,10})/),rule=t.match(/(не )?содержит букв ([А-ЯЁA-Z]), стоящих рядом с буквой ([А-ЯЁA-Z]) и (не )?содержит букв ([А-ЯЁA-Z]), стоящих рядом/);
    if(!letters||!first||!rule||!/последнее слово|первое слово/.test(t))return null;
    const alphabet=letters[1].split(/,\s*/),russian='АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ';alphabet.sort((a,b)=>russian.indexOf(a)-russian.indexOf(b));if(/обратном алфавитном/.test(t))alphabet.reverse();
    const length=first[1].length,total=alphabet.length**length;if(total>10000000)return null;
    const last=/последнее слово/.test(t),start=last?total-1:0,delta=last?-1:1;
    for(let index=start;index>=0&&index<total;index+=delta){let n=index,word='';for(let j=0;j<length;j++){word=alphabet[n%alphabet.length]+word;n=Math.floor(n/alphabet.length);}
      const pair=word.includes(rule[2]+rule[3])||word.includes(rule[3]+rule[2]),same=word.includes(rule[5]+rule[5]);if(pair===!rule[1]&&same===!rule[4])return String(index+1);
    }return null;
  }
  function solve(task){if(!task?.text)return null;task={...task,text:task.text.replace(/\s+/g,' ').trim()};for(const fn of [fano,binaryMachine,image,sound,serial,records,network,baseExpression,unknownDigits,words]){try{const answer=fn(task);if(answer!==null)return answer;}catch{}}return null;}
  globalThis.GrGia11=Object.freeze({solve,arithmetic});
})();
