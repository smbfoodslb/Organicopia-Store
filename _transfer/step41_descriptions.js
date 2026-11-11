// Step 4.1 — descriptions for website products that had none (bulk line, kits, a few partner brands) + 2 junk-import fixes. Idempotent (overwrites these only).
const rpc = async (model, method, args, kwargs) => { const r = await fetch('/web/dataset/call_kw', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: { model, method, args, kwargs: kwargs || {} } }) }); const j = await r.json(); if (j.error) throw new Error(j.error.data && j.error.data.message); return j.result; };
const D = (d, i) => `<p>${d}</p>` + (i ? `<p><strong>Ingredients:</strong> ${i}</p>` : '');
const BULK = ' Sold in bulk by the kilogram for kitchens, bakeries and repackers.';
const BY_CODE = {
  // Organicopia bulk line (same sourcing as the retail jars)
  '31201': D('Cold-pressed organic cacao butter from Peru: the pale, aromatic fat of the cacao bean, for chocolate making, baking and body care.' + BULK, 'Organic Cacao Butter (Theobroma cacao).'),
  '31300': D('Crunchy, semi-bitter raw cacao nibs from organic Ecuadorian Arriba Nacional beans. Lovely in smoothies, oatmeal, baking and bean-to-bar chocolate.' + BULK, '100% Organic Cacao Beans (Arriba Nacional Beans).'),
  '31000': D('Organic cacao paste (cacao liquor) from Peru: whole fermented cacao beans ground to a smooth 100% cacao mass, the base for chocolate, brownies and hot cocoa.' + BULK, 'Organic Cacao Paste (Theobroma cacao).'),
  '309': D('Fermented, sun-dried and cold-pressed raw cacao powder, never roasted, with a rich, velvety texture and 20 to 22% fat.' + BULK, 'Organic Raw Cacao Powder (Theobroma cacao).'),
  '13602': D('True Ceylon cinnamon powder, softer and sweeter than everyday cassia. Third-party lab tested for purity and heavy metals.' + BULK, 'Organic Ceylon Cinnamon Powder (Cinnamomum zeylanicum).'),
  '427': D('Food-grade activated charcoal powder made from organic coconut shells, made in the USA.' + BULK, 'Organic Coconut Charcoal.'),
  '13611': D('Finely ground organic garlic with nothing added. An everyday seasoning for vegetables, legumes, meat and marinades.' + BULK, 'Organic Garlic.'),
  '13600': D('Finely ground organic ginger root from India, with a warm, spicy flavor for teas, baking and curries.' + BULK, 'Organic Ginger Root Powder (Zingiber officinale).'),
  '13607': D('Fine, cold-processed hemp protein powder with 50% protein, grown in Lithuania. Pressed without hexane or other solvents.' + BULK, 'Organic Hemp Protein (Cannabis sativa).'),
  '13608': D('A warm, savory-sweet blend of organic Ceylon cinnamon, ginger, nutmeg and cloves. Perfect for pumpkin pie, baking and drinks.' + BULK, 'Organic Ceylon Cinnamon, Organic Ginger, Organic Nutmeg, Organic Cloves.'),
  '13603': D('Earthy, golden turmeric root powder from India, ground from the whole root. For curries, golden milk and rice.' + BULK, 'Organic Turmeric Root Powder (Curcuma longa).'),
  '14524': D('Raw hulled sesame seeds from small organic farms, with a rich, nutty flavor. Ideal for tahini, baking and toppings.' + BULK, 'Organic Hulled Sesame Seeds (Sesamum indicum).'),
  '14503': D('Raw, unhulled black sesame seeds with a bold, nutty aroma. Lovely in baking, desserts and Asian dishes.' + BULK, 'Organic Black Sesame Seeds.'),
  '13606': D('Wide-cut chips from the white flesh of mature Sri Lankan coconuts, gently dried to stay naturally sweet and chewy.' + BULK, 'Organic Coconut Chips (Cocos nucifera).'),
  '13606BK': D('Wide-cut Sri Lankan coconut chips, lightly toasted for a crisp, nutty snack. Unsweetened and unsalted.' + BULK, 'Organic Toasted Coconut Chips (Cocos nucifera).'),
  '92041': D('Sun-dried Turkish apricots, harvested ripe and gently dried. Chewy and naturally sweet, with no added sugar or sulphur.' + BULK, 'Organic Apricots (Prunus armeniaca).'),
  '92047': D('Spanish paprika smoked over oak wood for a sweet, earthy flavor and deep color. Great with eggs, beans, potatoes and grilled meats.' + BULK, 'Organic Smoked Paprika.'),
  '14516BK': D('A smoky, savory Cajun blend with a touch of heat. Made for blackened fish and shrimp, grilled chicken, oven fries and corn.' + BULK, 'Organic Paprika, Sea Salt, Organic Onion, Organic Garlic, Organic Oregano, Organic Thyme, Organic Cayenne, Organic Smoked Paprika, Organic Rice Concentrate, Organic Celery Seed.'),
  '14515BK': D('Ground organic cayenne from India at 50,000 Scoville heat units: a medium-hot cayenne that adds clean heat and color to any dish.' + BULK, 'Organic Cayenne Pepper.'),
  '92109': D('Dried organic onion granules with a sweet, savory onion flavor that disperses evenly in rubs, soups, sauces and dressings.' + BULK, 'Organic Onion.'),
  // junk-import fixes
  '14509': D('Organic yellow popcorn kernels grown in the USA. Pops up big, fluffy and crunchy on the stove or in an air popper.', 'Organic Yellow Popcorn.'),
  // kits and partner brands
  '12341': D('A complete gingerbread house kit baked by Organicopia in Lebanon with Certified Organic ingredients: pre-baked walls and roof, icing and candy decorations, with assembly instructions. Large size. Seasonal, limited quantities.'),
  '12342': D('A complete gingerbread house kit baked by Organicopia in Lebanon with Certified Organic ingredients: pre-baked walls and roof, icing and candy decorations, with assembly instructions. Medium size. Seasonal, limited quantities.'),
  '428': D('Hand-harvested Celtic sea salt from the Atlantic coast of France, naturally moist and grey from the clay salt beds, unrefined and rich in trace minerals.', 'Sea Salt.'),
  '187': D('YumEarth organic lollipops in a 250-count bulk bag: real fruit flavors, organic sweeteners, free from the top allergens and artificial dyes. Vitamin C and Assorted Fruit varieties.'),
  '191': D('Soft, chewy organic black licorice with a classic anise flavor. Gluten-free, vegan and made without artificial dyes.'),
  '192': D('Soft, chewy organic strawberry licorice. Gluten-free, vegan and made without artificial dyes.'),
  '92132': D('YumEarth Choco Yums: creamy organic chocolate candies with a crunchy candy shell, colored with fruit and vegetable juices. Free from the top allergens and artificial dyes.'),
  '43701': D('Four Sigmatic organic instant coffee in single-serve 2.5 g sachets, blended with functional mushrooms. Balance (with ashwagandha and chaga), Protect (with chaga and turkey tail) and the caffeine-free Golden Latte mix (turmeric and turkey tail). Sold in packs of 10 sachets.'),
};
const BY_NAME = {
  'Organicopia Organic Coconut Activated Charcoal Powder - 35g': D('Food-grade activated charcoal powder made from organic coconut shells, made in the USA.', 'Organic Coconut Charcoal.'),
};
const log = { set: [], missing: [] };
for (const [code, html] of Object.entries(BY_CODE)) {
  const v = await rpc('product.product', 'search_read', [[['default_code', '=', code]]], { fields: ['product_tmpl_id'] });
  if (!v.length) { log.missing.push(code); continue; }
  await rpc('product.template', 'write', [[v[0].product_tmpl_id[0]], { description_ecommerce: html }]); log.set.push(code);
}
for (const [name, html] of Object.entries(BY_NAME)) {
  const t = await rpc('product.template', 'search_read', [[['name', '=', name]]], { fields: ['id'] });
  if (t.length) { await rpc('product.template', 'write', [[t[0].id], { description_ecommerce: html }]); log.set.push(name); } else log.missing.push(name);
}
window.__step41 = log;
