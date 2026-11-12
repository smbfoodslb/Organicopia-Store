// Step 6.5 — "Notify me when back in stock" via WhatsApp. Idempotent.
// Flow: website "Notify me" form → crm.lead (tag "Back in stock", x_notify_product_id, x_notify_site)
//   → automation A: find/create the partner by phone, create product.wishlist(stock_notification) and archive the lead
//   → automation B (stock.move done into stock): for each wishlist waiting on the product, send the approved WhatsApp
//     template "back_in_stock" (whatsapp.composer on product.wishlist); if no approved template/account yet, create a to-do
//     on the product listing who to message. Either way the wishlist flag is cleared.
const rpc = async (model, method, args, kwargs) => { const r = await fetch('/web/dataset/call_kw', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: { model, method, args, kwargs: kwargs || {} } }) }); const j = await r.json(); if (j.error) throw new Error(j.error.data && j.error.data.message); return j.result; };
const C = { allowed_company_ids: [1, 2, 3] };
const log = {};
const modelId = async m => (await rpc('ir.model', 'search_read', [[['model', '=', m]]], { fields: ['id'] }))[0].id;
const fieldId = async (m, f) => (await rpc('ir.model.fields', 'search_read', [[['model', '=', m], ['name', '=', f]]], { fields: ['id'] }))[0].id;
// 0. WhatsApp admin rights for the main user (uid 6) so the Meta connection can be configured from the UI
try { const g = await rpc('ir.model.data', 'search_read', [[['module', '=', 'whatsapp'], ['name', '=', 'group_whatsapp_admin']]], { fields: ['res_id'] }); if (g.length) { await rpc('res.groups', 'write', [[g[0].res_id], { user_ids: [[4, 6]] }], { context: C }); log.waAdmin = true; } } catch (e) { log.waAdmin = 'ERR ' + e.message; }
// 1. tag + lead fields
let tag = await rpc('crm.tag', 'search_read', [[['name', '=', 'Back in stock']]], { fields: ['id'] });
const tagId = tag.length ? tag[0].id : await rpc('crm.tag', 'create', [{ name: 'Back in stock' }]);
const leadModel = await modelId('crm.lead');
for (const [name, ttype, desc, extra] of [['x_notify_product_id', 'many2one', 'Notify: product', { relation: 'product.product' }], ['x_notify_site', 'char', 'Notify: site', {}]]) {
  const ex = await rpc('ir.model.fields', 'search_read', [[['model', '=', 'crm.lead'], ['name', '=', name]]], { fields: ['id'] });
  const fid = ex.length ? ex[0].id : await rpc('ir.model.fields', 'create', [{ name, model_id: leadModel, ttype, field_description: desc, state: 'manual', ...extra }]);
  await rpc('ir.model.fields', 'write', [[fid], { website_form_blacklisted: false }]);
}
log.tag = tagId;
// 2. automation A — register the request
const codeA = `# Back in stock request from the website: turn the lead into a stock-notification wishlist entry
for lead in records:
    if not lead.x_notify_product_id or not lead.phone:
        continue
    digits = ''.join(ch for ch in lead.phone if ch.isdigit())
    if digits.startswith('961'):
        digits = digits[3:]
    if len(digits) == 7:
        digits = '0' + digits
    intl = '+961' + digits.lstrip('0')
    Partner = env['res.partner'].sudo()
    partner = Partner.search(['|', ('phone', 'ilike', digits[-7:]), ('email', '=', digits + '@smbfoods-lb.com')], limit=1)
    if not partner:
        partner = Partner.create({'name': lead.contact_name or lead.name or intl, 'phone': intl, 'company_id': False})
    elif not partner.phone:
        partner.write({'phone': intl})
    website_id = 1 if (lead.x_notify_site or '') == 'organicopia' else 6
    Wish = env['product.wishlist'].sudo()
    wish = Wish.search([('partner_id', '=', partner.id), ('product_id', '=', lead.x_notify_product_id.id)], limit=1)
    pricelist_id = 27 if website_id == 1 else 24
    if wish:
        wish.write({'stock_notification': True, 'active': True})
    else:
        Wish.create({'partner_id': partner.id, 'product_id': lead.x_notify_product_id.id, 'website_id': website_id, 'pricelist_id': pricelist_id, 'currency_id': env['product.pricelist'].sudo().browse(pricelist_id).currency_id.id, 'stock_notification': True})
    lead.write({'partner_id': partner.id, 'active': False, 'tag_ids': [(4, TAG_ID)]})`.replace('TAG_ID', String(tagId));
const codeB = `# Stock came in: tell everyone waiting for these products, by WhatsApp when the template is approved, otherwise as a to-do
Wish0 = env['product.wishlist'].sudo()
products = records.filtered(lambda m: m.location_dest_id.usage == 'internal' and m.location_id.usage != 'internal').mapped('product_id')
if products and Wish0.search_count([('stock_notification', '=', True), ('product_id', 'in', products.ids)]):
    Wish = env['product.wishlist'].sudo()
    tpl = env['whatsapp.template'].sudo().search([('template_name', '=', 'back_in_stock'), ('status', '=', 'approved')], limit=1)
    for product in products:
        if product.with_context(allowed_company_ids=[1, 3]).free_qty <= 0:
            continue
        wishes = Wish.search([('product_id', '=', product.id), ('stock_notification', '=', True)])
        if not wishes:
            continue
        sent, pending = [], []
        for w in wishes:
            if tpl and w.partner_id.phone:
                try:
                    composer = env['whatsapp.composer'].sudo().with_context(active_model='product.wishlist', active_id=w.id).create({'res_model': 'product.wishlist', 'res_ids': str([w.id]), 'wa_template_id': tpl.id, 'phone': w.partner_id.phone})
                    composer.action_send_whatsapp_template()
                    sent.append(w)
                except Exception as e:
                    pending.append(w)
            else:
                pending.append(w)
        if pending:
            lines = ''.join('<li>%s — %s</li>' % (w.partner_id.name, w.partner_id.phone or 'no phone') for w in pending)
            product.product_tmpl_id.activity_schedule('mail.mail_activity_data_todo', user_id=6, summary='Back in stock: message %d customer(s) on WhatsApp' % len(pending), note='<p>%s is back in stock. These customers asked to be told:</p><ul>%s</ul>' % (product.display_name, lines))
        for w in sent:
            w.write({'stock_notification': False})
        for w in pending:
            w.write({'stock_notification': False})`;
async function rule(name, model, triggerFields, filterDomain, code) {
  const mid = await modelId(model);
  const old = await rpc('base.automation', 'search_read', [[['name', '=', name]]], { fields: ['id'] });
  if (old.length) await rpc('base.automation', 'unlink', [old.map(o => o.id)]);
  const fids = []; for (const f of triggerFields) fids.push(await fieldId(model, f));
  const vals = { name, model_id: mid, trigger: 'on_create_or_write', trigger_field_ids: [[6, 0, fids]], active: true };
  if (filterDomain) vals.filter_domain = filterDomain;
  const rid = await rpc('base.automation', 'create', [vals]);
  await rpc('ir.actions.server', 'create', [{ name: name + ' (code)', model_id: mid, state: 'code', usage: 'base_automation', base_automation_id: rid, code }]);
  return rid;
}
log.ruleA = await rule('Back in stock: register request', 'crm.lead', ['x_notify_product_id'], "[('x_notify_product_id', '!=', False), ('active', '=', True)]", codeA);
log.ruleB = await rule('Back in stock: notify customers', 'stock.move', ['state'], "[('state', '=', 'done')]", codeB);
window.__step65 = log;
