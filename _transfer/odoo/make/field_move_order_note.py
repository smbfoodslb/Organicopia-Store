# stock.move.x_order_note "Order note" (SMB, 27 Nov 2026): computed, not stored, depends on sale_line_id.
# The note lines placed directly under the product on the sales order (owner's rule: a note below a product
# belongs to that product). Shown on the delivery screen. Read with sudo so warehouse users see it.
for rec in self:
    sl = rec.sudo().sale_line_id
    txt = []
    take = False
    for l in (sl.order_id.order_line if sl else []):
        if l.id == sl.id:
            take = True
        elif take:
            if l.display_type == 'line_note':
                txt.append(l.name or '')
            else:
                break
    rec['x_order_note'] = '\n'.join(txt) or False
