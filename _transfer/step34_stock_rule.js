// Step 3.4 — wholesale products stay orderable regardless of stock (team confirms availability); the page badge uses combined SMB SARL + smbfoods stock. Idempotent.
const rpc = async (model, method, args, kwargs) => { const r = await fetch('/web/dataset/call_kw', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: { model, method, args, kwargs: kwargs || {} } }) }); const j = await r.json(); if (j.error) throw new Error(j.error.data && j.error.data.message); return j.result; };
const ids = await rpc('product.template', 'search', [[['website_published', '=', true], ['public_categ_ids', 'child_of', [118, 119]], ['allow_out_of_stock_order', '=', false]]]);
if (ids.length) await rpc('product.template', 'write', [ids, { allow_out_of_stock_order: true }]);
window.__step34 = { updated: ids.length };
