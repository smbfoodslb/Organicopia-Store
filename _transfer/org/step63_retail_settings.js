// Step 6.3 — Organicopia website checkout settings: shared pay-on-delivery provider, $3 delivery free from $40 (VAT incl.),
// guest checkout, no b2b fields, phone required + Lebanon default on the address form, pricelists per website. Idempotent.
const rpc = async (model, method, args, kwargs) => { const r = await fetch('/web/dataset/call_kw', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: { model, method, args, kwargs: kwargs || {} } }) }); const j = await r.json(); if (j.error) throw new Error(j.error.data && j.error.data.message); return j.result; };
const C = { allowed_company_ids: [1, 2, 3] };
const log = {};
// payment provider "Confirm order (pay on delivery)" shared by both websites
const prov = await rpc('payment.provider', 'search_read', [[['name', 'ilike', 'pay on delivery']]], { fields: ['id'], context: C });
if (prov.length) await rpc('payment.provider', 'write', [prov.map(p => p.id), { website_id: false }], { context: C });
log.providers = prov.length;
// delivery carrier for website 1
let car = await rpc('delivery.carrier', 'search_read', [[['name', '=', 'Delivery'], ['website_id', '=', 1]]], { fields: ['id'], context: C });
const std = await rpc('delivery.carrier', 'search_read', [[['name', '=', 'Standard delivery']]], { fields: ['product_id'], context: C });
const prod = std.length ? std[0].product_id[0] : false;
const vals = { fixed_price: 2.7027, free_over: true, amount: 40, is_published: true, allow_cash_on_delivery: true, website_description: 'Free delivery for orders of $40 and more. $3 for smaller orders.' };
let cid;
if (car.length) { cid = car[0].id; await rpc('delivery.carrier', 'write', [[cid], vals], { context: C }); }
else cid = await rpc('delivery.carrier', 'create', [{ name: 'Delivery', delivery_type: 'fixed', website_id: 1, product_id: prod, company_id: 3, sequence: 1, ...vals }], { context: C });
const pick = await rpc('delivery.carrier', 'search_read', [[['delivery_type', '=', 'in_store'], ['website_id', '=', 1]]], { fields: ['id'], context: C });
if (pick.length) await rpc('delivery.carrier', 'write', [pick.map(p => p.id), { is_published: false }], { context: C });
log.carrier = cid;
// pricelists: only RETAIL LB on website 1
const pls = await rpc('product.pricelist', 'search_read', [[['website_id', '=', 1], ['name', '!=', 'RETAIL LB']]], { fields: ['id'], context: C });
if (pls.length) await rpc('product.pricelist', 'write', [pls.map(p => p.id), { website_id: false }], { context: C });
// no b2b fields on website 1 (COW copy of the view, disabled)
const b2b = await rpc('ir.ui.view', 'search_read', [[['key', '=', 'website_sale.address_b2b'], ['website_id', '=', false]]], { fields: ['id'], context: C });
if (b2b.length) await rpc('ir.ui.view', 'write', [[b2b[0].id], { active: false }], { context: { ...C, website_id: 1 } });
const foot = `
<!-- ORG-CHECKOUT-START -->
<script>
(function(){
  if (location.pathname.indexOf('/shop/address') !== 0) return;
  function init(){ var f = document.querySelector('form.address_autoformat'); if (!f || f.dataset.org) return; f.dataset.org = '1';
    var p = f.querySelector('input[name="phone"]'); if (p) { p.required = true; var l = p.closest('div').querySelector('label'); if (l && !/\\*/.test(l.textContent)) l.insertAdjacentHTML('beforeend', ' <span class="s_website_form_mark">*</span>'); }
    var c = f.querySelector('select[name="country_id"]'); if (c && !c.value) { var o = [].slice.call(c.options).find(function(x){ return x.textContent.trim() === 'Lebanon'; }); if (o) { c.value = o.value; c.dispatchEvent(new Event('change', {bubbles: true})); } }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
</script>
<!-- ORG-CHECKOUT-END -->`;
await rpc('website', 'write', [[1], { custom_code_footer: foot, prevent_zero_price_sale: true, account_on_checkout: 'optional', auth_signup_uninvited: 'b2c', show_line_subtotals_tax_selection: 'tax_included' }], { context: C });
window.__step63 = log;
