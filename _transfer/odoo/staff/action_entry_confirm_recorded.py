# Staff ledger: confirm a cash entry whose payment is ALREADY recorded in Accounting (owner) - SMB, 24 Nov 2026.
# For customers who want the payment receipt before the delivery: the owner records the payment ahead, not linked to
# any invoice (so the planner still says "collect" and the driver gets his entry). This button creates NO payment:
# it takes that recorded payment, applies it to the entry's invoice, then any rest to the customer's oldest unpaid
# invoices in the same company, and confirms the entry for the driver's statement.
def unapplied(p):
    return round(-sum(p.sudo().move_id.line_ids.filtered(lambda l: l.account_id.account_type == 'asset_receivable').mapped('amount_residual')), 2)
for r in records:
    if r.x_state != 'review' or r.x_type != 'cash':
        continue
    amt = round(-r.x_amount, 2)
    if amt <= 0:
        raise UserError('%s: the amount must be positive.' % r.x_name)
    inv = r.x_invoice_id
    if not inv and r.x_sale_id:
        inv = r.x_sale_id.sudo().order_line.invoice_lines.move_id.filtered(lambda m: m.state == 'posted' and m.move_type == 'out_invoice' and m.amount_residual > 0.005).sorted('id')[:1]
    if not inv:
        raise UserError('%s: choose the invoice on the entry first.' % r.x_name)
    partner = inv.commercial_partner_id
    pay = r.x_payment_id.sudo()
    if not pay:
        found = env['account.payment'].sudo().search([('partner_id.commercial_partner_id', '=', partner.id), ('company_id', '=', inv.company_id.id), ('payment_type', '=', 'inbound'), ('state', 'in', ('in_process', 'paid'))], order='date desc, id desc')
        found = found.filtered(lambda p: unapplied(p) > 0.005)
        exact = found.filtered(lambda p: abs(p.amount - amt) < 0.005)
        if len(exact) == 1:
            pay = exact
        elif not found:
            raise UserError('%s: %s has no recorded payment with money not yet applied in %s. Record the payment first, or use "Confirm and register payment".' % (r.x_name, partner.name, inv.company_id.name))
        else:
            raise UserError('%s: choose the payment in the "Payment" field of the entry, then press this button again. Payments of %s with money not yet applied: %s.' % (
                r.x_name, partner.name, ', '.join('%s (%.2f, %.2f not applied)' % (p.name, p.amount, unapplied(p)) for p in found)))
    else:
        if pay.partner_id.commercial_partner_id != partner or pay.company_id != inv.company_id:
            raise UserError('%s: payment %s is not from %s in %s.' % (r.x_name, pay.name, partner.name, inv.company_id.name))
        if pay.state not in ('in_process', 'paid'):
            raise UserError('%s: payment %s is not confirmed.' % (r.x_name, pay.name))
        if unapplied(pay) < 0.005:
            raise UserError('%s: payment %s is already fully applied to invoices. Use the plain "Confirm" for this entry.' % (r.x_name, pay.name))
    if abs(pay.amount - amt) > 0.005:
        raise UserError('%s: the driver received %.2f but payment %s is %.2f. Correct the payment in Accounting (Reset to Draft, change the amount, Confirm), then press this button again.' % (r.x_name, amt, pay.name, pay.amount))
    credit = pay.move_id.line_ids.filtered(lambda l: l.account_id.account_type == 'asset_receivable')
    ctx = dict(env.context, allowed_company_ids=[inv.company_id.id] + [c for c in env.context.get('allowed_company_ids', []) if c != inv.company_id.id])
    others = env['account.move'].sudo().search([('move_type', '=', 'out_invoice'), ('state', '=', 'posted'), ('payment_state', 'in', ('not_paid', 'partial')),
        ('commercial_partner_id', '=', partner.id), ('company_id', '=', inv.company_id.id), ('id', '!=', inv.id)], order='invoice_date, id')
    used = []
    for target in [inv.sudo()] + [o for o in others]:
        line = credit.filtered(lambda l: not l.reconciled)[:1]
        if not line:
            break
        before = target.amount_residual
        if before < 0.005:
            continue
        target.with_context(ctx).js_assign_outstanding_line(line.id)
        if before - target.amount_residual > 0.005:
            used.append('%.2f on %s' % (before - target.amount_residual, target.name))
    left = unapplied(pay)
    text = 'Payment %s (%.2f) was already recorded; applied: %s%s' % (pay.name, pay.amount, ', '.join(used) or 'nothing',
        ('; %.2f is left on the customer account.' % left) if left > 0.005 else '.')
    r.write({'x_payment_id': pay.id, 'x_invoice_id': inv.id, 'x_company_id': inv.company_id.id, 'x_note': ('%s\n' % r.x_note if r.x_note else '') + text, 'x_state': 'confirmed'})
