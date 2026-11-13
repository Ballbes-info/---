import http from 'node:http';
import {pathToFileURL} from 'node:url';
import {equal,issue,valid,decodeImage} from './security.js';
import {createSolver} from './gigachat.js';
export function createApp(env=process.env, solve=createSolver(env)) {
  if(!env.ACCESS_PASSWORD || env.ACCESS_PASSWORD.length<4 || !env.SESSION_SECRET || env.SESSION_SECRET.length<32) throw new Error('Задайте ACCESS_PASSWORD (4+ символа) и SESSION_SECRET (32+ символов)');
  const allowed=new Set((env.ALLOWED_EXTENSION_IDS || '').split(',').filter(Boolean));
  const attempts=new Map();let day='',total=0,inFlight=false;
  function limited(ip) {
    const now=Date.now();
    for(const [key,value] of attempts) if(value.until<now)attempts.delete(key);
    const bucket=attempts.get(ip) || {count:0,until:now+600000};
    attempts.set(ip,bucket);return ++bucket.count>10;
  }
  return http.createServer(async(req,res)=>{
    const origin=req.headers.origin || '';
    const match=origin.match(/^chrome-extension:\/\/([a-p]{32})$/);
    const originAllowed=!!match && (!allowed.size || allowed.has(match[1]));
    const send=(code,data)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
    if(req.url==='/health' && req.method==='GET')return send(200,{ok:true});
    if(!originAllowed)return send(403,{error:'Источник не разрешён'});
    res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');
    if(req.method==='OPTIONS'){res.setHeader('Access-Control-Allow-Methods','POST');res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');res.writeHead(204);return res.end();}
    if(req.method!=='POST' || !['/login','/solve'].includes(req.url))return send(404,{error:'Не найдено'});
    const ip=env.TRUST_PROXY==='true' ? String(req.headers['x-forwarded-for'] || req.socket.remoteAddress).split(',').at(-1).trim() : req.socket.remoteAddress;
    if(req.url==='/login' && limited(ip))return send(429,{error:'Слишком много попыток. Повторите через 10 минут'});
    if(req.url==='/solve' && !valid(req.headers.authorization?.replace(/^Bearer /,''),env.SESSION_SECRET))return send(401,{error:'Войдите заново в настройках'});
    if(!String(req.headers['content-type']).startsWith('application/json'))return send(415,{error:'Требуется JSON'});
    try {
      let length=0;const parts=[];const max=req.url==='/login'?4096:12*1024*1024;
      for await(const part of req){length+=part.length;if(length>max)return send(413,{error:'Слишком большой запрос'});parts.push(part);}
      let body;try {body=JSON.parse(Buffer.concat(parts));}catch{return send(400,{error:'Неверный JSON'});}
      if(req.url==='/login') {
        if(typeof body?.password!=='string' || !equal(body.password,env.ACCESS_PASSWORD))return send(401,{error:'Неверный пароль'});
        return send(200,{token:issue(env.SESSION_SECRET)});
      }
      let bytes;try {bytes=decodeImage(body?.screenshot);}catch(error){return send(400,{error:error.message});}
      const today=new Date().toISOString().slice(0,10);if(day!==today){day=today;total=0;}
      if(inFlight || total>=Number(env.DAILY_LIMIT || 100))return send(429,{error:'Сервер занят или достигнут дневной лимит'});
      total++;inFlight=true;
      try {return send(200,{answer:await solve(bytes)});}finally{inFlight=false;}
    } catch {return send(502,{error:'Не удалось получить ответ ИИ. Проверьте настройки и лимит GigaChat'});}
  });
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  if(!process.env.GIGACHAT_AUTH_KEY) throw new Error('Не задан GIGACHAT_AUTH_KEY');
  const server=createApp();server.requestTimeout=30000;
  server.listen(Number(process.env.PORT || 3000),'0.0.0.0',()=>console.log('GR-vasya server listening'));
}
