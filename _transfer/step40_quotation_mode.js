// Step 4.0 — web orders stay quotations ("Quotation Sent") for the team to confirm; nothing is auto-confirmed. Idempotent.
// In Odoo 19 the "cash on delivery" custom mode confirms the sale order immediately; "wire transfer" mode leaves it as a sent quotation.
const rpc = async (model, method, args, kwargs) => { const r = await fetch('/web/dataset/call_kw', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: { model, method, args, kwargs: kwargs || {} } }) }); const j = await r.json(); if (j.error) throw new Error(j.error.data && j.error.data.message); return j.result; };
const log = {};
await rpc('payment.provider', 'write', [[26], { custom_mode: 'wire_transfer' }]); log.provider = 'wire_transfer mode (quotation stays unconfirmed)';
const pm = await rpc('payment.method', 'search_read', [[['code', '=', 'cash_on_delivery']]], { fields: ['id', 'name'] });
if (pm.length && pm[0].name !== 'Pay on delivery') { await rpc('payment.method', 'write', [[pm[0].id], { name: 'Pay on delivery' }]); log.method = 'renamed'; } else log.method = 'ok';
window.__step40 = log;
