importScripts('config.js','vault.js','logic.js','calculations.js','gia11.js','task-files.js','graph.js','gigachat-direct.js');
const pending=new Set();
async function session() {
  if(!chrome.storage.session)throw new Error('Обновите Яндекс Браузер: требуется storage.session');
  await chrome.storage.session.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});
  return chrome.storage.session;
}
async function toggle(tab) {
  if(!tab?.id || !/^https?:/.test(tab.url || ''))return;
  await chrome.scripting.executeScript({target:{tabId:tab.id},files:['task-context.js','panel.js']});
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
  if(!['GR_STATUS','GR_LOGIN','GR_SOLVE','GR_SOLVE_AI'].includes(message.type))return;
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
      let taskContext=null;
      if(/^https?:\/\/(?:www\.)?vgaranov\.ru(?:\/|$)/i.test(tab.url || '') && typeof message.taskContext?.text==='string' && message.taskContext.text.length<=24000){
        taskContext=message.taskContext;
      }
      const exact=taskContext ? (GrLogic.solve(taskContext) ?? GrCalculations.solve(taskContext) ?? GrGia11.solve(taskContext) ?? await GrTaskFiles.solve(taskContext,fetch,{throwOnError:true})) : null;
      if(typeof exact==='string')return {answer:exact};
      // The local attempt never captures or transmits an unsupported question.
      if(message.type==='GR_SOLVE')return {needsAi:true};
      let screenshot=await chrome.tabs.captureVisibleTab(tab.windowId,{format:'png'});
      await chrome.tabs.sendMessage(tab.id,{type:'GR_CAPTURED'}).catch(()=>{});
      const [after]=await chrome.tabs.query({active:true,windowId:tab.windowId});
      if(after?.id!==tab.id)throw new Error('Вкладка изменилась. Повторите запрос');
      if(taskContext?.rect && typeof OffscreenCanvas!=='undefined'){
        try{
          const bitmap=await createImageBitmap(await (await fetch(screenshot)).blob());
          const {rect,viewport}=taskContext;
          const sx=bitmap.width/viewport.width,sy=bitmap.height/viewport.height;
          const x=Math.max(0,Math.floor((rect.x-8)*sx)),y=Math.max(0,Math.floor((rect.y-8)*sy));
          const width=Math.min(bitmap.width-x,Math.ceil((rect.width+16)*sx)),height=Math.min(bitmap.height-y,Math.ceil((rect.height+16)*sy));
          if(width>0 && height>0){
            const canvas=new OffscreenCanvas(width,height);canvas.getContext('2d').drawImage(bitmap,x,y,width,height,0,0,width,height);
            const bytes=new Uint8Array(await (await canvas.convertToBlob({type:'image/png'})).arrayBuffer());
            let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));
            screenshot='data:image/png;base64,'+btoa(binary);
          }
          bitmap.close();
        }catch{/* Full lossless viewport remains available if cropping is unsupported. */}
      }
      try{
        const answer=await GrGiga.solve(taskContext?.diagram || screenshot,grAuthKey,text=>{
          chrome.tabs.sendMessage(tab.id,{type:'GR_PROGRESS',text}).catch(()=>{});
        },fetch,taskContext);
        return {answer};
      }finally{grAuthKey=null;}
    }finally{pending.delete(tab.id);}
  })().then(reply,error=>reply({error:error.message}));
  return true;
});
