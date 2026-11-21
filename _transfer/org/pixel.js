/* Organicopia - Meta Pixel events (SMB, 21 Nov 2026).
   The base code (fbq init + PageView) sits inline in the page head: website 1 custom head for the Odoo pages,
   view website.org_retail for /store. This file adds the standard events Ads Manager reports on:
   AddToCart (a product is added in the store), InitiateCheckout (the checkout page opens, once per visit) and
   Purchase (the order confirmation page, once per order, with the order total).
   Only value and currency are sent: Meta's "core setup" for this pixel drops custom parameters and page addresses. */
(function () {
  if (typeof window.fbq !== 'function') return;
  var p = location.pathname;
  var once = function (store, k) { try { if (store.getItem(k)) return false; store.setItem(k, '1'); } catch (e) {} return true; };
  if (window.fetch) {
    var f0 = window.fetch;
    window.fetch = function (u) {
      var r = f0.apply(this, arguments);
      try {
        var url = typeof u === 'string' ? u : (u && u.url) || '';
        if (url.indexOf('/shop/cart/add') >= 0) r.then(function (x) { if (x && x.ok) window.fbq('track', 'AddToCart'); }).catch(function () {});
      } catch (e) {}
      return r;
    };
  }
  if (p === '/shop/address' && once(sessionStorage, 'orgPxCheckout')) window.fbq('track', 'InitiateCheckout');
  if (p === '/shop/confirmation') {
    var purchase = function () {
      var el = document.querySelector('[data-order-tracking-info]'); if (!el) return;
      var info = {}; try { info = JSON.parse(el.getAttribute('data-order-tracking-info')) || {}; } catch (e) {}
      var id = String(info.transaction_id || el.getAttribute('data-order-id') || '');
      var value = Number(info.value) || 0;
      if (!id || !once(localStorage, 'orgPxOrder' + id)) return;
      try { sessionStorage.removeItem('orgPxCheckout'); } catch (e) {}
      window.fbq('track', 'Purchase', { value: value, currency: info.currency || 'USD' }, { eventID: 'order-' + id });
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', purchase); else purchase();
  }
})();
