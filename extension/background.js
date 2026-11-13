importScripts('config.js');
const pending = new Set();
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function wakeServer(server, tabId) {
  const deadline = Date.now() + 120000;
  await chrome.tabs.sendMessage(tabId,{type:'GR_PROGRESS',text:'Подключаюсь к серверу…'}).catch(()=>{});
  while (Date.now() < deadline) {
    try {
      const response = await fetch(server+'/health',{signal:AbortSignal.timeout(8000),cache:'no-store'});
      if(response.ok && (await response.json()).ok) return;
    } catch {}
    await chrome.tabs.sendMessage(tabId,{type:'GR_PROGRESS',text:'Сервер просыпается. Это может занять около минуты…'}).catch(()=>{});
    await delay(2000);
  }
  throw new Error('Сервер не отвечает. Попробуйте позже');
}
async function toggle(tab) {
  if (!tab?.id || !/^https?:/.test(tab.url || '')) return;
  await chrome.scripting.executeScript({target: {tabId: tab.id}, files: ['panel.js']});
  await chrome.tabs.sendMessage(tab.id, {type: 'GR_TOGGLE'});
}
chrome.commands.onCommand.addListener(async command => {
  if (command === 'toggle') {
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    toggle(tab).catch(console.error);
  }
});
chrome.action.onClicked.addListener(tab => toggle(tab).catch(console.error));
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (['GR_STATUS','GR_LOGIN'].includes(message.type) && sender.tab) {
    (async () => {
      const settings = await chrome.storage.local.get(['serverUrl','token']);
      const server = settings.serverUrl || globalThis.GR_DEFAULT_SERVER;
      if (message.type === 'GR_STATUS') return {authenticated:!!settings.token};
      if (!server) throw new Error('Сервер пока не настроен');
      await wakeServer(server,sender.tab.id);
      const response = await fetch(server + '/login', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:message.password}),signal:AbortSignal.timeout(20000)});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Ошибка входа');
      if (typeof data.token !== 'string' || !data.token) throw new Error('Ошибка ответа сервера');
      await chrome.storage.local.set({serverUrl:server,token:data.token});
      return {authenticated:true};
    })().then(reply,error=>reply({error:error.message}));
    return true;
  }
  if (message.type === 'GR_PING' && sender.tab) { reply({ok:true}); return; }
  if (message.type !== 'GR_SOLVE' || !sender.tab) return;
  const tab = sender.tab;
  (async () => {
    if (pending.has(tab.id)) throw new Error('Запрос уже выполняется');
    pending.add(tab.id);
    try {
      const {serverUrl, token} = await chrome.storage.local.get(['serverUrl', 'token']);
      if (!serverUrl || !token) {
        return {authRequired:true,error:'Введите пароль'};
      }
      const [active] = await chrome.tabs.query({active: true, windowId: tab.windowId});
      if (active?.id !== tab.id) throw new Error('Вернитесь на вкладку с заданием');
      const screenshot = await chrome.tabs.captureVisibleTab(tab.windowId, {format: 'jpeg', quality: 90});
      await chrome.tabs.sendMessage(tab.id, {type:'GR_CAPTURED'}).catch(() => {});
      const [after] = await chrome.tabs.query({active: true, windowId: tab.windowId});
      if (after?.id !== tab.id) throw new Error('Вкладка изменилась. Повторите запрос');
      await wakeServer(serverUrl,tab.id);
      await chrome.tabs.sendMessage(tab.id,{type:'GR_PROGRESS',text:'Решаю…'}).catch(()=>{});
      const response = await fetch(serverUrl + '/solve', {
        method: 'POST', headers: {'Content-Type': 'application/json', Authorization: 'Bearer ' + token,Prefer:'respond-async'},
        body: JSON.stringify({screenshot}), signal: AbortSignal.timeout(20000)
      });
      if (response.status === 401) {await chrome.storage.local.remove('token');return {authRequired:true,error:'Введите пароль заново'};}
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Ошибка сервера');
      if (response.status===202 && data.jobId) {
        const deadline=Date.now()+110000;
        while(Date.now()<deadline) {
          await delay(1500);
          const poll=await fetch(serverUrl+'/jobs/'+encodeURIComponent(data.jobId),{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(15000),cache:'no-store'});
          if(poll.status===401){await chrome.storage.local.remove('token');return {authRequired:true,error:'Введите пароль заново'};}
          const result=await poll.json();
          if(!poll.ok || result.error)throw new Error(result.error || 'Ошибка получения ответа');
          if(poll.status!==202)return {answer:result.answer};
        }
        throw new Error('ИИ не успел ответить. Повторите запрос');
      }
      return {answer: data.answer};
    } finally { pending.delete(tab.id); }
  })().then(reply, error => reply({error: error.message}));
  return true;
});
