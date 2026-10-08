/* Free limit + device-bound activation for the unlimited version.
 * The activation code is an ECDSA P-256 signature (made only by the owner's private key)
 * over this phone's device code, so it cannot be forged, and on another phone it does not verify. */
(function (root) {
  'use strict';
  const L = {};
  L.FREE_LIMIT = 50;
  // owner settings shown on the payment screen — change here
  L.PRICE_TEXT = '۱٬۲۵۰٬۰۰۰ تومان (۱۲٬۵۰۰٬۰۰۰ ریال)';
  L.CARD_NO = '6219-8619-3578-1806';
  L.CARD_BANK = 'بلو بانک';
  L.CARD_OWNER = 'محمد صادق ربانی';
  L.SUPPORT_WA = '989999917199';
  // public key only; the private key stays with the owner (license generator file)
  const PUB = { kty: 'EC', crv: 'P-256', x: 'DuE8E0PsSyyZNsfmA-WQmkx58jYA1nPG5t1MuQ883qk', y: 'twt8PF4Lim1_b7fc7GnR9UnQUu3ln8saFOvGFfbnDaU' };
  const MSG = 'FQ-UNLIMITED-1|';
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I, O, 0, 1 (easy to read and type)

  const sub = () => (root.crypto && root.crypto.subtle) || (typeof require === 'function' ? require('crypto').webcrypto.subtle : null);
  function b32(bytes) { let bits = 0, v = 0, out = ''; for (const b of bytes) { v = (v << 8) | b; bits += 8; while (bits >= 5) { out += A[(v >>> (bits - 5)) & 31]; bits -= 5; } } if (bits > 0) out += A[(v << (5 - bits)) & 31]; return out; }
  function unb32(s) { const out = []; let bits = 0, v = 0; for (const ch of s) { const i = A.indexOf(ch); if (i < 0) return null; v = (v << 5) | i; bits += 5; if (bits >= 8) { out.push((v >>> (bits - 8)) & 255); bits -= 8; } } return new Uint8Array(out); }
  L.normCode = s => String(s || '').replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).toUpperCase().replace(/[^A-Z0-9]/g, '');
  L.group = (s, n) => s.match(new RegExp('.{1,' + (n || 4) + '}', 'g')).join('-');

  // short, readable code derived from the phone's id
  L.deviceCodeFrom = async function (rawId) {
    const h = new Uint8Array(await sub().digest('SHA-256', new TextEncoder().encode('fq-device|' + rawId)));
    return L.group(b32(h).slice(0, 12));
  };
  L.verify = async function (code, deviceCode) {
    try {
      const sig = unb32(L.normCode(code)); if (!sig || sig.length < 64) return false;
      const key = await sub().importKey('jwk', PUB, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
      return await sub().verify({ name: 'ECDSA', hash: 'SHA-256' }, key, sig.slice(0, 64), new TextEncoder().encode(MSG + L.normCode(deviceCode)));
    } catch (e) { return false; }
  };
  // used by the owner's generator (and tests) — needs the private key
  L.sign = async function (privJwk, deviceCode) {
    const key = await sub().importKey('jwk', privJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
    const sig = new Uint8Array(await sub().sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(MSG + L.normCode(deviceCode))));
    return L.group(b32(sig), 5);
  };

  // documents that count toward the free limit: invoices, separate receipts/payments/manual entries, transfers, expenses
  L.countDocs = function (st) {
    let n = st.invoices.length + st.expenses.length; const groups = new Set();
    for (const t of st.tx) {
      if (t.type === 'transfer') { groups.add(t.group); continue; }
      if (t.ref == null && (t.type === 'receipt' || t.type === 'payment' || t.type === 'manual')) n++;
    }
    return n + groups.size;
  };

  L._b32 = b32; L.MSG = MSG;
  if (typeof module !== 'undefined' && module.exports) module.exports = L; else root.License = L;
})(typeof window !== 'undefined' ? window : globalThis);
