# Delivery run: send the route to the driver on WhatsApp (SMB, 22 Nov 2026). Runs on x_delivery_run.
# Uses an approved Meta template on the SMB Foods number; the number is
# x_driver_phone, the button opens the short link. Only ever started by the owner pressing the button.
# Two templates: 23 carries the collection list (preferred); 22 is the first one, without it.
TEMPLATES = (23, 22)
FINISH = 1400
# The owner, and the Shop tablet (group 111) when he is away.
if not (env.user.has_group('account.group_account_manager') or 111 in env.user.all_group_ids.ids):
    raise UserError('The delivery planner is for the shop team.')
for run in records.sudo():
    if not run.x_route_code or not run.x_driver_phone:
        raise UserError('Save the run first.')
    # refresh the texts first, so the collection list reflects payments recorded since the run was saved
    env['ir.actions.server'].browse(FINISH).with_context(active_model='x_delivery_run', active_id=run.id, active_ids=run.ids).run()
    approved = env['whatsapp.template'].sudo().browse(TEMPLATES).filtered(lambda t: t.status == 'approved')
    if not approved:
        raise UserError('Meta has not approved the "Delivery run" WhatsApp message yet. Nothing was sent. You can copy the link and the stop list and send them yourself for now.')
    TEMPLATE = [t for t in TEMPLATES if t in approved.ids][0]
    composer = env['whatsapp.composer'].sudo().with_context(active_model='x_delivery_run', active_ids=run.ids, active_id=run.id).create({
        'res_model': 'x_delivery_run',
        'res_ids': str(run.ids),
        'wa_template_id': TEMPLATE,
    })
    composer.action_send_whatsapp_template()
    run.write({'x_state': 'sent'})
