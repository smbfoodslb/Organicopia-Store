# "Bring from smbfoods": one Route A transfer for everything SMBF is short of (SMB, 26 Nov 2026). Run from the "To make"
# page by the owner only, with context smb_bring = [[product_id, quantity], ...]. Always smbfoods (company 1) -> SMBF
# (company 3), never the other way. The sequence is the one done by hand until now:
#   1 purchase order in SMBF from smbfoods (fiscal position 9, tax 69 = no VAT) at smbfoods' cost, receipt type 67
#   2 confirmed: Odoo raises the sales order in smbfoods; it is confirmed
#   3 delivery in smbfoods taken from where the stock is, validated     4 receipt in SMBF validated
#   5 invoice in smbfoods posted                                        6 bill in SMBF, referring to it, posted
# Everything or nothing: any step that cannot be completed raises an error and nothing is kept.
if env.uid != 6 and not env.user.has_group('account.group_account_manager'):
    raise UserError('Only the owner can bring stock from smbfoods.')
items = [(int(i[0]), float(i[1])) for i in (env.context.get('smb_bring') or []) if float(i[1]) > 0]
if not items:
    raise UserError('Nothing to bring.')
C1 = env['res.company'].sudo().browse(1)
C3 = env['res.company'].sudo().browse(3)
Product = env['product.product'].sudo()
now = datetime.datetime.now()
lines = []
for pid, qty in items:
    p = Product.browse(pid)
    spare = p.with_context(allowed_company_ids=[1]).free_qty
    if spare < qty - 0.0001:
        raise UserError('%s: smbfoods has only %g free, %g asked.' % (p.display_name, spare, qty))
    lines.append((0, 0, {'product_id': p.id, 'name': p.display_name, 'product_qty': qty, 'price_unit': p.with_company(C1).standard_price, 'tax_ids': [(6, 0, [69])], 'date_planned': now}))
ctx3 = dict(env.context, allowed_company_ids=[3, 1])
ctx1 = dict(env.context, allowed_company_ids=[1, 3])
po = env['purchase.order'].sudo().with_company(C3).with_context(ctx3).create({'partner_id': C1.partner_id.id, 'company_id': 3, 'picking_type_id': 67, 'fiscal_position_id': 9, 'order_line': lines})
po.button_confirm()
so = env['sale.order'].sudo().with_context(ctx1).search([('auto_purchase_order_id', '=', po.id)], limit=1)
if not so:
    raise UserError('The sales order in smbfoods was not raised by %s.' % po.name)
so = so.with_company(C1)
if so.state in ('draft', 'sent'):
    so.action_confirm()
Quant = env['stock.quant'].sudo()
outs = so.picking_ids.filtered(lambda k: k.state not in ('done', 'cancel'))
for pick in outs:
    pick.action_assign()
    for mv in pick.move_ids:
        if mv.quantity < mv.product_uom_qty - 0.0001:
            # not where Odoo looked: take it from the smbfoods location that holds it
            quant = Quant.search([('product_id', '=', mv.product_id.id), ('company_id', '=', 1), ('location_id.usage', '=', 'internal'), ('quantity', '>', 0)], order='quantity desc', limit=1)
            if quant:
                mv.move_line_ids.unlink()
                mv.write({'location_id': quant.location_id.id})
    pick.action_assign()
    for mv in pick.move_ids:
        if mv.quantity < mv.product_uom_qty - 0.0001:
            raise UserError('%s: could not reserve %g in one smbfoods location.' % (mv.product_id.display_name, mv.product_uom_qty))
        mv.write({'picked': True})
    pick.with_context(skip_backorder=True, skip_sms=True).button_validate()
    if pick.state != 'done':
        raise UserError('The delivery %s could not be validated.' % pick.name)
ins = po.picking_ids.filtered(lambda k: k.state not in ('done', 'cancel'))
for pick in ins:
    pick.action_assign()
    for mv in pick.move_ids:
        mv.write({'quantity': mv.product_uom_qty, 'picked': True})
    pick.with_context(skip_backorder=True, skip_sms=True).button_validate()
    if pick.state != 'done':
        raise UserError('The receipt %s could not be validated.' % pick.name)
wizard = env['sale.advance.payment.inv'].sudo().with_company(C1).with_context(dict(ctx1, active_model='sale.order', active_ids=so.ids, active_id=so.id)).create({'advance_payment_method': 'delivered'})
wizard.create_invoices()
inv = so.invoice_ids.filtered(lambda m: m.state == 'draft')
inv.action_post()
po.with_company(C3).with_context(ctx3).action_create_invoice()
bill = po.invoice_ids.filtered(lambda m: m.state == 'draft')
bill.write({'invoice_date': now.date(), 'ref': ', '.join(inv.mapped('name'))})
bill.action_post()
done = 'Brought from smbfoods: %s. Purchase order %s, sales order %s, delivery %s, receipt %s, invoice %s, bill %s.' % (
    '; '.join('%g x %s' % (q, Product.browse(i).display_name) for i, q in items), po.name, so.name,
    ', '.join(outs.mapped('name')), ', '.join(ins.mapped('name')), ', '.join(inv.mapped('name')), ', '.join(bill.mapped('name')))
po.message_post(body=done)
action = {'type': 'ir.actions.client', 'tag': 'display_notification', 'params': {'title': 'Done', 'type': 'success', 'sticky': True, 'message': done}}
