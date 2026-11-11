// Step 6.2 — Organicopia website chrome: logo, tax-included totals, menus. Expects window.__SMB_BASE. Idempotent.
const b64 = async (url) => { const r = await fetch(url); const buf = new Uint8Array(await r.arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000)); return btoa(s); };
window.__LOGO = await b64(window.__SMB_BASE + 'org-logo.png');
const rpc = async (model, method, args, kwargs) => { const r = await fetch('/web/dataset/call_kw', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: { model, method, args, kwargs: kwargs || {} } }) }); const j = await r.json(); if (j.error) throw new Error(j.error.data && j.error.data.message); return j.result; };
const C = { allowed_company_ids: [1, 2, 3] };
const log = {};
await rpc('website', 'write', [[1], { show_line_subtotals_tax_selection: 'tax_included', logo: window.__LOGO, name: 'Organicopia' }], { context: C });
const menus = await rpc('website.menu', 'search_read', [[['website_id', '=', 1], ['parent_id', '!=', false]]], { fields: ['name', 'url'], context: C });
const drop = menus.filter(m => /appointment|contact/i.test(m.url)).map(m => m.id);
if (drop.length) await rpc('website.menu', 'unlink', [drop], { context: C });
const shop = menus.find(m => m.url === '/shop'); if (shop) await rpc('website.menu', 'write', [[shop.id], { name: 'All products', sequence: 20 }], { context: C });
const home = menus.find(m => m.url === '/'); if (home) await rpc('website.menu', 'write', [[home.id], { name: 'Store', sequence: 10 }], { context: C });
log.menusDropped = drop.length;
window.__step62 = log;
