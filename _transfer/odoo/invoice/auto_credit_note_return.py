# Customer credit note posted: prepare the stock return (SMB, 26 Nov 2026). base.automation on account.move, on write
# of "state" to posted, credit notes (out_refund) with "Goods are being returned" ticked (x_goods_returned, on by default).
# Odoo does not link a credit note to stock: without a return receipt the goods stay counted as delivered. For every
# credited stock product that comes from a sales order, the quantity is returned against the delivery it left with
# (most recent first, never more than was delivered and not yet returned), through Odoo's own return wizard. The return
# receipts are left READY, not validated: stock only goes up when someone confirms the goods are physically back.
# Nothing is created twice (the receipt carries x_credit_note_id), and nothing here touches the accounting of the note.
# The same code is run by hand (Action menu) for a credit note posted before this existed.
# 27 Nov 2026: lines with no order behind them (a credit note created on its own) get one plain return receipt into the
# company's Organicopia Store warehouse, also left READY; all three companies.
for move in records:
    if move.move_type != 'out_refund' or move.state != 'posted' or not move.x_goods_returned:
        continue
    Picking = env['stock.picking'].sudo()
    if Picking.search_count([('x_credit_note_id', '=', move.id), ('state', '!=', 'cancel')]):
        continue
    plan, missing, seen, loose = {}, [], False, []
    for line in move.invoice_line_ids:
        product = line.product_id
        if not product or not product.is_storable or line.quantity <= 0:
            continue
        seen = True
        if not line.sale_line_ids:
            # 27 Nov 2026: a credit note written on its own (no invoice or order behind the line, the usual case for
            # Gray Mackenzie returns) cannot be matched to a delivery: its goods come back on one plain receipt, below
            loose.append(line)
            continue
        left = line.quantity
        outs = line.sale_line_ids.sudo().mapped('move_ids').filtered(lambda m: m.state == 'done' and m.product_id == product and m.location_dest_id.usage == 'customer').sorted(lambda m: m.date, reverse=True)
        for out in outs:
            back = sum(out.returned_move_ids.filtered(lambda r: r.state != 'cancel').mapped('product_uom_qty'))
            take = min(out.quantity - back, left)
            if take > 0.0001:
                plan.setdefault(out.picking_id.id, {})
                plan[out.picking_id.id][out.id] = plan[out.picking_id.id].get(out.id, 0) + take
                left -= take
        if left > 0.0001:
            missing.append('%g x %s' % (left, product.display_name))
    made = Picking
    for picking_id, moves in plan.items():
        picking = Picking.browse(picking_id)
        wizard = env['stock.return.picking'].sudo().with_company(picking.company_id).with_context(active_id=picking_id, active_ids=[picking_id], active_model='stock.picking').create({'picking_id': picking_id})
        for wl in wizard.product_return_moves:
            wl.write({'quantity': moves.get(wl.move_id.id, 0)})
        res = wizard.action_create_returns()
        ret = Picking.browse(res.get('res_id'))
        ret.write({'x_credit_note_id': move.id, 'origin': '%s / %s' % (ret.origin or picking.name, move.name)})
        made |= ret
    if loose:
        # one receipt Customers -> stock of the "Organicopia Store" warehouse of the credit note's company (owner: SMBF
        # Organicopia Store / smbfoods Organicopia store; a company without one uses its first warehouse). No order changes.
        WH = env['stock.warehouse'].sudo()
        wh = WH.search([('company_id', '=', move.company_id.id), ('name', 'ilike', 'Organicopia')], limit=1) or WH.search([('company_id', '=', move.company_id.id)], limit=1)
        if wh:
            src = env.ref('stock.stock_location_customers')
            ret = Picking.with_company(move.company_id).create({
                'picking_type_id': wh.in_type_id.id, 'partner_id': (move.partner_shipping_id or move.partner_id).id, 'company_id': move.company_id.id,
                'location_id': src.id, 'location_dest_id': wh.lot_stock_id.id, 'origin': 'Return / %s' % move.name, 'x_credit_note_id': move.id,
                'move_ids': [(0, 0, {'product_id': l.product_id.id, 'product_uom_qty': l.quantity, 'product_uom': l.product_uom_id.id,
                                     'location_id': src.id, 'location_dest_id': wh.lot_stock_id.id, 'company_id': move.company_id.id}) for l in loose],
            })
            ret.action_confirm()
            made |= ret
        else:
            missing += ['%g x %s' % (l.quantity, l.product_id.display_name) for l in loose]
    if made:
        note = 'Return prepared for the goods of this credit note: %s. Validate it when the goods are back; cancel it if they are not coming back.' % ', '.join(made.mapped('name'))
        if missing:
            note += ' No delivery found to return: %s.' % '; '.join(missing)
        move.message_post(body=note)
    elif seen:
        move.message_post(body='No return was prepared: no delivery of a sales order was found for %s. Return the goods by hand if they are coming back.' % ('; '.join(missing) or 'these products'))
