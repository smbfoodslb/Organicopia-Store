// Step 4.2 — Golden Latte sachet photo rescaled to match the coffee sachets. Expects window.__SMB_BASE.
const rpc = async (model, method, args, kwargs) => { const r = await fetch('/web/dataset/call_kw', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: { model, method, args, kwargs: kwargs || {} } }) }); const j = await r.json(); if (j.error) throw new Error(j.error.data && j.error.data.message); return j.result; };
const b64 = async (url) => { const r = await fetch(url); const buf = new Uint8Array(await r.arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000)); return btoa(s); };
const v = await rpc('product.product', 'search_read', [[['default_code', '=', '92121']]], { fields: ['id'] });
await rpc('product.product', 'write', [[v[0].id], { image_variant_1920: await b64(window.__SMB_BASE + 'img2/92121_01.jpg') }]);
window.__step42 = 'golden latte photo updated';
