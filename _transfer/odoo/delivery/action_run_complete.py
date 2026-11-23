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
    who = run.x_who or '7'
    # The owner also drives. He is not in the staff ledger: when he uses Melissa's or Serge's car the entry is
    # made in the name of the car's owner (who is the one paid); with the Kangoo there is no entry.
    entry_who = who if who != 'owner' else OWNER_OF.get(run.x_vehicle)
    vals = {'x_state': 'done', 'x_km_final': km, 'x_done_date': datetime.date.today()}
    has_entry = run.x_entry_id and run.x_entry_id.x_state != 'rejected'
    if entry_who and run.x_vehicle and not has_entry:
        planned = round(run.x_km or 0.0, 1)
        extra = []
        if abs(planned - km) >= 0.05:
            extra.append('planned %.1f km' % planned)
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
