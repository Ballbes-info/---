(() => {
  if (globalThis.__grVasyaLoaded) return;
  globalThis.__grVasyaLoaded = true;
  let host, button, output, password, notice, authenticated = false, visible = false, busy = false, epoch = 0;
  function render() {
    password.hidden = authenticated;
    notice.hidden = authenticated;
    button.disabled = busy;
    button.textContent = busy ? (authenticated ? 'Решаю…' : 'Вхожу…') : (authenticated ? 'Решить' : 'Войти');
  }
  function create() {
    host = document.createElement('div');
    host.style.cssText = 'position:fixed;right:16px;top:16px;z-index:2147483647;display:none';
    const root = host.attachShadow({mode: 'closed'});
    root.innerHTML = `<style>
      :host{all:initial} section{box-sizing:border-box;width:180px;max-width:calc(100vw - 16px);background:#fff;color:#18202b;border:1px solid #d8dce3;border-radius:10px;box-shadow:0 4px 20px #0003;font:14px system-ui;padding:8px}
      header{height:12px;cursor:move;touch-action:none;background:repeating-linear-gradient(90deg,#c6cbd3 0 3px,transparent 3px 6px);width:30px;margin:0 auto 8px;border-radius:5px}
      button{width:100%;padding:9px;border:0;border-radius:6px;background:#3367d6;color:white;cursor:pointer;font:inherit}button:disabled{opacity:.6}
      output{display:block;white-space:pre-wrap;overflow-wrap:anywhere;max-height:240px;overflow:auto;margin-top:6px}output:empty{display:none}
      input{box-sizing:border-box;width:100%;padding:8px;margin-bottom:8px;border:1px solid #c6cbd3;border-radius:6px;font:inherit}small{display:block;font-size:11px;line-height:1.3;margin-bottom:8px}[hidden]{display:none}
    </style><section><header title="Перетащить окно" aria-label="Перетащить окно"></header><small>«Решить» отправляет снимок вкладки вашему серверу и в GigaChat.</small><input type="password" placeholder="Пароль" aria-label="Пароль доступа" autocomplete="off"><button>Войти</button><output aria-live="polite"></output></section>`;
    button = root.querySelector('button'); output = root.querySelector('output');
    password = root.querySelector('input'); notice = root.querySelector('small');
    password.onkeydown = event => {if(event.key === 'Enter') {event.preventDefault();button.click();}};
    const handle = root.querySelector('header');
    handle.addEventListener('pointerdown', event => {
      const box = host.getBoundingClientRect();
      const dx = event.clientX - box.left, dy = event.clientY - box.top;
      handle.setPointerCapture(event.pointerId);
      handle.onpointermove = e => {
        host.style.right = 'auto';
        host.style.left = Math.max(0, Math.min(innerWidth - host.offsetWidth, e.clientX - dx)) + 'px';
        host.style.top = Math.max(0, Math.min(innerHeight - host.offsetHeight, e.clientY - dy)) + 'px';
      };
      handle.onpointerup = handle.onpointercancel = () => { handle.onpointermove = null; };
    });
    button.onclick = async () => {
      if (busy) return;
      if (!authenticated && !password.value) {password.focus();return;}
      const login = !authenticated;
      busy = true; render(); output.textContent = '';
      const requestEpoch = epoch;
      const keepAlive = setInterval(() => chrome.runtime.sendMessage({type:'GR_PING'}).catch(() => {}), 20000);
      if (!login) host.style.visibility = 'hidden';
      try {
        let result;
        if (login) {
          const value = password.value; password.value = '';
          result = await chrome.runtime.sendMessage({type:'GR_LOGIN',password:value});
          if (result?.authenticated) authenticated = true;
        } else {
          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          result = await chrome.runtime.sendMessage({type:'GR_SOLVE'});
          if (result?.authRequired) authenticated = false;
        }
        if (visible && requestEpoch === epoch) output.textContent = result?.error || result?.answer || (login ? '' : 'Пустой ответ');
      } catch (error) {
        if (visible && requestEpoch === epoch) output.textContent = error.message;
      } finally {
        clearInterval(keepAlive);
        busy = false; render(); host.style.visibility = '';
      }
    };
    document.documentElement.append(host);
  }
  chrome.runtime.onMessage.addListener(message => {
    if(message.type==='GR_PROGRESS') {if(visible && busy)output.textContent=message.text;return;}
    if (message.type === 'GR_CAPTURED') { if(host) host.style.visibility = ''; return; }
    if (message.type !== 'GR_TOGGLE') return;
    if (!host) create();
    visible = !visible; epoch++;
    output.textContent = ''; password.value = '';
    host.style.display = visible ? 'block' : 'none';
    render();
    if (visible) {
      const current = epoch;
      chrome.runtime.sendMessage({type:'GR_STATUS'}).then(result => {
        if (visible && epoch === current && !busy) {authenticated = !!result?.authenticated;render();if(!authenticated)password.focus();}
      }).catch(() => {});
    }
  });
})();
