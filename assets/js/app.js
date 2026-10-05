'use strict';

const API = 'api';
let CSRF = '';
const state = { user: null, products: [], cart: [], categories: [] };

/* ================= API ================= */
async function api(url, opts = {}) {
  const method = opts.method || 'GET';
  const headers = { 'Content-Type': 'application/json' };
  if (CSRF && method !== 'GET') headers['X-CSRF-Token'] = CSRF;

  const res = await fetch(`${API}/${url}`, {
    credentials: 'include',
    method, headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  let data;
  try { data = await res.json(); } catch { data = { error: 'Server error' }; }
  if (!res.ok && !data.error) data.error = 'Request failed';
  return data;
}

/* ================= UI helpers ================= */
function $(sel, ctx = document) { return ctx.querySelector(sel); }
function $$(sel, ctx = document) { return [...ctx.querySelectorAll(sel)]; }
function toast(msg, type = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}
function fmt(v) { return Number(v).toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 }); }
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function openModal(id) { $('#' + id).classList.add('open'); document.body.style.overflow = 'hidden'; }
function closeModal(id) { $('#' + id).classList.remove('open'); document.body.style.overflow = ''; }

/* ================= AUTH ================= */
async function loadMe() {
  const r = await api('auth.php?action=me');
  state.user = r.user;
  CSRF = r.csrf || '';
  renderUser();
}
function renderUser() {
  const loginBtn = $('#loginBtn');
  const userBox = $('#userBox');
  if (state.user) {
    loginBtn.classList.add('hidden');
    userBox.classList.remove('hidden');
    $('#userName').textContent = state.user.company;
  } else {
    loginBtn.classList.remove('hidden');
    userBox.classList.add('hidden');
  }
}

function bindAuthForms() {
  $('#loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true;
    const f = Object.fromEntries(new FormData(e.target));
    const r = await api('auth.php?action=login', { method: 'POST', body: f });
    btn.disabled = false;
    const msg = $('#loginMsg');
    if (r.error) { msg.textContent = r.error; msg.className = 'msg err'; return; }
    state.user = r.user;
    CSRF = r.csrf;
    closeModal('authModal');
    renderUser();
    await loadProducts();
    await loadCart();
    toast('Добро пожаловать, ' + r.user.company, 'ok');
  });

  $('#registerForm').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true;
    const f = Object.fromEntries(new FormData(e.target));
    const r = await api('auth.php?action=register', { method: 'POST', body: f });
    btn.disabled = false;
    const msg = $('#regMsg');
    if (r.error) { msg.textContent = r.error; msg.className = 'msg err'; return; }
    msg.textContent = '✓ ' + r.message;
    msg.className = 'msg ok';
    e.target.reset();
  });

  $('#logoutBtn').addEventListener('click', async () => {
    await api('auth.php?action=logout');
    state.user = null; CSRF = '';
    renderUser();
    await loadProducts();
    state.cart = [];
    renderCartCount();
    toast('Вы вышли');
  });

  // show/hide password
  $$('.pwd-toggle').forEach(btn => btn.addEventListener('click', () => {
    const inp = btn.previousElementSibling;
    if (inp.type === 'password') { inp.type = 'text'; btn.textContent = '🙈'; }
    else { inp.type = 'password'; btn.textContent = '👁'; }
  }));
}

/* ================= PRODUCTS ================= */
async function loadProducts() {
  const r = await api('products.php?action=list');
  state.products = r.products || [];
  state.categories = r.categories || [];
  const sel = $('#categorySelect');
  if (sel) sel.innerHTML = '<option value="">Все категории</option>' +
    state.categories.map(c => `<option>${escapeHtml(c)}</option>`).join('');
  renderProducts();
}

function renderProducts() {
  const q = ($('#searchInput')?.value || '').toLowerCase();
  const cat = $('#categorySelect')?.value || '';
  const list = state.products.filter(p =>
    (!q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)) &&
    (!cat || p.category === cat)
  );
  const el = $('#products');
  if (!list.length) {
    el.innerHTML = `<p style="color:var(--muted);grid-column:1/-1;text-align:center;padding:40px">Ничего не найдено</p>`;
    return;
  }
  el.innerHTML = list.map(p => {
    const inStock = p.stock > 0;
    const priceHtml = p.price_hidden
      ? `<div class="price-hidden">🔒 Оптовая цена скрыта — войдите в аккаунт</div>`
      : `<div class="price">${fmt(p.price_wholesale)} ₽<small>/ ${escapeHtml(p.unit)}</small></div>`;
    const canBuy = !p.price_hidden && state.user && state.user.status === 'active' && inStock;
    return `
      <div class="product">
        <div class="product-img">${p.image_url ? `<img src="${escapeHtml(p.image_url)}" alt="" loading="lazy">` : '📦'}</div>
        <div class="sku">${escapeHtml(p.sku)}${p.brand ? ' · ' + escapeHtml(p.brand) : ''}</div>
        <h3>${escapeHtml(p.name)}</h3>
        <div class="min">Мин. заказ: ${p.min_order} ${escapeHtml(p.unit)} · кратность ${p.pack_qty}</div>
        ${priceHtml}
        <div class="stock ${inStock ? 'instock' : 'out'}">
          ${inStock ? `В наличии: ${p.stock} ${escapeHtml(p.unit)}` : 'Нет в наличии'}
        </div>
        ${canBuy ? `<button class="btn btn-primary" data-add="${p.id}">В корзину</button>` : ''}
      </div>`;
  }).join('');

  $$('[data-add]').forEach(b => b.addEventListener('click', () => addToCart(+b.dataset.add)));
}

/* ================= CART ================= */
async function loadCart() {
  if (!state.user || state.user.status !== 'active') { state.cart = []; renderCartCount(); return; }
  const r = await api('cart.php?action=list');
  state.cart = r.items || [];
  renderCartCount();
}
function renderCartCount() {
  const n = state.cart.reduce((s, i) => s + i.qty, 0);
  const el = $('#cartCount');
  el.textContent = n;
  el.dataset.count = n;
}

async function addToCart(pid) {
  const r = await api('cart.php?action=add', { method: 'POST', body: { product_id: pid, qty: 1 } });
  if (r.error) return toast(r.error, 'err');
  await loadCart();
  toast('Товар добавлен в корзину', 'ok');
}

function bindCartUI() {
  $('#cartBtn').addEventListener('click', async () => {
    if (!state.user) return openModal('authModal');
    if (state.user.status !== 'active') return toast('Аккаунт ожидает активации', 'err');
    await loadCart();
    renderCart();
    openModal('cartModal');
  });

  $('#checkoutBtn').addEventListener('click', async () => {
    if (!state.cart.length) return toast('Корзина пуста', 'err');
    const btn = $('#checkoutBtn');
    btn.disabled = true; btn.textContent = 'Оформляем...';
    const payload = {
      comment: $('#orderComment').value,
      delivery_method: $('#deliveryMethod')?.value || 'pickup',
      delivery_address: $('#deliveryAddress')?.value || '',
      payment_method: $('#paymentMethod')?.value || 'invoice',
    };
    const r = await api('orders.php?action=create', { method: 'POST', body: payload });
    btn.disabled = false; btn.textContent = 'Оформить заказ';
    const msg = $('#orderMsg');
    if (r.error) { msg.textContent = r.error; msg.className = 'msg err'; return; }
    msg.innerHTML = `✓ Заказ <b>${r.order_number}</b> создан! Счёт отправлен на email.`;
    msg.className = 'msg ok';
    state.cart = [];
    renderCart(); renderCartCount();
    setTimeout(() => closeModal('cartModal'), 2500);
  });
}

function renderCart() {
  const el = $('#cartItems');
  if (!state.cart.length) {
    el.innerHTML = '<p style="color:var(--muted);padding:20px 0;text-align:center">Корзина пуста</p>';
    $('#cartTotal').textContent = '0 ₽';
    return;
  }
  el.innerHTML = state.cart.map(i => `
    <div class="cart-item">
      <div class="cart-item-name">${escapeHtml(i.name)}<small>${escapeHtml(i.sku)} · мин. ${i.min_order} ${escapeHtml(i.unit)}</small></div>
      <div class="qty-controls">
        <button class="qty-btn" data-dec="${i.id}">−</button>
        <span class="qty-value">${i.qty}</span>
        <button class="qty-btn" data-inc="${i.id}">+</button>
      </div>
      <div class="cart-item-price">${fmt(i.price_wholesale * i.qty)} ₽</div>
      <button class="cart-item-remove" data-del="${i.id}" title="Удалить">✕</button>
    </div>`).join('');

  const total = state.cart.reduce((s, i) => s + i.price_wholesale * i.qty, 0);
  $('#cartTotal').textContent = fmt(total) + ' ₽';

  $$('[data-inc]', el).forEach(b => b.onclick = () => updateQty(+b.dataset.inc, 1));
  $$('[data-dec]', el).forEach(b => b.onclick = () => updateQty(+b.dataset.dec, -1));
  $$('[data-del]', el).forEach(b => b.onclick = () => removeItem(+b.dataset.del));
}

async function updateQty(pid, d) {
  const it = state.cart.find(i => i.id === pid);
  if (!it) return;
  const q = Math.max(1, it.qty + d);
  const r = await api('cart.php?action=update', { method: 'POST', body: { product_id: pid, qty: q } });
  if (r.error) return toast(r.error, 'err');
  it.qty = q;
  renderCart(); renderCartCount();
}
async function removeItem(pid) {
  const r = await api('cart.php?action=remove', { method: 'POST', body: { product_id: pid } });
  if (r.error) return toast(r.error, 'err');
  state.cart = state.cart.filter(i => i.id !== pid);
  renderCart(); renderCartCount();
}

/* ================= UI BINDINGS ================= */
function bindUI() {
  $('#loginBtn')?.addEventListener('click', () => openModal('authModal'));
  $$('.tab').forEach(t => t.onclick = () => {
    $$('.tab').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    $('#loginForm').classList.toggle('hidden', t.dataset.tab !== 'login');
    $('#registerForm').classList.toggle('hidden', t.dataset.tab !== 'register');
  });
  $$('[data-close]').forEach(b => b.onclick = () => b.closest('.modal').classList.remove('open'));
  $$('.modal').forEach(m => m.onclick = e => { if (e.target === m) m.classList.remove('open'); });

  let searchTimer;
  $('#searchInput')?.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(renderProducts, 200);
  });
  $('#categorySelect')?.addEventListener('change', renderProducts);
}

/* ================= INIT ================= */
(async () => {
  bindUI();
  bindAuthForms();
  bindCartUI();
  try {
    await loadMe();
    await loadProducts();
    await loadCart();
  } catch (e) {
    console.error(e);
    toast('Ошибка загрузки. Обновите страницу.', 'err');
  }
})();