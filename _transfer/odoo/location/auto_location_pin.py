# base.automation on x_location_pin (on create) - SMB, 26 Nov 2026.
# The customer saved a pin on /delivery-location (view_location_page.xml). The page posts one x_location_pin through
# Odoo's public website form: order id, the order's own portal token, latitude, longitude. This action checks it and
# writes the pin on the order's delivery address (partner_latitude / partner_longitude, and "Map location" for staff).
# Refused silently: wrong token, cancelled or fully delivered order, order older than 60 days, a point outside Lebanon.
for rep in records.sudo():
    tok = (rep.x_token or '').strip()
    order = env['sale.order'].sudo().search([('id', '=', rep.x_order or 0), ('access_token', '=', tok), ('state', '!=', 'cancel')], limit=1) if len(tok) >= 20 else env['sale.order']
    try:
        lat = round(float(rep.x_lat or ''), 7)
        lng = round(float(rep.x_lng or ''), 7)
    except Exception:
        lat = lng = 0.0
    if not order or order.delivery_status == 'full' or (datetime.datetime.now() - order.date_order).days > 60 or not (33.0 <= lat <= 34.75 and 35.0 <= lng <= 36.7):
        rep.write({'x_name': 'refused'})
        continue
    ship = order.partner_shipping_id
    ship.write({'x_map_link': '%.7f, %.7f' % (lat, lng), 'partner_latitude': lat, 'partner_longitude': lng})
    rep.write({'x_name': 'applied: %s' % order.name, 'x_token': False})
