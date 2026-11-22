# Staff ledger: confirm the selected entries (owner) - SMB, 22 Nov 2026.
# A "cash received" entry with an invoice registers the customer payment through Odoo's own Register Payment wizard,
# in the invoice's company and its Cash or Whish journal, dated like the entry - so the invoice is paid (fully or
# partly) and the commission line follows. Without an invoice the entry is only confirmed.
JOURNALS = {(3, 'cash'): 36, (3, 'whish'): 49, (1, 'cash'): 35, (1, 'whish'): 51}
for r in records:
    if r.x_state != 'review':
        continue
    if r.x_type == 'cash' and r.x_invoice_id and not r.x_payment_id:
        inv = r.x_invoice_id
        amt = round(-r.x_amount, 2)
        if amt <= 0:
            raise UserError('%s: the amount must be positive.' % r.x_name)
        if amt > inv.amount_residual + 0.005:
            raise UserError('%s: %.2f is more than what is still open on %s (%.2f).' % (r.x_name, amt, inv.name, inv.amount_residual))
        journal = JOURNALS.get((inv.company_id.id, r.x_method or 'cash'))
        if not journal:
            raise UserError('No cash journal is set for %s.' % inv.company_id.name)
        ctx = dict(env.context, active_model='account.move', active_ids=inv.ids, active_id=inv.id, allowed_company_ids=[inv.company_id.id] + [c for c in env.context.get('allowed_company_ids', []) if c != inv.company_id.id])
        wiz = env['account.payment.register'].with_context(ctx).create({'amount': amt, 'journal_id': journal, 'payment_date': r.x_date})
        pay = wiz._create_payments()
        r.write({'x_payment_id': pay[:1].id})
    r.write({'x_state': 'confirmed'})