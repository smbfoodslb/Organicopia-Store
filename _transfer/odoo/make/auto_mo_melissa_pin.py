# Only Melissa starts a manufacturing order on the shop tablet (SMB, 26 Nov 2026). base.automation on mrp.production,
# on create. Applies to the shared Shop tablet user (uid 33) only: the owner and every other user are not restricted.
# The PIN typed in "Melissa's PIN" is compared with her clock-in PIN (employee 5) with sudo and never kept or shown; a
# wrong or missing PIN refuses the creation. Not asked for orders Odoo creates itself: a back order of a partly
# produced order, or an order raised for another document (it has a source).
MELISSA = 5
SHOP_UID = 33
for mo in records:
    typed = (mo.x_pin or '').strip()
    if mo.x_pin:
        mo.sudo().write({'x_pin': False})
    if env.uid != SHOP_UID or mo.origin or mo.backorder_sequence > 1:
        continue
    pin = env['hr.employee'].sudo().browse(MELISSA).pin
    if not pin or not typed or typed != pin:
        raise UserError("Only Melissa can start a manufacturing order. Enter her PIN in \"Melissa's PIN\" and try again.")
