# base.automation on x_delivery_report (on create) - SMB, 25 Nov 2026.
# The driver taps "Delivered" or "Not delivered" on a stop of the run's stop-list page (his phone, or the shop tablet).
# The page posts one x_delivery_report through Odoo's public website form: token of the run, stop number, status,
# reason. This action checks it and writes the report on the run's delivery lines of that stop. Nothing is validated
# in stock here: the owner approves with "Confirm deliveries" on the run. A report is refused silently when the token
# is not a run's, the run is cancelled, older than 7 days, or its deliveries were already confirmed by the owner.
today = datetime.date.today()
for rep in records.sudo():
    tok = (rep.x_token or '').strip()
    run = env['x_delivery_run'].sudo().search([('x_token', '=', tok), ('x_state', '!=', 'cancel')], limit=1) if len(tok) == 32 else env['x_delivery_run']
    if run and not run.x_deliveries_done and run.x_date and (today - run.x_date).days <= 7 and rep.x_status in ('delivered', 'failed'):
        lines = run.x_line_ids.filtered(lambda l: l.x_stop == rep.x_stop)
        if lines:
            lines.write({
                'x_report': rep.x_status,
                'x_report_note': ((rep.x_note or '').strip()[:200] or False) if rep.x_status == 'failed' else False,
                'x_report_at': datetime.datetime.now(),
                'x_delivered': rep.x_status == 'delivered',
            })
            run.write({'x_reported': 'all' if all(l.x_report for l in run.x_line_ids) else 'part'})
            # Cash collected at this stop (only with "Delivered"): x_cash is "saleId=amount,saleId=amount". Each amount goes
            # on the run's "To collect" entry of that order, which then becomes an ordinary "Cash received" entry waiting
            # for the owner, exactly as the tablet's Confirm received does; 0 marks it not collected. An entry the
            # driver or the owner already handled is left alone. No accounting here.
            if rep.x_status == 'delivered' and rep.x_cash:
                sales = lines.mapped('x_picking')
                allowed = env['stock.picking'].sudo().browse(sales).exists().mapped('sale_id').ids
                for part in rep.x_cash.split(','):
                    bits = part.split('=')
                    if len(bits) != 2 or not bits[0].strip().isdigit():
                        continue
                    sid = int(bits[0])
                    try:
                        amount = round(float(bits[1]), 2)
                    except Exception:
                        continue
                    if sid not in allowed or amount < 0 or amount > 1000000:
                        continue
                    entry = env['x_staff_entry'].sudo().search([('x_run_id', '=', run.id), ('x_sale_id', '=', sid), ('x_type', '=', 'cash'), ('x_state', '=', 'expected')], limit=1)
                    if not entry:
                        continue
                    if amount < 0.005:
                        entry.write({'x_state': 'rejected', 'x_amount': 0.0, 'x_name': (entry.x_name or '').replace('To collect:', 'Not collected:', 1)})
                        continue
                    inv = entry.x_invoice_id
                    sale = entry.x_sale_id
                    if not inv and sale:
                        inv = sale.order_line.invoice_lines.move_id.filtered(lambda m: m.state == 'posted' and m.move_type == 'out_invoice' and m.amount_residual > 0.005).sorted('id')[:1]
                    partner = inv.commercial_partner_id if inv else (entry.x_partner_id or sale.partner_id.commercial_partner_id)
                    ref = inv.name if inv else (sale.name if sale else '')
                    entry.write({
                        'x_input': amount,
                        'x_employee_id': int(entry.x_who) if entry.x_who else False,
                        'x_invoice_id': inv.id if inv else False,
                        'x_company_id': inv.company_id.id if inv else (sale.company_id.id if sale else False),
                        'x_partner_id': partner.id,
                        'x_amount': -amount,
                        'x_date': entry.x_date or today,
                        'x_state': 'review',
                        'x_name': 'Cash received: %s%s' % (partner.name or '', ' - %s' % ref if ref else ''),
                        'x_note': ('%s\n' % entry.x_note if entry.x_note else '') + 'Reported by the driver on the stop-list page.',
                    })
            rep.write({'x_name': 'applied: %s stop %s %s' % (run.x_name, rep.x_stop, rep.x_status)})
# housekeeping: reports are only a mailbox; drop those older than a day
env['x_delivery_report'].sudo().search([('create_date', '<', datetime.datetime.now() - datetime.timedelta(days=1))]).unlink()
