# Short Google Maps links, step 3 of 3 (SMB, 28 Nov 2026). base.automation on res.partner, trigger "on webhook".
# The helper https://organicopia-store.vercel.app/api/maplink (repository smbfoodslb/Organicopia-Store, api/maplink.js)
# opened the short link Odoo sent it and posts back {id, link, lat, lng}. The pin is written only when the contact still
# carries that exact link and the point lies in Lebanon, so a call from anyone else cannot move a pin. Open
# "Location link received" to-dos on the contact's undelivered orders are closed, with a note.
link = str(payload.get('link') or '').strip()
try:
    lat = round(float(payload.get('lat')), 7)
    lng = round(float(payload.get('lng')), 7)
except Exception:
    lat = lng = None
for partner in records.sudo():
    if lat is None or not link or (partner.x_map_link or '').strip() != link:
        continue
    if not (33.0 <= lat <= 34.75 and 35.0 <= lng <= 36.7):
        continue
    partner.write({'partner_latitude': lat, 'partner_longitude': lng})
    for order in env['sale.order'].sudo().search([('partner_shipping_id', '=', partner.id), ('state', '=', 'sale'), ('delivery_status', '!=', 'full')]):
        order.message_post(body='Location read automatically from the Google Maps link (%s): %.7f, %.7f' % (partner.display_name, lat, lng))
        todo = order.activity_ids.filtered(lambda a: (a.summary or '').startswith('Location link received'))
        if todo:
            todo.action_feedback(feedback='Pin placed automatically from the link.')
