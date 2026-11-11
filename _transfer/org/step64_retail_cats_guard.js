// Step 6.4 — retail category order/names (as on organicopia-lb.com, Nov 9 revisions) + brand guard:
// only Organicopia-branded products may be published on the Organicopia website (website 1 / all websites). Idempotent.
const rpc = async (model, method, args, kwargs) => { const r = await fetch('/web/dataset/call_kw', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: { model, method, args, kwargs: kwargs || {} } }) }); const j = await r.json(); if (j.error) throw new Error(j.error.data && j.error.data.message); return j.result; };
const C = { allowed_company_ids: [1, 2, 3] };
const log = {};
// 1. categories
const ORDER = [['Cooking Essentials', 'The pantry staples a clean kitchen reaches for first.'], ['Baking', 'Single-origin cacao and the clean baking shelf.'], ['Spices', 'Single-origin spices, ground and whole.'],
  ['Seeds & Pantry', 'Raw seeds and whole kernels, kept simple.'], ['Clean Sweeteners', 'Clean cane sugar and leaf stevia.'], ['Daily Care', 'Cold-pressed oils and simple care for skin and hair.'],
  ['Wellness', 'Green powders and gentle support.'], ['Fresh from the Oven', 'Baked in small batches with organic ingredients. Cookies, brownies, sablés, petit fours.'], ['Sweet Things', 'Berry-bright chews and little treats, made clean.']];
const root = (await rpc('product.public.category', 'search_read', [[['name', '=', 'Organicopia'], ['parent_id', '=', false]]], { fields: ['id'] }))[0].id;
const seeds = await rpc('product.public.category', 'search_read', [[['name', '=', 'Seeds'], ['parent_id', '=', root]]], { fields: ['id'] });
if (seeds.length) await rpc('product.public.category', 'write', [[seeds[0].id], { name: 'Seeds & Pantry' }]);
let seq = 1;
for (const [name, desc] of ORDER) {
  const c = await rpc('product.public.category', 'search_read', [[['name', '=', name], ['parent_id', '=', root]]], { fields: ['id'] });
  if (c.length) await rpc('product.public.category', 'write', [[c[0].id], { sequence: seq, website_description: desc }]);
  seq++;
}
log.categories = seq - 1;
// 2. brand guard: sweep now
const bad = await rpc('product.template', 'search', [[['website_id', 'in', [1, false]], ['x_brand', '!=', 'Organicopia']]], { context: C });
if (bad.length) await rpc('product.template', 'write', [bad, { website_id: 6 }], { context: C });
log.movedToWholesale = bad.length;
// 3. brand guard: automation rule (base_automation) so it stays true
const code = `# Only Organicopia-branded products may be listed on the Organicopia website.
for rec in records:
    if (rec.x_brand or '') != 'Organicopia' and (not rec.website_id or rec.website_id.id == 1):
        rec.write({'website_id': 6})`;
const mid = (await rpc('ir.model', 'search_read', [[['model', '=', 'product.template']]], { fields: ['id'] }))[0].id;
const fld = await rpc('ir.model.fields', 'search_read', [[['model', '=', 'product.template'], ['name', 'in', ['website_id', 'website_published', 'x_brand', 'is_published']]]], { fields: ['id', 'name'] });
const ex = await rpc('base.automation', 'search_read', [[['name', '=', 'Organicopia website: brand guard']]], { fields: ['id', 'action_server_ids'] });
if (!ex.length) {
  const aid = await rpc('base.automation', 'create', [{ name: 'Organicopia website: brand guard', model_id: mid, trigger: 'on_create_or_write', trigger_field_ids: [[6, 0, fld.map(f => f.id)]], active: true }]);
  await rpc('ir.actions.server', 'create', [{ name: 'Organicopia website: brand guard', model_id: mid, state: 'code', code, base_automation_id: aid, usage: 'base_automation' }]);
  log.automation = 'created ' + aid;
} else log.automation = 'exists ' + ex[0].id;
window.__step64 = log;
