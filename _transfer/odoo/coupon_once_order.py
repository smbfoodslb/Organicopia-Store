# One use per phone number for the coupons listed in ONCE (SMB, 18 Nov 2026).
# ONCE holds the discount-line products of those coupons (8512 = HOLIDAY10). A use counts when ANOTHER order carrying the
# same discount product was submitted (state sent/sale/done) or is a draft in smbfoods (an order moved there), and its
# customer's phone ends in the same 8 digits. Cancelled orders do not count.
# Runs when an order's lines or customer change (a website visitor applies the code before we know who they are; the
# phone is only known once their details are saved).
#  - on the website: the coupon is taken off the order; the basket / checkout page tell the customer before anything is
#    submitted;
#  - in the back office: the change is refused with a message.
ONCE = (8512,)
PUBLIC = (821, 265)
for order in records:
    if env.context.get('smb_move') or order.state not in ('draft', 'sent') or order.partner_id.id in PUBLIC:
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
    if not hit:
        continue
    if not env.context.get('website_id'):
        raise UserError("This coupon code has already been used with this phone number (order %s)." % hit.name)
    rules = lines.mapped('reward_id.program_id.rule_ids')
    lines.sudo().unlink()
    if rules:
        order.sudo().write({'code_enabled_rule_ids': [(3, r.id) for r in rules]})
    order.sudo()._update_programs_and_rewards()
    order.sudo().message_post(body='Coupon removed from this order: the phone number has already used it on %s.' % hit.name)
