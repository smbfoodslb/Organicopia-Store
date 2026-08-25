/* Organicopia retail catalog — static, dependency-free. Cart persists in
   localStorage. Checkout opens a pre-filled WhatsApp chat (wa.me) with the
   order — customer taps Send. Pricing is tiered: buy 1, 3, or 6+ and the
   unit price drops at each threshold. */
const WHATSAPP_NUMBER = "96170649386"; // +961 70 649 386, digits only, no leading +
const CART_KEY = "organicopia-cart-v1";
const IMG_BASE = "images/";
const PLACEHOLDER_IMG = "images/placeholder.svg";
let CATALOG = null;
let cart = loadCart();
// ---------------- Cart persistence ----------------
function loadCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}
function saveCart() {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}
function findProduct(num) {
  for (const c of CATALOG.categories) {
    for (const p of c.items) {
      if (p.num === num) return p;
    }
  }
  return null;
}
function isPurchasable(p) {
  return Array.isArray(p.tiers) && p.tiers.length > 0 && (p.status == null || p.status === "active");
}
// Unit price for a given quantity: the price of the highest tier whose
// qty threshold has been reached (tiers are ordered ascending by qty).
function unitPriceForQty(p, qty) {
  if (!isPurchasable(p) || qty <= 0) return null;
  let price = p.tiers[0].price;
  for (const t of p.tiers) {
    if (qty >= t.qty) price = t.price;
  }
  return price;
}
// Index of the tier currently "active" for a given quantity — the same
// tier whose price unitPriceForQty would return — so the UI can ring
// that tier's button instead of hiding the others.
function activeTierIndex(p, qty) {
  let idx = 0;
  p.tiers.forEach((t, i) => {
    if (qty >= t.qty) idx = i;
  });
  return idx;
}
function setQty(num, qty) {
  const p = findProduct(num);
  if (!p) return;
  if (qty <= 0) {
    delete cart[num];
  } else {
    cart[num] = qty;
  }
  saveCart();
  renderCartCount();
  renderCartDrawer();
  updateCardQtyUI(num);
}
function cartTotal() {
  let total = 0;
  let count = 0;
  for (const numStr of Object.keys(cart)) {
    const p = findProduct(Number(numStr));
    if (!p) continue;
    const qty = cart[numStr];
    const unit = unitPriceForQty(p, qty);
    if (unit == null) continue;
    total += unit * qty;
    count += qty;
  }
  return { total, count };
}
// ---------------- Rendering: catalog ----------------
function imgSrc(p) {
  return p.img ? IMG_BASE + p.img : PLACEHOLDER_IMG;
}
function tagHtml(tags) {
  return (tags || []).map((t) => `<span class="card-tag">${escapeHtml(t)}</span>`).join("");
}
function cartControlHtml(p) {
  if (!isPurchasable(p)) {
    if (p.status === "oos") return `<div class="unavailable-note">Out of stock</div>`;
    if (p.status === "soon") return `<div class="unavailable-note">Coming soon</div>`;
    if (p.status === "hold") return `<div class="unavailable-note">Temporarily unavailable</div>`;
    return `<div class="unavailable-note">Pricing to follow</div>`;
  }
  const qty = cart[p.num] || 0;
  const activeIdx = qty > 0 ? activeTierIndex(p, qty) : -1;
  // All three pack-size buttons stay visible and clickable at all times —
  // clicking one sets the cart quantity to that pack size. The active one
  // (based on current quantity, not just an exact match) gets ringed so
  // the customer can still compare all three prices at a glance.
  const tierRow = `<div class="tier-row">${p.tiers
    .map((t, i) => {
      const classes = ["tier-btn"];
      if (i === p.tiers.length - 1) classes.push("tier-best");
      if (i === activeIdx) classes.push("tier-active");
      return `
      <button class="${classes.join(" ")}" data-set-qty="${p.num}" data-qty="${t.qty}">
        <span class="tier-qty">&times;${t.qty}</span>
        <span class="tier-price">$${t.price.toFixed(2)}</span>
      </button>`;
    })
    .join("")}</div>`;
  let qtyPanel = "";
  if (qty > 0) {
    const unit = unitPriceForQty(p, qty);
    const lineTotal = unit * qty;
    const basePrice = p.tiers[0].price;
    const wasTotal = basePrice * qty;
    const savings = wasTotal - lineTotal;
    const showSavings = savings > 0.001;
    qtyPanel = `
      <div class="qty-panel" data-qty-row="${p.num}">
        <div class="qty-stepper" data-stepper="${p.num}">
          <button data-dec="${p.num}" aria-label="Decrease quantity">&minus;</button>
          <span class="qty-num">${qty}</span>
          <button data-inc="${p.num}" aria-label="Increase quantity">+</button>
        </div>
        <div class="qty-price-block">
          <div>
            ${showSavings ? `<span class="was-price">$${wasTotal.toFixed(2)}</span>` : ""}
            <span class="now-price">$${lineTotal.toFixed(2)}</span>
          </div>
          ${showSavings ? `<span class="save-note">You save $${savings.toFixed(2)}</span>` : ""}
        </div>
      </div>`;
  }
  return `<div class="tier-block">${tierRow}${qtyPanel}</div>`;
}
function cardHtml(p) {
  const badges = [];
  if (p.status === "oos") badges.push('<span class="status-badge oos">Out of Stock</span>');
  else if (p.status === "soon") badges.push('<span class="status-badge soon">Coming Soon</span>');
  else if (p.status === "hold") badges.push('<span class="status-badge hold">Temporarily Unavailable</span>');
  if (p.is_new) badges.push('<span class="status-badge new">New</span>');
  let cardCls = "card";
  if (p.status === "oos" || p.status === "hold") cardCls += " is-oos";
  if (p.is_new) cardCls += " badge-new";
  const subHtml = p.sub ? `<div class="card-sub">${escapeHtml(p.sub)}</div>` : "";
  return `
  <div class="${cardCls}" data-product="${p.num}" data-search="${escapeHtml(p.name + " " + (p.sub || "")).toLowerCase()}">
    <div class="card-badge-row">${badges.join("")}</div>
    <div class="card-img"><img src="${imgSrc(p)}" alt="${escapeHtml(p.name)}" loading="lazy" onerror="this.src='${PLACEHOLDER_IMG}'"></div>
    <div class="card-body">
      <div class="card-name">${escapeHtml(p.name)}</div>
      ${subHtml}
      <div class="card-tags">${tagHtml(p.tags)}</div>
      <div data-cart-control>${cartControlHtml(p)}</div>
    </div>
  </div>`;
}
function categoryHtml(cat) {
  const catId = `cat-${slug(cat.title)}`;
  return `
  <div class="category-block" id="${catId}">
    <div class="category-title">
      <h2>${escapeHtml(cat.title)}</h2>
      <span class="desc">${escapeHtml(cat.desc)}</span>
    </div>
    <div class="grid">${cat.items.map(cardHtml).join("")}</div>
  </div>`;
}
function renderCatalog() {
  const root = document.getElementById("catalog");
  const nav = document.getElementById("catNav");
  root.innerHTML = CATALOG.categories.map(categoryHtml).join("");
  nav.innerHTML = CATALOG.categories
    .map((c) => `<a href="#cat-${slug(c.title)}">${escapeHtml(c.title)}</a>`)
    .join("");
}
function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
// ---------------- Cart UI updates ----------------
function updateCardQtyUI(num) {
  const el = document.querySelector(`.card[data-product="${num}"] [data-cart-control]`);
  if (el) {
    const p = findProduct(num);
    el.innerHTML = cartControlHtml(p);
  }
}
function renderCartCount() {
  const { count, total } = cartTotal();
  document.getElementById("cartCount").textContent = count;
  document.getElementById("cartHeaderTotal").textContent = `$${total.toFixed(2)}`;
}
function renderCartDrawer() {
  const itemsEl = document.getElementById("cartItems");
  const nums = Object.keys(cart).filter((n) => cart[n] > 0);
  if (nums.length === 0) {
    itemsEl.innerHTML = `<div class="cart-empty">Your cart is empty.<br>Pick a pack size on any item to add it.</div>`;
  } else {
    itemsEl.innerHTML = nums
      .map((numStr) => {
        const num = Number(numStr);
        const p = findProduct(num);
        const qty = cart[numStr];
        const unit = unitPriceForQty(p, qty);
        const lineTotal = (unit * qty).toFixed(2);
        return `
        <div class="cart-line">
          <div class="cart-line-img"><img src="${imgSrc(p)}" alt="" onerror="this.src='${PLACEHOLDER_IMG}'"></div>
          <div class="cart-line-body">
            <div class="cart-line-name">${escapeHtml(p.name)}</div>
            <div class="cart-line-sub">${p.sub ? escapeHtml(p.sub) + " · " : ""}$${unit.toFixed(2)} each</div>
            <div class="cart-line-controls">
              <div class="qty-stepper" data-stepper="${num}">
                <button data-dec="${num}" aria-label="Decrease quantity">&minus;</button>
                <span class="qty-num">${qty}</span>
                <button data-inc="${num}" aria-label="Increase quantity">+</button>
              </div>
              <span class="cart-line-price">$${lineTotal}</span>
            </div>
            <button class="cart-remove" data-remove="${num}">Remove</button>
          </div>
        </div>`;
      })
      .join("");
  }
  const { total, count } = cartTotal();
  document.getElementById("cartTotal").textContent = `$${total.toFixed(2)}`;
  document.getElementById("checkoutBtn").disabled = count === 0;
}
// ---------------- Cart drawer open/close ----------------
function openCart() {
  document.getElementById("cartDrawer").classList.add("open");
  document.getElementById("cartOverlay").classList.add("open");
}
function closeCart() {
  document.getElementById("cartDrawer").classList.remove("open");
  document.getElementById("cartOverlay").classList.remove("open");
}
// ---------------- WhatsApp checkout ----------------
function buildOrderMessage() {
  const nums = Object.keys(cart).filter((n) => cart[n] > 0);
  const lines = ["Hi Organicopia, I'd like to order:", ""];
  let total = 0;
  nums.forEach((numStr) => {
    const num = Number(numStr);
    const p = findProduct(num);
    const qty = cart[numStr];
    const unit = unitPriceForQty(p, qty);
    const lineTotal = unit * qty;
    total += lineTotal;
    const label = p.sub ? `${p.name} (${p.sub})` : p.name;
    lines.push(`${label} × ${qty} @ $${unit.toFixed(2)} — $${lineTotal.toFixed(2)}`);
  });
  lines.push("");
  lines.push(`Total: $${total.toFixed(2)}`);
  lines.push("");
  lines.push("Please confirm stock and delivery. Thank you!");
  return lines.join("\n");
}
function checkout() {
  const { count } = cartTotal();
  if (count === 0) return;
  const msg = buildOrderMessage();
  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
  window.open(url, "_blank", "noopener");
}
// ---------------- Search ----------------
function applySearch(query) {
  const q = query.trim().toLowerCase();
  document.querySelectorAll(".card").forEach((card) => {
    const match = !q || card.dataset.search.includes(q);
    card.style.display = match ? "" : "none";
  });
  document.querySelectorAll(".category-block").forEach((block) => {
    const anyVisible = Array.from(block.querySelectorAll(".card")).some((c) => c.style.display !== "none");
    block.style.display = anyVisible ? "" : "none";
  });
}
// ---------------- Event wiring ----------------
function wireEvents() {
  document.getElementById("cartToggle").addEventListener("click", openCart);
  document.getElementById("cartClose").addEventListener("click", closeCart);
  document.getElementById("cartOverlay").addEventListener("click", closeCart);
  document.getElementById("checkoutBtn").addEventListener("click", checkout);
  document.getElementById("searchInput").addEventListener("input", (e) => applySearch(e.target.value));
  document.body.addEventListener("click", (e) => {
    const tierBtn = e.target.closest("[data-set-qty]");
    if (tierBtn) {
      const num = Number(tierBtn.dataset.setQty);
      const qty = Number(tierBtn.dataset.qty);
      setQty(num, qty);
      return;
    }
    const incBtn = e.target.closest("[data-inc]");
    if (incBtn) {
      const num = Number(incBtn.dataset.inc);
      setQty(num, (cart[num] || 0) + 1);
      return;
    }
    const decBtn = e.target.closest("[data-dec]");
    if (decBtn) {
      const num = Number(decBtn.dataset.dec);
      setQty(num, (cart[num] || 0) - 1);
      return;
    }
    const removeBtn = e.target.closest("[data-remove]");
    if (removeBtn) {
      const num = Number(removeBtn.dataset.remove);
      setQty(num, 0);
      return;
    }
  });
}
// ---------------- Init ----------------
async function init() {
  const res = await fetch("data/products.json");
  CATALOG = await res.json();
  renderCatalog();
  wireEvents();
  renderCartCount();
  renderCartDrawer();
}
init();
