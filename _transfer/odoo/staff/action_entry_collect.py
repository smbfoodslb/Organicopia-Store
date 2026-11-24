# Staff ledger: the driver confirms a "To collect" entry on the tablet (SMB, 24 Nov 2026). Runs on x_staff_entry.
# The entry was made by the delivery run with the amount to collect; the driver may have changed the amount to what
# the customer really paid. It becomes an ordinary "Cash received" entry waiting for the owner. Touches no accounting.
if not (env.user.has_group('account.group_account_manager') or 111 in env.user.all_group_ids.ids):
    raise UserError('This is for the shop team.')
for r in records.sudo():
    if r.x_state != 'expected':
        continue
    if r.x_input <= 0:
        raise UserError('Enter the amount you received. If the customer did not pay, press "Not collected".')
    if not r.x_who:
        raise UserError('Choose who received the money.')
    inv = r.x_invoice_id
    sale = r.x_sale_id
    if not inv and sale:
        inv = sale.order_line.invoice_lines.move_id.filtered(lambda m: m.state == 'posted' and m.move_type == 'out_invoice' and m.amount_residual > 0.005).sorted('id')[:1]
    partner = inv.commercial_partner_id if inv else (r.x_partner_id or sale.partner_id.commercial_partner_id)
    ref = inv.name if inv else (sale.name if sale else '')
    r.write({
        'x_employee_id': int(r.x_who),
        'x_invoice_id': inv.id if inv else False,
        'x_company_id': inv.company_id.id if inv else (sale.company_id.id if sale else False),
        'x_partner_id': partner.id,
        'x_amount': -round(r.x_input, 2),
        'x_date': r.x_date or datetime.date.today(),  # the date the driver gave; today when left empty (owner, 24 Nov 2026)
        'x_state': 'review',
        'x_name': 'Cash received: %s%s' % (partner.name or '', ' - %s' % ref if ref else ''),
    })
