'use strict';

const Admin = {
  state: { user: null, view: 'dashboard', orders: [], products: [], users: [] },
  STATUSES: ['new','confirmed','paid','shipped','done','cancelled'],
  STATUS_LBL: { new:'Новый', confirmed:'Подтверждён', paid:'Оплачен', shipped:'Отгружен', done:'Выполнен', cancelled:'Отменён' },

  async init() {
    TS.bindPasswordToggles();
    TS.el('#adminLoginForm')?.addEventListener('submit', e => this.login(e));
    TS.el('#adminLogout')?.addEventListener('click', async () => {
      await TS.api('auth.php?action=logout');
      location.reload();
    });
    TS.els('#sideNav a').forEach(a => a.onclick = () => this.switchView(a.dataset.view));

    const me = await TS.api('auth.php?action=me');
    if (me.user?.role === 'admin') {
      TS.user = me.user; TS.csrf = me.csrf;
      this.state.user = me.user;
      this.boot();
    }
  },

  async login(e) {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target));
    const r = await TS.api('auth.php?action=login', { method: 'POST', body });
    const msg = TS.el('#adminMsg');
    if (r.error) { msg.textContent = r.error; return; }
    if (r.user.role !== 'admin') { msg.textContent = 'Доступ только для администратора'; return; }
    TS.user = r.user; TS.csrf = r.csrf;
    this.state.user = r.user;
    this.boot();
  },

  boot() {
    TS.el('#loginScreen').classList.add('hidden');
    TS.el('#appLayout').classList.remove('hidden');
    TS.el('#adminInfo').textContent = TS.user.email + ' · ' + TS.user.company;
    this.switchView('dashboard');
  },

  async switchView(v) {
    this.state.view = v;
    TS.els('#sideNav a').forEach(a => a.classList.toggle('active', a.dataset.view === v));
    const titles = { dashboard:'Дашборд', orders:'Заказы', products:'Товары', users:'Клиенты' };
    TS.el('#pageTitle').textContent = titles[v];
    TS.el('#topActions').innerHTML = '';

    if (v === 'dashboard') return this.renderDashboard();
    if (v === 'orders')    return this.renderOrders();
    if (v === 'products')  return this.renderProducts();
    if (v === 'users')     return this.renderUsers();
  },

  /* ---- Dashboard ---- */
  async renderDashboard() {
    const { stats } = await TS.api('orders.php?action=stats');
    TS.el('#viewContent').innerHTML = `
      <div class="stats-grid">
        <div class="stat"><div class="lbl">Заказов всего</div><div class="val">${stats.orders_total}</div></div>
        <div class="stat"><div class="lbl">Новые</div><div class="val">${stats.orders_new}</div></div>
        <div class="stat"><div class="lbl">Выполнено</div><div class="val">${stats.orders_done}</div></div>
        <div class="stat"><div class="lbl">Оборот</div><div class="val">${TS.fmt(stats.revenue)} ₽</div></div>
        <div class="stat"><div class="lbl">Клиентов</div><div class="val">${stats.users_total}</div></div>
        <div class="stat"><div class="lbl">Ждут активации</div><div class="val">${stats.users_pending}</div></div>
        <div class="stat"><div class="lbl">Товаров</div><div class="val">${stats.products}</div></div>
      </div>
      <div class="panel"><h3>Последние заказы</h3><div id="recentOrders"></div></div>`;

    const { orders } = await TS.api('orders.php?action=list');
    const recent = orders.slice(0, 6);
    TS.el('#recentOrders').innerHTML = recent.length ? `
      <div class="table-wrap"><table>
        <thead><tr><th>№</th><th>Компания</th><th>Цена</th><th>Сумма</th><th>Статус</th><th>Дата</th></tr></thead>
        <tbody>${recent.map(o => `<tr>
          <td><b>${TS.esc(o.order_number)}</b></td>
          <td>${TS.esc(o.company)}</td>
          <td>${o.price_type === 'wholesale' ? '<span class="status s-confirmed">опт</span>' : '<span class="status s-new">розница</span>'}</td>
          <td><b style="color:var(--orange)">${TS.fmt(o.total)} ₽</b></td>
          <td><span class="status s-${o.status}">${this.STATUS_LBL[o.status]}</span></td>
          <td>${TS.esc(o.created_at)}</td>
        </tr>`).join('')}</tbody></table></div>` : '<p style="color:var(--muted)">Пока нет заказов</p>';
  },

  /* ---- Orders ---- */
  async renderOrders() {
    TS.el('#topActions').innerHTML = `<a class="btn btn-ghost" href="api/export.php?type=orders">⬇ Excel: заказы</a>`;
    TS.el('#viewContent').innerHTML = `
      <div class="toolbar">
        <input id="oSearch" placeholder="Поиск: №, компания, email" style="min-width:280px">
        <select id="oStatus"><option value="">Все статусы</option>
          ${this.STATUSES.map(s => `<option value="${s}">${this.STATUS_LBL[s]}</option>`).join('')}
        </select>
        <button class="btn btn-ghost" id="oRefresh">Обновить</button>
      </div>
      <div class="panel" id="ordersTable"></div>`;
    TS.el('#oSearch').oninput = this.debounce(() => this.loadOrders(), 300);
    TS.el('#oStatus').onchange = () => this.loadOrders();
    TS.el('#oRefresh').onclick = () => this.loadOrders();
    await this.loadOrders();
  },

  debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; },

  async loadOrders() {
    const q = TS.el('#oSearch')?.value || '';
    const s = TS.el('#oStatus')?.value || '';
    const r = await TS.api(`orders.php?action=list&q=${encodeURIComponent(q)}&status=${s}`);
    this.state.orders = r.orders || [];
    TS.el('#ordersTable').innerHTML = this.state.orders.length ? `
      <div class="table-wrap"><table>
        <thead><tr><th>№</th><th>Дата</th><th>Компания</th><th>Цена</th><th>Позиций</th><th>Сумма</th><th>Статус</th><th></th></tr></thead>
        <tbody>${this.state.orders.map(o => `<tr>
          <td><b>${TS.esc(o.order_number)}</b></td>
          <td>${TS.esc(o.created_at)}</td>
          <td>${TS.esc(o.company)}<br><small style="color:var(--muted)">${TS.esc(o.email)}</small></td>
          <td>${o.price_type === 'wholesale' ? '<span class="status s-confirmed">ОПТ</span>' : '<span class="status s-new">розница</span>'}</td>
          <td>${o.items.length}</td>
          <td><b style="color:var(--orange)">${TS.fmt(o.total)} ₽</b></td>
          <td><span class="status s-${o.status}">${this.STATUS_LBL[o.status]}</span></td>
          <td class="row-actions">
            <button class="btn btn-ghost mini" onclick="Admin.showOrder(${o.id})">Детали</button>
            <a class="btn btn-ghost mini" href="api/orders.php?action=invoice&id=${o.id}" target="_blank">PDF</a>
            <a class="btn btn-ghost mini" href="api/export.php?type=order_items&order_id=${o.id}">Excel</a>
          </td>
        </tr>`).join('')}</tbody></table></div>` : '<p style="color:var(--muted)">Заказов не найдено</p>';
  },

  async showOrder(id) {
    const o = this.state.orders.find(x => x.id === id);
    const { history } = await TS.api('orders.php?action=history&id=' + id);
    const itemsHtml = o.items.map(i => `<div class="detail-item">
      <span>${TS.esc(i.sku)} · ${TS.esc(i.name)} × ${i.qty} ${TS.esc(i.unit)}</span>
      <b>${TS.fmt(i.sum)} ₽</b></div>`).join('');
    const histHtml = history.map(h => `<div class="detail-item">
      <span>${TS.esc(h.created_at)}</span>
      <span>${this.STATUS_LBL[h.status] || h.status}${h.note ? ' · ' + TS.esc(h.note) : ''}</span>
    </div>`).join('');
    const statusBtns = this.STATUSES.map(s => `<button class="btn btn-ghost mini ${o.status === s ? 'btn-primary' : ''}" onclick="Admin.setStatus(${o.id}, '${s}')">${this.STATUS_LBL[s]}</button>`).join('');

    const html = `<div class="order-detail">
      <h3 style="margin:0 0 12px;color:var(--orange)">Заказ ${TS.esc(o.order_number)} ${o.price_type === 'wholesale' ? '🏢 ОПТ' : '🛒 розница'}</h3>
      <p style="color:var(--muted);margin:0 0 14px">${TS.esc(o.company)} · ${TS.esc(o.email)} · ${TS.esc(o.phone || '—')}<br>ИНН ${TS.esc(o.inn || '—')}</p>
      ${itemsHtml}
      <div class="detail-item" style="font-size:16px;margin-top:10px"><b>Итого</b><b style="color:var(--orange)">${TS.fmt(o.total)} ₽</b></div>
      <div class="detail-item"><span>В т.ч. НДС</span><b>${TS.fmt(o.vat)} ₽</b></div>
      ${o.comment ? `<p style="margin:12px 0 0;color:var(--muted)"><i>Комментарий: ${TS.esc(o.comment)}</i></p>` : ''}
      <h4 style="margin:20px 0 10px;font-size:14px">Сменить статус</h4>
      <div style="display:flex;gap:6px;flex-wrap:wrap">${statusBtns}</div>
      <h4 style="margin:22px 0 10px;font-size:14px">История</h4>
      ${histHtml || '<p style="color:var(--muted);font-size:13px">Пусто</p>'}
    </div>`;
    const container = TS.el('#ordersTable');
    container.querySelector('.order-detail')?.remove();
    container.insertAdjacentHTML('afterbegin', html);
  },

  async setStatus(id, status) {
    const r = await TS.api('orders.php?action=update_status', { method: 'POST', body: { id, status } });
    if (r.error) return TS.toast(r.error, 'err');
    TS.toast('Статус обновлён: ' + this.STATUS_LBL[status], 'ok');
    await this.loadOrders();
  },

  /* ---- Products ---- */
  async renderProducts() {
    TS.el('#topActions').innerHTML = `
      <a class="btn btn-ghost" href="api/export.php?type=products">⬇ Excel</a>
      <button class="btn btn-primary" onclick="Admin.editProduct()">+ Новый товар</button>`;
    const { products } = await TS.api('products.php?action=list');
    this.state.products = products;
    TS.el('#viewContent').innerHTML = `<div class="panel" id="productsTable"></div>`;
    TS.el('#productsTable').innerHTML = `
      <div class="table-wrap"><table>
        <thead><tr><th>SKU</th><th>Название</th><th>Категория</th><th>Розница</th><th>Опт</th><th>Остаток</th><th></th></tr></thead>
        <tbody>${products.map(p => `<tr>
          <td>${TS.esc(p.sku)}</td><td>${TS.esc(p.name)}</td><td>${TS.esc(p.category)}</td>
          <td><b>${TS.fmt(p.price_retail)}</b></td>
          <td><b style="color:var(--orange)">${TS.fmt(p.price_wholesale)}</b></td>
          <td>${p.stock}</td>
          <td class="row-actions">
            <button class="btn btn-ghost mini" onclick='Admin.editProductById(${p.id})'>Ред.</button>
            <button class="btn btn-ghost mini" onclick="Admin.deleteProduct(${p.id})">Удалить</button>
          </td>
        </tr>`).join('')}</tbody></table></div>`;
  },

  editProductById(id) { const p = this.state.products.find(x => x.id === id); if (p) this.editProduct(p); },

  editProduct(p = null) {
    p = p || { id:0, sku:'', name:'', category:'', brand:'', description:'',
               price_retail:'', price_wholesale:'', stock:0, min_order:1, pack_qty:1,
               unit:'шт', image_url:'', is_active:1 };
    const html = `<div class="order-detail" id="editForm">
      <h3 style="margin:0 0 16px;color:var(--orange)">${p.id ? 'Редактирование' : 'Новый товар'}</h3>
      <div class="modal-form-grid">
        <div class="field"><label>SKU *</label><input class="p-in" data-k="sku" value="${TS.esc(p.sku)}"></div>
        <div class="field"><label>Категория</label><input class="p-in" data-k="category" value="${TS.esc(p.category)}"></div>
        <div class="field full"><label>Название *</label><input class="p-in" data-k="name" value="${TS.esc(p.name)}"></div>
        <div class="field"><label>Бренд</label><input class="p-in" data-k="brand" value="${TS.esc(p.brand)}"></div>
        <div class="field"><label>Ед. изм.</label><input class="p-in" data-k="unit" value="${TS.esc(p.unit)}"></div>
        <div class="field full"><label>Описание</label><textarea class="p-in" data-k="description" rows="3">${TS.esc(p.description)}</textarea></div>
        <div class="field"><label>Розничная цена *</label><input class="p-in" data-k="price_retail" type="number" step="0.01" value="${p.price_retail}"></div>
        <div class="field"><label>Оптовая цена</label><input class="p-in" data-k="price_wholesale" type="number" step="0.01" value="${p.price_wholesale}"></div>
        <div class="field"><label>Остаток</label><input class="p-in" data-k="stock" type="number" value="${p.stock}"></div>
        <div class="field"><label>Мин. заказ</label><input class="p-in" data-k="min_order" type="number" value="${p.min_order}"></div>
        <div class="field"><label>Кратность</label><input class="p-in" data-k="pack_qty" type="number" value="${p.pack_qty}"></div>
        <div class="field full"><label>URL изображения</label><input class="p-in" data-k="image_url" value="${TS.esc(p.image_url)}"></div>
      </div>
      <div style="margin-top:18px;display:flex;gap:8px">
        <button class="btn btn-primary" onclick="Admin.saveProduct(${p.id})">Сохранить</button>
        <button class="btn btn-ghost" onclick="Admin.renderProducts()">Отмена</button>
      </div>
    </div>`;
    const c = TS.el('#productsTable');
    c.querySelector('#editForm')?.remove();
    c.insertAdjacentHTML('afterbegin', html);
  },

  async saveProduct(id) {
    const data = { id: id || 0 };
    TS.els('.p-in').forEach(i => data[i.dataset.k] = i.value);
    const r = await TS.api('products.php?action=save', { method: 'POST', body: data });
    if (r.error) return TS.toast(r.error, 'err');
    TS.toast('Товар сохранён', 'ok');
    this.renderProducts();
  },

  async deleteProduct(id) {
    if (!confirm('Удалить товар?')) return;
    const r = await TS.api('products.php?action=delete', { method: 'POST', body: { id } });
    if (r.error) return TS.toast(r.error, 'err');
    TS.toast('Удалён', 'ok');
    this.renderProducts();
  },

  /* ---- Users ---- */
  async renderUsers() {
    TS.el('#topActions').innerHTML = `<a class="btn btn-ghost" href="api/export.php?type=users">⬇ Excel</a>`;
    const { users } = await TS.api('admin_users.php?action=list');
    this.state.users = users;
    TS.el('#viewContent').innerHTML = `<div class="panel"><div id="usersTable"></div></div>`;
    TS.el('#usersTable').innerHTML = users.length ? `
      <div class="table-wrap"><table>
        <thead><tr><th>ID</th><th>Компания</th><th>Email</th><th>ИНН</th><th>Тип</th><th>Статус</th><th></th></tr></thead>
        <tbody>${users.map(u => `<tr>
          <td>${u.id}</td><td>${TS.esc(u.company)}</td><td>${TS.esc(u.email)}</td>
          <td>${TS.esc(u.inn || '—')}</td>
          <td>${u.role === 'admin' ? '<span class="status s-confirmed">админ</span>' : u.role === 'wholesale' ? '<span class="status s-new">опт</span>' : 'розница'}</td>
          <td><span class="status s-${u.status}">${u.status}</span></td>
          <td class="row-actions">
            ${u.role !== 'admin' && u.status !== 'active' ? `<button class="btn btn-primary mini" onclick="Admin.setUserStatus(${u.id},'active')">Активировать</button>` : ''}
            ${u.role !== 'admin' && u.status !== 'blocked' ? `<button class="btn btn-ghost mini" onclick="Admin.setUserStatus(${u.id},'blocked')">Блок</button>` : ''}
          </td>
        </tr>`).join('')}</tbody></table></div>` : '<p style="color:var(--muted)">Нет пользователей</p>';
  },

  async setUserStatus(id, status) {
    const r = await TS.api('admin_users.php?action=status', { method: 'POST', body: { id, status } });
    if (r.error) return TS.toast(r.error, 'err');
    TS.toast('Статус клиента обновлён', 'ok');
    this.renderUsers();
  },
};

document.addEventListener('DOMContentLoaded', () => Admin.init());