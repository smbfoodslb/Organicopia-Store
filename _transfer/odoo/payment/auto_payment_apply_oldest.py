# base.automation on account.payment, on write of state (SMB, 27 Nov 2026): a payment validated with
# "Apply to oldest invoices" ticked is applied at once by action __APPLY__ (action_payment_apply_oldest.py).
# The tick is cleared afterwards so it never runs twice. Payments made from an invoice ("Pay" button) are already
# linked to that invoice by Odoo and have nothing left to apply.
todo = records.filtered(lambda p: p.x_apply_oldest and p.state in ('in_process', 'paid'))
if todo:
    env['ir.actions.server'].browse(__APPLY__).with_context(smb_quiet=True, active_model='account.payment', active_ids=todo.ids, active_id=todo.ids[0]).run()
    todo.write({'x_apply_oldest': False})
