# Commission: monthly summary by email to the owner (SMB, 22 Nov 2026). Run by the scheduled action on the 1st of each
# month for the month before; with context commission_month='YYYY-MM-01' it reports that month instead (used for samples).
# The figures are the commission lines dated in the month (x_date = the day money was applied / the credit note was issued).
TO = 'sales@smbfoods-lb.com'
env['ir.actions.server'].sudo().browse(1352).run()
forced = env.context.get('commission_month')
if forced:
    start = datetime.datetime.strptime(forced, '%Y-%m-%d').date()
else:
    start = datetime.date.today().replace(day=1) - dateutil.relativedelta.relativedelta(months=1)
end = start + dateutil.relativedelta.relativedelta(months=1) - datetime.timedelta(days=1)
Line = env['x_commission_line'].sudo()
ls = Line.search([('x_date', '>=', start), ('x_date', '<=', end)])
money = lambda v: ('-$%.2f' if v < 0 else '$%.2f') % abs(v)
esc = lambda s: (s or '').replace('&', '&amp;').replace('<', '&lt;')
td = 'style="padding:4px 10px;border-bottom:1px solid #ddd;"'
tdr = 'style="padding:4px 10px;border-bottom:1px solid #ddd;text-align:right;"'
by_co = {}
by_cust = {}
for l in ls:
    co = l.x_company_id.name or 'Adjustments (no company)'
    by_co.setdefault(co, [0.0, 0.0])
    by_co[co][0] += l.x_base
    by_co[co][1] += l.x_commission
    cu = l.x_partner_id.name or l.x_name
    by_cust.setdefault(cu, [0.0, 0.0])
    by_cust[cu][0] += l.x_base
    by_cust[cu][1] += l.x_commission
tot_base = sum(ls.mapped('x_base'))
tot_comm = sum(ls.mapped('x_commission'))
paid = sum(ls.filtered(lambda l: l.x_settled).mapped('x_commission'))
open_all = sum(Line.search([('x_settled', '=', False)]).mapped('x_commission'))
employee = ls[:1].x_employee_id.name or env['hr.employee'].sudo().browse(5).name
label = start.strftime('%B %Y')
rows_co = ''.join('<tr><td %s>%s</td><td %s>%s</td><td %s>%s</td></tr>' % (td, esc(k), tdr, money(v[0]), tdr, money(v[1])) for k, v in sorted(by_co.items()))
rows_cu = ''.join('<tr><td %s>%s</td><td %s>%s</td><td %s>%s</td></tr>' % (td, esc(k), tdr, money(v[0]), tdr, money(v[1])) for k, v in sorted(by_cust.items()))
head = '<tr><th %s align="left">%s</th><th %s>Organicopia net</th><th %s>Commission 18%%</th></tr>'
body = '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222;">'
body += '<p><b>Commission for %s - %s</b><br/>Period %s to %s. Earned when payments are applied to invoices; before VAT, after discounts, delivery excluded.</p>' % (label, esc(employee), start.strftime('%d %b %Y'), end.strftime('%d %b %Y'))
body += '<p style="font-size:18px;">Commission earned in the month: <b>%s</b> on %s of Organicopia sales (%d lines).</p>' % (money(tot_comm), money(tot_base), len(ls))
body += '<p>Already paid out: %s &#160;|&#160; Not yet paid out from this month: %s<br/>Total open balance today, all months: <b>%s</b></p>' % (money(paid), money(tot_comm - paid), money(open_all))
body += '<table cellspacing="0" style="border-collapse:collapse;margin:8px 0 16px 0;">' + head % (td, 'By company', tdr, tdr) + rows_co + '<tr><td %s><b>Total</b></td><td %s><b>%s</b></td><td %s><b>%s</b></td></tr></table>' % (td, tdr, money(tot_base), tdr, money(tot_comm))
body += '<table cellspacing="0" style="border-collapse:collapse;margin:8px 0;">' + head % (td, 'By customer', tdr, tdr) + rows_cu + '</table>'
body += '<p style="color:#666;font-size:12px;">Detail: Odoo &gt; Commission. Sent automatically on the 1st of each month.</p></div>'
env['mail.mail'].sudo().create({'subject': 'Commission %s - %s: %s' % (label, employee, money(tot_comm)), 'email_from': 'SMB Foods <sales@smbfoods-lb.com>', 'email_to': TO, 'body_html': body, 'auto_delete': True}).send()