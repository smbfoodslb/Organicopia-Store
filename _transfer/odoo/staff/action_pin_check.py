# My statement (tablet): check the employee's own PIN (the clock-in PIN, hr.employee.pin) and show that statement - SMB, 22 Nov 2026
build = env['ir.actions.server'].sudo().search([('name', '=', 'Staff statement: build')], limit=1)
for r in records:
    if not r.x_employee_id or not r.x_pin:
        raise UserError('Choose your name and type your PIN.')
    emp = env['hr.employee'].sudo().browse(r.x_employee_id.id)
    if not emp.pin or emp.pin != r.x_pin.strip():
        raise UserError('Wrong PIN.')
    env['ir.actions.server'].sudo().browse(1352).run()
    build.with_context(statement_employee=emp.id, statement_model='x_staff_pin', statement_res_id=r.id).run()
    r.sudo().write({'x_pin': False})