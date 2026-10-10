/* Fix Quick Accounting — core engine (pure logic, no DOM, no storage).
 * All money values are integers (Rial). Quantities have up to 3 decimals.
 * Person balance = sum(debit) - sum(credit):  > 0  => person owes us (بدهکار)
 *                                             < 0  => we owe person (بستانکار)
 */
(function (root) {
  'use strict';
  const Core = {};

  /* ───────────── numbers ───────────── */
  const FA = '۰۱۲۳۴۵۶۷۸۹';
  const AR = '٠١٢٣٤٥٦٧٨٩';
  Core.toEn = function (s) {
    return String(s == null ? '' : s).replace(/[۰-۹]/g, d => FA.indexOf(d)).replace(/[٠-٩]/g, d => AR.indexOf(d));
  };
  Core.toFa = function (s) {
    return String(s).replace(/[0-9]/g, d => FA[d]);
  };
  // parse user typed number; returns NaN when invalid
  Core.parseNum = function (s) {
    if (typeof s === 'number') return s;
    let t = Core.toEn(s).replace(/[,٬،\s]/g, '').replace(/٫/g, '.');
    if (t === '' || !/^-?\d*\.?\d+$|^-?\d+\.?$/.test(t)) return NaN;
    return Number(t);
  };
  const MAX_MONEY = 9e12;
  Core.parseMoney = function (s) {
    const n = Core.parseNum(s);
    if (!isFinite(n) || n < 0) return NaN;
    const r = Math.round(n * (Core.unit === 'toman' ? 10 : 1));
    return r > MAX_MONEY ? NaN : r;
  };
  Core.parseQty = function (s) {
    const n = Core.parseNum(s);
    if (!isFinite(n) || n <= 0 || n > 1e9) return NaN;
    return Math.round(n * 1000) / 1000;
  };
  Core.group = function (n) {
    n = Math.round(Number(n) || 0);
    const neg = n < 0; let s = String(Math.abs(n));
    s = s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (neg ? '\u200e-' : '') + s;
  };
  // display unit: amounts are always stored in Rial; Toman only changes what is shown and typed (÷10 / ×10)
  Core.unit = 'rial';
  Core.setUnit = u => { Core.unit = u === 'toman' ? 'toman' : 'rial'; };
  Core.unitName = u => ((u || Core.unit) === 'toman' ? 'تومان' : 'ریال');
  Core.shown = n => (Core.unit === 'toman' ? (Number(n) || 0) / 10 : n);
  Core.fmt = n => Core.toFa(Core.group(Core.shown(n)));
  // for pre-filling input boxes: exact (Toman keeps one decimal when the Rial amount doesn't end in 0, so editing never changes the amount)
  Core.fmtInput = function (n) { n = Math.round(Number(n) || 0); if (Core.unit !== 'toman') return Core.toFa(Core.group(n)); const d = Math.abs(n % 10); return Core.toFa(Core.group(Math.trunc(n / 10)) + (d ? '.' + d : '')); };
  Core.fmtQty = function (q) {
    q = Math.round((Number(q) || 0) * 1000) / 1000;
    const parts = String(q).split('.'); parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return Core.toFa(parts.join('.'));
  };
  const r3 = x => Math.round(x * 1000) / 1000;

  /* ───────────── Jalali calendar (jalaali-js algorithm) ───────────── */
  const div = (a, b) => ~~(a / b);
  const mod = (a, b) => a - ~~(a / b) * b;
  const BREAKS = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];
  function jalCal(jy) {
    const bl = BREAKS.length; let gy = jy + 621, leapJ = -14, jp = BREAKS[0], jm, jump = 0, n, i;
    if (jy < jp || jy >= BREAKS[bl - 1]) throw new Error('سال شمسی خارج از محدوده');
    for (i = 1; i < bl; i++) {
      jm = BREAKS[i]; jump = jm - jp;
      if (jy < jm) break;
      leapJ += div(jump, 33) * 8 + div(mod(jump, 33), 4); jp = jm;
    }
    n = jy - jp;
    leapJ += div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
    if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
    const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
    const march = 20 + leapJ - leapG;
    if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
    let leap = mod(mod(n + 1, 33) - 1, 4); if (leap === -1) leap = 4;
    return { leap, gy, march };
  }
  function g2d(gy, gm, gd) {
    let d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4) + div(153 * mod(gm + 9, 12) + 2, 5) + gd - 34840408;
    d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752; return d;
  }
  function d2g(jdn) {
    let j = 4 * jdn + 139361631; j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
    const i = div(mod(j, 1461), 4) * 5 + 308;
    const gd = div(mod(i, 153), 5) + 1, gm = mod(div(i, 153), 12) + 1, gy = div(j, 1461) - 100100 + div(8 - gm, 6);
    return { gy, gm, gd };
  }
  function j2d(jy, jm, jd) { const r = jalCal(jy); return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1; }
  function d2j(jdn) {
    const gy = d2g(jdn).gy; let jy = gy - 621; const r = jalCal(jy); const jdn1f = g2d(gy, 3, r.march); let k = jdn - jdn1f, jm, jd;
    if (k >= 0) { if (k <= 185) { return { jy, jm: 1 + div(k, 31), jd: mod(k, 31) + 1 }; } k -= 186; }
    else { jy -= 1; k += 179; if (r.leap === 1) k += 1; }
    jm = 7 + div(k, 30); jd = mod(k, 30) + 1; return { jy, jm, jd };
  }
  Core.isLeapJ = jy => jalCal(jy).leap === 0;
  Core.monthLenJ = (jy, jm) => jm <= 6 ? 31 : jm <= 11 ? 30 : (Core.isLeapJ(jy) ? 30 : 29);
  Core.MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
  Core.WEEKDAYS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];
  const pad2 = n => (n < 10 ? '0' : '') + n;
  Core.isoToParts = function (iso) { const [y, m, d] = iso.split('-').map(Number); return d2j(g2d(y, m, d)); };
  Core.partsToIso = function (jy, jm, jd) { const g = d2g(j2d(jy, jm, jd)); return g.gy + '-' + pad2(g.gm) + '-' + pad2(g.gd); };
  Core.isoToJalali = function (iso) { if (!iso) return ''; const p = Core.isoToParts(iso); return p.jy + '/' + pad2(p.jm) + '/' + pad2(p.jd); };
  Core.fmtDate = iso => (iso ? Core.toFa(Core.isoToJalali(iso)) : '—');
  // 0 = Saturday … 6 = Friday
  Core.weekdayIdx = function (iso) { const [y, m, d] = iso.split('-').map(Number); return mod(g2d(y, m, d) + 2, 7); };
  // «شنبه ۱۹ مهر ۱۴۰۵»
  Core.longDate = function (iso) { const p = Core.isoToParts(iso); return { wd: Core.WEEKDAYS[Core.weekdayIdx(iso)], date: Core.toFa(p.jd + ' ' + Core.MONTHS[p.jm - 1] + ' ' + p.jy) }; };
  Core.validIso = function (iso) {
    if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
    const [y, m, d] = iso.split('-').map(Number); if (m < 1 || m > 12 || d < 1) return false;
    const dt = new Date(Date.UTC(y, m - 1, d)); return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  };
  // accepts 1405/7/14 or ۱۴۰۵-۰۷-۱۴ ; returns ISO or null
  Core.jalaliToIso = function (s) {
    const m = Core.toEn(s).trim().match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/); if (!m) return null;
    const jy = +m[1], jm = +m[2], jd = +m[3];
    if (jy < 1200 || jy > 1700 || jm < 1 || jm > 12 || jd < 1 || jd > Core.monthLenJ(jy, jm)) return null;
    return Core.partsToIso(jy, jm, jd);
  };
  Core.todayISO = function (now) { const d = now || new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); };
  Core.addDays = function (iso, n) { const [y, m, d] = iso.split('-').map(Number); const g = d2g(g2d(y, m, d) + n); return g.gy + '-' + pad2(g.gm) + '-' + pad2(g.gd); };
  Core.diffDays = function (a, b) { const [y1, m1, d1] = a.split('-').map(Number), [y2, m2, d2] = b.split('-').map(Number); return g2d(y2, m2, d2) - g2d(y1, m1, d1); };
  // period helpers (Jalali based) → {from,to}
  Core.periodRange = function (kind, todayIso, fyMonth) {
    const t = todayIso || Core.todayISO(); const p = Core.isoToParts(t);
    if (kind === 'today') return { from: t, to: t };
    if (kind === 'yesterday') { const y = Core.addDays(t, -1); return { from: y, to: y }; }
    if (kind === 'mtd') return { from: Core.partsToIso(p.jy, p.jm, 1), to: t };
    if (kind === 'fytd') { const fm = Math.min(12, Math.max(1, +fyMonth || 1)), y = p.jm >= fm ? p.jy : p.jy - 1; return { from: Core.partsToIso(y, fm, 1), to: t }; }
    if (kind === 'week') { const w = Core.weekdayIdx(t); const from = Core.addDays(t, -w); return { from, to: Core.addDays(from, 6) }; }
    if (kind === 'month') return { from: Core.partsToIso(p.jy, p.jm, 1), to: Core.partsToIso(p.jy, p.jm, Core.monthLenJ(p.jy, p.jm)) };
    if (kind === 'prevmonth') { const jm = p.jm === 1 ? 12 : p.jm - 1, jy = p.jm === 1 ? p.jy - 1 : p.jy; return { from: Core.partsToIso(jy, jm, 1), to: Core.partsToIso(jy, jm, Core.monthLenJ(jy, jm)) }; }
    if (kind === 'prevweek') { const w = Core.weekdayIdx(t); const from = Core.addDays(t, -w - 7); return { from, to: Core.addDays(from, 6) }; }
    if (kind === 'year') return { from: Core.partsToIso(p.jy, 1, 1), to: Core.partsToIso(p.jy, 12, Core.monthLenJ(p.jy, 12)) };
    return { from: null, to: null };
  };

  /* ───────────── state ───────────── */
  Core.emptyState = () => ({
    v: 1, seq: 1, people: [], products: [], invoices: [], tx: [], expenses: [], cheques: [], adjusts: [],
    settings: { business: '', openingCash: 0, lastBackup: null }
  });
  const nid = st => st.seq++;
  // id lookups are indexed (large data: thousands of people/products/invoices); index rebuilt when the array changes
  const idxCache = new WeakMap();
  const byId = (arr, id) => {
    let c = idxCache.get(arr);
    if (!c || c.len !== arr.length) { const m = new Map(); for (const x of arr) m.set(x.id, x); c = { len: arr.length, m }; idxCache.set(arr, c); }
    const x = c.m.get(id); if (x && x.id === id) return x;
    if (x) { idxCache.delete(arr); return arr.find(y => y.id === id); }
    return undefined;
  };
  // transactions grouped by invoice ref (for paid/remaining), cached per tx array
  const refCache = new WeakMap();
  const txByRef = st => {
    let c = refCache.get(st.tx);
    if (!c || c.len !== st.tx.length) { const m = new Map(); for (const t of st.tx) if (t.ref != null) { const a = m.get(t.ref); if (a) a.push(t); else m.set(t.ref, [t]); } c = { len: st.tx.length, m }; refCache.set(st.tx, c); }
    return c.m;
  };
  Core.txByRef = txByRef;
  Core.byId = byId;

  const METHODS = { cash: 'نقد', bank: 'کارت/حواله بانکی', cheque: 'چک' };
  Core.METHODS = METHODS;
  Core.TYPE_FA = { sale: 'فروش', purchase: 'خرید', sale_return: 'برگشت از فروش', purchase_return: 'برگشت از خرید' };
  const INV_KIND = { sale: 'debit', purchase: 'credit', sale_return: 'credit', purchase_return: 'debit' };
  // payment made at invoice time: the opposite entry on the person's account
  const PAY_KIND = { sale: 'credit', purchase: 'debit', sale_return: 'debit', purchase_return: 'credit' };
  const err = m => ({ ok: false, error: m });
  const ok = (x) => Object.assign({ ok: true }, x || {});

  /* ───────────── people ───────────── */
  Core.addPerson = function (st, d) {
    const name = String(d.name || '').trim(); if (!name) return err('نام را وارد کنید.');
    if (st.people.some(p => !p.archived && p.name === name)) return err('شخصی با این نام قبلاً ثبت شده است.');
    const p = { id: nid(st), name, phone: String(d.phone || '').trim(), note: String(d.note || '').trim(), archived: false, createdAt: d.createdAt || Date.now() };
    st.people.push(p);
    const ob = d.opening || 0;
    if (ob) { // opening balance: positive => owes us (debit), negative => we owe (credit)
      st.tx.push({ id: nid(st), personId: p.id, kind: ob > 0 ? 'debit' : 'credit', amount: Math.abs(ob), type: 'opening', desc: 'مانده اول دوره', date: d.date || Core.todayISO(), ref: null, group: null, method: null });
    }
    return ok({ person: p });
  };
  Core.editPerson = function (st, id, d) {
    Core._pv++;
    const p = byId(st.people, id); if (!p) return err('شخص پیدا نشد.');
    const name = String(d.name || '').trim(); if (!name) return err('نام را وارد کنید.');
    if (st.people.some(x => x.id !== id && !x.archived && x.name === name)) return err('شخصی با این نام قبلاً ثبت شده است.');
    p.name = name; p.phone = String(d.phone || '').trim(); p.note = String(d.note || '').trim(); return ok();
  };
  Core.personHasActivity = (st, id) => st.tx.some(t => t.personId === id) || st.invoices.some(i => i.personId === id) || st.cheques.some(c => c.personId === id);
  Core.deletePerson = function (st, id) {
    if (Core.personHasActivity(st, id)) return err('این شخص سابقه مالی دارد و حذف نمی‌شود. می‌توانید او را بایگانی کنید.');
    st.people = st.people.filter(p => p.id !== id); return ok();
  };
  Core.setArchived = function (st, id, v) { const p = byId(st.people, id); if (!p) return err('شخص پیدا نشد.'); p.archived = !!v; return ok(); };

  /* ───────────── ledger ───────────── */
  Core.balanceOf = (st, pid) => st.tx.reduce((s, t) => t.personId === pid ? s + (t.kind === 'debit' ? t.amount : -t.amount) : s, 0);
  Core.balances = function (st) { const m = {}; st.people.forEach(p => m[p.id] = 0); st.tx.forEach(t => { if (t.personId in m) m[t.personId] += t.kind === 'debit' ? t.amount : -t.amount; }); return m; };
  Core.ledger = function (st, pid, from, to) {
    const rows = st.tx.filter(t => t.personId === pid).sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id);
    let run = 0, carry = 0; const out = [];
    for (const t of rows) {
      const delta = t.kind === 'debit' ? t.amount : -t.amount;
      if (from && t.date < from) { carry += delta; run += delta; continue; }
      if (to && t.date > to) continue;
      run += delta; out.push({ tx: t, debit: t.kind === 'debit' ? t.amount : 0, credit: t.kind === 'credit' ? t.amount : 0, balance: run });
    }
    return { carry, rows: out, closing: run };
  };
  const checkDate = d => Core.validIso(d) ? null : 'تاریخ نامعتبر است.';
  // type: manual | receipt | payment
  Core.addTx = function (st, d) {
    if (!byId(st.people, d.personId)) return err('شخص انتخاب نشده است.');
    if (!(d.amount > 0) || !Number.isInteger(d.amount) || d.amount > MAX_MONEY) return err('مبلغ نامعتبر است.');
    const de = checkDate(d.date); if (de) return err(de);
    let kind = d.kind, type = d.type || 'manual';
    if (type === 'receipt') kind = 'credit'; else if (type === 'payment') kind = 'debit';
    if (kind !== 'debit' && kind !== 'credit') return err('نوع تراکنش نامعتبر است.');
    const method = (type === 'receipt' || type === 'payment') ? (METHODS[d.method] ? d.method : 'cash') : null;
    const t = { id: nid(st), personId: d.personId, kind, amount: d.amount, type, desc: String(d.desc || '').trim(), date: d.date, ref: d.ref || null, group: null, method };
    st.tx.push(t); return ok({ tx: t });
  };
  Core.editTx = function (st, id, d) {
    const t = byId(st.tx, id); if (!t) return err('تراکنش پیدا نشد.');
    if (t.type === 'invoice' || t.type === 'transfer') return err('این تراکنش از طریق فاکتور/حواله ثبت شده و اینجا قابل ویرایش نیست.');
    if (!(d.amount > 0) || !Number.isInteger(d.amount) || d.amount > MAX_MONEY) return err('مبلغ نامعتبر است.');
    const de = checkDate(d.date); if (de) return err(de);
    t.amount = d.amount; t.date = d.date; t.desc = String(d.desc || '').trim();
    if (t.type === 'manual' || t.type === 'opening') { if (d.kind === 'debit' || d.kind === 'credit') t.kind = d.kind; }
    if ((t.type === 'receipt' || t.type === 'payment') && METHODS[d.method]) t.method = d.method;
    return ok();
  };
  Core.deleteTx = function (st, id) {
    const t = byId(st.tx, id); if (!t) return err('تراکنش پیدا نشد.');
    if (t.type === 'invoice') return err('این ردیف مربوط به فاکتور است؛ برای حذف، خود فاکتور را حذف کنید.');
    if (t.group) st.tx = st.tx.filter(x => x.group !== t.group); else st.tx = st.tx.filter(x => x.id !== id);
    return ok();
  };
  // حواله: from pays (credit), to receives (debit)
  Core.addTransfer = function (st, d) {
    if (!byId(st.people, d.fromId) || !byId(st.people, d.toId)) return err('هر دو شخص را انتخاب کنید.');
    if (d.fromId === d.toId) return err('مبدأ و مقصد نمی‌تواند یکی باشد.');
    if (!(d.amount > 0) || !Number.isInteger(d.amount) || d.amount > MAX_MONEY) return err('مبلغ نامعتبر است.');
    const de = checkDate(d.date); if (de) return err(de);
    const g = nid(st); const a = byId(st.people, d.fromId).name, b = byId(st.people, d.toId).name; const note = d.desc ? ' - ' + String(d.desc).trim() : '';
    st.tx.push({ id: nid(st), personId: d.fromId, kind: 'credit', amount: d.amount, type: 'transfer', desc: 'حواله به ' + b + note, date: d.date, ref: null, group: g, method: null });
    st.tx.push({ id: nid(st), personId: d.toId, kind: 'debit', amount: d.amount, type: 'transfer', desc: 'حواله از ' + a + note, date: d.date, ref: null, group: g, method: null });
    return ok();
  };

  Core.editTransfer = function (st, group, d) {
    const pair = st.tx.filter(t => t.type === 'transfer' && t.group === group); if (pair.length !== 2) return err('حواله پیدا نشد.');
    if (!byId(st.people, d.fromId) || !byId(st.people, d.toId)) return err('هر دو شخص را انتخاب کنید.');
    if (d.fromId === d.toId) return err('مبدأ و مقصد نمی‌تواند یکی باشد.');
    if (!(d.amount > 0) || !Number.isInteger(d.amount) || d.amount > MAX_MONEY) return err('مبلغ نامعتبر است.');
    const de = checkDate(d.date); if (de) return err(de);
    const a = byId(st.people, d.fromId).name, b = byId(st.people, d.toId).name, note = d.desc ? ' - ' + String(d.desc).trim() : '';
    const out = pair.find(t => t.kind === 'credit'), inn = pair.find(t => t.kind === 'debit');
    Object.assign(out, { personId: d.fromId, amount: d.amount, date: d.date, desc: 'حواله به ' + b + note });
    Object.assign(inn, { personId: d.toId, amount: d.amount, date: d.date, desc: 'حواله از ' + a + note });
    return ok();
  };
  Core.transferInfo = function (st, group) {
    const pair = st.tx.filter(t => t.type === 'transfer' && t.group === group); const out = pair.find(t => t.kind === 'credit'), inn = pair.find(t => t.kind === 'debit');
    if (!out || !inn) return null; const m = (out.desc || '').match(/ - (.*)$/);
    return { fromId: out.personId, toId: inn.personId, amount: out.amount, date: out.date, desc: m ? m[1] : '' };
  };

  /* ───────────── products ───────────── */
  Core.addProduct = function (st, d) {
    const name = String(d.name || '').trim(); if (!name) return err('نام کالا را وارد کنید.');
    if (st.products.some(p => p.name === name)) return err('کالایی با این نام وجود دارد.');
    const bc = String(d.barcode || '').trim(); if (bc && st.products.some(p => p.barcode === bc)) return err('این بارکد برای کالای دیگری ثبت شده است.');
    const p = { id: nid(st), name, barcode: bc, sku: String(d.sku || '').trim(), unit: String(d.unit || 'عدد').trim() || 'عدد', minStock: Math.max(0, Number(d.minStock) || 0), salePrice: Math.max(0, Math.round(d.salePrice) || 0), buyPrice: Math.max(0, Math.round(d.buyPrice) || 0) };
    const cat = String(d.category || '').trim(); if (cat && cat !== Core.guessCategory(name)) p.category = cat;
    st.products.push(p); return ok({ product: p });
  };
  Core.editProduct = function (st, id, d) {
    Core._pv++;
    const p = byId(st.products, id); if (!p) return err('کالا پیدا نشد.');
    const name = String(d.name || '').trim(); if (!name) return err('نام کالا را وارد کنید.');
    if (st.products.some(x => x.id !== id && x.name === name)) return err('کالایی با این نام وجود دارد.');
    const bc = String(d.barcode || '').trim(); if (bc && st.products.some(x => x.id !== id && x.barcode === bc)) return err('این بارکد برای کالای دیگری ثبت شده است.');
    Object.assign(p, { name, barcode: bc, sku: String(d.sku || '').trim(), unit: String(d.unit || 'عدد').trim() || 'عدد', minStock: Math.max(0, Number(d.minStock) || 0), salePrice: Math.max(0, Math.round(d.salePrice) || 0), buyPrice: Math.max(0, Math.round(d.buyPrice) || 0) });
    if (d.category !== undefined) { const cat = String(d.category || '').trim(); if (cat && cat !== Core.guessCategory(name)) p.category = cat; else delete p.category; }
    return ok();
  };
  /* ───────────── smart product categories ─────────────
   * A product's category is guessed from its name (rules below) unless the user picked one by hand (p.category).
   * The guess is computed on the fly, so better rules apply to every product automatically. */
  Core.norm = s => Core.toEn(String(s == null ? '' : s)).replace(/[يىئ]/g, 'ی').replace(/ك/g, 'ک').replace(/[ۀة]/g, 'ه').replace(/[أإآ]/g, 'ا').replace(/[‌‏‎_\-()\/،,+]/g, ' ').replace(/\s+/g, ' ').toLowerCase().trim();
  Core.OTHER_CAT = 'سایر لوازم جانبی';
  // [category, keywords, strength]  strength: 1 strong (wins even when it comes later in the name), 0 normal, -1 weak (only when nothing else matches)
  const CAT_RULES = [
    ['آیفون', 'آیفون|ایفون|iphone', -1],
    ['گوشی سامسونگ', 'سامسونگ|گلکسی|galaxy|samsung', -1],
    ['گوشی شیائومی', 'شیائومی|شیاومی|ردمی|پوکو|xiaomi|redmi|poco', -1],
    ['سایر گوشی‌ها', 'گوشی|موبایل|هواوی|انر|نوکیا|موتورولا|ریلمی|اوپو|وان پلاس|پیکسل|ویوو|تکنو|اینفینیکس|جی ال ایکس|huawei|honor|nokia|motorola|realme|oppo|oneplus|pixel|vivo|tecno|infinix|glx', -1],
    ['تبلت و آیپد', 'ایپد|ipad|تبلت|tablet|گلکسی تب|galaxy tab', 0],
    ['ساعت هوشمند', 'اپل واچ|ساعت هوشمند|ساعت|واچ|watch|مچ بند|بند ساعت', 0],
    ['هندزفری و هدفون', 'هندزفری|هندز فری|هدفون|هدست|ایرپاد|ایر پاد|ایربادز|ایرباد|ایرفون|airpods|airpod|earbuds|buds|headphone|headset|earphone|tws', 0],
    ['کابل شارژ و داده', 'کابل|cable|سیم شارژ', 0],
    ['شارژر فندکی', 'فندکی|شارژر ماشین|car charger', 1],
    ['شارژر وایرلس و مگ‌سیف', 'وایرلس|wireless|مگ سیف|مگسیف|magsafe|شارژر بی سیم|پد شارژ', 1],
    ['پاوربانک', 'پاوربانک|پاور بانک|power bank|powerbank|شارژر همراه', 1],
    ['آداپتور و شارژر', 'اداپتور|شارژر|کلگی|adapter|charger', 0],
    ['قاب و کاور', 'قاب|کاور|کیف|کیس|case|cover', 0],
    ['گلس و محافظ صفحه', 'گلس|محافظ صفحه|محافظ لنز|محافظ|glass|هیدروژل|screen protector', 0],
    ['اسپیکر و صوتی', 'اسپیکر|speaker|بلندگو|میکروفن|میکروفون|مایک', 0],
    ['هولدر و پایه', 'هولدر|پایه|نگهدارنده|holder|stand|استند|مونوپاد|سه پایه|پاپ سوکت', 0],
    ['مبدل، هاب و گیرنده', 'مبدل|تبدیل|هاب|otg|دانگل|گیرنده|hub|رابط', 0],
    ['حافظه و فلش', 'فلش مموری|فلش|مموری|کارت حافظه|رم|memory|flash|میکرو اس دی|micro sd|هارد|ssd', 0],
    ['قطعات و تعمیرات', 'ال سی دی|lcd|ال ای دی|oled|تاچ|باتری|battery|برد|فلت|سوکت|درب پشت|شیشه دوربین|هویه|پیچ گوشتی|ابزار', 0],
    [Core.OTHER_CAT, 'قلم|pencil|stylus|لوازم جانبی|جاکارتی|کیف پول|استرپ|بند موبایل|بند گوشی|تگ|ایرتگ|airtag', 0]
  ];
  const HEADS = new Set(['قاب', 'کاور', 'کیف', 'گلس', 'محافظ', 'هولدر', 'پایه', 'نگهدارنده', 'کابل', 'باتری', 'جاکارتی', 'کیس', 'تگ', 'هدفون', 'هندزفری', 'اسپیکر', 'مبدل', 'پاوربانک', 'فلش']);
  Core.CATS = CAT_RULES.map(r => r[0]);
  const catRx = CAT_RULES.map(([cat, kws, str]) => ({ cat, str, rx: kws.split('|').map(k => new RegExp('(^|\\s)' + Core.norm(k).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?=\\s|$)')) }));
  const STORAGE = /(^|\s)(\d+ ?(گیگ|گیگابایت|ترابایت|ترا|gb|tb)|گیگ|ترابایت)(\s|$)/;
  const guessCache = new Map();
  Core.guessCategory = function (name) {
    const n = Core.norm(name); if (!n) return Core.OTHER_CAT;
    if (guessCache.has(n)) return guessCache.get(n);
    let best = null, bestScore = Infinity;
    catRx.forEach((r, order) => {
      for (const rx of r.rx) {
        const m = rx.exec(n); if (!m) continue;
        const pos = m.index + m[1].length, word = n.slice(pos).split(' ')[0];
        if (order < 4 && pos > 0 && !STORAGE.test(n) && !/^(گوشی|موبایل) /.test(n)) continue; // a phone/brand word inside an accessory name ("تگ گوشی", "قاب سامسونگ") is not a phone
        let sc = pos + (r.str > 0 ? -1000 : r.str < 0 ? 1000 : 0);
        if (order === 3 && (word === 'گوشی' || word === 'موبایل')) sc += 500; // "گوشی سامسونگ …": the brand decides
        if (order < 4 && /^(گوشی|موبایل)( |$)/.test(n)) sc -= 3000; // name starts with «گوشی»: it is a phone
        if (pos === 0 && HEADS.has(word)) sc = -2000; // "قاب …", "کابل …": the first word decides
        sc += order / 100;
        if (sc < bestScore) { bestScore = sc; best = r.cat; }
      }
    });
    const c = best || Core.OTHER_CAT; if (guessCache.size > 20000) guessCache.clear(); guessCache.set(n, c); return c;
  };
  Core.catOf = p => (p.category && String(p.category).trim()) || Core.guessCategory(p.name);
  // categories in use, in the standard order, with counts
  Core.categoryCounts = function (st) {
    const m = new Map(); for (const p of st.products) { const c = Core.catOf(p); m.set(c, (m.get(c) || 0) + 1); }
    const rank = c => { const i = Core.CATS.indexOf(c); return i < 0 ? 900 : c === Core.OTHER_CAT ? 999 : i; };
    return [...m.entries()].map(([cat, n]) => ({ cat, n })).sort((a, b) => rank(a.cat) - rank(b.cat) || a.cat.localeCompare(b.cat, 'fa'));
  };
  Core.catRank = c => { const i = Core.CATS.indexOf(c); return c === Core.OTHER_CAT ? 999 : i < 0 ? 900 : i; };

  /* ───────────── insights (all computed from the data, cached per data version) ───────────── */
  const memo = (fn) => { let k = null, v = null; return (st, ...args) => { const key = [st.invoices, st.invoices.length, st.invoices[st.invoices.length - 1], st.adjusts, st.adjusts.length, st.products, st.products.length].concat(args); if (k && k.length === key.length && k.every((x, i) => x === key[i])) return v; k = key; v = fn(st, ...args); return v; }; };
  const invOrder = (a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id;
  // last price per (type, person, product) and how often each person bought each product
  const priceIndex = memo(st => {
    const last = new Map(), freq = new Map();
    st.invoices.slice().sort(invOrder).forEach(inv => inv.items.forEach(l => {
      last.set(inv.type + '|' + inv.personId + '|' + l.productId, { price: l.price, date: inv.date, no: inv.no });
      const fk = inv.type + '|' + inv.personId, m = freq.get(fk) || new Map(); m.set(l.productId, (m.get(l.productId) || 0) + 1); freq.set(fk, m);
    }));
    return { last, freq };
  });
  // the price this person last paid/got for this product on the same kind of invoice (sale ↔ sale, purchase ↔ purchase)
  Core.lastPrice = function (st, type, personId, productId) { if (!personId || !productId) return null; return priceIndex(st).last.get(type + '|' + personId + '|' + productId) || null; };
  Core.frequentProducts = function (st, type, personId, n) {
    const m = personId && priceIndex(st).freq.get(type + '|' + personId); if (!m) return [];
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n || 8).map(x => x[0]).filter(id => byId(st.products, id));
  };
  // sales speed per product over the last `days`, plus last sale / last incoming date
  const salesStats = memo((st, today, days) => {
    const from = Core.addDays(today, -days + 1), m = {};
    const g = id => m[id] || (m[id] = { sold: 0, lastSale: null, lastIn: null });
    st.invoices.forEach(inv => inv.items.forEach(l => {
      const x = g(l.productId);
      if (inv.type === 'sale') { if (inv.date >= from && inv.date <= today) x.sold += l.qty; if (!x.lastSale || inv.date > x.lastSale) x.lastSale = inv.date; }
      else if (inv.type === 'sale_return') { if (inv.date >= from && inv.date <= today) x.sold -= l.qty; }
      else if (inv.type === 'purchase') { if (!x.lastIn || inv.date > x.lastIn) x.lastIn = inv.date; }
    }));
    st.adjusts.forEach(a => { if (a.qty > 0) { const x = g(a.productId); if (!x.lastIn || a.date > x.lastIn) x.lastIn = a.date; } });
    return m;
  });
  // o: { days: window for sales speed, lead: days you need to restock, cover: days a purchase should last, stale: days without sale }
  Core.stockInsights = function (st, today, o) {
    o = Object.assign({ days: 60, lead: 7, cover: 30, stale: 60 }, o || {}); today = today || Core.todayISO();
    const ss = salesStats(st, today, o.days), rows = Core.productStats(st), reorder = [], stale = [];
    for (const x of rows) {
      const s = ss[x.product.id] || { sold: 0, lastSale: null, lastIn: null }, rate = Math.max(0, s.sold) / o.days;
      const autoMin = rate > 0 ? Math.max(1, Math.ceil(rate * o.lead)) : 0, min = x.product.minStock > 0 ? x.product.minStock : autoMin;
      const daysLeft = rate > 0 ? x.stock / rate : Infinity;
      x.rate = rate; x.autoMin = autoMin; x.min = min; x.daysLeft = daysLeft; x.lastSale = s.lastSale; x.lastIn = s.lastIn;
      if (rate > 0 && (x.stock <= min || daysLeft <= o.lead)) reorder.push(Object.assign(x, { suggest: Math.max(1, Math.ceil(rate * o.cover - Math.max(0, x.stock))) }));
      const idle = s.lastSale ? Core.diffDays(s.lastSale, today) : (s.lastIn ? Core.diffDays(s.lastIn, today) : 0);
      if (x.stock > 0 && idle >= o.stale && (!s.lastIn || Core.diffDays(s.lastIn, today) >= o.stale)) stale.push(Object.assign(x, { idle }));
    }
    reorder.sort((a, b) => a.daysLeft - b.daysLeft || b.rate - a.rate);
    stale.sort((a, b) => b.value - a.value);
    return { reorder, stale, staleValue: stale.reduce((t, x) => t + x.value, 0) };
  };
  // effective low-stock limit: the one the user set, otherwise ~a week of sales
  Core.autoMins = function (st, today) { const ss = salesStats(st, today || Core.todayISO(), 60), m = {}; for (const id in ss) { const r = Math.max(0, ss[id].sold) / 60; if (r > 0) m[id] = Math.max(1, Math.ceil(r * 7)); } return m; };
  Core.prevRange = function (from, to) { const n = Core.diffDays(from, to) + 1; return { from: Core.addDays(from, -n), to: Core.addDays(from, -1) }; };
  Core.pctChange = (now, before) => (before ? Math.round((now - before) / Math.abs(before) * 100) : (now ? null : 0));
  // revenue / cost / profit per product category (sales minus sale returns, VAT excluded)
  Core.categoryProfit = function (st, from, to) {
    const m = {};
    Core.replay(st, h => {
      if (!h.invoiceId || (from && h.date < from) || (to && h.date > to)) return;
      if (h.type !== 'sale' && h.type !== 'sale_return') return;
      const p = byId(st.products, h.productId), c = p ? Core.catOf(p) : '—', q = Math.abs(h.delta), sg = h.type === 'sale' ? 1 : -1;
      const x = m[c] || (m[c] = { cat: c, qty: 0, rev: 0, cost: 0 }); x.qty += sg * q; x.rev += sg * q * h.unit; x.cost += sg * q * h.avg;
    });
    return Object.values(m).map(x => ({ cat: x.cat, qty: r3(x.qty), rev: Math.round(x.rev), cost: Math.round(x.cost), profit: Math.round(x.rev - x.cost), margin: x.rev ? Math.round((x.rev - x.cost) / x.rev * 100) : 0 })).sort((a, b) => b.profit - a.profit);
  };
  // cost of each sale line (for the margin warning on the invoice form): the current average cost
  Core.unitCost = function (st, productId) { const s = Core.replay(st).stock[productId]; return s ? s.avg : 0; };

  /* ───────────── serial numbers / IMEI ───────────── */
  Core.luhnOk = function (d) { d = Core.toEn(d); if (!/^\d{15}$/.test(d)) return false; let s = 0; for (let i = 0; i < 15; i++) { let x = +d[14 - i]; if (i % 2) { x *= 2; if (x > 9) x -= 9; } s += x; } return s % 10 === 0; };
  // serial-like tokens in a note: 6–20 letters/digits with at least 4 digits (IMEI, S/N)
  Core.extractSerials = function (text) { const out = []; Core.toEn(String(text || '')).toUpperCase().split(/[^A-Z0-9]+/).forEach(t => { if (t.length >= 6 && t.length <= 20 && (t.match(/\d/g) || []).length >= 4 && out.indexOf(t) < 0) out.push(t); }); return out; };
  const serialIndex = memo(st => {
    const m = new Map();
    st.invoices.slice().sort(invOrder).forEach(inv => inv.items.forEach(l => {
      Core.extractSerials(l.note).forEach(sn => { const a = m.get(sn) || []; a.push({ serial: sn, date: inv.date, type: inv.type, invoiceId: inv.id, no: inv.no, personId: inv.personId, productId: l.productId, price: l.price }); m.set(sn, a); });
    }));
    return m;
  });
  Core.SERIAL_STATE = { purchase: 'در انبار', sale_return: 'در انبار (مرجوع از مشتری)', sale: 'فروخته شده', purchase_return: 'برگشت به تأمین‌کننده' };
  // q: whole serial, or its last 4+ digits
  Core.serialHistory = function (st, q, limit) {
    q = Core.toEn(String(q || '')).toUpperCase().replace(/[^A-Z0-9]/g, ''); if (q.length < 4) return [];
    const out = [];
    for (const [sn, ev] of serialIndex(st)) {
      if (!(sn === q || sn.endsWith(q) || (q.length >= 6 && sn.includes(q)))) continue;
      const last = ev[ev.length - 1]; let buy = null, sale = null;
      ev.forEach(e => { if (e.type === 'purchase') buy = e; if (e.type === 'sale') sale = e; });
      out.push({ serial: sn, events: ev, state: Core.SERIAL_STATE[last.type], inStock: last.type === 'purchase' || last.type === 'sale_return', productId: last.productId, profit: buy && sale && sale.date >= buy.date ? sale.price - buy.price : null, luhn: sn.length === 15 && /^\d+$/.test(sn) ? Core.luhnOk(sn) : null });
      if (out.length >= (limit || 50)) break;
    }
    return out.sort((a, b) => (a.serial === q ? -1 : 0) - (b.serial === q ? -1 : 0));
  };
  // warning for a serial typed on an invoice line (excluding the invoice being edited)
  Core.serialWarning = function (st, serial, type, editId) {
    const ev = (serialIndex(st).get(serial) || []).filter(e => e.invoiceId !== editId); if (!ev.length) return null;
    const last = ev[ev.length - 1], who = (byId(st.people, last.personId) || {}).name || '—', where = ' (فاکتور ' + Core.TYPE_FA[last.type] + ' ' + last.no + '، ' + who + '، ' + Core.fmtDate(last.date) + ')';
    if (type === 'sale' && last.type === 'sale') return 'سریال ' + serial + ' قبلاً فروخته شده است' + where + '.';
    if (type === 'purchase' && (last.type === 'purchase' || last.type === 'sale_return')) return 'سریال ' + serial + ' همین الان در انبار است' + where + '.';
    if (type === 'sale_return' && last.type !== 'sale') return 'سریال ' + serial + ' فروخته نشده که مرجوع شود' + where + '.';
    return null;
  };

  /* ───────────── smart search helpers ───────────── */
  const FINGLISH = { iphone: 'ایفون', ifon: 'ایفون', aifon: 'ایفون', apple: 'اپل', samsung: 'سامسونگ', galaxy: 'گلکسی', xiaomi: 'شیائومی', redmi: 'ردمی', poco: 'پوکو', pro: 'پرو', max: 'مکس', plus: 'پلاس', mini: 'مینی', ultra: 'الترا', cable: 'کابل', kabl: 'کابل', charger: 'شارژر', sharjer: 'شارژر', adapter: 'اداپتور', case: 'قاب', ghab: 'قاب', cover: 'کاور', glass: 'گلس', airpods: 'ایرپاد', airpod: 'ایرپاد', watch: 'واچ', ipad: 'ایپد', gig: 'گیگ', gb: 'گیگ', tb: 'ترابایت', powerbank: 'پاوربانک', holder: 'هولدر', speaker: 'اسپیکر', handsfree: 'هندزفری', headphone: 'هدفون', magsafe: 'مگ سیف', mcdodo: 'مک دودو', anker: 'انکر', lightning: 'لایتنینگ' };
  Core.ALIASES = { 'ایرپاد': 'airpods', 'ایفون': 'iphone', 'اولترا': 'الترا', 'الترا': 'اولترا', 'تایپ سی': 'c', 'شارژ': 'شارژر' };
  // query → normalised words; letters/digits split ("iphone13" → "iphone 13"); Finglish words also get their Persian form
  Core.searchWords = function (q) {
    const n = Core.norm(q).replace(/([a-z])(\d)/g, '$1 $2').replace(/(\d)([a-z])/g, '$1 $2').replace(/([؀-ۿ])(\d)/g, '$1 $2').replace(/(\d)([؀-ۿ])/g, '$1 $2');
    return n.split(' ').filter(Boolean).map(w => [w].concat(FINGLISH[w] ? [FINGLISH[w]] : [], Core.ALIASES[w] ? [Core.ALIASES[w]] : []));
  };
  const lev1 = (a, b, max) => { if (Math.abs(a.length - b.length) > max) return false; const d = []; for (let i = 0; i <= a.length; i++) { d[i] = [i]; } for (let j = 1; j <= b.length; j++) d[0][j] = j; for (let i = 1; i <= a.length; i++) { let rowMin = Infinity; for (let j = 1; j <= b.length; j++) { d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); rowMin = Math.min(rowMin, d[i][j]); } if (rowMin > max) return false; } return d[a.length][b.length] <= max; };
  const normCache = new Map();
  // 0 = no match; higher = better. Every query word must match a word of the text (prefix, inside, or a small typo)
  Core.fuzzyScore = function (text, words) {
    if (!words.length) return 0; let c = normCache.get(text); if (!c) { if (normCache.size > 60000) normCache.clear(); const t0 = Core.norm(text); c = [t0, t0.split(' ')]; normCache.set(text, c); } const t = c[0], tw = c[1]; let score = 0;
    for (const alts of words) {
      let best = 0;
      for (const w of alts) {
        for (const x of tw) {
          if (x === w) best = Math.max(best, 4); else if (x.startsWith(w)) best = Math.max(best, 3); else if (w.length >= 3 && x.includes(w)) best = Math.max(best, 2);
          else if (w.length >= 4 && !/^\d+$/.test(w) && lev1(w, x.slice(0, w.length + 1), w.length >= 7 ? 2 : 1)) best = Math.max(best, 1);
        }
        if (best < 2 && w.length >= 3 && t.includes(w)) best = Math.max(best, 2);
      }
      if (!best) return 0; score += best;
    }
    return score + (words[0].some(w => t.startsWith(w)) ? 1 : 0);
  };

  /* ───────────── smart search engine ─────────────
   * Understands short Persian questions ("چند تا کابل دارم", "قیمت آیفون ۱۳", "علی چقدر بدهکاره", "فروش آیفون این ماه"),
   * Finglish, typos, synonyms (لایتنینگ = Li, تایپ سی = C), number+unit ("1 متر" ≠ "1.2 متر") and ranks by how rare the
   * matched words are (a model code like CA-2261 weighs more than "کابل"). */
  const UNITS = { 'متر': 'متر', 'متری': 'متر', 'm': 'متر', 'سانت': 'سانت', 'سانتی متر': 'سانت', 'cm': 'سانت', 'وات': 'وات', 'w': 'وات', 'گیگ': 'گیگ', 'گیگابایت': 'گیگ', 'gb': 'گیگ', 'g': 'گیگ', 'ترابایت': 'ترا', 'ترا': 'ترا', 'tb': 'ترا', 'امپر': 'امپر', 'a': 'امپر', 'میلی امپر': 'mah', 'mah': 'mah', 'اینچ': 'اینچ', 'inch': 'اینچ', 'پورت': 'پورت', 'کاره': 'کاره' };
  const UNIT_RX = new RegExp('(^|\\s)(\\d+(?:\\.\\d+)?)\\s?(' + Object.keys(UNITS).sort((a, b) => b.length - a.length).join('|') + ')(?=\\s|$)', 'g');
  const PHRASES = [['تایپ سی', 'c'], ['تایپسی', 'c'], ['سی به', 'c به'], ['به سی', 'به c'], ['type c', 'c'], ['typec', 'c'], ['یو اس بی', 'usb'], ['یواس بی', 'usb'], ['پاور بانک', 'پاوربانک'], ['power bank', 'پاوربانک'], ['هندز فری', 'هندزفری'], ['ایر پاد', 'ایرپاد'], ['مگ سیف', 'مگسیف'], ['اپل واچ', 'واچ'], ['ای پد', 'ایپد'], ['مک دودو', 'مکدودو'], ['بی سیم', 'بیسیم'], ['چند تا', 'چندتا'], ['تمام شده', 'تمامشده'], ['این ماه', 'اینماه'], ['ماه قبل', 'ماهقبل'], ['ماه پیش', 'ماهقبل'], ['هفته قبل', 'هفتهقبل'], ['هفته پیش', 'هفتهقبل'], ['این هفته', 'اینهفته'], ['کم دارم', 'کمبود'], ['فروش نرفته', 'نفروخته']];
  const SYN = { lightning: 'li', 'لایتنینگ': 'li', 'لایتنینگی': 'li', 'ایفونی': 'li', 'میکرو': 'micro', 'iphone': 'ایفون', 'ifon': 'ایفون', 'aifon': 'ایفون', 'samsung': 'سامسونگ', 'galaxy': 'گلکسی', 'xiaomi': 'شیائومی', 'شیاومی': 'شیائومی', 'redmi': 'ردمی', 'poco': 'پوکو', 'pro': 'پرو', 'max': 'مکس', 'plus': 'پلاس', 'mini': 'مینی', 'ultra': 'اولترا', 'الترا': 'اولترا', 'cable': 'کابل', 'kabl': 'کابل', 'وایرلس': 'بیسیم', 'wireless': 'بیسیم', 'case': 'قاب', 'cover': 'قاب', 'کاور': 'قاب', 'کیس': 'قاب', 'ghab': 'قاب', 'glass': 'گلس', 'شارژر': 'شارژ', 'اداپتور': 'شارژ', 'کلگی': 'شارژ', 'charger': 'شارژ', 'adapter': 'شارژ', 'sharjer': 'شارژ', 'handsfree': 'هندزفری', 'headphone': 'هدفون', 'هدست': 'هدفون', 'airpods': 'ایرپاد', 'airpod': 'ایرپاد', 'ایربادز': 'ایرپاد', 'powerbank': 'پاوربانک', 'magsafe': 'مگسیف', 'apple': 'اپل', 'watch': 'واچ', 'ipad': 'ایپد', 'آیپد': 'ایپد', 'speaker': 'اسپیکر', 'holder': 'هولدر', 'mcdodo': 'مکدودو', 'white': 'سفید', 'black': 'مشکی', 'سیاه': 'مشکی', 'یواسبی': 'usb', 'تایپسی': 'c' };
  const STOP = new Set(['چند', 'چندتا', 'چقدر', 'چنده', 'دارم', 'داریم', 'داره', 'دارد', 'هست', 'است', 'هستن', 'کو', 'کجاست', 'لطفا', 'نشون', 'نشان', 'بده', 'بگو', 'ببینم', 'کدوم', 'کدام', 'چی', 'چه', 'همه', 'لیست', 'فهرست', 'ها', 'های', 'رو', 'را', 'از', 'برای', 'با', 'و', 'یه', 'در', 'به', 'تو', 'من', 'مون', 'ام', 'شده', 'اند', 'میخوام', 'می', 'خواهم', 'کن', 'بیار', 'اون', 'این', 'عدد', 'تومن', 'تومان', 'ریال', 'کجا', 'چطور', 'کالا', 'کالاها', 'کالاهای', 'جنس', 'اجناس', 'محصول', 'محصولات', 'مشتری', 'مشتریان', 'شخص', 'اقای', 'اقا', 'خانم', 'اخرین', 'جدید', 'جدیدترین', 'لطفاً', 'باید', 'بدم', 'بدیم', 'کنم', 'کنیم', 'کالاهایی', 'چیزهایی', 'چیا', 'چیه', 'کدومها', 'هایی', 'ای', 'بیشتر', 'کمتر', 'تایپ']);
  const INTENT = {
    stock: ['موجودی', 'موجود', 'انبار', 'مونده', 'باقی', 'تعداد', 'چندتا'], out: ['ناموجود', 'تمامشده', 'تموم', 'تمام', 'نداریم', 'صفر'], price: ['قیمت', 'نرخ', 'فی', 'چنده'],
    balance: ['طلب', 'طلبکار', 'طلبکاره', 'طلبکارها', 'بدهی', 'بدهکار', 'بدهکاره', 'بدهکارها', 'بستانکار', 'بستانکارها', 'مانده', 'حساب', 'بدهیها'],
    invoice: ['فاکتور', 'فاکتورهای', 'فاکتورها', 'خریدهای', 'فروشهای', 'خریدها', 'فروشها'], metric: ['فروش', 'سود', 'درآمد', 'خرید', 'هزینه', 'هزینهها', 'دریافت', 'پرداخت', 'گزارش', 'خلاصه'],
    top: ['پرفروش', 'پرفروشترین', 'بیشترین', 'پرفروشها'], reorder: ['سفارش', 'کمبود', 'کسری'], stale: ['راکد', 'نفروخته', 'خوابیده'], cheque: ['چک', 'چکها', 'سررسید', 'قسط', 'اقساط'],
    period: { 'امروز': 'today', 'دیروز': 'yesterday', 'هفته': 'week', 'اینهفته': 'week', 'هفتهقبل': 'prevweek', 'اینماه': 'mtd', 'ماه': 'mtd', 'ماهقبل': 'prevmonth', 'امسال': 'fytd', 'سال': 'fytd' }
  };
  Core.sTokens = function (text) {
    let s = ' ' + Core.norm(text).replace(/([a-z])(\d)/g, '$1 $2').replace(/(\d)([a-z])/g, '$1 $2').replace(/([؀-ۿ])(\d)/g, '$1 $2').replace(/(\d)([؀-ۿ])/g, '$1 $2') + ' ';
    for (const [a, b] of PHRASES) s = s.split(' ' + a + ' ').join(' ' + b + ' ');
    s = s.replace(/(^|\s)(\d+(?:\.\d+)?)\s(هزار|هزارتایی)(?=\s|$)/g, (m, sp, n) => sp + Math.round(parseFloat(n) * 1000));
    s = s.replace(UNIT_RX, (m, sp, n, u) => sp + n + UNITS[u]);
    return s.trim().split(' ').filter(Boolean).map(t => SYN[t] || t);
  };
  const isNumTok = t => /^\d/.test(t);
  const ACC_HEADS = new Set(['قاب', 'گلس', 'محافظ', 'کابل', 'شارژ', 'هولدر', 'پایه', 'نگهدارنده', 'باتری', 'بند', 'کیف', 'جاکارتی', 'مبدل', 'پاپ']);
  function editLe(a, b, max) { if (Math.abs(a.length - b.length) > max) return false; let prev = Array.from({ length: b.length + 1 }, (_, j) => j); for (let i = 1; i <= a.length; i++) { const cur = [i]; let mn = i; for (let j = 1; j <= b.length; j++) { cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); if (cur[j] < mn) mn = cur[j]; } if (mn > max) return false; prev = cur; } return prev[b.length] <= max; }
  // how well one query word matches one indexed word (0..1)
  function tokMatch(q, t) {
    if (q === t) return 1;
    if (/^\d+(\.\d+)?$/.test(q) && t.startsWith(q) && /^[^\d.]/.test(t.slice(q.length))) return 0.9; // "256" → "256گیگ"
    if (isNumTok(q) || isNumTok(t)) { if (/^\d+$/.test(q) && q.length >= 3 && /^\d+$/.test(t) && t.startsWith(q)) return 0.6; return 0; }
    if (q.length >= 2 && t.startsWith(q)) return q.length >= 3 ? 0.8 : 0.55;
    if (t.length >= 3 && q.startsWith(t) && q.length - t.length <= 3) return 0.6; // "کابلهای" → "کابل"
    if (q.length >= 3 && t.includes(q)) return 0.45;
    if (q.length >= 4 && editLe(q, t.slice(0, q.length + 2), q.length >= 7 ? 2 : 1)) return 0.42;
    return 0;
  }
  // index over products / people, rebuilt only when the data changes
  Core._pv = 0; // bumped when a product or person is edited in place
  let sixKey = null, sixVal = null;
  const searchIndex = st => { const k = [st.products, st.products.length, st.people, st.people.length, Core._pv]; if (sixKey && k.every((x, i) => x === sixKey[i])) return sixVal; sixKey = k; sixVal = buildIndex(st); return sixVal; };
  const buildIndex = (st => {
    const df = new Map(), add = toks => new Set(toks).forEach(t => df.set(t, (df.get(t) || 0) + 1));
    const prods = st.products.map(p => { const cat = Core.catOf(p), toks = Core.sTokens(p.name + ' ' + (p.sku || '') + ' ' + (p.barcode || '')), ctoks = Core.sTokens(cat); add(toks.concat(ctoks)); return { p, cat, toks, ctoks, str: ' ' + toks.join(' ') + ' ' }; });
    const people = st.people.map(p => { const toks = Core.sTokens(p.name + ' ' + (p.note || '')); add(toks); return { p, toks, phone: Core.toEn(p.phone || '').replace(/\D/g, ''), str: ' ' + toks.join(' ') + ' ' }; });
    const vocab = [...df.keys()].filter(t => t.length >= 3 && !isNumTok(t));
    return { df, n: Math.max(1, prods.length + people.length), prods, people, vocab };
  });
  const idf = (ix, t) => Math.log(1 + ix.n / (ix.df.get(t) || 1));
  // close meanings, used at a lower weight: «شارژر آیفون» also finds «… اپل»
  const ALT = { 'ایفون': ['اپل', 'li'], 'اپل': ['ایفون'], 'سامسونگ': ['گلکسی'], 'گلکسی': ['سامسونگ'], 'li': ['ایفون'], 'ایرپاد': ['هندزفری'], 'هندزفری': ['ایرپاد', 'هدفون'], 'هدفون': ['هندزفری'], 'شارژ': ['کابل'] };
  function scoreDoc(ix, terms, toks, extra, alt) {
    let sc = 0, hit = 0; const all = extra ? toks.concat(extra) : toks, nt = toks.length;
    for (const q of terms) { let best = 0; for (let i = 0; i < all.length; i++) { const t = all[i], m = tokMatch(q, t); if (m) { const v = m * idf(ix, t) * (i < nt ? 1 : 0.6); if (v > best) best = v; } }
      if (!best && alt && ALT[q]) for (const a of ALT[q]) for (const t of all) if (t === a) { const v = 0.55 * idf(ix, t); if (v > best) best = v; }
      if (best) { hit++; sc += best; } }
    return { sc, hit };
  }
  function rankProducts(st, ix, terms, qcats, stockOf, alt) {
    if (!terms.length) return { full: [], partial: [] };
    const phrase = ' ' + terms.join(' ') + ' ', full = [], partial = [];
    for (const d of ix.prods) {
      const r = scoreDoc(ix, terms, d.toks, d.ctoks, alt); if (!r.hit) continue;
      let sc = r.sc;
      if (terms.length > 1 && d.str.includes(phrase)) sc += 1.5;
      if (qcats.size && !qcats.has(d.cat)) sc -= ACC_HEADS.has(d.toks[0]) ? 1.6 : 1; // «قاب سامسونگ A15» when the question was the phone itself
      if (d.toks[0] === terms[0]) sc += 0.6;
      if (qcats.has(d.cat)) sc += 1.8;
      if (stockOf(d.p.id) > 0) sc += 0.35;
      sc -= d.toks.length * 0.02;
      (r.hit === terms.length ? full : partial).push({ p: d.p, cat: d.cat, sc, hit: r.hit });
    }
    const by = (a, b) => b.sc - a.sc || faCmpCore(a.p.name, b.p.name);
    return { full: full.sort(by), partial: partial.filter(x => x.hit >= Math.ceil(terms.length / 2)).sort((a, b) => b.hit - a.hit || by(a, b)) };
  }
  const collator = typeof Intl !== 'undefined' && Intl.Collator ? new Intl.Collator('fa', { numeric: true }) : null;
  const faCmpCore = (a, b) => (collator ? collator.compare(a, b) : String(a).localeCompare(String(b)));
  function rankPeople(ix, terms, digits) {
    const out = [];
    for (const d of ix.people) {
      let sc = 0, hit = 0;
      if (digits && digits.length >= 3 && d.phone && (d.phone.includes(digits) || d.phone.includes(digits.replace(/^(0098|98)/, '0')))) { sc += 5; hit = Math.max(1, terms.length); }
      else { const r = scoreDoc(ix, terms, d.toks); sc = r.sc; hit = r.hit; if (terms.length > 1 && d.str.includes(' ' + terms.join(' ') + ' ')) sc += 2; if (d.toks[0] === terms[0]) sc += 0.5; }
      if (hit && hit >= terms.length) out.push({ p: d.p, sc });
    }
    return out.sort((a, b) => b.sc - a.sc || faCmpCore(a.p.name, b.p.name));
  }
  // the categories a query word points at ("کابل" → cables, "شارژر" → chargers)
  const CANON_CAT = { 'شارژ': 'آداپتور و شارژر', 'قاب': 'قاب و کاور', 'گلس': 'گلس و محافظ صفحه', 'هندزفری': 'هندزفری و هدفون', 'هدفون': 'هندزفری و هدفون', 'ایرپاد': 'هندزفری و هدفون', 'مگسیف': 'شارژر وایرلس و مگ‌سیف', 'واچ': 'ساعت هوشمند', 'ایپد': 'تبلت و آیپد' };
  function queryCats(terms) { const s = new Set(); if (terms.includes('کابل')) { s.add('کابل شارژ و داده'); return s; } terms.forEach(t => { if (CANON_CAT[t]) { s.add(CANON_CAT[t]); return; } if (t.length < 2 || isNumTok(t)) return; const c = Core.guessCategory(t); if (c !== Core.OTHER_CAT || /قلم|لوازم/.test(t)) s.add(c); }); return s; }
  function didYouMean(ix, terms) { let changed = false; const out = terms.map(t => { if (isNumTok(t) || t.length < 3 || ix.df.has(t) || ix.vocab.some(v => v.startsWith(t))) return t; let best = null, bd = 9; for (const v of ix.vocab) { if (Math.abs(v.length - t.length) > 2) continue; for (let k = 1; k <= 2; k++) if (k < bd && editLe(t, v, k)) { bd = k; best = v; break; } } if (best) { changed = true; return best; } return t; }); return changed ? out.join(' ') : null; }

  // smart match for list filters (pickers, product/people lists): every query word must match; returns a score (0 = no match)
  const mtCache = new Map();
  Core.matchScore = function (text, q) {
    const qt = Core.sTokens(q).filter(t => !STOP.has(t)); if (!qt.length) return 1;
    let tt = mtCache.get(text); if (!tt) { if (mtCache.size > 50000) mtCache.clear(); tt = Core.sTokens(text); mtCache.set(text, tt); }
    let sc = 0;
    for (const x of qt) { let b = 0; for (const t of tt) { const m = tokMatch(x, t); if (m > b) b = m; } if (!b && ALT[x]) for (const a of ALT[x]) if (tt.includes(a)) b = 0.5; if (!b) return 0; sc += b; }
    return sc + (tt[0] === qt[0] ? 0.5 : 0);
  };
  const PRETTY = { li: 'لایتنینگ', c: 'C', 'ایفون': 'آیفون', 'ایپد': 'آیپد', 'شارژ': 'شارژر', 'اداپتور': 'آداپتور', 'ایرپاد': 'ایرپاد', 'مگسیف': 'مگ‌سیف', 'مکدودو': 'مک‌دودو', 'بیسیم': 'بی‌سیم', 'امپر': 'آمپر' };
  Core.prettyTerms = terms => terms.map(t => PRETTY[t] || t.replace(/^(\d+(?:\.\d+)?)(\D+)$/, (m, n, u) => n + ' ' + (u === 'امپر' ? 'آمپر' : u))).join(' ');
  Core.search = function (st, q, o) {
    o = o || {}; const today = o.today || Core.todayISO();
    const res = { q, intent: null, terms: [], products: [], partial: false, people: [], cats: [], invoices: [], tx: [], serials: [], answer: null, suggestion: null };
    const raw = Core.toEn(String(q || '')).trim(); if (!raw) return res;
    const ix = searchIndex(st), rp = Core.replay(st), stockOf = id => { const s = rp.stock[id]; return s ? s.stock : 0; };
    const digits = raw.replace(/[\s\-+]/g, '');
    // ── pure numbers: IMEI / serial tail, phone, invoice number, amount, barcode ──
    if (/^\d{3,}$/.test(digits)) {
      res.intent = 'number';
      if (digits.length >= 4) res.serials = Core.serialHistory(st, digits, 10);
      if (/^(0098|98|0)?9\d{1,9}$/.test(digits)) res.people = rankPeople(ix, [], digits).slice(0, 10).map(x => x.p);
      if (digits.length <= 7) res.invoices = st.invoices.filter(i => Core.toEn(i.no) === digits);
      if (digits.length >= 4) { const amt = Core.parseMoney(digits); if (amt) { st.invoices.forEach(i => { if (Core.invoiceTotals(i).total === amt && !res.invoices.includes(i)) res.invoices.push(i); }); res.tx = st.tx.filter(t => t.amount === amt && t.type !== 'invoice').slice(-10); } }
      res.products = st.products.filter(p => (p.barcode && Core.toEn(p.barcode).includes(digits)) || (p.sku && Core.toEn(p.sku).replace(/\D/g, '') === digits)).slice(0, 10).map(p => ({ p, cat: Core.catOf(p), stock: stockOf(p.id) }));
      return res;
    }
    // ── words: intent + terms ──
    const toks = Core.sTokens(raw), has = list => toks.some(t => list.includes(t));
    const periodTok = toks.find(t => INTENT.period[t]), period = periodTok ? INTENT.period[periodTok] : null;
    const intentWords = new Set([].concat(INTENT.stock, INTENT.out, INTENT.price, INTENT.balance, INTENT.invoice, INTENT.metric, INTENT.top, INTENT.reorder, INTENT.stale, INTENT.cheque, Object.keys(INTENT.period), ['سریال', 'imei', 'ایمی']));
    const terms = [];
    toks.filter(t => !STOP.has(t) && !intentWords.has(t)).forEach(t => {
      if (t.length >= 5 && !isNumTok(t) && !ix.df.has(t) && !ix.vocab.some(v => v.startsWith(t))) { for (let k = 2; k <= t.length - 2; k++) { const a = t.slice(0, k), b = t.slice(k); if (ix.df.has(a) && ix.df.has(b)) { terms.push(a, b); return; } } }
      terms.push(t);
    });
    res.terms = terms;
    if (/^(سریال|imei|ایمی)\b/i.test(raw) || (/[a-z]/i.test(raw) && /\d{4,}/.test(raw) && raw.replace(/\s/g, '').length >= 8)) { const sn = raw.replace(/^(سریال|imei|ایمی)\s*/i, ''); res.serials = Core.serialHistory(st, sn, 20); if (res.serials.length) { res.intent = 'serial'; return res; } }
    const qcats = queryCats(terms); let pr = rankProducts(st, ix, terms, qcats, stockOf); if (!pr.full.length) { const p2 = rankProducts(st, ix, terms, qcats, stockOf, true); if (p2.full.length) pr = p2; }
    let prods = pr.full; if (!prods.length && pr.partial.length) { prods = pr.partial; res.partial = true; }
    const ppl = terms.length ? rankPeople(ix, terms) : [];
    const rg = period ? Core.periodRange(period, today, o.fyMonth || 1) : null;
    const decorate = list => list.map(x => Object.assign(x, { stock: stockOf(x.p.id), avg: rp.stock[x.p.id] ? Math.round(rp.stock[x.p.id].avg) : 0 }));
    if (has(INTENT.balance)) {
      res.intent = 'balance'; const bal = Core.balances(st);
      const list = ppl.length ? ppl.map(x => x.p) : st.people.slice().filter(p => (has(['طلبکار', 'طلبکاره', 'طلبکارها', 'بستانکار', 'بستانکارها']) ? bal[p.id] < 0 : bal[p.id] > 0)).sort((a, b) => Math.abs(bal[b.id] || 0) - Math.abs(bal[a.id] || 0));
      res.answer = { kind: 'balance', rows: list.slice(0, 20).map(p => ({ p, b: bal[p.id] || 0 })), total: list.length };
      return res;
    }
    if (has(INTENT.cheque)) { res.intent = 'cheque'; const open = st.cheques.filter(c => !c.done).sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1)); res.answer = { kind: 'cheque', rows: (ppl.length ? open.filter(c => ppl.some(x => x.p.id === c.personId)) : open).filter(c => !rg || (c.dueDate >= rg.from && c.dueDate <= rg.to)).slice(0, 30) }; return res; }
    if (has(INTENT.reorder) && (!terms.length || !prods.length)) { res.intent = 'reorder'; res.answer = { kind: 'reorder', rows: Core.stockInsights(st, today).reorder.slice(0, 30) }; return res; }
    if (has(INTENT.stale) && (!terms.length || !prods.length)) { res.intent = 'stale'; res.answer = { kind: 'stale', rows: Core.stockInsights(st, today).stale.slice(0, 30) }; return res; }
    if (has(INTENT.top)) { res.intent = 'top'; const r2 = rg || Core.periodRange('mtd', today); res.answer = { kind: 'top', label: periodTok || 'اینماه', rows: Core.topProducts(st, r2.from, r2.to, 15).filter(x => x.product && (!terms.length || prods.some(y => y.p.id === x.product.id))) }; return res; }
    if (has(INTENT.invoice) || (has(['خرید', 'فروش']) && !period && (ppl.length || prods.length) && terms.length) || (has(['خرید', 'فروش']) && period && terms.length && ppl.length && (!prods.length || ppl[0].sc >= prods[0].sc))) {
      res.intent = 'invoices'; const type = has(['خریدهای', 'خریدها', 'خرید']) ? 'purchase' : has(['فروشهای', 'فروشها', 'فروش']) ? 'sale' : null;
      const pid = new Set(ppl.slice(0, 3).map(x => x.p.id)), prid = new Set(prods.slice(0, 30).map(x => x.p.id));
      let list = st.invoices.filter(i => (!type || i.type === type) && (!rg || (i.date >= rg.from && i.date <= rg.to)));
      const no = terms.find(t => /^\d+$/.test(t)); if (no && !pid.size && !prid.size) list = list.filter(i => Core.toEn(i.no) === no);
      else if (pid.size && (!prid.size || ppl[0].sc >= (prods[0] ? prods[0].sc : 0))) list = list.filter(i => pid.has(i.personId)); else if (prid.size) list = list.filter(i => i.items.some(l => prid.has(l.productId)));
      res.invoices = list.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id)).slice(0, 30);
      res.people = ppl.slice(0, 3).map(x => x.p); res.invType = type;
      return res;
    }
    if (period && (has(INTENT.metric) || !terms.length)) {
      res.intent = 'report'; const r = Core.report(st, rg.from, rg.to);
      const ans = { kind: 'report', label: periodTok, k: period, rg, r, n: st.invoices.filter(i => i.type === 'sale' && i.date >= rg.from && i.date <= rg.to).length };
      if (terms.length && prods.length) { // sales of these products in the period
        const ids = new Set(prods.map(x => x.p.id)); let qty = 0, rev = 0;
        st.invoices.forEach(i => { if (i.date < rg.from || i.date > rg.to || (i.type !== 'sale' && i.type !== 'sale_return')) return; const sg = i.type === 'sale' ? 1 : -1; Core.invoiceTotals(i).lines.forEach(l => { if (ids.has(l.productId)) { qty += sg * l.qty; rev += sg * l.net; } }); });
        ans.items = { qty: r3(qty), rev: Math.round(rev), count: ids.size };
      }
      res.answer = ans; res.products = decorate(prods.slice(0, 10)); return res;
    }
    if ((has(INTENT.stock) || has(INTENT.out)) && !terms.length) {
      res.intent = 'stock'; const out = has(INTENT.out); let list = st.products.map(p => ({ p, cat: Core.catOf(p), sc: 0, stock: stockOf(p.id), avg: rp.stock[p.id] ? Math.round(rp.stock[p.id].avg) : 0 })).filter(x => (out ? x.stock <= 0 : x.stock > 0));
      list.sort((a, b) => (out ? faCmpCore(a.p.name, b.p.name) : b.stock - a.stock)); res.products = list;
      res.answer = { kind: 'stock', total: list.length, inStock: out ? 0 : list.length, qty: out ? 0 : r3(list.reduce((t, x) => t + x.stock, 0)), out, all: true }; return res;
    }
    if ((has(INTENT.stock) || has(INTENT.out) || has(INTENT.price)) && terms.length) {
      res.intent = has(INTENT.price) ? 'price' : 'stock';
      let list = decorate(prods);
      if (has(INTENT.out)) list = list.filter(x => x.stock <= 0); else if (res.intent === 'stock' && has(['موجود', 'موجودی']) && list.some(x => x.stock > 0) && has(['موجود'])) list = list.filter(x => x.stock > 0);
      if (res.intent === 'stock') list.sort((a, b) => (b.stock > 0) - (a.stock > 0) || (b.stock - a.stock) || b.sc - a.sc);
      const inStock = list.filter(x => x.stock > 0);
      res.answer = { kind: res.intent, total: list.length, inStock: inStock.length, qty: r3(inStock.reduce((t, x) => t + x.stock, 0)), out: has(INTENT.out) };
      res.products = list; if (!list.length) res.suggestion = didYouMean(ix, terms); return res;
    }
    // ── plain search ──
    res.intent = 'find';
    res.products = decorate(prods); res.people = ppl.slice(0, 10).map(x => x.p);
    const cc = Core.categoryCounts(st); res.cats = cc.filter(c => qcats.has(c.cat) || (terms.length && terms.every(t => Core.sTokens(c.cat).some(x => tokMatch(t, x) >= 0.55))));
    if (raw.length >= 3) st.invoices.forEach(i => { if (res.invoices.length < 10 && ((i.note && terms.every(t => Core.sTokens(i.note).some(x => tokMatch(t, x) >= 0.55))) || i.items.some(l => l.note && terms.every(t => Core.sTokens(l.note).some(x => tokMatch(t, x) >= 0.55))))) res.invoices.push(i); });
    if (!res.products.length && !res.people.length && !res.cats.length && !res.invoices.length) res.suggestion = didYouMean(ix, terms);
    return res;
  };

  /* products backup (export / import), for moving or rebuilding the warehouse */
  Core.exportProducts = function (st) {
    const rp = Core.replay(st);
    const products = st.products.map(p => { const s = rp.stock[p.id] || { stock: 0, avg: 0 }; return { name: p.name, category: Core.catOf(p), catManual: !!p.category, sku: p.sku || '', barcode: p.barcode || '', unit: p.unit, salePrice: p.salePrice, buyPrice: p.buyPrice, minStock: p.minStock, stock: Math.max(0, s.stock), avg: Math.round(s.avg) }; });
    return JSON.stringify({ app: 'fixquick-products', version: 1, exportedAt: new Date().toISOString(), products });
  };
  // accepts the products backup (JSON), a full app backup, or plain text with one product name per line
  Core.parseProducts = function (text) {
    text = String(text || '').replace(/^﻿/, '');
    let o = null; try { o = JSON.parse(text); } catch (e) { o = null; }
    const num = v => { const n = Core.parseNum(v); return isFinite(n) && n > 0 ? n : 0; };
    if (o && typeof o === 'object') {
      let list = null, full = null;
      if (o.app === 'fixquick-products' && Array.isArray(o.products)) list = o.products;
      else if (o.app === 'fixquick-accounting' && o.data && Array.isArray(o.data.products)) { full = o.data; list = o.data.products; }
      else return err('این فایل، پشتیبان کالاهای این برنامه نیست.');
      if (full) { const rp = Core.replay(Object.assign(Core.emptyState(), full)); list = list.map(p => { const s = rp.stock[p.id] || { stock: 0, avg: 0 }; return Object.assign({}, p, { catManual: !!p.category, stock: Math.max(0, s.stock), avg: Math.round(s.avg) }); }); }
      const items = list.filter(p => p && String(p.name || '').trim()).map(p => ({ name: String(p.name).trim(), category: p.catManual ? String(p.category || '').trim() : '', sku: String(p.sku || ''), barcode: String(p.barcode || ''), unit: String(p.unit || 'عدد'), salePrice: Math.round(num(p.salePrice)), buyPrice: Math.round(num(p.buyPrice)), minStock: num(p.minStock), stock: Math.round(num(p.stock) * 1000) / 1000, avg: Math.round(num(p.avg)) }));
      return ok({ items });
    }
    const items = Array.from(new Set(text.split(/\r?\n/).map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean))).map(name => ({ name }));
    if (!items.length) return err('فایل خالی است.');
    return ok({ items });
  };
  // adds products that don't exist yet (same name = skipped); stock comes in as opening stock at its average cost
  Core.importProducts = function (st, items, o) {
    o = o || {}; const names = new Set(st.products.map(p => p.name)), codes = new Set(st.products.map(p => p.barcode).filter(Boolean));
    let added = 0, dup = 0, withStock = 0; const date = o.date || Core.todayISO();
    for (const it of items) {
      const name = String(it.name || '').trim(); if (!name) continue;
      if (names.has(name)) { dup++; continue; }
      const bc = it.barcode && !codes.has(it.barcode) ? it.barcode : '';
      const p = { id: nid(st), name, barcode: bc, sku: String(it.sku || '').trim(), unit: String(it.unit || 'عدد').trim() || 'عدد', minStock: Math.max(0, Number(it.minStock) || 0), salePrice: Math.max(0, Math.round(it.salePrice) || 0), buyPrice: Math.max(0, Math.round(it.buyPrice) || 0) };
      if (it.category && Core.guessCategory(name) !== it.category) p.category = it.category;
      st.products.push(p); names.add(name); if (bc) codes.add(bc); added++;
      if (o.stock && it.stock > 0) { st.adjusts.push({ id: nid(st), productId: p.id, qty: Math.round(it.stock * 1000) / 1000, cost: Math.round(it.avg || it.buyPrice || 0), date, note: 'موجودی اولیه (ورود از فایل)', opening: true }); withStock++; }
    }
    return ok({ added, dup, withStock });
  };
  // empty the warehouse: o.products → also delete the products themselves; stock always goes (stock entries + the invoices that moved it)
  Core.clearWarehouse = function (st, o) {
    o = o || {};
    const r = Core.resetData(st, { adjusts: true, invoices: true });
    if (!r.ok) return r;
    if (o.products) r.state.products = [];
    return ok({ state: r.state, removed: Object.assign(r.removed, { products: o.products ? st.products.length : 0 }) });
  };

  Core.productUsed = (st, id) => st.invoices.some(i => i.items.some(l => l.productId === id)) || st.adjusts.some(a => a.productId === id);
  Core.deleteProduct = function (st, id) {
    if (Core.productUsed(st, id)) return err('این کالا در فاکتور یا تعدیل انبار استفاده شده و حذف نمی‌شود.');
    st.products = st.products.filter(p => p.id !== id); return ok();
  };

  /* ───────────── invoices ───────────── */
  Core.invoiceTotals = function (inv) {
    const lines = inv.items.map(l => ({ productId: l.productId, qty: l.qty, price: l.price, note: l.note || '', gross: Math.round(l.qty * l.price) }));
    const sub = lines.reduce((s, l) => s + l.gross, 0);
    const discount = Math.min(inv.discount || 0, sub);
    let left = discount;
    lines.forEach((l, i) => { // proportional discount allocation, remainder on last line
      const share = i === lines.length - 1 ? left : (sub ? Math.round(discount * l.gross / sub) : 0);
      l.discount = Math.min(share, l.gross); left -= l.discount; l.net = l.gross - l.discount;
    });
    const vatRate = Math.max(0, Number(inv.vatRate) || 0), vat = Math.round((sub - discount) * vatRate / 100);
    return { sub, discount, vatRate, vat, total: sub - discount + vat, lines };
  };

  // Chronological replay with moving weighted-average cost.
  let replayCache = null;
  Core.replay = function (st, hook) {
    if (!hook) {
      const k = [st.invoices, st.invoices.length, st.invoices[st.invoices.length - 1], st.adjusts, st.adjusts.length, st.adjusts[st.adjusts.length - 1], st.products, st.products.length];
      if (replayCache && replayCache.k.every((v, i) => v === k[i])) return replayCache.r;
      const r = replayRaw(st); replayCache = { k, r }; return r;
    }
    return replayRaw(st, hook);
  };
  function replayRaw(st, hook) {
    const S = {}; const get = id => S[id] || (S[id] = { stock: 0, avg: 0 });
    const cogs = {}, adjEffect = {}, errors = [];
    const ev = [];
    st.invoices.forEach(inv => ev.push({ date: inv.date, id: inv.id, inv }));
    st.adjusts.forEach(a => ev.push({ date: a.date, id: a.id, adj: a }));
    ev.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id);
    for (const e of ev) {
      if (e.inv) {
        const inv = e.inv, tot = Core.invoiceTotals(inv); let c = 0;
        for (const l of tot.lines) {
          const s = get(l.productId);
          if (inv.type === 'purchase') {
            const base = Math.max(s.stock, 0), ns = r3(base + l.qty);
            s.avg = ns > 0 ? (base * s.avg + l.net) / ns : s.avg; s.stock = r3(s.stock + l.qty);
            if (hook) hook({ date: inv.date, productId: l.productId, delta: l.qty, stock: s.stock, avg: s.avg, label: 'خرید - فاکتور ' + inv.no, invoiceId: inv.id, type: inv.type, unit: l.net / l.qty });
          } else if (inv.type === 'sale') {
            if (s.stock < l.qty - 1e-9) errors.push({ invoiceId: inv.id, productId: l.productId, need: l.qty, have: s.stock });
            c += Math.round(l.qty * s.avg); s.stock = r3(s.stock - l.qty);
            if (hook) hook({ date: inv.date, productId: l.productId, delta: -l.qty, stock: s.stock, avg: s.avg, label: 'فروش - فاکتور ' + inv.no, invoiceId: inv.id, type: inv.type, unit: l.net / l.qty });
          } else if (inv.type === 'sale_return') {
            c -= Math.round(l.qty * s.avg); s.stock = r3(s.stock + l.qty);
            if (hook) hook({ date: inv.date, productId: l.productId, delta: l.qty, stock: s.stock, avg: s.avg, label: 'برگشت از فروش - فاکتور ' + inv.no, invoiceId: inv.id, type: inv.type, unit: l.net / l.qty });
          } else if (inv.type === 'purchase_return') {
            if (s.stock < l.qty - 1e-9) errors.push({ invoiceId: inv.id, productId: l.productId, need: l.qty, have: s.stock });
            c += Math.round(l.qty * s.avg) - l.net; s.stock = r3(s.stock - l.qty);
            if (hook) hook({ date: inv.date, productId: l.productId, delta: -l.qty, stock: s.stock, avg: s.avg, label: 'برگشت از خرید - فاکتور ' + inv.no, invoiceId: inv.id, type: inv.type, unit: l.net / l.qty });
          }
        }
        cogs[inv.id] = c;
      } else {
        const a = e.adj, s = get(a.productId);
        if (a.qty > 0) {
          const unit = a.cost > 0 ? a.cost : s.avg, base = Math.max(s.stock, 0), ns = r3(base + a.qty);
          if (a.cost > 0) s.avg = ns > 0 ? (base * s.avg + a.qty * unit) / ns : unit;
          s.stock = r3(s.stock + a.qty); adjEffect[a.id] = -Math.round(a.qty * unit);
          if (hook) hook({ date: a.date, productId: a.productId, delta: a.qty, stock: s.stock, avg: s.avg, label: 'تعدیل موجودی' + (a.note ? ' - ' + a.note : ''), adjId: a.id, unit });
        } else {
          const q = -a.qty; if (s.stock < q - 1e-9) errors.push({ adjId: a.id, productId: a.productId, need: q, have: s.stock });
          adjEffect[a.id] = Math.round(q * s.avg); s.stock = r3(s.stock - q);
          if (hook) hook({ date: a.date, productId: a.productId, delta: -q, stock: s.stock, avg: s.avg, label: 'تعدیل موجودی' + (a.note ? ' - ' + a.note : ''), adjId: a.id, unit: s.avg });
        }
      }
    }
    st.products.forEach(p => get(p.id));
    return { stock: S, cogs, adjEffect, errors };
  }
  const stockErrText = (st, e) => { const p = byId(st.products, e.productId); return 'موجودی «' + (p ? p.name : '؟') + '» کافی نیست (موجودی: ' + Core.fmtQty(Math.max(e.have, 0)) + '، نیاز: ' + Core.fmtQty(e.need) + ').'; };
  Core.stockErrText = stockErrText;

  Core.nextInvoiceNo = function (st) { let m = 0; st.invoices.forEach(i => { const n = parseInt(Core.toEn(i.no), 10); if (n > m) m = n; }); return String(m + 1); };

  Core.addInvoice = function (st, d) {
    if (!INV_KIND[d.type]) return err('نوع فاکتور نامعتبر است.');
    if (!byId(st.people, d.personId)) return err('شخص را انتخاب کنید.');
    const de = checkDate(d.date); if (de) return err(de);
    if (!d.items || !d.items.length) return err('حداقل یک قلم کالا لازم است.');
    const items = [];
    for (const l of d.items) {
      if (!byId(st.products, l.productId)) return err('کالای انتخاب‌شده معتبر نیست.');
      if (!(l.qty > 0)) return err('تعداد باید بزرگ‌تر از صفر باشد.');
      if (!Number.isInteger(l.price) || l.price < 0 || l.price > MAX_MONEY) return err('قیمت واحد نامعتبر است.');
      items.push({ productId: l.productId, qty: r3(l.qty), price: l.price, note: String(l.note || '').trim().slice(0, 500) });
    }
    const discount = d.discount || 0;
    if (!Number.isInteger(discount) || discount < 0) return err('تخفیف نامعتبر است.');
    const no = String(d.no || '').trim() || Core.nextInvoiceNo(st);
    if (st.invoices.some(i => i.no === no && i.type === d.type)) return err('شماره فاکتور تکراری است.');
    const vr = Number(d.vatRate) || 0; if (!(vr >= 0 && vr <= 100)) return err('درصد ارزش افزوده نامعتبر است.');
    const inv = { id: nid(st), no, type: d.type, personId: d.personId, date: d.date, items, discount, note: String(d.note || '').trim() }; if (vr > 0) inv.vatRate = vr;
    const tot = Core.invoiceTotals(inv);
    if (tot.total <= 0 && tot.sub <= 0) return err('جمع فاکتور صفر است.');
    if (discount > tot.sub) return err('تخفیف از جمع فاکتور بیشتر است.');
    const paid = d.paid || 0;
    if (!Number.isInteger(paid) || paid < 0 || paid > tot.total) return err('مبلغ پرداخت/دریافت نباید از جمع فاکتور بیشتر باشد.');
    st.invoices.push(inv);
    const rp = Core.replay(st);
    if (rp.errors.length) { st.invoices.pop(); st.seq = inv.id; return err(stockErrText(st, rp.errors[0])); }
    const label = Core.TYPE_FA[inv.type] + ' - فاکتور ' + no;
    st.tx.push({ id: nid(st), personId: inv.personId, kind: INV_KIND[inv.type], amount: tot.total, type: 'invoice', desc: label, date: inv.date, ref: inv.id, group: null, method: null });
    if (paid > 0) st.tx.push({ id: nid(st), personId: inv.personId, kind: PAY_KIND[inv.type], amount: paid, type: (PAY_KIND[inv.type] === 'credit' ? 'receipt' : 'payment'), desc: 'تسویه همزمان - فاکتور ' + no, date: inv.date, ref: inv.id, group: null, initPay: true, method: METHODS[d.method] ? d.method : 'cash' });
    return ok({ invoice: inv });
  };
  // edit an invoice in place (same id and number): items, person, date, discount, VAT, first payment.
  // Stock, balances and profit are recalculated from the data, so the change flows everywhere.
  Core.editInvoice = function (st, id, d) {
    const old = byId(st.invoices, id); if (!old) return err('فاکتور پیدا نشد.');
    if (!byId(st.people, d.personId)) return err('شخص را انتخاب کنید.');
    const de = checkDate(d.date); if (de) return err(de);
    if (!d.items || !d.items.length) return err('حداقل یک قلم کالا لازم است.');
    const items = [];
    for (const l of d.items) {
      if (!byId(st.products, l.productId)) return err('کالای انتخاب‌شده معتبر نیست.');
      if (!(l.qty > 0)) return err('تعداد باید بزرگ‌تر از صفر باشد.');
      if (!Number.isInteger(l.price) || l.price < 0 || l.price > MAX_MONEY) return err('قیمت واحد نامعتبر است.');
      items.push({ productId: l.productId, qty: r3(l.qty), price: l.price, note: String(l.note || '').trim().slice(0, 500) });
    }
    const discount = d.discount || 0; if (!Number.isInteger(discount) || discount < 0) return err('تخفیف نامعتبر است.');
    const vr = Number(d.vatRate) || 0; if (!(vr >= 0 && vr <= 100)) return err('درصد ارزش افزوده نامعتبر است.');
    const no = String(d.no || '').trim() || old.no;
    if (st.invoices.some(i => i.id !== id && i.no === no && i.type === old.type)) return err('شماره فاکتور تکراری است.');
    const inv = { id, no, type: old.type, personId: d.personId, date: d.date, items, discount, note: String(d.note || '').trim() }; if (vr > 0) inv.vatRate = vr;
    const tot = Core.invoiceTotals(inv);
    if (tot.total <= 0 && tot.sub <= 0) return err('جمع فاکتور صفر است.');
    if (discount > tot.sub) return err('تخفیف از جمع فاکتور بیشتر است.');
    const linked = st.tx.filter(t => t.ref === id), main = linked.find(t => t.type === 'invoice');
    const first = linked.find(t => t.type !== 'invoice' && (t.initPay || /^تسویه همزمان/.test(t.desc || '')));
    const paid = d.paid || 0; if (!Number.isInteger(paid) || paid < 0) return err('مبلغ پرداخت/دریافت نامعتبر است.');
    const otherPaid = linked.filter(t => t !== main && t !== first && (t.type === 'receipt' || t.type === 'payment')).reduce((s, t) => s + t.amount, 0);
    if (paid + otherPaid > tot.total) return err('جمع پرداخت‌های این فاکتور (' + Core.fmt(paid + otherPaid) + ') از مبلغ جدید فاکتور بیشتر می‌شود.');
    const bakInv = st.invoices;
    st.invoices = st.invoices.map(i => i.id === id ? inv : i);
    const rp = Core.replay(st);
    if (rp.errors.length) { st.invoices = bakInv; return err('با این تغییر موجودی انبار منفی می‌شود. ' + stockErrText(st, rp.errors[0])); }
    const label = Core.TYPE_FA[inv.type] + ' - فاکتور ' + no;
    if (main) Object.assign(main, { personId: inv.personId, amount: tot.total, date: inv.date, desc: label });
    else st.tx.push({ id: nid(st), personId: inv.personId, kind: INV_KIND[inv.type], amount: tot.total, type: 'invoice', desc: label, date: inv.date, ref: id, group: null, method: null });
    linked.forEach(t => { if (t !== main) t.personId = inv.personId; });
    if (paid > 0) {
      const m = METHODS[d.method] ? d.method : (first && first.method) || 'cash';
      if (first) Object.assign(first, { amount: paid, date: inv.date, method: m, desc: 'تسویه همزمان - فاکتور ' + no, initPay: true });
      else st.tx.push({ id: nid(st), personId: inv.personId, kind: PAY_KIND[inv.type], amount: paid, type: (PAY_KIND[inv.type] === 'credit' ? 'receipt' : 'payment'), desc: 'تسویه همزمان - فاکتور ' + no, date: inv.date, ref: id, group: null, initPay: true, method: m });
    } else if (first) st.tx = st.tx.filter(t => t !== first);
    return ok({ invoice: inv });
  };
  Core.firstPayment = (st, id) => (txByRef(st).get(id) || []).find(t => t.type !== 'invoice' && (t.initPay || /^تسویه همزمان/.test(t.desc || ''))) || null;
  Core.deleteInvoice = function (st, id) {
    const inv = byId(st.invoices, id); if (!inv) return err('فاکتور پیدا نشد.');
    const bakInv = st.invoices, bakTx = st.tx;
    st.invoices = st.invoices.filter(i => i.id !== id); st.tx = st.tx.filter(t => t.ref !== id);
    const rp = Core.replay(st);
    if (rp.errors.length) { st.invoices = bakInv; st.tx = bakTx; return err('با حذف این فاکتور موجودی انبار منفی می‌شود. ' + stockErrText(st, rp.errors[0])); }
    return ok();
  };
  Core.invoiceInfo = function (st, inv) {
    const tot = Core.invoiceTotals(inv);
    const paid = (txByRef(st).get(inv.id) || []).filter(t => t.type === 'receipt' || t.type === 'payment').reduce((s, t) => s + t.amount, 0);
    return Object.assign({ paid, remaining: tot.total - paid }, tot);
  };

  /* ───────────── inventory adjustments ───────────── */
  Core.addAdjust = function (st, d) {
    const p = byId(st.products, d.productId); if (!p) return err('کالا را انتخاب کنید.');
    if (!d.qty || !isFinite(d.qty)) return err('مقدار تعدیل نامعتبر است.');
    const de = checkDate(d.date); if (de) return err(de);
    const a = { id: nid(st), productId: d.productId, qty: r3(d.qty), cost: d.qty > 0 ? Math.max(0, Math.round(d.cost) || 0) : 0, date: d.date, note: String(d.note || '').trim() };
    if (d.opening && a.qty > 0) a.opening = true;
    st.adjusts.push(a); const rp = Core.replay(st);
    if (rp.errors.length) { st.adjusts.pop(); st.seq = a.id; return err(stockErrText(st, rp.errors[0])); }
    return ok({ adjust: a });
  };
  Core.deleteAdjust = function (st, id) {
    const bak = st.adjusts; st.adjusts = st.adjusts.filter(a => a.id !== id);
    const rp = Core.replay(st); if (rp.errors.length) { st.adjusts = bak; return err('با حذف این تعدیل موجودی منفی می‌شود.'); }
    return ok();
  };

  /* ───────────── expenses & cheques ───────────── */
  Core.addExpense = function (st, d) {
    const title = String(d.title || '').trim(); if (!title) return err('عنوان هزینه را وارد کنید.');
    if (!(d.amount > 0) || !Number.isInteger(d.amount) || d.amount > MAX_MONEY) return err('مبلغ نامعتبر است.');
    const de = checkDate(d.date); if (de) return err(de);
    const e = { id: nid(st), title, amount: d.amount, date: d.date, method: METHODS[d.method] ? d.method : 'cash', category: String(d.category || '').trim(), note: String(d.note || '').trim() };
    st.expenses.push(e); return ok({ expense: e });
  };
  Core.editExpense = function (st, id, d) {
    const e = byId(st.expenses, id); if (!e) return err('هزینه پیدا نشد.');
    const title = String(d.title || '').trim(); if (!title) return err('عنوان هزینه را وارد کنید.');
    if (!(d.amount > 0) || !Number.isInteger(d.amount)) return err('مبلغ نامعتبر است.');
    const de = checkDate(d.date); if (de) return err(de);
    Object.assign(e, { title, amount: d.amount, date: d.date, method: METHODS[d.method] ? d.method : e.method, category: String(d.category || '').trim(), note: String(d.note || '').trim() }); return ok();
  };
  Core.deleteExpense = function (st, id) { st.expenses = st.expenses.filter(e => e.id !== id); return ok(); };

  Core.addCheque = function (st, d) {
    const title = String(d.title || '').trim(); if (!title) return err('عنوان را وارد کنید.');
    if (!(d.amount > 0) || !Number.isInteger(d.amount) || d.amount > MAX_MONEY) return err('مبلغ نامعتبر است.');
    const de = checkDate(d.dueDate); if (de) return err(de);
    if (d.personId && !byId(st.people, d.personId)) return err('شخص نامعتبر است.');
    const c = { id: nid(st), kind: d.kind === 'installment' ? 'installment' : 'cheque', direction: d.direction === 'pay' ? 'pay' : 'receive', personId: d.personId || null, title, amount: d.amount, dueDate: d.dueDate, note: String(d.note || '').trim(), done: false, doneAt: null };
    st.cheques.push(c); return ok({ cheque: c });
  };
  Core.editCheque = function (st, id, d) {
    const c = byId(st.cheques, id); if (!c) return err('مورد پیدا نشد.');
    const title = String(d.title || '').trim(); if (!title) return err('عنوان را وارد کنید.');
    if (!(d.amount > 0) || !Number.isInteger(d.amount) || d.amount > MAX_MONEY) return err('مبلغ نامعتبر است.');
    const de = checkDate(d.dueDate); if (de) return err(de);
    if (d.personId && !byId(st.people, d.personId)) return err('شخص نامعتبر است.');
    const tx = c.txId ? byId(st.tx, c.txId) : null;
    if (tx && !d.personId) return err('این چک در حساب شخص ثبت شده است؛ شخص را خالی نگذارید.');
    Object.assign(c, { kind: d.kind === 'installment' ? 'installment' : 'cheque', direction: d.direction === 'pay' ? 'pay' : 'receive', personId: d.personId || null, title, amount: d.amount, dueDate: d.dueDate, note: String(d.note || '').trim() });
    if (tx) Object.assign(tx, { personId: c.personId, amount: c.amount, kind: c.direction === 'receive' ? 'credit' : 'debit', type: c.direction === 'receive' ? 'receipt' : 'payment', desc: (c.kind === 'cheque' ? 'چک' : 'قسط') + ' - ' + c.title });
    return ok();
  };
  Core.deleteCheque = function (st, id) { st.cheques = st.cheques.filter(c => c.id !== id); return ok(); };
  // mark done; optionally record the receipt/payment in the person's account
  Core.completeCheque = function (st, id, recordTx, date) {
    const c = byId(st.cheques, id); if (!c) return err('مورد پیدا نشد.'); if (c.done) return err('قبلاً انجام شده است.');
    if (recordTx) {
      if (!c.personId) return err('برای ثبت در حساب، باید شخص مشخص باشد.');
      const r = Core.addTx(st, { personId: c.personId, type: c.direction === 'receive' ? 'receipt' : 'payment', amount: c.amount, date: date || Core.todayISO(), desc: (c.kind === 'cheque' ? 'چک' : 'قسط') + ' - ' + c.title, method: c.kind === 'cheque' ? 'cheque' : 'bank' });
      if (!r.ok) return r; c.txId = r.tx.id;
    }
    c.done = true; c.doneAt = date || Core.todayISO(); return ok();
  };
  Core.reopenCheque = function (st, id) {
    const c = byId(st.cheques, id); if (!c) return err('مورد پیدا نشد.');
    if (c.txId) st.tx = st.tx.filter(t => t.id !== c.txId);
    c.done = false; c.doneAt = null; delete c.txId; return ok();
  };
  Core.chequeStatus = function (c, today) {
    if (c.done) return 'done'; const d = Core.diffDays(today, c.dueDate);
    return d < 0 ? 'overdue' : d <= 7 ? 'soon' : 'later';
  };

  /* ───────────── reports ───────────── */
  const inRange = (d, from, to) => (!from || d >= from) && (!to || d <= to);
  Core.report = function (st, from, to) {
    const rp = Core.replay(st); const r = { sales: 0, saleReturns: 0, purchases: 0, purchaseReturns: 0, cogs: 0, adjLoss: 0, expenses: 0, invoices: 0, discounts: 0, vatOut: 0, vatIn: 0 };
    for (const inv of st.invoices) {
      if (!inRange(inv.date, from, to)) continue; const t = Core.invoiceTotals(inv); r.invoices++;
      const ex = t.total - t.vat; // amounts without VAT (VAT is not income or cost)
      if (inv.type === 'sale') { r.sales += ex; r.vatOut += t.vat; r.discounts += t.discount; r.cogs += rp.cogs[inv.id] || 0; }
      else if (inv.type === 'sale_return') { r.saleReturns += ex; r.vatOut -= t.vat; r.cogs += rp.cogs[inv.id] || 0; }
      else if (inv.type === 'purchase') { r.purchases += ex; r.vatIn += t.vat; }
      else if (inv.type === 'purchase_return') { r.purchaseReturns += ex; r.vatIn -= t.vat; r.cogs += rp.cogs[inv.id] || 0; }
    }
    for (const a of st.adjusts) if (!a.opening && inRange(a.date, from, to)) r.adjLoss += rp.adjEffect[a.id] || 0;
    for (const e of st.expenses) if (inRange(e.date, from, to)) r.expenses += e.amount;
    r.vatNet = r.vatOut - r.vatIn;
    r.revenue = r.sales - r.saleReturns; r.cogsTotal = r.cogs + r.adjLoss; r.gross = r.revenue - r.cogsTotal; r.net = r.gross - r.expenses;
    return r;
  };
  Core.cashSummary = function (st, from, to) {
    const m = { cash: 0, bank: 0, cheque: 0 }; let inn = 0, out = 0;
    const add = (method, v) => { m[METHODS[method] ? method : 'cash'] += v; };
    for (const t of st.tx) {
      if (!inRange(t.date, from, to)) continue;
      if (t.type === 'receipt') { add(t.method, t.amount); inn += t.amount; } else if (t.type === 'payment') { add(t.method, -t.amount); out += t.amount; }
    }
    for (const e of st.expenses) if (inRange(e.date, from, to)) { add(e.method, -e.amount); out += e.amount; }
    return { byMethod: m, in: inn, out, net: inn - out };
  };
  Core.cashBalance = function (st) { const c = Core.cashSummary(st); return (st.settings.openingCash || 0) + c.net; };
  Core.receivablePayable = function (st) {
    const b = Core.balances(st); let rec = 0, pay = 0;
    st.people.forEach(p => { const v = b[p.id] || 0; if (v > 0) rec += v; else pay -= v; });
    return { receivable: rec, payable: pay };
  };
  Core.inventoryValue = function (st) { const rp = Core.replay(st); let v = 0; for (const id in rp.stock) v += Math.max(rp.stock[id].stock, 0) * rp.stock[id].avg; return Math.round(v); };
  Core.productStats = function (st) {
    const rp = Core.replay(st);
    const am = Core.autoMins(st);
    return st.products.map(p => { const s = rp.stock[p.id] || { stock: 0, avg: 0 }, min = p.minStock > 0 ? p.minStock : (am[p.id] || 0); return { product: p, stock: s.stock, avg: Math.round(s.avg), value: Math.round(Math.max(s.stock, 0) * s.avg), low: min > 0 && s.stock <= min, minAuto: !(p.minStock > 0) && !!am[p.id] }; });
  };
  Core.productMoves = function (st, pid) { const rows = []; Core.replay(st, m => { if (m.productId === pid) rows.push(m); }); return rows; };
  Core.topPeople = function (st, type, from, to, n) {
    const m = {}; st.invoices.forEach(i => { if (i.type === type && inRange(i.date, from, to)) m[i.personId] = (m[i.personId] || 0) + Core.invoiceTotals(i).total; });
    return Object.keys(m).map(id => ({ person: byId(st.people, +id), total: m[id] })).sort((a, b) => b.total - a.total).slice(0, n || 5);
  };
  Core.topProducts = function (st, from, to, n) {
    const m = {}; st.invoices.forEach(i => { if (i.type === 'sale' && inRange(i.date, from, to)) Core.invoiceTotals(i).lines.forEach(l => { const o = m[l.productId] || (m[l.productId] = { qty: 0, total: 0 }); o.qty += l.qty; o.total += l.net; }); });
    return Object.keys(m).map(id => ({ product: byId(st.products, +id), qty: r3(m[id].qty), total: m[id].total })).sort((a, b) => b.total - a.total).slice(0, n || 5);
  };

  /* ───────────── integrity / backup ───────────── */
  Core.audit = function (st) {
    const p = [];
    const ids = new Set(); const all = [].concat(st.people, st.products, st.invoices, st.tx, st.expenses, st.cheques, st.adjusts);
    all.forEach(x => { if (!Number.isInteger(x.id)) p.push('شناسه نامعتبر'); else if (ids.has(x.id)) p.push('شناسه تکراری: ' + x.id); else ids.add(x.id); if (x.id >= st.seq) p.push('شمارنده شناسه عقب است'); });
    st.tx.forEach(t => { if (!byId(st.people, t.personId)) p.push('تراکنش بدون شخص: ' + t.id); if (!(t.amount > 0)) p.push('مبلغ نامعتبر در تراکنش ' + t.id); if (t.kind !== 'debit' && t.kind !== 'credit') p.push('نوع نامعتبر در تراکنش ' + t.id); if (!Core.validIso(t.date)) p.push('تاریخ نامعتبر در تراکنش ' + t.id); if (t.ref && !byId(st.invoices, t.ref)) p.push('تراکنش یتیم فاکتور: ' + t.id); });
    st.invoices.forEach(i => {
      if (!byId(st.people, i.personId)) p.push('فاکتور بدون شخص: ' + i.no);
      i.items.forEach(l => { if (!byId(st.products, l.productId)) p.push('قلم بدون کالا در فاکتور ' + i.no); });
      const main = (txByRef(st).get(i.id) || []).filter(t => t.type === 'invoice'); const tot = Core.invoiceTotals(i).total;
      if (main.length !== 1 || main[0].amount !== tot) p.push('عدم تطابق حساب با فاکتور ' + i.no);
    });
    Core.replay(st).errors.forEach(e => p.push('موجودی منفی: ' + stockErrText(st, e)));
    return p;
  };
  // "start fresh": clears documents but never people or products. o: { invoices, adjusts, people, expenses, cheques }
  // returns a new state (the original is untouched) or an error when the result would be inconsistent (e.g. sales left without stock)
  Core.resetData = function (st, o) {
    o = o || {}; const nx = Object.assign({}, st);
    const gone = new Set(o.invoices ? st.invoices.map(i => i.id) : []);
    if (o.invoices) nx.invoices = [];
    if (o.adjusts) nx.adjusts = [];
    if (o.expenses) nx.expenses = [];
    nx.tx = st.tx.filter(t => !(t.ref != null ? gone.has(t.ref) : o.people));
    const keptTx = new Set(nx.tx.map(t => t.id));
    nx.cheques = o.cheques ? [] : st.cheques.map(c => { if (c.txId && !keptTx.has(c.txId)) { const d = Object.assign({}, c); delete d.txId; return d; } return c; });
    const probs = Core.audit(nx);
    if (probs.length) return err('با این انتخاب، اطلاعات ناسازگار می‌شود (' + probs[0] + '). ' + (o.adjusts && !o.invoices ? 'اگر ورود کالا را پاک می‌کنید، فاکتورها را هم انتخاب کنید.' : ''));
    return ok({ state: nx, removed: { invoices: st.invoices.length - nx.invoices.length, tx: st.tx.length - nx.tx.length, adjusts: st.adjusts.length - nx.adjusts.length, expenses: st.expenses.length - nx.expenses.length, cheques: st.cheques.length - nx.cheques.length } });
  };
  Core.exportJSON = function (st) { return JSON.stringify({ app: 'fixquick-accounting', version: 1, exportedAt: new Date().toISOString(), data: st }); };
  Core.parseBackup = function (text) {
    let o; try { o = JSON.parse(text); } catch (e) { return err('فایل پشتیبان معتبر نیست (JSON خراب).'); }
    if (!o || o.app !== 'fixquick-accounting' || !o.data) return err('این فایل، پشتیبان این برنامه نیست.');
    const d = o.data, base = Core.emptyState();
    for (const k of ['people', 'products', 'invoices', 'tx', 'expenses', 'cheques', 'adjusts']) { if (d[k] === undefined) d[k] = []; if (!Array.isArray(d[k])) return err('ساختار فایل پشتیبان خراب است.'); }
    d.settings = Object.assign(base.settings, d.settings || {}); d.v = 1;
    const fixM = m => (METHODS[m] ? m : m === 'card' ? 'bank' : 'cash'); // unknown payment methods from other files
    for (const t of d.tx) if (t.method != null && !METHODS[t.method]) t.method = fixM(t.method);
    for (const e of d.expenses) if (!METHODS[e.method]) e.method = fixM(e.method);
    if (!Number.isInteger(d.seq)) d.seq = 1;
    let maxId = 0; for (const k of ['people', 'products', 'invoices', 'tx', 'expenses', 'cheques', 'adjusts']) for (const x of d[k]) { const v = +x.id || 0; if (v > maxId) maxId = v; }
    if (d.seq <= maxId) d.seq = maxId + 1;
    const probs = Core.audit(d); if (probs.length) return err('فایل پشتیبان ناسازگار است: ' + probs[0]);
    return ok({ state: d });
  };

  /* ───────────── CSV / text helpers ───────────── */
  Core.csv = rows => rows.map(r => r.map(c => { c = String(c == null ? '' : c); return /[",\n\r]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(',')).join('\r\n');
  Core.statementText = function (st, pid, from, to) {
    const p = byId(st.people, pid); const L = Core.ledger(st, pid, from, to);
    const lines = ['صورت‌حساب ' + p.name + (st.settings.business ? ' — ' + st.settings.business : ''), 'تاریخ: ' + Core.fmtDate(Core.todayISO()), ''];
    const who = v => v > 0 ? ' (شما بدهکارید)' : v < 0 ? ' (ما بدهکاریم)' : '';
    if (from) lines.push('مانده از قبل: ' + Core.fmt(Math.abs(L.carry)) + who(L.carry));
    L.rows.forEach(r => lines.push(Core.fmtDate(r.tx.date) + ' | ' + (r.tx.desc || '—') + ' | ' + (r.debit ? 'اضافه ' + Core.fmt(r.debit) : 'کم ' + Core.fmt(r.credit)) + ' | مانده ' + Core.fmt(Math.abs(r.balance)) + who(r.balance)));
    lines.push('', 'مانده نهایی: ' + Core.fmt(Math.abs(L.closing)) + ' ' + Core.unitName() + ' ' + (L.closing > 0 ? '(شما بدهکارید)' : L.closing < 0 ? '(ما بدهکاریم)' : '(تسویه)'));
    return lines.join('\n');
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Core; else root.Core = Core;
})(typeof window !== 'undefined' ? window : globalThis);
