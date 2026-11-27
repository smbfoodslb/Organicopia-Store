# "Re-sync from Sales Order" v2 (SMB, 27 Nov 2026) - replaces the code of server action 1157 (PUW, round 139).
# Draft customer invoice: brings it fully in line with its sales order(s):
#   - linked lines: price, discount, taxes, cost (as before) AND quantity;
#   - order lines with something to invoice and no line on this invoice: added;
#   - linked lines whose order line has nothing left to invoice (quantity set to 0 on the order): removed;
#   - note lines under a product: text updated, missing ones added.
# Quantity rule: new quantity = quantity on this invoice + what Odoo says is still "to invoice" on the order line.
# Odoo's "to invoice" already follows the product's invoicing policy (ordered or delivered) and what other
# invoices and credit notes took, so partly delivered and partly invoiced orders stay right.
# Never touched: down payment lines, lines added by hand (no order link), posted invoices, the sales order itself.
# Draft credit notes: old behaviour only (price, discount, taxes, cost) - quantities of a credit note are the user's.
for inv in records:
    if inv.state != 'draft':
        raise UserError("Re-sync is only available on draft invoices.")
    if inv.move_type not in ('out_invoice', 'out_refund'):
        raise UserError("Re-sync is only available on customer invoices and credit notes.")
    linked = inv.invoice_line_ids.filtered(lambda l: l.sale_line_ids)
    if not linked:
        raise UserError("This invoice is not linked to a sales order.")
    full = inv.move_type == 'out_invoice'
    orders = linked.mapped('sale_line_ids.order_id')
    updated, added, removed, kept = [], [], [], []
    changed = env['account.move.line']
    seen = set()
    for line in linked:
        sol = line.sale_line_ids[0]
        label = line.product_id.display_name or (line.name or '')[:60] or ("line %s" % line.id)
        if sol.is_downpayment:
            continue
        if line.display_type in ('line_note', 'line_section'):
            if full and (line.name or '') != (sol.name or ''):
                line.write({'name': sol.name})
                updated.append("- note: %s" % (sol.name or '')[:80])
            seen.add(sol.id)
            continue
        vals, why = {}, []
        if abs(line.price_unit - sol.price_unit) > 0.0001:
            why.append("price %.2f -> %.2f" % (line.price_unit, sol.price_unit))
            vals['price_unit'] = sol.price_unit
        if abs(line.discount - sol.discount) > 0.0001:
            why.append("discount %.2f -> %.2f" % (line.discount, sol.discount))
            vals['discount'] = sol.discount
        if set(line.tax_ids.ids) != set(sol.tax_ids.ids):
            why.append("taxes %s -> %s" % (", ".join(line.tax_ids.mapped('name')) or "(none)", ", ".join(sol.tax_ids.mapped('name')) or "(none)"))
            vals['tax_ids'] = [(6, 0, sol.tax_ids.ids)]
        old_cost = line.x_studio_purchase_price or 0.0
        new_cost = line.currency_id.round(sol.purchase_price or 0.0) if line.currency_id else round(sol.purchase_price or 0.0, 2)
        if abs(old_cost - new_cost) > 0.0001:
            why.append("cost %.4f -> %.4f" % (old_cost, new_cost))
            vals['x_studio_purchase_price'] = new_cost
        if full and sol.id not in seen:
            target = line.quantity + sol.qty_to_invoice
            if target <= 0.0001:
                removed.append("- %s (was %g)" % (label, line.quantity))
                inv.write({'invoice_line_ids': [(2, line.id)]})
                seen.add(sol.id)
                continue
            if abs(target - line.quantity) > 0.0001:
                why.append("quantity %g -> %g" % (line.quantity, target))
                vals['quantity'] = target
        seen.add(sol.id)
        if vals:
            line.write(vals)
            changed |= line
            updated.append("- %s: %s" % (label, "; ".join(why)))
    if full:
        new_vals = []
        last_on_invoice = False
        for order in orders:
            for sol in order.order_line:
                if sol.is_downpayment:
                    last_on_invoice = False
                    continue
                if sol.display_type == 'line_section':
                    last_on_invoice = False
                    continue
                if sol.display_type == 'line_note':
                    if last_on_invoice and sol.id not in seen:
                        new_vals.append(sol._prepare_invoice_line(sequence=sol.sequence))
                        added.append("- note: %s" % (sol.name or '')[:80])
                    continue
                if sol.id in seen:
                    last_on_invoice = sol.id not in [0] and bool(inv.invoice_line_ids.filtered(lambda l: sol.id in l.sale_line_ids.ids))
                    continue
                if sol.qty_to_invoice > 0.0001:
                    v = sol._prepare_invoice_line(sequence=sol.sequence)
                    v['x_studio_purchase_price'] = inv.currency_id.round(sol.purchase_price or 0.0)
                    new_vals.append(v)
                    added.append("- %s: quantity %g" % (sol.product_id.display_name, sol.qty_to_invoice))
                    last_on_invoice = True
                else:
                    last_on_invoice = False
                    if sol.product_uom_qty > 0:
                        kept.append("- %s / %s (ordered %g): nothing to invoice yet" % (order.name, sol.product_id.display_name, sol.product_uom_qty))
        if new_vals:
            before = inv.invoice_line_ids
            inv.write({'invoice_line_ids': [(0, 0, v) for v in new_vals]})
            changed |= (inv.invoice_line_ids - before).filtered(lambda l: l.display_type == 'product')
    changed = changed.exists()
    if changed:
        env['ir.actions.server'].browse(1151).with_context(active_model='account.move.line', active_ids=changed.ids, active_id=changed.ids[0]).run()
    manual = inv.invoice_line_ids.filtered(lambda l: l.display_type == 'product' and not l.sale_line_ids)
    body = ["Re-sync from Sales Order %s" % ", ".join(orders.mapped('name'))]
    if updated:
        body.append("Lines updated:")
        body.extend(updated)
    if added:
        body.append("Lines added:")
        body.extend(added)
    if removed:
        body.append("Lines removed (nothing left to invoice on the order):")
        body.extend(removed)
    if not (updated or added or removed):
        body.append("Nothing to change: the invoice already matches the order.")
    if kept:
        body.append("Order lines not on this invoice:")
        body.extend(kept)
    if manual:
        body.append("Lines added by hand on the invoice, left as they are:")
        body.extend(["- %s" % (l.product_id.display_name or l.name or '') for l in manual])
    inv.message_post(body="\n".join(body))
