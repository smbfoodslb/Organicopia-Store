// Step 3.8 — country of origin comes from Odoo's own "Origin of Goods" field. Fill the gaps that can be derived safely. Idempotent.
const rpc = async (model, method, args, kwargs) => { const r = await fetch('/web/dataset/call_kw', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: { model, method, args, kwargs: kwargs || {} } }) }); const j = await r.json(); if (j.error) throw new Error(j.error.data && j.error.data.message); return j.result; };
const country = async (code) => (await rpc('res.country', 'search_read', [[['code', '=', code]]], { fields: ['id'] }))[0].id;
const FIX = { // default_code or exact name -> ISO code
  'Organicopia Fruit Snacks': 'US',                      // Berrilicious & co: made in the USA (old site said France — wrong)
  '92108': 'US', '14501-50': 'TR', '20901': 'MX',        // from the site's own tags
  // bulk items take the origin of their retail counterpart
  'Organic Apricots Bulk': 'TR', 'Organic Black Sesame Seeds (Raw) Bulk': 'MX', 'Organic Blackened Cajun Seasoning - Bulk': 'US',
  'Organic Cacao Nibs - Bulk': 'EC', 'Organic Cacao Powder 20-22% Bulk': 'PE', 'Organic Cayenne Pepper 50K - Bulk': 'IN',
  'Organic Ceylon Cinnamon Powder Bulk': 'LK', 'Organic Coconut Activated Charcoal Powder - Bulk': 'US', 'Organic Coconut Butter - Bulk': 'PH',
  'Organic Coconut Chips (Raw) Bulk': 'LK', 'Organic Coconut Chips (Toasted) Bulk': 'LK', 'Organic Garlic Powder Bulk': 'IN',
  'Organic Ginger Root Powder Bulk': 'IN', 'Organic Hemp Protein Powder Bulk': 'LT', 'Organic Pumpkin Pie Spice Bulk': 'US',
  'Organic Raw Poppy Seeds - Bulk': 'TR', 'Organic Sesame Seeds (Hulled) - Bulk': 'MX', 'Organic Smoked Paprika Bulk': 'ES', 'Organic Turmeric Root Powder Bulk': 'IN',
};
const log = {};
for (const [key, code] of Object.entries(FIX)) {
  const dom = /^[0-9]/.test(key) ? [['default_code', '=', key]] : [['name', '=', key]];
  const t = await rpc('product.template', 'search_read', [dom], { fields: ['id', 'country_of_origin'] });
  if (!t.length) { log[key] = 'not found'; continue; }
  const cid = await country(code);
  const todo = t.filter(x => !x.country_of_origin || x.country_of_origin[0] !== cid).map(x => x.id);
  if (todo.length) await rpc('product.template', 'write', [todo, { country_of_origin: cid }]);
  log[key] = todo.length ? 'set ' + code : 'ok';
}
const still = await rpc('product.template', 'search_read', [[['website_published', '=', true], ['public_categ_ids', 'child_of', [118, 119]], ['country_of_origin', '=', false]]], { fields: ['name', 'default_code'] });
log.stillMissing = still.map(s => (s.default_code || '') + ' ' + s.name);
window.__step38 = log;
