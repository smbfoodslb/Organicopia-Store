# Organicopia accounts: the sign-in e-mail follows the e-mail on the account page (SMB, 18 Nov 2026).
# Odoo lets a customer change the e-mail of their contact in "My account" but keeps the old address as the login, which
# nobody expects. When a customer changes it on the Organicopia website (website 1), the login of their account becomes
# the new address, an address that another account already uses is refused, and a notice goes to the old address.
# Not applied in the back office, on the wholesale site, or to wholesale logins (phone-style ...@smbfoods-lb.com).
for partner in records:
    if env.context.get('website_id') != 1:
        continue
    new = (partner.email or '').strip().lower()
    if not new or '@' not in new:
        continue
    for user in partner.sudo().user_ids.filtered(lambda u: u.share and u.active):
        old = (user.login or '').strip().lower()
        if old == new or old.endswith('@smbfoods-lb.com'):
            continue
        if env['res.users'].sudo().with_context(active_test=False).search_count([('login', '=ilike', new), ('id', '!=', user.id)]):
            raise UserError("This email address is already used by another account. Please use a different one.")
        user.sudo().write({'login': new})
        if '@' in old:
            body = '<p>Hello %s,</p><p>The email address of your Organicopia account was changed to <b>%s</b>. From now on, please sign in with the new address; your password is the same.</p><p>If you did not make this change, reply to this email or message us on WhatsApp right away.</p><p>Organicopia</p>' % (partner.name or '', new)
            env['mail.mail'].sudo().create({'subject': 'Your Organicopia account email was changed', 'email_from': '"Organicopia" <info@organicopia-lb.com>', 'reply_to': 'info@organicopia-lb.com', 'email_to': old, 'body_html': body, 'auto_delete': True}).send()
