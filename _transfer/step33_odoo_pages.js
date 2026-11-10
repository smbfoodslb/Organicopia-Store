// Step 3.3 — style the Odoo-rendered pages, rebuild the website menu, tidy checkout options. Idempotent.
// Expects window.__SMB_BASE (raw GitHub transfer folder).
const BASE = window.__SMB_BASE;
const rpc = async (model, method, args, kwargs) => { const r = await fetch('/web/dataset/call_kw', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: { model, method, args, kwargs: kwargs || {} } }) }); const j = await r.json(); if (j.error) throw new Error(j.error.data && j.error.data.message); return j.result; };
const log = {};
// 1. CSS file as public attachment
{
  const css = await fetch(BASE + 'odoo-pages.css').then(r => r.text());
  const datas = btoa(unescape(encodeURIComponent(css)));
  const ex = await rpc('ir.attachment', 'search_read', [[['url', '=', '/smb/odoo-pages.css']]], { fields: ['id'] });
  const vals = { name: 'odoo-pages.css', datas, mimetype: 'text/css', public: true, url: '/smb/odoo-pages.css', type: 'binary', res_model: false, res_id: 0 };
  if (ex.length) { await rpc('ir.attachment', 'write', [[ex[0].id], vals]); log.css = 'updated'; } else { await rpc('ir.attachment', 'create', [vals]); log.css = 'created'; }
}
// 2. head/footer custom code (between markers so re-runs replace, not duplicate)
{
  const w = (await rpc('website', 'read', [[6], ['custom_code_head', 'custom_code_footer']]))[0];
  const ver = Date.now().toString(36);
  const HEAD = `<!-- SMB-PAGES-START --><link rel="stylesheet" href="/smb/odoo-pages.css?v=${ver}"/><!-- SMB-PAGES-END -->`;
  let head = w.custom_code_head || '';
  head = head.replace(/<!-- SMB-PAGES-START -->[\s\S]*?<!-- SMB-PAGES-END -->/, '').trim() + '\n' + HEAD;
  const FOOT = `<!-- SMB-LOGIN-START -->
<script>
(function(){
  if (location.pathname !== '/web/login') return;
  function init(){
    var input = document.getElementById('login');
    var form = input && input.closest('form');
    if (!input || !form || input.dataset.smbPhone) return;
    input.dataset.smbPhone = '1';
    var label = form.querySelector('label[for="login"]');
    if (label) label.textContent = 'Phone number';
    input.type = 'text'; input.setAttribute('inputmode','tel'); input.autocomplete = 'username';
    input.placeholder = 'e.g. 70123456';
    var v = input.value || '';
    if (/@smbfoods-lb\\.com$/i.test(v)) input.value = v.replace(/@smbfoods-lb\\.com$/i,'');
    var hint = document.createElement('div');
    hint.className = 'small text-muted mt-1';
    hint.textContent = 'Use the phone number registered with SMB Foods.';
    input.insertAdjacentElement('afterend', hint);
    var h = form.closest('.oe_website_login_container') || form.parentElement;
    var title = h && h.querySelector('h1,h2,h3,.h3,.h2');
    if (title) title.textContent = 'Wholesale customer login';
    var help = document.createElement('p');
    help.className = 'smb-login-help';
    help.innerHTML = 'No account or forgot your password? Message our wholesale team on WhatsApp: <a href="https://wa.me/96178879350" target="_blank" rel="noopener">+961 78 879 350</a>';
    form.insertAdjacentElement('afterend', help);
    form.addEventListener('submit', function(){
      var val = (input.value || '').trim();
      if (val && val.indexOf('@') === -1) {
        var digits = val.replace(/[^0-9]/g,'');
        if (digits.indexOf('961') === 0 && digits.length > 8) digits = digits.slice(3);
        if (digits.length === 7) digits = '0' + digits;
        input.value = digits + '@smbfoods-lb.com';
      }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
</script>
<!-- SMB-LOGIN-END -->`;
  let foot = w.custom_code_footer || '';
  foot = foot.replace(/<!-- SMB-LOGIN-START -->[\s\S]*?<!-- SMB-LOGIN-END -->/, '');
  foot = foot.replace(/\n?<!-- SMB: phone-number login[\s\S]*?<\/script>/, '').trim() + '\n' + FOOT; // drop the earlier un-marked version
  await rpc('website', 'write', [[6], { custom_code_head: head, custom_code_footer: foot }]);
  log.customCode = 'written';
}
// 3. menu: replace the old retail menu with the wholesale one
{
  const root = 68;
  const old = await rpc('website.menu', 'search_read', [[['website_id', '=', 6], ['id', '!=', root]]], { fields: ['id', 'name', 'url'] });
  const wanted = [['Catalog', '/wholesale'], ['Our Standard', '/wholesale#standard'], ['How to Order', '/wholesale#order'], ['New Customer', '/wholesale#new-customer'], ['Shop view', '/shop']];
  const keep = new Set();
  let seq = 10;
  for (const [name, url] of wanted) {
    const m = old.find(o => o.url === url);
    if (m) { await rpc('website.menu', 'write', [[m.id], { name, sequence: seq, parent_id: root }]); keep.add(m.id); }
    else await rpc('website.menu', 'create', [{ name, url, sequence: seq, parent_id: root, website_id: 6 }]);
    seq += 10;
  }
  const del = old.filter(o => !keep.has(o.id)).map(o => o.id);
  if (del.length) await rpc('website.menu', 'unlink', [del]);
  log.menu = `removed ${del.length}, now ${wanted.length} items`;
}
// 4. no discount-code box at checkout (website-specific copy of the view, as the customize menu would do)
{
  const v = await rpc('ir.ui.view', 'search_read', [[['key', '=', 'website_sale.reduction_code'], ['website_id', 'in', [6, false]]]], { fields: ['id', 'website_id', 'active'] });
  const specific = v.find(x => x.website_id && x.website_id[0] === 6);
  const target = specific || v[0];
  if (target && target.active) { await rpc('ir.ui.view', 'write', [[target.id], { active: false }], { context: { website_id: 6 } }); log.reductionCode = 'disabled'; } else log.reductionCode = 'already off';
}
// 5. a free "arranged by our team" delivery option for website 6
{
  const ex = await rpc('delivery.carrier', 'search_read', [[['name', '=', 'Delivery or pickup arranged by our team']]], { fields: ['id'] });
  if (!ex.length) {
    const prod = await rpc('product.product', 'search_read', [[['name', '=', 'Standard delivery'], ['type', '=', 'service']]], { fields: ['id'] });
    const vals = { name: 'Delivery or pickup arranged by our team', delivery_type: 'fixed', fixed_price: 0, website_published: true, website_id: 6, sequence: 1, company_id: 3 };
    if (prod.length) vals.product_id = prod[0].id;
    try { await rpc('delivery.carrier', 'create', [vals]); log.carrier = 'created'; } catch (e) { log.carrier = 'ERR ' + e.message.slice(0, 120); }
  } else log.carrier = 'exists';
}
// 6. Lebanon has no postal codes in practice: do not make checkout demand one
{
  const lb = await rpc('res.country', 'search_read', [[['code', '=', 'LB']]], { fields: ['id', 'zip_required', 'state_required'] });
  if (lb.length && (lb[0].zip_required || lb[0].state_required)) { await rpc('res.country', 'write', [[lb[0].id], { zip_required: false, state_required: false }]); log.lebanonZip = 'not required'; } else log.lebanonZip = 'already off';
}
// 7. only one delivery choice on the wholesale site (the retail site gets its own carrier in Phase 6)
{
  const sd = await rpc('delivery.carrier', 'search_read', [[['name', '=', 'Standard delivery'], ['website_published', '=', true]]], { fields: ['id'] });
  if (sd.length) { await rpc('delivery.carrier', 'write', [sd.map(x => x.id), { website_published: false }]); log.standardDelivery = 'unpublished'; } else log.standardDelivery = 'already unpublished';
}
// 8. the "pay on delivery" confirmation method must be allowed by the delivery method
{
  const cs = await rpc('delivery.carrier', 'search_read', [[['name', 'in', ['Delivery or pickup arranged by our team', 'Standard delivery']]]], { fields: ['id', 'allow_cash_on_delivery'] });
  const ids = cs.filter(c => !c.allow_cash_on_delivery).map(c => c.id);
  if (ids.length) { await rpc('delivery.carrier', 'write', [ids, { allow_cash_on_delivery: true }]); log.cod = 'allowed on ' + ids.length; } else log.cod = 'already allowed';
}
window.__step33 = log;
