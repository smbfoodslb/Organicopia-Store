# Organicopia Rewards - points taken back for returns (SMB, 18 Nov 2026).
# When a customer CREDIT NOTE is posted, the points that the returned goods had earned are taken off the card:
# RATE points per $ credited for goods (VAT included, delivery not counted), per sales order the credit note refers to,
# never more than that order still holds as earned. A full return therefore takes back everything the order earned, a
# partial return only the share of the returned items. One history line per credit note and order ("Rewards: earned
# points taken back (return ...)"); posting the same credit note again does nothing.
PROGRAM = 10
RATE = 5.0
RETAIL = 27
for move in records:
    if move.move_type != 'out_refund' or move.state != 'posted':
        continue
    Hist = env['loyalty.history'].sudo()
    credited = {}
    for line in move.invoice_line_ids:
        for sl in line.sale_line_ids:
            if sl.is_delivery or sl.order_id.pricelist_id.id != RETAIL:
                continue
            credited[sl.order_id.id] = credited.get(sl.order_id.id, 0.0) + line.price_total
            break
    for order in env['sale.order'].sudo().browse(list(credited.keys())):
        tag = '(return %s on %s)' % (move.name, order.name)
        mine = Hist.search([('order_model', '=', 'sale.order'), ('order_id', '=', order.id), ('card_id.program_id', '=', PROGRAM), ('description', '=like', 'Rewards:%')])
        if mine.filtered(lambda h: tag in h.description):
            continue
        earned = sum(mine.filtered(lambda h: h.description.startswith('Rewards: earned on')).mapped('issued')) - sum(mine.filtered(lambda h: h.description.startswith('Rewards: earned points taken back')).mapped('used'))
        pts = min(int(round(earned)), int(round(credited[order.id] * RATE)))
        card = mine[:1].card_id
        if pts <= 0 or not card:
            continue
        card.write({'points': card.points - pts})
        Hist.create({'card_id': card.id, 'order_model': 'sale.order', 'order_id': order.id, 'description': 'Rewards: earned points taken back %s' % tag, 'used': pts})
        move.sudo().message_post(body='Organicopia Rewards: %d points taken back for this return (%.2f credited for goods on %s). Balance: %d.' % (pts, credited[order.id], order.name, card.points))
