# Retail delivery fee on back-office orders (SMB, 16 Nov 2026; delivery zones since 17 Nov 2026). Website orders get theirs at checkout.
# RETAIL LB quotations: governorate Beirut on the delivery address (or no governorate at all) -> carrier BEIRUT, $3;
# any other governorate -> carrier OUTSIDE, $5. Both VAT included, both free when the goods reach FREE_FROM (VAT included).
# To waive or change it on one order, pick another delivery method on that order (for example "Pickup at our shop"):
# an order whose delivery method is neither of the two is left alone.
BEIRUT = 4
OUTSIDE = 6
FEES = {BEIRUT: 3.0, OUTSIDE: 5.0}
BEIRUT_STATES = (1895, 1896)
FREE_FROM = 40.0
for order in records:
    if env.context.get('smb_delivery_auto') or order.website_id or order.state not in ('draft', 'sent') or order.pricelist_id.id != 27:
        continue
    if order.carrier_id and order.carrier_id.id not in FEES:
        continue
    goods = order.order_line.filtered(lambda l: not l.display_type and not l.is_delivery)
    deliv = order.order_line.filtered(lambda l: l.is_delivery)
    if not goods:
        continue
    st = order.partner_shipping_id.state_id.id
    cid = BEIRUT if (not st or st in BEIRUT_STATES) else OUTSIDE
    carrier = env['delivery.carrier'].sudo().browse(cid)
    if carrier.company_id and carrier.company_id != order.company_id:
        continue  # the delivery methods belong to SMBF; an order of the other company is left alone instead of failing to save
    total = sum(goods.mapped('price_total'))
    taxes = carrier.product_id.sudo().taxes_id.filtered(lambda t: t.company_id == order.company_id)
    if order.fiscal_position_id:
        taxes = order.fiscal_position_id.map_tax(taxes)
    rate = sum(t.amount for t in taxes if t.amount_type == 'percent' and not t.price_include) / 100.0
    want = 0.0 if total >= FREE_FROM else round(FEES[cid] / (1.0 + rate), 2)
    if len(deliv) == 1 and order.carrier_id.id == cid and abs(deliv.price_unit - want) < 0.005:
        continue
    order.with_context(smb_delivery_auto=True).set_delivery_line(carrier, want)
