# Form on-change of the customer on a sales order (base.automation, trigger on_change) - SMB, 24 Nov 2026.
# A customer with several delivery addresses: Odoo proposes the first one alphabetically. When one of the
# customer's delivery addresses is ticked "Default delivery address", that one is proposed instead. The owner
# can still choose another address on the order. Only the form: orders made elsewhere are not changed.
order = env.context.get('onchange_self')
if order is not None and order.partner_id and order.partner_id.type != 'delivery':
    pick = env['res.partner'].sudo().search([('parent_id', '=', order.partner_id.commercial_partner_id.id), ('type', '=', 'delivery'), ('x_default_delivery', '=', True)], order='id', limit=1)
    if pick:
        action = {'value': {'partner_shipping_id': pick.id}}
