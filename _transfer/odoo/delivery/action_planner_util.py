# Delivery planner: helper for the planner page (SMB, 23 Nov 2026). Runs on x_delivery_run, no record needed.
# The planner is used by the owner and, when he is away, from the Shop tablet. The tablet user may not read
# system parameters or edit contacts, so the page asks this action for the two things it needs:
#   - the Google Maps key (browser key, restricted by Google to smbfoods.odoo.com), returned in the result;
#   - saving a customer's map pin: context planner_pin = {partner, lat, lng} writes ONLY the two coordinates.
SHOP_GROUP = 111
if not (env.user.has_group('account.group_account_manager') or SHOP_GROUP in env.user.all_group_ids.ids):
    raise UserError('The delivery planner is for the shop team.')
pin = env.context.get('planner_pin')
if pin:
    lat = float(pin.get('lat'))
    lng = float(pin.get('lng'))
    if not (-90 <= lat <= 90 and -180 <= lng <= 180):
        raise UserError('That is not a place on the map.')
    env['res.partner'].sudo().browse(int(pin.get('partner'))).write({'partner_latitude': lat, 'partner_longitude': lng})
    action = {'type': 'ir.actions.act_window_close', 'infos': {'saved': True}}
else:
    action = {'type': 'ir.actions.act_window_close', 'infos': {'key': env['ir.config_parameter'].sudo().get_param('smb_delivery.google_maps_key') or ''}}
