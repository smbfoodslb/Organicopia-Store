# Staff statements (owner): refresh the commission lines, rebuild every employee's statement, open the list - SMB, 22 Nov 2026
EMPLOYEES = [5, 7]
env['ir.actions.server'].sudo().browse(1352).run()
build = env['ir.actions.server'].sudo().search([('name', '=', 'Staff statement: build')], limit=1)
S = env['x_staff_statement'].sudo()
for emp_id in EMPLOYEES:
    st = S.search([('x_employee_id', '=', emp_id)], limit=1)
    if not st:
        st = S.create({'x_employee_id': emp_id, 'x_name': env['hr.employee'].sudo().browse(emp_id).name})
    build.with_context(statement_employee=emp_id, statement_model='x_staff_statement', statement_res_id=st.id).run()
action = {'type': 'ir.actions.act_window', 'name': 'Staff statements', 'res_model': 'x_staff_statement', 'view_mode': 'list,form'}