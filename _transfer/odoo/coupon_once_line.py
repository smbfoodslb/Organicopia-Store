# One use per phone number for the coupons listed in ONCE (SMB, 18 Nov 2026) - part 1: when the discount line is added.
# ONCE holds the discount-line products of those coupons (8512 = HOLIDAY10). A use counts when another order carrying
# the same discount product was submitted (state sent/sale/done) or is a draft in smbfoods (an order moved there), and
# its customer's phone ends in the same 8 digits. Cancelled orders do not count. Website visitors who are not yet
# identified are checked later, when their details are saved (see the sale.order automation).
ONCE = (8512,)
PUBLIC = (821, 265)
for line in records:
    if line.product_id.id not in ONCE or env.context.get('smb_move'):
        continue
    order = line.order_id
    if order.partner_id.id in PUBLIC:
        continue
    digits = ''.join(ch for ch in (order.partner_id.phone or order.partner_shipping_id.phone or '') if ch.isdigit())[-8:]
    if len(digits) < 7:
        continue
    others = env['sale.order.line'].sudo().search([('product_id', '=', line.product_id.id), ('order_id', '!=', order.id), '|', ('order_id.state', 'in', ('sent', 'sale', 'done')), '&', ('order_id.state', '=', 'draft'), ('order_id.company_id', '=', 1)]).mapped('order_id')
    for other in others:
        if ''.join(ch for ch in (other.partner_id.phone or other.partner_shipping_id.phone or '') if ch.isdigit())[-8:] == digits:
            raise UserError("This coupon code has already been used with this phone number.")
