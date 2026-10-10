/* Users & permissions, period lock, automatic backups.
 * The account owner is the admin; the admin can add sub-users (staff) with limited permissions.
 * Rules are enforced by wrapping the Core functions that change data, so every screen obeys them. */
'use strict';

/* ── session ── */
let CUR = { admin: true, user: '' };
const PERMS = [
  ['money', 'ثبت دریافت، پرداخت، حواله، هزینه و چک', true],
  ['people', 'افزودن و ویرایش اشخاص', true],
  ['balances', 'دیدن مانده حساب اشخاص', true],
  ['purchase', 'ثبت فاکتور خرید و برگشت از خرید', false],
  ['edit', 'ویرایش و حذف فاکتورها و اسناد', false],
  ['cost', 'دیدن قیمت خرید، سود و ارزش انبار', false],
  ['reports', 'دیدن گزارش‌ها و سود و زیان', false],
  ['warehouse', 'افزودن، ویرایش و حذف کالا و تعدیل انبار', false],
  ['backup', 'پشتیبان‌گیری و بازیابی', false]
];
const isAdmin = () => !!CUR.admin;
const can = p => CUR.admin || !!(CUR.perms && CUR.perms[p]);
const maxDiscount = () => (CUR.admin ? 100 : Math.max(0, Math.min(100, Number(CUR.perms && CUR.perms.discount) || 0)));
const curName = () => (CUR.admin ? ((S.settings.auth && S.settings.auth.user) || '') : CUR.user);
function setAdminSession() { CUR = { admin: true, user: (S.settings.auth && S.settings.auth.user) || '' }; }
function findSubUser(name) { const n = String(name || '').trim().toLowerCase(); return (S.settings.users || []).find(u => !u.off && u.user.toLowerCase() === n) || null; }
async function subLogin(name, pass) {
  const u = findSubUser(name); if (!u) return false;
  if (await hashPin(pass, u.salt) !== u.hash) return false;
  CUR = { admin: false, id: u.id, user: u.user, perms: Object.assign({}, u.perms) }; return true;
}

/* ── period lock ── */
let unlockUntil = 0;
const lockDate = () => S.settings.lockDate || '';
const isLocked = d => !!(lockDate() && d && d <= lockDate());
let unlockAsked = 0;
function promptUnlock() {
  if (Date.now() - unlockAsked < 800) return; unlockAsked = Date.now();
  const sh = sheet('دوره قفل‌شده', '<p class="msg">اسناد تا تاریخ <b>' + fmtDate(lockDate()) + '</b> قفل شده‌اند و بدون رمز مدیر تغییر نمی‌کنند. برای باز کردن موقت قفل (۱۰ دقیقه) رمز مدیر را وارد کنید.</p><form id="ulf">' + pwField('p', 'رمز مدیر', 'current-password') + '<button class="btn blue" type="submit">باز کردن قفل</button></form>');
  sh.q('#ulf').onsubmit = async e => { e.preventDefault(); const au = S.settings.auth; if (!au || await hashPin(e.target.p.value, au.salt) !== au.hash) return toast('رمز مدیر اشتباه است.', true); unlockUntil = Date.now() + 10 * 60e3; sh.close(); toast('قفل تا ۱۰ دقیقه باز شد؛ دوباره «ذخیره» را بزنید.'); };
}

/* ── guarding every data change ── */
(function guardCore() {
  const no = m => ({ ok: false, error: m });
  const old = (arr, id) => (id != null ? Core.byId(arr, id) : null);
  const txGroupDate = (st, g) => { const t = st.tx.find(x => x.group === g); return t && t.date; };
  // name: [permission(s) needed, function returning the dates the change touches]
  const R = {
    addPerson: ['people'], editPerson: ['people'], deletePerson: ['people'], setArchived: ['people'],
    addProduct: ['warehouse'], editProduct: ['warehouse'], deleteProduct: ['warehouse'],
    addAdjust: ['warehouse', (st, d) => [d.date]], deleteAdjust: ['warehouse edit', (st, id) => [(old(st.adjusts, id) || {}).date]],
    addInvoice: [(st, d) => (d.type === 'purchase' || d.type === 'purchase_return' ? 'purchase' : ''), (st, d) => [d.date]],
    editInvoice: [(st, id, d) => 'edit' + (d.type === 'purchase' || d.type === 'purchase_return' ? ' purchase' : ''), (st, id, d) => [(old(st.invoices, id) || {}).date, d.date]],
    deleteInvoice: ['edit', (st, id) => [(old(st.invoices, id) || {}).date]],
    addTx: ['money', (st, d) => [d.date]], editTx: ['money edit', (st, id, d) => [(old(st.tx, id) || {}).date, d.date]], deleteTx: ['money edit', (st, id) => [(old(st.tx, id) || {}).date]],
    addTransfer: ['money', (st, d) => [d.date]], editTransfer: ['money edit', (st, g, d) => [txGroupDate(st, g), d.date]],
    addExpense: ['money', (st, d) => [d.date]], editExpense: ['money edit', (st, id, d) => [(old(st.expenses, id) || {}).date, d.date]], deleteExpense: ['money edit', (st, id) => [(old(st.expenses, id) || {}).date]],
    addCheque: ['money'], editCheque: ['money edit', (st, id) => { const c = old(st.cheques, id); return [c && c.done ? c.doneAt : null]; }], deleteCheque: ['money edit', (st, id) => { const c = old(st.cheques, id); return [c && c.done ? c.doneAt : null]; }],
    completeCheque: ['money', (st, id, rec, date) => [date]], reopenCheque: ['money edit', (st, id) => [(old(st.cheques, id) || {}).doneAt]],
    resetData: ['admin', st => [[].concat(st.invoices, st.tx, st.expenses, st.adjusts).reduce((m, x) => (!m || x.date < m ? x.date : m), null)]]
  };
  const NAMES = { money: 'دریافت و پرداخت', people: 'اشخاص', warehouse: 'انبار', purchase: 'فاکتور خرید', edit: 'ویرایش و حذف اسناد', admin: 'مدیر' };
  Object.keys(R).forEach(name => {
    const f = Core[name], [perm, dates] = R[name]; if (!f) return;
    Core[name] = function (st, ...a) {
      if (st !== S) return f.call(this, st, ...a); // only the live data is guarded (tests, previews and copies are not)
      const need = String(typeof perm === 'function' ? perm(st, ...a) : perm).split(' ').filter(Boolean);
      for (const p of need) { if (p === 'admin' ? !isAdmin() : !can(p)) return no('اجازه این کار را ندارید (' + NAMES[p] + '). از مدیر برنامه بخواهید.'); }
      if (name === 'addInvoice' || name === 'editInvoice') {
        const d = name === 'addInvoice' ? a[0] : a[1], sub = (d.items || []).reduce((t, l) => t + Math.round(l.qty * l.price), 0);
        if (!isAdmin() && sub > 0 && (d.discount || 0) / sub * 100 > maxDiscount() + 1e-9) return no('بیشترین تخفیف مجاز برای شما ' + Core.toFa(maxDiscount()) + '٪ است.');
      }
      if (dates && lockDate() && Date.now() > unlockUntil && dates(st, ...a).some(isLocked)) { setTimeout(promptUnlock, 60); return no('این سند در دوره قفل‌شده (تا ' + fmtDate(lockDate()) + ') است.'); }
      const seq0 = st.seq, r = f.call(this, st, ...a);
      if (r && r.ok && st.seq > seq0) { // remember who made each new record
        const who = curName();
        if (who) for (const k of ['invoices', 'tx', 'expenses', 'cheques', 'adjusts']) { const arr = st[k]; for (let i = arr.length - 1; i >= 0 && arr[i].id >= seq0; i--) arr[i].by = who; }
      }
      return r;
    };
  });
})();

/* ── user management (admin) ── */
function usersCard() {
  const us = S.settings.users || [];
  return '<div class="card"><div class="ch">' + ico('users') + 'کاربران (زیرمجموعه)</div><p class="hint">شما مدیر هستید. برای هر شاگرد یا همکار یک نام کاربری و رمز جدا بسازید و مشخص کنید به چه بخش‌هایی دسترسی داشته باشد. هر سندی که ثبت می‌کند به نام خودش ذخیره می‌شود.</p>' +
    (us.length ? '<div class="card flush">' + us.map(u => '<button class="row" data-act="userEdit" data-id="' + u.id + '"><span><b>' + esc(u.user) + (u.off ? ' <small class="debit">(غیرفعال)</small>' : '') + '</b><small>' + esc(PERMS.filter(p => u.perms && u.perms[p[0]]).map(p => p[1].split('،')[0]).join(' · ') || 'فقط ثبت فاکتور فروش') + ' · تخفیف تا ' + fa(u.perms && u.perms.discount || 0) + '٪</small></span><em>‹</em></button>').join('') + '</div>' : '') +
    '<button class="btn blue" data-act="userEdit">+ کاربر جدید</button>' + (S.settings.bio && us.length ? '<p class="hint debit">ورود با اثر انگشت همیشه به‌عنوان مدیر است. اگر اثر انگشت کس دیگری هم روی این گوشی ثبت شده، اثر انگشت را خاموش کنید.</p>' : '') + '</div>';
}
function userForm(id) {
  const us = S.settings.users || (S.settings.users = []), u = id ? us.find(x => x.id === id) : null, pm = (u && u.perms) || Object.fromEntries(PERMS.map(p => [p[0], p[2]]).concat([['discount', 5]]));
  const sh = sheet(u ? 'ویرایش کاربر' : 'کاربر جدید', '<form id="uf"><label class="fld"><span>نام کاربری</span><input class="inp ltr" name="u" autocapitalize="none" autocomplete="off" value="' + esc(u ? u.user : '') + '"></label>' + pwField('p', u ? 'رمز جدید (اگر نمی‌خواهید عوض شود، خالی بگذارید)' : 'رمز (حداقل ۴ نویسه)', 'new-password') +
    '<div class="ch" style="margin-top:6px">دسترسی‌ها</div>' + PERMS.map(p => '<label class="chk rs"><input type="checkbox" name="pm_' + p[0] + '"' + (pm[p[0]] ? ' checked' : '') + '><span><b>' + p[1] + '</b></span></label>').join('') +
    '<label class="fld"><span>بیشترین تخفیف مجاز روی فاکتور (درصد)</span><input class="inp ltr" name="disc" inputmode="decimal" value="' + fa(pm.discount || 0) + '"></label><p class="hint">ثبت فاکتور فروش و دیدن کالاها برای همه کاربران آزاد است. مدیریت کاربران، تنظیمات، فعال‌سازی، خام کردن و حذف اطلاعات فقط برای مدیر است.</p>' +
    (u ? '<label class="chk"><input type="checkbox" name="off"' + (u.off ? ' checked' : '') + '> غیرفعال (نمی‌تواند وارد شود)</label>' : '') + '<button class="btn blue" type="submit">ذخیره</button>' + (u ? '<button type="button" class="btn ghost red" data-del>حذف کاربر</button>' : '') + '</form>', { tall: true });
  const f = sh.q('#uf');
  f.onsubmit = async e => {
    e.preventDefault(); const name = f.u.value.trim(), pass = f.p.value, disc = Core.parseNum(f.disc.value || '0');
    if (!/^[A-Za-z0-9._\-؀-ۿ]{3,30}$/.test(name)) return toast('نام کاربری ۳ تا ۳۰ نویسه، بدون فاصله.', true);
    const admin = (S.settings.auth && S.settings.auth.user || '').toLowerCase();
    if (name.toLowerCase() === admin || us.some(x => x !== u && x.user.toLowerCase() === name.toLowerCase())) return toast('این نام کاربری قبلاً استفاده شده است.', true);
    if (!u && pass.length < 4) return toast('رمز حداقل ۴ نویسه باشد.', true); if (pass && pass.length < 4) return toast('رمز حداقل ۴ نویسه باشد.', true);
    if (isNaN(disc) || disc < 0 || disc > 100) return toast('درصد تخفیف نامعتبر است.', true);
    const perms = Object.fromEntries(PERMS.map(p => [p[0], f['pm_' + p[0]].checked])); perms.discount = disc;
    const x = u || { id: Date.now() }; x.user = name; x.perms = perms; if (f.off) x.off = f.off.checked;
    if (pass) { x.salt = newSalt(); x.hash = await hashPin(pass, x.salt); }
    if (!u) us.push(x); await save(); sh.close(); toast('کاربر ذخیره شد.'); render();
  };
  const del = sh.q('[data-del]'); if (del) del.onclick = async () => { if (!(await confirmBox('کاربر «' + u.user + '» حذف شود؟ اسنادی که ثبت کرده می‌مانند.', 'حذف', true))) return; S.settings.users = us.filter(x => x !== u); await save(); sh.close(); render(); };
}
// who did what in the period (admin)
function staffReport(from, to) {
  if (!isAdmin() || !(S.settings.users || []).length) return '';
  const inR = d => (!from || d >= from) && (!to || d <= to), m = {};
  const g = k => m[k] || (m[k] = { inv: 0, sales: 0, tx: 0 });
  S.invoices.forEach(i => { if (!inR(i.date)) return; const x = g(i.by || curName() || '—'); x.inv++; if (i.type === 'sale') x.sales += Core.invoiceTotals(i).total; });
  S.tx.forEach(t => { if (inR(t.date) && t.ref == null && t.type !== 'opening') g(t.by || curName() || '—').tx++; });
  const rows = Object.keys(m).sort((a, b) => m[b].sales - m[a].sales);
  if (!rows.length) return '';
  return '<div class="card"><div class="ch">' + ico('users') + 'کار کاربران</div>' + rows.map(k => '<div class="rr"><span>' + esc(k) + '<small> · ' + fa(m[k].inv) + ' فاکتور · ' + fa(m[k].tx) + ' دریافت/پرداخت</small></span><b>' + fmt(m[k].sales) + '</b></div>').join('') + '<p class="hint">مبلغ = جمع فروش هر کاربر در این دوره.</p></div>';
}

/* ── period lock settings (admin) ── */
function lockCard() {
  const d = lockDate();
  return '<div class="card"><div class="ch">' + ico('lock') + 'قفل اسناد دوره‌های بسته‌شده</div><p class="hint">اسناد تا این تاریخ (فاکتور، دریافت و پرداخت، هزینه، تعدیل انبار) بدون رمز مدیر ویرایش یا حذف نمی‌شوند و سند جدید هم با تاریخ قبل از آن ثبت نمی‌شود.</p>' + (d ? '<div class="alert">قفل فعلی: تا ' + fmtDate(d) + '</div>' : '') + '<form id="lkf" class="row2f">' + dateField('ld', d || Core.addDays(today(), -1), 'قفل تا تاریخ') + '<button class="btn blue sm" type="submit">ذخیره قفل</button></form>' + (d ? '<button class="lnk center" data-act="lockClear">برداشتن قفل</button>' : '') + '</div>';
}
function bindLockCard() {
  const f = $('#lkf'); if (!f) return;
  f.onsubmit = async e => { e.preventDefault(); const d = readDate(f, 'ld'); if (!d) return toast('تاریخ نامعتبر است.', true); if (d > today()) return toast('تاریخ قفل نمی‌تواند بعد از امروز باشد.', true); askPass(async () => { S.settings.lockDate = d; await save(); toast('اسناد تا ' + fmtDate(d) + ' قفل شد.'); render(); }); };
}

/* ── automatic daily backup (on the phone: Documents/FixQuick, the last 7 days) ── */
let autoBkAt = 0;
const fsP = () => { const P = window.Capacitor && window.Capacitor.Plugins; return isNative() && P && P.Filesystem ? P.Filesystem : null; };
async function autoBackup(force) {
  try {
    if (!S.settings.auth || !(S.people.length + S.products.length + S.invoices.length + S.tx.length)) return;
    const t = today(); if (!force && S.settings.autoBk === t) return;
    const json = Core.exportJSON(S), name = 'fixquick-auto-' + t + '.json', FS = fsP(); let where = null;
    if (FS) {
      for (const dir of ['DOCUMENTS', 'DATA']) { try { await FS.writeFile({ path: 'FixQuick/' + name, data: json, directory: dir, encoding: 'utf8', recursive: true }); where = dir; break; } catch (e) { /* try the next place */ } }
      if (where) { try { const r = await FS.readdir({ path: 'FixQuick', directory: where }); const files = (r.files || []).map(x => (typeof x === 'string' ? x : x.name)).filter(n => /^fixquick-auto-\d{4}-\d\d-\d\d\.json$/.test(n)).sort(); for (const n of files.slice(0, -7)) await FS.deleteFile({ path: 'FixQuick/' + n, directory: where }); } catch (e) { /* ignore */ } }
    } else { try { await kvSet('auto_backup', json); await kvSet('auto_backup_date', t); where = 'APP'; } catch (e) { /* ignore */ } }
    autoBkAt = Date.now();
    if (where && (S.settings.autoBk !== t || S.settings.autoBkWhere !== where)) { S.settings.autoBk = t; S.settings.autoBkWhere = where; await save(); }
  } catch (e) { diagLog('autobackup', e && e.message || String(e)); }
}
async function autoBackupList() {
  const FS = fsP(), out = [];
  if (FS) { for (const dir of ['DOCUMENTS', 'DATA']) { try { const r = await FS.readdir({ path: 'FixQuick', directory: dir }); (r.files || []).map(x => (typeof x === 'string' ? x : x.name)).filter(n => /^fixquick-auto-\d{4}-\d\d-\d\d\.json$/.test(n)).forEach(n => out.push({ dir, name: n, date: n.slice(14, 24) })); } catch (e) { /* none here */ } } }
  else { try { const d = await kvGet('auto_backup_date'); if (d) out.push({ dir: 'APP', name: 'auto', date: d }); } catch (e) { /* ignore */ } }
  return out.sort((a, b) => (a.date < b.date ? 1 : -1));
}
async function autoBackupRead(x) { if (x.dir === 'APP') return kvGet('auto_backup'); const r = await fsP().readFile({ path: 'FixQuick/' + x.name, directory: x.dir, encoding: 'utf8' }); return r.data; }
function autoBackupCard() {
  const where = { DOCUMENTS: 'پوشه Documents/FixQuick گوشی', DATA: 'حافظه داخلی برنامه', APP: 'حافظه برنامه' }[S.settings.autoBkWhere] || '';
  return '<div class="card"><div class="ch">' + ico('save') + 'پشتیبان خودکار</div><p class="hint">هر روز خودکار یک نسخه پشتیبان روی همین گوشی ذخیره می‌شود (۷ روز آخر نگه داشته می‌شود). ' + (S.settings.autoBk ? 'آخرین: ' + fmtDate(S.settings.autoBk) + (where ? ' در ' + where : '') : 'هنوز ساخته نشده است.') + '</p><p class="hint">پشتیبان خودکار با حذف برنامه یا خرابی گوشی ممکن است از بین برود؛ هفته‌ای یک بار «دریافت پشتیبان» را بزنید و فایل را بیرون از گوشی نگه دارید.</p><button class="btn ghost" data-act="autoRestore">' + ico('restore') + 'بازیابی از پشتیبان خودکار</button></div>';
}
async function autoRestoreFlow() {
  const list = await autoBackupList(); if (!list.length) return toast('پشتیبان خودکاری پیدا نشد.', true);
  pickList('انتخاب پشتیبان خودکار', list.map((x, i) => ({ value: i, label: fmtDate(x.date), sub: x.dir === 'DOCUMENTS' ? 'Documents/FixQuick' : 'حافظه برنامه' })), async v => {
    try { const text = await autoBackupRead(list[+v]); await restoreText(text); } catch (e) { toast('خواندن فایل ممکن نشد: ' + (e.message || e), true); }
  });
}
