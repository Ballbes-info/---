const form = document.querySelector('form'), status = document.querySelector('#status');
const server = document.querySelector('#server'), password = document.querySelector('#password');
chrome.storage.local.get(['serverUrl', 'token']).then(data => {
  server.value = data.serverUrl || globalThis.GR_DEFAULT_SERVER;
  status.textContent = data.token ? 'Вход сохранён' : '';
  if (globalThis.GR_DEFAULT_SERVER) server.closest('label').hidden = true;
});
form.onsubmit = async event => {
  event.preventDefault(); status.textContent = '';
  try {
    const url = new URL(server.value);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('Нужен HTTPS-адрес сервера без пути');
    const origin = url.origin;
    const granted = await chrome.permissions.request({origins: [origin + '/*']});
    if (!granted) throw new Error('Доступ к серверу не разрешён');
    const response = await fetch(origin + '/login', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password: password.value}),signal:AbortSignal.timeout(20000)});
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Ошибка входа');
    await chrome.storage.local.set({serverUrl: origin, token: data.token});
    password.value = ''; status.textContent = 'Готово. Откройте задание и нажмите Alt + Shift + E.';
  } catch (error) {status.textContent = error.message;}
};
document.querySelector('#logout').onclick = async () => {await chrome.storage.local.remove('token');password.value='';status.textContent='Вход удалён на этом компьютере';};
