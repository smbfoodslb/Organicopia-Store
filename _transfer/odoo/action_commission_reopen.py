# Commission: undo "settled" on the selected lines - SMB, 22 Nov 2026
records.filtered(lambda l: l.x_settled).write({'x_settled': False, 'x_settled_date': False})