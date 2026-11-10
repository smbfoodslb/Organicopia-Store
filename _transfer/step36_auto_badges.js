// Step 3.6 — automatic "New" (60 days after first publish) and "Back in stock" (30 days after a zero→positive restock).
// Fields + automation rules; the manual New / Back in stock tags are retired. Idempotent.
const rpc = async (model, method, args, kwargs) => { const r = await fetch('/web/dataset/call_kw', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: { model, method, args, kwargs: kwargs || {} } }) }); const j = await r.json(); if (j.error) throw new Error(j.error.data && j.error.data.message); return j.result; };
const log = {};
const modelId = async (m) => (await rpc('ir.model', 'search_read', [[['model', '=', m]]], { fields: ['id'] }))[0].id;
const fieldId = async (m, n) => (await rpc('ir.model.fields', 'search_read', [[['model', '=', m], ['name', '=', n]]], { fields: ['id'] }))[0].id;
const today = new Date().toISOString().slice(0, 10);

// 1. date fields
for (const [m, name, label] of [['product.template', 'x_published_on', 'First published on website'], ['product.product', 'x_restocked_on', 'Back in stock since']]) {
  const ex = await rpc('ir.model.fields', 'search_count', [[['model', '=', m], ['name', '=', name]]]);
  if (!ex) { await rpc('ir.model.fields', 'create', [{ name, model_id: await modelId(m), ttype: 'date', field_description: label, state: 'manual' }]); log[name] = 'created'; } else log[name] = 'exists';
}

// 2. seed from the current manual tags (one-off), then retire the tags
const tag = async (n) => { const t = await rpc('product.tag', 'search_read', [[['name', '=', n]]], { fields: ['id'] }); return t.length ? t[0].id : null; };
const tNew = await tag('New'), tBack = await tag('Back in stock');
const pub = await rpc('product.template', 'search_read', [[['website_published', '=', true], ['x_published_on', '=', false]]], { fields: ['id', 'create_date', 'product_tag_ids'] });
let nNew = 0, nOld = 0;
for (const t of pub) {
  const isNew = tNew && t.product_tag_ids.includes(tNew);
  await rpc('product.template', 'write', [[t.id], { x_published_on: isNew ? today : t.create_date.slice(0, 10) }]);
  isNew ? nNew++ : nOld++;
}
log.seedPublished = `${nNew} as new today, ${nOld} from creation date`;
if (tBack) {
  const vs = await rpc('product.product', 'search_read', [[['all_product_tag_ids', 'in', [tBack]], ['x_restocked_on', '=', false]]], { fields: ['id', 'free_qty'] });
  const withStock = vs.filter(v => v.free_qty > 0).map(v => v.id);
  if (withStock.length) await rpc('product.product', 'write', [withStock, { x_restocked_on: today }]);
  log.seedRestocked = `${withStock.length} of ${vs.length} tagged items had stock`;
}
const retire = [tNew, tBack].filter(Boolean);
if (retire.length) { await rpc('product.tag', 'unlink', [retire]); log.tagsRetired = retire.length; }

// 3. automation rules (replace if present)
const mkRule = async (name, model, triggerField, domain, code) => {
  const old = await rpc('base.automation', 'search_read', [[['name', '=', name]]], { fields: ['id'] });
  if (old.length) await rpc('base.automation', 'unlink', [old.map(o => o.id)]);
  const mid = await modelId(model);
  const ruleId = await rpc('base.automation', 'create', [{ name, model_id: mid, trigger: 'on_create_or_write', trigger_field_ids: [[6, 0, [await fieldId(model, triggerField)]]], filter_domain: domain, active: true }]);
  await rpc('ir.actions.server', 'create', [{ name: name + ' (code)', model_id: mid, state: 'code', usage: 'base_automation', base_automation_id: ruleId, code }]);
  return ruleId;
};
log.rulePublish = await mkRule('SMB website: stamp first publish date', 'product.template', 'website_published',
  "[('website_published', '=', True), ('x_published_on', '=', False)]",
  "for r in records:\n    r.write({'x_published_on': datetime.date.today()})");
log.ruleRestock = await mkRule('SMB website: stamp back-in-stock date', 'stock.move', 'state',
  "[('state', '=', 'done'), ('location_dest_id.usage', '=', 'internal'), ('location_id.usage', '!=', 'internal')]",
  "today = datetime.date.today()\nfor m in records:\n    p = m.product_id\n    if m.quantity > 0 and p.qty_available - m.quantity <= 0:\n        p.write({'x_restocked_on': today})");
window.__step36 = log;
