# base.automation on payment.transaction (on create and on write of state/provider) - SMB, 27 Nov 2026.
# The customer chose "Whish" at checkout (payment provider __WHISH__): the order's "Payment at delivery" becomes
# Whish, so the driver has nothing to collect. Nothing else changes: the order is confirmed exactly like a
# "pay on delivery" order.
WHISH_PROVIDER = __WHISH__
for tx in records.sudo():
    if tx.provider_id.id == WHISH_PROVIDER:
        orders = tx.sale_order_ids.filtered(lambda o: o.x_collect != 'whish' and o.state != 'cancel')
        if orders:
            orders.write({'x_collect': 'whish'})
