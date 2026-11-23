# On create of a sales order: fill "Payment at delivery" when it is empty (orders that do not come through the
# form: website, portal, scripts). Same rule as the form on-change. Owner, 23 Nov 2026.
RETAIL = (27, 30)
for order in records:
    if not order.x_collect and order.pricelist_id:
        order.write({'x_collect': 'collect' if order.pricelist_id.id in RETAIL else 'account'})
