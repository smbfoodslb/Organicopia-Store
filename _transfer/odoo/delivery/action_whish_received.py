# "Whish received" on a sales order (owner only, SMB 27 Nov 2026). The customer sent the money by Whish to the owner.
# Registers one payment per open posted customer invoice of the order, for what is still open, in the Whish journal
# of the invoice's company, dated today - the same payment the owner would register by hand.
JOURNALS = {3: 49, 1: 51}
done = []
for order in records:
    invoices = order.order_line.invoice_lines.move_id.filtered(lambda m: m.state == 'posted' and m.move_type == 'out_invoice' and m.amount_residual > 0.005)
    if not invoices:
        raise UserError("%s has no confirmed invoice with an amount still open." % order.name)
    for inv in invoices:
        journal = JOURNALS.get(inv.company_id.id)
        if not journal:
            raise UserError("No Whish journal is set for %s." % inv.company_id.name)
        amount = inv.amount_residual
        wizard = env['account.payment.register'].with_company(inv.company_id).with_context(active_model='account.move', active_ids=inv.ids).create({'journal_id': journal, 'payment_date': datetime.date.today(), 'amount': amount})
        wizard.action_create_payments()
        done.append('%s $%.2f' % (inv.name, amount))
    order.message_post(body='Whish received: %s' % ', '.join(done))
action = {'type': 'ir.actions.client', 'tag': 'display_notification', 'params': {'title': 'Whish received', 'type': 'success', 'sticky': False,
          'message': 'Payment registered: %s' % ', '.join(done), 'next': {'type': 'ir.actions.client', 'tag': 'soft_reload'}}}
