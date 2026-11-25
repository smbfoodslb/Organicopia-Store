# Delivery run: confirm deliveries (SMB, 23 Nov 2026). Runs on x_delivery_run, from the run form; owner only
# (the action is limited to Accounting / Administrator and checks it again here).
# After a run is completed, the owner sees its own-driver deliveries ticked "Delivered", unticks any that
# failed, and presses the button. Each ticked delivery is validated exactly as the Validate button would,
# but only when it is clean: ready, every line at its full quantity, every tracked line with its lot.
# Anything else (short quantity, missing lot, Odoo asking a question such as a back order) is skipped and
# named, never forced. Unticked deliveries stay open and come back in the planner. FlyPost drop-offs are
# not in the list at all. Stock leaves at this moment, with this date. Touches no invoice or payment.
if not env.user.has_group('account.group_account_manager'):
    raise UserError('Only the owner confirms deliveries.')
action = False
for run in records:
    if run.x_state != 'done' and run.x_reported != 'all':
        msg, kind = 'Mark the run completed first, or wait until the driver has reported every stop.', 'warning'
    elif run.x_deliveries_done:
        msg, kind = 'The deliveries of this run were already confirmed.', 'info'
    elif not run.x_line_ids:
        env['ir.actions.server'].browse(1400).with_context(active_model='x_delivery_run', active_id=run.id, active_ids=run.ids).run()
        msg, kind = ('The list of deliveries has been filled in. Check it and press Confirm deliveries again.' if run.x_line_ids else 'This run has no own-driver deliveries to confirm.'), 'info'
    else:
        done = 0
        left = []
        for line in run.x_line_ids:
            pk = env['stock.picking'].sudo().browse(line.x_picking).exists()
            why = ''
            if not line.x_delivered:
                why = 'not delivered, left open'
            elif not pk:
                why = 'delivery no longer exists'
            elif pk.state == 'done':
                why = 'was already validated'
            elif pk.state == 'cancel':
                why = 'delivery is cancelled'
            elif pk.state != 'assigned':
                why = 'not ready in stock, left open'
            else:
                for move in pk.move_ids:
                    if move.state == 'cancel':
                        continue
                    if abs(move.quantity - move.product_uom_qty) > 0.0001:
                        why = 'quantity short on %s, left open' % (move.product_id.default_code or move.product_id.name)
                        break
                    if move.has_tracking != 'none' and (not move.move_line_ids or any(not l.lot_id for l in move.move_line_ids)):
                        why = 'lot missing on %s, left open' % (move.product_id.default_code or move.product_id.name)
                        break
                if not why:
                    res = pk.with_company(pk.company_id).with_context(skip_backorder=True, skip_sms=True, button_validate_picking_ids=pk.ids).button_validate()
                    if res is True and pk.state == 'done':
                        done += 1
                        why = 'validated'
                    else:
                        why = 'Odoo asked a question, validate it by hand'
            line.sudo().write({'x_result': why})
            if why not in ('validated', 'was already validated'):
                left.append('%s: %s' % (line.x_name, why))
        note = '%d validated on %s by %s.' % (done, datetime.date.today().strftime('%d %b %Y'), env.user.name)
        if left:
            note += ' Not validated: ' + '; '.join(left) + '.'
        run.sudo().write({'x_deliveries_done': True, 'x_deliveries_note': note, 'x_reported': 'ok'})
        msg, kind = note, ('warning' if left else 'success')
    action = {'type': 'ir.actions.client', 'tag': 'display_notification', 'params': {
        'title': 'Deliveries', 'message': msg, 'type': kind, 'sticky': kind == 'warning',
        'next': {'type': 'ir.actions.client', 'tag': 'soft_reload'}}}
