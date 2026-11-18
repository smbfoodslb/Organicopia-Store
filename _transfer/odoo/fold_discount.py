# Promotions, coupons and points as a discount % on every line (SMB, 18 Nov 2026).
# Odoo's discount programs put the discount on the order as one separate negative line. The owner wants it the way the
# Discount button's first option does it ("On All Order Lines"): each goods line carries the Disc.% and invoices follow.
# When an order is CONFIRMED, the value of its discount lines is spread over the goods lines as a percentage (combined
# with any Disc.% already there) and the discount lines are kept at 0.00 - they stay on the order as a record of which
# promotion / coupon / points were used (the one-use-per-phone rule and the points balance read them).
# The order total must not change: a remaining difference of a cent or two goes to one "Rounding adjustment" line.
# Delivery and free-gift lines are not touched.
ROUND_CODE = 'ROUND'
for order in records:
    if order.state != 'sale' or env.context.get('smb_fold'):
        continue
    disc_lines = order.order_line.filtered(lambda l: l.reward_id and l.reward_id.reward_type == 'discount' and l.price_total < 0)
    if not disc_lines:
        continue
    goods = order.order_line.filtered(lambda l: not l.display_type and not l.reward_id and not l.is_delivery and l.price_total > 0)
    base = sum(goods.mapped('price_total'))
    off = -sum(disc_lines.mapped('price_total'))
    if base <= 0 or off <= 0 or off > base:
        continue
    before = order.amount_total
    keep = 1.0 - off / base
    order = order.with_context(smb_fold=True, smb_delivery_auto=True)
    for l in goods.with_context(smb_fold=True):
        l.write({'discount': round(100.0 - (100.0 - l.discount) * keep, 2)})
    disc_lines.with_context(smb_fold=True).write({'price_unit': 0.0})
    diff = round(before - order.amount_total, 2)
    if abs(diff) >= 0.005:
        rp = env['product.product'].sudo().search([('default_code', '=', ROUND_CODE)], limit=1)
        if rp:
            order.write({'order_line': [(0, 0, {'product_id': rp.id, 'name': 'Rounding adjustment', 'product_uom_qty': 1, 'price_unit': diff, 'tax_ids': [(6, 0, [])]})]})
    order.message_post(body='Discount of %.2f moved onto the order lines as a percentage; total unchanged at %.2f.' % (off, order.amount_total))
