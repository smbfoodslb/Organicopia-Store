/* Organicopia retail catalog — static, dependency-free. Catalog comes from
data/products.json. Cart persists in localStorage. Checkout opens a pre-filled
WhatsApp chat (wa.me). Pricing is tiered: ×1, ×3, ×6+ and the unit price drops
at each threshold; the card shows the savings versus the ×1 price. */
let CATALOG = null;
const WHATSAPP = "96170649386";
const CART_KEY = "organicopia-cart-v2";
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money = n => "$" + n.toFixed(2);

const PRODUCTS = [], byNum = {};
const purchasable = p => Array.isArray(p.tiers) && p.tiers.length && (p.status == null || p.status === "active");
const isMade = p => p.cat === "Fresh from the Oven" || /ghee/i.test(p.name);
const imgSrc = p => p.img ? "images/" + p.img : "images/placeholder.svg";
const unitPrice = (p, q) => { if (!purchasable(p) || q <= 0) return null; let pr = p.tiers[0].price; p.tiers.forEach(t => { if (q >= t.qty) pr = t.price }); return pr };
const savings = (p, q) => purchasable(p) && q > 0 ? Math.max(0, (p.tiers[0].price - unitPrice(p, q)) * q) : 0;
const saveHtml = (p, q) => savings(p, q) > 0.001 ? `<span class="save">You save ${money(savings(p, q))}</span>` : "";
const activeTier = (p, q) => { let i = -1; p.tiers.forEach((t, k) => { if (q >= t.qty) i = k }); return i };

let cart = {}; try { cart = JSON.parse(localStorage.getItem(CART_KEY) || "{}") } catch (e) { cart = {} }
const saveCart = () => { try { localStorage.setItem(CART_KEY, JSON.stringify(cart)) } catch (e) {} };

let category = "All", query = "", cats = ["All"];

function renderChips() {
  $("chips").innerHTML = cats.map(c => `<button type="button" class="chip ${c === category ? "active" : ""}" data-cat="${esc(c)}" role="tab" aria-selected="${c === category}">${esc(c)}</button>`).join("");
}
function tierHtml(p, q) {
  const a = activeTier(p, q);
  return `<div class="tiers">${p.tiers.map((t, i) => `<button type="button" class="tier ${i === a ? "active" : ""}" data-set="${p.num}" data-qty="${t.qty}" aria-label="${t.qty} for ${money(t.price)} each"><small>×${t.qty}</small><b>${money(t.price)}</b></button>`).join("")}</div>`;
}
// "Made With Imported Ingredients" is a render-only pill derived from imported_ingredients (never mixed into tags; the origin tooling reads tags[1]).
const LAB_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 3h6M10 3v6L4.5 18.5A2 2 0 0 0 6.2 21h11.6a2 2 0 0 0 1.7-2.5L14 9V3"/><path d="M7.5 15h9"/></svg>`;
const isLab = p => !!p.lab_tested || /^lab tested$/i.test(p.sub || "");
const subText = p => (/^lab tested$/i.test(p.sub || "") ? "" : (p.sub || ""));
const tagsHtml = p => (p.tags || []).map(t => `<span class="tag">${esc(t)}</span>`).join("") + (isLab(p) ? `<span class="tag lab">${LAB_ICON}Lab tested</span>` : "") + (p.imported_ingredients ? `<span class="tag">Made With Imported Ingredients</span>` : "");
const hasDetails = p => !!(p.description || p.ingredients || (p.badges && p.badges.length));
function cardHtml(p) {
  const q = cart[p.num] || 0;
  const badge = p.status === "oos" ? `<span class="badge oos">Sold out</span>` : p.status === "hold" ? `<span class="badge soon">Back soon</span>` : p.is_new ? `<span class="badge new">New</span>` : "";
  const made = isMade(p) ? `<span class="badge made">Made by us</span>` : "";
  const tags = tagsHtml(p);
  const bottom = purchasable(p)
    ? tierHtml(p, q) + (q ? `<div class="qtyrow"><span class="qty"><button type="button" data-dec="${p.num}" aria-label="Remove one">−</button><span>${q}</span><button type="button" data-inc="${p.num}" aria-label="Add one">+</button></span><span class="amt">${saveHtml(p, q)}<span>${money(unitPrice(p, q) * q)}</span></span></div>` : "")
    : `<div class="unavail">${p.status === "oos" ? "Currently sold out. Message us to be notified." : "Coming back soon."}</div>`;
  return `<article class="card ${p.status === "oos" ? "is-oos" : ""}" data-num="${p.num}">
    <div class="photo" data-view="${p.num}">${badge}${made}<img src="${imgSrc(p)}" alt="${esc(p.name)}" loading="lazy" width="400" height="400"></div>
    <div class="body"><h4>${esc(p.name)}</h4><p class="sub">${esc(subText(p))}</p><div class="tags">${tags}</div>${hasDetails(p) ? `<button type="button" class="details" data-view="${p.num}">Details</button>` : ""}${bottom}</div>
  </article>`;
}
function renderCatalog() {
  renderChips();
  const q = query.trim().toLowerCase();
  const match = p => (category === "All" || p.cat === category) && (!q || (p.name + " " + (p.sub || "") + " " + (p.tags || []).join(" ") + " " + (p.description || "") + " " + p.cat).toLowerCase().includes(q));
  let html = "", any = false;
  CATALOG.categories.forEach(c => {
    const items = c.items.filter(match);
    if (!items.length) return; any = true;
    html += `<div class="group" id="cat-${c.title.toLowerCase().replace(/[^a-z]+/g, "-")}"><div class="group-head"><h3>${esc(c.title)}</h3><span>${esc(c.desc)}</span></div><div class="grid">${items.map(cardHtml).join("")}</div></div>`;
  });
  $("catalog").innerHTML = any ? html : `<div class="empty">Nothing matches “${esc(query)}”. Try another word, or clear the search.</div>`;
}
function updateCard(num) {
  const el = document.querySelector(`.card[data-num="${num}"]`);
  if (el) el.outerHTML = cardHtml(byNum[num]);
  if (!$("productModal").hidden && modalNum === num) renderModalTiers();
}
function setQty(num, q) {
  if (q <= 0) delete cart[num]; else cart[num] = q;
  saveCart(); renderCart(); updateCard(num);
}
function toast(msg) { const t = $("toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("show"), 2000) }

function renderCart() {
  const nums = Object.keys(cart).map(Number).filter(n => byNum[n] && purchasable(byNum[n]));
  let total = 0, count = 0;
  const rows = nums.map(n => { const p = byNum[n], q = cart[n], u = unitPrice(p, q); total += u * q; count += q;
    return `<div class="line"><img src="${imgSrc(p)}" alt=""><div><div class="nm">${esc(p.name)}</div><div class="meta">${esc(subText(p) || (p.tags || []).join(" · "))} · ${money(u)} each</div><span class="qty" style="margin-top:6px"><button type="button" data-dec="${n}" aria-label="Remove one">−</button><span>${q}</span><button type="button" data-inc="${n}" aria-label="Add one">+</button></span> <button type="button" class="rm" data-remove="${n}">Remove</button></div><div class="amt">${money(u * q)}${savings(p, q) > 0.001 ? `<div class="save">saved ${money(savings(p, q))}</div>` : ""}</div></div>` });
  $("cartItems").innerHTML = rows.length ? rows.join("") : `<p style="padding:28px 0;color:var(--muted)">Your basket is empty. Pick a product and choose ×1, ×3 or ×6.</p>`;
  $("count").textContent = count; $("cartTotal").textContent = money(total);
  const lines = nums.map(n => { const p = byNum[n], q = cart[n]; return `• ${q} × ${p.name}${subText(p) ? " (" + subText(p) + ")" : ""} — ${money(unitPrice(p, q) * q)}` });
  const msg = `Hello Organicopia! I'd like to order:\n${lines.join("\n")}\n\nSubtotal: ${money(total)} (incl. VAT)\n\nPlease confirm availability and delivery. Thank you!`;
  const a = $("checkout"); a.href = "https://wa.me/" + WHATSAPP + "?text=" + encodeURIComponent(msg); a.setAttribute("aria-disabled", nums.length ? "false" : "true");
}

let modalNum = null;
function renderModalTiers() { const p = byNum[modalNum]; const q = cart[modalNum] || 0;
  $("modalTiers").innerHTML = purchasable(p) ? tierHtml(p, q) + (q ? `<div class="qtyrow"><span class="qty"><button type="button" data-dec="${p.num}">−</button><span>${q}</span><button type="button" data-inc="${p.num}">+</button></span><span class="amt">${saveHtml(p, q)}<span>${money(unitPrice(p, q) * q)} in basket</span></span></div>` : "") : `<div class="unavail">${p.status === "oos" ? "Currently sold out." : "Coming back soon."}</div>` }
function openProduct(num) { const p = byNum[num]; modalNum = num;
  $("modalImg").src = imgSrc(p); $("modalImg").alt = p.name; $("modalCat").textContent = p.cat + (isMade(p) ? " · Made with Intention" : " · Sourced with Intention");
  $("modalName").textContent = p.name; $("modalSub").textContent = subText(p);
  $("modalTags").innerHTML = tagsHtml(p);
  $("modalBadges").innerHTML = (p.badges || []).map(b => `<span>${esc(b)}</span>`).join("");
  $("modalDesc").textContent = p.description || "";
  $("modalIng").textContent = p.ingredients ? "Ingredients: " + p.ingredients : ""; $("modalIng").hidden = !p.ingredients;
  $("modalLab").hidden = !isLab(p);
  renderModalTiers(); $("productModal").hidden = false; $("closeModal").focus();
}
function closeModal() { $("productModal").hidden = true; modalNum = null }
function openCart() { renderCart(); $("cartOverlay").hidden = false; $("closeCart").focus() }
function closeCart() { $("cartOverlay").hidden = true }

document.body.addEventListener("click", e => {
  const t = e.target.closest("[data-cat],[data-set],[data-inc],[data-dec],[data-remove],[data-view],[data-copy]");
  if (!t) return;
  if (t.dataset.cat) { category = t.dataset.cat; renderCatalog(); return }
  if (t.dataset.set) { const n = +t.dataset.set, q = +t.dataset.qty; setQty(n, q); toast(`${byNum[n].name}: ${q} in basket at ${money(unitPrice(byNum[n], q))} each`); return }
  if (t.dataset.inc) { const n = +t.dataset.inc; setQty(n, (cart[n] || 0) + 1); return }
  if (t.dataset.dec) { const n = +t.dataset.dec; setQty(n, (cart[n] || 0) - 1); return }
  if (t.dataset.remove) { setQty(+t.dataset.remove, 0); return }
  if (t.dataset.view) { openProduct(+t.dataset.view); return }
  if (t.dataset.copy) { const v = t.dataset.copy; const done = () => { t.textContent = "Copied"; setTimeout(() => t.textContent = "Copy", 1500) };
    (navigator.clipboard?.writeText(v) || Promise.reject()).then(done).catch(() => { const r = document.createRange(); r.selectNodeContents(t.previousElementSibling); const s = getSelection(); s.removeAllRanges(); s.addRange(r) }) }
});
$("search").addEventListener("input", e => { query = e.target.value; renderCatalog() });
$("searchJump").onclick = () => { $("shop").scrollIntoView({behavior: "smooth"}); setTimeout(() => $("search").focus(), 400) };
$("openCart").onclick = openCart; $("closeCart").onclick = closeCart;
$("cartOverlay").addEventListener("click", e => { if (e.target === $("cartOverlay")) closeCart() });
$("closeModal").onclick = closeModal;
$("productModal").addEventListener("click", e => { if (e.target === $("productModal")) closeModal() });
document.addEventListener("keydown", e => { if (e.key === "Escape") { closeModal(); closeCart(); closeWholesale() } });
// ---- Wholesale inquiry form -> WhatsApp
const WHOLESALE_WA = "96178879350";
function openWholesale() { $("wholesaleModal").hidden = false; $("whName").focus() }
function closeWholesale() { $("wholesaleModal").hidden = true }
document.querySelectorAll("#wholesaleLink,[data-wholesale]").forEach(a => a.addEventListener("click", e => { e.preventDefault(); openWholesale() }));
$("closeWholesale").onclick = closeWholesale;
$("wholesaleModal").addEventListener("click", e => { if (e.target === $("wholesaleModal")) closeWholesale() });
$("whForm").addEventListener("submit", e => {
  e.preventDefault();
  const f = $("whForm"); f.querySelectorAll("input,select,textarea").forEach(x => x.classList.add("touched"));
  if (!f.checkValidity()) { $("whErr").hidden = false; f.querySelector(":invalid")?.focus(); return }
  $("whErr").hidden = true;
  const v = id => $(id).value.trim();
  const msg = `Hello Organicopia, I'm interested in wholesale.\n\nName: ${v("whName")}\nBusiness: ${v("whBiz")}\nPhone: ${v("whPhone")}\nLocation: ${v("whLoc")}\nInterest: ${v("whReason")}${v("whAbout") ? "\nAbout the business: " + v("whAbout") : ""}\n\nPlease get in touch. Thank you!`;
  const a = document.createElement("a"); a.href = "https://wa.me/" + WHOLESALE_WA + "?text=" + encodeURIComponent(msg); a.target = "_blank"; a.rel = "noopener"; document.body.appendChild(a); a.click(); a.remove();
  closeWholesale(); toast("Opening WhatsApp with your inquiry\u2026");
});
if (location.hash === "#wholesale") openWholesale();
$("checkout").addEventListener("click", e => { if ($("checkout").getAttribute("aria-disabled") === "true") { e.preventDefault(); toast("Add a product to your basket first.") } });
// Logo animation: the GIF plays once (~6 s), then fades to the crisp SVG lockup. Reduced motion: lockup only.
const heroAnim = $("heroAnim"), animBox = heroAnim.parentElement;
const ANIM_MS = 4300; // the drawing finishes at ~4.26 s; the GIF then just holds its last frame
if (matchMedia("(prefers-reduced-motion: reduce)").matches) { animBox.classList.add("done"); heroAnim.remove() }
else { const start = () => setTimeout(() => animBox.classList.add("done"), ANIM_MS); heroAnim.complete ? start() : heroAnim.addEventListener("load", start, {once: true}) }
async function init() {
  const res = await fetch("data/products.json");
  CATALOG = await res.json();
  CATALOG.categories.forEach(c => c.items.forEach(p => { const q = {...p, cat: c.title}; PRODUCTS.push(q); byNum[p.num] = q }));
  cats = ["All", ...CATALOG.categories.map(c => c.title)];
  renderCatalog(); renderCart();
}
init();
