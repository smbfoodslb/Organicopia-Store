# Delivery run: mark completed (SMB, 23 Nov 2026). Runs on x_delivery_run, from the run form.
# Anyone at the shop may do it (the owner, Melissa or Serge, also from the tablet). Only now is the
# vehicle-use entry made in the staff ledger, with the km driven (the planned km unless corrected on the
# form, and then a reason is required). The entry is created in "review" and still waits for the owner's
# confirmation; km x rate to the owner of the vehicle is worked out by automation 58, the SMBF Kangoo earns
# nothing. Touches no accounting.
# Signature: on the shared tablet the person named must enter their own clock-in PIN. What was typed is
# wiped from the record first thing and only compared here; it is never shown or kept. For that reason a
# refusal is shown as a notice, not raised as an error (an error would undo the wipe).
NAMES = {'5': 'Melissa', '7': 'Serge', 'owner': 'Mustafa'}
OWNER_OF = {'melissa': '5', 'serge': '7'}
is_owner = env.user.has_group('account.group_account_manager')
for run in records.sudo():
    typed = (run.x_pin or '').strip()
    if run.x_pin:
        run.write({'x_pin': False})
    km = round(run.x_km_final or run.x_km or 0.0, 1)
    planned = round(run.x_km or 0.0, 1)
    corrected = abs(planned - km) >= 0.05
    reason = (run.x_km_reason or '').strip()
    problem = False
    if run.x_state == 'done':
        problem = 'This run is already marked completed.'
    elif run.x_state == 'cancel':
        problem = 'This run was cancelled.'
    elif not run.x_done_by:
        problem = 'Choose who is marking the run completed.'
    elif km <= 0:
        problem = 'Enter the km driven.'
    elif corrected and len(reason) < 5:
        problem = 'The km driven (%.1f) differ from the planned km (%.1f). Write the reason for the change.' % (km, planned)
    elif not is_owner and run.x_done_by not in ('5', '7'):
        problem = 'Choose your own name. Only the owner, signed in as himself, can complete a run as Mustafa.'
    elif not is_owner:
        pin = env['hr.employee'].sudo().browse(int(run.x_done_by)).pin
        if not pin or not typed or typed != pin:
            problem = 'Wrong PIN for %s. Enter the PIN you use to clock in.' % NAMES.get(run.x_done_by, '')
    if problem:
        action = {'type': 'ir.actions.client', 'tag': 'display_notification', 'params': {
            'title': 'Not completed', 'type': 'danger', 'sticky': False,
            'message': problem + ' Then press Run completed again.',
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
        NAMES.get(run.x_done_by, ''), '' if is_owner else ' (PIN checked)', planned, km,
        (' Reason for the change: %s' % reason) if corrected else ''))
