(function () {
  'use strict';

  // PWA
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }

  // Авто-проверка версии (как в LEBON)
  const VERSION_KEY = 'ts_version';
  async function checkVersion() {
    try {
      const r = await fetch('/api/version.php', { cache: 'no-store' });
      const d = await r.json();
      if (!d.version) return;
      const saved = localStorage.getItem(VERSION_KEY);
      if (saved && saved !== d.version) {
        localStorage.setItem(VERSION_KEY, d.version);
        location.reload();
      } else {
        localStorage.setItem(VERSION_KEY, d.version);
      }
    } catch (e) {}
  }
  window.addEventListener('load', checkVersion);
  setInterval(checkVersion, 60000);
})();