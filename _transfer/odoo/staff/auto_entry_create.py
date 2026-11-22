# Staff ledger: tidy a new entry (SMB, 22 Nov 2026). Runs on create of x_staff_entry.
# x_amount is signed: + the company owes the employee (expense paid by them, vehicle use), - the employee holds
# company money (customer cash received, an advance). Vehicle use: km x $0.20 to the OWNER of the vehicle
# (Melissa's -> employee 5, Serge's -> employee 7); the SMBF Kangoo earns nothing and is kept as a km record.
RATE_KM = 0.20
OWNER = {'melissa': 5, 'serge': 7}
LABEL = {'melissa': "Melissa's", 'serge': "Serge's", 'kangoo': 'SMBF Kangoo'}
for r in records.sudo():
    vals = {}
    if not r.x_state:
        vals['x_state'] = 'review'
    if not r.x_date:
        vals['x_date'] = datetime.date.today()
    if r.x_type == 'expense':
        if r.x_input <= 0:
            raise UserError('Enter the amount you paid.')
        vals['x_amount'] = round(r.x_input, 2)
        vals['x_name'] = 'Expense: %s' % (r.x_desc or '')
    elif r.x_type == 'vehicle':
        if r.x_km <= 0:
            raise UserError('Enter the km driven.')
        if not r.x_vehicle:
            raise UserError('Choose the vehicle.')
        owner = OWNER.get(r.x_vehicle)
        vals['x_driver_id'] = r.x_employee_id.id
        vals['x_input'] = r.x_km
        vals['x_amount'] = round(r.x_km * RATE_KM, 2) if owner else 0.0
        vals['x_name'] = 'Vehicle use - %gkm, %s%s' % (r.x_km, LABEL[r.x_vehicle], ', driven by %s' % r.x_employee_id.name if owner and owner != r.x_employee_id.id else '')
        if owner:
            vals['x_employee_id'] = owner
    elif r.x_type == 'cash':
        if r.x_input <= 0:
            raise UserError('Enter the amount received.')
        inv = r.x_invoice_id
        if inv and r.x_input > inv.amount_residual + 0.005:
            raise UserError('The amount is more than what is still open on %s (%.2f). Check the invoice or the amount.' % (inv.name, inv.amount_residual))
        partner = inv.commercial_partner_id if inv else r.x_partner_id
        vals['x_amount'] = -round(r.x_input, 2)
        vals['x_partner_id'] = partner.id
        vals['x_company_id'] = inv.company_id.id if inv else False
        vals['x_method'] = r.x_method or 'cash'
        vals['x_name'] = '%s received: %s%s' % ('Whish' if r.x_method == 'whish' else 'Cash', partner.name or '', ' - %s' % inv.name if inv else '')
    elif r.x_type == 'advance':
        if r.x_input > 0 and not r.x_amount:
            vals['x_amount'] = -round(r.x_input, 2)
        vals['x_name'] = 'Advance: %s' % (r.x_desc or '')
    else:
        if r.x_input and not r.x_amount:
            vals['x_amount'] = round(r.x_input, 2)
        vals['x_name'] = r.x_desc or 'Other'
    r.write(vals)