# "Apply to oldest invoices" on a payment (SMB, 27 Nov 2026). Server action on account.payment: button on the form,
# and run by the automation when the payment is validated with "Apply to oldest invoices" ticked.
# Takes what is still unallocated on the payment and reconciles it with the partner's open documents of the same
# company, oldest first (invoice date, then number), until the payment is used up. A company's branches and
# addresses count as the same partner.
#   customer payment received -> customer invoices      vendor payment sent     -> vendor bills
#   customer refund sent      -> customer credit notes   vendor refund received  -> vendor credit notes
# Only links payment and invoices (reconciliation): no new accounting entry, no number is used.
KIND = {('customer', 'inbound'): 'out_invoice', ('customer', 'outbound'): 'out_refund',
        ('supplier', 'outbound'): 'in_invoice', ('supplier', 'inbound'): 'in_refund'}
notes = []
for pay in records:
    if pay.state not in ('in_process', 'paid') or not pay.move_id or not pay.partner_id:
        if env.context.get('smb_quiet'):
            continue
        raise UserError("Validate the payment first, and make sure it has a customer or vendor.")
    kind = KIND.get((pay.partner_type, pay.payment_type))
    line = pay.move_id.line_ids.filtered(lambda l: l.account_id.account_type in ('asset_receivable', 'liability_payable') and not l.reconciled)[:1]
    done = []
    if kind and line:
        invoices = env['account.move'].search([('company_id', '=', pay.company_id.id), ('commercial_partner_id', '=', pay.partner_id.commercial_partner_id.id),
                                               ('move_type', '=', kind), ('state', '=', 'posted'), ('payment_state', 'in', ('not_paid', 'partial'))], order='invoice_date, id')
        for inv in invoices:
            if line.reconciled or abs(line.amount_residual) < 0.005:
                break
            target = inv.line_ids.filtered(lambda l: l.account_id.id == line.account_id.id and not l.reconciled)
            if not target:
                continue
            before = inv.amount_residual
            (line + target).reconcile()
            used = before - inv.amount_residual
            if abs(used) > 0.004:
                done.append('%s %.2f%s' % (inv.name, used, '' if inv.amount_residual > 0.005 else ' (paid)'))
    left = abs(line.amount_residual) if line else 0.0
    if done:
        pay.message_post(body='Applied to the oldest invoices: %s.%s' % (', '.join(done), (' Not applied: %.2f.' % left) if left > 0.005 else ''))
        notes.append('%s: %s%s' % (pay.name, ', '.join(done), (' - %.2f left on the payment' % left) if left > 0.005 else ''))
    else:
        notes.append('%s: nothing to apply (no open invoice, or the payment is already fully applied)' % pay.name)
if notes and not env.context.get('smb_quiet'):
    action = {'type': 'ir.actions.client', 'tag': 'display_notification', 'params': {'title': 'Apply to oldest invoices', 'type': 'success', 'sticky': False,
              'message': ' | '.join(notes), 'next': {'type': 'ir.actions.client', 'tag': 'soft_reload'}}}
