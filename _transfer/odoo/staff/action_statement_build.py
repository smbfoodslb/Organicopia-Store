# Staff statement: build the HTML statement of one employee and write it on a record (SMB, 22 Nov 2026).
# Called by other actions with context: statement_employee (hr.employee id), statement_model, statement_res_id.
# Shows what is not settled yet: open commission lines, confirmed ledger entries by type, and the net; entries still
# waiting for the owner's review are listed apart and are NOT in the net.
emp_id = env.context.get('statement_employee')
model = env.context.get('statement_model')
res_id = env.context.get('statement_res_id')
if emp_id and model in ('x_staff_statement', 'x_staff_pin') and res_id:
    emp = env['hr.employee'].sudo().browse(emp_id)
    E = env['x_staff_entry'].sudo()
    L = env['x_commission_line'].sudo()
    money = lambda v: ('-$%.2f' if v < -0.004 else '$%.2f') % abs(v)
    esc = lambda s: (s or '').replace('&', '&amp;').replace('<', '&lt;')
    td = 'style="padding:5px 10px;border-bottom:1px solid #e3e3e3;"'
    tdr = 'style="padding:5px 10px;border-bottom:1px solid #e3e3e3;text-align:right;white-space:nowrap;"'
    com = L.search([('x_employee_id', '=', emp_id), ('x_settled', '=', False)], order='x_date, id')
    ent = E.search([('x_employee_id', '=', emp_id), ('x_state', '=', 'confirmed'), ('x_settled', '=', False)], order='x_date, id')
    rev = E.search([('x_employee_id', '=', emp_id), ('x_state', '=', 'review')], order='x_date, id')
    c_total = sum(com.mapped('x_commission'))
    def section(title, rows, total):
        if not rows:
            return ''
        h = '<tr><td colspan="3" style="padding:14px 10px 4px 10px;font-weight:bold;font-size:15px;">%s</td></tr>' % title
        h += ''.join('<tr><td %s>%s</td><td %s>%s</td><td %s>%s</td></tr>' % (td, d, td, esc(n), tdr, money(a)) for d, n, a in rows)
        h += '<tr><td %s></td><td %s><b>Subtotal</b></td><td %s><b>%s</b></td></tr>' % (td, td, tdr, money(total))
        return h
    body = ''
    body += section('Commission not yet paid out (18% on Organicopia sales)', [(l.x_date.strftime('%d %b'), l.x_name, l.x_commission) for l in com], c_total)
    e_total = 0.0
    for key, title in [('expense', 'Expenses paid for the shop'), ('vehicle', 'Vehicle use ($0.20 per km)'), ('cash', 'Customer money received and still held'), ('advance', 'Advances received'), ('other', 'Other')]:
        rows = ent.filtered(lambda r: r.x_type == key)
        t = sum(rows.mapped('x_amount'))
        e_total += t
        body += section(title, [(r.x_date.strftime('%d %b'), r.x_name, r.x_amount) for r in rows], t)
    net = round(c_total + e_total, 2)
    if net > 0.004:
        head = 'The company owes %s: <b>%s</b>' % (esc(emp.name), money(net))
    elif net < -0.004:
        head = '%s owes the company: <b>%s</b>' % (esc(emp.name), money(-net))
    else:
        head = 'Nothing to settle: <b>$0.00</b>'
    html = '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222;max-width:760px;">'
    html += '<p style="font-size:20px;margin:6px 0 2px 0;">%s</p><p style="color:#666;margin:0 0 8px 0;">Everything not settled yet, as of %s.</p>' % (head, datetime.date.today().strftime('%d %b %Y'))
    if rev:
        html += '<p style="background:#fff3cd;border:1px solid #e6c36a;padding:8px 10px;border-radius:6px;"><b>%d entr%s waiting for review</b> - not counted above yet: %s</p>' % (len(rev), 'y is' if len(rev) == 1 else 'ies are', '; '.join('%s (%s)' % (esc(r.x_name), money(r.x_amount)) for r in rev))
    if body:
        html += '<table cellspacing="0" style="border-collapse:collapse;width:100%%;">%s<tr><td %s></td><td style="padding:12px 10px;font-size:16px;"><b>Net</b></td><td style="padding:12px 10px;text-align:right;font-size:16px;"><b>%s</b></td></tr></table>' % (body, td, money(net))
    last = env['x_staff_settlement'].sudo().search([('x_employee_id', '=', emp_id)], order='x_date desc, id desc', limit=1)
    if last:
        html += '<p style="color:#666;">Last settlement: %s, net %s.</p>' % (last.x_date.strftime('%d %b %Y'), money(last.x_net))
    html += '</div>'
    vals = {'x_html': html}
    if model == 'x_staff_statement':
        vals.update({'x_net': net, 'x_review': len(rev), 'x_commission': round(c_total, 2), 'x_entries': round(e_total, 2)})
    env[model].sudo().browse(res_id).write(vals)