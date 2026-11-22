# Commission: mark the selected lines as settled (paid out to the employee) - SMB, 22 Nov 2026
todo = records.filtered(lambda l: not l.x_settled)
todo.write({'x_settled': True, 'x_settled_date': datetime.date.today()})