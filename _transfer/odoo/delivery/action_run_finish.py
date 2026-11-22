# Delivery run: finish a save made by the planner page (SMB, 22 Nov 2026). Runs on x_delivery_run.
# Fills the name and the texts used by the WhatsApp message, makes the short link for the Google Maps route,
# and keeps ONE vehicle-use entry in the staff ledger in step with the run (km x rate to the owner of the
# vehicle is worked out by automation 58 when the entry is created; the SMBF Kangoo earns nothing).
# Touches no accounting.
NAMES = {'5': 'Melissa', '7': 'Serge', 'owner': 'Mustafa'}
OWNER_OF = {'melissa': '5', 'serge': '7'}
PHONES = {'7': '+96181227233'}
if not env.user.has_group('account.group_account_manager'):
    raise UserError('Only the owner can plan delivery runs.')
for run in records:
    who = run.x_who or '7'
    day = run.x_date or datetime.date.today()
    minutes = int(run.x_minutes or 0)
    duration = ('%d h %02d min' % (minutes // 60, minutes % 60)) if minutes >= 60 else ('%d min' % minutes)
    phone = PHONES.get(who)
    # The owner also drives. He is not in the staff ledger: when he uses Melissa's or Serge's car the km entry is
    # made in the name of the car's owner (who is the one paid); with the Kangoo there is no entry.
    entry_who = who if who != 'owner' else OWNER_OF.get(run.x_vehicle)
    if not phone and who != 'owner':
        emp = env['hr.employee'].sudo().browse(int(who))
        phone = emp.mobile_phone or emp.work_phone or False
    name = 'Delivery run %s - %s' % (day.strftime('%d %b %Y'), NAMES.get(who, ''))
    vals = {
        'x_name': name,
        'x_date': day,
        'x_who': who,
        'x_date_label': day.strftime('%a %d %b'),
        'x_stops_label': str(run.x_stops or 0),
        'x_km_label': '%.1f' % (run.x_km or 0.0),
        'x_duration': duration,
        'x_driver_phone': phone,
    }
    if run.x_route_url:
        link = env['link.tracker'].sudo().search_or_create([{'url': run.x_route_url, 'title': name}])
        vals['x_route_code'] = link[0].code
    km = round(run.x_km or 0.0, 1)
    old = run.x_entry_id.sudo()
    keep = False
    if old and old.x_state != 'rejected':
        same = abs(old.x_km - km) < 0.05 and old.x_vehicle == run.x_vehicle and old.x_who == entry_who and old.x_date == day and run.x_state != 'cancel'
        if same:
            keep = True
        elif old.x_state == 'confirmed' or old.x_settled:
            keep = True
            vals['x_note'] = 'The vehicle entry "%s" was already confirmed before this run changed. Correct it by hand in Team Ledger > Entries.' % (old.x_name or '')
        else:
            old.write({'x_state': 'rejected', 'x_note': 'Replaced: the delivery run was changed.'})
    if not keep and km > 0 and run.x_vehicle and entry_who and run.x_state != 'cancel':
        entry = env['x_staff_entry'].sudo().create({
            'x_type': 'vehicle',
            'x_who': entry_who,
            'x_vehicle': run.x_vehicle,
            'x_km': km,
            'x_date': day,
            'x_desc': '%s, %s stops%s' % (name, run.x_stops or 0, ' (driven by Mustafa)' if who == 'owner' else ''),
        })
        vals['x_entry_id'] = entry.id
    run.write(vals)
