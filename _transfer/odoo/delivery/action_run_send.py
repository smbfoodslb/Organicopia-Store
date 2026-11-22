# Delivery run: send the route to the driver on WhatsApp (SMB, 22 Nov 2026). Runs on x_delivery_run.
# Uses the approved Meta template "delivery_run" (whatsapp.template 22, SMB Foods number); the number is
# x_driver_phone, the button opens the short link. Only ever started by the owner pressing the button.
TEMPLATE = 22
if not env.user.has_group('account.group_account_manager'):
    raise UserError('Only the owner can send delivery runs.')
for run in records:
    if not run.x_route_code or not run.x_driver_phone:
        raise UserError('Save the run first.')
    tpl = env['whatsapp.template'].sudo().browse(TEMPLATE)
    if tpl.status != 'approved':
        raise UserError('Meta has not approved the "Delivery run" WhatsApp message yet (status: %s). Nothing was sent. You can copy the link and send it yourself for now.' % tpl.status)
    composer = env['whatsapp.composer'].with_context(active_model='x_delivery_run', active_ids=run.ids, active_id=run.id).create({
        'res_model': 'x_delivery_run',
        'res_ids': str(run.ids),
        'wa_template_id': TEMPLATE,
    })
    composer.action_send_whatsapp_template()
    run.write({'x_state': 'sent'})
