# base.automation on account.move, on write of state (SMB, 27 Nov 2026): a customer or vendor credit note validated
# with "Apply to oldest invoices" ticked, and not made from an invoice, is applied at once by action __APPLY__
# (action_credit_note_apply_oldest.py). A credit note made from an invoice ("Credit Note" on the invoice) is linked
# to that invoice by Odoo itself; what is left on it can be applied with the button. The tick is cleared afterwards.
todo = records.filtered(lambda m: m.x_apply_oldest and m.state == 'posted' and m.move_type in ('out_refund', 'in_refund'))
alone = todo.filtered(lambda m: not m.reversed_entry_id)
if alone:
    env['ir.actions.server'].browse(__APPLY__).with_context(smb_quiet=True, active_model='account.move', active_ids=alone.ids, active_id=alone.ids[0]).run()
if todo:
    todo.write({'x_apply_oldest': False})
