'use strict';
// Deliberately limited to trusted, same-origin BASIC Lab player frames.
(() => {
  const channel = 'retrorealm-basic-lab:layout';
  for (const frame of document.querySelectorAll('iframe[data-basic-lab-player]')) {
    const url = new URL(frame.src, location.href);
    if (!/^https?:$/.test(url.protocol) || url.origin !== location.origin) continue;
    const token = Array.from(crypto.getRandomValues(new Uint32Array(4)), n => n.toString(16).padStart(8, '0')).join('');
    const observe = () => frame.contentWindow?.postMessage({ channel, version: 1, type: 'observe', token }, url.origin);
    let pending = false, height = 0;
    window.addEventListener('message', event => {
      const data = event.data;
      if (event.source !== frame.contentWindow || event.origin !== url.origin || !data || typeof data !== 'object' || Array.isArray(data)) return;
      if (data.channel !== channel || data.version !== 1) return;
      const keys = Object.keys(data).sort().join(',');
      if (data.type === 'ready' && keys === 'channel,type,version') { observe(); return; }
      if (data.type !== 'height' || keys !== 'channel,height,token,type,version' || data.token !== token || !Number.isSafeInteger(data.height) || data.height < 100 || data.height > 1000000) return;
      height = data.height;
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        if (frame.height !== String(height)) frame.height = String(height);
        frame.dataset.resized = 'true';
      });
    });
    frame.addEventListener('load', observe);
    observe();
  }
})();
