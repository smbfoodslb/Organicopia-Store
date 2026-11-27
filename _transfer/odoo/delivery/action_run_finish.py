# Delivery run: finish a save made by the planner page (SMB, 22 Nov 2026). Runs on x_delivery_run.
# Fills the name and the texts used by the WhatsApp message, makes the short link for the Google Maps route,
# The vehicle-use entry is NOT made here: it is made when the run is marked completed (action_run_complete.py).
# Also keeps the "To collect" entries of the Cash received tile in step with the run. Touches no accounting.
NAMES = {'5': 'Melissa', '7': 'Serge', 'owner': 'Mustafa'}
PHONES = {'7': '+96181227233', '5': '+96171738018', 'owner': '+96178879350'}  # Serge, Melissa, Mustafa (owner, 25 Nov 2026)
CARS = {'serge': "Serge's Car", 'melissa': "Melissa's Car", 'kangoo': 'SMBF Kangoo'}
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
    # the car is part of the name so the driver sees it in the stop list and can flag a wrong one (owner, 23 Nov 2026)
    name = 'Delivery run %s - %s' % (day.strftime('%d %b %Y'), NAMES.get(who, ''))
    if CARS.get(run.x_vehicle):
        name = '%s - %s' % (name, CARS.get(run.x_vehicle))
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
        # The WhatsApp button and the copied link open the run's stop-list page (view "SMB delivery run page",
        # /delivery-run?t=<token>), which carries the Google Maps button; before 24 Nov 2026 they opened Google Maps
        # directly. The page shows customers and amounts, so the short link is NOT one of Odoo's 3-letter codes:
        # its code is the run's own 32-character random token (owner, 24 Nov 2026).
        token = run.x_token
        if not token:
            env.cr.execute("SELECT replace(gen_random_uuid()::text, '-', '')")
            token = env.cr.fetchone()[0]
            vals['x_token'] = token
        link = env['link.tracker'].sudo().search_or_create([{'url': 'https://www.smbfoods-lb.com/delivery-run?t=%s' % token, 'title': name}])[0]
        code = link.link_code_ids[:1]
        if code and code.code != token:
            code.write({'code': token})
        vals['x_route_code'] = token
        vals['x_page_url'] = 'https://www.smbfoods-lb.com/delivery-run?t=%s' % token
    # What the driver has to collect at each stop, from the invoices as they stand now (owner, 23 Nov 2026):
    # an order on account -> "on account, do not collect"; nothing left open on its invoices -> "PAID";
    # otherwise the amount still open (the order total while nothing is invoiced). One line, because a
    # WhatsApp template variable cannot hold line breaks.
    parts = []
    page = []  # the same stops for the stop-list page: one entry per stop, with who to ask for, address and phone
    def people(items):
        out = []
        done = []
        for item in items:
            pk = env['stock.picking'].sudo().browse(int(item.get('picking') or 0)).exists()
            p = pk.partner_id
            if not p or p.id in done:
                continue
            done.append(p.id)
            out.append({'name': item.get('name') or p.display_name or '', 'phone': p.phone or p.commercial_partner_id.phone or '',
                        'addr': ', '.join(x for x in [p.street, p.street2, p.city] if x)})
        return out
    try:
        stops = json.loads(run.x_stop_order or '[]')
    except Exception:
        stops = []
    number = 0
    def pay(sale):
        # (kind, amount) for one order: account / paid / collect
        mode = sale.x_collect or ('collect' if sale.pricelist_id.id in (27,) else 'account')
        invoiced = sale.order_line.invoice_lines.move_id.filtered(lambda m: m.state == 'posted')
        due = sale.x_amount_open if invoiced else sale.amount_total
        if mode == 'account':
            return ('account', 0.0)
        if mode == 'whish':
            # the customer sends the money by Whish to the owner: nothing for the driver to collect (27 Nov 2026).
            # The amount is carried so the driver can switch the stop to cash on the page.
            if invoiced and due < 0.005:
                return ('paid', 0.0)
            return ('whish', sale.x_collect_amount if sale.x_collect_amount > 0.005 else due)
        if sale.x_collect_amount > 0.005:
            # the owner set another amount to collect on the order (more or less than the invoice)
            return ('collect', sale.x_collect_amount)
        if invoiced and due < 0.005:
            return ('paid', 0.0)
        return ('collect', due)
    WORDS = {'account': 'on account, do not collect', 'paid': 'PAID, nothing to collect', 'whish': 'pays by Whish, nothing to collect'}
    SHORT = {'account': 'on account', 'paid': 'paid', 'whish': 'Whish'}
    for stop in stops:
        number += 1
        if stop.get('orders') is not None:
            parts.append('%d) FlyPost drop-off: hand over %s' % (number, ', '.join(o.get('order', '') for o in stop.get('orders'))))
            page.append({'n': number, 'title': 'FlyPost drop-off', 'what': 'hand over %s' % ', '.join(o.get('order', '') for o in stop.get('orders')), 'collect': False,
                         'lat': stop.get('lat'), 'lng': stop.get('lng'), 'people': []})
            continue
        # one stop can hold several orders: two companies' invoices for one customer, or two names at
        # one address combined in the planner (stop['group']). Total first, then the breakdown.
        rows = []
        seen = []
        for item in [stop] + (stop.get('group') or []):
            sale = env['stock.picking'].sudo().browse(int(item.get('picking') or 0)).exists().sale_id
            # an order prepared from two warehouses has two transfers: count it once (owner, 24 Nov 2026)
            if sale and sale.id not in seen:
                seen.append(sale.id)
                rows.append((item.get('name', ''), sale.name, pay(sale), sale.id))
        if not rows:
            parts.append('%d) %s' % (number, stop.get('name', '')))
            page.append({'n': number, 'title': stop.get('name', ''), 'what': '', 'collect': False, 'lat': stop.get('lat'), 'lng': stop.get('lng'), 'people': people([stop] + (stop.get('group') or []))})
            continue
        names = []
        for r in rows:
            if r[0] and r[0] not in names:
                names.append(r[0])
        title = ' + '.join(names)
        if len(rows) == 1:
            kind, due = rows[0][2]
            what = ('collect $%.2f' % due) if kind == 'collect' else WORDS[kind]
        else:
            many = len(names) > 1
            total = sum(r[2][1] for r in rows if r[2][0] == 'collect')
            kinds = set(r[2][0] for r in rows)
            def label(r):
                return ('%s %s' % (r[0], r[1])) if many else r[1]
            if kinds == set(['collect']):
                what = 'collect $%.2f (%s)' % (total, ' + '.join('%s $%.2f' % (label(r), r[2][1]) for r in rows))
            elif 'collect' in kinds:
                what = 'collect $%.2f (%s)' % (total, '; '.join(('%s $%.2f' % (label(r), r[2][1])) if r[2][0] == 'collect' else ('%s %s' % (label(r), SHORT[r[2][0]])) for r in rows))
            elif len(kinds) == 1:
                what = '%s (%s)' % (WORDS[list(kinds)[0]], ', '.join(label(r) for r in rows))
            else:
                what = 'nothing to collect (%s)' % '; '.join('%s %s' % (label(r), SHORT[r[2][0]]) for r in rows)
        parts.append('%d) %s: %s' % (number, title, what))
        page.append({'n': number, 'title': title, 'what': what, 'collect': what.startswith('collect'), 'lat': stop.get('lat'), 'lng': stop.get('lng'), 'people': people([stop] + (stop.get('group') or [])),
                     # the orders with cash to collect at this stop: the driver enters what he received on the page (25 Nov 2026)
                     'cash': [{'sale': r[3], 'order': r[1], 'name': r[0], 'amt': round(r[2][1], 2), 'mode': r[2][0]} for r in rows if r[2][0] in ('collect', 'whish') and r[2][1] > 0.005]})
    vals['x_collect_text'] = ' | '.join(parts) or '-'
    vals['x_stops_json'] = json.dumps(page)
    # The run's own-driver deliveries, for the owner's "Confirm deliveries" list on the run form (owner, 23 Nov 2026).
    # One line per delivery of every stop (also the other orders of a combined stop); FlyPost drop-offs are left
    # out: handing a parcel to FlyPost is not delivery to the customer. Rebuilt only while nothing was confirmed.
    if not run.x_deliveries_done:
        wanted = []
        stop_no = 0
        for stop in stops:
            stop_no += 1  # same numbering as the stop list above
            if stop.get('orders') is not None:
                continue
            for item in [stop] + (stop.get('group') or []):
                pk = env['stock.picking'].sudo().browse(int(item.get('picking') or 0)).exists()
                if pk:
                    wanted.append((pk.id, '%s · %s · %s' % (item.get('name', ''), pk.sale_id.name or pk.origin or '', pk.name), stop_no))
        Line = env['x_delivery_run_line'].sudo()
        have = Line.search([('x_run_id', '=', run.id)])
        # Lines are kept when the delivery is still in the run, so what the driver already reported on the stop-list
        # page survives a re-save; only deliveries that left the run are removed and new ones added (25 Nov 2026).
        have.filtered(lambda l: l.x_picking not in [w[0] for w in wanted]).unlink()
        for w in wanted:
            line = have.exists().filtered(lambda l: l.x_picking == w[0])[:1]
            if line:
                line.write({'x_name': w[1], 'x_stop': w[2]})
            else:
                Line.create({'x_run_id': run.id, 'x_picking': w[0], 'x_name': w[1], 'x_stop': w[2], 'x_delivered': True})
        lines = Line.search([('x_run_id', '=', run.id)])
        vals['x_reported'] = ('all' if all(l.x_report for l in lines) else 'part') if any(l.x_report for l in lines) else False
    # Cash the driver should collect -> "To collect" entries in the tablet's Cash received tile (owner, 24 Nov 2026).
    # One per order to collect. For Melissa or Serge it is cash they hold; when the owner drives it has no employee and
    # is only his reminder to register the payment (25 Nov 2026). Rebuilt on every save: entries still
    # "To collect" are replaced; entries the driver already confirmed or marked not collected are left alone.
    E = env['x_staff_entry'].sudo()
    mine = E.search([('x_run_id', '=', run.id)])
    kept = mine.filtered(lambda e: e.x_state != 'expected').mapped('x_sale_id').ids
    mine.filtered(lambda e: e.x_state == 'expected').unlink()
    if who in ('5', '7', 'owner') and run.x_state != 'cancel':
        for stop in stops:
            if stop.get('orders') is not None:
                continue
            for item in [stop] + (stop.get('group') or []):
                sale = env['stock.picking'].sudo().browse(int(item.get('picking') or 0)).exists().sale_id
                if not sale or sale.id in kept:
                    continue
                kind, due = pay(sale)
                if kind != 'collect' or due < 0.005:
                    continue
                kept.append(sale.id)
                E.search([('x_sale_id', '=', sale.id), ('x_state', '=', 'expected')]).unlink()
                inv = sale.order_line.invoice_lines.move_id.filtered(lambda m: m.state == 'posted' and m.move_type == 'out_invoice' and m.amount_residual > 0.005).sorted('id')[:1]
                E.create({'x_type': 'cash', 'x_state': 'expected', 'x_who': who if who in ('5', '7') else False, 'x_run_id': run.id, 'x_sale_id': sale.id,
                          'x_partner_id': sale.partner_id.commercial_partner_id.id, 'x_invoice_id': inv.id if inv else False, 'x_input': round(due, 2)})
    if run.x_state not in ('done', 'cancel'):
        vals['x_km_final'] = round(run.x_km or 0.0, 1)
    run.write(vals)
