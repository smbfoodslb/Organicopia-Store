// Step 3.7 — the customer pricelist is a per-company property; the website runs in company 3 (SOUL MIND BODY FOODS SARL).
// Set WHOLESALE LB (24) for the public website partner and every wholesale portal customer IN COMPANY 3. Idempotent.
const C = { allowed_company_ids: [3], company_id: 3 };
const rpc = async (model, method, args, kwargs) => { const r = await fetch('/web/dataset/call_kw', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: { model, method, args, kwargs: kwargs || {} } }) }); const j = await r.json(); if (j.error) throw new Error(j.error.data && j.error.data.message); return j.result; };
const us = await rpc('res.users', 'search_read', [[['login', 'like', '@smbfoods-lb.com'], ['share', '=', true]]], { fields: ['partner_id'] });
const ids = [265, ...us.map(u => u.partner_id[0])];
const before = await rpc('res.partner', 'read', [ids, ['name', 'property_product_pricelist']], { context: C });
const wrong = before.filter(p => !p.property_product_pricelist || p.property_product_pricelist[0] !== 24);
if (wrong.length) await rpc('res.partner', 'write', [wrong.map(p => p.id), { property_product_pricelist: 24 }], { context: C });
// also company 1, so the record reads the same everywhere
const b1 = await rpc('res.partner', 'read', [ids, ['property_product_pricelist']], { context: { allowed_company_ids: [1], company_id: 1 } });
const w1 = b1.filter(p => !p.property_product_pricelist || p.property_product_pricelist[0] !== 24);
if (w1.length) await rpc('res.partner', 'write', [w1.map(p => p.id), { property_product_pricelist: 24 }], { context: { allowed_company_ids: [1], company_id: 1 } });
window.__step37 = { checked: ids.length, fixedCompany3: wrong.map(p => p.name), fixedCompany1: w1.length };
