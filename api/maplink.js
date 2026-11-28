// Reads the coordinates behind a short Google Maps link for Odoo (SMB Foods, 28 Nov 2026).
//
// Odoo Online cannot open a web link, so a short link (maps.app.goo.gl/...) pasted by a customer on WhatsApp or by
// staff into a contact's "Map location" could not be turned into a pin. Flow:
//   1. Odoo (automation on the contact) POSTs { id, x_map_link } here, with ?cb=<its own incoming webhook address>.
//   2. This function follows the link's redirects on Google's hosts only and reads the coordinates from the address.
//   3. It POSTs { id, link, lat, lng } back to Odoo, which writes the pin only if the contact still carries that
//      exact link and the point is in Lebanon.
// Nothing is stored here and no secret lives in this repository: the callback address travels in the request and
// must be an Odoo webhook of smbfoods.odoo.com.

const ODOO_HOST = 'smbfoods.odoo.com';
const SHORT_HOSTS = ['maps.app.goo.gl', 'goo.gl', 'g.co'];
const GOOGLE = /(^|\.)google\.[a-z.]{2,6}$|(^|\.)goo\.gl$|(^|\.)g\.co$/;

function pair(a, b) {
  const lat = parseFloat(a), lng = parseFloat(b);
  if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  if (String(a).indexOf('.') < 0 || String(b).indexOf('.') < 0) return null;
  return { lat: Math.round(lat * 1e7) / 1e7, lng: Math.round(lng * 1e7) / 1e7 };
}

function coords(address) {
  let s;
  try { s = decodeURIComponent(address); } catch (e) { s = address; }
  let m = s.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (m) return pair(m[1], m[2]);
  m = s.match(/\/(?:place|search|dir)\/(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
  if (m) return pair(m[1], m[2]);
  m = s.match(/[?&](?:q|ll|query|destination|daddr|center)=(?:loc:)?(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
  if (m) return pair(m[1], m[2]);
  m = s.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (m) return pair(m[1], m[2]);
  return null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') { res.status(405).json({ ok: false }); return; }
    let cb;
    try { cb = new URL(String(req.query.cb || '')); } catch (e) { res.status(400).json({ ok: false }); return; }
    if (cb.protocol !== 'https:' || cb.hostname !== ODOO_HOST || cb.pathname.indexOf('/web/hook/') !== 0) { res.status(400).json({ ok: false }); return; }
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const id = parseInt(body.id || body._id, 10);
    const link = String(body.x_map_link || '').trim();
    let first;
    try { first = new URL(link); } catch (e) { res.status(400).json({ ok: false }); return; }
    if (!id || first.protocol !== 'https:' || SHORT_HOSTS.indexOf(first.hostname) < 0) { res.status(400).json({ ok: false }); return; }

    let address = link, found = null;
    for (let i = 0; i < 6 && !found; i++) {
      const r = await fetch(address, { redirect: 'manual', headers: { 'user-agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36', 'accept-language': 'en' } });
      const next = r.headers.get('location');
      if (r.status < 300 || r.status >= 400 || !next) break;
      address = new URL(next, address).toString();
      if (!GOOGLE.test(new URL(address).hostname)) break;
      found = coords(address);
    }
    if (found) {
      await sleep(5000);   // Odoo calls from inside the save that wrote the link: let that save finish first
      await fetch(cb.toString(), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: id, link: link, lat: found.lat, lng: found.lng }) });
    }
    res.status(200).json({ ok: !!found });
  } catch (e) {
    res.status(200).json({ ok: false });
  }
};
