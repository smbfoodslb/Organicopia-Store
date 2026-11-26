# Stock came in: tell everyone waiting for these products, by WhatsApp when the template is approved, otherwise as a to-do
products = records.filtered(lambda m: m.location_dest_id.usage == 'internal' and m.location_id.usage != 'internal').mapped('product_id').filtered(lambda p: p.stock_notification_partner_ids)
# 14 Nov 2026: a product still tagged 'Not available' or 'Coming soon' is not back on sale yet; automation 24 tells its subscribers when the tag is removed
products = products.filtered(lambda p: not (set(p.all_product_tag_ids.mapped('name')) & {'Not available', 'Coming soon'}))
if products:
    # Prefer the Organicopia production number (whatsapp.account 3, prod DB) for Organicopia products; fall back to any approved copy
    tpl_org = env['whatsapp.template'].sudo().search([('template_name', '=', 'back_in_stock'), ('status', '=', 'approved'), ('wa_account_id', '=', 3)], limit=1)
    tpl_any = env['whatsapp.template'].sudo().search([('template_name', '=', 'back_in_stock'), ('status', '=', 'approved')], limit=1)
    for product in products:
        if product.with_context(allowed_company_ids=[1, 3]).free_qty <= 0:
            continue
        site = 'www.organicopia-lb.com' if (product.product_tmpl_id.website_id.id == 1 or not product.product_tmpl_id.website_id) else 'www.smbfoods-lb.com'
        if product.product_tmpl_id.website_id.id == 6:
            site = 'www.smbfoods-lb.com'
        tpl = tpl_org if (tpl_org and site == 'www.organicopia-lb.com') else tpl_any
        sent, pending = [], []
        for partner in product.stock_notification_partner_ids:
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
            product.product_tmpl_id.activity_schedule('mail.mail_activity_data_todo', user_id=6, summary='Back in stock: message %d customer(s) on WhatsApp' % len(pending), note='<p>%s is back in stock. These customers asked to be told:</p><ul>%s</ul>' % (product.display_name, lines))
        product.sudo().write({'stock_notification_partner_ids': [(3, pp.id) for pp in sent + pending]})