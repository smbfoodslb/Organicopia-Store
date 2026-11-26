# Delivery date by default (SMB, 26 Nov 2026). base.automation on sale.order, on write of "state" to sale.
# Odoo sets the order to "sale" BEFORE it creates the delivery, and a date written on the delivery itself is
# recomputed from its lines, so the rule fills the order's own "Delivery Date" (commitment_date) at that moment: the
# delivery created right after takes it as its scheduled date, and the date shows on the order.
# Owner's rule, Beirut time: confirmed Monday to Friday -> the next day; Saturday before 12:00 -> Monday; Saturday from
# 12:00 and Sunday -> Tuesday. A pick-up ("Delivered by" = Pick Up) is the next business day (Saturday and Sunday ->
# Monday). Time of day: 12:00. Left alone: an order that already carries a delivery date, and orders between our own
# companies. The "To make" page sorts by the delivery's scheduled date.
OWN = env['res.company'].sudo().search([]).mapped('partner_id').ids
for order in records:
    if order.state != 'sale' or order.commitment_date or order.partner_id.commercial_partner_id.id in OWN:
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
    order.sudo().write({'commitment_date': datetime.datetime(day.year, day.month, day.day, 12, 0, 0) - datetime.timedelta(hours=tz)})
