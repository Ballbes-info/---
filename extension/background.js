const pending = new Set();
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
  if (message.type !== 'GR_SOLVE' || !sender.tab) return;
  const tab = sender.tab;
  (async () => {
    if (pending.has(tab.id)) throw new Error('Запрос уже выполняется');
    pending.add(tab.id);
    try {
      const {serverUrl, token} = await chrome.storage.local.get(['serverUrl', 'token']);
      if (!serverUrl || !token) {
        await chrome.runtime.openOptionsPage();
        throw new Error('Войдите в настройках расширения');
      }
      const [active] = await chrome.tabs.query({active: true, windowId: tab.windowId});
      if (active?.id !== tab.id) throw new Error('Вернитесь на вкладку с заданием');
      const screenshot = await chrome.tabs.captureVisibleTab(tab.windowId, {format: 'jpeg', quality: 90});
      await chrome.tabs.sendMessage(tab.id, {type:'GR_CAPTURED'}).catch(() => {});
      const [after] = await chrome.tabs.query({active: true, windowId: tab.windowId});
      if (after?.id !== tab.id) throw new Error('Вкладка изменилась. Повторите запрос');
      const response = await fetch(serverUrl + '/solve', {
        method: 'POST', headers: {'Content-Type': 'application/json', Authorization: 'Bearer ' + token},
        body: JSON.stringify({screenshot}), signal: AbortSignal.timeout(110000)
      });
      if (response.status === 401) await chrome.storage.local.remove('token');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Ошибка сервера');
      return {answer: data.answer};
    } finally { pending.delete(tab.id); }
  })().then(reply, error => reply({error: error.message}));
  return true;
});
