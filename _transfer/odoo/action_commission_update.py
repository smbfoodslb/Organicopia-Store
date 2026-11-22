# Commission lines - 18% on Organicopia-branded sales, earned when paid (SMB, 22 Nov 2026).
# Rules agreed with the owner: both Lebanese companies (smbfoods 1, SMBF 3); a product counts when its internal Brand
# (x_studio_brand) is "Organicopia"; amounts are before VAT and after discounts; delivery lines never count; a line
# without a brand and with a negative amount (general discount, promotion) is spread over the invoice's goods in
# proportion; every amount APPLIED to an invoice (payment, or a credit note used against it) earns its proportion of
# that invoice; a payment not applied to any invoice earns nothing; a credit note takes its own Organicopia amount
# off in the period it is issued. One line per application (key P<partial id>) and per credit note (key C<move id>).
# If an application or credit note disappears later: an unsettled line is removed, a settled one gets a reversal (R<key>).
# 22 Nov 2026, later: (1) an amount applied from a plain journal entry in a general journal (a marketplace fee or a
# write-off booked against the invoice) earns nothing - Toters pays net of its fees; (2) invoices on which commission
# was already paid on the Excel sheet before they were paid by the customer carry a marker line (type 'prepaid',
# key X<invoice id>): what is applied to them later is recorded as earned and already settled.
# Run from the menu (returns the list) and by the daily scheduled action; safe to run any number of times.
START = '2026-11-01'
RATE = 0.18
BRAND = 'Organicopia'
COMPANIES = [1, 3]
EMPLOYEE = 5
Line = env['x_commission_line'].sudo()
Partial = env['account.partial.reconcile'].sudo()
Move = env['account.move'].sudo()
delivery_products = env['delivery.carrier'].sudo().with_context(active_test=False).search([]).mapped('product_id').ids
def org_net(move):
    sign = 1 if move.move_type == 'out_invoice' else -1
    goods = 0.0
    org = 0.0
    disc = 0.0
    for l in move.invoice_line_ids:
        if l.display_type != 'product':
            continue
        if l.product_id and l.product_id.id in delivery_products:
            continue
        amt = -l.balance
        if l.product_id and l.product_id.product_tmpl_id.x_studio_brand == BRAND:
            org += amt
            goods += amt
        elif amt * sign < 0:
            disc += amt
        else:
            goods += amt
    if goods and disc:
        org += disc * org / goods
    return org
existing = {}
for l in Line.search([]):
    existing[l.x_key] = l
prepaid = Line.search([('x_source', '=', 'prepaid')]).mapped('x_invoice_id').ids
created = 0
for p in Partial.search([('max_date', '>=', START), ('company_id', 'in', COMPANIES), ('debit_move_id.move_id.move_type', '=', 'out_invoice'), ('debit_move_id.move_id.state', '=', 'posted')]):
    key = 'P%d' % p.id
    if key in existing:
        continue
    inv = p.debit_move_id.move_id
    total = abs(inv.amount_total_signed)
    base = round(p.amount / total * org_net(inv), 2) if total else 0.0
    if not base:
        continue
    other = p.credit_move_id.move_id
    if other.move_type == 'entry' and other.journal_id.type == 'general':
        continue
    vals = {'x_name': '%s - %s' % (inv.name, inv.commercial_partner_id.name), 'x_key': key, 'x_date': p.max_date, 'x_employee_id': EMPLOYEE, 'x_company_id': p.company_id.id, 'x_partner_id': inv.commercial_partner_id.id, 'x_invoice_id': inv.id, 'x_source': 'credit_applied' if other.move_type == 'out_refund' else 'payment', 'x_applied': p.amount, 'x_base': base, 'x_rate': RATE, 'x_commission': round(base * RATE, 2)}
    if inv.id in prepaid:
        vals['x_settled'] = True
        vals['x_settled_date'] = p.max_date
        vals['x_note'] = 'Commission on this invoice was paid ahead on the Excel sheet (cut-over)'
    Line.create(vals)
    created += 1
for cn in Move.search([('move_type', '=', 'out_refund'), ('state', '=', 'posted'), ('invoice_date', '>=', START), ('company_id', 'in', COMPANIES)]):
    key = 'C%d' % cn.id
    if key in existing:
        continue
    base = round(org_net(cn), 2)
    if not base:
        continue
    Line.create({'x_name': '%s - %s' % (cn.name, cn.commercial_partner_id.name), 'x_key': key, 'x_date': cn.invoice_date, 'x_employee_id': EMPLOYEE, 'x_company_id': cn.company_id.id, 'x_partner_id': cn.commercial_partner_id.id, 'x_invoice_id': cn.id, 'x_source': 'credit_note', 'x_applied': -abs(cn.amount_total_signed), 'x_base': base, 'x_rate': RATE, 'x_commission': round(base * RATE, 2)})
    created += 1
for key, l in existing.items():
    gone = False
    if key.startswith('P'):
        gone = not Partial.browse(int(key[1:])).exists()
    elif key.startswith('C'):
        m = Move.browse(int(key[1:])).exists()
        gone = (not m) or m.state != 'posted'
    if not gone:
        continue
    if not l.x_settled:
        l.unlink()
    elif ('R' + key) not in existing:
        Line.create({'x_name': 'Reversal: %s' % l.x_name, 'x_key': 'R' + key, 'x_date': datetime.date.today(), 'x_employee_id': l.x_employee_id.id, 'x_company_id': l.x_company_id.id, 'x_partner_id': l.x_partner_id.id, 'x_source': 'reversal', 'x_applied': -l.x_applied, 'x_base': -l.x_base, 'x_rate': l.x_rate, 'x_commission': -l.x_commission})
action = {'type': 'ir.actions.act_window', 'name': 'Commission (18% Organicopia)', 'res_model': 'x_commission_line', 'view_mode': 'list,form', 'context': {'search_default_unsettled': 1, 'search_default_by_month': 1}}