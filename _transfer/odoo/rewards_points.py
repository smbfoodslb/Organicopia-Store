# Organicopia Rewards - points earned and returned (SMB, 18 Nov 2026).
# Program 10 "Organicopia Rewards": 100 points = $1, redeemed by Odoo itself in steps of 500 points ($5). Odoo's own
# earning rule is switched off on purpose (it would let a customer spend points on the very order that earns them), so
# the points are credited here:
#  - when a RETAIL order (price list 27, either company) is CONFIRMED and its customer has a website account:
#    RATE points per $ actually paid for goods (order total, VAT included, after every discount, without delivery);
#  - when such an order is CANCELLED afterwards, what it earned is taken back, and points spent on an order that had been
#    moved to smbfoods are returned (for orders that stayed in SMBF Odoo returns them itself).
# Every movement is written to the card's history (the customer sees it in their account) with a text starting "Rewards:".
PROGRAM = 10
RATE = 5.0
RETAIL = 27
for order in records:
    if order.pricelist_id.id != RETAIL or order.state not in ('sale', 'cancel'):
        continue
    partner = order.partner_id.commercial_partner_id
    Hist = env['loyalty.history'].sudo()
    mine = Hist.search([('order_model', '=', 'sale.order'), ('order_id', '=', order.id), ('card_id.program_id', '=', PROGRAM), ('description', '=like', 'Rewards:%')])
    earned = sum(mine.filtered(lambda h: h.description.startswith('Rewards: earned on')).mapped('issued')) - sum(mine.filtered(lambda h: h.description.startswith('Rewards: earned points taken back')).mapped('used'))
    spent = sum(mine.filtered(lambda h: h.description.startswith('Rewards: spent on')).mapped('used')) - sum(mine.filtered(lambda h: h.description.startswith('Rewards: spent points returned')).mapped('issued'))
    card = env['loyalty.card'].sudo().search([('program_id', '=', PROGRAM), ('partner_id', '=', partner.id)], limit=1)
    if order.state == 'sale':
        if earned > 0:
            continue
        users = (order.partner_id | partner).sudo().mapped('user_ids').filtered(lambda u: u.share and u.active)
        if not users:
            continue
        paid = order.amount_total - sum(order.order_line.filtered(lambda l: l.is_delivery).mapped('price_total'))
        pts = int(round(paid * RATE))
        if pts <= 0:
            continue
        if not card:
            card = env['loyalty.card'].sudo().create({'program_id': PROGRAM, 'partner_id': partner.id, 'points': 0})
        card.write({'points': card.points + pts})
        Hist.create({'card_id': card.id, 'order_model': 'sale.order', 'order_id': order.id, 'description': 'Rewards: earned on %s' % order.name, 'issued': pts})
        order.sudo().message_post(body='Organicopia Rewards: %d points earned (%.2f paid for goods). Balance: %d.' % (pts, paid, card.points))
    elif card and (earned > 0 or spent > 0):
        card.write({'points': card.points - earned + spent})
        if earned > 0:
            Hist.create({'card_id': card.id, 'order_model': 'sale.order', 'order_id': order.id, 'description': 'Rewards: earned points taken back (%s cancelled)' % order.name, 'used': earned})
        if spent > 0:
            Hist.create({'card_id': card.id, 'order_model': 'sale.order', 'order_id': order.id, 'description': 'Rewards: spent points returned (%s cancelled)' % order.name, 'issued': spent})
        order.sudo().message_post(body='Organicopia Rewards: order cancelled, %d earned points taken back, %d spent points returned. Balance: %d.' % (earned, spent, card.points))
