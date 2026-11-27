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
    # "Return?" on a stop (27 Nov 2026): the driver sent one to three photos of the customer's return invoice, or of the
    # returned goods, with an optional note. One x_delivery_return is created for the customer of that stop, the owner
    # gets a to-do on the customer and an email with the photos, and the photos are removed from this report. Accepted
    # for 7 days after the run's date, also after the deliveries were confirmed. No stock or accounting here.
    if (rep.x_name or '') == 'return':
        photos = [ph for ph in (rep.x_photo1, rep.x_photo2, rep.x_photo3) if ph]
        lines = run.x_line_ids.filtered(lambda l: l.x_stop == rep.x_stop) if run else run
        if run and run.x_date and (today - run.x_date).days <= 7 and lines and photos:
            partners = env['stock.picking'].sudo().browse(lines.mapped('x_picking')).exists().mapped('partner_id')
            partner = partners.filtered(lambda q: q.id == rep.x_partner)[:1] or partners[:1]
            who = dict(run._fields['x_who'].selection).get(run.x_who, '') if run.x_who else ''
            ret = env['x_delivery_return'].sudo().create({
                'x_name': 'Return - %s' % (partner.display_name or 'stop %s' % rep.x_stop),
                'x_run_id': run.id, 'x_stop': rep.x_stop, 'x_partner_id': partner.id, 'x_customer_id': partner.commercial_partner_id.id,
                'x_date': datetime.datetime.now(), 'x_driver': who, 'x_note': (rep.x_note or '').strip()[:200] or False,
                'x_photo1': photos[0], 'x_photo2': photos[1] if len(photos) > 1 else False, 'x_photo3': photos[2] if len(photos) > 2 else False,
                'x_state': 'new',
            })
            owner = env['res.users'].sudo().browse(6)
            text = 'Return reported by %s at %s (%s, stop %s)%s. Open "Driver returns" to see the photo%s and enter the return invoice.' % (who or 'the driver', partner.display_name or '?', run.x_name, rep.x_stop, (': ' + ret.x_note) if ret.x_note else '', 's' if len(photos) > 1 else '')
            if partner:
                partner.commercial_partner_id.with_context(mail_activity_quick_update=True).activity_schedule('mail.mail_activity_data_todo', user_id=6, summary='Return to enter: %s' % partner.display_name, note=text)
            atts = env['ir.attachment'].sudo().create([{'name': 'return-%s-%s.jpg' % (ret.id, n + 1), 'datas': ph, 'res_model': 'x_delivery_return', 'res_id': ret.id, 'mimetype': 'image/jpeg'} for n, ph in enumerate(photos)])
            if owner.email:
                env['mail.mail'].sudo().create({'subject': 'Return to enter: %s' % (partner.display_name or run.x_name), 'email_to': owner.email, 'body_html': '<p>%s</p>' % text, 'attachment_ids': [(6, 0, atts.ids)], 'auto_delete': True})
            rep.write({'x_name': 'applied: return %s' % ret.id, 'x_photo1': False, 'x_photo2': False, 'x_photo3': False, 'x_token': False})
        else:
            rep.write({'x_name': 'refused return', 'x_photo1': False, 'x_photo2': False, 'x_photo3': False})
        continue
    # Where the collected cash is now (driver, bottom of the stop list): "keep" = he kept it, "5" = handed to Melissa,
    # "owner" = handed to Mustafa. Only recorded here: the payments stay on the driver's statement until Melissa accepts
    # with her PIN on the run form (action_run_cash_accept.py) or the owner confirms the entries. Can be changed until
    # Melissa has accepted (owner, 25 Nov 2026).
    ho = (rep.x_handover or '').strip()
    if ho:
        if run and run.x_date and (today - run.x_date).days <= 7 and run.x_who in ('5', '7') and ho in ('keep', '5', 'owner') and not (ho == '5' and run.x_who == '5') and run.x_handover != 'ok5':
            entries = env['x_staff_entry'].sudo().search([('x_run_id', '=', run.id), ('x_type', '=', 'cash'), ('x_state', '=', 'review')])
            if entries:
                total = round(sum(entries.mapped('x_input')), 2)
                text = {'keep': 'kept by the driver', '5': 'handed to Melissa, waiting for her to accept', 'owner': 'handed to Mustafa'}[ho]
                run.write({'x_handover': {'keep': 'keep', '5': 'wait5', 'owner': 'owner'}[ho], 'x_handover_amount': total, 'x_handover_at': datetime.datetime.now()})
                for e in entries:
                    e.write({'x_note': ('%s\n' % e.x_note if e.x_note else '') + 'Driver on the stop list: cash %s.' % text})
                run.message_post(body='Driver reported on the stop list: cash %s ($%.2f, %s payment(s)).' % (text, total, len(entries)))
                rep.write({'x_name': 'applied: %s cash %s' % (run.x_name, ho)})
        continue
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
                    if sid not in allowed:
                        continue
                    # Cash <-> Whish, switched by the driver at the door (27 Nov 2026). "saleId=whish": the customer will
                    # send the money by Whish instead of paying cash - the "To collect" entry is closed and the order
                    # is marked Whish. An amount for an order marked Whish: the customer paid cash after all - the order
                    # goes back to collect and the cash is entered like any other.
                    if bits[1].strip() == 'whish':
                        entry = env['x_staff_entry'].sudo().search([('x_run_id', '=', run.id), ('x_sale_id', '=', sid), ('x_type', '=', 'cash'), ('x_state', '=', 'expected')], limit=1)
                        if entry:
                            entry.write({'x_state': 'rejected', 'x_amount': 0.0, 'x_name': (entry.x_name or '').replace('To collect:', 'By Whish, not collected:', 1)})
                        wsale = env['sale.order'].sudo().browse(sid)
                        if wsale.x_collect != 'whish':
                            wsale.write({'x_collect': 'whish'})
                        continue
                    try:
                        amount = round(float(bits[1]), 2)
                    except Exception:
                        continue
                    if amount < 0 or amount > 1000000:
                        continue
                    entry = env['x_staff_entry'].sudo().search([('x_run_id', '=', run.id), ('x_sale_id', '=', sid), ('x_type', '=', 'cash'), ('x_state', '=', 'expected')], limit=1)
                    if not entry:
                        wsale = env['sale.order'].sudo().browse(sid)
                        other = env['x_staff_entry'].sudo().search([('x_run_id', '=', run.id), ('x_sale_id', '=', sid), ('x_type', '=', 'cash')], limit=1)
                        if wsale.x_collect != 'whish' or amount < 0.005 or other:
                            continue
                        wsale.write({'x_collect': 'collect'})
                        entry = env['x_staff_entry'].sudo().create({'x_type': 'cash', 'x_state': 'expected', 'x_who': run.x_who if run.x_who in ('5', '7') else False, 'x_run_id': run.id, 'x_sale_id': sid,
                                                                  'x_partner_id': wsale.partner_id.commercial_partner_id.id, 'x_input': amount})
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
