# Delivery run: mark completed (SMB, 23 Nov 2026). Runs on x_delivery_run, from the run form.
# Anyone at the shop may do it (the owner, Melissa or Serge, also from the tablet). Only now is the
# vehicle-use entry made in the staff ledger, with the km driven (the planned km unless corrected on the
# form). The entry is created in "review" and still waits for the owner's confirmation; km x rate to the
# owner of the vehicle is worked out by automation 58, the SMBF Kangoo earns nothing. Touches no accounting.
NAMES = {'5': 'Melissa', '7': 'Serge', 'owner': 'Mustafa'}
OWNER_OF = {'melissa': '5', 'serge': '7'}
for run in records.sudo():
    if run.x_state == 'done':
        raise UserError('This run is already marked completed.')
    if run.x_state == 'cancel':
        raise UserError('This run was cancelled.')
    if not run.x_done_by:
        raise UserError('Choose who is marking the run completed.')
    km = round(run.x_km_final or run.x_km or 0.0, 1)
    if km <= 0:
        raise UserError('Enter the km driven.')
    planned = round(run.x_km or 0.0, 1)
    corrected = abs(planned - km) >= 0.05
    reason = (run.x_km_reason or '').strip()
    if corrected and len(reason) < 5:
        raise UserError('The km driven (%.1f) differ from the planned km (%.1f). Write the reason for the change.' % (km, planned))
    # Signature: on the shared tablet the person named must enter their own clock-in PIN. The PIN typed on the
    # form is compared here and wiped at once; it is never shown or kept. The owner, signed in as himself, needs none.
    typed = (run.x_pin or '').strip()
    run.write({'x_pin': False})
    if not env.user.has_group('account.group_account_manager'):
        if run.x_done_by not in ('5', '7'):
            raise UserError('Choose your own name. Only the owner, signed in as himself, can complete a run as Mustafa.')
        pin = env['hr.employee'].sudo().browse(int(run.x_done_by)).pin
        if not pin or not typed or typed != pin:
            # No error is raised here on purpose: an error would undo the wipe above and leave what was typed on the record.
            action = {'type': 'ir.actions.client', 'tag': 'display_notification', 'params': {
                'title': 'Wrong PIN', 'type': 'danger', 'sticky': False,
                'message': 'Wrong PIN for %s. Enter the PIN you use to clock in, then press Run completed again.' % NAMES.get(run.x_done_by, ''),
                'next': {'type': 'ir.actions.client', 'tag': 'soft_reload'}}}
            continue
    who = run.x_who or '7'
    # The owner also drives. He is not in the staff ledger: when he uses Melissa's or Serge's car the entry is
    # made in the name of the car's owner (who is the one paid); with the Kangoo there is no entry.
    entry_who = who if who != 'owner' else OWNER_OF.get(run.x_vehicle)
    vals = {'x_state': 'done', 'x_km_final': km, 'x_done_date': datetime.date.today()}
    has_entry = run.x_entry_id and run.x_entry_id.x_state != 'rejected'
    if entry_who and run.x_vehicle and not has_entry:
        extra = []
        if corrected:
            extra.append('planned %.1f km, changed: %s' % (planned, reason))
        if who == 'owner':
            extra.append('driven by Mustafa')
        extra.append('completed by %s' % NAMES.get(run.x_done_by, ''))
        entry = env['x_staff_entry'].sudo().create({
            'x_type': 'vehicle',
            'x_who': entry_who,
            'x_vehicle': run.x_vehicle,
            'x_km': km,
            'x_date': run.x_date or datetime.date.today(),
            'x_desc': '%s, %s stops (%s)' % (run.x_name or 'Delivery run', run.x_stops or 0, ', '.join(extra)),
        })
        vals['x_entry_id'] = entry.id
    run.write(vals)
    run.message_post(body='Run completed by %s%s. Planned %.1f km, driven %.1f km.%s' % (
        NAMES.get(run.x_done_by, ''), '' if env.user.has_group('account.group_account_manager') else ' (PIN checked)', planned, km,
        (' Reason for the change: %s' % reason) if corrected else ''))
