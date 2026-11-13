importScripts('config.js','vault.js','gigachat-direct.js');
const pending=new Set();
async function session() {
  if(!chrome.storage.session)throw new Error('Обновите Яндекс Браузер: требуется storage.session');
  await chrome.storage.session.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});
  return chrome.storage.session;
}
async function toggle(tab) {
  if(!tab?.id || !/^https?:/.test(tab.url || ''))return;
  await chrome.scripting.executeScript({target:{tabId:tab.id},files:['panel.js']});
  await chrome.tabs.sendMessage(tab.id,{type:'GR_TOGGLE'});
}
chrome.commands.onCommand.addListener(async command=>{
  if(command==='toggle'){
    const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
    toggle(tab).catch(console.error);
  }
});
chrome.action.onClicked.addListener(tab=>toggle(tab).catch(console.error));
chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  if(!sender.tab || (sender.frameId && sender.frameId!==0))return;
  if(message.type==='GR_PING'){reply({ok:true});return;}
  if(!['GR_STATUS','GR_LOGIN','GR_SOLVE'].includes(message.type))return;
  (async()=>{
    const memory=await session();
    if(message.type==='GR_STATUS')return {authenticated:!!(await memory.get('grAuthKey')).grAuthKey};
    if(message.type==='GR_LOGIN'){
      if(typeof message.password!=='string' || message.password.length>1024)throw new Error('Введите пароль');
      const response=await fetch(chrome.runtime.getURL('private-key.vault.json')).catch(()=>null);
      if(!response?.ok)throw new Error('API-ключ ещё не упакован. Запустите prepare-extension.ps1 на своём компьютере');
      let vault;try{vault=await response.json();}catch{throw new Error('Повреждён файл зашифрованного ключа');}
      let key=await GrVault.open(vault,message.password);
      await memory.set({grAuthKey:key});key=null;
      return {authenticated:true};
    }
    const tab=sender.tab;
    if(pending.has(tab.id))throw new Error('Запрос уже выполняется');
    pending.add(tab.id);
    try{
      let {grAuthKey}=await memory.get('grAuthKey');
      if(!grAuthKey)return {authRequired:true,error:'Введите пароль'};
      const [active]=await chrome.tabs.query({active:true,windowId:tab.windowId});
      if(active?.id!==tab.id)throw new Error('Вернитесь на вкладку с заданием');
      const screenshot=await chrome.tabs.captureVisibleTab(tab.windowId,{format:'jpeg',quality:90});
      await chrome.tabs.sendMessage(tab.id,{type:'GR_CAPTURED'}).catch(()=>{});
      const [after]=await chrome.tabs.query({active:true,windowId:tab.windowId});
      if(after?.id!==tab.id)throw new Error('Вкладка изменилась. Повторите запрос');
      try{
        const answer=await GrGiga.solve(screenshot,grAuthKey,text=>{
          chrome.tabs.sendMessage(tab.id,{type:'GR_PROGRESS',text}).catch(()=>{});
        });
        return {answer};
      }finally{grAuthKey=null;}
    }finally{pending.delete(tab.id);}
  })().then(reply,error=>reply({error:error.message}));
  return true;
});
