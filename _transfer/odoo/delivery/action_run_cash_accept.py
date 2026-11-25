# Delivery run: Melissa accepts the cash the driver handed her (SMB, 25 Nov 2026). Runs on x_delivery_run, from the
# run form, on the shop tablet or by the owner. The driver chose "Handed to Melissa" at the bottom of the stop list
# (auto_delivery_report.py); until Melissa signs here the payments stay on the driver's statement. Her signature is her
# clock-in PIN, typed on the run form: wiped from the record first thing and only compared here, never shown or kept
# (a refusal is a notice, not an error, so the wipe is not undone). On success the run's cash entries that are not
# settled move to her statement. Touches no accounting.
MELISSA = 5
for run in records.sudo():
    typed = (run.x_pin or '').strip()
    if run.x_pin:
        run.write({'x_pin': False})
    problem = False
    if run.x_handover != 'wait5':
        problem = 'No cash of this run is waiting for Melissa.'
    else:
        pin = env['hr.employee'].sudo().browse(MELISSA).pin
        if not pin or not typed or typed != pin:
            problem = 'Wrong PIN for Melissa. Enter the PIN you use to clock in, then press the button again.'
    if problem:
        action = {'type': 'ir.actions.client', 'tag': 'display_notification', 'params': {
            'title': 'Not accepted', 'type': 'danger', 'sticky': False, 'message': problem,
            'next': {'type': 'ir.actions.client', 'tag': 'soft_reload'}}}
        continue
    entries = env['x_staff_entry'].sudo().search([('x_run_id', '=', run.id), ('x_type', '=', 'cash'), ('x_state', 'in', ('review', 'confirmed')), ('x_settled', '=', False)])
    total = round(sum(entries.mapped('x_input')), 2)
    for e in entries:
        e.write({'x_who': '5', 'x_employee_id': MELISSA, 'x_note': ('%s\n' % e.x_note if e.x_note else '') + 'Melissa accepted the cash from the driver (PIN checked).'})
    run.write({'x_handover': 'ok5', 'x_handover_amount': total})
    run.message_post(body='Melissa accepted the cash of this run: $%.2f, %s payment(s) (PIN checked). They are now on her statement.' % (total, len(entries)))
    action = {'type': 'ir.actions.client', 'tag': 'display_notification', 'params': {
        'title': 'Cash accepted', 'type': 'success', 'sticky': False,
        'message': '$%.2f is now on Melissa\'s statement.' % total,
        'next': {'type': 'ir.actions.client', 'tag': 'soft_reload'}}}
