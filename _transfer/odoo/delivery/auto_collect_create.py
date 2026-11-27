# On create of a sales order: fill "Payment at delivery" when it is empty (orders that do not come through the
# form: website, portal, scripts). Same rule as the form on-change. Owner, 23 Nov 2026.
# A customer ticked "Collect payment on delivery" (res.partner.x_collect_delivery, on the contact or its company)
# is always collect, whatever the price list (owner, 27 Nov 2026).
RETAIL = (27,)  # RETAIL LB only; RETAIL Toters (30) is pick-up and settled by Toters = on account (owner, 23 Nov 2026)
for order in records:
    if not order.x_collect and order.pricelist_id:
        p = order.partner_id
        ticked = p.x_collect_delivery or p.commercial_partner_id.x_collect_delivery
        order.write({'x_collect': 'collect' if (ticked or order.pricelist_id.id in RETAIL) else 'account'})
