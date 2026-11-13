/* Shared browser/Node Web Crypto implementation. No password or key in source. */
(() => {
  const encoder = new TextEncoder();
  const header = encoder.encode('GR-vasya/v1/PBKDF2-SHA256/AES-256-GCM');
  const iterations = 1200000;
  const encode = bytes => btoa(String.fromCharCode(...bytes));
  const decode = value => {
    if (typeof value !== 'string' || value.length > 16000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) throw new Error('Повреждён зашифрованный ключ');
    return Uint8Array.from(atob(value), c => c.charCodeAt(0));
  };
  async function derive(password, salt, count) {
    const bytes = encoder.encode(password);
    try {
      const material = await crypto.subtle.importKey('raw',bytes,'PBKDF2',false,['deriveKey']);
      return await crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt,iterations:count},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
    } finally {bytes.fill(0);}
  }
  function validate(vault) {
    if (vault?.version !== 1 || vault.kdf !== 'PBKDF2-SHA256' || vault.cipher !== 'AES-256-GCM' || !Number.isInteger(vault.iterations) || vault.iterations < 600000 || vault.iterations > 3000000) throw new Error('Неподдерживаемый формат зашифрованного ключа');
    const salt=decode(vault.salt),iv=decode(vault.iv),ciphertext=decode(vault.ciphertext);
    if(salt.length!==32 || iv.length!==12 || ciphertext.length<17)throw new Error('Повреждён зашифрованный ключ');
    return {salt,iv,ciphertext};
  }
  async function seal(authKey,password) {
    if(typeof password!=='string' || password.length<4)throw new Error('Введите пароль из 4 или более символов');
    if(typeof authKey!=='string' || authKey.length<8 || authKey.length>4096 || !/^[A-Za-z0-9+/=_-]+$/.test(authKey))throw new Error('Нужен ключ авторизации GigaChat без префикса Basic');
    const salt=crypto.getRandomValues(new Uint8Array(32)),iv=crypto.getRandomValues(new Uint8Array(12));
    const key=await derive(password,salt,iterations),plain=encoder.encode(authKey);
    try {
      const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:header,tagLength:128},key,plain);
      return {version:1,kdf:'PBKDF2-SHA256',iterations,cipher:'AES-256-GCM',salt:encode(salt),iv:encode(iv),ciphertext:encode(new Uint8Array(encrypted))};
    } finally {plain.fill(0);}
  }
  async function open(vault,password) {
    const {salt,iv,ciphertext}=validate(vault);
    const key=await derive(password,salt,vault.iterations);
    let plain;
    try {
      plain=new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:header,tagLength:128},key,ciphertext));
      return new TextDecoder().decode(plain);
    } catch {throw new Error('Неверный пароль или повреждён ключ');}
    finally {plain?.fill(0);}
  }
  globalThis.GrVault = Object.freeze({seal,open,validate});
})();
