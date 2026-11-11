/* SMB: colour the Odoo back-office top bar by current company, so the active company is obvious
   even in a small window. Company ids: 3 SOUL MIND BODY FOODS SARL (wholesale green), 1 smbfoods (Organicopia brown),
   2 smbfoods USA (Odoo default). Loaded as a web.assets_backend asset (ir.asset). */
(function () {
  var COLORS = { 3: { bg: '#143D36', name: 'SOUL MIND BODY FOODS SARL' }, 1: { bg: '#6A4534', name: 'smbfoods' } };
  var current = null;
  function css(bg) {
    return '.o_main_navbar{background:' + bg + '!important;border-bottom:3px solid rgba(255,255,255,.25)!important}' +
      '.o_main_navbar .o_navbar_apps_menu .dropdown-toggle,.o_main_navbar .o_menu_brand,.o_main_navbar .o_menu_sections .dropdown-toggle,.o_main_navbar .o_menu_sections a,.o_main_navbar .o_menu_systray .dropdown-toggle,.o_main_navbar .o_menu_systray a,.o_main_navbar .o_menu_systray button{color:#fff!important}' +
      '.o_main_navbar .o_switch_company_menu .dropdown-toggle{font-weight:700!important}' +
      '.o_home_menu_background{box-shadow:inset 0 6px 0 ' + bg + '}' +
      '.o_main_navbar::after{content:"' + (COLORS[current] ? COLORS[current].name : '') + '";position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);color:rgba(255,255,255,.55);font-size:11px;letter-spacing:.14em;text-transform:uppercase;pointer-events:none;white-space:nowrap}';
  }
  function apply(cid) {
    current = cid;
    var el = document.getElementById('smb-company-theme');
    if (!COLORS[cid]) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement('style'); el.id = 'smb-company-theme'; document.head.appendChild(el); }
    el.textContent = css(COLORS[cid].bg);
  }
  function fromSession() {
    try {
      var info = (window.odoo && (odoo.__session_info__ || odoo.session_info)) || null;
      if (info && info.user_companies && info.user_companies.current_company) return apply(info.user_companies.current_company);
    } catch (e) {}
    fetch('/web/session/get_session_info', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"jsonrpc":"2.0","method":"call","params":{}}' })
      .then(function (r) { return r.json(); })
      .then(function (j) { var uc = j.result && j.result.user_companies; if (uc && uc.current_company) apply(uc.current_company); })
      .catch(function () {});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fromSession); else fromSession();
  // the company switcher reloads the page, but keep a light re-check for in-place changes
  setInterval(function () { if (document.getElementById('smb-company-theme') === null && current) apply(current); }, 2000);
})();
