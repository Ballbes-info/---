(() => {
  if (globalThis.__grVasyaLoaded) return;
  globalThis.__grVasyaLoaded = true;
  let host, button, output, visible = false, busy = false, epoch = 0;
  function create() {
    host = document.createElement('div');
    host.style.cssText = 'position:fixed;right:16px;top:16px;z-index:2147483647;display:none';
    const root = host.attachShadow({mode: 'closed'});
    root.innerHTML = `<style>
      :host{all:initial} section{box-sizing:border-box;width:180px;max-width:calc(100vw - 16px);background:#fff;color:#18202b;border:1px solid #d8dce3;border-radius:10px;box-shadow:0 4px 20px #0003;font:14px system-ui;padding:8px}
      header{height:12px;cursor:move;touch-action:none;background:repeating-linear-gradient(90deg,#c6cbd3 0 3px,transparent 3px 6px);width:30px;margin:0 auto 8px;border-radius:5px}
      button{width:100%;padding:9px;border:0;border-radius:6px;background:#3367d6;color:white;cursor:pointer;font:inherit}button:disabled{opacity:.6}
      output{display:block;white-space:pre-wrap;overflow-wrap:anywhere;max-height:240px;overflow:auto;margin-top:6px}output:empty{display:none}
    </style><section><header title="Перетащить окно" aria-label="Перетащить окно"></header><button>Решить</button><output aria-live="polite"></output></section>`;
    button = root.querySelector('button'); output = root.querySelector('output');
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
      busy = true; button.disabled = true; button.textContent = 'Решаю…'; output.textContent = '';
      const requestEpoch = epoch;
      const keepAlive = setInterval(() => chrome.runtime.sendMessage({type:'GR_PING'}).catch(() => {}), 20000);
      host.style.visibility = 'hidden';
      try {
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const result = await chrome.runtime.sendMessage({type:'GR_SOLVE'});
        if (visible && requestEpoch === epoch) output.textContent = result?.error || result?.answer || 'Пустой ответ';
      } catch (error) {
        if (visible && requestEpoch === epoch) output.textContent = error.message;
      } finally {
        clearInterval(keepAlive);
        busy = false; button.disabled = false; button.textContent = 'Решить'; host.style.visibility = '';
      }
    };
    document.documentElement.append(host);
  }
  chrome.runtime.onMessage.addListener(message => {
    if (message.type === 'GR_CAPTURED') { if(host) host.style.visibility = ''; return; }
    if (message.type !== 'GR_TOGGLE') return;
    if (!host) create();
    visible = !visible; epoch++;
    output.textContent = '';
    host.style.display = visible ? 'block' : 'none';
  });
})();
