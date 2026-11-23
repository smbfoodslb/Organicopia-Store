/* SMB Foods delivery planner (22 Nov 2026). Runs on smbfoods.odoo.com/delivery-planner for the owner.
   Reads open deliveries from Odoo, lets Google put the stops in the best order (shop -> stops -> shop),
   saves the run in Odoo (x_delivery_run). The Google key is read from an Odoo system parameter. */
(function () {
  'use strict';
  var SHOP = { lat: 33.8751011, lng: 35.5589961 };
  var PICKUP_CARRIER = 5, MAX_STOPS = 9, FLYPOST = 348, FLY = -1;
  var CTX = { allowed_company_ids: [3, 1] };
  var FINISH = 1400, SEND = 1401, UTIL = 1439;
  var S = { end: { mode: 'shop', last: null, lat: null, lng: null, pick: false, marker: null }, stops: [], route: null, run: null, key: '', actions: {}, pinFor: null, map: null, line: null, busy: false, msg: '', err: '' };
  var el = document.getElementById('planner');

  function rpc(model, method, args, kwargs) {
    kwargs = kwargs || {};
    kwargs.context = Object.assign({}, CTX, kwargs.context || {});
    return fetch('/web/dataset/call_kw', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: { model: model, method: method, args: args || [], kwargs: kwargs } })
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (j.error) { throw new Error((j.error.data && j.error.data.message) || j.error.message || 'Odoo error'); }
      return j.result;
    });
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function today() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function dur(min) { return min >= 60 ? Math.floor(min / 60) + ' h ' + ('0' + (min % 60)).slice(-2) + ' min' : min + ' min'; }
  function byId(id) { if (id === FLY) { return S.fly; } for (var i = 0; i < S.stops.length; i++) { if (S.stops[i].id === id) { return S.stops[i]; } } return null; }
  function param(n) { var m = new RegExp('[?&]' + n + '=([^&]+)').exec(location.search); return m ? decodeURIComponent(m[1]) : ''; }

  var CSS = 'body{margin:0;font:14px/1.45 system-ui,Segoe UI,Arial,sans-serif;color:#17302b;background:#f4f7f6}' +
    '#planner{display:flex;flex-wrap:wrap;min-height:100vh}#side{flex:1 1 430px;max-width:520px;min-width:0;padding:16px;box-sizing:border-box;overflow:auto;max-height:100vh}' +
    '#map{flex:3 1 480px;min-height:60vh;background:#dfe7e5}h1{font-size:20px;margin:0 0 4px;color:#123d36}h2{font-size:15px;margin:18px 0 6px;color:#123d36}' +
    '.sub{color:#5b6f6a;margin:0 0 12px}.row{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}.row label{flex:1 1 120px;font-size:12px;color:#5b6f6a}' +
    'select,input[type=date]{width:100%;padding:7px;border:1px solid #b9c9c5;border-radius:6px;font:inherit;background:#fff;box-sizing:border-box}' +
    '.stop{background:#fff;border:1px solid #d5e0dd;border-radius:8px;padding:9px 10px;margin-bottom:7px}.stop.off{opacity:.6}.stop b{color:#123d36}' +
    '.top{display:flex;gap:8px;align-items:flex-start}.top input{margin-top:3px}.grow{flex:1;min-width:0}.addr{color:#5b6f6a;font-size:12.5px}' +
    '.tag{display:inline-block;font-size:11px;padding:1px 7px;border-radius:10px;margin:3px 4px 0 0;background:#e6efed;color:#35544e}' +
    '.tag.ok{background:#dcf2e4;color:#1d6b3f}.tag.warn{background:#fdecc8;color:#8a5a00}.tag.bad{background:#fbdcdc;color:#9b1c1c}' +
    'button{font:inherit;border:1px solid #123d36;background:#fff;color:#123d36;border-radius:6px;padding:6px 11px;cursor:pointer}' +
    'button.main{background:#123d36;color:#fff}button.small{padding:2px 8px;font-size:12px;margin:4px 4px 0 0}button:disabled{opacity:.5;cursor:default}' +
    '.box{background:#fff;border:1px solid #d5e0dd;border-radius:8px;padding:10px 12px;margin-top:10px}.big{font-size:17px;font-weight:600;color:#123d36}' +
    '.msg{background:#dcf2e4;border-radius:6px;padding:8px 10px;margin:10px 0;color:#1d6b3f}.err{background:#fbdcdc;border-radius:6px;padding:8px 10px;margin:10px 0;color:#9b1c1c}' +
    '.num{display:inline-block;width:22px;height:22px;line-height:22px;text-align:center;border-radius:50%;background:#123d36;color:#fff;font-size:12px;margin-right:6px}' +
    '.leg{color:#5b6f6a;font-size:12px}a{color:#0b6b5a}.link{word-break:break-all}';

  function load() {
    var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    return Promise.all([
      rpc('ir.actions.server', 'run', [[UTIL]], { context: { active_model: 'x_delivery_run' } }),
      Promise.resolve([]),
      rpc('stock.picking', 'search_read', [[['picking_type_code', '=', 'outgoing'], ['state', 'in', ['confirmed', 'assigned', 'waiting']], ['sale_id', '!=', false]]],
        { fields: ['name', 'state', 'sale_id', 'partner_id', 'company_id'], order: 'id' }),
      rpc('res.partner', 'read', [[FLYPOST]], { fields: ['name', 'partner_latitude', 'partner_longitude'] }),
      rpc('x_delivery_run', 'search_read', [[['x_state', 'in', ['draft', 'sent']]]], { fields: ['x_name', 'x_date', 'x_who', 'x_vehicle', 'x_stop_order', 'x_state', 'x_route_code', 'x_km', 'x_minutes', 'x_stops', 'x_note', 'x_end', 'x_end_lat', 'x_end_lng'], order: 'id desc' })
    ]).then(function (r) {
      S.key = (r[0] && r[0].infos && r[0].infos.key) || '';
      S.runs = r[4];
      S.fly = { id: FLY, virtual: true, name: 'FlyPost drop-off', order: '', lat: r[3][0].partner_latitude || null, lng: r[3][0].partner_longitude || null, pin: 'saved', on: true };
      var picks = r[2], runId = parseInt(param('run'), 10) || 0;
      S.run = S.runs.filter(function (x) { return x.id === runId; })[0] || null;
      var inRun = {};
      S.runs.forEach(function (x) { try { JSON.parse(x.x_stop_order || '[]').forEach(function (p) { inRun[p.picking] = x; (p.orders || []).forEach(function (q) { inRun[q.picking] = x; }); }); } catch (e) { } });
      var saved = [];
      if (S.run) { try { JSON.parse(S.run.x_stop_order || '[]').forEach(function (p) { saved.push(p.picking); (p.orders || []).forEach(function (q) { saved.push(q.picking); }); }); } catch (e) { } }
      if (S.run && S.run.x_end) { S.end.mode = S.run.x_end; if (S.run.x_end === 'other') { S.end.lat = S.run.x_end_lat; S.end.lng = S.run.x_end_lng; } if (S.run.x_end === 'last' && saved.length) { try { var so = JSON.parse(S.run.x_stop_order || '[]'); S.end.last = so[so.length - 1].picking; } catch (e) { } } }
      if (!picks.length) { return []; }
      return rpc('sale.order', 'read', [picks.map(function (p) { return p.sale_id[0]; })], { fields: ['name', 'carrier_id', 'invoice_status', 'amount_total', 'website_id', 'x_delivered_by', 'pricelist_id', 'x_flypost_handed'] }).then(function (orders) {
        var om = {}; orders.forEach(function (o) { om[o.id] = o; });
        picks = picks.filter(function (p) { var o = om[p.sale_id[0]]; return o && !(o.carrier_id && o.carrier_id[0] === PICKUP_CARRIER) && o.x_delivered_by !== 'flypost_pickup' && !(o.x_delivered_by === 'flypost' && o.x_flypost_handed) && p.partner_id; });
        var pids = picks.map(function (p) { return p.partner_id[0]; });
        return rpc('res.partner', 'read', [pids], { fields: ['name', 'commercial_company_name', 'street', 'street2', 'city', 'state_id', 'phone', 'partner_latitude', 'partner_longitude', 'x_map_link'] }).then(function (ps) {
          var pm = {}; ps.forEach(function (p) { pm[p.id] = p; });
          S.stops = picks.map(function (p) {
            var o = om[p.sale_id[0]], c = pm[p.partner_id[0]], other = inRun[p.id];
            var has = !!(c.partner_latitude || c.partner_longitude);
            var mine = saved.indexOf(p.id) >= 0;
            return {
              id: p.id, picking: p.name, order: o.name, sale: o.id, fly: o.x_delivered_by === 'flypost', retail: !!(o.pricelist_id && o.pricelist_id[0] === 27), total: o.amount_total, partner: c.id,
              name: c.name || c.commercial_company_name || '', phone: c.phone || '',
              addr: [c.street, c.street2, c.city, c.state_id && c.state_id[1]].filter(Boolean).join(', '),
              link: c.x_map_link || '', company: p.company_id ? p.company_id[1] : '', site: o.website_id ? o.website_id[1] : '',
              ready: p.state === 'assigned', invoiced: o.invoice_status === 'invoiced',
              lat: has ? c.partner_latitude : null, lng: has ? c.partner_longitude : null, pin: has ? 'saved' : 'none',
              other: other && (!S.run || other.id !== S.run.id) ? other.x_name : '',
              on: S.run ? mine : (p.state === 'assigned' && o.invoice_status === 'invoiced' && !other)
            };
          });
          if (S.run && saved.length) { S.stops.sort(function (a, b) { var x = saved.indexOf(a.id), y = saved.indexOf(b.id); return (x < 0 ? 999 : x) - (y < 0 ? 999 : y); }); }
        });
      });
    });
  }

  function loadMaps() {
    return new Promise(function (resolve, reject) {
      if (!/^AIza/.test(S.key)) { reject(new Error('The Google Maps key is not set in Odoo yet.')); return; }
      window.__plannerMaps = resolve;
      window.gm_authFailure = function () { S.err = 'Google refused the key for this page. Check the key and its website restriction.'; render(); };
      var s = document.createElement('script');
      s.src = 'https://maps.googleapis.com/maps/api/js?key=' + encodeURIComponent(S.key) + '&libraries=geometry&loading=async&callback=__plannerMaps';
      s.onerror = function () { reject(new Error('Google Maps could not be loaded.')); };
      document.head.appendChild(s);
    });
  }

  function marker(s) {
    if (s.marker) { s.marker.setMap(null); s.marker = null; }
    if (s.lat == null || !S.map || s.fly) { return; }
    var n = S.route ? S.route.order.indexOf(s.id) + 1 : 0;
    s.marker = new google.maps.Marker({
      map: S.map, position: { lat: s.lat, lng: s.lng }, draggable: true, title: s.name + ' - ' + s.order,
      label: n ? { text: String(n), color: '#fff', fontWeight: '600' } : (s.virtual ? { text: 'F', color: '#fff', fontWeight: '700' } : null), opacity: s.on ? 1 : 0.45,
      icon: { path: google.maps.SymbolPath.CIRCLE, scale: 13, fillColor: s.virtual ? '#c0392b' : s.pin === 'saved' ? '#123d36' : '#e08a00', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 }
    });
    if (s.virtual) { s.marker.setDraggable(false); return; }
    s.marker.addListener('dragend', function (e) { setPin(s, e.latLng.lat(), e.latLng.lng()); });
  }
  function setPin(s, lat, lng) {
    S.stops.forEach(function (o) { if (o.partner === s.partner) { o.lat = lat; o.lng = lng; o.pin = 'saved'; marker(o); } });
    S.pinFor = null; S.route = null; drawLine(null); S.err = '';
    S.msg = 'Pin saved for ' + s.name + '.'; render();
    rpc('ir.actions.server', 'run', [[UTIL]], { context: { active_model: 'x_delivery_run', planner_pin: { partner: s.partner, lat: lat, lng: lng } } }).catch(function (e) { S.err = 'The pin could not be saved: ' + e.message; render(); });
  }
  function geocodeMissing() {
    var g = new google.maps.Geocoder(), todo = S.stops.filter(function (s) { return s.lat == null && s.addr; });
    return todo.reduce(function (p, s) {
      return p.then(function () {
        return g.geocode({ address: s.addr + ', Lebanon', region: 'LB' }).then(function (r) {
          if (r.results && r.results[0]) { var l = r.results[0].geometry.location; s.lat = l.lat(); s.lng = l.lng(); s.pin = 'approx'; }
        }).catch(function () { });
      });
    }, Promise.resolve());
  }
  function fit() {
    var b = new google.maps.LatLngBounds(); b.extend(SHOP);
    S.stops.forEach(function (s) { if (s.lat != null) { b.extend({ lat: s.lat, lng: s.lng }); } });
    S.map.fitBounds(b, 60);
  }
  function drawLine(encoded) {
    if (S.line) { S.line.setMap(null); S.line = null; }
    if (encoded) { S.line = new google.maps.Polyline({ map: S.map, path: google.maps.geometry.encoding.decodePath(encoded), strokeColor: '#3fa06f', strokeWeight: 5, strokeOpacity: 0.85 }); }
    S.stops.forEach(marker); S.fly.on = flyOrders().length > 0; marker(S.fly);
  }
  function flyOrders() { return S.stops.filter(function (s) { return s.on && s.fly; }); }
  function setFly(s, fly) {
    S.msg = ''; S.err = '';
    rpc('sale.order', 'write', [[s.sale], { x_delivered_by: fly ? 'flypost' : 'own', x_flypost_collects: !!(fly && s.retail) }]).then(function () {
      s.fly = fly; S.route = null; S.saved = null; drawLine(null);
      S.msg = s.order + (fly ? ' goes with FlyPost.' : ' goes with our driver.'); render();
    }).catch(function (e) { S.err = 'Not changed: ' + e.message; render(); });
  }

  function handed(s) {
    S.msg = ''; S.err = '';
    rpc('sale.order', 'write', [[s.sale], { x_flypost_handed: today() }]).then(function () {
      if (s.marker) { s.marker.setMap(null); }
      S.stops = S.stops.filter(function (o) { return o.id !== s.id; }); S.route = null; S.saved = null; drawLine(null);
      S.msg = s.order + ' is with FlyPost. It is off the planner and stays in the FlyPost list.'; render();
    }).catch(function (e) { S.err = 'Not changed: ' + e.message; render(); });
  }

  function compute(ids, optimize) {
    var pt = function (p) { return { location: { latLng: { latitude: p.lat, longitude: p.lng } } }; };
    var mid = ids.slice(), dest = endPoint(ids), lastId = S.end.mode === 'last' ? mid.pop() : null;
    optimize = !!optimize && mid.length > 1;
    var body = { origin: pt(SHOP), destination: pt(dest), intermediates: mid.map(function (id) { return pt(byId(id)); }), travelMode: 'DRIVE', optimizeWaypointOrder: optimize };
    return fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': S.key, 'X-Goog-FieldMask': 'routes.optimizedIntermediateWaypointIndex,routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline,routes.legs.distanceMeters,routes.legs.duration' },
      body: JSON.stringify(body)
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (!j.routes || !j.routes[0]) { throw new Error((j.error && j.error.message) || 'Google returned no route for these stops.'); }
      var rt = j.routes[0], idx = optimize && rt.optimizedIntermediateWaypointIndex && rt.optimizedIntermediateWaypointIndex[0] >= 0 ? rt.optimizedIntermediateWaypointIndex : mid.map(function (x, i) { return i; });
      return {
        order: idx.map(function (i) { return mid[i]; }).concat(lastId === null ? [] : [lastId]), km: (rt.distanceMeters || 0) / 1000, minutes: Math.round(parseInt(rt.duration || '0', 10) / 60), line: rt.polyline && rt.polyline.encodedPolyline,
        legs: (rt.legs || []).map(function (l) { return { km: (l.distanceMeters || 0) / 1000, minutes: Math.round(parseInt(l.duration || '0', 10) / 60) }; })
      };
    });
  }
  function endPoint(ids) {
    if (S.end.mode === 'last' && ids.length) { return byId(ids[ids.length - 1]); }
    if (S.end.mode === 'other' && S.end.lat != null) { return { lat: S.end.lat, lng: S.end.lng }; }
    return SHOP;
  }
  function endMarker() {
    if (S.end.marker) { S.end.marker.setMap(null); S.end.marker = null; }
    if (S.end.mode !== 'other' || S.end.lat == null || !S.map) { return; }
    S.end.marker = new google.maps.Marker({ map: S.map, position: { lat: S.end.lat, lng: S.end.lng }, title: 'Run ends here', label: { text: 'E', color: '#fff', fontWeight: '700' },
      icon: { path: google.maps.SymbolPath.CIRCLE, scale: 13, fillColor: '#6b3fa0', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 } });
  }
  function far(s) { var a = s.lat - SHOP.lat, b = s.lng - SHOP.lng; return a * a + b * b; }
  function ticked() { return S.stops.filter(function (s) { return s.on; }); }
  function chosen() { var own = S.stops.filter(function (s) { return s.on && !s.fly; }); return flyOrders().length ? own.concat([S.fly]) : own; }
  function plan(keepOrder) {
    var list = chosen(), missing = list.filter(function (s) { return s.lat == null; });
    S.msg = ''; S.err = '';
    if (!list.length) { S.err = 'Tick at least one stop.'; return render(); }
    if (missing.length && missing[0].virtual) { S.err = 'FlyPost has no map location on its contact.'; return render(); }
    if (missing.length) { S.err = 'No location yet for: ' + missing.map(function (s) { return s.name; }).join(', ') + '. Press "Set pin" on the stop, then click its place on the map.'; return render(); }
    if (list.length > MAX_STOPS) { S.err = 'A run can hold ' + MAX_STOPS + ' stops (the limit of one Google Maps link). Untick ' + (list.length - MAX_STOPS) + ' and plan them as a second run.'; return render(); }
    if (S.end.mode === 'other' && S.end.lat == null) { S.err = 'Set where the run ends: press "Set end point", then click the place on the map.'; return render(); }
    var ids = keepOrder && S.route ? S.route.order.slice() : list.map(function (s) { return s.id; });
    if (S.end.mode === 'last') {
      if (keepOrder) { S.end.last = ids[ids.length - 1]; }
      else {
        if (ids.indexOf(S.end.last) < 0) { S.end.last = list.slice().sort(function (a, b) { return far(b) - far(a); })[0].id; }
        ids.splice(ids.indexOf(S.end.last), 1); ids.push(S.end.last);
      }
    }
    S.busy = true; render();
    var base = keepOrder ? Promise.resolve(S.route && S.route.base) : compute(ids, false);
    base.then(function (b) {
      return (keepOrder ? compute(ids, false) : (ids.length > 1 ? compute(ids, true) : Promise.resolve(b))).then(function (rt) {
        rt.base = keepOrder ? b : { km: b.km, minutes: b.minutes }; rt.manual = !!keepOrder; if (!keepOrder) { S.best = { km: rt.km, minutes: rt.minutes }; } S.route = rt; S.saved = null; S.busy = false; drawLine(rt.line); render();
      });
    }).catch(function (e) { S.busy = false; S.err = 'Route not calculated: ' + e.message; render(); });
  }
  function move(id, d) {
    var o = S.route.order, i = o.indexOf(id), j = i + d;
    if (j < 0 || j >= o.length) { return; }
    o.splice(i, 1); o.splice(j, 0, id); plan(true);
  }
  function routeUrl() {
    var p = function (s) { return s.lat.toFixed(6) + ',' + s.lng.toFixed(6); };
    var way = S.end.mode === 'last' ? S.route.order.slice(0, -1) : S.route.order;
    return 'https://www.google.com/maps/dir/?api=1&origin=' + p(SHOP) + '&destination=' + p(endPoint(S.route.order)) + '&travelmode=driving' + (way.length ? '&waypoints=' + encodeURIComponent(way.map(function (id) { return p(byId(id)); }).join('|')) : '');
  }
  function runAction(name, id) {
    return rpc('ir.actions.server', 'run', [[name]], { context: { active_model: 'x_delivery_run', active_id: id, active_ids: [id] } });
  }
  function save() {
    var who = document.getElementById('who').value, veh = document.getElementById('veh').value, day = document.getElementById('day').value;
    var approx = S.route.order.map(byId).filter(function (s) { return s.pin !== 'saved'; });
    S.msg = ''; S.err = '';
    if (approx.length) { S.err = 'Confirm the pin first for: ' + approx.map(function (s) { return s.name; }).join(', ') + ' (orange pins are Google\'s guess from the address).'; return render(); }
    var vals = {
      x_end: S.end.mode, x_end_lat: endPoint(S.route.order).lat, x_end_lng: endPoint(S.route.order).lng,
      x_end_label: S.end.mode === 'last' ? 'Ends at the last delivery: ' + byId(S.route.order[S.route.order.length - 1]).name : S.end.mode === 'other' ? 'Ends at another location' : 'Back at the shop',
      x_date: day, x_who: who, x_vehicle: veh, x_stops: S.route.order.length, x_km: Math.round(S.route.km * 10) / 10, x_minutes: S.route.minutes, x_route_url: routeUrl(),
      x_stop_order: JSON.stringify(S.route.order.map(function (id) { var s = byId(id); return s.virtual ? { picking: FLY, name: s.name, lat: s.lat, lng: s.lng, orders: flyOrders().map(function (f) { return { picking: f.id, ref: f.picking, order: f.order, name: f.name }; }) } : { picking: s.id, ref: s.picking, order: s.order, name: s.name, lat: s.lat, lng: s.lng }; }))
    };
    S.busy = true; render();
    var p = S.run ? rpc('x_delivery_run', 'write', [[S.run.id], vals]).then(function () { return S.run.id; }) : rpc('x_delivery_run', 'create', [Object.assign({ x_state: 'draft', x_name: 'Delivery run' }, vals)]);
    p.then(function (id) { id = Array.isArray(id) ? id[0] : id; return runAction(FINISH, id).then(function () { return rpc('x_delivery_run', 'read', [[id]], { fields: ['x_name', 'x_route_code', 'x_state', 'x_driver_phone', 'x_note', 'x_entry_id'] }); }); })
      .then(function (r) {
        S.run = Object.assign(S.run || {}, r[0]); S.saved = r[0]; S.busy = false;
        S.msg = 'Saved: ' + r[0].x_name + '. The km are recorded when the run is marked completed.';
        if (history.replaceState) { history.replaceState(null, '', '?run=' + r[0].id); }
        render();
      }).catch(function (e) { S.busy = false; S.err = 'Not saved: ' + e.message; render(); });
  }
  function send() {
    S.msg = ''; S.err = ''; S.busy = true; render();
    runAction(SEND, S.run.id).then(function () { S.busy = false; S.run.x_state = 'sent'; S.msg = 'Sent to the driver on WhatsApp.'; render(); })
      .catch(function (e) { S.busy = false; S.err = e.message; render(); });
  }

  function render() {
    var side = document.getElementById('side'); if (!side) { return; }
    var keep = { who: (document.getElementById('who') || {}).value, veh: (document.getElementById('veh') || {}).value, day: (document.getElementById('day') || {}).value };
    var who = keep.who || (S.run && S.run.x_who) || '7', veh = keep.veh || (S.run && S.run.x_vehicle) || 'serge', day = keep.day || (S.run && S.run.x_date) || today();
    var opt = function (v, t, cur) { return '<option value="' + v + '"' + (v === cur ? ' selected' : '') + '>' + t + '</option>'; };
    var h = '<h1>Delivery planner</h1><p class="sub">Open deliveries, shop to stops and back. Pickup orders are left out. FlyPost orders become one drop-off at their office; orders marked FlyPost - Pick Up, or already handed to FlyPost, are left out.</p>';
    if (S.run) { h += '<div class="box">Editing <b>' + esc(S.run.x_name) + '</b> (' + (S.run.x_state === 'sent' ? 'already sent to the driver' : 'draft') + '). <a href="/delivery-planner">Start a new run</a></div>'; }
    else if (S.runs && S.runs.length) { h += '<div class="box">Open runs: ' + S.runs.map(function (r) { return '<a href="?run=' + r.id + '">' + esc(r.x_name) + '</a>'; }).join(' · ') + '</div>'; }
    h += '<div class="row" style="margin-top:12px"><label>Date<input type="date" id="day" value="' + esc(day) + '"></label><label>Driver<select id="who">' + opt('7', 'Serge', who) + opt('5', 'Melissa', who) + opt('owner', 'Mustafa', who) + '</select></label>' +
      '<label>Vehicle<select id="veh">' + opt('serge', "Serge's", veh) + opt('melissa', "Melissa's", veh) + opt('kangoo', 'SMBF Kangoo', veh) + '</select></label></div>';
    h += '<div class="row"><label>Run ends<select id="endmode">' + opt('shop', 'Back at the shop', S.end.mode) + opt('last', 'At the last delivery', S.end.mode) + opt('other', 'At another location', S.end.mode) + '</select></label>';
    if (S.end.mode === 'last') {
      var own = chosen();
      if (own.length && !own.some(function (s) { return s.id === S.end.last; })) { var withPin = own.filter(function (s) { return s.lat != null; }); S.end.last = (withPin.length ? withPin.slice().sort(function (a, b) { return far(b) - far(a); })[0] : own[0]).id; }
      h += '<label>Last delivery<select id="endlast">' + own.map(function (s) { return '<option value="' + s.id + '"' + (s.id === S.end.last ? ' selected' : '') + '>' + esc(s.name) + '</option>'; }).join('') + '</select></label>';
    } else if (S.end.mode === 'other') {
      h += '<label>End point<br><button class="small" data-a="endpin">' + (S.end.lat == null ? 'Set end point' : 'Move end point') + '</button> ' + (S.end.lat == null ? '<span class="tag bad">Not set</span>' : '<span class="tag ok">Set</span>') + '</label>';
    }
    h += '</div>';
    if (S.end.pick) { h += '<div class="msg">Click on the map where the run ends. <button class="small" data-a="noendpin">Cancel</button></div>'; }
    if (S.err) { h += '<div class="err">' + esc(S.err) + '</div>'; }
    if (S.msg) { h += '<div class="msg">' + esc(S.msg) + '</div>'; }
    if (S.pinFor) { h += '<div class="msg">Click the place on the map for <b>' + esc(byId(S.pinFor).name) + '</b>. <button class="small" data-a="nopin">Cancel</button></div>'; }
    h += '<h2>Stops (' + ticked().length + ' of ' + S.stops.length + ' ticked)</h2>';
    if (!S.stops.length) { h += '<div class="box">No open deliveries.</div>'; }
    S.stops.forEach(function (s) {
      h += '<div class="stop' + (s.on ? '' : ' off') + '"><div class="top"><input type="checkbox" data-a="tick" data-id="' + s.id + '"' + (s.on ? ' checked' : '') + '><div class="grow"><b>' + esc(s.name) + '</b> · ' + esc(s.order) + ' · $' + s.total.toFixed(2) +
        '<div class="addr">' + esc(s.addr || 'No address') + (s.phone ? ' · ' + esc(s.phone) : '') + '</div>' +
        '<span class="tag ' + (s.ready ? 'ok">Ready' : 'warn">Not ready') + '</span><span class="tag ' + (s.invoiced ? 'ok">Invoiced' : 'warn">Not invoiced') + '</span><span class="tag">' + esc(s.company) + '</span>' +
        (s.other ? '<span class="tag warn">In ' + esc(s.other) + '</span>' : '') +
        (s.fly ? '<span class="tag bad">FlyPost</span><br>' : '<span class="tag ' + (s.pin === 'saved' ? 'ok">Pin saved' : s.pin === 'approx' ? 'warn">Pin is a guess' : 'bad">No location') + '</span><br>') +
        (!s.fly && s.pin === 'approx' ? '<button class="small" data-a="okpin" data-id="' + s.id + '">Pin is right</button>' : '') +
        (s.fly ? '' : '<button class="small" data-a="pin" data-id="' + s.id + '">' + (s.pin === 'saved' ? 'Move pin' : 'Set pin') + '</button>') +
        '<button class="small" data-a="' + (s.fly ? 'nofly' : 'fly') + '" data-id="' + s.id + '">' + (s.fly ? 'Back to our driver' : 'Send with FlyPost') + '</button>' +
        (s.fly ? '<button class="small" data-a="handed" data-id="' + s.id + '">Handed to FlyPost</button>' : '') +
        (/^https?:\/\//.test(s.link) ? '<a class="leg" target="_blank" rel="noopener" href="' + esc(s.link) + '">Open customer\'s map link</a>' : '') +
        '</div></div></div>';
    });
    h += '<button class="main" data-a="plan"' + (S.busy ? ' disabled' : '') + '>' + (S.busy ? 'Working…' : 'Plan best route') + '</button>';
    if (S.route) {
      var r = S.route, dk = r.base ? r.base.km - r.km : 0, dm = r.base ? r.base.minutes - r.minutes : 0;
      h += '<h2>Route</h2><div class="box"><div class="big">' + r.order.length + ' stops · ' + r.km.toFixed(1) + ' km · ' + dur(r.minutes) + ' driving</div>' +
        (r.manual ? '<div class="leg">Your own order. Google\'s best order was ' + (S.best && r.km - S.best.km > 0.05 ? (r.km - S.best.km).toFixed(1) + ' km shorter' : 'the same length') + '.</div>' :
          (dk > 0.05 || dm > 0 ? '<div class="leg">Best order saves ' + Math.max(dk, 0).toFixed(1) + ' km and ' + Math.max(dm, 0) + ' min compared with the list order.</div>' : '<div class="leg">The list order was already the best one.</div>')) + '<div style="margin-top:8px">';
      r.order.forEach(function (id, i) {
        var s = byId(id), l = r.legs[i];
        h += '<div style="margin:6px 0"><span class="num">' + (i + 1) + '</span><b>' + esc(s.name) + '</b> <span class="leg">' + esc(s.virtual ? flyOrders().map(function (f) { return f.order; }).join(', ') : s.order) + (l ? ' · ' + l.km.toFixed(1) + ' km, ' + l.minutes + ' min from previous' : '') + '</span> ' +
          '<button class="small" data-a="up" data-id="' + id + '"' + (i === 0 || S.busy ? ' disabled' : '') + '>▲</button><button class="small" data-a="down" data-id="' + id + '"' + (i === r.order.length - 1 || S.busy ? ' disabled' : '') + '>▼</button></div>';
      });
      var back = r.legs[r.order.length];
      h += (S.end.mode === 'last' ? '<div class="leg">The run ends at the last delivery. No return leg is counted.</div>' : '<div class="leg">' + (S.end.mode === 'other' ? 'To the end point' : 'Back to the shop') + (back ? ': ' + back.km.toFixed(1) + ' km, ' + back.minutes + ' min' : '') + '</div>') + '</div>' +
        '<div style="margin-top:10px"><button class="main" data-a="save"' + (S.busy ? ' disabled' : '') + '>' + (S.run ? 'Save changes' : 'Save run') + '</button> <a target="_blank" rel="noopener" href="' + esc(routeUrl()) + '">Preview in Google Maps</a></div></div>';
    }
    if (S.saved && S.saved.x_route_code) {
      var short = 'https://www.smbfoods-lb.com/r/' + S.saved.x_route_code;
      h += '<div class="box"><b>Link for the driver</b><div class="link"><a target="_blank" rel="noopener" href="' + short + '">' + short + '</a></div>' +
        (S.saved.x_note ? '<div class="err">' + esc(S.saved.x_note) + '</div>' : '') +
        '<div style="margin-top:8px">' + (who === 'owner' ? '' : '<button class="main" data-a="send"' + (S.busy ? ' disabled' : '') + '>' + (S.run.x_state === 'sent' ? 'Send updated route on WhatsApp' : 'Send to driver on WhatsApp') + '</button> ') + '<button data-a="copy">Copy link</button></div></div>';
    }
    side.innerHTML = h;
  }

  function onClick(e) {
    var t = e.target.closest('[data-a]'); if (!t) { return; }
    var a = t.getAttribute('data-a'), id = parseInt(t.getAttribute('data-id'), 10), s = byId(id);
    if (a === 'tick') { s.on = t.checked; S.route = null; S.saved = null; drawLine(null); render(); }
    else if (a === 'pin') { S.pinFor = id; S.msg = ''; S.err = ''; render(); }
    else if (a === 'nopin') { S.pinFor = null; render(); }
    else if (a === 'endpin') { S.end.pick = true; S.pinFor = null; S.msg = ''; S.err = ''; render(); }
    else if (a === 'noendpin') { S.end.pick = false; render(); }
    else if (a === 'okpin') { setPin(s, s.lat, s.lng); }
    else if (a === 'fly') { setFly(s, true); }
    else if (a === 'nofly') { setFly(s, false); }
    else if (a === 'handed') { handed(s); }
    else if (a === 'plan') { plan(false); }
    else if (a === 'up') { move(id, -1); }
    else if (a === 'down') { move(id, 1); }
    else if (a === 'save') { save(); }
    else if (a === 'send') { send(); }
    else if (a === 'copy') {
      var link = 'https://www.smbfoods-lb.com/r/' + S.saved.x_route_code;
      (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject()).then(function () { S.msg = 'Link copied.'; render(); }).catch(function () { S.msg = 'Select the link above and copy it.'; render(); });
    }
  }

  load().then(function () {
    el.innerHTML = '<div id="side"></div><div id="map"></div>';
    document.getElementById('side').addEventListener('click', onClick);
    document.getElementById('side').addEventListener('change', function (e) { if (e.target.id === 'endmode') { S.end.mode = e.target.value; S.end.pick = false; S.route = null; S.saved = null; drawLine(null); endMarker(); render(); }
      if (e.target.id === 'endlast') { S.end.last = parseInt(e.target.value, 10); S.route = null; S.saved = null; drawLine(null); render(); }
      if (e.target.id === 'who') { document.getElementById('veh').value = e.target.value === '5' ? 'melissa' : e.target.value === 'owner' ? 'kangoo' : 'serge'; } });
    render();
    return loadMaps().then(function () {
      S.map = new google.maps.Map(document.getElementById('map'), { center: SHOP, zoom: 12, mapTypeControl: false, streetViewControl: false });
      new google.maps.Marker({ map: S.map, position: SHOP, title: 'Shop', label: { text: 'S', color: '#fff', fontWeight: '700' }, icon: { path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW, scale: 7, fillColor: '#3fa06f', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2, labelOrigin: new google.maps.Point(0, -3) } });
      S.map.addListener('click', function (e) { if (S.end.pick) { S.end.lat = e.latLng.lat(); S.end.lng = e.latLng.lng(); S.end.pick = false; S.route = null; S.saved = null; drawLine(null); endMarker(); render(); return; } if (S.pinFor) { setPin(byId(S.pinFor), e.latLng.lat(), e.latLng.lng()); } });
      return geocodeMissing().then(function () { drawLine(null); endMarker(); fit(); render(); });
    });
  }).catch(function (e) {
    if (!document.getElementById('side')) { el.innerHTML = '<div id="side"></div>'; var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st); }
    S.err = e.message; render();
  });
})();
