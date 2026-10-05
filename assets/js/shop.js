'use strict';

const Shop = {
  state: { products: [], cart: [], showWholesale: false, user: null },

  async init() {
    TS.bindPasswordToggles();
    this.bindUI();
    await TS.loadUser();
    this.state.user = TS.user;
    this.renderUser();
    await this.loadProducts();
    await this.loadCart();
  },

  /* ---- UI ---- */
  renderUser() {
    const loginBtn = TS.el('#loginBtn');
    const userBox  = TS.el('#userBox');
    const u = this.state.user;

    if (u) {
      loginBtn?.classList.add('hidden');
      userBox?.classList.remove('hidden');

      let dotClass = 'dot';
      let badgeText = '';
      if (u.role === 'admin') { dotClass += ' wholesale'; badgeText = ' · админ'; }
      else if (u.role === 'wholesale' && u.status === 'active') { dotClass += ' wholesale'; badgeText = ' · опт'; }
      else if (u.role === 'wholesale' && u.status === 'pending') { dotClass += ' pending'; badgeText = ' · ждём активации'; }

      TS.el('#userName').textContent = u.company;
      TS.el('#userName').dataset.badge = badgeText;
      TS.el('#userBox .dot').className = dotClass;
    } else {
      loginBtn?.classList.remove('hidden');
      userBox?.classList.add('hidden');
    }
  },

  bindUI() {
    TS.el('#loginBtn')?.addEventListener('click', () => TS.openModal('authModal'));
    TS.el('#cartBtn')?.addEventListener('click', async () => {
      if (!this.state.user) return TS.openModal('authModal');
      await this.loadCart();
      this.renderCart();
      TS.openModal('cartModal');
    });

    TS.els('.tab').forEach(t => t.onclick = () => {
      TS.els('.tab').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      TS.el('#loginForm')?.classList.toggle('hidden', t.dataset.tab !== 'login');
      TS.el('#registerForm')?.classList.toggle('hidden', t.dataset.tab !== 'register');
    });

    TS.els('[data-close]').forEach(b => b.onclick = () => b.closest('.modal').classList.remove('open'));
    TS.els('.modal').forEach(m => m.onclick = e => { if (e.target === m) m.classList.remove('open'); });

    // Auth forms
    TS.el('#loginForm')?.addEventListener('submit', e => this.handleLogin(e));
    TS.el('#registerForm')?.addEventListener('submit', e => this.handleRegister(e));
    TS.el('#logoutBtn')?.addEventListener('click', () => this.handleLogout());

    // Search
    let t;
    TS.el('#searchInput')?.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => this.renderProducts(), 200); });
    TS.el('#categorySelect')?.addEventListener('change', () => this.renderProducts());

    // Checkout
    TS.el('#checkoutBtn')?.addEventListener('click', () => this.handleCheckout());
  },

  /* ---- AUTH ---- */
  async handleLogin(e) {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target));
    const r = await TS.api('auth.php?action=login', { method: 'POST', body });
    const msg = TS.el('#loginMsg');
    if (r.error) { msg.textContent = r.error; msg.className = 'msg err'; return; }
    TS.user = r.user; TS.csrf = r.csrf; this.state.user = r.user;
    this.renderUser();
    TS.closeModal('authModal');
    await this.loadProducts();
    await this.loadCart();
    TS.toast('Добро пожаловать, ' + r.user.company, 'ok');
  },

  async handleRegister(e) {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target));
    const r = await TS.api('auth.php?action=register', { method: 'POST', body });
    const msg = TS.el('#regMsg');
    if (r.error) { msg.textContent = r.error; msg.className = 'msg err'; return; }
    msg.textContent = '✓ ' + r.message; msg.className = 'msg ok';
    e.target.reset();
  },

  async handleLogout() {
    await TS.api('auth.php?action=logout');
    TS.user = null; TS.csrf = ''; this.state.user = null;
    this.renderUser();
    await this.loadProducts();
    this.state.cart = [];
    this.renderCartCount();
    TS.toast('Вы вышли');
  },

  /* ---- PRODUCTS ---- */
  async loadProducts() {
    const r = await TS.api('products.php?action=list');
    this.state.products = r.products || [];
    this.state.showWholesale = r.show_wholesale || false;

    const cats = [...new Set(this.state.products.map(p => p.category).filter(Boolean))];
    const sel = TS.el('#categorySelect');
    if (sel) sel.innerHTML = '<option value="">Все категории</option>' + cats.map(c => `<option>${TS.esc(c)}</option>`).join('');

    // Notice про опт
    const notice = TS.el('#wholesaleNotice');
    if (notice) {
      if (this.state.user?.role === 'wholesale' && this.state.user.status === 'pending') {
        notice.classList.remove('hidden');
        notice.innerHTML = '⏳ <b>Ваш аккаунт ждёт активации.</b> После подтверждения менеджером вы увидите оптовые цены.';
      } else if (this.state.user?.role === 'wholesale' && this.state.user.status === 'active') {
        notice.classList.remove('hidden');
        notice.innerHTML = '🏢 <b>Вы видите оптовые цены.</b> Условия — по договору.';
      } else if (!this.state.user) {
        notice.classList.remove('hidden');
        notice.innerHTML = '🏢 <b>Юрлицо?</b> <a href="#" onclick="TS.openModal(\'authModal\');document.querySelector(\'.tab[data-tab=register]\').click();return false;" style="color:var(--orange);text-decoration:underline;">Зарегистрируйтесь</a> и получите доступ к оптовым ценам.';
      } else {
        notice.classList.add('hidden');
      }
    }

    this.renderProducts();
  },

  renderProducts() {
    const q = (TS.el('#searchInput')?.value || '').toLowerCase();
    const cat = TS.el('#categorySelect')?.value || '';
    const list = this.state.products.filter(p =>
      (!q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)) &&
      (!cat || p.category === cat)
    );

    const el = TS.el('#products');
    if (!list.length) {
      el.innerHTML = `<p style="color:var(--muted);grid-column:1/-1;text-align:center;padding:40px">Ничего не найдено</p>`;
      return;
    }

    el.innerHTML = list.map(p => {
      const inStock = p.stock > 0;
      const priceLabel = p.price_type === 'wholesale'
        ? '<span class="price-badge wholesale">🏢 опт</span>'
        : '<span class="price-badge retail">🛒 розница</span>';
      const canBuy = this.state.user && inStock;
      return `
        <div class="product">
          <div class="product-img">${p.image_url ? `<img src="${TS.esc(p.image_url)}" alt="" loading="lazy">` : '📦'}</div>
          <div class="sku">${TS.esc(p.sku)}${p.brand ? ' · ' + TS.esc(p.brand) : ''}</div>
          <h3>${TS.esc(p.name)}</h3>
          <div class="min">Мин. заказ: ${p.min_order} ${TS.esc(p.unit)} · кратность ${p.pack_qty}</div>
          ${priceLabel}
          <div class="price">${TS.fmt(p.display_price)} ₽<small>/ ${TS.esc(p.unit)}</small></div>
          <div class="stock ${inStock ? 'instock' : 'out'}">
            ${inStock ? `В наличии: ${p.stock} ${TS.esc(p.unit)}` : 'Нет в наличии'}
          </div>
          ${canBuy ? `<button class="btn btn-primary" data-add="${p.id}">В корзину</button>` : ''}
        </div>`;
    }).join('');

    TS.els('[data-add]').forEach(b => b.onclick = () => this.addToCart(+b.dataset.add));
  },

  /* ---- CART ---- */
  async loadCart() {
    if (!this.state.user) { this.state.cart = []; this.renderCartCount(); return; }
    const r = await TS.api('cart.php?action=list');
    this.state.cart = r.items || [];
    this.renderCartCount();
  },

  renderCartCount() {
    const n = this.state.cart.reduce((s, i) => s + i.qty, 0);
    const el = TS.el('#cartCount');
    if (el) el.textContent = n;
  },

  async addToCart(pid) {
    const r = await TS.api('cart.php?action=add', { method: 'POST', body: { product_id: pid, qty: 1 } });
    if (r.error) return TS.toast(r.error, 'err');
    await this.loadCart();
    TS.toast('Товар добавлен в корзину', 'ok');
  },

  renderCart() {
    const el = TS.el('#cartItems');
    const isWholesale = this.state.user?.role === 'wholesale' && this.state.user.status === 'active';
    if (!this.state.cart.length) {
      el.innerHTML = '<p style="color:var(--muted);padding:20px 0;text-align:center">Корзина пуста</p>';
      TS.el('#cartTotal').textContent = '0 ₽';
      return;
    }
    el.innerHTML = this.state.cart.map(i => `
      <div class="cart-item">
        <div class="cart-item-name">${TS.esc(i.name)}<small>${TS.esc(i.sku)} · ${TS.fmt(i.price)} ₽ (${i.price_type === 'wholesale' ? 'опт' : 'розница'})</small></div>
        <div class="qty-controls">
          <button class="qty-btn" data-dec="${i.id}">−</button>
          <span class="qty-value">${i.qty}</span>
          <button class="qty-btn" data-inc="${i.id}">+</button>
        </div>
        <div class="cart-item-price">${TS.fmt(i.price * i.qty)} ₽</div>
        <button class="cart-item-remove" data-del="${i.id}">✕</button>
      </div>`).join('');

    const total = this.state.cart.reduce((s, i) => s + i.price * i.qty, 0);
    TS.el('#cartTotal').textContent = TS.fmt(total) + ' ₽';

    TS.els('[data-inc]', el).forEach(b => b.onclick = () => this.updateQty(+b.dataset.inc, 1));
    TS.els('[data-dec]', el).forEach(b => b.onclick = () => this.updateQty(+b.dataset.dec, -1));
    TS.els('[data-del]', el).forEach(b => b.onclick = () => this.removeItem(+b.dataset.del));
  },

  async updateQty(pid, d) {
    const it = this.state.cart.find(i => i.id === pid);
    if (!it) return;
    const q = Math.max(1, it.qty + d);
    const r = await TS.api('cart.php?action=update', { method: 'POST', body: { product_id: pid, qty: q } });
    if (r.error) return TS.toast(r.error, 'err');
    it.qty = q;
    this.renderCart();
    this.renderCartCount();
  },

  async removeItem(pid) {
    const r = await TS.api('cart.php?action=remove', { method: 'POST', body: { product_id: pid } });
    if (r.error) return TS.toast(r.error, 'err');
    this.state.cart = this.state.cart.filter(i => i.id !== pid);
    this.renderCart();
    this.renderCartCount();
  },

  async handleCheckout() {
    if (!this.state.cart.length) return TS.toast('Корзина пуста', 'err');
    const btn = TS.el('#checkoutBtn');
    btn.disabled = true; btn.textContent = 'Оформляем...';
    const payload = {
      comment: TS.el('#orderComment')?.value || '',
      delivery_method: TS.el('#deliveryMethod')?.value || 'pickup',
      delivery_address: TS.el('#deliveryAddress')?.value || '',
    };
    const r = await TS.api('orders.php?action=create', { method: 'POST', body: payload });
    btn.disabled = false; btn.textContent = 'Оформить заказ';
    const msg = TS.el('#orderMsg');
    if (r.error) { msg.textContent = r.error; msg.className = 'msg err'; return; }
    msg.innerHTML = `✓ Заказ <b>${r.order_number}</b> создан! Счёт отправлен на email.`;
    msg.className = 'msg ok';
    this.state.cart = [];
    this.renderCart();
    this.renderCartCount();
    setTimeout(() => TS.closeModal('cartModal'), 2500);
  },
};

document.addEventListener('DOMContentLoaded', () => Shop.init());