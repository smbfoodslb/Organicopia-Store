for order in self:
    moves = order.order_line.invoice_lines.move_id.filtered(lambda m: m.state == 'posted' and m.move_type in ('out_invoice', 'out_refund'))
    order['x_amount_open'] = sum(m.amount_residual if m.move_type == 'out_invoice' else -m.amount_residual for m in moves)
