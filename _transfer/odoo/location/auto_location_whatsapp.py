# Delivery location: a customer replied on WhatsApp with a location (SMB, 26 Nov 2026; links added 28 Nov 2026).
# base.automation on whatsapp.message, on create.
#  A. A location shared with WhatsApp's own "Location" attachment: Odoo stores it as a link
#     "https://maps.google.com/maps?q=<lat>,<lng>" in the message. The pin is written at once.
#  B. A Google Maps link pasted as text (case of 27 Nov 2026: maps.app.goo.gl/...): the link is written into the
#     contact's "Map location" (x_map_link). Automation 1393 on the contact reads the coordinates when the link carries
#     them. A short link carries none and Odoo cannot open it, so the order gets a to-do for the owner with the link:
#     the pin is then placed once (delivery planner, or coordinates pasted into "Map location"). An older pin on that
#     address is cleared, so the order shows under "Waiting for location".
# In both cases: when the sender is a known contact, the target is the delivery address of that contact's latest
# confirmed, undelivered order of the last 60 days; with no such order, the contact itself. No note is written on the
# order (owner, 28 Nov 2026); only the to-do for a link that cannot be read.
# Points outside Lebanon and messages we sent are ignored.
OWNER = 6
MARKS = ('maps.app.goo.gl/', 'goo.gl/maps/', 'google.com/maps', 'maps.google.', 'g.co/kgs/')
for wm in records.sudo():
    msg = wm.mail_message_id
    # str(): the body is an HTML "Markup" value, whose replace()/split() escape their arguments - on it, split('"') and
    # replace('<', ' ') never matched (found 28 Nov 2026 with the first pasted link)
    body = str(msg.body or '')
    if wm.message_type != 'inbound' or msg.model != 'discuss.channel':
        continue
    lat = lng = None
    link = ''
    if 'maps?q=' in body:
        part = body.split('maps?q=')[1].split('"')[0].split('&')[0]
        try:
            lat = round(float(part.split(',')[0]), 7)
            lng = round(float(part.split(',')[1]), 7)
        except Exception:
            lat = lng = None
    if lat is None:
        for token in body.replace('&amp;', '&').replace('<', ' ').replace('>', ' ').replace('"', ' ').replace("'", ' ').split():
            if token.startswith('http') and any(m in token for m in MARKS):
                link = token[:500]
                break
        if not link:
            continue
    elif not (33.0 <= lat <= 34.75 and 35.0 <= lng <= 36.7):
        continue
    partner = env['discuss.channel'].sudo().browse(msg.res_id).whatsapp_partner_id
    if not partner:
        continue
    since = datetime.datetime.now() - datetime.timedelta(days=60)
    order = env['sale.order'].sudo().search([('state', '=', 'sale'), ('delivery_status', '!=', 'full'), ('date_order', '>=', since), '|', '|', ('partner_id', '=', partner.id), ('partner_shipping_id', '=', partner.id), ('partner_id.commercial_partner_id', '=', partner.commercial_partner_id.id)], order='date_order desc', limit=1)
    target = order.partner_shipping_id if order else partner
    if lat is not None:
        target.write({'x_map_link': '%.7f, %.7f' % (lat, lng), 'partner_latitude': lat, 'partner_longitude': lng})
        continue
    before = (target.partner_latitude, target.partner_longitude)
    try:
        target.write({'x_map_link': link})   # a short link is also sent to the map-link helper by the contact's automation
    except Exception:
        pass                                  # the helper being unreachable must not lose the customer's message
    read = (target.partner_latitude, target.partner_longitude) != before and bool(target.partner_latitude)
    if not read and before[0]:
        # a new location was sent and cannot be read: the old pin would send the driver to the wrong place, so it is
        # cleared and the order shows under "Waiting for location" until the pin is placed
        target.write({'partner_latitude': 0, 'partner_longitude': 0})
    if order and not read:
        order.activity_schedule('mail.mail_activity_data_todo', user_id=OWNER, summary='Location link received: place the pin', note='%s sent this Google Maps link on WhatsApp: %s' % (target.display_name, link))
