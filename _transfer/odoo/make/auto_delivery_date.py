# Delivery date by default (SMB, 26 Nov 2026). base.automation on sale.order, on write of "state" to sale.
# Owner's rule, Beirut time: confirmed Monday to Friday -> delivered the next day; Saturday before 12:00 -> Monday;
# Saturday from 12:00 and Sunday -> Tuesday. A pick-up ("Delivered by" = Pick Up) is the next business day (Saturday and
# Sunday -> Monday). The open deliveries of the order get that day at 12:00 as scheduled date; the "To make" page sorts
# by it. Left alone: an order that already carries a promised delivery date, and orders between our own companies.
for order in records:
    if order.state != 'sale' or order.commitment_date:
        continue
    if order.partner_id.commercial_partner_id.id in env['res.company'].sudo().search([]).mapped('partner_id').ids:
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
    when = datetime.datetime(day.year, day.month, day.day, 12, 0, 0) - datetime.timedelta(hours=tz)
    order.picking_ids.filtered(lambda p: p.picking_type_code == 'outgoing' and p.state not in ('done', 'cancel')).sudo().write({'scheduled_date': when})
