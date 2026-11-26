# Delivery location: a customer replied on WhatsApp with a location (SMB, 26 Nov 2026).
# base.automation on whatsapp.message, on create. Odoo stores a shared location as a link
# "https://maps.google.com/maps?q=<lat>,<lng>" in the message. When the sender is a known contact, the pin is written on
# the delivery address of that contact's latest confirmed, undelivered order of the last 60 days (with a note on the
# order); with no such order, on the contact itself. Points outside Lebanon and messages we sent are ignored.
for wm in records.sudo():
    msg = wm.mail_message_id
    body = msg.body or ''
    if wm.message_type != 'inbound' or 'maps?q=' not in body or msg.model != 'discuss.channel':
        continue
    part = body.split('maps?q=')[1].split('"')[0].split('&')[0]
    try:
        lat = round(float(part.split(',')[0]), 7)
        lng = round(float(part.split(',')[1]), 7)
    except Exception:
        continue
    partner = env['discuss.channel'].sudo().browse(msg.res_id).whatsapp_partner_id
    if not partner or not (33.0 <= lat <= 34.75 and 35.0 <= lng <= 36.7):
        continue
    since = datetime.datetime.now() - datetime.timedelta(days=60)
    order = env['sale.order'].sudo().search([('state', '=', 'sale'), ('delivery_status', '!=', 'full'), ('date_order', '>=', since), '|', '|', ('partner_id', '=', partner.id), ('partner_shipping_id', '=', partner.id), ('partner_id.commercial_partner_id', '=', partner.commercial_partner_id.id)], order='date_order desc', limit=1)
    target = order.partner_shipping_id if order else partner
    target.write({'x_map_link': '%.7f, %.7f' % (lat, lng), 'partner_latitude': lat, 'partner_longitude': lng})
    if order:
        order.message_post(body='The customer sent the delivery location on WhatsApp (%s): %.7f, %.7f' % (target.display_name, lat, lng))
