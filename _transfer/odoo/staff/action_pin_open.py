# My statement (tablet): start a fresh, empty PIN form; earlier ones are removed so no statement stays readable - SMB, 22 Nov 2026
P = env['x_staff_pin'].sudo()
P.search([]).unlink()
rec = P.create({'x_name': 'My statement'})
action = {'type': 'ir.actions.act_window', 'name': 'My statement', 'res_model': 'x_staff_pin', 'view_mode': 'form', 'res_id': rec.id, 'target': 'current'}