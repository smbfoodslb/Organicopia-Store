/* SMB: colour the Odoo back-office top bar by the company you are working in, so it is obvious even in a small window.
   3 SOUL MIND BODY FOODS SARL → wholesale green, 1 smbfoods → Organicopia brown, 2 smbfoods USA → Odoo default purple.
   Loaded through ir.asset "SMB company theme" (bundle web.assets_backend). */
(function () {
  // Home-screen background: the same contour-line design for both companies, in each company's colours.
  var CONTOUR = 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 800 480\' preserveAspectRatio=\'none\'><g fill=\'none\' stroke=\'STROKE\' stroke-opacity=\'OPACITY\' stroke-width=\'1.3\'><path d=\'M-20 420C120 380 180 300 320 300S520 420 680 360 820 220 900 200\'/><path d=\'M-20 380C120 340 180 262 320 262S520 382 680 322 820 182 900 160\'/><path d=\'M-20 340C120 300 180 224 320 224S520 344 680 284 820 144 900 120\'/><path d=\'M-20 300C120 260 180 186 320 186S520 306 680 246 820 106 900 80\'/><path d=\'M-20 260C120 220 180 148 320 148S520 268 680 208 820 68 900 40\'/><path d=\'M-20 460C120 420 180 338 320 338S520 458 680 398 820 258 900 240\'/><path d=\'M-20 220C120 180 180 110 320 110S520 230 680 170 820 30 900 0\'/></g></svg>")';
  function homeBg(stroke, opacity, base, glow1, glow2) {
    return 'body.o_home_menu_background{background-color:' + base + '!important;background-image:' + CONTOUR.replace('STROKE', stroke).replace('OPACITY', opacity) + ',' + glow1 + ',' + glow2 + '!important;background-size:100% 100%,cover,cover!important;background-position:center!important;background-repeat:no-repeat!important}';
  }
  var COLORS = {
    3: { bg: '#143D36', name: 'SMBF', home: homeBg('%23143D36', '.10', '#f1f3ee', 'radial-gradient(1200px 600px at 85% 110%, rgba(67,158,112,.22), transparent 60%)', 'radial-gradient(700px 500px at -5% -10%, rgba(20,61,54,.12), transparent 60%)') },
    1: { bg: '#6A4534', name: 'smbfoods', home: homeBg('%237C8466', '.26', '#FBF5EA', 'linear-gradient(180deg,#FBF5EA,#F6E9D6)', 'radial-gradient(900px 500px at 10% 0%, rgba(124,132,102,.14), transparent 60%)') }
  };
  var DEFAULT_THEME = '#714B67';
  function currentCompany() {
    // Odoo keeps the active companies in the "cids" cookie; the first id is the one transactions are posted to.
    var m = document.cookie.match(/(?:^|;\s*)cids=([^;]*)/);
    if (m) { var first = decodeURIComponent(m[1]).split(/[-,]/)[0]; if (/^\d+$/.test(first)) return +first; }
    try { var info = window.odoo && (odoo.__session_info__ || odoo.session_info); if (info && info.user_companies) return info.user_companies.current_company; } catch (e) {}
    return null;
  }
  function css(bg, home) {
    return (home || '') + '.o_main_navbar{background:' + bg + '!important;color:#fff!important}' +
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
    var want = css(conf.bg, conf.home); if (st.textContent !== want) st.textContent = want;
    setThemeColor(conf.bg);
    var nav = document.querySelector('.o_main_navbar'); if (!nav) return;
    // The app name lives inside the home toggle link (which flips over on the home screen), so the label is placed
    // as a direct child of the navbar right after that toggle: never inside a link, never mirrored.
    var anchor = nav.querySelector(':scope > .o_menu_toggle') || nav.firstElementChild;
    var lbl = nav.querySelector('.smb-co');
    if (lbl && anchor && lbl.previousElementSibling !== anchor) { lbl.remove(); lbl = null; }
    if (!lbl && anchor) { lbl = document.createElement('span'); lbl.className = 'smb-co'; anchor.insertAdjacentElement('afterend', lbl); }
    if (lbl && lbl.textContent !== conf.name) lbl.textContent = conf.name;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply); else apply();
  setInterval(apply, 1500); // the navbar is re-rendered on app switches; company switches reload the page
})();
