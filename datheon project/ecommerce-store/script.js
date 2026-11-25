const API_URL = "https://fakestoreapi.com/products";
const TAX_RATE = 0.075;
const SHIPPING_FEE = 5;
const FREE_SHIPPING_THRESHOLD = 100;
const CART_STORAGE_KEY = "forma-store-cart-v1";

const productGrid = document.querySelector("#productGrid");
const searchInput = document.querySelector("#searchInput");
const sortSelect = document.querySelector("#sortSelect");
const resultCount = document.querySelector("#resultCount");
const emptyState = document.querySelector("#emptyState");
const errorState = document.querySelector("#errorState");
const cartDrawer = document.querySelector("#cartDrawer");
const drawerBackdrop = document.querySelector("#drawerBackdrop");
const cartItems = document.querySelector("#cartItems");
const cartSummary = document.querySelector("#cartSummary");
const toast = document.querySelector("#toast");

let products = [];
let activeCategory = "all";
let cart = loadCart();
let toastTimer;

function loadCart() {
  try {
    const saved = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || "[]");
    return Array.isArray(saved) ? saved.filter(item => item && Number.isInteger(item.id) && Number.isInteger(item.quantity) && item.quantity > 0) : [];
  } catch {
    return [];
  }
}

function saveCart() {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
}

function formatMoney(amount) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

function getCategoryGroup(category) {
  if (category === "electronics") return "electronics";
  if (category === "jewelery") return "jewelery";
  return "clothing";
}

function categoryLabel(category) {
  return category === "jewelery" ? "Jewelry" : category.charAt(0).toUpperCase() + category.slice(1);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2300);
}

async function fetchProducts() {
  productGrid.innerHTML = '<div class="loading-state"><div class="loader"></div><p>Finding the good things...</p></div>';
  errorState.classList.add("hidden");
  emptyState.classList.add("hidden");
  try {
    const response = await fetch(API_URL);
    if (!response.ok) throw new Error(`Request failed: ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error("Unexpected product data");
    products = data;
    renderProducts();
  } catch (error) {
    console.error("Could not load products:", error);
    productGrid.innerHTML = "";
    resultCount.textContent = "Collection unavailable";
    errorState.classList.remove("hidden");
  }
}

function getFilteredProducts() {
  const term = searchInput.value.trim().toLowerCase();
  let filtered = products.filter(product => {
    const matchesCategory = activeCategory === "all" || getCategoryGroup(product.category) === activeCategory;
    const matchesSearch = product.title.toLowerCase().includes(term) || product.category.toLowerCase().includes(term) || product.description.toLowerCase().includes(term);
    return matchesCategory && matchesSearch;
  });
  const sort = sortSelect.value;
  if (sort === "price-low") filtered.sort((a, b) => a.price - b.price);
  if (sort === "price-high") filtered.sort((a, b) => b.price - a.price);
  if (sort === "rating") filtered.sort((a, b) => b.rating.rate - a.rating.rate);
  return filtered;
}

function renderProducts() {
  const filtered = getFilteredProducts();
  productGrid.innerHTML = "";
  resultCount.textContent = `${filtered.length} ${filtered.length === 1 ? "ITEM" : "ITEMS"} TO DISCOVER`;
  emptyState.classList.toggle("hidden", filtered.length !== 0);
  if (!filtered.length) return;

  const fragment = document.createDocumentFragment();
  filtered.forEach((product, index) => {
    const card = document.createElement("article");
    card.className = "product-card";
    const badge = product.rating.rate >= 4.5 ? "Top rated" : index < 3 ? "The edit" : "Everyday pick";
    const category = getCategoryGroup(product.category);
    const image = document.createElement("img");
    image.src = product.image;
    image.alt = product.title;
    image.loading = "lazy";
    image.onerror = () => { image.style.opacity = "0"; };
    card.innerHTML = `
      <div class="product-image-wrap">
        <span class="product-badge">${badge}</span>
        <button class="quick-add" type="button" data-add="${product.id}">Add to bag +</button>
      </div>
      <div class="product-info">
        <div class="product-category">${categoryLabel(category)}</div>
        <h3 class="product-title">${escapeHTML(product.title)}</h3>
        <div class="product-meta">
          <span class="product-price">${formatMoney(product.price)}</span>
          <span class="product-rating"><span>★</span>${Number(product.rating.rate).toFixed(1)} (${product.rating.count})</span>
        </div>
      </div>`;
    card.querySelector(".product-image-wrap").prepend(image);
    fragment.appendChild(card);
  });
  productGrid.appendChild(fragment);
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}

function addToCart(productId) {
  const product = products.find(item => item.id === productId);
  if (!product) return;
  const existing = cart.find(item => item.id === productId);
  if (existing) existing.quantity += 1;
  else cart.push({ id: productId, quantity: 1 });
  saveCart();
  renderCart();
  showToast("Added to your bag");
}

function updateQuantity(productId, change) {
  const item = cart.find(entry => entry.id === productId);
  if (!item) return;
  item.quantity += change;
  if (item.quantity <= 0) cart = cart.filter(entry => entry.id !== productId);
  saveCart();
  renderCart();
}

function removeFromCart(productId) {
  cart = cart.filter(item => item.id !== productId);
  saveCart();
  renderCart();
  showToast("Item removed from your bag");
}

function calculateTotals() {
  const subtotal = cart.reduce((sum, item) => {
    const product = products.find(entry => entry.id === item.id);
    return sum + (product ? product.price * item.quantity : 0);
  }, 0);
  const tax = subtotal * TAX_RATE;
  const shipping = subtotal === 0 || subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
  return { subtotal, tax, shipping, total: subtotal + tax + shipping };
}

function renderCart() {
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  document.querySelector("#cartCount").textContent = itemCount;
  document.querySelector("#drawerItemCount").textContent = `(${itemCount})`;
  cartItems.innerHTML = "";

  const availableItems = cart.map(item => ({ ...item, product: products.find(product => product.id === item.id) })).filter(item => item.product);
  if (!availableItems.length) {
    cartItems.innerHTML = '<div class="cart-empty"><span>♧</span><h3>Your bag is waiting.</h3><p>Find something lovely to add to it.</p><button class="text-button" id="continueShopping">Explore products ↗</button></div>';
    cartSummary.classList.add("hidden");
    return;
  }

  availableItems.forEach(({ id, quantity, product }) => {
    const row = document.createElement("div");
    row.className = "cart-item";
    row.innerHTML = `
      <img src="${escapeHTML(product.image)}" alt="${escapeHTML(product.title)}">
      <div>
        <p class="cart-item-title">${escapeHTML(product.title)}</p>
        <span class="cart-item-price">${formatMoney(product.price)}</span>
        <div class="quantity-control">
          <button type="button" data-quantity="${id}" data-change="-1" aria-label="Decrease quantity">−</button>
          <span>${quantity}</span>
          <button type="button" data-quantity="${id}" data-change="1" aria-label="Increase quantity">+</button>
        </div>
        <button type="button" class="remove-item" data-remove="${id}">Remove</button>
      </div>
      <strong class="cart-item-price">${formatMoney(product.price * quantity)}</strong>`;
    cartItems.appendChild(row);
  });

  cartSummary.classList.remove("hidden");
  const totals = calculateTotals();
  document.querySelector("#subtotal").textContent = formatMoney(totals.subtotal);
  document.querySelector("#tax").textContent = formatMoney(totals.tax);
  document.querySelector("#shipping").textContent = totals.shipping === 0 ? "Free" : formatMoney(totals.shipping);
  document.querySelector("#grandTotal").textContent = formatMoney(totals.total);
  document.querySelector("#checkoutTotal").textContent = formatMoney(totals.total);
  document.querySelector("#shippingNote").textContent = totals.subtotal >= FREE_SHIPPING_THRESHOLD
    ? "You've unlocked free shipping."
    : `Add ${formatMoney(FREE_SHIPPING_THRESHOLD - totals.subtotal)} more for free shipping.`;
}

function openCart() {
  cartDrawer.classList.add("open");
  drawerBackdrop.classList.add("open");
  cartDrawer.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}
function closeCart() {
  cartDrawer.classList.remove("open");
  drawerBackdrop.classList.remove("open");
  cartDrawer.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}
function openCheckout() {
  if (!cart.length) return;
  closeCart();
  document.querySelector("#checkoutFormView").classList.remove("hidden");
  document.querySelector("#successView").classList.add("hidden");
  document.querySelector("#checkoutBackdrop").classList.add("open");
  document.body.style.overflow = "hidden";
}
function closeCheckout() {
  document.querySelector("#checkoutBackdrop").classList.remove("open");
  document.body.style.overflow = "";
}

document.querySelector("#categoryFilters").addEventListener("click", event => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  activeCategory = button.dataset.category;
  document.querySelectorAll(".filter-button").forEach(item => item.classList.toggle("active", item === button));
  renderProducts();
});
document.querySelectorAll("[data-nav-category]").forEach(link => link.addEventListener("click", () => {
  activeCategory = link.dataset.navCategory;
  document.querySelectorAll(".filter-button").forEach(item => item.classList.toggle("active", item.dataset.category === activeCategory));
  renderProducts();
}));
searchInput.addEventListener("input", renderProducts);
sortSelect.addEventListener("change", renderProducts);
productGrid.addEventListener("click", event => {
  const button = event.target.closest("[data-add]");
  if (button) addToCart(Number(button.dataset.add));
});
cartItems.addEventListener("click", event => {
  const quantityButton = event.target.closest("[data-quantity]");
  const removeButton = event.target.closest("[data-remove]");
  const continueButton = event.target.closest("#continueShopping");
  if (quantityButton) updateQuantity(Number(quantityButton.dataset.quantity), Number(quantityButton.dataset.change));
  if (removeButton) removeFromCart(Number(removeButton.dataset.remove));
  if (continueButton) closeCart();
});
document.querySelector("#openCart").addEventListener("click", openCart);
document.querySelector("#closeCart").addEventListener("click", closeCart);
drawerBackdrop.addEventListener("click", closeCart);
document.querySelector("#continueShopping")?.addEventListener("click", closeCart);
document.querySelector("#checkoutButton").addEventListener("click", openCheckout);
document.querySelector("#closeCheckout").addEventListener("click", closeCheckout);
document.querySelector("#checkoutBackdrop").addEventListener("click", event => {
  if (event.target.id === "checkoutBackdrop") closeCheckout();
});
document.querySelector("#checkoutForm").addEventListener("submit", event => {
  event.preventDefault();
  if (!event.currentTarget.reportValidity()) return;
  const formData = new FormData(event.currentTarget);
  const firstName = String(formData.get("name")).trim().split(/\s+/)[0];
  const orderNumber = `FM-${Date.now().toString().slice(-6)}`;
  document.querySelector("#successMessage").textContent = `Thank you, ${firstName}! Your demo order ${orderNumber} has been confirmed. This is a local demonstration; no payment or delivery has been arranged.`;
  document.querySelector("#checkoutFormView").classList.add("hidden");
  document.querySelector("#successView").classList.remove("hidden");
  cart = [];
  saveCart();
  renderCart();
  event.currentTarget.reset();
});
document.querySelector("#finishOrder").addEventListener("click", () => {
  closeCheckout();
  showToast("Thanks for exploring Forma!");
});
document.querySelector("#focusSearch").addEventListener("click", () => {
  document.querySelector("#shop").scrollIntoView({ behavior: "smooth" });
  searchInput.focus({ preventScroll: true });
});
document.querySelector("#menuToggle").addEventListener("click", () => document.querySelector(".main-nav").classList.toggle("open"));
document.querySelector("#clearFilters").addEventListener("click", () => {
  activeCategory = "all";
  searchInput.value = "";
  sortSelect.value = "featured";
  document.querySelectorAll(".filter-button").forEach(item => item.classList.toggle("active", item.dataset.category === "all"));
  renderProducts();
});
document.querySelector("#retryButton").addEventListener("click", fetchProducts);
document.addEventListener("keydown", event => {
  if (event.key === "Escape") { closeCart(); closeCheckout(); }
});

document.querySelector("#year").textContent = new Date().getFullYear();
renderCart();
fetchProducts();
