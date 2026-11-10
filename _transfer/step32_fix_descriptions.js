// Step 3.2 — replace legacy mis-imported eCommerce descriptions (graphics cards, shoes, toys…) with the site copy. Idempotent.
const rpc = async (model, method, args, kwargs) => { const r = await fetch('/web/dataset/call_kw', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: { model, method, args, kwargs: kwargs || {} } }) }); const j = await r.json(); if (j.error) throw new Error(j.error.data && j.error.data.message); return j.result; };
const D = (d, i) => `<p>${d}</p><p><strong>Ingredients:</strong> ${i}</p>`;
const FIX = {
  3391: D('Hulled organic hemp seeds with a mild, nutty flavor. Ready to sprinkle on smoothies, salads, cereal and baking with no grinding needed.', 'Organic Hemp Seed.'),
  2970: D('Pure organic stevia leaf extract powder, a zero-calorie sweetener. A tiny scoop goes a long way in drinks and baking.', 'Organic Stevia Leaf Extract (Stevia rebaudiana).'),
  3371: D('Whole organic poppy seeds with a subtle, earthy flavor and a satisfying crunch. For breads, bagels, cakes and dressings. Sold in bulk.', 'Organic Poppy Seeds (Papaver somniferum).'),
  3486: D('Food-grade activated charcoal powder made from organic coconut shells, made in the USA.', 'Organic Coconut Charcoal.'),
  3096: D('A warm, savory-sweet blend of organic Ceylon cinnamon, ginger, nutmeg and cloves. Perfect for pumpkin pie, baking and drinks.', 'Organic Ceylon Cinnamon, Organic Ginger, Organic Nutmeg, Organic Cloves.'),
  3103: D('Organic cane sugar ground ultra-fine for smooth frostings, glossy glazes and delicate dusting. Swap it one-for-one for regular powdered sugar.', 'Organic Cane Sugar.'),
  3465: false, // YumEarth Choco Yums carried the Black Licorice text — cleared until real copy exists
};
const log = {};
for (const [tid, html] of Object.entries(FIX)) { await rpc('product.template', 'write', [[+tid], { description_ecommerce: html }]); log[tid] = html ? 'fixed' : 'cleared'; }
window.__step32 = log;
