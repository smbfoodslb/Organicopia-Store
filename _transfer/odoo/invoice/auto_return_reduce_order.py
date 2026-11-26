# Return of a credit note validated: the order no longer asks to be invoiced (SMB, 26 Nov 2026). base.automation on
# stock.picking, on write of "state" to done, only for the returns prepared from a credit note (x_credit_note_id, see
# auto_credit_note_return.py).
# After the credit note and the return, the order line still says the original quantity ordered; for products invoiced
# on ordered quantity Odoo then keeps the order in "To Invoice" (S100296: 100 seals returned and credited, the order
# still wanted to bill 100). The ordered quantity of the line is reduced by what came back, never below what is still
# delivered or still invoiced. The change is logged on the order; the original quantity stays on the invoice, the
# credit note, the delivery and the return. Locked or cancelled orders are left alone. Prices, discounts, delivery
# fees, coupons and reward points are not recalculated (owner's choice of the simple rule).
for picking in records:
    if picking.state != 'done' or not picking.x_credit_note_id:
        continue
    changes = {}
    for mv in picking.move_ids.filtered(lambda m: m.state == 'done' and m.sale_line_id and m.location_id.usage == 'customer'):
        line = mv.sale_line_id.sudo()
        order = line.order_id
        if order.state != 'sale' or order.locked or mv.product_uom != line.product_uom_id:
            continue
        new = max(line.product_uom_qty - mv.quantity, line.qty_delivered, line.qty_invoiced, 0)
        if new < line.product_uom_qty - 0.0001:
            old = line.product_uom_qty
            # price and discount are sent along: Odoo would otherwise recompute them for the new quantity
            line.write({'product_uom_qty': new, 'price_unit': line.price_unit, 'discount': line.discount})
            changes.setdefault(order.id, []).append('%s: %g -> %g' % (line.product_id.display_name, old, new))
    # what the same credit note refunded besides goods (delivery fee, a free or discount line): nothing comes back to
    # stock for those, so they are settled here, at the same moment
    for cl in picking.x_credit_note_id.invoice_line_ids.filtered(lambda l: l.product_id and not l.product_id.is_storable and l.quantity > 0 and l.sale_line_ids):
        line = cl.sale_line_ids[:1].sudo()
        order = line.order_id
        if order.state != 'sale' or order.locked:
            continue
        new = max(line.product_uom_qty - cl.quantity, line.qty_invoiced, 0)
        if new < line.product_uom_qty - 0.0001:
            old = line.product_uom_qty
            line.write({'product_uom_qty': new, 'price_unit': line.price_unit, 'discount': line.discount})
            changes.setdefault(order.id, []).append('%s: %g -> %g' % (line.product_id.display_name, old, new))
    for order_id, rows in changes.items():
        env['sale.order'].sudo().browse(order_id).message_post(body='Goods returned (%s, credit note %s): ordered quantity reduced. %s' % (picking.name, picking.x_credit_note_id.name, '; '.join(rows)))
