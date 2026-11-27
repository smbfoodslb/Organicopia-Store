# Staff ledger, tablet forms (SMB, 27 Nov 2026). The "Save" button of Add expense / Vehicle use / Cash received runs
# this after Odoo has saved the entry: it reopens the saved entry, so the employee sees "Saved. Waiting for the
# manager..." (and, for an expense, whether the receipt photo is on it). Before, Save closed the form and went back to
# the home screen with no sign that anything was saved; an expense was entered twice that way.
VIEW = {'expense': 5245, 'vehicle': 5246, 'cash': 5247}
action = {'type': 'ir.actions.act_window', 'res_model': 'x_staff_entry', 'res_id': record.id, 'view_mode': 'form',
          'views': [(VIEW.get(record.x_type, 5245), 'form')], 'target': 'current'}
