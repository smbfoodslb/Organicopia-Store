# Website order: the order date is when the customer placed it (SMB, 26 Nov 2026). base.automation on sale.order,
# on write of "state", from draft to "sent" (Quotation Sent), website orders only.
# A basket is a sale order from the first item on, and Odoo only sets the order date when the quotation is confirmed.
# A customer who filled a basket over three days and checked out "pay on delivery" therefore showed up dated three
# days back, far down the list. Checking out puts the order in "Quotation Sent"; at that moment the date becomes now.
# Orders paid online are confirmed at once and Odoo dates them itself. Nothing else is touched.
for order in records:
    if order.state == 'sent' and order.website_id:
        order.sudo().write({'date_order': datetime.datetime.now()})
