/* SMB: colour the Odoo back-office top bar by the company you are working in, so it is obvious even in a small window.
   3 SOUL MIND BODY FOODS SARL → wholesale green, 1 smbfoods → Organicopia brown, 2 smbfoods USA → Odoo default purple.
   Loaded through ir.asset "SMB company theme" (bundle web.assets_backend). */
(function () {
  var COLORS = { 3: { bg: '#143D36', name: 'SMBF' }, 1: { bg: '#6A4534', name: 'smbfoods' } };
  var DEFAULT_THEME = '#714B67';
  function currentCompany() {
    // Odoo keeps the active companies in the "cids" cookie; the first id is the one transactions are posted to.
    var m = document.cookie.match(/(?:^|;\s*)cids=([^;]*)/);
    if (m) { var first = decodeURIComponent(m[1]).split(/[-,]/)[0]; if (/^\d+$/.test(first)) return +first; }
    try { var info = window.odoo && (odoo.__session_info__ || odoo.session_info); if (info && info.user_companies) return info.user_companies.current_company; } catch (e) {}
    return null;
  }
  function css(bg) {
    return '.o_main_navbar{background:' + bg + '!important;color:#fff!important}' +
      '.o_main_navbar .o_menu_brand{background:rgba(0,0,0,.22)!important;color:#fff!important}' +
      '.o_main_navbar .o_menu_sections .dropdown-toggle,.o_main_navbar .o_menu_sections .o_nav_entry,.o_main_navbar .o_menu_sections a,.o_main_navbar .o_menu_sections button,.o_main_navbar .o_navbar_apps_menu .dropdown-toggle,.o_main_navbar .o_menu_toggle{background:transparent!important;color:#fff!important}' +
      '.o_main_navbar .o_menu_sections .dropdown-toggle:hover,.o_main_navbar .o_menu_sections .o_nav_entry:hover,.o_main_navbar .o_menu_sections a:hover,.o_main_navbar .o_menu_sections button:hover{background:rgba(255,255,255,.16)!important}' +
      '.o_main_navbar .o_menu_systray>*>*,.o_main_navbar .o_menu_systray .dropdown-toggle,.o_main_navbar .o_menu_systray a,.o_main_navbar .o_menu_systray button,.o_main_navbar .o_menu_systray i,.o_main_navbar .o_menu_systray span{color:#fff!important;background:transparent!important}' +
      '.o_main_navbar .o_menu_systray .badge{color:#fff!important;background:#d0442c!important}' +
      '.o_main_navbar .o_switch_company_menu .dropdown-toggle{font-weight:700!important}' +
      '.smb-co{display:inline-flex;align-items:center;align-self:center;margin-left:14px;transform:none!important;pointer-events:none;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.75);white-space:nowrap}';
  }
  function setThemeColor(c) { var m = document.querySelector('meta[name="theme-color"]'); if (!m) { m = document.createElement('meta'); m.name = 'theme-color'; document.head.appendChild(m); } m.content = c; }
  function apply() {
    var cid = currentCompany(), conf = COLORS[cid];
    var st = document.getElementById('smb-company-theme');
    if (!conf) { if (st) st.remove(); setThemeColor(DEFAULT_THEME); var old = document.querySelector('.smb-co'); if (old) old.remove(); return; }
    if (!st) { st = document.createElement('style'); st.id = 'smb-company-theme'; document.head.appendChild(st); }
    var want = css(conf.bg); if (st.textContent !== want) st.textContent = want;
    setThemeColor(conf.bg);
    var nav = document.querySelector('.o_main_navbar'); if (!nav) return;
    var brand = nav.querySelector('.o_menu_brand'), toggle = nav.querySelector('.o_menu_toggle');
    var anchor = brand || toggle;            // inside an app: after the app name; on the home screen: after the home toggle
    var lbl = nav.querySelector('.smb-co');
    if (lbl && anchor && lbl.previousElementSibling !== anchor) { lbl.remove(); lbl = null; }
    if (!lbl && anchor) { lbl = document.createElement('span'); lbl.className = 'smb-co'; anchor.insertAdjacentElement('afterend', lbl); }
    if (lbl && lbl.textContent !== conf.name) lbl.textContent = conf.name;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply); else apply();
  setInterval(apply, 1500); // the navbar is re-rendered on app switches; company switches reload the page
})();
