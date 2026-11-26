# A product tagged 'Not available' / 'Coming soon' was put back on sale (tag removed): tell everyone waiting for it, like action 1170 does when stock arrives
BLOCK = {'Not available', 'Coming soon'}
# 26 Nov 2026: "back" means exactly what the sites show as orderable (same rule as views 5037 / 5040 and the feed 5084):
# free stock above the product's own "out of stock at or below", or, for a product ticked "Sell when out of stock", a bakery
# item, no recipe, or every ingredient (packaging aside) above its reserve.
def orderable(p):
    p = p.sudo().with_context(allowed_company_ids=[1, 3])
    tm = p.product_tmpl_id
    if not p.is_storable or p.free_qty > (tm.x_web_min_stock or 0):
        return True
    if not tm.allow_out_of_stock_order:
        return False
    if tm.public_categ_ids.filtered(lambda c: 'Bakery' in (c.display_name or '') or 'Oven' in (c.display_name or '')):
        return True
    bom = (p.bom_ids or tm.bom_ids)[:1]
    if not bom:
        return True
    lines = bom.bom_line_ids.filtered(lambda l: 'Packaging' not in (l.product_id.categ_id.complete_name or ''))
    return not lines.filtered(lambda l: l.product_id.with_context(allowed_company_ids=[1, 3]).free_qty <= (l.product_id.product_tmpl_id.x_reserve_qty or 0))
products = records.mapped('product_variant_ids').filtered(lambda p: p.stock_notification_partner_ids and not (set(p.all_product_tag_ids.mapped('name')) & BLOCK))
if products:
    tpl_org = env['whatsapp.template'].sudo().search([('template_name', '=', 'back_in_stock'), ('status', '=', 'approved'), ('wa_account_id', '=', 3)], limit=1)
    tpl_any = env['whatsapp.template'].sudo().search([('template_name', '=', 'back_in_stock'), ('status', '=', 'approved')], limit=1)
    # 26 Nov 2026: a customer who asked from the wholesale site is told by the SMB Foods number (whatsapp.account 2) with the
    # wholesale address, whatever the product; one who asked from the Organicopia store by the Organicopia number. The site
    # is on the request itself (crm.lead.x_notify_site, kept archived by action 1169). No request found: as before, by product.
    tpl_smb = env['whatsapp.template'].sudo().search([('template_name', '=', 'back_in_stock'), ('status', '=', 'approved'), ('wa_account_id', '=', 2)], limit=1)
    Lead = env['crm.lead'].sudo().with_context(active_test=False)
    for product in products:
        if not orderable(product):
            continue
        site = 'www.organicopia-lb.com' if (product.product_tmpl_id.website_id.id == 1 or not product.product_tmpl_id.website_id) else 'www.smbfoods-lb.com'
        if product.product_tmpl_id.website_id.id == 6:
            site = 'www.smbfoods-lb.com'
        tpl = tpl_org if (tpl_org and site == 'www.organicopia-lb.com') else tpl_any
        sent, pending = [], []
        prod_site, prod_tpl = site, tpl
        for partner in product.stock_notification_partner_ids:
            asked = Lead.search([('x_notify_product_id', '=', product.id), ('partner_id', '=', partner.id), ('x_notify_site', '!=', False)], order='id desc', limit=1).x_notify_site
            site, tpl = prod_site, prod_tpl
            if asked == 'wholesale':
                site, tpl = 'www.smbfoods-lb.com', (tpl_smb or tpl_any)
            elif asked == 'organicopia':
                site, tpl = 'www.organicopia-lb.com', (tpl_org or tpl_any)
            if tpl and partner.phone:
                try:
                    composer = env['whatsapp.composer'].sudo().with_context(active_model='res.partner', active_id=partner.id).create({'res_model': 'res.partner', 'res_ids': str([partner.id]), 'wa_template_id': tpl.id, 'phone': partner.phone, 'free_text_1': product.display_name, 'free_text_2': site})
                    composer.action_send_whatsapp_template()
                    sent.append(partner)
                except Exception as e:
                    pending.append(partner)
            else:
                pending.append(partner)
        if pending:
            lines = ''.join('<li>%s — %s</li>' % (pp.name, pp.phone or 'no phone') for pp in pending)
            product.product_tmpl_id.activity_schedule('mail.mail_activity_data_todo', user_id=6, summary='Back in stock: message %d customer(s) on WhatsApp' % len(pending), note='<p>%s is available again. These customers asked to be told:</p><ul>%s</ul>' % (product.display_name, lines))
        product.sudo().write({'stock_notification_partner_ids': [(3, pp.id) for pp in sent + pending]})
