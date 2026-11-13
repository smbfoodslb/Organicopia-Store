/* Organicopia retail storefront on Odoo. Catalog, prices (×1/×3/×6 from the RETAIL LB pricelist) and the
basket come from Odoo (embedded in #orgData; the basket is the website sale order). Tier buttons set the
quantity; the unit price is whatever the pricelist gives at that quantity. Checkout goes to Odoo's cart;
WhatsApp is the alternative. */
const CATALOG = JSON.parse(document.getElementById("orgData").textContent);
const WHATSAPP = "96170649386";
const WHOLESALE_WA = "96178879350";
const LOGIN = "/web/login?redirect=/";
const DELIVERY_FEE = 3, FREE_FROM = 40;
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money = n => "$" + n.toFixed(2);
const has = (p, b) => (p.badges || []).includes(b);

// ---- Black Friday 2026: 25% off everything, applied automatically at checkout (Odoo promotion "Black Friday 2026 — 25% off", website 1). Ends 27 Nov 2026 23:59 Beirut.
const SALE = { pct: 25, start: Date.parse("2026-11-13T00:00:00+02:00"), end: Date.parse("2026-11-27T23:59:59+02:00") };
const saleOn = () => { const n = Date.now(); return n >= SALE.start && n <= SALE.end };
const salePrice = x => Math.round(x * (100 - SALE.pct)) / 100;
const PRODUCTS = [], byNum = {};
const LINES = {}; Object.entries(CATALOG.cart || {}).forEach(([k, v]) => { LINES[k] = v.line });
CATALOG.categories.forEach(c => c.items.forEach(p => {
  const q = {...p, cat: c.title};
  if (q.brand && q.name.toLowerCase().startsWith(q.brand.toLowerCase() + " ")) q.name = q.name.slice(q.brand.length + 1);
  if (q.desc && !/^\s*</.test(q.desc)) q.desc = "<p>" + esc(q.desc) + "</p>";
  // tiers: keep ×1, then only thresholds where the unit price actually drops
  let t = (q.priced ? q.tiers : []).filter(x => x[1] > 0 && (!saleOn() || x[0] === 1)).map(x => ({qty: x[0], price: Math.round(x[1] * 100) / 100}));  // Black Friday: ×3/×6 tiers suspended (pricelist rules dated from 28 Nov)
  const kept = []; t.forEach(x => { if (!kept.length || x.price < kept[kept.length - 1].price) kept.push(x) });
  q.tiers = kept;
  const B = q.badges || [];
  q.status = B.includes("Not available") ? "hold" : (B.includes("Coming soon") || (q.oos && q.usa)) ? "soon" : q.oos ? "oos" : "active";
  const CN = {"United States": "USA", "Türkiye": "Turkey", "United Kingdom": "UK"};
  const aliases = new Set(["USA", "US", "United States", "Turkey", "Türkiye", "UK", "United Kingdom"]);
  if (q.country) { const lbl = CN[q.country] || q.country; q.tags = (q.tags || []).filter(x => x !== q.country && x !== lbl && !aliases.has(x)); if (!(lbl === "Lebanon" && B.includes("Made in Lebanon"))) q.tags.push(lbl) }
  const days = d => d ? (Date.now() - new Date(d + "T00:00:00").getTime()) / 864e5 : 1e9;
  q.is_new = q.status === "active" && days(q.pub) <= 60;
  q.back_in_stock = q.status === "active" && !q.is_new && days(q.restock) <= 30;
  PRODUCTS.push(q); byNum[q.num] = q;
}));
const purchasable = p => p.status === "active" && p.tiers.length > 0;
const isMade = p => has(p, "Made in Lebanon");
const isLab = p => has(p, "Lab tested");
const imgSrc = p => p.img || "/org/placeholder.svg";
const imgSet = p => p.img && /image_512/.test(p.img) ? ` srcset="${p.img.replace("image_512", "image_256")} 256w, ${p.img} 512w" sizes="(max-width: 640px) 45vw, 250px"` : "";
const unitPrice = (p, q) => { if (!purchasable(p) || q <= 0) return null; let pr = p.tiers[0].price; p.tiers.forEach(t => { if (q >= t.qty) pr = t.price }); return saleOn() ? salePrice(pr) : pr };
const savings = (p, q) => purchasable(p) && q > 0 ? Math.max(0, (p.tiers[0].price - unitPrice(p, q)) * q) : 0;
const saveHtml = (p, q) => savings(p, q) > 0.001 ? `<span class="save">You save ${money(savings(p, q))}</span>` : "";
const activeTier = (p, q) => { let i = -1; p.tiers.forEach((t, k) => { if (q >= t.qty) i = k }); return i };

let cart = {}; Object.entries(CATALOG.cart || {}).forEach(([k, v]) => { if (v.q > 0 && byNum[k]) cart[k] = v.q });

// ---- Odoo cart (server is the source of truth; UI updates optimistically, reverts on refusal)
const rpc = (url, params) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", method: "call", params }) }).then(r => r.json()).then(j => { if (j.error) throw new Error(j.error.data && j.error.data.message || "Error"); return j.result });
let syncChain = Promise.resolve();
function syncQty(num, q, prev) {
  const p = byNum[num];
  syncChain = syncChain.then(async () => {
    if (LINES[num] != null) { const r = await rpc("/shop/cart/update", { line_id: LINES[num], quantity: q }); if (q <= 0) { delete LINES[num]; return }
      if (r && r.warning) toast(r.warning); if (r && typeof r.quantity === "number" && r.quantity !== q) { if (r.quantity > 0) cart[num] = r.quantity; else { delete cart[num]; delete LINES[num] } renderCart(); updateCard(num) } return }
    if (q <= 0) return;
    const r = await rpc("/shop/cart/add", { product_template_id: p.tid, product_id: num, quantity: q });
    const w = r && r.notification_info && r.notification_info.warning;
    if (w) { toast(w); if (prev > 0) cart[num] = prev; else delete cart[num]; renderCart(); updateCard(num); return }
    const ln = r && r.notification_info && r.notification_info.lines && r.notification_info.lines[0];
    if (ln) LINES[num] = ln.id;
  }).catch(e => { toast("Could not update your basket. Please try again."); console.error(e) });
}

let query = "", cats = CATALOG.categories.filter(c => c.items.length).map(c => c.title), category = cats[0] || "";
// Category chips are jump links (like the nav): the whole catalog stays on the page; the active chip follows the scroll.
const groupId = title => "cat-" + title.toLowerCase().replace(/[^a-z]+/g, "-");
function stickyOffset() { const hd = document.querySelector("header"), tb = document.querySelector(".toolbar"); return (hd ? hd.offsetHeight : 73) + (tb ? tb.offsetHeight : 90) + 12 }
let spyMute = 0;
function scrollToGroup(title) {
  const el = document.getElementById(groupId(title)); if (!el) return;
  spyMute = Date.now() + 900;
  window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + window.scrollY - stickyOffset()), behavior: "smooth" });
}
let spyTick = 0;
window.addEventListener("scroll", () => { if (spyTick) return; spyTick = requestAnimationFrame(() => { spyTick = 0;
  if (Date.now() < spyMute) return;
  const groups = [...document.querySelectorAll("#catalog .group")]; if (!groups.length) return;
  const line = stickyOffset() + 40; let cur = groups[0].dataset.cat;
  groups.forEach(g => { if (g.getBoundingClientRect().top <= line) cur = g.dataset.cat });
  if (cur !== category) { category = cur; renderChips(); const a = document.querySelector(".chip.active"); if (a) a.scrollIntoView({ block: "nearest", inline: "nearest" }) }
}) }, { passive: true });

function renderChips() {
  $("chips").innerHTML = cats.map(c => `<button type="button" class="chip ${c === category ? "active" : ""}" data-cat="${esc(c)}" role="tab" aria-selected="${c === category}">${esc(c)}</button>`).join("");
}
function tierHtml(p, q) {
  const a = activeTier(p, q);
  return `<div class="tiers" style="grid-template-columns:repeat(${p.tiers.length},1fr)">${p.tiers.map((t, i) => `<button type="button" class="tier ${i === a ? "active" : ""}" data-set="${p.num}" data-qty="${t.qty}" aria-label="${t.qty} for ${money(saleOn() ? salePrice(t.price) : t.price)} each"><small>×${t.qty}</small>${saleOn() ? `<s>${money(t.price)}</s><b>${money(salePrice(t.price))}</b>` : `<b>${money(t.price)}</b>`}</button>`).join("")}</div>`;
}
const LAB_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 3h6M10 3v6L4.5 18.5A2 2 0 0 0 6.2 21h11.6a2 2 0 0 0 1.7-2.5L14 9V3"/><path d="M7.5 15h9"/></svg>`;
const subText = p => p.sub || "";
const tagsHtml = p => (p.tags || []).map(t => `<span class="tag">${esc(t)}</span>`).join("") + (isLab(p) ? `<span class="tag lab">${LAB_ICON}Lab tested</span>` : "") + (has(p, "Imported ingredients") ? `<span class="tag">Made With Imported Ingredients</span>` : "");
const hasDetails = p => !!((p.desc && p.desc.replace(/<[^>]+>/g, "").trim()) || (p.certs && p.certs.length));
const NOTIFY = new Set(CATALOG.notify || []);
const notifyHtml = p => NOTIFY.has(p.num) ? `<span class="notify-done">\u2713 We'll message you on WhatsApp when it's back</span>` : `<span>Currently sold out.</span> <button type="button" class="notify" data-notify="${p.num}">Notify me when it's back</button>`;
const unavailText = p => p.status === "oos" ? notifyHtml(p) : p.status === "soon" ? "Coming soon." : p.status === "hold" ? "Currently unavailable." : "Pricing to follow.";
function cardHtml(p) {
  const q = cart[p.num] || 0;
  const badge = p.status === "oos" ? `<span class="badge oos">Sold out</span>` : p.status === "soon" ? `<span class="badge soon">Coming soon</span>` : p.status === "hold" ? `<span class="badge soon">Unavailable</span>` : p.is_new ? `<span class="badge new">New</span>` : p.back_in_stock ? `<span class="badge back">Back in stock</span>` : has(p, "Holiday item") ? `<span class="badge new">Holiday</span>` : "";
  const made = isMade(p) ? `<span class="badge made">Made by us</span>` : "";
  const bottom = purchasable(p)
    ? tierHtml(p, q) + (q ? `<div class="qtyrow"><span class="qty"><button type="button" data-dec="${p.num}" aria-label="Remove one">−</button><span>${q}</span><button type="button" data-inc="${p.num}" aria-label="Add one">+</button></span><span class="amt">${saveHtml(p, q)}${saleOn() ? `<s class="was">${money(p.tiers[0].price * q)}</s>` : ""}<span>${money(unitPrice(p, q) * q)}</span></span></div>` : "")
    : `<div class="unavail">${unavailText(p)}</div>`;
  return `<article class="card ${p.status === "oos" ? "is-oos" : ""}" data-num="${p.num}">
    <div class="photo" data-view="${p.num}">${badge}${made}<img src="${imgSrc(p)}"${imgSet(p)} alt="${esc(p.name)}" loading="lazy" width="400" height="400" onerror="this.onerror=null;this.src='/org/placeholder.svg'"></div>
    <div class="body">${hasDetails(p) ? `<h4><button type="button" class="namebtn" data-view="${p.num}">${esc(p.name)}</button></h4>` : `<h4>${esc(p.name)}</h4>`}<p class="sub">${esc(subText(p))}</p><div class="tags">${tagsHtml(p)}</div>${bottom}</div>
  </article>`;
}
const availRank = p => (p.status === "oos" || p.status === "hold") ? 2 : p.status === "soon" ? 1 : 0;
function renderCatalog() {
  renderChips();
  const q = query.trim().toLowerCase();
  const match = p => (!q || (p.name + " " + (p.sub || "") + " " + (p.tags || []).join(" ") + " " + (p.certs || []).join(" ") + " " + (p.desc || "").replace(/<[^>]+>/g, " ") + " " + p.cat).toLowerCase().includes(q));
  let html = "", any = false;
  CATALOG.categories.forEach(c => {
    const items = c.items.map(i => byNum[i.num]).filter(match).sort((a, b) => availRank(a) - availRank(b));
    if (!items.length) return; any = true;
    html += `<div class="group" data-cat="${esc(c.title)}" id="${groupId(c.title)}"><div class="group-head"><h3>${esc(c.title)}</h3><span>${esc(c.desc)}</span></div><div class="grid">${items.map(cardHtml).join("")}</div></div>`;
  });
  $("catalog").innerHTML = any ? html : `<div class="empty">Nothing matches “${esc(query)}”. Try another word, or clear the search.</div>`;
}
function updateCard(num) {
  const el = document.querySelector(`.card[data-num="${num}"]`);
  if (el) el.outerHTML = cardHtml(byNum[num]);
  if (!$("productModal").hidden && modalNum === num) renderModalTiers();
}
function setQty(num, q) {
  const prev = cart[num] || 0; q = Math.max(0, Math.round(q));
  if (q <= 0) delete cart[num]; else cart[num] = q;
  renderCart(); updateCard(num); syncQty(num, q, prev);
}
function toast(msg) { const t = $("toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("show"), 2200) }

function renderCart() {
  const nums = Object.keys(cart).map(Number).filter(n => byNum[n] && purchasable(byNum[n]));
  let total = 0, count = 0;
  const rows = nums.map(n => { const p = byNum[n], q = cart[n], u = unitPrice(p, q); total += u * q; count += q;
    return `<div class="line"><img src="${imgSrc(p)}" alt=""><div><div class="nm">${esc(p.name)}</div><div class="meta">${esc(subText(p) || (p.tags || []).join(" · "))} · ${money(u)} each</div><span class="qty" style="margin-top:6px"><button type="button" data-dec="${n}" aria-label="Remove one">−</button><span>${q}</span><button type="button" data-inc="${n}" aria-label="Add one">+</button></span> <button type="button" class="rm" data-remove="${n}">Remove</button></div><div class="amt">${money(u * q)}${savings(p, q) > 0.001 ? `<div class="save">saved ${money(savings(p, q))}</div>` : ""}</div></div>` });
  $("cartItems").innerHTML = rows.length ? rows.join("") : `<p style="padding:28px 0;color:var(--muted)">${saleOn() ? "Your basket is empty. Pick a product — 25% comes off at checkout." : "Your basket is empty. Pick a product and choose ×1, ×3 or ×6."}</p>`;
  const disc = saleOn() ? Math.round(nums.reduce((s, n) => s + savings(byNum[n], cart[n]), 0) * 100) / 100 : 0;  // unit prices are already the sale prices; disc is what was taken off
  const sr = $("cartSaleRow"); if (sr) { sr.hidden = !(disc > 0); $("cartSale").textContent = "−" + money(disc) }
  const fee = !nums.length ? 0 : total >= FREE_FROM ? 0 : DELIVERY_FEE;
  $("count").textContent = count; $("cartTotal").textContent = money(total + disc);
  $("cartFee").innerHTML = !nums.length ? money(DELIVERY_FEE) + " · free from " + money(FREE_FROM) : fee ? money(fee) + ` <small>· free from ${money(FREE_FROM)}</small>` : "<b>Free</b>";
  $("cartGrand").textContent = money(total + fee);
  const lines = nums.map(n => { const p = byNum[n], q = cart[n]; return `• ${q} × ${p.name}${subText(p) ? " (" + subText(p) + ")" : ""} — ${money(unitPrice(p, q) * q)}` });
  const msg = `Hello Organicopia! I'd like to order:\n${lines.join("\n")}\n\nSubtotal: ${money(total + disc)} (incl. VAT)${disc ? `\nBlack Friday −${SALE.pct}%: −${money(disc)}` : ""}\nDelivery: ${fee ? money(fee) : "free"}\nTotal: ${money(total + fee)}\n\nPlease confirm availability and delivery. Thank you!`;
  const a = $("checkout"); a.href = "https://wa.me/" + WHATSAPP + "?text=" + encodeURIComponent(msg); a.setAttribute("aria-disabled", nums.length ? "false" : "true");
  $("confirm").classList.toggle("busy", !nums.length);
}

let modalNum = null;
function renderModalTiers() { const p = byNum[modalNum]; const q = cart[modalNum] || 0;
  $("modalTiers").innerHTML = purchasable(p) ? tierHtml(p, q) + (q ? `<div class="qtyrow"><span class="qty"><button type="button" data-dec="${p.num}">−</button><span>${q}</span><button type="button" data-inc="${p.num}">+</button></span><span class="amt">${saveHtml(p, q)}${saleOn() ? `<s class="was">${money(p.tiers[0].price * q)}</s>` : ""}<span>${money(unitPrice(p, q) * q)} in basket</span></span></div>` : "") : `<div class="unavail">${unavailText(p)}</div>` }
function openProduct(num) { const p = byNum[num]; modalNum = num;
  $("modalImg").src = imgSrc(p); $("modalImg").alt = p.name; $("modalCat").textContent = p.cat + (isMade(p) ? " · Made with Intention" : " · Sourced with Intention");
  $("modalName").textContent = p.name; $("modalSub").textContent = subText(p);
  $("modalTags").innerHTML = tagsHtml(p);
  $("modalBadges").innerHTML = (p.certs || []).map(b => `<span>${esc(b)}</span>`).join("");
  $("modalDesc").innerHTML = p.desc || ""; $("modalDesc").hidden = !p.desc;
  $("modalIng").hidden = true;
  $("modalLab").hidden = !isLab(p);
  renderModalTiers(); $("productModal").hidden = false; $("closeModal").focus();
}
function closeModal() { $("productModal").hidden = true; modalNum = null }
function openCart() { renderCart(); $("cartOverlay").hidden = false; $("closeCart").focus() }
function closeCart() { $("cartOverlay").hidden = true }

document.querySelectorAll(".chips").forEach(el => el.addEventListener("wheel", e => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && el.scrollWidth > el.clientWidth) { e.preventDefault(); el.scrollLeft += e.deltaY } }, { passive: false }));
document.body.addEventListener("click", e => {
  const t = e.target.closest("[data-cat],[data-set],[data-inc],[data-dec],[data-remove],[data-view],[data-copy],[data-notify]");
  if (!t) return;
  if (t.dataset.notify) { openNotify(+t.dataset.notify); return }
  if (t.dataset.cat) { category = t.dataset.cat; renderChips(); scrollToGroup(category); return }
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
document.addEventListener("keydown", e => { if (e.key === "Escape") { closeModal(); closeCart(); closeWholesale(); closeNotify() } });
$("confirm").addEventListener("click", e => { if (!Object.keys(cart).length) { e.preventDefault(); toast("Add a product to your basket first.") } });
$("checkout").addEventListener("click", e => { if ($("checkout").getAttribute("aria-disabled") === "true") { e.preventDefault(); toast("Add a product to your basket first.") } });
// ---- Back in stock: the request goes to Odoo as a lead; an automation registers it on the product and
// a WhatsApp message goes out when stock arrives
let notifyNum = null;
function openNotify(num) { const p = byNum[num]; if (!p) return; notifyNum = num; $("ntProduct").textContent = p.name + (subText(p) ? " · " + subText(p) : ""); if (!$("ntName").value) $("ntName").value = CATALOG.user || ""; if (!$("ntPhone").value) $("ntPhone").value = CATALOG.phone || ""; $("ntErr").hidden = true; $("notifyModal").hidden = false; ($("ntName").value ? $("ntPhone") : $("ntName")).focus() }
function closeNotify() { $("notifyModal").hidden = true; notifyNum = null }
$("closeNotify").onclick = closeNotify;
$("notifyModal").addEventListener("click", e => { if (e.target === $("notifyModal")) closeNotify() });
$("ntForm").addEventListener("submit", e => {
  e.preventDefault();
  const name = $("ntName").value.trim(), phone = $("ntPhone").value.trim(), p = byNum[notifyNum];
  if (!name || phone.replace(/\D/g, "").length < 7 || !p) { $("ntErr").hidden = false; return }
  const fd = new FormData(); fd.append("csrf_token", CATALOG.csrf || ""); fd.append("contact_name", name); fd.append("phone", phone); fd.append("name", "Back in stock: " + p.name + (subText(p) ? " (" + subText(p) + ")" : "")); fd.append("x_notify_product_id", String(p.num)); fd.append("x_notify_site", "organicopia");
  const btn = $("ntSubmit"); btn.disabled = true;
  fetch("/website/form/crm.lead", { method: "POST", body: fd }).then(r => r.json()).then(j => { if (!j || !j.id) throw new Error("no id"); NOTIFY.add(p.num); updateCard(p.num); closeNotify(); toast("Noted. We'll message you on WhatsApp when it's back in stock.") }).catch(() => toast("Sorry, that didn't go through. Please try again.")).finally(() => { btn.disabled = false });
});
// ---- Wholesale inquiry form -> WhatsApp (wholesale team)
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
  closeWholesale(); toast("Opening WhatsApp with your inquiry…");
});
if (location.hash === "#wholesale") openWholesale();
// Logo animation: the GIF plays once, then fades to the crisp SVG lockup. Reduced motion: lockup only.
const heroAnim = $("heroAnim"), animBox = heroAnim.closest(".anim") || heroAnim.parentElement;
const ANIM_MS = 4300;
if (matchMedia("(prefers-reduced-motion: reduce)").matches) { animBox.classList.add("done"); heroAnim.remove() }
else { let started = false; const start = () => { if (started) return; started = true; setTimeout(() => animBox.classList.add("done"), ANIM_MS) }; if (heroAnim.complete) start(); else { heroAnim.addEventListener("load", start, {once: true}); heroAnim.addEventListener("error", start, {once: true}); } setTimeout(start, 8000); /* slow connection: give the file time, but never leave the hero stuck */ }
// account links
(function () {
  const locked = CATALOG.locked;
  const who = $("who"); if (who) who.innerHTML = locked ? "" : `${esc(CATALOG.user || "")} &middot; <a href="/my">My account</a>`;
  const ac = $("accountLi"); if (ac) ac.hidden = locked; const lo = $("logoutLi"); if (lo) lo.hidden = locked;
})();
renderCatalog(); renderCart();

// ---- Black Friday banner + popup ----
(function () {
  const bar = $("saleBar"), chip = $("saleChip"), pop = $("bfModal");
  function tick() {
    const on = saleOn();
    if (bar) bar.hidden = !on; if (chip) chip.hidden = !on;
    const pn = $("pricingNote"); if (pn) pn.innerHTML = on ? "<b>Black Friday.</b> 25% off every product until 27 November — the discount comes off automatically at checkout. All prices include VAT." : "<b>Buy more, pay less.</b> Every product has three unit prices. Pick ×1, ×3 or ×6 and the price per piece drops. All prices include VAT.";
    const tp = $("trustPrices"); if (tp) tp.textContent = on ? "Black Friday: 25% off everything, taken off at checkout" : "Three simple prices: buy 1, 3 or 6+";
    if (!on) { if (pop) pop.hidden = true; return }
    const left = SALE.end - Date.now(), d = Math.floor(left / 864e5), h = Math.floor(left % 864e5 / 36e5), m = Math.floor(left % 36e5 / 6e4);
    const el = $("saleCount"); if (el) el.textContent = d > 0 ? `${d}d ${h}h left` : h > 0 ? `${h}h ${m}m left` : `${m}m left`;
  }
  tick(); setInterval(tick, 60000);
  if (pop && saleOn()) {
    let seen = false; try { seen = sessionStorage.getItem("bf2026") === "1" } catch (e) {}
    const close = () => { pop.hidden = true; try { sessionStorage.setItem("bf2026", "1") } catch (e) {} };
    pop.addEventListener("click", e => { if (e.target === pop || e.target.closest("[data-bf-close]")) close() });
    const go = pop.querySelector("[data-bf-shop]"); if (go) go.addEventListener("click", e => { e.preventDefault(); close(); const s = $("shop"); if (s) s.scrollIntoView({ behavior: "smooth", block: "start" }) });
    document.addEventListener("keydown", e => { if (e.key === "Escape" && !pop.hidden) close() });
    if (!seen) setTimeout(() => { pop.hidden = false; const b = pop.querySelector("[data-bf-close]"); if (b) b.focus() }, 900);
  }
})();

// keep the sticky header/toolbar below the two top bars, whatever their height (sale bar on/off, wrapping on phones)
(function () {
  const bars = $("saleBar"); if (!bars) return;
  const set = () => document.documentElement.style.setProperty("--bars-h", (bars.hidden ? 0 : bars.offsetHeight) + "px");
  set(); window.addEventListener("resize", set); if (window.ResizeObserver) new ResizeObserver(set).observe(bars); setInterval(set, 60000);
})();
