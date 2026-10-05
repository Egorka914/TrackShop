'use strict';

const TS = {
  csrf: '',
  user: null,

  async api(url, opts = {}) {
    const method = opts.method || 'GET';
    const headers = { 'Content-Type': 'application/json' };
    if (this.csrf && method !== 'GET') headers['X-CSRF-Token'] = this.csrf;

    const res = await fetch(`/api/${url}`, {
      credentials: 'include',
      method, headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    let data;
    try { data = await res.json(); } catch { data = { error: 'Server error' }; }
    return data;
  },

  el(sel, ctx = document) { return ctx.querySelector(sel); },
  els(sel, ctx = document) { return [...ctx.querySelectorAll(sel)]; },
  fmt(v) { return Number(v).toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 }); },
  esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },

  toast(msg, type = '') {
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 4000);
  },

  openModal(id) { TS.el('#' + id)?.classList.add('open'); document.body.style.overflow = 'hidden'; },
  closeModal(id) { TS.el('#' + id)?.classList.remove('open'); document.body.style.overflow = ''; },

  bindPasswordToggles() {
    TS.els('.pwd-toggle').forEach(btn => btn.addEventListener('click', () => {
      const inp = btn.previousElementSibling;
      if (inp.type === 'password') { inp.type = 'text'; btn.textContent = '🙈'; }
      else { inp.type = 'password'; btn.textContent = '👁'; }
    }));
  },

  async loadUser() {
    const r = await TS.api('auth.php?action=me');
    TS.user = r.user;
    TS.csrf = r.csrf || '';
    return TS.user;
  },
};

window.TS = TS;