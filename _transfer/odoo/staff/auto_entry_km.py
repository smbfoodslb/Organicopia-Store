# Staff ledger: km changed on a vehicle entry still under review (SMB, 25 Nov 2026). Runs on write of x_km.
# The amount (km x $0.20 to the owner of the vehicle; the SMBF Kangoo earns nothing) and the title follow the
# new km, so the owner only has to correct the km. Same rate and wording as auto_entry_create.py.
RATE_KM = 0.20
OWNER = {'melissa': 5, 'serge': 7}
LABEL = {'melissa': "Melissa's", 'serge': "Serge's", 'kangoo': 'SMBF Kangoo'}
for r in records.sudo():
    if r.x_type != 'vehicle' or r.x_state != 'review' or not r.x_vehicle:
        continue
    if r.x_km <= 0:
        raise UserError('Enter the km driven.')
    owner = OWNER.get(r.x_vehicle)
    driver = r.x_driver_id or r.x_employee_id
    r.write({
        'x_input': r.x_km,
        'x_amount': round(r.x_km * RATE_KM, 2) if owner else 0.0,
        'x_name': 'Vehicle use - %gkm, %s%s' % (r.x_km, LABEL[r.x_vehicle], ', driven by %s' % driver.name if owner and driver and owner != driver.id else ''),
    })
