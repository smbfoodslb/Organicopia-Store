# Staff ledger: the owner changed "On the statement of" on an entry still under review (SMB, 25 Nov 2026).
# Runs on write of x_who. The name is a fixed list (Melissa 5, Serge 7) because the employee list is empty when only
# SMBF is ticked; the employee the statement is built from follows it here. Vehicle entries are left alone: they
# always go to the owner of the car.
for r in records.sudo():
    if r.x_type == 'vehicle' or r.x_state != 'review' or r.x_settled or not r.x_who:
        continue
    if r.x_employee_id.id != int(r.x_who):
        r.write({'x_employee_id': int(r.x_who)})
