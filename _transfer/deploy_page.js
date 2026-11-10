// Deploy the wholesale page to the Odoo DB the browser tab is logged into (idempotent; staging first, later production).
// Expects window.__SMB_BASE = raw GitHub base URL of the transfer folder.
const BASE = window.__SMB_BASE;
const rpc = async (model, method, args, kwargs) => { const r = await fetch('/web/dataset/call_kw', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: { model, method, args, kwargs: kwargs || {} } }) }); const j = await r.json(); if (j.error) throw new Error(j.error.data && j.error.data.message); return j.result; };
const b64 = async (url) => { const r = await fetch(url); if (!r.ok) throw new Error('fetch ' + url + ' ' + r.status); const buf = new Uint8Array(await r.arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000)); return btoa(s); };
const log = {};
// 1. public static files served at /smb/<name>
const files = [['wholesale.css', 'text/css'], ['wholesale.js', 'text/javascript'], ['smb-logo.svg', 'image/svg+xml'], ['placeholder.svg', 'image/svg+xml'], ['favicon.svg', 'image/svg+xml']];
for (const [name, mime] of files) {
  const datas = await b64(BASE + name);
  const url = '/smb/' + name;
  const ex = await rpc('ir.attachment', 'search_read', [[['url', '=', url]]], { fields: ['id'] });
  const vals = { name, datas, mimetype: mime, public: true, url, type: 'binary', res_model: false, res_id: 0 };
  if (ex.length) { await rpc('ir.attachment', 'write', [[ex[0].id], vals]); log[name] = 'updated ' + ex[0].id; }
  else { const id = await rpc('ir.attachment', 'create', [vals]); log[name] = 'created ' + id; }
}
// 2. QWeb view + page
const arch = await fetch(BASE + 'wholesale.xml').then(r => r.text());
let v = await rpc('ir.ui.view', 'search_read', [[['key', '=', 'website.smb_wholesale']]], { fields: ['id'] });
let vid;
if (v.length) { vid = v[0].id; await rpc('ir.ui.view', 'write', [[vid], { arch_db: arch }]); log.view = 'updated ' + vid; }
else { vid = await rpc('ir.ui.view', 'create', [{ name: 'SMB Wholesale', type: 'qweb', key: 'website.smb_wholesale', arch_db: arch, website_id: 6 }]); log.view = 'created ' + vid; }
let pg = await rpc('website.page', 'search_read', [[['url', '=', '/wholesale'], ['website_id', '=', 6]]], { fields: ['id'] });
if (pg.length) { await rpc('website.page', 'write', [[pg[0].id], { view_id: vid, is_published: true }]); log.page = 'updated ' + pg[0].id; }
else { log.page = 'created ' + await rpc('website.page', 'create', [{ name: 'SMB Wholesale', url: '/wholesale', view_id: vid, website_id: 6, is_published: true, header_visible: false, footer_visible: false }]); }
window.__deploy = log;
