import {createHmac, randomUUID, timingSafeEqual} from 'node:crypto';
export function equal(a,b) {const x=Buffer.from(a || ''),y=Buffer.from(b || '');return x.length===y.length && timingSafeEqual(x,y);}
export function issue(secret, now=Date.now()) {
  const body=Buffer.from(JSON.stringify({exp:now+30*86400000,id:randomUUID()})).toString('base64url');
  return body+'.'+createHmac('sha256',secret).update(body).digest('base64url');
}
export function valid(token,secret,now=Date.now()) {
  try {const [body,signature,...extra]=(token || '').split('.');return !extra.length && equal(signature,createHmac('sha256',secret).update(body).digest('base64url')) && JSON.parse(Buffer.from(body,'base64url')).exp>now;} catch {return false;}
}
export function decodeImage(value) {
  if (typeof value!=='string' || !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(value)) throw new Error('Неверный формат снимка');
  const bytes=Buffer.from(value.slice(value.indexOf(',')+1),'base64');
  if(bytes.length>8*1024*1024 || bytes.length<4 || bytes[0]!==255 || bytes[1]!==216) throw new Error('Неверный размер или формат снимка');
  return bytes;
}
