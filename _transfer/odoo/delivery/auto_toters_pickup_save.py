# On create / when the customer changes on a sales order: Toters orders are "Delivered by: Pick Up" by default
# (owner, 23 Nov 2026). The same rule as the form on-change, for orders that do not come through the form.
TOTERS = 241
for order in records:
    if order.state in ('draft', 'sent') and order.partner_id.commercial_partner_id.id == TOTERS and order.x_delivered_by in (False, 'own'):
        order.write({'x_delivered_by': 'pickup'})
