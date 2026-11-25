# base.automation on x_delivery_report (on create) - SMB, 25 Nov 2026.
# The driver taps "Delivered" or "Not delivered" on a stop of the run's stop-list page (his phone, or the shop tablet).
# The page posts one x_delivery_report through Odoo's public website form: token of the run, stop number, status,
# reason. This action checks it and writes the report on the run's delivery lines of that stop. Nothing is validated
# in stock here: the owner approves with "Confirm deliveries" on the run. A report is refused silently when the token
# is not a run's, the run is cancelled, older than 7 days, or its deliveries were already confirmed by the owner.
today = datetime.date.today()
for rep in records.sudo():
    tok = (rep.x_token or '').strip()
    run = env['x_delivery_run'].sudo().search([('x_token', '=', tok), ('x_state', '!=', 'cancel')], limit=1) if len(tok) == 32 else env['x_delivery_run']
    if run and not run.x_deliveries_done and run.x_date and (today - run.x_date).days <= 7 and rep.x_status in ('delivered', 'failed'):
        lines = run.x_line_ids.filtered(lambda l: l.x_stop == rep.x_stop)
        if lines:
            lines.write({
                'x_report': rep.x_status,
                'x_report_note': ((rep.x_note or '').strip()[:200] or False) if rep.x_status == 'failed' else False,
                'x_report_at': datetime.datetime.now(),
                'x_delivered': rep.x_status == 'delivered',
            })
            run.write({'x_reported': 'all' if all(l.x_report for l in run.x_line_ids) else 'part'})
            rep.write({'x_name': 'applied: %s stop %s %s' % (run.x_name, rep.x_stop, rep.x_status)})
# housekeeping: reports are only a mailbox; drop those older than a day
env['x_delivery_report'].sudo().search([('create_date', '<', datetime.datetime.now() - datetime.timedelta(days=1))]).unlink()
