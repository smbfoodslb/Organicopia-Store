# Delivery location: one reminder the evening before delivery (SMB, 26 Nov 2026). Scheduled action, daily at 18:00
# Beirut winter time (16:00 UTC; 19:00 in summer). For orders that were asked (x_loc_asked), not reminded yet, still
# confirmed, "Our driver", not delivered, whose delivery date is tomorrow (Beirut) and whose delivery address still has
# no pin: WhatsApp template delivery_location_reminder from the Organicopia number, with the link to /delivery-location.
now = datetime.datetime.now()
tz = 3 if 4 <= now.month <= 10 else 2
tomorrow = (now + datetime.timedelta(hours=tz)).date() + datetime.timedelta(days=1)
lo = datetime.datetime(tomorrow.year, tomorrow.month, tomorrow.day) - datetime.timedelta(hours=tz)
tpl = env['whatsapp.template'].sudo().search([('template_name', '=', 'delivery_location_reminder'), ('status', '=', 'approved'), ('wa_account_id', '=', 3)], limit=1)
orders = env['sale.order'].sudo().search([('state', '=', 'sale'), ('x_delivered_by', '=', 'own'), ('x_loc_asked', '!=', False), ('x_loc_reminded', '=', False), ('delivery_status', '!=', 'full'), ('commitment_date', '>=', lo), ('commitment_date', '<', lo + datetime.timedelta(days=1)), ('partner_shipping_id.partner_latitude', '=', 0), ('partner_shipping_id.partner_longitude', '=', 0)]) if tpl else env['sale.order']
for order in orders:
    url = order.get_portal_url()
    if not order.partner_id.phone or 'access_token=' not in url:
        continue
    link = 'https://www.organicopia-lb.com/delivery-location?o=%s&t=%s' % (order.id, url.split('access_token=')[1].split('&')[0])
    if env.context.get('smb_loc_dry'):
        order.write({'x_loc_reminded': now})
        order.message_post(body='(dry run) WhatsApp "%s" would be sent to %s.' % (tpl.name, order.partner_id.phone))
        continue
    try:
        env['whatsapp.composer'].sudo().with_context(active_model='sale.order', active_id=order.id).create({'res_model': 'sale.order', 'res_ids': str([order.id]), 'wa_template_id': tpl.id, 'phone': order.partner_id.phone, 'free_text_1': link}).action_send_whatsapp_template()
        order.write({'x_loc_reminded': now})
    except Exception as e:
        order.message_post(body='The delivery-location reminder could not be sent: %s' % str(e)[:200])
