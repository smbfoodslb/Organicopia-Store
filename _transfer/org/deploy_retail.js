// Deploy the Organicopia retail page to the Odoo DB the browser tab is logged into (idempotent). Expects window.__SMB_BASE (raw GitHub base).
const BASE = window.__SMB_BASE;
const rpc = async (model, method, args, kwargs) => { const r = await fetch('/web/dataset/call_kw', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: { model, method, args, kwargs: kwargs || {} } }) }); const j = await r.json(); if (j.error) throw new Error(j.error.data && j.error.data.message); return j.result; };
const b64 = async (url) => { const r = await fetch(url); if (!r.ok) throw new Error('fetch ' + url + ' ' + r.status); const buf = new Uint8Array(await r.arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000)); return btoa(s); };
const C = { allowed_company_ids: [1, 2, 3] };
const log = {};
// 1. public static files served at /org/<name>
const files = [['retail.css', 'text/css'], ['retail.js', 'text/javascript'], ['org-pages.css', 'text/css'], ['favicon.svg', 'image/svg+xml'], ['placeholder.svg', 'image/svg+xml'],
  ['logo-mark.svg', 'image/svg+xml'], ['wordmark.svg', 'image/svg+xml'], ['logo-lockup.svg', 'image/svg+xml'], ['wavy-navy.svg', 'image/svg+xml'], ['sticker-sourced.svg', 'image/svg+xml'], ['sticker-made.svg', 'image/svg+xml'], ['logo-animation.gif', 'image/gif'], ['share-card.png', 'image/png'], ['range.webp', 'image/webp']];
const only = window.__ONLY; // optional subset
for (const [name, mime] of files) {
  if (only && !only.includes(name)) continue;
  const datas = await b64(BASE + name);
  const url = '/org/' + name;
  const ex = await rpc('ir.attachment', 'search_read', [[['url', '=', url]]], { fields: ['id'] });
  const vals = { name, datas, mimetype: mime, public: true, url, type: 'binary', res_model: false, res_id: 0 };
  if (ex.length) { await rpc('ir.attachment', 'write', [[ex[0].id], vals]); log[name] = 'updated ' + ex[0].id; }
  else { const id = await rpc('ir.attachment', 'create', [vals]); log[name] = 'created ' + id; }
}
// 2. QWeb view + page on website 1
const arch = await fetch(BASE + 'retail.xml').then(r => r.text());
let v = await rpc('ir.ui.view', 'search_read', [[['key', '=', 'website.org_retail']]], { fields: ['id'] });
let vid;
if (v.length) { vid = v[0].id; await rpc('ir.ui.view', 'write', [[vid], { arch_db: arch }]); log.view = 'updated ' + vid; }
else { vid = await rpc('ir.ui.view', 'create', [{ name: 'Organicopia Store', type: 'qweb', key: 'website.org_retail', arch_db: arch, website_id: 1 }]); log.view = 'created ' + vid; }
let pg = await rpc('website.page', 'search_read', [[['url', '=', '/store'], ['website_id', '=', 1]]], { fields: ['id'] });
if (pg.length) { await rpc('website.page', 'write', [[pg[0].id], { view_id: vid, is_published: true }]); log.page = 'updated ' + pg[0].id; }
else { log.page = 'created ' + await rpc('website.page', 'create', [{ name: 'Organicopia Store', url: '/store', view_id: vid, website_id: 1, is_published: true, header_visible: false, footer_visible: false }]); }
// 3. website 1: homepage + head css
const ver = Date.now().toString(36);
await rpc('website', 'write', [[1], { homepage_url: '/store', custom_code_head: '<!-- ORG-PAGES-START --><link rel="stylesheet" href="/org/org-pages.css?v=' + ver + '"/><!-- ORG-PAGES-END -->' }], { context: C });
log.homepage = '/store'; log.ver = ver;
window.__deployRetail = log;
