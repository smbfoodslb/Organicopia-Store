# Staff ledger: reject the selected entries still under review (owner) - SMB, 22 Nov 2026
records.filtered(lambda r: r.x_state == 'review').write({'x_state': 'rejected'})