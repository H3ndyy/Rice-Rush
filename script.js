const heroImage = document.getElementById('heroImage');
const dishes = document.querySelectorAll('.dish');
const cartCount = document.querySelector('.cart-count');
const addToCartButtons = document.querySelectorAll('.add-to-cart');
const hamburger = document.getElementById('hamburger');
const nav = document.getElementById('nav');
const navLinks = document.querySelectorAll('.nav-link');
const contactForm = document.getElementById('contactForm');
const formNote = document.getElementById('formNote');
const accountModal = document.getElementById('accountModal');
const cartModal = document.getElementById('cartModal');
const accountForm = document.getElementById('accountForm');
const accountMessage = document.getElementById('accountMessage');
const accountTitle = document.getElementById('accountModalTitle');
const accountIntro = document.getElementById('accountModalIntro');
const accountNameGroup = document.getElementById('accountNameGroup');
const accountPassword = document.getElementById('accountPassword');
const accountSubmit = document.getElementById('accountSubmit');
const accountSwitchText = document.getElementById('accountSwitchText');
const cartItems = document.getElementById('cartItems');
const cartTotal = document.getElementById('cartTotal');
const cartMessage = document.getElementById('cartMessage');
let cart = [];
let accountMode = 'signup';
let signedInUser = null;

const rupiah = value => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);

window.addEventListener('load', () => {
  if (heroImage) heroImage.classList.add('spin');
  const year = document.getElementById('currentYear');
  if (year) year.textContent = new Date().getFullYear();
  updateCart();
  restoreSession();
});

dishes.forEach(dish => {
  dish.addEventListener('click', event => {
    if (event.target.closest('.add-to-cart')) return;
    const newImageSrc = dish.getAttribute('data-img');
    if (!heroImage || !newImageSrc) return;
    heroImage.classList.remove('spin');
    heroImage.src = newImageSrc;
    void heroImage.offsetWidth;
    heroImage.classList.add('spin');
  });
});

addToCartButtons.forEach(button => {
  button.addEventListener('click', event => {
    event.stopPropagation();
    const name = button.dataset.name;
    const price = Number(button.dataset.price);
    const existing = cart.find(item => item.name === name);
    if (existing) existing.quantity += 1;
    else cart.push({ name, price, quantity: 1 });
    updateCart();
    button.innerHTML = '<i class="fas fa-check"></i>';
    window.setTimeout(() => { button.innerHTML = '<i class="fas fa-plus"></i>'; }, 800);
  });
});

function updateCart() {
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  if (cartCount) cartCount.textContent = count;
  if (!cartItems || !cartTotal) return;
  if (cart.length === 0) {
    cartItems.innerHTML = '<p class="empty-cart"><i class="fas fa-basket-shopping"></i><br>Keranjang masih kosong.<br>Yuk, pilih menu favoritmu!</p>';
  } else {
    cartItems.innerHTML = cart.map((item, index) => `
      <div class="cart-row">
        <div class="cart-item-info"><strong>${escapeHTML(item.name)}</strong><span>${rupiah(item.price)} / item</span></div>
        <div class="quantity-controls">
          <button type="button" data-cart-action="minus" data-index="${index}" aria-label="Kurangi ${escapeHTML(item.name)}">−</button>
          <span>${item.quantity}</span>
          <button type="button" data-cart-action="plus" data-index="${index}" aria-label="Tambah ${escapeHTML(item.name)}">+</button>
          <button type="button" class="remove-item" data-cart-action="remove" data-index="${index}" aria-label="Hapus ${escapeHTML(item.name)}"><i class="fas fa-trash"></i></button>
        </div>
      </div>`).join('');
  }
  cartTotal.textContent = rupiah(cart.reduce((sum, item) => sum + item.price * item.quantity, 0));
  const checkoutBtn = document.getElementById('checkoutBtn');
  if (checkoutBtn) checkoutBtn.disabled = cart.length === 0;
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

cartItems?.addEventListener('click', event => {
  const button = event.target.closest('[data-cart-action]');
  if (!button) return;
  const index = Number(button.dataset.index);
  const item = cart[index];
  if (!item) return;
  if (button.dataset.cartAction === 'plus') item.quantity += 1;
  if (button.dataset.cartAction === 'minus') item.quantity -= 1;
  if (button.dataset.cartAction === 'remove' || item.quantity <= 0) cart.splice(index, 1);
  cartMessage.textContent = '';
  updateCart();
});

function openModal(modal) {
  if (!modal) return;
  modal.hidden = false;
  document.body.classList.add('modal-open');
  modal.querySelector('input, button')?.focus();
}
function closeModal(modal) {
  if (modal) modal.hidden = true;
  if (accountModal.hidden && cartModal.hidden) document.body.classList.remove('modal-open');
}

document.getElementById('signUpBtn')?.addEventListener('click', () => { setAccountMode('signup'); openModal(accountModal); });
document.getElementById('signInBtn')?.addEventListener('click', async () => {
  if (signedInUser) {
    try { await apiRequest('/api/auth/logout', { method: 'POST', body: '{}' }); setSignedInUser(null); accountMessage.textContent = ''; }
    catch (error) { window.alert(error.message); }
    return;
  }
  setAccountMode('signin'); openModal(accountModal);
});
document.getElementById('cartBtn')?.addEventListener('click', () => { updateCart(); cartMessage.textContent = ''; openModal(cartModal); });
document.querySelectorAll('[data-close-modal]').forEach(button => button.addEventListener('click', () => closeModal(button.closest('.modal-backdrop'))));
[accountModal, cartModal].forEach(modal => modal?.addEventListener('click', event => { if (event.target === modal) closeModal(modal); }));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') { closeModal(accountModal); closeModal(cartModal); }
});

document.getElementById('switchAccountMode')?.addEventListener('click', () => setAccountMode(accountMode === 'signup' ? 'signin' : 'signup'));
function setAccountMode(mode) {
  accountMode = mode;
  const signup = mode === 'signup';
  accountTitle.textContent = signup ? 'Sign Up' : 'Sign In';
  accountIntro.textContent = signup ? 'Buat akun demo Rice Rush.' : 'Masuk ke akun demo Rice Rush.';
  accountNameGroup.hidden = !signup;
  document.getElementById('accountName').required = signup;
  accountPassword.autocomplete = signup ? 'new-password' : 'current-password';
  accountPassword.placeholder = signup ? 'Minimal 6 karakter' : 'Masukkan password';
  accountSubmit.textContent = signup ? 'Buat Akun' : 'Masuk';
  accountSwitchText.innerHTML = signup ? 'Sudah punya akun? <button type="button" id="switchAccountMode">Sign In</button>' : 'Belum punya akun? <button type="button" id="switchAccountMode">Sign Up</button>';
  document.getElementById('switchAccountMode').addEventListener('click', () => setAccountMode(accountMode === 'signup' ? 'signin' : 'signup'));
  accountMessage.textContent = '';
  accountForm.reset();
}

async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Permintaan gagal. Coba lagi.');
  return data;
}

function setSignedInUser(user) {
  signedInUser = user || null;
  const signInBtn = document.getElementById('signInBtn');
  if (signInBtn) signInBtn.textContent = signedInUser ? `${signedInUser.name.split(' ')[0]} (Keluar)` : 'Sign In';
  const signUpBtn = document.getElementById('signUpBtn');
  if (signUpBtn) signUpBtn.hidden = Boolean(signedInUser);
}

async function restoreSession() {
  try {
    const data = await apiRequest('/api/auth/me', { method: 'GET', headers: {} });
    setSignedInUser(data.user);
  } catch (_error) {
    setSignedInUser(null);
  }
}

accountForm?.addEventListener('submit', async event => {
  event.preventDefault();
  const name = document.getElementById('accountName').value.trim();
  const email = document.getElementById('accountEmail').value.trim().toLowerCase();
  const password = accountPassword.value;
  if (accountMode === 'signup' && password.length < 8) {
    accountMessage.textContent = 'Password minimal 8 karakter.';
    return;
  }
  accountSubmit.disabled = true;
  accountMessage.textContent = 'Memproses...';
  try {
    const data = await apiRequest(accountMode === 'signup' ? '/api/auth/signup' : '/api/auth/signin', {
      method: 'POST', body: JSON.stringify({ name, email, password }),
    });
    setSignedInUser(data.user);
    accountMessage.textContent = `${data.message} Selamat datang, ${data.user.name}!`;
    accountForm.reset();
    window.setTimeout(() => closeModal(accountModal), 1000);
  } catch (error) {
    accountMessage.textContent = error.message;
  } finally {
    accountSubmit.disabled = false;
  }
});

document.getElementById('checkoutBtn')?.addEventListener('click', async () => {
  if (cart.length === 0) return;
  if (!signedInUser) {
    cartMessage.textContent = 'Silakan Sign In sebelum checkout.';
    closeModal(cartModal);
    setAccountMode('signin');
    openModal(accountModal);
    return;
  }
  const checkoutBtn = document.getElementById('checkoutBtn');
  checkoutBtn.disabled = true;
  cartMessage.textContent = 'Menyimpan pesanan...';
  try {
    const data = await apiRequest('/api/orders', {
      method: 'POST',
      body: JSON.stringify({ items: cart.map(({ name, quantity }) => ({ name, quantity })) }),
    });
    cartMessage.textContent = `Pesanan #${data.order.id} berhasil disimpan. Total ${rupiah(data.order.total)}. Pembayaran belum diproses.`;
    cart = [];
    updateCart();
  } catch (error) {
    cartMessage.textContent = error.message;
    if (error.message.toLowerCase().includes('sign in')) {
      closeModal(cartModal); setAccountMode('signin'); openModal(accountModal);
    }
  } finally {
    checkoutBtn.disabled = cart.length === 0;
  }
});

if (hamburger && nav) {
  hamburger.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('active');
    hamburger.setAttribute('aria-expanded', String(isOpen));
  });
}
navLinks.forEach(link => link.addEventListener('click', () => {
  nav.classList.remove('active');
  if (hamburger) hamburger.setAttribute('aria-expanded', 'false');
  navLinks.forEach(item => item.classList.remove('active'));
  link.classList.add('active');
}));

const pageSections = document.querySelectorAll('#home, #menu, #contact, #about, #gallery');
if ('IntersectionObserver' in window) {
  const sectionObserver = new IntersectionObserver(entries => entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    const activeLink = document.querySelector(`.nav-link[href="#${entry.target.id}"]`);
    if (activeLink) { navLinks.forEach(link => link.classList.remove('active')); activeLink.classList.add('active'); }
  }), { rootMargin: '-25% 0px -60% 0px' });
  pageSections.forEach(section => sectionObserver.observe(section));
}

if (contactForm) contactForm.addEventListener('submit', async event => {
  event.preventDefault();
  const submit = contactForm.querySelector('button[type="submit"], input[type="submit"]');
  if (submit) submit.disabled = true;
  formNote.textContent = 'Mengirim pesan...';
  try {
    const data = await apiRequest('/api/contact', {
      method: 'POST',
      body: JSON.stringify({
        name: document.getElementById('contactName').value.trim(),
        email: document.getElementById('contactEmail').value.trim(),
        message: document.getElementById('contactMessage').value.trim(),
      }),
    });
    formNote.textContent = data.message;
    contactForm.reset();
  } catch (error) {
    formNote.textContent = error.message;
  } finally {
    if (submit) submit.disabled = false;
  }
});
