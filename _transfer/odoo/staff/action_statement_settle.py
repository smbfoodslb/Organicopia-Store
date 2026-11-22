# Staff statement (owner): settle everything shown for this employee in one step - SMB, 22 Nov 2026.
# Refuses while entries are waiting for review, so commission is never settled without the expenses and the cash.
build = env['ir.actions.server'].sudo().search([('name', '=', 'Staff statement: build')], limit=1)
for st in records:
    emp = st.sudo().x_employee_id  # sudo: the employee belongs to smbfoods and is not readable with only SMBF ticked
    emp_id = emp.id
    E = env['x_staff_entry'].sudo()
    L = env['x_commission_line'].sudo()
    waiting = E.search_count([('x_employee_id', '=', emp_id), ('x_state', '=', 'review')])
    if waiting:
        raise UserError('%d entr%s of %s still waiting for your review. Confirm or reject %s first (menu Entries), then settle.' % (waiting, 'y' if waiting == 1 else 'ies', emp.name + (' is' if waiting == 1 else ' are'), 'it' if waiting == 1 else 'them'))
    com = L.search([('x_employee_id', '=', emp_id), ('x_settled', '=', False)])
    ent = E.search([('x_employee_id', '=', emp_id), ('x_state', '=', 'confirmed'), ('x_settled', '=', False)])
    if not com and not ent:
        raise UserError('Nothing to settle for %s.' % emp.name)
    c = round(sum(com.mapped('x_commission')), 2)
    e = round(sum(ent.mapped('x_amount')), 2)
    today = datetime.date.today()
    s = env['x_staff_settlement'].sudo().create({'x_name': '%s - %s' % (emp.name, today.strftime('%d %b %Y')), 'x_date': today, 'x_employee_id': emp_id, 'x_commission': c, 'x_entries': e, 'x_net': round(c + e, 2), 'x_note': '%d commission line(s), %d ledger entr%s' % (len(com), len(ent), 'y' if len(ent) == 1 else 'ies')})
    com.write({'x_settled': True, 'x_settled_date': today, 'x_settlement_id': s.id})
    ent.write({'x_settled': True, 'x_settled_date': today, 'x_settlement_id': s.id})
    build.with_context(statement_employee=emp_id, statement_model='x_staff_statement', statement_res_id=st.id).run()