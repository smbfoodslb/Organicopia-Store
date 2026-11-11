// Step 6.0 — Organicopia retail data: categories (website 1), website assignment of products, certification badges,
// RETAIL LB quantity tiers (3+, 6+), pricelist/public-user wiring. Idempotent. Expects window.__RETAIL (compact data).
const R = window.__RETAIL;
const rpc = async (model, method, args, kwargs) => { const r = await fetch('/web/dataset/call_kw', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: { model, method, args, kwargs: kwargs || {} } }) }); const j = await r.json(); if (j.error) throw new Error(j.error.data && j.error.data.message); return j.result; };
const C = { allowed_company_ids: [1, 2, 3] };
const log = {};
const retailTids = [...new Set(R.items.map(i => i.tid))];
// 1. retail public categories (website 1)
let root = await rpc('product.public.category', 'search_read', [[['name', '=', 'Organicopia'], ['parent_id', '=', false]]], { fields: ['id'] });
const rootId = root.length ? root[0].id : await rpc('product.public.category', 'create', [{ name: 'Organicopia', website_id: 1 }]);
const catIds = {};
let seq = 1;
for (const [title, desc] of R.cats) {
  const ex = await rpc('product.public.category', 'search_read', [[['name', '=', title], ['parent_id', '=', rootId]]], { fields: ['id'] });
  catIds[title] = ex.length ? ex[0].id : await rpc('product.public.category', 'create', [{ name: title, parent_id: rootId, website_id: 1, sequence: seq, website_description: desc }]);
  await rpc('product.public.category', 'write', [[catIds[title]], { sequence: seq, website_description: desc }]);
  seq++;
}
log.categories = Object.keys(catIds).length;
// assign templates to their retail category (keeping wholesale categories)
for (const tid of retailTids) {
  const cats = [...new Set(R.items.filter(i => i.tid === tid).map(i => catIds[i.cat]))];
  await rpc('product.template', 'write', [[tid], { public_categ_ids: cats.map(id => [4, id]) }]);
}
// 2. website assignment: wholesale-only -> website 6; retail-only -> website 1; both -> all websites
const wholesaleTids = await rpc('product.template', 'search', [[['website_published', '=', true], ['public_categ_ids', 'child_of', [118, 119]]]]);
const retailSet = new Set(retailTids), wholesaleSet = new Set(wholesaleTids);
const onlyW = wholesaleTids.filter(t => !retailSet.has(t)), onlyR = retailTids.filter(t => !wholesaleSet.has(t)), both = retailTids.filter(t => wholesaleSet.has(t));
if (onlyW.length) await rpc('product.template', 'write', [onlyW, { website_id: 6 }]);
if (onlyR.length) await rpc('product.template', 'write', [onlyR, { website_id: 1, website_published: true }]);
if (both.length) await rpc('product.template', 'write', [both, { website_id: false }]);
log.websites = { wholesaleOnly: onlyW.length, retailOnly: onlyR.length, both: both.length };
// 3. certification badges + retail size/sub text on retail-only products
{
  const ex = await rpc('ir.model.fields', 'search_count', [[['model', '=', 'product.template'], ['name', '=', 'x_certifications']]]);
  if (!ex) { const mid = (await rpc('ir.model', 'search_read', [[['model', '=', 'product.template']]], { fields: ['id'] }))[0].id; await rpc('ir.model.fields', 'create', [{ name: 'x_certifications', model_id: mid, ttype: 'char', field_description: 'Certifications / claims (· separated)', state: 'manual' }]); }
  let n = 0;
  for (const tid of retailTids) {
    const first = R.items.find(i => i.tid === tid);
    const vals = { x_certifications: (first.badges || []).join(' · ') };
    if (onlyR.includes(tid)) vals.x_size = (first.tags || []).join(' · ');
    await rpc('product.template', 'write', [[tid], vals]); n++;
  }
  log.certifications = n;
}
// 4. RETAIL LB tiers: 3+ and 6+ unit prices (excl. VAT) per variant
{
  let created = 0, updated = 0;
  const existing = await rpc('product.pricelist.item', 'search_read', [[['pricelist_id', '=', 27], ['applied_on', '=', '0_product_variant'], ['min_quantity', '>', 1]]], { fields: ['id', 'product_id', 'min_quantity', 'fixed_price'] });
  for (const it of R.items) {
    for (const [qty, price] of it.tiers.filter(t => t[0] > 1)) {
      const ex = existing.find(e => e.product_id[0] === it.vid && e.min_quantity === qty);
      const fixed = +(price / 1.11).toFixed(4);
      if (ex) { if (Math.abs(ex.fixed_price - fixed) > 0.0001) { await rpc('product.pricelist.item', 'write', [[ex.id], { fixed_price: fixed }]); updated++; } }
      else { await rpc('product.pricelist.item', 'create', [{ pricelist_id: 27, applied_on: '0_product_variant', product_id: it.vid, min_quantity: qty, compute_price: 'fixed', fixed_price: fixed }]); created++; }
    }
  }
  log.tiers = { created, updated };
}
// 5. pricelists per website; website 1 public visitor on RETAIL LB
await rpc('product.pricelist', 'write', [[27], { website_id: 1 }]);
const w1 = (await rpc('website', 'read', [[1], ['user_id']], { context: C }))[0];
const pub = (await rpc('res.users', 'read', [[w1.user_id[0]], ['partner_id']], { context: C }))[0].partner_id[0];
for (const c of [1, 3]) await rpc('res.partner', 'write', [[pub], { property_product_pricelist: 27 }], { context: { allowed_company_ids: [c], company_id: c } });
log.publicPartner = pub;
window.__step60 = log;
