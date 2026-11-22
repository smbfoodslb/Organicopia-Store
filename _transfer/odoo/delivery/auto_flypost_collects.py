# Form on-change of "Delivered by" on a sales order (base.automation, trigger on_change), so the tick shows
# at once, before saving. FlyPost collects the money only on retail orders (price list 27 RETAIL LB);
# business customers pay the owner directly. The tick can be changed by hand afterwards, e.g. a retail
# customer who pays by Whish. The delivery planner sets the same value itself when it marks an order.
RETAIL_PRICELIST = 27
order = env.context.get('onchange_self')
if order is not None:
    collects = order.x_delivered_by in ('flypost', 'flypost_pickup') and order.pricelist_id.id == RETAIL_PRICELIST
    action = {'value': {'x_flypost_collects': bool(collects)}}
