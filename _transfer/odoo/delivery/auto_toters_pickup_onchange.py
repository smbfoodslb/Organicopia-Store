# Form on-change of the customer on a sales order (base.automation, trigger on_change): Toters collects every
# order with its own delivery service, so "Delivered by" is set to Pick Up at once (owner, 23 Nov 2026).
TOTERS = 241
order = env.context.get('onchange_self')
if order is not None and order.partner_id and order.partner_id.commercial_partner_id.id == TOTERS and order.x_delivered_by in (False, 'own'):
    action = {'value': {'x_delivered_by': 'pickup'}}
