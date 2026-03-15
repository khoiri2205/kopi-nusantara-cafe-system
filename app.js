// =====================================================
// KOPI NUSANTARA — Frontend JavaScript
// =====================================================

const API_BASE = 'http://localhost:3000/api';

// =====================================================
// STATE
// =====================================================
let cart = JSON.parse(localStorage.getItem('kopiCart') || '[]');
let currentCategory = 'all';
let allMenus = [];
let selectedRating = 5;
let selectedPayment = '';

// =====================================================
// INIT
// =====================================================
document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initCounterAnimation();
  initStarRating();
  loadCategories();
  loadMenus();
  loadTestimonials();
  updateCartUI();
});

// =====================================================
// NAVBAR
// =====================================================
function initNavbar() {
  const navbar = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 60);
  });
}

function toggleMenu() {
  const links = document.getElementById('navLinks');
  links.classList.toggle('open');
}

// Close mobile menu on link click
document.querySelectorAll('.nav-links a').forEach(a => {
  a.addEventListener('click', () => {
    document.getElementById('navLinks').classList.remove('open');
  });
});

// =====================================================
// COUNTER ANIMATION
// =====================================================
function initCounterAnimation() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        const nums = e.target.querySelectorAll('.stat-num');
        nums.forEach(el => animateCounter(el));
        observer.unobserve(e.target);
      }
    });
  }, { threshold: 0.5 });

  const stats = document.querySelector('.hero-stats');
  if (stats) observer.observe(stats);
}

function animateCounter(el) {
  const target = parseInt(el.dataset.target);
  const duration = 1800;
  const start = performance.now();
  const update = (time) => {
    const progress = Math.min((time - start) / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.floor(ease * target).toLocaleString('id-ID');
    if (progress < 1) requestAnimationFrame(update);
  };
  requestAnimationFrame(update);
}

// =====================================================
// LOAD CATEGORIES
// =====================================================
async function loadCategories() {
  try {
    const res = await fetch(`${API_BASE}/menus/categories/all`);
    const data = await res.json();
    if (!data.success) return;

    const tabs = document.getElementById('categoryTabs');
    data.data.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = 'tab-btn';
      btn.dataset.id = cat.id;
      btn.textContent = `${cat.icon} ${cat.name}`;
      btn.addEventListener('click', () => filterMenu(cat.id, btn));
      tabs.appendChild(btn);
    });
  } catch (err) {
    console.warn('Gagal load kategori:', err.message);
  }
}

// =====================================================
// LOAD MENUS
// =====================================================
async function loadMenus() {
  const grid = document.getElementById('menuGrid');
  grid.innerHTML = `<div class="menu-loading"><div class="spinner"></div><p>Memuat menu...</p></div>`;

  try {
    const res = await fetch(`${API_BASE}/menus`);
    const data = await res.json();
    if (!data.success) throw new Error(data.message);
    allMenus = data.data;
    renderMenus(allMenus);
  } catch (err) {
    grid.innerHTML = `
      <div class="menu-loading">
        <p>⚠️ Gagal memuat menu.<br/>Pastikan server backend berjalan.</p>
        <small style="opacity:0.5">${err.message}</small>
      </div>`;
    // Show demo data when API is offline
    renderDemoMenus();
  }
}

function renderDemoMenus() {
  const demo = [
    { id:1, name:'Cappuccino', description:'Espresso, steamed milk, dan foam yang sempurna', price:28000, category_name:'Kopi Panas', category_icon:'☕', is_available:true, is_featured:true },
    { id:2, name:'Cold Brew', description:'Kopi cold brew 12 jam, smooth dan manis alami', price:32000, category_name:'Kopi Dingin', category_icon:'🧊', is_available:true, is_featured:true },
    { id:3, name:'Es Kopi Susu', description:'Kopi susu khas dengan gula aren', price:25000, category_name:'Kopi Dingin', category_icon:'🧊', is_available:true, is_featured:true },
    { id:4, name:'V60 Pour Over', description:'Manual brew dengan biji pilihan, aroma buah-buahan', price:35000, category_name:'Kopi Panas', category_icon:'☕', is_available:true, is_featured:true },
    { id:5, name:'Latte', description:'Espresso lembut dengan susu creamy', price:30000, category_name:'Kopi Panas', category_icon:'☕', is_available:true, is_featured:false },
    { id:6, name:'Avocado Toast', description:'Roti gandum dengan topping avokad segar', price:35000, category_name:'Makanan', category_icon:'🍰', is_available:true, is_featured:true },
  ];
  allMenus = demo;
  renderMenus(demo);
}

function renderMenus(menus) {
  const grid = document.getElementById('menuGrid');
  if (!menus || menus.length === 0) {
    grid.innerHTML = `<div class="menu-loading"><p>Tidak ada menu tersedia.</p></div>`;
    return;
  }

  const emojiMap = { 'Kopi Panas':'☕', 'Kopi Dingin':'🧊', 'Non-Kopi':'🍵', 'Makanan':'🥐', 'default':'🍽️' };

  grid.innerHTML = menus.map(m => {
    const emoji = emojiMap[m.category_name] || m.category_icon || emojiMap.default;
    return `
    <div class="menu-card" onclick="void(0)">
      <div class="menu-card-img">
        <span style="font-size:4.5rem">${emoji}</span>
        ${m.is_featured ? `<span class="menu-badge">⭐ Favorit</span>` : ''}
        ${!m.is_available ? `<div class="menu-unavailable-badge">Tidak Tersedia</div>` : ''}
      </div>
      <div class="menu-card-body">
        <div class="menu-cat-tag">${m.category_icon || ''} ${m.category_name || ''}</div>
        <div class="menu-name">${m.name}</div>
        <div class="menu-desc">${m.description || ''}</div>
        <div class="menu-footer">
          <span class="menu-price">Rp ${Number(m.price).toLocaleString('id-ID')}</span>
          <button class="add-btn" ${!m.is_available ? 'disabled' : ''} onclick="addToCart(${m.id})" title="Tambah ke keranjang">+</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function filterMenu(categoryId, btn) {
  currentCategory = categoryId;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  const filtered = categoryId === 'all'
    ? allMenus
    : allMenus.filter(m => String(m.category_id) === String(categoryId));

  renderMenus(filtered);
}

// =====================================================
// CART
// =====================================================
function addToCart(menuId) {
  const menu = allMenus.find(m => m.id === menuId);
  if (!menu) return;

  const existing = cart.find(i => i.id === menuId);
  if (existing) {
    existing.qty++;
  } else {
    cart.push({ id: menu.id, name: menu.name, price: Number(menu.price), qty: 1 });
  }

  saveCart();
  updateCartUI();
  renderCartSection();
  showToast(`✅ ${menu.name} ditambahkan ke keranjang`);
}

function changeQty(menuId, delta) {
  const idx = cart.findIndex(i => i.id === menuId);
  if (idx === -1) return;
  cart[idx].qty += delta;
  if (cart[idx].qty <= 0) cart.splice(idx, 1);
  saveCart();
  updateCartUI();
  renderCartSection();
  renderSidebarItems();
}

function saveCart() {
  localStorage.setItem('kopiCart', JSON.stringify(cart));
}

function updateCartUI() {
  const total = cart.reduce((s, i) => s + i.qty, 0);
  document.getElementById('cartCount').textContent = total;
  renderCartSection();
  renderSidebarItems();
}

function renderCartSection() {
  const container = document.getElementById('cartItems');
  const totalWrap = document.getElementById('cartTotal');

  if (!container) return;

  if (cart.length === 0) {
    container.innerHTML = `
      <div class="cart-empty">
        <span>☕</span>
        <p>Belum ada item di keranjang.<br />Pilih menu favoritmu!</p>
      </div>`;
    if (totalWrap) totalWrap.style.display = 'none';
    return;
  }

  container.innerHTML = cart.map(item => `
    <div class="cart-item">
      <div class="cart-item-name">${item.name}</div>
      <button class="cart-qty-btn" onclick="changeQty(${item.id}, -1)">−</button>
      <span class="cart-qty">${item.qty}</span>
      <button class="cart-qty-btn" onclick="changeQty(${item.id}, 1)">+</button>
      <div class="cart-item-price">Rp ${(item.price * item.qty).toLocaleString('id-ID')}</div>
    </div>
  `).join('');

  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const tax = Math.round(subtotal * 0.1);
  const grand = subtotal + tax;

  if (totalWrap) {
    totalWrap.style.display = 'flex';
    document.getElementById('subtotalVal').textContent = `Rp ${subtotal.toLocaleString('id-ID')}`;
    document.getElementById('taxVal').textContent = `Rp ${tax.toLocaleString('id-ID')}`;
    document.getElementById('grandTotalVal').textContent = `Rp ${grand.toLocaleString('id-ID')}`;
  }
}

function renderSidebarItems() {
  const container = document.getElementById('sidebarItems');
  const totalEl = document.getElementById('sidebarTotal');
  if (!container) return;

  if (cart.length === 0) {
    container.innerHTML = `<div class="cart-empty" style="min-height:200px"><span>☕</span><p>Keranjang kosong</p></div>`;
    if (totalEl) totalEl.textContent = 'Rp 0';
    return;
  }

  container.innerHTML = cart.map(item => `
    <div class="sidebar-item">
      <div class="sidebar-item-name">${item.name}</div>
      <button class="sidebar-qty-btn" onclick="changeQty(${item.id}, -1)">−</button>
      <span class="sidebar-qty">${item.qty}</span>
      <button class="sidebar-qty-btn" onclick="changeQty(${item.id}, 1)">+</button>
      <div class="sidebar-item-price">Rp ${(item.price * item.qty).toLocaleString('id-ID')}</div>
    </div>
  `).join('');

  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  if (totalEl) totalEl.textContent = `Rp ${total.toLocaleString('id-ID')}`;
}

// =====================================================
// CART TOGGLE
// =====================================================
function toggleCart() {
  const sidebar = document.getElementById('cartSidebar');
  const overlay = document.getElementById('cartOverlay');
  sidebar.classList.toggle('open');
  overlay.classList.toggle('open');
  renderSidebarItems();
}

// =====================================================
// PAYMENT METHOD
// =====================================================
function selectPayment(method) {
  selectedPayment = method;
  document.getElementById('paymentMethod').value = method;

  // Update UI options
  document.querySelectorAll('.payment-option').forEach(el => {
    el.classList.toggle('selected', el.dataset.method === method);
  });

  // Show/hide detail panels
  document.getElementById('qrisDetail').style.display = method === 'qris' ? 'block' : 'none';
  document.getElementById('cardDetail').style.display = method === 'card' ? 'block' : 'none';
}

// Helper reset semua field form pesanan
function resetOrderForm() {
  document.getElementById('customerName').value = '';
  document.getElementById('tableNumber').value = '';
  document.getElementById('orderNote').value = '';
  // Reset payment
  selectedPayment = '';
  document.getElementById('paymentMethod').value = '';
  document.querySelectorAll('.payment-option').forEach(el => el.classList.remove('selected'));
  document.getElementById('qrisDetail').style.display = 'none';
  document.getElementById('cardDetail').style.display = 'none';
  if (document.getElementById('transferProof')) document.getElementById('transferProof').value = '';
}

// =====================================================
// SUBMIT ORDER
// =====================================================
async function submitOrder() {
  const name = document.getElementById('customerName').value.trim();
  const table = document.getElementById('tableNumber').value.trim();
  const note = document.getElementById('orderNote').value.trim();
  const btn = document.getElementById('submitOrderBtn');

  if (!name) { showToast('⚠️ Masukkan nama kamu dulu!'); return; }
  if (cart.length === 0) { showToast('⚠️ Keranjang kosong! Pilih menu dulu.'); return; }
  if (!selectedPayment) { showToast('⚠️ Pilih metode pembayaran dulu!'); return; }

  const subtotalForDemo = cart.reduce((s,i) => s + i.price * i.qty, 0);
  const payload = {
    customer_name: name,
    table_number: table || null,
    note: note || null,
    payment_method: selectedPayment,
    items: cart.map(i => ({ menu_id: i.id, quantity: i.qty }))
  };

  btn.disabled = true;
  btn.textContent = '⏳ Memproses...';

  try {
    const res = await fetch(`${API_BASE}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.success) {
      cart = [];
      saveCart();
      updateCartUI();
      resetOrderForm();
      showOrderSuccessModal(name, data.data.order_id, data.data.total_amount, selectedPayment || payload.payment_method);
      document.getElementById('modalOverlay').style.display = 'flex';
    } else {
      showToast(`❌ ${data.message}`);
    }
  } catch (err) {
    // Demo mode: simulate success
    cart = [];
    saveCart();
    updateCartUI();
    showOrderSuccessModal(name, Math.floor(Math.random()*9000)+1000, subtotalForDemo, selectedPayment);
    resetOrderForm();
    document.getElementById('modalOverlay').style.display = 'flex';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Buat Pesanan ☕';
  }
}


// =====================================================
// ORDER SUCCESS MODAL
// =====================================================
const paymentMeta = {
  cash: {
    icon: '💵',
    label: 'Tunai (Cash)',
    detail: 'Silakan bayar ke kasir dengan menunjukkan nomor pesanan kamu. Kasir akan konfirmasi setelah menerima pembayaran.'
  },
  qris: {
    icon: '📱',
    label: 'QRIS / Transfer Bank',
    detail: 'Tunjukkan bukti transfer ke kasir atau barista. Pesanan akan diproses setelah pembayaran dikonfirmasi.'
  },
  card: {
    icon: '💳',
    label: 'Kartu Kredit / Debit',
    detail: 'Menuju mesin EDC di kasir dan tunjukkan nomor pesanan kamu. Kasir akan membantu proses pembayaran.'
  }
};

function showOrderSuccessModal(name, orderId, totalAmount, method) {
  const meta = paymentMeta[method] || paymentMeta.cash;
  const tax = Math.round(totalAmount * 0.1);
  const grand = totalAmount + tax;

  document.getElementById('modalIcon').textContent = '🎉';
  document.getElementById('modalTitle').textContent = 'Pesanan Berhasil!';
  document.getElementById('modalMessage').textContent =
    `Halo ${name}! Pesananmu senilai Rp ${grand.toLocaleString('id-ID')} sedang diproses barista kami.`;

  // Payment info
  const payInfo = document.getElementById('modalPaymentInfo');
  payInfo.style.display = 'block';
  document.getElementById('modalPaymentBadge').innerHTML = `${meta.icon} ${meta.label}`;
  document.getElementById('modalPaymentDetail').textContent = meta.detail;

  // Order ID
  const orderIdEl = document.getElementById('modalOrderId');
  orderIdEl.style.display = 'flex';
  document.getElementById('modalOrderNum').textContent = `#${String(orderId).padStart(4,'0')}`;
}

function closeModal() {
  document.getElementById('modalOverlay').style.display = 'none';
}

// =====================================================
// TESTIMONIALS
// =====================================================
async function loadTestimonials() {
  const grid = document.getElementById('testimonialGrid');

  try {
    const res = await fetch(`${API_BASE}/testimonials`);
    const data = await res.json();
    if (!data.success || data.data.length === 0) throw new Error('no data');
    renderTestimonials(data.data);
  } catch {
    // Demo testimonials
    renderTestimonials([
      { customer_name:'Rina S.', rating:5, message:'Kopinya enak banget, tempatnya nyaman buat kerja. V60 nya jadi favorit saya!', created_at: new Date() },
      { customer_name:'Budi H.', rating:5, message:'Cold brew terbaik yang pernah saya minum. Pasti balik lagi!', created_at: new Date() },
      { customer_name:'Dian P.', rating:4, message:'Suasananya cozy, cocok buat ngobrol sama teman. Menu makanannya juga recommended.', created_at: new Date() },
      { customer_name:'Andi M.', rating:5, message:'Es kopi susunya beda dari tempat lain, gula arennya pas banget.', created_at: new Date() },
    ]);
  }
}

function renderTestimonials(data) {
  const grid = document.getElementById('testimonialGrid');
  const avatars = ['👨','👩','🧑','👴','👵','🧔'];
  grid.innerHTML = data.map((t, i) => `
    <div class="testimonial-card">
      <div class="test-stars">${'★'.repeat(t.rating)}${'☆'.repeat(5 - t.rating)}</div>
      <div class="test-message">"${t.message}"</div>
      <div class="test-author">
        <div class="test-avatar">${avatars[i % avatars.length]}</div>
        <div>
          <div class="test-name">${t.customer_name}</div>
          <div class="test-date">${new Date(t.created_at).toLocaleDateString('id-ID', { year:'numeric', month:'long' })}</div>
        </div>
      </div>
    </div>`).join('');
}

// =====================================================
// STAR RATING
// =====================================================
function initStarRating() {
  const stars = document.querySelectorAll('#starRating .star');
  stars.forEach(star => {
    star.addEventListener('click', () => {
      selectedRating = parseInt(star.dataset.val);
      document.getElementById('ratingVal').value = selectedRating;
      stars.forEach((s, idx) => s.classList.toggle('active', idx < selectedRating));
    });
    star.addEventListener('mouseover', () => {
      const val = parseInt(star.dataset.val);
      stars.forEach((s, idx) => s.classList.toggle('active', idx < val));
    });
  });

  document.getElementById('starRating').addEventListener('mouseleave', () => {
    stars.forEach((s, idx) => s.classList.toggle('active', idx < selectedRating));
  });

  // Set default 5 stars
  stars.forEach((s, idx) => s.classList.toggle('active', idx < 5));
}

async function submitTestimonial() {
  const name = document.getElementById('testName').value.trim();
  const message = document.getElementById('testMessage').value.trim();
  const rating = parseInt(document.getElementById('ratingVal').value);

  if (!name || !message) { showToast('⚠️ Nama dan ulasan wajib diisi!'); return; }

  try {
    const res = await fetch(`${API_BASE}/testimonials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_name: name, rating, message })
    });
    const data = await res.json();
    if (data.success) {
      showToast('🎉 ' + data.message);
      document.getElementById('testName').value = '';
      document.getElementById('testMessage').value = '';
    } else {
      showToast(`❌ ${data.message}`);
    }
  } catch {
    showToast('🎉 Terima kasih! Ulasan kamu sedang direview tim kami.');
    document.getElementById('testName').value = '';
    document.getElementById('testMessage').value = '';
  }
}

// =====================================================
// TOAST NOTIFICATION
// =====================================================
let toastTimer;
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}

// =====================================================
// SCROLL ANIMATION (Intersection Observer)
// =====================================================
const fadeObserver = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.style.opacity = '1';
      e.target.style.transform = 'translateY(0)';
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.about-card, .contact-card').forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(30px)';
  el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
  fadeObserver.observe(el);
});