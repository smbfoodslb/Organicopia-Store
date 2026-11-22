// Deploy the staff ledger / statements / My statement (SMB, 22 Nov 2026). Idempotent; run stage by stage: await run('models'|'actions'|'views'|'menus').
const BASE = window.__STAFF_BASE;
const txt = async f => { const r = await fetch(BASE + f); if (!r.ok) throw new Error('fetch ' + f); return r.text(); };
const one = async (model, dom) => (await rpc(model, 'search', [dom]))[0];
const mk = async (model, dom, vals) => (await one(model, dom)) || await rpc(model, 'create', [vals]);
const F = (name, desc, ttype, extra = {}) => [0, 0, { name, field_description: desc, ttype, state: 'manual', ...extra }];
const SEL = pairs => ({ selection_ids: pairs.map(([value, name], i) => [0, 0, { value, name, sequence: i + 1 }]) });
const EMP = { relation: 'hr.employee.public', on_delete: 'restrict' };
const G_OWNER = 30, G_SHOP = 111;
const log = {};
const model = async (m, name, fields) => (await one('ir.model', [['model', '=', m]])) || await rpc('ir.model', 'create', [{ name, model: m, state: 'manual', field_id: fields }]);
const access = async (name, model_id, group_id, r, w, c, u) => mk('ir.model.access', [['name', '=', name]], { name, model_id, group_id, perm_read: r, perm_write: w, perm_create: c, perm_unlink: u });
if (stage === 'models') {
  log.settlement = await model('x_staff_settlement', 'Staff settlement', [F('x_name', 'Settlement', 'char'), F('x_date', 'Date', 'date'), F('x_employee_id', 'Employee', 'many2one', EMP), F('x_commission', 'Commission', 'float'), F('x_entries', 'Ledger entries (net)', 'float'), F('x_net', 'Net settled', 'float'), F('x_note', 'Note', 'char')]);
  log.entry = await model('x_staff_entry', 'Staff ledger entry', [F('x_name', 'Entry', 'char'), F('x_date', 'Date', 'date', { index: true }), F('x_employee_id', 'Employee', 'many2one', { ...EMP, index: true }), F('x_driver_id', 'Driven by', 'many2one', EMP),
    F('x_type', 'Type', 'selection', SEL([['expense', 'Expense paid for the shop'], ['vehicle', 'Vehicle use'], ['cash', 'Customer money received'], ['advance', 'Advance given to the employee'], ['other', 'Other']])),
    F('x_input', 'Amount entered', 'float'), F('x_amount', 'Amount on the statement', 'float'), F('x_km', 'Km', 'float'),
    F('x_vehicle', 'Vehicle', 'selection', SEL([['melissa', "Melissa's"], ['serge', "Serge's"], ['kangoo', 'SMBF Kangoo']])),
    F('x_partner_id', 'Customer', 'many2one', { relation: 'res.partner', on_delete: 'restrict' }), F('x_invoice_id', 'Invoice', 'many2one', { relation: 'account.move', on_delete: 'set null' }), F('x_payment_id', 'Payment', 'many2one', { relation: 'account.payment', on_delete: 'set null' }),
    F('x_method', 'Paid by', 'selection', SEL([['cash', 'Cash'], ['whish', 'Whish']])), F('x_receipt', 'Receipt', 'binary'), F('x_desc', 'Description', 'char'), F('x_note', 'Notes', 'text'),
    F('x_state', 'Status', 'selection', { ...SEL([['review', 'To review'], ['confirmed', 'Confirmed'], ['rejected', 'Rejected']]), index: true }),
    F('x_settled', 'Settled', 'boolean', { index: true }), F('x_settled_date', 'Settled on', 'date'), F('x_settlement_id', 'Settlement', 'many2one', { relation: 'x_staff_settlement', on_delete: 'set null' }), F('x_company_id', 'Company', 'many2one', { relation: 'res.company', on_delete: 'restrict' })]);
  log.statement = await model('x_staff_statement', 'Staff statement', [F('x_name', 'Statement', 'char'), F('x_employee_id', 'Employee', 'many2one', EMP), F('x_html', 'Statement', 'html'), F('x_net', 'Net', 'float'), F('x_review', 'Entries to review', 'integer'), F('x_commission', 'Commission open', 'float'), F('x_entries', 'Ledger entries (net)', 'float')]);
  log.pin = await model('x_staff_pin', 'My statement (PIN)', [F('x_name', 'Name', 'char'), F('x_employee_id', 'Employee', 'many2one', { relation: 'hr.employee.public', on_delete: 'set null' }), F('x_pin', 'PIN', 'char'), F('x_html', 'Statement', 'html')]);
  const cm = await one('ir.model', [['model', '=', 'x_commission_line']]);
  log.cl_field = await mk('ir.model.fields', [['model', '=', 'x_commission_line'], ['name', '=', 'x_settlement_id']], { model_id: cm, name: 'x_settlement_id', field_description: 'Settlement', ttype: 'many2one', relation: 'x_staff_settlement', on_delete: 'set null', state: 'manual' });
  log.acc = [await access('staff_entry_owner', log.entry, G_OWNER, true, true, true, true), await access('staff_entry_shop', log.entry, G_SHOP, true, false, true, false),
    await access('staff_settlement_owner', log.settlement, G_OWNER, true, true, true, true), await access('staff_statement_owner', log.statement, G_OWNER, true, true, true, true),
    await access('staff_pin_owner', log.pin, G_OWNER, true, true, true, true), await access('staff_pin_shop', log.pin, G_SHOP, true, true, false, false)];
  log.rules = [await mk('ir.rule', [['name', '=', 'Staff entries: shop sees only entries under review']], { name: 'Staff entries: shop sees only entries under review', model_id: log.entry, groups: [[6, 0, [G_SHOP]]], domain_force: "[('x_state', '=', 'review')]", perm_read: true, perm_write: true, perm_unlink: true, perm_create: false }),
    await mk('ir.rule', [['name', '=', 'Staff entries: owner sees all']], { name: 'Staff entries: owner sees all', model_id: log.entry, groups: [[6, 0, [G_OWNER]]], domain_force: "[(1, '=', 1)]" })];
}
if (stage === 'actions') {
  const m = {}; for (const k of ['x_staff_entry', 'x_staff_statement', 'x_staff_pin']) m[k] = await one('ir.model', [['model', '=', k]]);
  const act = async (name, model_id, file, extra = {}) => { const code = await txt(file); const id = await one('ir.actions.server', [['name', '=', name]]); if (id) { await rpc('ir.actions.server', 'write', [[id], { code, ...extra }]); return id; } return rpc('ir.actions.server', 'create', [{ name, model_id, state: 'code', code, ...extra }]); };
  log.build = await act('Staff statement: build', m.x_staff_statement, 'action_statement_build.py');
  log.open = await act('Staff statements: open', m.x_staff_statement, 'action_statement_open.py', { group_ids: [[6, 0, [G_OWNER]]] });
  log.settle = await act('Staff statement: settle', m.x_staff_statement, 'action_statement_settle.py', { group_ids: [[6, 0, [G_OWNER]]] });
  log.confirm = await act('Confirm entries', m.x_staff_entry, 'action_entry_confirm.py', { group_ids: [[6, 0, [G_OWNER]]], binding_model_id: m.x_staff_entry, binding_view_types: 'list,form' });
  log.reject = await act('Reject entries', m.x_staff_entry, 'action_entry_reject.py', { group_ids: [[6, 0, [G_OWNER]]], binding_model_id: m.x_staff_entry, binding_view_types: 'list,form' });
  log.pinOpen = await act('My statement: open', m.x_staff_pin, 'action_pin_open.py', { group_ids: [[6, 0, [G_OWNER, G_SHOP]]] });
  log.pinCheck = await act('My statement: check PIN', m.x_staff_pin, 'action_pin_check.py', { group_ids: [[6, 0, [G_OWNER, G_SHOP]]] });
  const code = await txt('auto_entry_create.py');
  const au = await one('base.automation', [['name', '=', 'Staff ledger: tidy new entry']]);
  if (au) { const a = await rpc('base.automation', 'read', [[au], ['action_server_ids']]); await rpc('ir.actions.server', 'write', [a[0].action_server_ids, { code }]); log.auto = au; }
  else log.auto = await rpc('base.automation', 'create', [{ name: 'Staff ledger: tidy new entry', model_id: m.x_staff_entry, trigger: 'on_create', action_server_ids: [[0, 0, { name: 'Staff ledger: tidy new entry', model_id: m.x_staff_entry, state: 'code', code }]] }]);
}
if (stage === 'views') {
  const a = {}; for (const [k, n] of [['__CONFIRM__', 'Confirm entries'], ['__REJECT__', 'Reject entries'], ['__SETTLE__', 'Staff statement: settle'], ['__OPEN__', 'Staff statements: open'], ['__CHECK__', 'My statement: check PIN']]) a[k] = await one('ir.actions.server', [['name', '=', n]]);
  const view = async (name, model, type, file, priority) => { let arch = await txt(file); for (const k in a) arch = arch.split(k).join(String(a[k])); const id = await one('ir.ui.view', [['name', '=', name]]); if (id) { await rpc('ir.ui.view', 'write', [[id], { arch, priority }]); return id; } return rpc('ir.ui.view', 'create', [{ name, model, type, arch, priority }]); };
  log.v = { entryList: await view('x_staff_entry.list', 'x_staff_entry', 'list', 'view_entry_list.xml', 10), entrySearch: await view('x_staff_entry.search', 'x_staff_entry', 'search', 'view_entry_search.xml', 10), entryForm: await view('x_staff_entry.form.owner', 'x_staff_entry', 'form', 'view_entry_form_owner.xml', 10),
    fExpense: await view('x_staff_entry.form.expense', 'x_staff_entry', 'form', 'view_entry_form_expense.xml', 30), fVehicle: await view('x_staff_entry.form.vehicle', 'x_staff_entry', 'form', 'view_entry_form_vehicle.xml', 31), fCash: await view('x_staff_entry.form.cash', 'x_staff_entry', 'form', 'view_entry_form_cash.xml', 32),
    stList: await view('x_staff_statement.list', 'x_staff_statement', 'list', 'view_statement_list.xml', 10), stForm: await view('x_staff_statement.form', 'x_staff_statement', 'form', 'view_statement_form.xml', 10),
    seList: await view('x_staff_settlement.list', 'x_staff_settlement', 'list', 'view_settlement_list.xml', 10), pinForm: await view('x_staff_pin.form', 'x_staff_pin', 'form', 'view_pin_form.xml', 10) };
  const today = "'default_x_date': context_today().strftime('%Y-%m-%d')";
  const win = async (name, vals) => { const id = await one('ir.actions.act_window', [['name', '=', name], ['res_model', '=', vals.res_model]]); if (id) { await rpc('ir.actions.act_window', 'write', [[id], vals]); return id; } return rpc('ir.actions.act_window', 'create', [{ name, ...vals }]); };
  log.w = { expense: await win('Add expense', { res_model: 'x_staff_entry', view_mode: 'form', view_id: log.v.fExpense, target: 'current', context: "{'default_x_type': 'expense', " + today + "}" }),
    vehicle: await win('Vehicle use', { res_model: 'x_staff_entry', view_mode: 'form', view_id: log.v.fVehicle, target: 'current', context: "{'default_x_type': 'vehicle', " + today + "}" }),
    cash: await win('Cash received', { res_model: 'x_staff_entry', view_mode: 'form', view_id: log.v.fCash, target: 'current', context: "{'default_x_type': 'cash', 'default_x_method': 'cash', " + today + "}" }),
    entries: await win('Entries', { res_model: 'x_staff_entry', view_mode: 'list,form', view_id: log.v.entryList, context: "{'search_default_review': 1, 'default_x_state': 'review', " + today + "}" }),
    settlements: await win('Settlements', { res_model: 'x_staff_settlement', view_mode: 'list' }) };
}
if (stage === 'menus') {
  const a = {}; for (const [k, n] of [['open', 'Staff statements: open'], ['pinOpen', 'My statement: open']]) a[k] = await one('ir.actions.server', [['name', '=', n]]);
  const w = {}; for (const n of ['Add expense', 'Vehicle use', 'Cash received', 'Entries', 'Settlements']) w[n] = await one('ir.actions.act_window', [['name', '=', n], ['res_model', 'in', ['x_staff_entry', 'x_staff_settlement']]]);
  const menu = async (name, parent_id, sequence, action, groups) => { const id = await one('ir.ui.menu', [['name', '=', name], ['parent_id', '=', parent_id]]); const vals = { name, parent_id, sequence, action, group_ids: [[6, 0, groups]] }; if (id) { await rpc('ir.ui.menu', 'write', [[id], vals]); return id; } return rpc('ir.ui.menu', 'create', [vals]); };
  await rpc('ir.ui.menu', 'write', [[727], { name: 'Commission & Staff', action: 'ir.actions.server,' + a.open }]);
  log.m = { statements: await menu('Statements', 727, 1, 'ir.actions.server,' + a.open, [G_OWNER]), entries: await menu('Entries', 727, 2, 'ir.actions.act_window,' + w['Entries'], [G_OWNER]), lines: await menu('Commission lines', 727, 3, 'ir.actions.server,1352', [G_OWNER]), settlements: await menu('Settlements', 727, 4, 'ir.actions.act_window,' + w['Settlements'], [G_OWNER]),
    expense: await menu('Add expense', false, 147, 'ir.actions.act_window,' + w['Add expense'], [G_SHOP]), vehicle: await menu('Vehicle use', false, 148, 'ir.actions.act_window,' + w['Vehicle use'], [G_SHOP]), cash: await menu('Cash received', false, 149, 'ir.actions.act_window,' + w['Cash received'], [G_SHOP]), mine: await menu('My statement', false, 150, 'ir.actions.server,' + a.pinOpen, [G_SHOP]) };
}
return log;
