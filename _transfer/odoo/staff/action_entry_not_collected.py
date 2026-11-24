# Staff ledger: the driver marks a "To collect" entry as not collected (SMB, 24 Nov 2026). Runs on x_staff_entry.
# Nothing was paid at delivery: the entry leaves the tablet list and is kept, rejected, for the owner to see.
if not (env.user.has_group('account.group_account_manager') or 111 in env.user.all_group_ids.ids):
    raise UserError('This is for the shop team.')
for r in records.sudo():
    if r.x_state == 'expected':
        r.write({'x_state': 'rejected', 'x_amount': 0.0, 'x_name': (r.x_name or '').replace('To collect:', 'Not collected:', 1)})
