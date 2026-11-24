# Staff ledger: confirm the selected entries (owner) - SMB, 22 Nov 2026.
# A "cash received" entry with an invoice registers the customer payment through Odoo's own Register Payment wizard,
# in the invoice's company and its Cash or Whish journal, dated like the entry - so the invoice is paid (fully or
# partly) and the commission line follows. Without an invoice the entry is only confirmed.
# An amount above the invoice is allowed: see below.
JOURNALS = {(3, 'cash'): 36, (3, 'whish'): 49, (1, 'cash'): 35, (1, 'whish'): 51}
for r in records:
    if r.x_state != 'review':
        continue
    if r.x_type == 'cash' and not r.x_invoice_id and r.x_sale_id:
        # collected at delivery before the order was invoiced: take the order's open invoice now (owner, 24 Nov 2026)
        found = r.x_sale_id.sudo().order_line.invoice_lines.move_id.filtered(lambda m: m.state == 'posted' and m.move_type == 'out_invoice' and m.amount_residual > 0.005).sorted('id')[:1]
        if not found:
            raise UserError('%s: order %s has no open invoice. Invoice the order first, or choose the invoice on the entry (or empty "Order" to confirm it without a payment).' % (r.x_name, r.x_sale_id.name))
        r.write({'x_invoice_id': found.id, 'x_company_id': found.company_id.id})
    if r.x_type == 'cash' and r.x_invoice_id and not r.x_payment_id:
        inv = r.x_invoice_id
        amt = round(-r.x_amount, 2)
        if amt <= 0:
            raise UserError('%s: the amount must be positive.' % r.x_name)
        if inv.amount_residual < 0.005:
            raise UserError('%s: %s has nothing open any more. Choose another invoice on the entry.' % (r.x_name, inv.name))
        # More than the invoice: the customer is paying off a balance. One payment for the whole amount; the invoice
        # is paid and the rest is applied below (owner, 24 Nov 2026).
        extra = round(amt - inv.amount_residual, 2)
        was_open = inv.amount_residual
        journal = JOURNALS.get((inv.company_id.id, r.x_method or 'cash'))
        if not journal:
            raise UserError('No cash journal is set for %s.' % inv.company_id.name)
        ctx = dict(env.context, active_model='account.move', active_ids=inv.ids, active_id=inv.id, allowed_company_ids=[inv.company_id.id] + [c for c in env.context.get('allowed_company_ids', []) if c != inv.company_id.id])
        wiz = env['account.payment.register'].with_context(ctx).create({'amount': amt, 'journal_id': journal, 'payment_date': r.x_date})
        pay = wiz._create_payments()
        r.write({'x_payment_id': pay[:1].id})
        if extra > 0.005:
            # the rest goes to the customer's oldest unpaid invoices in the same company, oldest first (owner, 24 Nov 2026);
            # anything still left stays on the customer account
            credit = pay.sudo().move_id.line_ids.filtered(lambda l: l.account_id.account_type == 'asset_receivable')
            others = env['account.move'].sudo().search([('move_type', '=', 'out_invoice'), ('state', '=', 'posted'), ('payment_state', 'in', ('not_paid', 'partial')),
                ('commercial_partner_id', '=', inv.commercial_partner_id.id), ('company_id', '=', inv.company_id.id), ('id', '!=', inv.id)], order='invoice_date, id')
            used = []
            for other in others:
                line = credit.filtered(lambda l: not l.reconciled)[:1]
                if not line:
                    break
                before = other.amount_residual
                other.with_context(ctx).js_assign_outstanding_line(line.id)
                if before - other.amount_residual > 0.005:
                    used.append('%.2f on %s' % (before - other.amount_residual, other.name))
            left = round(-sum(credit.mapped('amount_residual')), 2)
            text = 'Paid %.2f, %s had %.2f open. The extra %.2f: %s%s' % (amt, inv.name, was_open, extra, ', '.join(used) or 'no other unpaid invoice',
                ('; %.2f is left on the customer account.' % left) if left > 0.005 else '.')
            r.write({'x_note': ('%s\n' % r.x_note if r.x_note else '') + text})
    r.write({'x_state': 'confirmed'})