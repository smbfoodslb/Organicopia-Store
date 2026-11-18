# One use per phone number for the coupons listed in ONCE (SMB, 18 Nov 2026) - part 2: a website visitor applies the code
# before we know who they are; when their details are saved (the order's customer changes) the phone is checked, and a
# coupon already used with that number is taken off the order. The checkout page then shows the customer the new total
# before anything is submitted. Same rule and same ONCE list as the sale.order.line automation.
ONCE = (8512,)
PUBLIC = (821, 265)
for order in records:
    if order.state not in ('draft', 'sent') or order.partner_id.id in PUBLIC:
        continue
    lines = order.order_line.filtered(lambda l: l.product_id.id in ONCE)
    if not lines:
        continue
    digits = ''.join(ch for ch in (order.partner_id.phone or order.partner_shipping_id.phone or '') if ch.isdigit())[-8:]
    if len(digits) < 7:
        continue
    others = env['sale.order.line'].sudo().search([('product_id', 'in', lines.mapped('product_id').ids), ('order_id', '!=', order.id), '|', ('order_id.state', 'in', ('sent', 'sale', 'done')), '&', ('order_id.state', '=', 'draft'), ('order_id.company_id', '=', 1)])
    hit = False
    for ol in others:
        other = ol.order_id
        if ''.join(ch for ch in (other.partner_id.phone or other.partner_shipping_id.phone or '') if ch.isdigit())[-8:] == digits:
            hit = other
            break
    if hit:
        rules = lines.mapped('reward_id.program_id.rule_ids')
        lines.sudo().unlink()
        if rules:
            order.sudo().write({'code_enabled_rule_ids': [(3, r.id) for r in rules]})
        order.sudo().message_post(body='Coupon removed from this order: the phone number has already used it on %s.' % hit.name)
