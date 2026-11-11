
const CATALOG = JSON.parse(document.getElementById("smbData").textContent);
const packOf = p => Math.max(1, p.pack || 1);
const LINES = {}; Object.entries(CATALOG.cart || {}).forEach(([k, v]) => { LINES[k] = v.line });
const WHATSAPP = "96178879350";
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money = n => "$" + n.toFixed(2);
const LAB_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 3h6M10 3v6L4.5 18.5A2 2 0 0 0 6.2 21h11.6a2 2 0 0 0 1.7-2.5L14 9V3"/><path d="M7.5 15h9"/></svg>`;

// ---- data: sections -> categories -> items
const PRODUCTS = [], byNum = {};
CATALOG.sections.forEach(s => s.categories.forEach(c => c.items.forEach(p => { const q = {...p, cat: c.title, sectionKey: s.key, sectionLabel: s.label}; PRODUCTS.push(q); byNum[p.num] = q })));
const SECTIONS = CATALOG.sections.map(s => ({key: s.key, label: s.label}));
PRODUCTS.forEach(p => { if (p.desc && !/^\s*</.test(p.desc)) p.desc = "<p>" + esc(p.desc) + "</p>"; if (p.brand && p.name.toLowerCase().startsWith(p.brand.toLowerCase() + " ")) p.name = p.name.slice(p.brand.length + 1); const B = p.badges || []; if (!p.priced) p.price = null; p.status = B.includes("Not available") ? "hold" : (B.includes("Coming soon") || (p.oos && p.usa)) ? "soon" : p.oos ? "oos" : "active"; const CN = { "United States": "USA", "Türkiye": "Turkey", "United Kingdom": "UK" }; const cAliases = new Set(["USA", "US", "United States", "Turkey", "Türkiye", "UK", "United Kingdom"]); if (p.country) { const lbl = CN[p.country] || p.country; p.tags = (p.tags || []).filter(t => t !== p.country && t !== lbl && !cAliases.has(t)); if (!(lbl === "Lebanon" && B.includes("Made in Lebanon"))) p.tags.push(lbl) } const days = d => d ? (Date.now() - new Date(d + "T00:00:00").getTime()) / 864e5 : 1e9; p.is_new = p.status === "active" && days(p.pub) <= 60; p.back_in_stock = p.status === "active" && !p.is_new && days(p.restock) <= 30; p.holiday_item = (p.badges || []).includes("Holiday item") });

const LOCKED = () => !!(CATALOG && CATALOG.locked);
const LOCK_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>`;
const LOGIN = "/web/login?redirect=/";
const lockHtml = () => `<a class="lockprice" href="${LOGIN}">${LOCK_SVG}Log in to see prices</a>`;
const purchasable = p => p.status === "active" && p.price != null && p.price > 0;
// Case-only items are charged per case; the stepper shows pieces when case_show_pieces is set (same rules as before).
const unitPrice = p => p.price;
const displayQty = (p, q) => q;
const imgSrc = p => p.img || "/smb/placeholder.svg";
const has = (p, b) => (p.badges || []).includes(b);
const isLab = p => has(p, "Lab tested");
const subText = p => p.sub || "";
// Made in Lebanon: the Organicopia products we make ourselves (ghee, clay toothpaste and the bakery shelf).
const isMade = p => has(p, "Made in Lebanon");
const hasDetails = p => !!(p.desc && p.desc.replace(/<[^>]+>/g, "").trim());
const tagsHtml = p => (p.tags || []).map(t => `<span class="tag">${esc(t)}</span>`).join("")
  + (isLab(p) ? `<span class="tag lab">${LAB_ICON}Lab tested</span>` : "")
  + (isMade(p) ? `<span class="tag made">Made in Lebanon</span>` : "")
  + (has(p, "Imported ingredients") ? `<span class="tag">Made With Imported Ingredients</span>` : "");

let cart = {}; Object.entries(CATALOG.cart || {}).forEach(([k, v]) => { if (v.q > 0) cart[k] = v.q });
const saveCart = () => {};
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
  }).catch(e => { toast("Could not update your order. Please try again."); console.error(e) });
}

let section = SECTIONS[0]?.key || "", category = "", query = "";

function renderTabs() {
  $("tabs").innerHTML = SECTIONS.map(s => `<button type="button" class="tab ${s.key === section ? "active" : ""}" data-section="${esc(s.key)}" role="tab" aria-selected="${s.key === section}">${esc(s.label)}</button>`).join("");
  const cats = CATALOG.sections.find(s => s.key === section).categories.map(c => c.title);
  if (!cats.includes(category)) category = cats[0] || "";
  const row = $("chips"), keep = row.scrollLeft;
  row.innerHTML = cats.map(c => `<button type="button" class="chip ${c === category ? "active" : ""}" data-cat="${esc(c)}" role="tab" aria-selected="${c === category}">${esc(c)}</button>`).join("");
  row.scrollLeft = keep;
}
// Scroll the chip row (only the row, never the page) so the active chip is visible.
function revealChip() {
  const row = $("chips"), a = row.querySelector(".chip.active"); if (!a) return;
  const pad = 14, l = a.offsetLeft, r = l + a.offsetWidth;
  if (l < row.scrollLeft + pad) row.scrollTo({ left: Math.max(0, l - pad), behavior: "smooth" });
  else if (r > row.scrollLeft + row.clientWidth - pad) row.scrollTo({ left: r - row.clientWidth + pad, behavior: "smooth" });
}
function setHeaderVar() { const hd = document.querySelector("header"); if (hd) document.documentElement.style.setProperty("--hd", hd.offsetHeight + "px") }
function priceHtml(p) {
  if (p.status === "soon" || p.price == null || p.price <= 0) return `<div class="pending">Pricing to follow</div>`;
  return `<div><div class="price num">${money(p.price)}<small> / piece</small></div>${packOf(p) > 1 ? `<div class="case">Sold in packs of ${packOf(p)} &mdash; <b class="num">${money(p.price * packOf(p))}</b> per pack</div>` : ""}</div>`;
}
function controlHtml(p) {
  const q = cart[p.num] || 0;
  if (!q) return `<button type="button" class="addbtn" data-add="${p.num}" aria-label="Add ${esc(p.name)} to order">+</button>`;
  return `<span class="qty"><button type="button" data-dec="${p.num}" aria-label="Remove one">&minus;</button><span class="num">${displayQty(p, q)}</span><button type="button" data-inc="${p.num}" aria-label="Add one">+</button></span>`;
}
function cardHtml(p) {
  const q = cart[p.num] || 0;
  const tr = [];
  if (p.status === "oos") tr.push(`<span class="badge oos">Out of stock</span>`);
  else if (p.status === "soon") tr.push(`<span class="badge soon">Coming soon</span>`);
  else if (p.status === "hold") tr.push(`<span class="badge oos">Unavailable</span>`);
  if (p.is_new) tr.push(`<span class="badge new">New</span>`); else if (p.back_in_stock) tr.push(`<span class="badge back">Back in stock</span>`);
  if (p.holiday_item && p.status !== "oos" && p.status !== "hold") tr.push(`<span class="badge holiday">Holiday item</span>`);
  const hl = p.is_new ? " hl-new" : p.back_in_stock ? " hl-back" : (p.holiday_item && p.status !== "oos" && p.status !== "hold") ? " hl-holiday" : "";
  const bottom = LOCKED() ? lockHtml() : purchasable(p)
    ? `<div class="pricebox">${priceHtml(p)}${controlHtml(p)}</div>` + (q ? `<div class="qtyrow"><span class="hint">${q} piece${q > 1 ? "s" : ""}</span><span class="amt num">${money(unitPrice(p) * q)}</span></div>` : "")
    : `<div class="pricebox">${priceHtml(p)}</div><div class="unavail">${p.status === "oos" ? "Out of stock. Message us to be notified." : p.status === "soon" ? "Coming soon." : p.status === "hold" ? "Currently unavailable." : "Pricing to follow."}</div>`;
  return `<article class="card${hl}${(p.status === "oos" || p.status === "hold") ? " is-oos" : ""}" data-num="${p.num}">
    <div class="photo" data-view="${p.num}"><span class="ref">${esc(p.ref || "")}</span><div class="badges-tr">${tr.join("")}</div><img src="${imgSrc(p)}" alt="${esc(p.name)}" loading="lazy" width="400" height="400" onerror="this.onerror=null;this.src='/smb/placeholder.svg'"></div>
    <div class="body">${p.brand ? `<div class="brandline">${esc(p.brand)}</div>` : ""}${hasDetails(p) ? `<h4><button type="button" class="namebtn" data-view="${p.num}">${esc(p.name)}</button></h4>` : `<h4>${esc(p.name)}</h4>`}<p class="sub">${esc(subText(p))}</p><div class="tags">${tagsHtml(p)}</div>${hasDetails(p) ? `<button type="button" class="details" data-view="${p.num}">Details</button>` : ""}${bottom}</div>
  </article>`;
}
function renderCatalog() {
  renderTabs();
  const q = query.trim().toLowerCase();
  const all = !q;
  const match = p => (!q || `${p.brand || ""} ${p.name} ${p.sub || ""} ${(p.tags || []).join(" ")} ${p.ref || ""} ${p.cat}`.toLowerCase().includes(q));
  let html = "", any = false;
  CATALOG.sections.forEach(s => { if (all) { const n = s.categories.reduce((a, c) => a + c.items.length, 0); html += `<div class="section-band" id="sec-${esc(s.key)}" data-sec="${esc(s.key)}"><div><div class="kick">${s === CATALOG.sections[0] ? "Section 1" : "Section " + (CATALOG.sections.indexOf(s) + 1)}</div><h3>${esc(s.label)}</h3></div><span class="n">${n} products</span></div>` } s.categories.forEach(c => {
    const items = c.items.map(p => byNum[p.num]).filter(match);
    if (!items.length) return; any = true;
    html += `<div class="group" data-cat="${esc(c.title)}" data-sec="${esc(s.key)}" id="${groupId(s.key, c.title)}"><div class="group-head"><h3>${esc(c.title)}</h3><span>${q ? esc(s.label) + " &middot; " : ""}${esc(c.desc || "")}</span></div><div class="grid">${items.map(cardHtml).join("")}</div></div>`;
  }) });
  $("catalogGrid").innerHTML = any ? html : `<div class="empty">Nothing matches &ldquo;${esc(query)}&rdquo;. Try a brand, product or item number.</div>`;
}
function applyLock() {
  const locked = LOCKED();
  const oc = $("openCart");
  if (oc && locked && !$("loginBtn")) { oc.hidden = true; oc.insertAdjacentHTML("beforebegin", `<a class="iconbtn cartbtn" id="loginBtn" href="${LOGIN}">${LOCK_SVG}Log in for prices</a>`) }
  const lo = $("logoutLi"); if (lo) lo.hidden = locked; const ac = $("accountLi"); if (ac) ac.hidden = locked;
  const who = $("who"); if (who) who.innerHTML = locked ? `<a href="${LOGIN}">Customer login</a>` : `${esc(CATALOG.user || "")} &middot; <a href="/my">My account</a>`;
}
const groupId = (sec, title) => "cat-" + (sec + "-" + title).toLowerCase().replace(/[^a-z0-9]+/g, "-");
function scrollToGroup(sec, title) { const el = document.getElementById(groupId(sec, title)); if (!el) return; spyMute = Date.now() + 1600; window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + window.scrollY - stickyOffset()), behavior: "smooth" }) }
function stickyOffset() { const hd = document.querySelector("header"), tb = document.querySelector(".toolbar"); return (hd ? hd.offsetHeight : 73) + (tb ? tb.offsetHeight : 100) + 12 }
let spyMute = 0;
setHeaderVar(); addEventListener("resize", setHeaderVar); if (document.fonts) document.fonts.ready.then(setHeaderVar); addEventListener("load", setHeaderVar);
function toolbarBottom() { const tb = document.querySelector(".toolbar"); return tb ? tb.getBoundingClientRect().bottom : 170 }
function scrollToSection(key) { const el = document.getElementById("sec-" + key); if (!el) return; const y = el.getBoundingClientRect().top + window.scrollY - stickyOffset(); window.scrollTo({ top: Math.max(0, y), behavior: "smooth" }) }
let spyLock = 0;
window.addEventListener("scroll", () => { if (spyLock) return; spyLock = requestAnimationFrame(() => { spyLock = 0;
  if (Date.now() < spyMute) return;
  const marks = [...document.querySelectorAll("#catalogGrid .section-band, #catalogGrid .group")]; if (!marks.length) return;
  const line = stickyOffset() + 40; let m = marks[0];
  marks.forEach(x => { if (x.getBoundingClientRect().top <= line) m = x });
  const g = m.classList.contains("group") ? m.dataset : { sec: m.dataset.sec, cat: (CATALOG.sections.find(s => s.key === m.dataset.sec)?.categories[0]?.title) || "" };
  if (g.sec !== section || g.cat !== category) { section = g.sec; category = g.cat; renderTabs(); revealChip() } }) }, { passive: true });
function updateCard(num) { const el = document.querySelector(`.card[data-num="${num}"]`); if (el) el.outerHTML = cardHtml(byNum[num]); if (!$("productModal").hidden && modalNum === num) renderModalPrice() }
function setQty(num, q) { const prev = cart[num] || 0; const k = packOf(byNum[num]); q = Math.round(q / k) * k; if (q > 0 && q < k) q = k; if (q <= 0) delete cart[num]; else cart[num] = q; renderCart(); updateCard(num); syncQty(num, q, prev) }
function toast(msg) { const t = $("toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("show"), 2000) }

function orderLabel(p) { return (p.brand ? p.brand + " " : "") + p.name + (subText(p) ? " (" + subText(p) + ")" : "") }
const LOCS = CATALOG.locations || []; let shipId = CATALOG.ship || 0;
const currentLocation = () => LOCS.find(l => l.id === shipId) || LOCS[0] || null;
function initLocations() { const row = $("locRow"), sel = $("locSel"); if (!row || !sel || LOCS.length < 2) return; sel.innerHTML = LOCS.map(l => `<option value="${l.id}"${l.id === shipId ? " selected" : ""}>${esc(l.name)} — ${esc(l.line)}</option>`).join(""); row.hidden = false;
  sel.addEventListener("change", () => { shipId = +sel.value; renderCart(); rpc("/shop/update_address", { partner_id: shipId, address_type: "delivery" }).then(() => rpc("/shop/update_address", { partner_id: shipId, address_type: "billing" })).catch(() => {}); }); }
function renderCart() {
  const nums = Object.keys(cart).map(Number).filter(n => byNum[n] && purchasable(byNum[n]));
  let total = 0, count = 0;
  const rows = nums.map(n => { const p = byNum[n], q = cart[n], u = unitPrice(p); total += u * q; count += q;
    return `<div class="line"><img src="${imgSrc(p)}" alt=""><div><div class="nm">${esc(p.ref || "")} &middot; ${esc(orderLabel(p))}</div><div class="meta">${money(u)} per piece</div><span class="qty" style="margin-top:6px"><button type="button" data-dec="${n}" aria-label="Remove one">&minus;</button><span class="num">${displayQty(p, q)}</span><button type="button" data-inc="${n}" aria-label="Add one">+</button></span> <button type="button" class="rm" data-remove="${n}">Remove</button></div><div class="amt num">${money(u * q)}</div></div>` });
  $("cartItems").innerHTML = rows.length ? rows.join("") : `<p style="padding:28px 0;color:var(--muted)">Your order is empty. Tap + on any product to add it.</p>`;
  $("count").textContent = count; $("cartTotal").textContent = money(total); $("headTotal").textContent = money(total);
  const lines = nums.map(n => { const p = byNum[n], q = cart[n]; return `${p.ref} — ${orderLabel(p)} × ${q} — ${money(unitPrice(p) * q)}` });
  const msg = `Hi SMB Foods, I'd like to order:\n\n${lines.join("\n")}\n\nTotal: ${money(total)} (incl. VAT)\n\nPlease confirm stock, pricing and delivery. Thank you!`;
  const a = $("checkout"); a.href = "https://wa.me/" + WHATSAPP + "?text=" + encodeURIComponent(msg); a.setAttribute("aria-disabled", nums.length ? "false" : "true");
  const c = $("confirm"); if (c) c.classList.toggle("busy", !nums.length);
}

let modalNum = null;
function renderModalPrice() { const p = byNum[modalNum]; const q = cart[modalNum] || 0;
  $("modalPrice").innerHTML = LOCKED() ? lockHtml() : purchasable(p) ? priceHtml(p) + controlHtml(p) + (q ? `<div class="qtyrow" style="width:100%"><span class="hint">${money(unitPrice(p) * q)} in your order</span></div>` : "") : `<div class="unavail" style="border:0;padding:0;margin:0">${p.status === "oos" ? "Out of stock." : p.status === "soon" ? "Coming soon." : "Currently unavailable."}</div>` }
function openProduct(num) { const p = byNum[num]; modalNum = num;
  $("modalImg").src = imgSrc(p); $("modalImg").alt = p.name;
  $("modalCat").textContent = `${p.ref || ""} · ${p.brand || ""} · ${p.cat}`.replace(/^ · /, "");
  $("modalName").textContent = p.name; $("modalSub").textContent = subText(p);
  $("modalTags").innerHTML = tagsHtml(p);
  $("modalBadges").innerHTML = "";
  $("modalDesc").innerHTML = p.desc || ""; $("modalDesc").hidden = !hasDetails(p);
  $("modalIng").hidden = true;
  $("modalLab").hidden = !isLab(p);
  renderModalPrice(); $("productModal").hidden = false; $("closeModal").focus();
}
function closeModal() { $("productModal").hidden = true; modalNum = null }
function openCart() { renderCart(); $("cartOverlay").hidden = false; $("closeCart").focus() }
function closeCart() { $("cartOverlay").hidden = true }

// Vertical wheel over the category chips scrolls them sideways (mouse users had no way to reach the hidden chips).
document.querySelectorAll(".chips").forEach(el => el.addEventListener("wheel", e => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && el.scrollWidth > el.clientWidth) { e.preventDefault(); el.scrollLeft += e.deltaY } }, { passive: false }));
document.body.addEventListener("click", e => {
  const t = e.target.closest("[data-section],[data-cat],[data-add],[data-inc],[data-dec],[data-remove],[data-view],[data-copy],[data-newcust]");
  if (!t) return;
  if (t.dataset.section) { section = t.dataset.section; category = ""; query = ""; $("search").value = ""; renderCatalog(); revealChip(); spyMute = Date.now() + 1600; scrollToSection(section); return }
  if (t.dataset.cat) { category = t.dataset.cat; renderTabs(); revealChip(); scrollToGroup(section, category); return }
  if (t.dataset.add) { const n = +t.dataset.add; setQty(n, packOf(byNum[n])); toast(`${byNum[n].name}: added${packOf(byNum[n]) > 1 ? " (pack of " + packOf(byNum[n]) + ")" : ""}`); return }
  if (t.dataset.inc) { const n = +t.dataset.inc; setQty(n, (cart[n] || 0) + packOf(byNum[n])); return }
  if (t.dataset.dec) { const n = +t.dataset.dec; setQty(n, (cart[n] || 0) - packOf(byNum[n])); return }
  if (t.dataset.remove) { setQty(+t.dataset.remove, 0); return }
  if (t.dataset.view) { openProduct(+t.dataset.view); return }
  if (t.hasAttribute("data-newcust")) { e.preventDefault(); openNewcust(); return }
  if (t.dataset.copy) { const v = t.dataset.copy; const done = () => { t.textContent = "Copied"; setTimeout(() => t.textContent = "Copy", 1500) };
    (navigator.clipboard?.writeText(v) || Promise.reject()).then(done).catch(() => { const r = document.createRange(); r.selectNodeContents(t.previousElementSibling); const s = getSelection(); s.removeAllRanges(); s.addRange(r) }) }
});
$("search").addEventListener("input", e => { query = e.target.value; renderCatalog() });
$("searchJump").onclick = () => { $("catalog").scrollIntoView({behavior: "smooth"}); setTimeout(() => $("search").focus(), 400) };
$("openCart").onclick = openCart; $("confirm").addEventListener("click", e => { if (!Object.keys(cart).length) { e.preventDefault(); toast("Add a product to your order first.") } }); $("closeCart").onclick = closeCart;
$("cartOverlay").addEventListener("click", e => { if (e.target === $("cartOverlay")) closeCart() });
$("closeModal").onclick = closeModal;
$("productModal").addEventListener("click", e => { if (e.target === $("productModal")) closeModal() });
document.addEventListener("keydown", e => { if (e.key === "Escape") { closeModal(); closeCart(); closeNewcust() } });
$("checkout").addEventListener("click", e => { if ($("checkout").getAttribute("aria-disabled") === "true") { e.preventDefault(); toast("Add a product to your order first.") } });

// ---- New customer form -> WhatsApp
function openNewcust() { $("newcustModal").hidden = false; $("ncName").focus() }
function closeNewcust() { $("newcustModal").hidden = true }
$("closeNewcust").onclick = closeNewcust;
$("newcustModal").addEventListener("click", e => { if (e.target === $("newcustModal")) closeNewcust() });
$("ncForm").addEventListener("submit", e => {
  e.preventDefault();
  const f = $("ncForm"); f.querySelectorAll("input,select,textarea").forEach(x => x.classList.add("touched"));
  if (!f.checkValidity()) { $("ncErr").hidden = false; f.querySelector(":invalid")?.focus(); return }
  $("ncErr").hidden = true;
  const v = id => $(id).value.trim();
  const msg = `Hello SMB Foods, I'd like to open a wholesale account.\n\nName: ${v("ncName")}\nBusiness: ${v("ncBiz")}\nType: ${v("ncType")}\nPhone: ${v("ncPhone")}\nLocation: ${v("ncLoc")}${v("ncVat") ? "\nVAT registration no.: " + v("ncVat") : ""}${v("ncAbout") ? "\nAbout the business: " + v("ncAbout") : ""}\n\nPlease get in touch. Thank you!`;
  const a = document.createElement("a"); a.href = "https://wa.me/" + WHATSAPP + "?text=" + encodeURIComponent(msg); a.target = "_blank"; a.rel = "noopener"; document.body.appendChild(a); a.click(); a.remove();
  closeNewcust(); toast("Opening WhatsApp with your details…");
});
if (location.hash === "#new-customer") setTimeout(openNewcust, 300);

// ---- hero stats
(function stats() {
  $("statProducts").textContent = PRODUCTS.length;
  $("statBrands").textContent = new Set(PRODUCTS.map(p => p.brand).filter(Boolean)).size;
  $("statOwn").textContent = PRODUCTS.filter(p => p.brand === "Organicopia").length;
  $("statMade").textContent = PRODUCTS.filter(isMade).length;
})();
applyLock(); initLocations(); renderCatalog(); renderCart();
