# Delivery run: finish a save made by the planner page (SMB, 22 Nov 2026). Runs on x_delivery_run.
# Fills the name and the texts used by the WhatsApp message, makes the short link for the Google Maps route,
# The vehicle-use entry is NOT made here: it is made when the run is marked completed (action_run_complete.py).
# Touches no accounting.
NAMES = {'5': 'Melissa', '7': 'Serge', 'owner': 'Mustafa'}
PHONES = {'7': '+96181227233'}
# The owner, and the Shop tablet (group 111) when he is away.
if not (env.user.has_group('account.group_account_manager') or 111 in env.user.all_group_ids.ids):
    raise UserError('The delivery planner is for the shop team.')
for run in records.sudo():
    who = run.x_who or '7'
    day = run.x_date or datetime.date.today()
    minutes = int(run.x_minutes or 0)
    duration = ('%d h %02d min' % (minutes // 60, minutes % 60)) if minutes >= 60 else ('%d min' % minutes)
    phone = PHONES.get(who)
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
    # What the driver has to collect at each stop, from the invoices as they stand now (owner, 23 Nov 2026):
    # an order on account -> "on account, do not collect"; nothing left open on its invoices -> "PAID";
    # otherwise the amount still open (the order total while nothing is invoiced). One line, because a
    # WhatsApp template variable cannot hold line breaks.
    parts = []
    try:
        stops = json.loads(run.x_stop_order or '[]')
    except Exception:
        stops = []
    number = 0
    for stop in stops:
        number += 1
        if stop.get('orders') is not None:
            parts.append('%d) FlyPost drop-off: hand over %s' % (number, ', '.join(o.get('order', '') for o in stop.get('orders'))))
            continue
        sale = env['stock.picking'].sudo().browse(int(stop.get('picking') or 0)).exists().sale_id
        if not sale:
            parts.append('%d) %s' % (number, stop.get('name', '')))
            continue
        mode = sale.x_collect or ('collect' if sale.pricelist_id.id in (27,) else 'account')
        invoiced = sale.order_line.invoice_lines.move_id.filtered(lambda m: m.state == 'posted')
        due = sale.x_amount_open if invoiced else sale.amount_total
        if mode == 'account':
            what = 'on account, do not collect'
        elif invoiced and due < 0.005:
            what = 'PAID, nothing to collect'
        else:
            what = 'collect $%.2f' % due
        parts.append('%d) %s: %s' % (number, stop.get('name', ''), what))
    vals['x_collect_text'] = ' | '.join(parts) or '-'
    if run.x_state not in ('done', 'cancel'):
        vals['x_km_final'] = round(run.x_km or 0.0, 1)
    run.write(vals)
