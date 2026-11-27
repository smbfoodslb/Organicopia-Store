# "Apply to oldest invoices" on a credit note (SMB, 27 Nov 2026). Server action on account.move: button on a posted
# credit note with something still open, and run by the automation when a credit note that was not made from an
# invoice is validated with "Apply to oldest invoices" ticked (owner: a credit note without a link is applied to the
# oldest invoices, like a payment without a link).
# Customer credit note -> the customer's open invoices; vendor credit note -> the vendor's open bills; same company,
# oldest first (invoice date, then number), branches and addresses included, until the credit note is used up.
# Only links the documents (reconciliation): no new accounting entry, no number is used.
KIND = {'out_refund': 'out_invoice', 'in_refund': 'in_invoice'}
notes = []
for note in records:
    kind = KIND.get(note.move_type)
    if not kind or note.state != 'posted':
        if env.context.get('smb_quiet'):
            continue
        raise UserError("This works on a confirmed credit note only.")
    done = []
    lines = note.line_ids.filtered(lambda l: l.account_id.account_type in ('asset_receivable', 'liability_payable') and not l.reconciled)
    if lines:
        invoices = env['account.move'].search([('company_id', '=', note.company_id.id), ('commercial_partner_id', '=', note.commercial_partner_id.id),
                                               ('move_type', '=', kind), ('state', '=', 'posted'), ('payment_state', 'in', ('not_paid', 'partial'))], order='invoice_date, id')
        for inv in invoices:
            lines = lines.filtered(lambda l: not l.reconciled)
            if not lines:
                break
            target = inv.line_ids.filtered(lambda l: l.account_id.id in lines.mapped('account_id').ids and not l.reconciled)
            if not target:
                continue
            before = inv.amount_residual
            (lines.filtered(lambda l: l.account_id.id in target.mapped('account_id').ids) + target).reconcile()
            used = before - inv.amount_residual
            if abs(used) > 0.004:
                done.append('%s %.2f%s' % (inv.name, used, '' if inv.amount_residual > 0.005 else ' (paid)'))
    left = note.amount_residual
    if done:
        note.message_post(body='Applied to the oldest invoices: %s.%s' % (', '.join(done), (' Not applied: %.2f.' % left) if left > 0.005 else ''))
        notes.append('%s: %s%s' % (note.name, ', '.join(done), (' - %.2f left on the credit note' % left) if left > 0.005 else ''))
    else:
        notes.append('%s: nothing to apply (no open invoice, or the credit note is already fully applied)' % note.name)
if notes and not env.context.get('smb_quiet'):
    action = {'type': 'ir.actions.client', 'tag': 'display_notification', 'params': {'title': 'Apply to oldest invoices', 'type': 'success', 'sticky': False,
              'message': ' | '.join(notes), 'next': {'type': 'ir.actions.client', 'tag': 'soft_reload'}}}
