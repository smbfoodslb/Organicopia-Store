// Step 4.7 — Simply Organic vanilla (customer-revised text), Brunswick Mediterranean (label), Orgain collagen + probiotics, cinnamon toothpaste. Idempotent.
const rpc = async (model, method, args, kwargs) => { const r = await fetch('/web/dataset/call_kw', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: { model, method, args, kwargs: kwargs || {} } }) }); const j = await r.json(); if (j.error) throw new Error(j.error.data && j.error.data.message); return j.result; };
const D = (d, i, a) => `<p>${d}</p>` + (i ? `<p><strong>Ingredients:</strong> ${i}</p>` : '') + (a ? `<p><strong>Allergen info:</strong> ${a}</p>` : '');
const T = {
  '133': D('This delicious vanilla flavoring is perfect for baking, cooking, and adding to beverages. Made from organic ingredients, it brings a pure, rich taste to your favorite recipes. It’s a great choice for those looking for an alcohol-free vanilla option. Use it in desserts, smoothies, or even in coffee for a delicious flavor boost. Great for baking and cooking; alcohol-free.', 'Organic Glycerin, Organic Vanilla Bean Extractives in Water.'),
  '55070': D('Orgain 3-in-1 collagen blend: 20 g of grass-fed, pasture-raised Type I & III collagen peptides with prebiotics and 1 billion CFU probiotics per scoop, for gut and digestive support alongside skin, hair, nail and joint health. Unflavored and ready to mix. Made without dairy, lactose or soy; gluten-free, paleo-friendly, non-GMO, 0 g sugar, no artificial flavors, preservatives or colors. 1 lb (454 g).', 'Collagen Peptides (Bovine), Prebiotic (Xylo-Oligosaccharides), Probiotic (Bacillus coagulans SNZ1969).'),
};
const V = {
  '11401': D('Mediterranean: lightly smoked brisling sardines in extra virgin olive oil steeped with herbs de Provence and garnished with black olives. Product of Latvia.', 'Lightly Smoked Brisling Sprats, Extra Virgin Olive Oil, Black Olives (Water, Salt, Ferrous Gluconate to maintain color), Salt, Herbs and Spices, Red Bell Pepper Flakes, Extractives of Paprika (Color).', 'Contains sprats (fish).'),
  '62702': D('Cinnamon.', 'Sodium Bentonite Clay, Fluoride-Free Spring Water, Organic Ceylon Cinnamon Bark Oil, Unrefined Mineral Salt.'),
};
const log = {};
for (const [code, html] of Object.entries(T)) { const v = await rpc('product.product', 'search_read', [[['default_code', '=', code]]], { fields: ['product_tmpl_id'] }); if (!v.length) { log[code] = 'not found'; continue; } await rpc('product.template', 'write', [[v[0].product_tmpl_id[0]], { description_ecommerce: html }]); log[code] = 'ok'; }
for (const [code, html] of Object.entries(V)) { const v = await rpc('product.product', 'search_read', [[['default_code', '=', code]]], { fields: ['id'] }); if (!v.length) { log[code] = 'not found'; continue; } await rpc('product.product', 'write', [[v[0].id], { x_desc_variant: html }]); log[code] = 'ok'; }
window.__step47 = log;
