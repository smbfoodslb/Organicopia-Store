# Delivery location: thank the customer and ask for the pin by WhatsApp (SMB, 26 Nov 2026).
# base.automation on sale.order, on write of "state" or "x_delivered_by", for confirmed orders with "Delivered by" =
# Our driver that were not asked yet (x_loc_asked empty). Owner's rules: retail orders only (placed on the Organicopia
# site, or entered by staff for a person, not a company); never pick-ups or FlyPost (FlyPost contacts the customer
# itself); always from the Organicopia number (whatsapp.account 3). A delivery address that already has a pin gets
# "same location as last time" (template delivery_location_known); otherwise the request with the link to
# /delivery-location (template delivery_location_ask). Sent once per order. Nothing is sent while the template
# is not approved, to orders older than 7 days, or to orders already delivered.
OWN = env['res.company'].sudo().search([]).mapped('partner_id').ids
Tpl = env['whatsapp.template'].sudo()
for order in records.sudo():
    if order.state != 'sale' or order.x_delivered_by != 'own' or order.x_loc_asked or order.delivery_status == 'full':
        continue
    com = order.partner_id.commercial_partner_id
    retail = order.website_id.id == 1 or (not order.website_id and not com.is_company)
    if not retail or com.id in OWN or not order.partner_id.phone or (datetime.datetime.now() - order.date_order).days > 7:
        continue
    ship = order.partner_shipping_id
    has = bool(ship.partner_latitude or ship.partner_longitude)
    # 26 Nov 2026 (owner): a customer who pinned the location for THIS order (thank-you page or link, x_location_pin
    # "applied") is told "to the location you pinned" (template delivery_location_pinned) rather than "the same location
    # as last time"; while that template is not approved yet, the "known" one is used.
    name = 'delivery_location_ask'
    if has:
        name = 'delivery_location_known'
        if env['x_location_pin'].sudo().search_count([('x_order', '=', order.id), ('x_name', '=like', 'applied%')]) and Tpl.search_count([('template_name', '=', 'delivery_location_pinned'), ('status', '=', 'approved'), ('wa_account_id', '=', 3)]):
            name = 'delivery_location_pinned'
    tpl = Tpl.search([('template_name', '=', name), ('status', '=', 'approved'), ('wa_account_id', '=', 3)], limit=1)
    if not tpl:
        continue
    vals = {'res_model': 'sale.order', 'res_ids': str([order.id]), 'wa_template_id': tpl.id, 'phone': order.partner_id.phone}
    if not has:
        url = order.get_portal_url()
        if 'access_token=' not in url:
            continue
        vals['free_text_1'] = 'https://www.organicopia-lb.com/delivery-location?o=%s&t=%s' % (order.id, url.split('access_token=')[1].split('&')[0])
    if env.context.get('smb_loc_dry'):
        order.write({'x_loc_asked': datetime.datetime.now()})
        order.message_post(body='(dry run) WhatsApp "%s" would be sent to %s.' % (tpl.name, order.partner_id.phone))
        continue
    try:
        env['whatsapp.composer'].sudo().with_context(active_model='sale.order', active_id=order.id).create(vals).action_send_whatsapp_template()
        order.write({'x_loc_asked': datetime.datetime.now()})
    except Exception as e:
        order.message_post(body='The delivery-location WhatsApp could not be sent: %s' % str(e)[:200])
