# Runs when "Delivered by" changes on a sales order. FlyPost collects the money only on retail orders
# (price list 27 RETAIL LB); business customers pay the owner directly. The tick can be changed by hand
# afterwards, e.g. a retail customer who pays by Whish.
RETAIL_PRICELIST = 27
for order in records:
    collects = order.x_delivered_by in ('flypost', 'flypost_pickup') and order.pricelist_id.id == RETAIL_PRICELIST
    if order.x_flypost_collects != collects:
        order.write({'x_flypost_collects': collects})
