# Move a quotation from SMBF (company 3) to smbfoods (company 1): same customer and lines, matching warehouse, then
# cancel the SMBF copy. Both orders link to each other in the chatter.
# 18 Nov 2026 (owner): smbfoods charges no VAT, but the customer must pay exactly the total confirmed on the website.
# So every line is carried at its VAT-INCLUSIVE amount (unit price = SMBF line total incl. VAT / quantity, no tax,
# no discount %), delivery, coupon/promotion and free-gift lines included. They are copied as plain lines with frozen
# amounts, so smbfoods never recalculates a promotion. If rounding still leaves a difference, one "Rounding adjustment"
# line (product ROUND) makes the two totals equal.
# This applies to RETAIL orders only (price list RETAIL LB, id 27). WHOLESALE orders keep the earlier behaviour (owner,
# 18 Nov 2026): same pre-VAT unit prices and discount %, no delivery line, so the smbfoods total is the total without VAT.
RETAIL_PRICELIST = 27
WAREHOUSE = {7: 5, 6: 1}  # SMBF Organicopia Store -> smbfoods Organicopia Store, SMBF New Rawda WH -> smbfoods New Rawda WH
ROUND_CODE = 'ROUND'
for order in records:
    if order.company_id.id != 3:
        raise UserError("Only SMBF quotations can be moved to smbfoods.")
    if order.state not in ('draft', 'sent'):
        raise UserError("Only unconfirmed quotations can be moved. Cancel this order and create it in smbfoods manually.")
    retail = order.pricelist_id.id == RETAIL_PRICELIST
    lines = []
    for l in order.order_line:
        if l.display_type:
            lines.append((0, 0, {'display_type': l.display_type, 'name': l.name}))
            continue
        if not retail:
            if not l.is_delivery:
                lines.append((0, 0, {'product_id': l.product_id.id, 'name': l.name, 'product_uom_qty': l.product_uom_qty, 'product_uom_id': l.product_uom_id.id, 'price_unit': l.price_unit, 'discount': l.discount}))
            continue
        qty = l.product_uom_qty
        vals = {'product_id': l.product_id.id, 'name': l.name, 'product_uom_qty': qty, 'product_uom_id': l.product_uom_id.id,
                'price_unit': round(l.price_total / qty, 3) if qty else 0.0, 'discount': 0.0, 'tax_ids': [(6, 0, [])]}
        if l.is_delivery:
            vals['is_delivery'] = True
        lines.append((0, 0, vals))
    SO = env['sale.order'].with_company(1).with_context(allowed_company_ids=[1, 3], default_company_id=1, smb_delivery_auto=True)
    vals = {
        'company_id': 1,
        'partner_id': order.partner_id.id,
        'partner_invoice_id': order.partner_invoice_id.id,
        'partner_shipping_id': order.partner_shipping_id.id,
        'pricelist_id': order.pricelist_id.id if not order.pricelist_id.company_id or order.pricelist_id.company_id.id == 1 else False,
        'client_order_ref': order.client_order_ref,
        'origin': order.name,
        'user_id': env.user.id,
        'order_line': lines,
    }
    if order.warehouse_id.id in WAREHOUSE:
        vals['warehouse_id'] = WAREHOUSE[order.warehouse_id.id]
    new = SO.create(vals)
    if retail:
        # the create may have re-read prices or taxes from the product: put the frozen values back
        src = order.order_line.filtered(lambda l: not l.display_type)
        dst = new.order_line.filtered(lambda l: not l.display_type)
        if len(src) == len(dst):
            for s, d in zip(src, dst):
                want = round(s.price_total / s.product_uom_qty, 3) if s.product_uom_qty else 0.0
                if abs(d.price_unit - want) > 0.0005 or d.discount or d.tax_ids:
                    d.write({'price_unit': want, 'discount': 0.0, 'tax_ids': [(6, 0, [])]})
        diff = round(order.amount_total - new.amount_total, 2)
        if abs(diff) >= 0.005:
            rp = env['product.product'].sudo().search([('default_code', '=', ROUND_CODE)], limit=1)
            if not rp:
                raise UserError("The totals differ by %.2f and the product with reference %s is missing." % (diff, ROUND_CODE))
            new.write({'order_line': [(0, 0, {'product_id': rp.id, 'name': 'Rounding adjustment', 'product_uom_qty': 1, 'price_unit': diff, 'tax_ids': [(6, 0, [])]})]})
        if abs(round(order.amount_total - new.amount_total, 2)) >= 0.005:
            raise UserError("Not moved: the smbfoods total (%.2f) would not match the website total (%.2f)." % (new.amount_total, order.amount_total))
    if retail:
        new.message_post(body='Moved from SMBF quotation %s (customer %s). Total kept at %.2f, VAT included in the line prices.' % (order.name, order.partner_id.name, order.amount_total))
    else:
        new.message_post(body='Moved from SMBF quotation %s (wholesale, customer %s). Prices without VAT.' % (order.name, order.partner_id.name))
    order.message_post(body='Moved to smbfoods as %s and cancelled here.' % new.name)
    order.with_context(disable_cancel_warning=True).action_cancel()
    action = {'type': 'ir.actions.act_window', 'res_model': 'sale.order', 'res_id': new.id, 'view_mode': 'form', 'views': [[False, 'form']], 'target': 'current', 'context': {'allowed_company_ids': [1, 3]}}
