// Step 3.9 — batch of catalogue changes requested 2026-11-11. Idempotent. Expects window.__SMB_BASE (images in img2/).
const BASE = window.__SMB_BASE;
const rpc = async (model, method, args, kwargs) => { const r = await fetch('/web/dataset/call_kw', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: { model, method, args, kwargs: kwargs || {} } }) }); const j = await r.json(); if (j.error) throw new Error(j.error.data && j.error.data.message); return j.result; };
const b64 = async (url) => { const r = await fetch(url); if (!r.ok) throw new Error('fetch ' + url + ' ' + r.status); const buf = new Uint8Array(await r.arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000)); return btoa(s); };
const modelId = async (m) => (await rpc('ir.model', 'search_read', [[['model', '=', m]]], { fields: ['id'] }))[0].id;
const byCode = async (code) => { const v = await rpc('product.product', 'search_read', [[['default_code', '=', code], ['active', 'in', [true, false]]]], { fields: ['id', 'product_tmpl_id', 'active'] }); return v[0]; };
const log = {};
// 1. unpublish pumpkin seeds bulk & coconut butter bulk
for (const c of ['13604', '13690BK']) { const v = await byCode(c); await rpc('product.template', 'write', [[v.product_tmpl_id[0]], { website_published: false }]); log['unpublish ' + c] = 'ok'; }
// 2. photos (variant image; template image = first variant for multi-variant products, as approved)
for (const [c, f] of [['128', '128_01.jpg'], ['43701', '43701_01.jpg'], ['43901', '43901_01.jpg'], ['92121', '92121_01.jpg']]) {
  const v = await byCode(c); const datas = await b64(BASE + 'img2/' + f);
  await rpc('product.product', 'write', [[v.id], { image_variant_1920: datas }]);
  const t = (await rpc('product.template', 'read', [[v.product_tmpl_id[0]], ['product_variant_ids']]))[0];
  if (t.product_variant_ids[0] === v.id || c === '43701') await rpc('product.template', 'write', [[t.id], { image_1920: datas }]);
  log['photo ' + c] = 'ok';
}
// 3. pack quantity field: products sold in fixed packs (Four Sigmatic sachets: 10)
{
  const ex = await rpc('ir.model.fields', 'search_count', [[['model', '=', 'product.template'], ['name', '=', 'x_pack_qty']]]);
  if (!ex) await rpc('ir.model.fields', 'create', [{ name: 'x_pack_qty', model_id: await modelId('product.template'), ttype: 'integer', field_description: 'Website pack quantity (sold in multiples of)', state: 'manual' }]);
  const v = await byCode('43701'); await rpc('product.template', 'write', [[v.product_tmpl_id[0]], { x_pack_qty: 10 }]); log.packQty = 'Four Sigmatic = 10';
}
// 4. website stock threshold: out of stock on the website once free stock is at or below this (reserved for manufacturing)
{
  const ex = await rpc('ir.model.fields', 'search_count', [[['model', '=', 'product.template'], ['name', '=', 'x_web_min_stock']]]);
  if (!ex) await rpc('ir.model.fields', 'create', [{ name: 'x_web_min_stock', model_id: await modelId('product.template'), ttype: 'float', field_description: 'Website: out of stock at or below', state: 'manual' }]);
  const v = await byCode('309'); await rpc('product.template', 'write', [[v.product_tmpl_id[0]], { x_web_min_stock: 10 }]); log.minStock = 'cacao powder bulk = 10';
}
// 5. archive 497 (Orgain collagen keto chocolate) and 195 (YumEarth Giggles sour); unpublish the template if nothing is left
for (const c of ['497', '195']) {
  const v = await byCode(c); if (v.active) await rpc('product.product', 'write', [[v.id], { active: false }]);
  const left = await rpc('product.product', 'search_count', [[['product_tmpl_id', '=', v.product_tmpl_id[0]]]]);
  if (!left) await rpc('product.template', 'write', [[v.product_tmpl_id[0]], { website_published: false, active: false }]);
  log['archive ' + c] = left ? 'variant archived, template keeps ' + left : 'template archived too';
}
// 6. bakery order (as on the old site) with the gingerbread kits first + Holiday item badge
{
  const order = { 3431: 1, 3432: 2, 1475: 3, 1473: 4, 1470: 5, 1474: 6, 1469: 7 };
  for (const [tid, seq] of Object.entries(order)) await rpc('product.template', 'write', [[+tid], { website_sequence: seq }]);
  const tag = await rpc('product.tag', 'search_read', [[['name', '=', 'Holiday item']]], { fields: ['id'] });
  if (tag.length) await rpc('product.template', 'write', [[3431, 3432], { product_tag_ids: [[4, tag[0].id]] }]);
  log.bakery = 'ordered, gingerbread tagged Holiday item';
}
window.__step39 = log;
