# Form on-change of the customer or the price list on a sales order (base.automation, trigger on_change):
# "Payment at delivery" follows the price list - retail (RETAIL LB 27) = collect,
# everything else (wholesale) = on account, do not collect. The owner can change it on any order (23 Nov 2026).
RETAIL = (27,)  # RETAIL LB only; RETAIL Toters (30) is pick-up and settled by Toters = on account (owner, 23 Nov 2026)
order = env.context.get('onchange_self')
if order is not None and order.pricelist_id:
    action = {'value': {'x_collect': 'collect' if order.pricelist_id.id in RETAIL else 'account'}}
