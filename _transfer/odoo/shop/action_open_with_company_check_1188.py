# Shop tablet: open a list and warn when only one company is ticked (SMB, 23 Nov 2026).
# The tile's menu points here instead of straight at window action 1188. Odoo keeps the ticked companies per
# device and cannot force both per tile; with one company ticked these lists silently show half the records.
TARGET = 1188
act = env['ir.actions.act_window'].sudo().browse(TARGET).read()[0]
mine = env.user.company_ids
if len(mine) > 1 and len(env.companies) < len(mine):
    act['name'] = '%s (%s only)' % (act['name'], env.company.name)
    action = {'type': 'ir.actions.client', 'tag': 'display_notification', 'params': {
        'title': 'Only one company is selected',
        'message': 'You are seeing %s only. Tick both companies at the top right to see everything.' % env.company.name,
        'type': 'warning', 'sticky': True, 'next': act}}
else:
    action = act
