for order in self:
    due = 0.0
    if order.x_delivered_by in ('flypost', 'flypost_pickup') and order.x_flypost_collects:
        invoiced = order.order_line.invoice_lines.move_id.filtered(lambda m: m.state == 'posted')
        due = order.x_amount_open if invoiced else order.amount_total
    order['x_flypost_due'] = max(due, 0.0)
