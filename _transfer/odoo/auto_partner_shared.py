# base.automation on res.partner (on create, and when company_id changes) - SMB, 24 Nov 2026.
# A contact made through the website (checkout, sign-up: the public or a portal user) gets the website's company,
# SMBF, and Odoo then refuses it on a smbfoods order. Contacts made by hand have no company and are shared by
# both companies; this gives website-made contacts the same default. A company chosen by an internal user on a
# contact (for example the employees' work contacts) is left alone.
if env.user.share:
    restricted = records.sudo().filtered(lambda p: p.company_id)
    if restricted:
        restricted.write({'company_id': False})
