// --- data ---
    const PRODUCTS = [
      {id:1,name:"Тормозные колодки Brembo",desc:"Передние тормозные колодки для Volkswagen Golf. Высококачественные материалы обеспечивают надежное торможение.",price:4500,category:'brakes',icon:'fas fa-brake-warning', rating: 4.8, stock: 12},
      {id:2,name:"Масляный фильтр Mann",desc:"Фильтр масляный для Toyota Camry. Обеспечивает эффективную очистку моторного масла от примесей.",price:850,category:'engine',icon:'fas fa-filter', rating: 4.5, stock: 25},
      {id:3,name:"Амортизатор KYB",desc:"Передний амортизатор для Honda Civic. Обеспечивает комфорт и устойчивость на дороге.",price:6200,category:'suspension',icon:'fas fa-compress-alt', rating: 4.7, stock: 8},
      {id:4,name:"Свечи зажигания NGK",desc:"Иридиевые свечи для BMW 3 series. Обеспечивают стабильное воспламенение топливной смеси.",price:3800,category:'electrical',icon:'fas fa-plug', rating: 4.9, stock: 15},
      {id:5,name:"Ремень ГРМ Gates",desc:"Ремень ГРМ для Ford Focus. Надежность и долговечность от ведущего производителя.",price:2700,category:'engine',icon:'fas fa-cogs', rating: 4.6, stock: 10},
      {id:6,name:"Тормозные диски ATE",desc:"Передние тормозные диски для Audi A4. Высококачественные вентилируемые диски.",price:8900,category:'brakes',icon:'fas fa-compact-disc', rating: 4.8, stock: 6},
      {id:7,name:"Стойка стабилизатора Lemforder",desc:"Стойка стабилизатора для Mercedes C-class. Обеспечивает устойчивость в поворотах.",price:1500,category:'suspension',icon:'fas fa-link', rating: 4.4, stock: 18},
      {id:8,name:"Аккумулятор Varta",desc:"Аккумулятор 60Ah для Skoda Octavia. Высокая пусковая мощность и надежность.",price:6500,category:'electrical',icon:'fas fa-car-battery', rating: 4.7, stock: 7}
    ];

    const CATEGORIES = [
      {id:'all',label:'Все товары', icon: 'fas fa-boxes'},
      {id:'engine',label:'Двигатель', icon: 'fas fa-cogs'},
      {id:'brakes',label:'Тормозная система', icon: 'fas fa-brake-warning'},
      {id:'suspension',label:'Подвеска', icon: 'fas fa-compress-alt'},
      {id:'electrical',label:'Электрика', icon: 'fas fa-bolt'}
    ];

    // Данные для доставки
    const DELIVERY_OPTIONS = [
      { id: 'courier', name: 'Курьерская доставка', desc: 'До двери в течение 1-2 дней', price: 500 },
      { id: 'pickup', name: 'Самовывоз', desc: 'Из пункта выдачи заказов', price: 0 },
      { id: 'post', name: 'Почта России', desc: 'Доставка в отделение почты', price: 300 }
    ];

    // Настройки Telegram бота (ЗАМЕНИТЕ НА СВОИ ДАННЫЕ)
    const TELEGRAM_BOT_TOKEN = '8506175268:AAFL_7V6nHfaJyy9B1mJ-58P1hA_ehumCAk';
    const TELEGRAM_CHAT_ID = '8506175268';

    // --- state ---
    let state = {
      filter:'all',
      cart: JSON.parse(localStorage.getItem('trackshop_cart')||'[]')
    };

    // --- utils ---
    const $ = sel => document.querySelector(sel);
    const $$ = sel => Array.from(document.querySelectorAll(sel));

    // Show notification
    function showNotification(message) {
      const notification = $('#notification');
      const messageEl = $('#notificationMessage');
      messageEl.textContent = message;
      notification.classList.add('show');
      
      setTimeout(() => {
        notification.classList.remove('show');
      }, 3000);
    }

    // Animate numbers
    function animateNumber(element, finalValue, duration = 2000) {
      let start = 0;
      const increment = finalValue / (duration / 16);
      const timer = setInterval(() => {
        start += increment;
        if (start >= finalValue) {
          element.textContent = finalValue.toLocaleString();
          clearInterval(timer);
        } else {
          element.textContent = Math.floor(start).toLocaleString();
        }
      }, 16);
    }

    // Render star rating
    function renderRating(rating) {
      let stars = '';
      const fullStars = Math.floor(rating);
      const hasHalfStar = rating % 1 >= 0.5;
      
      for (let i = 0; i < fullStars; i++) {
        stars += '<i class="fas fa-star"></i>';
      }
      
      if (hasHalfStar) {
        stars += '<i class="fas fa-star-half-alt"></i>';
      }
      
      const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
      for (let i = 0; i < emptyStars; i++) {
        stars += '<i class="far fa-star"></i>';
      }
      
      return stars;
    }

    // --- render ---
    function renderCategories(){
      const el = $('#categories');
      el.innerHTML = '';
      CATEGORIES.slice(1).forEach(cat => {
        const card = document.createElement('button');
        card.className = 'cat-card fade-in';
        card.type = 'button';
        card.innerHTML = `
          <div class="cat-icon"><i class="${cat.icon}"></i></div>
          <div class="cat-content">
            <h4>${cat.label}</h4>
            <p>Запчасти и комплектующие</p>
          </div>
        `;
        card.addEventListener('click', () => {
          setFilter(cat.id);
          $('#catalog').scrollIntoView({behavior:'smooth'});
        });
        el.appendChild(card);
      });
    }

    function renderFilters(){
      const el = $('#filters'); 
      el.innerHTML = '';
      CATEGORIES.forEach(c => {
        const b = document.createElement('button'); 
        b.className = `chip ${state.filter === c.id ? 'active' : ''}`; 
        b.textContent = c.label; 
        b.addEventListener('click', () => setFilter(c.id)); 
        el.appendChild(b);
      });
    }

    function renderProducts(){
      const grid = $('#productsGrid'); 
      grid.innerHTML = '';
      const list = state.filter === 'all' ? PRODUCTS : PRODUCTS.filter(p => p.category === state.filter);
      
      if (list.length === 0) {
        grid.innerHTML = '<div style="text-align:center;color:var(--text-secondary);padding:3rem;font-size:1.2rem">Товары не найдены</div>';
        return;
      }
      
      list.forEach((p, index) => {
        const card = document.createElement('article'); 
        card.className = 'product slide-up';
        card.style.animationDelay = `${index * 0.1}s`;
        
        const cartQuantity = getCartQuantity(p.id);
        
        card.innerHTML = `
          <div class="thumb">
            <i class="${p.icon}"></i>
            ${p.stock < 10 ? '<div class="product-badge">Осталось мало</div>' : ''}
          </div>
          <h4>${p.name}</h4>
          <p>${p.desc}</p>
          <div class="product-meta">
            <div class="product-rating">
              ${renderRating(p.rating)}
              <span style="color: var(--text-secondary); margin-left: 5px;">${p.rating}</span>
            </div>
            <div class="product-stock">
              ${p.stock > 5 ? 'В наличии' : p.stock > 0 ? `Осталось: ${p.stock}` : 'Нет в наличии'}
            </div>
          </div>
          <div class="price-row">
            <div class="price">${p.price.toLocaleString()} руб.</div>
            <div class="qty-controls">
              ${cartQuantity === 0 ? 
                `<button class="btn btn-primary btn-add" data-product-id="${p.id}">
                  <i class="fas fa-cart-plus"></i>
                  Добавить в корзину
                </button>` : 
                `<div class="qty-group">
                  <button class="qty-btn" data-product-id="${p.id}" data-action="decrease">-</button>
                  <div class="qty-display">${cartQuantity}</div>
                  <button class="qty-btn" data-product-id="${p.id}" data-action="increase">+</button>
                </div>`
              }
            </div>
          </div>
        `;
        grid.appendChild(card);
      });
    }

    // --- cart ---
    function saveCart(){ 
      localStorage.setItem('trackshop_cart', JSON.stringify(state.cart)); 
      updateCartUI(); 
      renderProducts();
    }
    
    function getCartQuantity(id){ 
      const item = state.cart.find(x => x.id === id); 
      return item ? item.quantity : 0; 
    }
    
    function addToCart(id, qty = 1){ 
      id = Number(id); 
      const item = state.cart.find(x => x.id === id); 
      if(item){ 
        item.quantity += qty; 
      } else { 
        const product = PRODUCTS.find(p => p.id === id); 
        if (product) {
          state.cart.push({id, name: product.name, price: product.price, quantity: qty});
        }
      } 
      saveCart(); 
      showNotification('Товар добавлен в корзину');
    }
    
    function removeFromCart(id){ 
      id = Number(id); 
      state.cart = state.cart.filter(x => x.id !== id); 
      saveCart(); 
    }
    
    function changeQty(id, delta){ 
      id = Number(id); 
      const item = state.cart.find(x => x.id === id); 
      if(!item) return; 
      item.quantity += delta; 
      if(item.quantity <= 0) {
        removeFromCart(id);
        showNotification('Товар удален из корзины');
      } else {
        saveCart(); 
      }
    }

    function updateCartUI(){
      // Update cart count
      const count = state.cart.reduce((sum, item) => sum + item.quantity, 0);
      $('#cartCount').textContent = count;
      $('#cartTotal').textContent = state.cart.reduce((sum, item) => sum + item.price * item.quantity, 0).toLocaleString() + ' руб.';

      // Update cart list
      const list = $('#cartList'); 
      list.innerHTML = '';
      if(state.cart.length === 0){ 
        list.innerHTML = '<div style="text-align:center;color:var(--text-secondary);padding:2.5rem;font-size:1.1rem">Корзина пуста</div>'; 
        return; 
      }
      
      state.cart.forEach(item => {
        const node = document.createElement('div'); 
        node.className = 'cart-item';
        node.innerHTML = `
          <div class="cart-item-info">
            <div class="cart-item-name">${item.name}</div>
            <div class="cart-item-price">${item.price.toLocaleString()} руб.</div>
          </div>
          <div class="cart-item-controls">
            <button class="qty-btn" data-cart-dec="${item.id}">-</button>
            <div>${item.quantity}</div>
            <button class="qty-btn" data-cart-inc="${item.id}">+</button>
            <button class="qty-btn" data-cart-rem="${item.id}"><i class="fas fa-trash"></i></button>
          </div>
        `;
        list.appendChild(node);
      });
    }

    // --- checkout functions ---
    function openCheckoutModal() {
      if (state.cart.length === 0) {
        showNotification('Корзина пуста');
        return;
      }
      
      // Закрываем корзину и открываем оформление заказа
      $('#cartModal').classList.remove('active');
      $('#checkoutModal').classList.add('active');
      
      // Заполняем сводку заказа
      renderCheckoutSummary();
      
      // Устанавливаем минимальную дату доставки (завтра)
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const minDate = tomorrow.toISOString().split('T')[0];
      $('#deliveryDate').min = minDate;
      
      // Устанавливаем дату по умолчанию (через 2 дня)
      const defaultDate = new Date();
      defaultDate.setDate(defaultDate.getDate() + 2);
      $('#deliveryDate').value = defaultDate.toISOString().split('T')[0];
      
      // Настройка обработчиков для опций доставки
      setupDeliveryOptions();
    }
    
    function renderCheckoutSummary() {
      const container = $('#checkoutItems');
      container.innerHTML = '';
      
      state.cart.forEach(item => {
        const itemElement = document.createElement('div');
        itemElement.className = 'summary-item';
        itemElement.innerHTML = `
          <span>${item.name} × ${item.quantity}</span>
          <span>${(item.price * item.quantity).toLocaleString()} руб.</span>
        `;
        container.appendChild(itemElement);
      });
      
      // Добавляем стоимость доставки
      const deliveryOption = document.querySelector('input[name="delivery"]:checked');
      const deliveryPrice = DELIVERY_OPTIONS.find(opt => opt.id === deliveryOption.value).price;
      
      if (deliveryPrice > 0) {
        const deliveryElement = document.createElement('div');
        deliveryElement.className = 'summary-item';
        deliveryElement.innerHTML = `
          <span>Доставка</span>
          <span>${deliveryPrice.toLocaleString()} руб.</span>
        `;
        container.appendChild(deliveryElement);
      }
      
      // Обновляем итоговую сумму
      const itemsTotal = state.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const total = itemsTotal + deliveryPrice;
      $('#checkoutTotal').textContent = total.toLocaleString() + ' руб.';
    }
    
    function setupDeliveryOptions() {
      const options = document.querySelectorAll('.delivery-option');
      
      options.forEach(option => {
        option.addEventListener('click', () => {
          // Убираем выделение со всех опций
          options.forEach(opt => opt.classList.remove('selected'));
          // Добавляем выделение к выбранной опции
          option.classList.add('selected');
          // Обновляем сводку заказа
          renderCheckoutSummary();
        });
        
        // Изначально выделяем выбранную опцию
        const radio = option.querySelector('input[type="radio"]');
        if (radio.checked) {
          option.classList.add('selected');
        }
      });
    }
    
    function validateCheckoutForm() {
      const name = $('#customerName').value.trim();
      const phone = $('#customerPhone').value.trim();
      const email = $('#customerEmail').value.trim();
      const address = $('#deliveryAddress').value.trim();
      
      if (!name) {
        showNotification('Пожалуйста, введите ФИО');
        $('#customerName').focus();
        return false;
      }
      
      if (!phone) {
        showNotification('Пожалуйста, введите телефон');
        $('#customerPhone').focus();
        return false;
      }
      
      if (!email) {
        showNotification('Пожалуйста, введите email');
        $('#customerEmail').focus();
        return false;
      }
      
      if (!address) {
        showNotification('Пожалуйста, введите адрес доставки');
        $('#deliveryAddress').focus();
        return false;
      }
      
      // Простая валидация email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        showNotification('Пожалуйста, введите корректный email');
        $('#customerEmail').focus();
        return false;
      }
      
      return true;
    }
    
    async function submitOrder() {
      if (!validateCheckoutForm()) return;
      
      // Показываем индикатор загрузки
      const confirmBtn = $('#confirmOrderBtn');
      const originalText = confirmBtn.innerHTML;
      confirmBtn.innerHTML = '<div class="loading"></div> Обработка...';
      confirmBtn.disabled = true;
      
      try {
        // Собираем данные заказа
        const orderData = {
          customer: {
            name: $('#customerName').value.trim(),
            phone: $('#customerPhone').value.trim(),
            email: $('#customerEmail').value.trim()
          },
          delivery: {
            address: $('#deliveryAddress').value.trim(),
            method: document.querySelector('input[name="delivery"]:checked').value,
            date: $('#deliveryDate').value,
            comment: $('#orderComment').value.trim()
          },
          items: state.cart,
          total: calculateOrderTotal()
        };
        
        // Отправляем заказ в Telegram
        await sendOrderToTelegram(orderData);
        
        // Показываем сообщение об успехе
        $('#checkoutModal').classList.remove('active');
        $('#successModal').classList.add('active');
        
        // Очищаем корзину
        state.cart = [];
        saveCart();
        
      } catch (error) {
        console.error('Ошибка при оформлении заказа:', error);
        showNotification('Произошла ошибка при оформлении заказа. Пожалуйста, попробуйте еще раз.');
      } finally {
        // Восстанавливаем кнопку
        confirmBtn.innerHTML = originalText;
        confirmBtn.disabled = false;
      }
    }
    
    function calculateOrderTotal() {
      const itemsTotal = state.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const deliveryOption = document.querySelector('input[name="delivery"]:checked');
      const deliveryPrice = DELIVERY_OPTIONS.find(opt => opt.id === deliveryOption.value).price;
      return itemsTotal + deliveryPrice;
    }
    
    async function sendOrderToTelegram(orderData) {
      // Форматируем сообщение для Telegram
      const message = formatOrderMessage(orderData);
      
      // URL для отправки сообщения в Telegram бот
      const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
      
      // Параметры запроса
      const params = {
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'HTML'
      };
      
      // Отправляем запрос
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params)
      });
      
      if (!response.ok) {
        throw new Error(`Ошибка Telegram API: ${response.status}`);
      }
      
      return await response.json();
    }
    
    function formatOrderMessage(orderData) {
      const deliveryMethod = DELIVERY_OPTIONS.find(opt => opt.id === orderData.delivery.method);
      
      let message = `<b>🚗 Новый заказ в TrackShop!</b>\n\n`;
      message += `<b>Клиент:</b>\n`;
      message += `👤 ${orderData.customer.name}\n`;
      message += `📞 ${orderData.customer.phone}\n`;
      message += `📧 ${orderData.customer.email}\n\n`;
      
      message += `<b>Доставка:</b>\n`;
      message += `📍 ${orderData.delivery.address}\n`;
      message += `🚚 ${deliveryMethod.name}\n`;
      
      if (orderData.delivery.date) {
        message += `📅 ${formatDate(orderData.delivery.date)}\n`;
      }
      
      if (orderData.delivery.comment) {
        message += `💬 ${orderData.delivery.comment}\n`;
      }
      
      message += `\n<b>Заказ:</b>\n`;
      orderData.items.forEach(item => {
        message += `• ${item.name} (${item.quantity} шт.) - ${(item.price * item.quantity).toLocaleString()} руб.\n`;
      });
      
      message += `\n<b>Итого:</b> ${orderData.total.toLocaleString()} руб.\n`;
      message += `\n<i>Заказ получен: ${new Date().toLocaleString('ru-RU')}</i>`;
      
      return message;
    }
    
    function formatDate(dateString) {
      const date = new Date(dateString);
      return date.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    }

    // --- interactions ---
    function setFilter(cat){ 
      state.filter = cat; 
      renderFilters(); 
      renderProducts(); 
    }

    // Mobile menu functionality
    function toggleMobileMenu() {
      $('#mobileMenu').classList.toggle('active');
    }

    // Scroll to top functionality
    function toggleScrollToTop() {
      const scrollToTopBtn = $('#scrollToTop');
      if (window.pageYOffset > 300) {
        scrollToTopBtn.classList.add('visible');
      } else {
        scrollToTopBtn.classList.remove('visible');
      }
    }

    // Header scroll effect
    function toggleHeaderScroll() {
      const header = $('#header');
      if (window.pageYOffset > 50) {
        header.classList.add('header-scrolled');
      } else {
        header.classList.remove('header-scrolled');
      }
    }

    // Setup event listeners
    function setupEventListeners() {
      // Cart modal controls
      $('#cartBtn').addEventListener('click', () => { 
        $('#cartModal').classList.add('active'); 
        updateCartUI(); 
      });
      
      $('#closeCart').addEventListener('click', () => { 
        $('#cartModal').classList.remove('active'); 
      });
      
      // Close modal when clicking outside
      $('#cartModal').addEventListener('click', (e) => {
        if (e.target === $('#cartModal')) {
          $('#closeCart').click();
        }
      });
      
      $('#clearCartBtn').addEventListener('click', () => { 
        if (state.cart.length === 0) return;
        
        if (confirm('Вы уверены, что хотите очистить корзину?')) {
          state.cart = []; 
          saveCart(); 
          showNotification('Корзина очищена');
        }
      });
      
      // Checkout functionality
      $('#checkoutBtn').addEventListener('click', openCheckoutModal);
      
      $('#closeCheckout').addEventListener('click', () => {
        $('#checkoutModal').classList.remove('active');
      });
      
      $('#backToCartBtn').addEventListener('click', () => {
        $('#checkoutModal').classList.remove('active');
        $('#cartModal').classList.add('active');
      });
      
      $('#confirmOrderBtn').addEventListener('click', submitOrder);
      
      $('#successCloseBtn').addEventListener('click', () => {
        $('#successModal').classList.remove('active');
      });
      
      // Close modals when clicking outside
      $('#checkoutModal').addEventListener('click', (e) => {
        if (e.target === $('#checkoutModal')) {
          $('#closeCheckout').click();
        }
      });
      
      $('#successModal').addEventListener('click', (e) => {
        if (e.target === $('#successModal')) {
          $('#successCloseBtn').click();
        }
      });
      
      // Обработка изменения способа доставки
      document.querySelectorAll('input[name="delivery"]').forEach(radio => {
        radio.addEventListener('change', renderCheckoutSummary);
      });

      $('#toCatalog').addEventListener('click', () => { 
        $('#catalog').scrollIntoView({behavior:'smooth'}); 
      });

      // Mobile menu controls
      $('#mobileMenuBtn').addEventListener('click', toggleMobileMenu);
      $('#closeMobileMenu').addEventListener('click', toggleMobileMenu);

      // Close mobile menu when clicking on a link
      document.querySelectorAll('.mobile-nav a').forEach(link => {
        link.addEventListener('click', toggleMobileMenu);
      });

      // Scroll to top
      $('#scrollToTop').addEventListener('click', () => {
        window.scrollTo({top: 0, behavior: 'smooth'});
      });

      // Search functionality
      function performSearch() {
        const query = $('#searchInput').value.trim().toLowerCase();
        if(!query) {
          setFilter('all');
          return;
        }
        
        const found = PRODUCTS.filter(p =>
          p.name.toLowerCase().includes(query) || 
          p.desc.toLowerCase().includes(query)
        );
        
        const grid = $('#productsGrid');
        grid.innerHTML = '';
        
        if (found.length === 0) {
          grid.innerHTML = '<div style="text-align:center;color:var(--text-secondary);padding:3rem;font-size:1.2rem">По вашему запросу ничего не найдено</div>';
          return;
        }
        
        renderProductsFromList(found);
      }

      function renderProductsFromList(products) {
        const grid = $('#productsGrid');
        grid.innerHTML = '';
        
        products.forEach((p, index) => {
          const card = document.createElement('article'); 
          card.className = 'product slide-up';
          card.style.animationDelay = `${index * 0.1}s`;
          
          const cartQuantity = getCartQuantity(p.id);
          
          card.innerHTML = `
            <div class="thumb">
              <i class="${p.icon}"></i>
              ${p.stock < 10 ? '<div class="product-badge">Осталось мало</div>' : ''}
            </div>
            <h4>${p.name}</h4>
            <p>${p.desc}</p>
            <div class="product-meta">
              <div class="product-rating">
                ${renderRating(p.rating)}
                <span style="color: var(--text-secondary); margin-left: 5px;">${p.rating}</span>
              </div>
              <div class="product-stock">
                ${p.stock > 5 ? 'В наличии' : p.stock > 0 ? `Осталось: ${p.stock}` : 'Нет в наличии'}
              </div>
            </div>
            <div class="price-row">
              <div class="price">${p.price.toLocaleString()} руб.</div>
              <div class="qty-controls">
                ${cartQuantity === 0 ? 
                  `<button class="btn btn-primary btn-add" data-product-id="${p.id}">
                    <i class="fas fa-cart-plus"></i>
                    Добавить в корзину
                  </button>` : 
                  `<div class="qty-group">
                    <button class="qty-btn" data-product-id="${p.id}" data-action="decrease">-</button>
                    <div class="qty-display">${cartQuantity}</div>
                    <button class="qty-btn" data-product-id="${p.id}" data-action="increase">+</button>
                  </div>`
                }
              </div>
            </div>
          `;
          grid.appendChild(card);
        });
      }

      $('#searchBtn').addEventListener('click', performSearch);
      
      // Search on Enter key
      $('#searchInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          performSearch();
        }
      });

      // Close modal with Escape key
      document.addEventListener('keydown', e => { 
        if(e.key === 'Escape' && $('#cartModal').classList.contains('active')) { 
          $('#closeCart').click(); 
        } 
        if(e.key === 'Escape' && $('#checkoutModal').classList.contains('active')) { 
          $('#closeCheckout').click(); 
        }
        if(e.key === 'Escape' && $('#successModal').classList.contains('active')) { 
          $('#successCloseBtn').click(); 
        }
      });

      // Smooth scrolling for anchor links
      document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
          e.preventDefault();
          
          // Update active nav link
          document.querySelectorAll('nav.desktop a, .mobile-nav a').forEach(link => {
            link.classList.remove('active');
          });
          this.classList.add('active');
          
          const targetId = this.getAttribute('href');
          if (targetId === '#') return;
          
          const targetElement = document.querySelector(targetId);
          if (targetElement) {
            targetElement.scrollIntoView({
              behavior: 'smooth'
            });
          }
        });
      });

      // Делегирование событий для динамических элементов
      document.addEventListener('click', function(e) {
        // Обработка кнопок "Добавить в корзину"
        if (e.target.closest('.btn-add')) {
          const productId = parseInt(e.target.closest('.btn-add').getAttribute('data-product-id'));
          addToCart(productId, 1);
        }
        
        // Обработка кнопок увеличения количества
        if (e.target.closest('.qty-btn[data-action="increase"]')) {
          const productId = parseInt(e.target.closest('.qty-btn').getAttribute('data-product-id'));
          changeQty(productId, 1);
        }
        
        // Обработка кнопок уменьшения количества
        if (e.target.closest('.qty-btn[data-action="decrease"]')) {
          const productId = parseInt(e.target.closest('.qty-btn').getAttribute('data-product-id'));
          changeQty(productId, -1);
        }
        
        // Обработка кнопок в корзине
        if (e.target.closest('.qty-btn[data-cart-inc]')) {
          const productId = parseInt(e.target.closest('.qty-btn').getAttribute('data-cart-inc'));
          changeQty(productId, 1);
        }
        
        if (e.target.closest('.qty-btn[data-cart-dec]')) {
          const productId = parseInt(e.target.closest('.qty-btn').getAttribute('data-cart-dec'));
          changeQty(productId, -1);
        }
        
        if (e.target.closest('.qty-btn[data-cart-rem]')) {
          const productId = parseInt(e.target.closest('.qty-btn').getAttribute('data-cart-rem'));
          removeFromCart(productId);
        }
      });
    }

    // Initialize app
    function init(){ 
      // Hide preloader after page load
      setTimeout(() => {
        $('#preloader').classList.add('hidden');
        
        // Animate stats numbers
        setTimeout(() => {
          animateNumber($('#clientsCount'), 12500);
          animateNumber($('#productsCount'), 8500);
          animateNumber($('#yearsCount'), 15);
          animateNumber($('#deliveryCount'), 250);
        }, 500);
      }, 1500);
      
      renderCategories(); 
      renderFilters(); 
      renderProducts(); 
      updateCartUI(); 
      
      // Setup event listeners
      setupEventListeners();
      
      // Add scroll event listeners
      window.addEventListener('scroll', () => {
        toggleScrollToTop();
        toggleHeaderScroll();
      });
    }
    
    // Start the application
    init();