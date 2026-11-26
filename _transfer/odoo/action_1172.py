# Pay-on-delivery checkout: tidy the quotation and alert the owner (email + WhatsApp when the template is approved). The order is NOT confirmed (SMB, 13 Nov 2026).
# SMB, 21 Nov 2026: one owner email per retail order. On Organicopia the owner becomes salesperson silently and is not a follower, so the customer email goes to the customer only.
OWNER_UID = 6
OWNER_PHONE = '+961 78 879 350'
OWNER_EMAIL = 'sales@smbfoods-lb.com'
esc = lambda s: (s or '').replace('&', '&amp;').replace('<', '&lt;')
for tx in records:
    for order in tx.sale_order_ids.sudo().filtered(lambda o: o.state in ('draft', 'sent') and o.website_id):
        if order.website_id.id == 6:
            order.order_line.filtered(lambda l: l.is_delivery).unlink()
            order.write({'carrier_id': False})
        for pp in (order.partner_id | order.partner_invoice_id | order.partner_shipping_id):
            if pp.email and pp.email.endswith('@no-email.invalid'):
                pp.sudo().write({'email': False})
        # SMB, 13 Nov 2026: website orders stay quotations on both sites; the owner confirms them or moves them to smbfoods
        owner_partner = env['res.users'].sudo().browse(OWNER_UID).partner_id
        if order.website_id.id == 1:
            if not order.user_id:
                order.with_context(mail_auto_subscribe_no_notify=True).write({'user_id': OWNER_UID, 'team_id': order.team_id.id})
            order.message_unsubscribe(partner_ids=owner_partner.ids)
        else:
            order.message_subscribe(partner_ids=owner_partner.ids)
        # SMB, 26 Nov 2026: a branch contact is named after its place only ("Ghazieh"); say whose branch it is ("Earth-ona, Ghazieh")
        buyer, firm = order.partner_id, order.partner_id.commercial_partner_id
        who = buyer.name or firm.name or ''
        if firm and firm != buyer and firm.name and firm.name not in who:
            who = '%s, %s' % (firm.name, buyer.name) if buyer.name else firm.name
        site = order.website_id.domain or order.website_id.name
        sym = order.currency_id.symbol
        ship = order.partner_shipping_id or order.partner_id
        lines = ''.join('<li>%s x %s - %s %.2f</li>' % (int(l.product_uom_qty) if l.product_uom_qty == int(l.product_uom_qty) else l.product_uom_qty, esc(l.name.replace('\n', ' ')), sym, l.price_total) for l in order.order_line if not l.is_delivery and not l.display_type)
        details = '<p>Phone: %s<br/>Delivery: %s<br/>Address: %s</p>' % (esc(order.x_shop_phone) or '-', esc(order.carrier_id.name) or '-', esc(', '.join([p for p in [ship.street, ship.street2, ship.city] if p])) or '-')
        body = '<p>New website order (quotation, not confirmed) <b>%s</b> from <b>%s</b> on %s.</p><ul>%s</ul><p>Total: <b>%s %.2f</b></p>%s<p><a href="%s/odoo/sales/%d">Open in Odoo</a></p>' % (order.name, esc(who), site, lines, sym, order.amount_total, details, env['ir.config_parameter'].sudo().get_param('web.base.url'), order.id)
        env['mail.mail'].sudo().create({'subject': 'New order %s from %s' % (order.name, who), 'email_to': OWNER_EMAIL, 'body_html': body, 'model': 'sale.order', 'res_id': order.id}).send()
        # Prefer the Organicopia production number (whatsapp.account 3, prod DB); fall back to any approved copy
        tpl = env['whatsapp.template'].sudo().search([('template_name', '=', 'new_order_alert'), ('status', '=', 'approved'), ('wa_account_id', '=', 3)], limit=1) or env['whatsapp.template'].sudo().search([('template_name', '=', 'new_order_alert'), ('status', '=', 'approved')], limit=1)
        if tpl:
            try:
                composer = env['whatsapp.composer'].sudo().with_context(active_model='sale.order', active_id=order.id).create({'res_model': 'sale.order', 'res_ids': str([order.id]), 'wa_template_id': tpl.id, 'phone': OWNER_PHONE, 'free_text_1': site})
                composer.action_send_whatsapp_template()
            except Exception:
                pass