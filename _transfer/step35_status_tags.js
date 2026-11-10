// Step 3.5 — availability tags the team can set on a product (Product Tags field): "Coming soon" / "Not available"; order-pending message. Idempotent.
const rpc = async (model, method, args, kwargs) => { const r = await fetch('/web/dataset/call_kw', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: { model, method, args, kwargs: kwargs || {} } }) }); const j = await r.json(); if (j.error) throw new Error(j.error.data && j.error.data.message); return j.result; };
const log = {}; const tagIds = {};
for (const n of ['Coming soon', 'Not available']) { const t = await rpc('product.tag', 'search_read', [[['name', '=', n]]], { fields: ['id'] }); tagIds[n] = t.length ? t[0].id : await rpc('product.tag', 'create', [{ name: n }]); }
log.tagIds = tagIds;
// Batana Oil: bad batch, no longer sold -> keep the card, mark Not available
const bat = await rpc('product.template', 'search_read', [[['default_code', '=', '624']]], { fields: ['id', 'product_tag_ids'] });
if (bat.length && !bat[0].product_tag_ids.includes(tagIds['Not available'])) { await rpc('product.template', 'write', [[bat[0].id], { product_tag_ids: [[4, tagIds['Not available']]] }]); log.batana = 'tagged Not available'; } else log.batana = bat.length ? 'already tagged' : 'not found';
// message shown after an order is confirmed (pay on delivery provider, company 3)
const MSG = '<p>Thank you for choosing us! Your order has been received and is currently pending confirmation. We\'ll reach out to you on WhatsApp to confirm the quantities, delivery date, and final total. Payment is simply collected upon delivery.</p><p>We look forward to serving you!</p>';
const prov = await rpc('payment.provider', 'search_read', [[['code', '=', 'custom'], ['company_id', '=', 3], ['website_id', '=', 6]]], { fields: ['id', 'name'] });
for (const p of prov) { await rpc('payment.provider', 'write', [[p.id], { pending_msg: MSG }]); log['provider ' + p.id] = 'message set'; }
window.__step35 = log;
