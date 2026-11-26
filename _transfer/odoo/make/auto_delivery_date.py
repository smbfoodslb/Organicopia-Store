# Delivery date by default (SMB, 26 Nov 2026). base.automation on stock.picking, on create, customer deliveries of a
# sales order. (Not on the order's confirmation: Odoo sets the order to "sale" before it creates the delivery.)
# Owner's rule, Beirut time, counted from the moment the delivery is created, i.e. when the order is confirmed:
# Monday to Friday -> the next day; Saturday before 12:00 -> Monday; Saturday from 12:00 and Sunday -> Tuesday.
# A pick-up ("Delivered by" = Pick Up) is the next business day (Saturday and Sunday -> Monday). The delivery gets that
# day at 12:00 as scheduled date; the "To make" page sorts by it. Left alone: an order that carries a promised
# delivery date, and deliveries between our own companies.
OWN = env['res.company'].sudo().search([]).mapped('partner_id').ids
for picking in records:
    order = picking.sale_id
    if picking.picking_type_code != 'outgoing' or not order or order.commitment_date:
        continue
    if order.partner_id.commercial_partner_id.id in OWN:
        continue
    now = datetime.datetime.now()
    tz = 3 if 4 <= now.month <= 10 else 2
    local = now + datetime.timedelta(hours=tz)
    wd = local.weekday()
    pickup = order.x_delivered_by == 'pickup'
    if wd <= 4:
        add = 1
    elif wd == 5:
        add = 2 if (pickup or local.hour < 12) else 3
    else:
        add = 1 if pickup else 2
    day = (local + datetime.timedelta(days=add)).date()
    picking.sudo().write({'scheduled_date': datetime.datetime(day.year, day.month, day.day, 12, 0, 0) - datetime.timedelta(hours=tz)})
