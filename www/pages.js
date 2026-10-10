/* Pages, forms and actions */
'use strict';
const UI = { peopleQ: '', peopleF: 'all', invQ: '', invF: 'all', prodQ: '', prodCat: '', pickCat: '', stockTab: 'reorder', searchQ: '', chqTab: 'open', rep: 'mtd', repFrom: null, repTo: null, stmtFrom: null, stmtTo: null, showArchived: false, limPeople: 150, limInv: 100, limProd: 100, limChq: 150, limLedger: 200 };
// long lists show the first N rows; «نمایش بیشتر» adds more (keeps phones fast with thousands of records)
function moreBtn(k, shown, total) { return total > shown ? '<button class="btn ghost" data-act="more" data-k="' + k + '">نمایش بیشتر (' + fa(shown) + ' از ' + fa(total) + ')</button>' : ''; }
const today = () => Core.todayISO();
const personName = id => { const p = Core.byId(S.people, id); return p ? p.name : '—'; };
const prodName = id => { const p = Core.byId(S.products, id); return p ? p.name : '—'; };
const unitOf = id => { const p = Core.byId(S.products, id); return p ? p.unit : ''; };
const stat = (label, val, cls, sub) => '<div class="stat"><small>' + label + '</small><b class="' + (cls || '') + '">' + val + '</b>' + (sub ? '<em>' + sub + '</em>' : '') + '</div>';
const empty = (icon, text, btn) => '<div class="empty big"><div class="eic">' + icon + '</div><p>' + text + '</p>' + (btn || '') + '</div>';
const chips = (name, cur, opts) => '<div class="chips">' + opts.map(o => '<button type="button" class="chip' + (cur === o[0] ? ' on' : '') + '" data-act="chip" data-k="' + name + '" data-v="' + o[0] + '">' + o[1] + '</button>').join('') + '</div>';
const vatRateSet = () => { const v = Number(S.settings.vatRate); return v >= 0 && v <= 100 && S.settings.vatRate !== undefined && S.settings.vatRate !== null && S.settings.vatRate !== '' ? v : 10; };
const fyMonth = () => Math.min(12, Math.max(1, +S.settings.fyMonth || 1));
const methodSel = (cur) => '<label class="fld"><span>روش</span><select class="inp" name="method">' + Object.keys(Core.METHODS).map(k => '<option value="' + k + '"' + (k === (cur || 'cash') ? ' selected' : '') + '>' + Core.METHODS[k] + '</option>').join('') + '</select></label>';
const backTo = h => '<button class="back" data-act="go" data-h="' + h + '">‹ بازگشت</button>';

/* ─────────── HOME ─────────── */
function pageHome() {
  const rp = Core.receivablePayable(S), cash = Core.cashBalance(S), inv = Core.inventoryValue(S);
  const t = today(), tr = Core.report(S, t, t), mr = Core.report(S, ...Object.values(Core.periodRange('month')));
  const chq = S.cheques.filter(c => !c.done).map(c => ({ c, st: Core.chequeStatus(c, t) })).filter(x => x.st !== 'later').sort((a, b) => a.c.dueDate < b.c.dueDate ? -1 : 1);
  const low = Core.productStats(S).filter(x => x.low);
  const days = S.settings.lastBackup ? Core.diffDays(S.settings.lastBackup, t) : null;
  const hasData = S.people.length || S.invoices.length || S.tx.length;
  let h = '';
  if (!hasData && !S.products.length) h += '<div class="card welcome"><b>به حسابداری فیکس کوییک خوش آمدید 👋</b><p>برای شروع: اول <a data-act="go" data-h="#/people">اشخاص</a> (مشتری/تأمین‌کننده) و <a data-act="go" data-h="#/products">کالاها</a> را ثبت کنید، بعد فاکتور بزنید. همه اطلاعات روی همین گوشی ذخیره می‌شود؛ حتماً گاهی از «بیشتر ← پشتیبان» نسخه بگیرید.</p></div>';
  if (can('backup') && hasData && (days === null || days > 7)) h += '<div class="alert warn">' + ico('save') + (days === null ? 'هنوز پشتیبان نگرفته‌اید.' : 'آخرین پشتیبان ' + fa(days) + ' روز پیش بوده.') + ' <button class="lnk" data-act="backup">پشتیبان بگیر</button></div>';
  h += '<button class="gsbar" data-act="go" data-h="#/search">' + ico('search') + '<span>جستجوی همه‌چیز: شخص، کالا، سریال، فاکتور…</span></button>';
  h += dailyCard(t, tr);
  const sts = (can('balances') ? stat('طلب من از مشتریان', fmt(rp.receivable), rp.receivable ? 'debit' : 'zero', UNIT()) + stat('بدهی من به دیگران', fmt(rp.payable), rp.payable ? 'credit' : 'zero', UNIT()) : '') + (can('reports') ? stat('موجودی صندوق/بانک', fmt(cash), cash < 0 ? 'debit' : '', UNIT()) : '') + (can('cost') ? stat('ارزش انبار', fmt(inv), '', UNIT()) : '');
  if (sts) h += '<div class="stats">' + sts + '</div>';
  h += '<div class="quick"><button class="q green" data-act="newInv" data-t="sale">' + ico('receipt') + '<span>فروش</span></button><button class="q blue" data-act="newInv" data-t="purchase">' + ico('cart') + '<span>خرید</span></button><button class="q" data-act="quickTx" data-t="receipt">' + ico('in') + '<span>دریافت</span></button><button class="q" data-act="quickTx" data-t="payment">' + ico('out') + '<span>پرداخت</span></button></div>';
  const pl = [['today', 'امروز'], ['yesterday', 'دیروز'], ['mtd', 'از اول ماه'], ['fytd', 'از اول سال مالی']].map(([k, l]) => { const rg = Core.periodRange(k, t, fyMonth()), r = Core.report(S, rg.from, rg.to); return '<button class="pl" data-act="plGo" data-k="' + k + '"><small>' + l + '</small><b class="' + (r.net < 0 ? 'debit' : r.net > 0 ? 'credit' : 'zero') + '">' + fmt(r.net) + '</b><em>فروش ' + fmt(r.revenue) + '</em></button>'; }).join('');
  if (can('reports') && can('cost')) h += '<div class="card"><div class="ch">' + ico('up') + 'سود و زیان خالص (' + UNIT() + ') <button class="lnk" data-act="go" data-h="#/reports">جزئیات</button></div><div class="plgrid">' + pl + '</div></div>';
  if (chq.length) h += '<div class="card"><div class="ch">' + ico('clock') + 'چک و اقساط نزدیک/معوق</div>' + chq.slice(0, 5).map(x => '<button class="row" data-act="go" data-h="#/cheques"><span><b>' + esc(x.c.title) + '</b><small>' + (x.c.personId ? esc(personName(x.c.personId)) + ' · ' : '') + (x.c.direction === 'receive' ? 'دریافتی' : 'پرداختی') + ' · ' + fmtDate(x.c.dueDate) + '</small></span><em class="' + (x.st === 'overdue' ? 'debit' : '') + '">' + fmt(x.c.amount) + (x.st === 'overdue' ? ' ' + ico('alert') : '') + '</em></button>').join('') + '</div>';
  if (low.length) h += '<div class="card"><div class="ch">' + ico('down') + 'کمبود موجودی</div>' + low.slice(0, 5).map(x => '<button class="row" data-act="go" data-h="#/products"><span><b>' + esc(x.product.name) + '</b></span><em class="debit">' + Core.fmtQty(x.stock) + ' ' + esc(x.product.unit) + '</em></button>').join('') + '</div>';
  const recent = S.invoices.slice().sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id).slice(0, 4);
  if (recent.length) h += '<div class="card"><div class="ch">آخرین فاکتورها <button class="lnk" data-act="go" data-h="#/invoices">همه</button></div>' + recent.map(i => invRow(i)).join('') + '</div>';
  if (!licOk) { const left = freeLeft(); if (left <= 10) h = '<div class="alert' + (left ? '' : ' warn') + '">' + (left ? ico('star') + fa(left) + ' فاکتور و سند رایگان باقی مانده است.' : ico('star') + 'ثبت رایگان تمام شده است.') + ' <button class="lnk" data-act="activate">نسخه نامحدود</button></div>' + h; }
  const errs = diagLoad(); let seen = 0; try { seen = +localStorage.getItem('fq_err_seen') || 0; } catch (e) { /* ignore */ }
  if (errs.length > seen) h = '<div class="alert warn">' + ico('alert') + 'برنامه با خطا روبه‌رو شده است. لطفاً گزارش را بفرستید تا برطرف شود. <button class="lnk" data-act="reportWa">ارسال گزارش</button> <button class="lnk" data-act="errSeen">بستن</button></div>' + h;
  return { title: S.settings.business || 'حسابداری فیکس کوییک', html: h };
}
// «امروز در یک نگاه»: sales, profit, money in/out, cheques due, items to reorder
function dailyCard(t, tr) {
  const sales = S.invoices.filter(i => i.date === t && i.type === 'sale'), cs = Core.cashSummary(S, t, t), tm = Core.addDays(t, 1);
  const chq = S.cheques.filter(c => !c.done && (c.dueDate === t || c.dueDate === tm)), od = S.cheques.filter(c => !c.done && c.dueDate < t).length;
  const re = Core.stockInsights(S, t).reorder.length, it = [];
  it.push('<div><small>فروش امروز</small><b>' + fa(sales.length) + ' فاکتور</b><em>' + fmt(tr.revenue) + '</em></div>');
  if (can('cost') && can('reports')) it.push('<div><small>سود امروز</small><b class="' + (tr.net < 0 ? 'debit' : 'credit') + '">' + fmt(tr.net) + '</b><em>' + UNIT() + '</em></div>');
  it.push('<div><small>دریافت / پرداخت</small><b class="credit">' + fmt(cs.in) + '</b><em class="debit">' + fmt(cs.out) + '</em></div>');
  const extra = [];
  if (chq.length || od) extra.push('<button class="lnk" data-act="go" data-h="#/cheques">' + ico('clock') + (chq.length ? fa(chq.length) + ' چک/قسط امروز و فردا' : '') + (od ? (chq.length ? ' · ' : '') + fa(od) + ' معوق' : '') + '</button>');
  if (re) extra.push('<button class="lnk" data-act="go" data-h="#/stock">' + ico('package') + fa(re) + ' کالا نیاز به سفارش</button>');
  return '<div class="card today"><div class="ch">' + ico('calendar') + 'امروز در یک نگاه</div><div class="tdg">' + it.join('') + '</div>' + (extra.length ? '<div class="tdx">' + extra.join('') + '</div>' : '') + '</div>';
}
function invNotes(i) { return [i.note].concat((i.items || []).map(l => l.note)).filter(Boolean); }
function invRow(i, q) {
  const hit = q ? (invNotes(i).find(x => matchQ(x, q)) || '') : '';
  const info = Core.invoiceInfo(S, i); const badge = info.remaining === 0 ? '<span class="bd ok">تسویه</span>' : info.paid > 0 ? '<span class="bd mid">مانده ' + fmt(info.remaining) + '</span>' : '<span class="bd no">تسویه نشده</span>';
  return '<button class="row" data-act="go" data-h="#/inv/' + i.id + '"><span><b>' + esc(personName(i.personId)) + '</b><small>' + Core.TYPE_FA[i.type] + ' · شماره ' + fa(i.no) + ' · ' + fmtDate(i.date) + '</small>' + (hit ? '<small class="hit">' + ico('search') + esc(hit) + '</small>' : '') + '</span><span class="end"><em>' + fmt(info.total) + '</em>' + badge + '</span></button>';
}

/* ─────────── PEOPLE ─────────── */
function pagePeople() {
  const b = Core.balances(S), q = Core.toEn(UI.peopleQ).trim().toLowerCase();
  let list = S.people.filter(p => UI.showArchived ? p.archived : !p.archived);
  if (q) list = list.filter(p => matchQ(p.name + ' ' + p.phone + ' ' + (p.note || ''), q));
  if (UI.peopleF === 'debit') list = list.filter(p => b[p.id] > 0); else if (UI.peopleF === 'credit') list = list.filter(p => b[p.id] < 0); else if (UI.peopleF === 'zero') list = list.filter(p => !b[p.id]);
  list.sort((x, y) => UI.peopleF === 'debit' ? b[y.id] - b[x.id] : UI.peopleF === 'credit' ? b[x.id] - b[y.id] : faCmp(x.name, y.name));
  const rp = Core.receivablePayable(S);
  let h = can('balances') ? '<div class="stats">' + stat('جمع طلب‌های من', fmt(rp.receivable), rp.receivable ? 'debit' : 'zero') + stat('جمع بدهی‌های من', fmt(rp.payable), rp.payable ? 'credit' : 'zero') + '</div>' : '';
  h += '<input class="inp" id="people-q" placeholder="جستجوی نام یا تلفن…" value="' + esc(UI.peopleQ) + '" autocomplete="off">' + chips('peopleF', UI.peopleF, [['all', 'همه'], ['debit', 'طلب من'], ['credit', 'بدهی من'], ['zero', 'تسویه']]);
  h += list.length ? '<div class="card flush">' + list.slice(0, UI.limPeople).map(p => '<button class="row" data-act="go" data-h="#/person/' + p.id + '"><span><b>' + esc(p.name) + '</b><small>' + (esc(p.phone) || '&nbsp;') + '</small></span><span class="end">' + (can('balances') ? bal(b[p.id]) + '<small>' + (b[p.id] ? sign(b[p.id]) : '') + '</small>' : '') + '</span></button>').join('') + '</div>' + moreBtn('limPeople', Math.min(UI.limPeople, list.length), list.length)
    : empty(ico('users'), q || UI.peopleF !== 'all' ? 'موردی پیدا نشد.' : 'هنوز شخصی ثبت نکرده‌اید.', q ? '' : '<button class="btn blue" data-act="addPerson">+ افزودن شخص</button>');
  h += '<button class="lnk center" data-act="bulkPeople">' + ico('listplus') + 'افزودن چند شخص یک‌جا</button>';
  if (S.people.some(p => p.archived)) h += '<button class="lnk center" data-act="toggleArchived">' + (UI.showArchived ? 'نمایش فعال‌ها' : 'نمایش بایگانی‌شده‌ها') + '</button>';
  return { title: 'اشخاص', html: h, fab: ['addPerson', '+'] };
}

function bulkPeople() {
  const sh = sheet('افزودن چند شخص یک‌جا', '<form id="bpf"><p class="hint">هر شخص را در یک خط بنویسید. اگر خواستید، شماره موبایل را بعد از نام بنویسید؛ مثلاً «علی رضایی ۰۹۱۲۱۲۳۴۵۶۷». نام‌های تکراری نادیده گرفته می‌شوند.</p><textarea class="inp" name="t" rows="9" style="height:auto;padding:10px" placeholder="رضا احمدی ۰۹۱۲۳۴۵۶۷۸۹&#10;مهدی کریمی&#10;فروشگاه نور"></textarea><button class="btn blue" type="submit">افزودن اشخاص</button></form>');
  sh.q('#bpf').onsubmit = async e => {
    e.preventDefault(); const lines = Array.from(new Set(e.target.t.value.split(/\n/).map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean)));
    if (!lines.length) return toast('نامی نوشته نشده است.', true);
    let add = 0, dup = 0;
    for (const ln of lines) { const { name, phone } = splitNamePhone(ln); const r = Core.addPerson(S, { name, phone }); if (r.ok) add++; else dup++; }
    if (add) await save(); sh.close(); toast(fa(add) + ' شخص اضافه شد' + (dup ? ' (' + fa(dup) + ' مورد تکراری بود)' : '') + '.', !add); render();
  };
  autoFocus(() => sh.q('[name=t]'));
}
function splitNamePhone(ln) {
  const en = Core.toEn(ln), m = en.match(/^(.*?)[\s,،:\-]*((?:\+98|0098|0)?9\d{9})\s*$/);
  if (!m || !m[1].trim()) return { name: ln, phone: '' };
  return { name: ln.slice(0, m[1].length).replace(/[\s,،:\-]+$/, '').trim(), phone: m[2] };
}
function personForm(p) {
  const sh = sheet(p ? 'ویرایش شخص' : 'شخص جدید', '<form id="pf"><label class="fld"><span>نام</span><input class="inp" name="name" value="' + esc(p ? p.name : '') + '" autocomplete="off"></label><label class="fld"><span>تلفن</span><input class="inp ltr" name="phone" inputmode="tel" value="' + esc(p ? p.phone : '') + '"></label><label class="fld"><span>توضیحات</span><input class="inp" name="note" value="' + esc(p ? p.note : '') + '"></label>' +
    (p ? '' : '<div class="fld"><span>مانده اول دوره (اختیاری)</span><div class="row2"><select class="inp" name="obk"><option value="1">او به من بدهکار است (طلب من)</option><option value="-1">من به او بدهکارم (بدهی من)</option></select><input class="inp ltr" name="ob" data-money inputmode="numeric" placeholder="مبلغ" autocomplete="off"></div></div>') +
    '<button class="btn blue" type="submit">ذخیره</button></form>');
  sh.q('#pf').onsubmit = async e => {
    e.preventDefault(); const f = sh.q('#pf'); const d = { name: f.name.value, phone: f.phone.value, note: f.note.value };
    if (!p) { const ob = f.ob.value.trim() === '' ? 0 : Core.parseMoney(f.ob.value); if (isNaN(ob)) return toast('مبلغ مانده نامعتبر است.', true); d.opening = ob * (+f.obk.value); d.date = today(); }
    const r = p ? Core.editPerson(S, p.id, d) : Core.addPerson(S, d);
    if (await done(r, 'ذخیره شد.')) { sh.close(); if (!p && r.person) goHash('#/person/' + r.person.id); }
  };
  autoFocus(() => sh.q('[name=name]'));
}

function pagePerson(id) {
  if (UI.ledgerFor !== id) { UI.ledgerFor = id; UI.limLedger = 200; }
  const p = Core.byId(S.people, +id); if (!p) return { title: 'شخص', html: empty(ico('help'), 'شخص پیدا نشد.', backTo('#/people')), back: '#/people' };
  const from = UI.stmtFrom, to = UI.stmtTo, L = Core.ledger(S, p.id, from, to), b = Core.balanceOf(S, p.id);
  let h = '<div class="card hero ' + (b > 0 ? 'd' : b < 0 ? 'c' : '') + '"><small>' + (!can('balances') ? 'مانده حساب' : b > 0 ? 'این شخص به شما بدهکار است' : b < 0 ? 'شما به این شخص بدهکارید' : 'حساب تسویه است') + '</small>' + (can('balances') ? '<b>' + fmt(Math.abs(b)) + ' <i>' + UNIT() + '</i></b>' : '<b>—</b>') + (p.phone ? '<a class="tel" href="tel:' + esc(Core.toEn(p.phone)) + '">' + ico('phone') + esc(p.phone) + '</a>' : '') + (p.note ? '<small>' + esc(p.note) + '</small>' : '') + '</div>';
  h += '<div class="quick four"><button class="q" data-act="txForm" data-t="receipt" data-p="' + p.id + '">' + ico('in') + '<span>دریافت</span></button><button class="q" data-act="txForm" data-t="payment" data-p="' + p.id + '">' + ico('out') + '<span>پرداخت</span></button><button class="q green" data-act="newInv" data-t="sale" data-p="' + p.id + '">' + ico('receipt') + '<span>فروش</span></button><button class="q blue" data-act="newInv" data-t="purchase" data-p="' + p.id + '">' + ico('cart') + '<span>خرید</span></button></div>';
  h += '<div class="toolbar"><button class="btn ghost sm" data-act="txForm" data-t="manual" data-p="' + p.id + '">+ ثبت دستی</button><button class="btn ghost sm" data-act="transfer" data-p="' + p.id + '">' + ico('transfer') + 'حواله</button><button class="btn ghost sm" data-act="stmtRange">' + ico('calendar') + 'بازه</button><button class="btn ghost sm" data-act="shareStmt" data-p="' + p.id + '">' + ico('share') + 'ارسال</button><button class="btn ghost sm" data-act="csvStmt" data-p="' + p.id + '">' + ico('file') + 'CSV</button><button class="btn ghost sm" data-act="editPerson" data-p="' + p.id + '">' + ico('edit') + 'ویرایش</button></div>';
  if (from || to) h += '<div class="alert">بازه: ' + (from ? fmtDate(from) : 'ابتدا') + ' تا ' + (to ? fmtDate(to) : 'انتها') + ' <button class="lnk" data-act="stmtClear">حذف فیلتر</button></div>';
  h += '<div class="card flush ledger"><div class="lh"><span>تاریخ / شرح</span><span>اضافه</span><span>کم</span><span>مانده</span></div>';
  if (from && L.carry) h += '<div class="lr muted"><span>مانده از قبل</span><span></span><span></span><span>' + bal(L.carry) + '</span></div>';
  const lrows = L.rows.slice().reverse(), lshow = lrows.slice(0, UI.limLedger);
  h += L.rows.length ? lshow.map(r => '<button class="lr" data-act="txOpen" data-id="' + r.tx.id + '"><span><b>' + esc(fa(r.tx.desc || Core.TYPE_FA[r.tx.type] || 'ثبت دستی')) + '</b><small>' + fmtDate(r.tx.date) + (r.tx.method ? ' · ' + Core.METHODS[r.tx.method] : '') + '</small></span><span class="debit">' + (r.debit ? fmt(r.debit) : '') + '</span><span class="credit">' + (r.credit ? fmt(r.credit) : '') + '</span><span>' + (can('balances') ? bal(r.balance) : '') + '</span></button>').join('') : '<div class="empty">تراکنشی ثبت نشده است.</div>';
  h += moreBtn('limLedger', lshow.length, lrows.length);
  h += '</div><p class="hint">«اضافه» یعنی طلب شما از او بیشتر شد (مثلاً فروش به او). «کم» یعنی کمتر شد (مثلاً گرفتن پول از او، یا خرید از او).</p><div class="toolbar"><button class="btn ghost sm" data-act="archive" data-p="' + p.id + '">' + (p.archived ? ico('restore') + 'فعال‌سازی' : ico('archive') + 'بایگانی') + '</button><button class="btn ghost sm red" data-act="delPerson" data-p="' + p.id + '">' + ico('trash') + 'حذف شخص</button></div>';
  return { title: p.name, html: h, back: '#/people' };
}

/* tx forms */
function txForm(type, personId, tx, pre) {
  const titles = { receipt: 'دریافت از شخص', payment: 'پرداخت به شخص', manual: 'ثبت دستی در حساب' };
  const t = tx ? tx.type : type; const isPay = t === 'receipt' || t === 'payment';
  const sh = sheet(tx ? 'ویرایش تراکنش' : titles[t], '<form id="tf"><label class="fld"><span>شخص</span><button type="button" class="inp pick" id="tf-p">' + esc(personId ? personName(personId) : 'انتخاب شخص…') + '</button></label>' +
    (t === 'manual' ? '<label class="fld"><span>نوع</span><select class="inp" name="kind"><option value="debit">او به من بدهکار شد (طلب من زیاد شود)</option><option value="credit">من به او بدهکار شدم (بدهی من زیاد شود)</option></select></label>' : '') +
    moneyField('amount', tx ? tx.amount : 0, 'مبلغ (' + UNIT() + ')') + (personId && !tx && isPay ? '<button type="button" class="lnk" id="tf-full">تسویه کامل مانده</button>' : '') +
    (isPay ? methodSel(tx && tx.method) : '') + dateField('date', tx ? tx.date : today()) + '<label class="fld"><span>شرح</span><input class="inp" name="desc" value="' + esc(tx ? tx.desc : '') + '"></label><button class="btn blue" type="submit">ثبت</button></form>');
  const f = sh.q('#tf'); if (tx && f.kind) f.kind.value = tx.kind;
  const setP = id => { personId = id; sh.q('#tf-p').textContent = personName(id); };
  if (tx) sh.q('#tf-p').disabled = true; else sh.q('#tf-p').onclick = () => pickList('انتخاب شخص', personItems(), v => setP(+v));
  const full = sh.q('#tf-full'); if (full) full.onclick = () => { const b = Core.balanceOf(S, personId); if (!b) return toast('مانده صفر است.'); f.amount.value = Core.fmtInput((Math.abs(b))); };
  f.onsubmit = async e => {
    e.preventDefault(); const amount = Core.parseMoney(f.amount.value), date = readDate(f, 'date');
    if (!date) return toast('تاریخ نامعتبر است.', true); if (!amount) return toast('مبلغ را درست وارد کنید.', true);
    if (!tx && !gate()) return;
    const r = tx ? Core.editTx(S, tx.id, { amount, date, desc: f.desc.value, kind: f.kind ? f.kind.value : tx.kind, method: f.method ? f.method.value : null })
      : Core.addTx(S, { personId, type: t, kind: f.kind ? f.kind.value : null, amount, date, desc: f.desc.value || titles[t], method: f.method ? f.method.value : null, ref: pre && pre.ref || null });
    if (await done(r, 'ثبت شد.')) { if (!tx) bumpUsage(); sh.close(); }
  };
}
function transferForm(fromId, group) {
  const ti = group ? Core.transferInfo(S, group) : null;
  let from = ti ? ti.fromId : (fromId || null), to = ti ? ti.toId : null;
  const sh = sheet(ti ? 'ویرایش حواله' : 'حواله بین دو شخص', '<form id="xf"><label class="fld"><span>از حساب (پرداخت‌کننده)</span><button type="button" class="inp pick" id="xf-a">' + esc(from ? personName(from) : 'انتخاب…') + '</button></label><label class="fld"><span>به حساب (دریافت‌کننده)</span><button type="button" class="inp pick" id="xf-b">' + esc(to ? personName(to) : 'انتخاب…') + '</button></label>' + moneyField('amount', ti ? ti.amount : 0, 'مبلغ') + dateField('date', ti ? ti.date : today()) + '<label class="fld"><span>شرح</span><input class="inp" name="desc" value="' + esc(ti ? ti.desc : '') + '"></label><p class="hint">مبلغ از حساب مبدأ کم و به حساب مقصد اضافه می‌شود.</p><button class="btn blue" type="submit">' + (ti ? 'ذخیره تغییرات' : 'ثبت حواله') + '</button></form>');
  sh.q('#xf-a').onclick = () => pickList('از حساب', personItems(), v => { from = +v; sh.q('#xf-a').textContent = personName(from); });
  sh.q('#xf-b').onclick = () => pickList('به حساب', personItems(), v => { to = +v; sh.q('#xf-b').textContent = personName(to); });
  const f = sh.q('#xf'); f.onsubmit = async e => { e.preventDefault(); const date = readDate(f, 'date'), amount = Core.parseMoney(f.amount.value); if (!date) return toast('تاریخ نامعتبر است.', true); if (!amount) return toast('مبلغ را درست وارد کنید.', true); if (ti) { if (await done(Core.editTransfer(S, group, { fromId: from, toId: to, amount, date, desc: f.desc.value }), 'حواله اصلاح شد.')) sh.close(); return; } if (!gate()) return; if (await done(Core.addTransfer(S, { fromId: from, toId: to, amount, date, desc: f.desc.value }), 'حواله ثبت شد.')) { bumpUsage(); sh.close(); } };
}
function txOpen(id) {
  const t = Core.byId(S.tx, id); if (!t) return;
  const inv = t.ref ? Core.byId(S.invoices, t.ref) : null;
  const sh = sheet('جزئیات تراکنش', '<div class="kv"><span>شخص</span><b>' + esc(personName(t.personId)) + '</b><span>تاریخ</span><b>' + fmtDate(t.date) + '</b><span>مبلغ</span><b class="' + (t.kind === 'debit' ? 'debit' : 'credit') + '">' + fmt(t.amount) + ' ' + (t.kind === 'debit' ? 'اضافه به حساب او' : 'کم از حساب او') + '</b>' + (t.method ? '<span>روش</span><b>' + Core.METHODS[t.method] + '</b>' : '') + '<span>شرح</span><b>' + esc(fa(t.desc || '—')) + '</b></div><div class="row2">' + (inv ? '<button class="btn blue" data-go="#/inv/' + inv.id + '">مشاهده فاکتور</button>' : '') + (inv && t.type === 'invoice' ? '<button class="btn ghost" data-go="#/edit/' + inv.id + '">' + ico('edit') + 'ویرایش فاکتور</button>' : '') + (t.type === 'transfer' ? '<button class="btn ghost" data-xedit>' + ico('edit') + 'ویرایش حواله</button>' : '') + (t.type !== 'invoice' && t.type !== 'transfer' ? '<button class="btn ghost" data-edit>' + ico('edit') + 'ویرایش</button>' : '') + (t.type !== 'invoice' ? '<button class="btn red" data-del>' + ico('trash') + 'حذف</button>' : '') + '</div>');
  if (!can('edit')) sh.el.querySelectorAll('[data-xedit],[data-edit],[data-del]').forEach(x => x.remove()); if (!can('edit')) sh.el.querySelectorAll('[data-go^="#/edit/"]').forEach(x => x.remove());
  sh.el.querySelectorAll('[data-go]').forEach(g => g.onclick = () => { sh.close(); goHash(g.dataset.go); });
  const xe = sh.q('[data-xedit]'); if (xe) xe.onclick = () => { sh.close(); transferForm(null, t.group); };
  const ed = sh.q('[data-edit]'); if (ed) ed.onclick = () => { sh.close(); txForm(t.type, t.personId, t); };
  const dl = sh.q('[data-del]'); if (dl) dl.onclick = async () => { if (await confirmBox(t.group ? 'هر دو سمت این حواله حذف می‌شود. ادامه می‌دهید؟' : 'این تراکنش حذف شود؟', 'حذف', true)) { sh.close(); await done(Core.deleteTx(S, t.id), 'حذف شد.'); } };
}

/* ─────────── INVOICES ─────────── */
function pageInvoices() {
  const q = Core.toEn(UI.invQ).trim().toLowerCase();
  let list = S.invoices.slice().sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id);
  if (UI.invF !== 'all') list = list.filter(i => i.type === UI.invF);
  if (q) list = list.filter(i => matchQ(personName(i.personId) + ' ' + i.no + ' ' + invNotes(i).join(' ') + ' ' + i.items.map(l => prodName(l.productId)).join(' '), q));
  const sum = list.reduce((s, i) => s + Core.invoiceTotals(i).total, 0);
  let h = '<input class="inp" id="inv-q" placeholder="جستجوی نام، شماره فاکتور یا سریال…" value="' + esc(UI.invQ) + '" autocomplete="off">' + chips('invF', UI.invF, [['all', 'همه'], ['sale', 'فروش'], ['purchase', 'خرید'], ['sale_return', 'برگشت فروش'], ['purchase_return', 'برگشت خرید']]);
  h += list.length ? '<div class="card flush">' + list.slice(0, UI.limInv).map(i => invRow(i, q)).join('') + '</div>' + moreBtn('limInv', Math.min(UI.limInv, list.length), list.length) + '<p class="hint center">' + fa(list.length) + ' فاکتور · جمع: ' + fmt(sum) + ' ' + UNIT() + '</p>' : empty(ico('receipt'), 'فاکتوری ثبت نشده است.', '<div class="row2"><button class="btn green" data-act="newInv" data-t="sale">فاکتور فروش</button><button class="btn blue" data-act="newInv" data-t="purchase">فاکتور خرید</button></div>');
  return { title: 'فاکتورها', html: h, fab: ['newInv', '+'], fabData: { t: 'sale' } };
}

function pageInvoice(id) {
  const i = Core.byId(S.invoices, +id); if (!i) return { title: 'فاکتور', html: empty(ico('help'), 'فاکتور پیدا نشد.', backTo('#/invoices')), back: '#/invoices' };
  const info = Core.invoiceInfo(S, i); const pays = S.tx.filter(t => t.ref === i.id && (t.type === 'receipt' || t.type === 'payment'));
  const dirTxt = i.type === 'sale' || i.type === 'purchase_return' ? 'دریافت' : 'پرداخت';
  let h = '<div class="card"><div class="kv"><span>نوع</span><b>' + Core.TYPE_FA[i.type] + '</b><span>شماره</span><b>' + fa(i.no) + '</b><span>شخص</span><b><a data-act="go" data-h="#/person/' + i.personId + '">' + esc(personName(i.personId)) + '</a></b><span>تاریخ</span><b>' + fmtDate(i.date) + '</b>' + (i.note ? '<span>توضیحات</span><b>' + esc(i.note) + '</b>' : '') + '</div></div>';
  h += '<div class="card flush"><div class="lh it"><span>کالا</span><span>تعداد</span><span>قیمت</span><span>جمع</span></div>' + info.lines.map(l => '<div class="lr it"><span><b>' + esc(prodName(l.productId)) + '</b>' + (l.note ? '<small class="sn-t">' + ico('tag') + esc(l.note) + Core.extractSerials(l.note).map(sn => ' <button class="lnk snh" data-act="searchGo" data-q="' + esc(sn) + '">تاریخچه</button>').join('') + '</small>' : '') + '</span><span>' + Core.fmtQty(l.qty) + ' ' + esc(unitOf(l.productId)) + '</span><span>' + fmt(l.price) + '</span><span>' + fmt(l.gross) + '</span></div>').join('') + '</div>';
  h += '<div class="card"><div class="kv"><span>جمع اقلام</span><b>' + fmt(info.sub) + '</b>' + (info.discount ? '<span>تخفیف</span><b>' + fmt(info.discount) + '</b>' : '') + (info.vat ? '<span>ارزش افزوده (' + fa(info.vatRate) + '٪)</span><b>' + fmt(info.vat) + '</b>' : '') + '<span>جمع نهایی</span><b class="big">' + fmt(info.total) + ' ' + UNIT() + '</b><span>' + (dirTxt === 'دریافت' ? 'دریافت‌شده' : 'پرداخت‌شده') + '</span><b>' + fmt(info.paid) + '</b><span>مانده این فاکتور</span><b class="' + (info.remaining ? 'debit' : 'credit') + '">' + fmt(info.remaining) + '</b></div></div>';
  if (pays.length) h += '<div class="card"><div class="ch">پرداخت‌ها</div>' + pays.map(t => '<button class="row" data-act="txOpen" data-id="' + t.id + '"><span><b>' + fmtDate(t.date) + '</b><small>' + Core.METHODS[t.method] + '</small></span><em>' + fmt(t.amount) + '</em></button>').join('') + '</div>';
  h += '<div class="toolbar">' + (info.remaining > 0 ? '<button class="btn blue sm" data-act="payInv" data-id="' + i.id + '">' + (dirTxt === 'دریافت' ? ico('in') + 'ثبت دریافت' : ico('out') + 'ثبت پرداخت') + '</button>' : '') + '<button class="btn ghost sm" data-act="go" data-h="#/edit/' + i.id + '">' + ico('edit') + 'ویرایش</button><button class="btn ghost sm" data-act="shareInv" data-id="' + i.id + '">' + ico('share') + 'ارسال متن</button>' + '<button class="btn ghost sm" data-act="printInv" data-id="' + i.id + '">' + ico('printer') + 'چاپ فاکتور (A5)</button>' + '<button class="btn ghost sm red" data-act="delInv" data-id="' + i.id + '">' + ico('trash') + 'حذف</button></div>';
  return { title: Core.TYPE_FA[i.type] + ' ' + fa(i.no), html: h, back: '#/invoices' };
}
// the user's own name on invoices (settings → user settings); no brand fallback
function sellerName() { return String(S.settings.sellerName || S.settings.business || '').trim(); }
function invoiceText(i) {
  const info = Core.invoiceInfo(S, i);
  const weSell = i.type === 'sale' || i.type === 'sale_return', me = sellerName(), them = personName(i.personId);
  return ['فاکتور ' + Core.TYPE_FA[i.type] + ' شماره ' + fa(i.no), 'فروشنده: ' + ((weSell ? me : them) || '—'), 'خریدار: ' + ((weSell ? them : me) || '—'), 'تاریخ: ' + fmtDate(i.date), ''].concat(info.lines.map(l => '• ' + prodName(l.productId) + ' × ' + Core.fmtQty(l.qty) + ' × ' + fmt(l.price) + ' = ' + fmt(l.gross) + (l.note ? ' (' + l.note + ')' : '')), ['', 'جمع: ' + fmt(info.sub)], info.discount ? ['تخفیف: ' + fmt(info.discount)] : [], info.vat ? ['ارزش افزوده (' + fa(info.vatRate) + '٪): ' + fmt(info.vat)] : [], ['مبلغ نهایی: ' + fmt(info.total) + ' ' + UNIT(), 'پرداخت‌شده: ' + fmt(info.paid), 'مانده: ' + fmt(info.remaining)], ['', '— حسابداری فیکس کوییک' + (licOk ? '' : ' · fixq.ir')]).join('\n');
}

/* new invoice page */
function pageNewInvoice(type, preset) {
  const ed = preset && preset.edit ? preset.edit : null;
  if (ed) type = ed.type;
  if (!Core.TYPE_FA[type]) type = 'sale';
  const personId = ed ? ed.personId : (preset && preset.p ? +preset.p : null);
  const isSaleSide = type === 'sale' || type === 'sale_return';
  const payLabel = type === 'sale' ? 'دریافتی همزمان' : type === 'purchase' ? 'پرداختی همزمان' : type === 'sale_return' ? 'مبلغ بازپرداخت‌شده به مشتری' : 'مبلغ دریافتی از تأمین‌کننده';
  const first = ed ? Core.firstPayment(S, ed.id) : null;
  const vatOn = ed ? (ed.vatRate > 0) : (S.settings.vatOn !== false), vr = ed && ed.vatRate > 0 ? ed.vatRate : vatRateSet();
  let h = ed ? '<div class="alert">' + ico('edit') + 'در حال ویرایش فاکتور ' + Core.TYPE_FA[type] + ' شماره ' + fa(ed.no) + '. بعد از ذخیره، حساب شخص، انبار و سود و زیان خودکار اصلاح می‌شوند.</div>' : '<div class="chips">' + Object.keys(Core.TYPE_FA).map(k => '<button type="button" class="chip' + (k === type ? ' on' : '') + '" data-act="newInv" data-t="' + k + '"' + (personId ? ' data-p="' + personId + '"' : '') + '>' + Core.TYPE_FA[k] + '</button>').join('') + '</div>';
  h += '<form id="nf" class="card"' + (ed ? ' data-edit="' + ed.id + '"' : '') + '><input type="hidden" name="type" value="' + type + '"><input type="hidden" name="pid" value="' + (personId || '') + '"><input type="hidden" name="vr" value="' + vr + '"><label class="fld"><span>' + (isSaleSide ? 'مشتری' : 'تأمین‌کننده / فروشنده') + '</span><button type="button" class="inp pick" id="nf-p" data-act="pickInvPerson">' + (personId ? esc(personName(personId)) : 'انتخاب شخص…') + '</button></label><div class="row2">' + dateField('date', ed ? ed.date : today()) + '<label class="fld"><span>شماره فاکتور</span><input class="inp ltr" name="no" inputmode="numeric" value="' + fa(ed ? ed.no : Core.nextInvoiceNo(S)) + '"></label></div>' +
    '<div class="ch">اقلام</div><div id="rows"></div><div class="row2"><button type="button" class="btn ghost" data-act="addRow">+ افزودن قلم</button><button type="button" class="btn ghost" data-act="scanInv">' + ico('scan') + 'اسکن کالا</button></div>' +
    '<div class="sumbox"><div class="kv"><span>جمع اقلام</span><b id="s-sub">۰</b></div></div>' + moneyField('discount', ed ? ed.discount : 0, 'تخفیف (' + UNIT() + ')') +
    '<label class="chk vatchk"><input type="checkbox" name="vat"' + (vatOn ? ' checked' : '') + '> ارزش افزوده (' + fa(vr) + '٪)</label><div class="sumbox" id="s-vatbox"><div class="kv"><span>ارزش افزوده</span><b id="s-vat">۰</b></div></div>' +
    '<div class="sumbox"><div class="kv"><span>مبلغ نهایی</span><b class="big" id="s-tot">۰ ' + UNIT() + '</b></div></div>' + moneyField('paid', first ? first.amount : 0, payLabel) + '<div class="row2"><button type="button" class="lnk" data-act="payFull">تسویه کامل</button></div>' + methodSel(first ? first.method : 'cash') +
    '<div class="kv small"><span>' + ({ sale: 'او هنوز باید به من بدهد', purchase: 'من هنوز باید به او بدهم', sale_return: 'مانده‌ای که باید به او برگردانم', purchase_return: 'مانده‌ای که او باید به من برگرداند' }[type]) + '</span><b id="s-rem">۰</b></div><label class="fld"><span>توضیحات</span><input class="inp" name="note" value="' + esc(ed ? ed.note : '') + '"></label><button class="btn ' + (isSaleSide ? 'green' : 'blue') + '" type="submit" id="nf-save">' + (ed ? 'ذخیره تغییرات فاکتور' : 'ثبت فاکتور ' + Core.TYPE_FA[type]) + '</button></form>';
  return { title: ed ? 'ویرایش فاکتور ' + fa(ed.no) : 'فاکتور ' + Core.TYPE_FA[type], html: h, back: ed ? '#/inv/' + ed.id : '#/invoices', mount: () => {
    if (ed) ed.items.forEach(l => { addRow(); const rows = $$('.it-row'), r = rows[rows.length - 1], pr = Core.byId(S.products, l.productId); r.dataset.pid = l.productId; $('.pick', r).textContent = pr ? pr.name : '—'; $('[name=qty]', r).value = fa(l.qty); $('[name=price]', r).value = Core.fmtInput((l.price)); $('[name=sn]', r).value = l.note || ''; });
    else addRow();
    calcInvoice(); const f = $('#nf'); f.addEventListener('input', calcInvoice); f.addEventListener('change', calcInvoice); f.onsubmit = submitInvoice; } };
}
function addRow() {
  const rows = $('#rows'), d = document.createElement('div'); d.className = 'it-row'; d.dataset.pid = '';
  d.innerHTML = '<button type="button" class="inp pick" data-act="pickProd">انتخاب کالا…</button><small class="hint stk"></small><div class="g3"><label><span>تعداد</span><input class="inp ltr" name="qty" inputmode="decimal" value="' + fa(1) + '"></label><label><span>قیمت واحد</span><input class="inp ltr" name="price" data-money inputmode="numeric" placeholder="۰"></label><label><span>جمع</span><b class="lt">۰</b></label></div><label class="fld sn"><span>توضیحات / سریال (اختیاری)</span><input class="inp" name="sn" placeholder="مثلاً سریال دستگاه" autocomplete="off"></label><small class="rw"></small><button type="button" class="rm" data-act="rmRow" aria-label="حذف قلم">✕</button>';
  rows.appendChild(d);
}
function readInvoice() {
  const f = $('#nf'); const items = []; let bad = null;
  $$('.it-row', f).forEach((r, idx) => {
    const pid = +r.dataset.pid, qty = Core.parseQty($('[name=qty]', r).value), ps = $('[name=price]', r).value.trim(), price = ps === '' ? NaN : Core.parseMoney(ps);
    if (!pid) bad = bad || ('قلم ' + fa(idx + 1) + ': کالا را انتخاب کنید.'); else if (isNaN(qty)) bad = bad || ('قلم ' + fa(idx + 1) + ': تعداد نامعتبر است.'); else if (isNaN(price)) bad = bad || ('قلم ' + fa(idx + 1) + ': قیمت را وارد کنید.');
    items.push({ productId: pid, qty, price, note: $('[name=sn]', r).value.trim() });
  });
  return { items, bad, discount: readMoney(f, 'discount'), paid: readMoney(f, 'paid') };
}
function calcInvoice() {
  const f = $('#nf'); if (!f) return; const rd = readInvoice(); let sub = 0;
  $$('.it-row', f).forEach((r, i) => { const it = rd.items[i]; const t = (it.qty > 0 && it.price >= 0) ? Math.round(it.qty * it.price) : 0; sub += t; $('.lt', r).textContent = fmt(t); });
  const disc = isNaN(rd.discount) ? 0 : Math.min(rd.discount, sub), vat = f.vat && f.vat.checked ? Math.round((sub - disc) * (+f.vr.value || 0) / 100) : 0, tot = sub - disc + vat, paid = isNaN(rd.paid) ? 0 : rd.paid;
  $('#s-sub').textContent = fmt(sub); $('#s-vat').textContent = fmt(vat); $('#s-vatbox').hidden = !vat; $('#s-tot').textContent = fmt(tot) + ' ' + UNIT(); $('#s-rem').textContent = fmt(tot - paid);
  f.dataset.total = tot;
  rowChecks(rd, sub, disc);
}
const minMargin = () => (S.settings.minMargin == null ? 5 : +S.settings.minMargin || 0);
// per-row hints: thin or negative margin on sales, invalid IMEI, serial already sold / already in stock
function rowChecks(rd, sub, disc) {
  const f = $('#nf'), type = f.type.value, editId = +f.dataset.edit || 0, out = [];
  $$('.it-row', f).forEach((r, i) => {
    const it = rd.items[i], w = []; if (!it) return;
    if (type === 'sale' && it.productId && it.price > 0) {
      const p = Core.byId(S.products, it.productId), cost = Core.unitCost(S, it.productId) || (p && p.buyPrice) || 0, unit = sub ? it.price * (1 - disc / sub) : it.price;
      if (cost > 0) { const m = Math.round((unit - cost) / unit * 100); if (unit < cost - 0.5) w.push(['bad', 'زیر قیمت خرید' + (can('cost') ? ' (زیان هر عدد ' + fmt(Math.round(cost - unit)) + ')' : '')]); else if (m < minMargin()) w.push(['mid', 'سود کم' + (can('cost') ? ': ' + fa(m) + '٪ (' + fmt(Math.round(unit - cost)) + ' هر عدد)' : '')]); else if (can('cost')) w.push(['ok', 'سود: ' + fa(m) + '٪']); }
    }
    Core.extractSerials(it.note).forEach(sn => {
      if (/^\d{15}$/.test(sn) && !Core.luhnOk(sn)) { w.push(['bad', 'IMEI ' + sn + ' معتبر نیست؛ احتمالاً یک رقم اشتباه است.']); out.push('IMEI ' + sn + ' معتبر نیست.'); }
      const sw = Core.serialWarning(S, sn, type, editId); if (sw) { w.push(['bad', sw]); out.push(sw); }
    });
    const el = $('.rw', r); if (el) { el.innerHTML = w.map(x => '<span class="' + x[0] + '">' + esc(x[1]) + '</span>').join(''); }
    r.classList.toggle('warn', w.some(x => x[0] !== 'ok'));
  });
  f.dataset.serialWarn = JSON.stringify(out);
}
async function submitInvoice(e) {
  e.preventDefault(); const f = $('#nf'), rd = readInvoice(); const date = readDate(f, 'date'), editId = +f.dataset.edit || 0;
  if (!f.pid.value) return toast('شخص را انتخاب کنید.', true); if (!date) return toast('تاریخ نامعتبر است.', true); if (rd.bad) return toast(rd.bad, true);
  if (isNaN(rd.discount)) return toast('تخفیف نامعتبر است.', true); if (isNaN(rd.paid)) return toast('مبلغ پرداخت/دریافت نامعتبر است.', true);
  if (!editId && !gate()) return;
  const type = f.type.value;
  const sw = JSON.parse(f.dataset.serialWarn || '[]'); if (sw.length && !(await confirmBox('هشدار سریال:\n' + sw.join('\n') + '\nبا این حال ثبت شود؟', 'بله، ثبت کن', true))) return;
  // selling below cost: ask first
  if (type === 'sale') {
    const sub = rd.items.reduce((s, l) => s + Math.round(l.qty * l.price), 0), disc = Math.min(rd.discount || 0, sub), rp = Core.replay(S), low = [];
    rd.items.forEach(l => { const p = Core.byId(S.products, l.productId); if (!p) return; const st = rp.stock[p.id], cost = st && st.avg > 0 ? st.avg : p.buyPrice || 0; const unit = sub ? l.price * (1 - disc / sub) : l.price; if (cost > 0 && unit < cost - 0.5) low.push('«' + p.name + '»' + (can('cost') ? ': فروش ' + fmt(Math.round(unit)) + ' — خرید ' + fmt(Math.round(cost)) + ' (زیان ' + fmt(Math.round((cost - unit) * l.qty)) + ')' : '')); });
    if (low.length && !(await confirmBox('⚠️ این فروش زیر قیمت خرید است:\n' + low.join('\n') + '\nبا زیان ثبت شود؟', 'بله، ثبت کن', true))) return;
  }
  const d = { type, personId: +f.pid.value, date, no: Core.toEn(f.no.value).trim(), items: rd.items, discount: rd.discount, paid: rd.paid, method: f.method.value, note: f.note.value, vatRate: f.vat.checked ? (+f.vr.value || 0) : 0 };
  const r = editId ? Core.editInvoice(S, editId, d) : Core.addInvoice(S, d);
  if (!r.ok) return toast(r.error, true);
  S.settings.vatOn = f.vat.checked; if (!editId) bumpUsage(); save(); toast(editId ? 'تغییرات فاکتور ذخیره شد.' : 'فاکتور ثبت شد.'); goHash('#/inv/' + r.invoice.id);
}

/* ─────────── PRODUCTS ─────────── */
function catChips(cats, cur, total) {
  return '<div class="chips cats">' + [['', 'همه', total]].concat(cats.map(c => [c.cat, c.cat, c.n])).map(o => '<button type="button" class="chip' + (cur === o[0] ? ' on' : '') + '" data-act="chip" data-k="prodCat" data-v="' + esc(o[0]) + '">' + esc(o[1]) + ' <i>' + fa(o[2]) + '</i></button>').join('') + '</div>';
}
function prodFiltered() {
  const q = UI.prodQ.trim(); let list = S.products;
  if (UI.prodCat) list = list.filter(p => Core.catOf(p) === UI.prodCat);
  if (q) list = list.filter(p => matchQ(p.name + ' ' + p.sku + ' ' + (p.barcode || '') + ' ' + Core.catOf(p), q));
  return list;
}
function pageProducts() {
  const all = Core.productStats(S), cats = Core.categoryCounts(S);
  if (UI.prodCat && !cats.some(c => c.cat === UI.prodCat)) UI.prodCat = '';
  const keep = new Set(prodFiltered().map(p => p.id)); const st = all.filter(x => keep.has(x.product.id));
  st.forEach(x => { x.cat = Core.catOf(x.product); }); if (UI.prodQ.trim()) { const q = UI.prodQ; st.forEach(x => { x.qs = Core.matchScore(x.product.name + ' ' + (x.product.sku || '') + ' ' + x.cat, q); }); st.sort((a, b) => b.qs - a.qs || faCmp(a.product.name, b.product.name)); } else st.sort((a, b) => (UI.prodCat ? 0 : Core.catRank(a.cat) - Core.catRank(b.cat) || faCmp(a.cat, b.cat)) || faCmp(a.product.name, b.product.name));
  let h = '<div class="stats">' + stat('تعداد کالا', fa(all.length), '', fa(cats.length) + ' دسته') + (can('cost') ? stat('ارزش کل انبار', fmt(Core.inventoryValue(S)), '', UNIT()) : stat('دسته‌ها', fa(cats.length))) + '</div>';
  h += '<div class="toolbar ptools"><button class="btn blue sm" data-act="bulkProducts">' + ico('listplus') + 'افزودن چند کالا</button><button class="btn ghost sm" data-act="scanProd">' + ico('scan') + 'اسکن</button><button class="btn ghost sm" data-act="labelsAll">' + ico('qr') + 'برچسب</button><button class="btn ghost sm" data-act="go" data-h="#/stock">' + ico('up') + 'تحلیل انبار</button><button class="btn ghost sm" data-act="whTools">' + ico('archive') + 'پشتیبان و حذف</button></div>';
  h += '<input class="inp" id="prod-q" placeholder="جستجوی کالا یا دسته…" value="' + esc(UI.prodQ) + '" autocomplete="off">' + (cats.length ? catChips(cats, UI.prodCat || '', all.length) : '');
  if (st.length) {
    let last = null, rows = '';
    st.slice(0, UI.limProd).forEach(x => {
      if (!UI.prodCat && x.cat !== last) { last = x.cat; rows += '<div class="grp">' + esc(x.cat) + '</div>'; }
      rows += '<button class="row" data-act="prodOpen" data-id="' + x.product.id + '"><span><b>' + esc(x.product.name) + '</b><small>' + (x.product.sku ? esc(x.product.sku) + ' · ' : '') + (can('cost') ? 'میانگین خرید: ' + fmt(x.avg) : 'قیمت فروش: ' + fmt(x.product.salePrice)) + '</small></span><span class="end"><em class="' + (x.low ? 'debit' : '') + '">' + Core.fmtQty(x.stock) + ' ' + esc(x.product.unit) + '</em>' + (can('cost') ? '<small>' + fmt(x.value) + '</small>' : '') + '</span></button>';
    });
    h += '<div class="card flush">' + rows + '</div>' + moreBtn('limProd', Math.min(UI.limProd, st.length), st.length);
  } else h += empty(ico('package'), all.length ? 'موردی پیدا نشد.' : 'کالایی ثبت نشده است.', all.length ? '' : '<div class="row2"><button class="btn blue" data-act="addProduct">+ افزودن کالا</button><button class="btn ghost" data-act="prodImport">' + ico('folder') + 'ورود از فایل</button></div>');
  return { title: 'انبار و کالاها', html: h, fab: ['addProduct', '+'] };
}
function productForm(p, o) {
  o = o || {};
  const sh = sheet(p ? 'ویرایش کالا' : o.inInvoice ? 'کالای جدید (به انبار هم اضافه می‌شود)' : 'کالای جدید', '<form id="gf"><label class="fld"><span>نام کالا</span><input class="inp" name="name" value="' + esc(p ? p.name : '') + '" autocomplete="off"></label><div class="row2"><label class="fld"><span>کد (اختیاری)</span><input class="inp ltr" name="sku" value="' + esc(p ? p.sku : '') + '"></label><label class="fld"><span>واحد</span><input class="inp" name="unit" value="' + esc(p ? p.unit : 'عدد') + '"></label></div><label class="fld"><span>دسته‌بندی <small class="cat-auto">(خودکار از روی نام؛ در صورت نیاز عوض کنید)</small></span><input class="inp" name="cat" list="cat-list" autocomplete="off" value="' + esc(p ? Core.catOf(p) : (o.cat || '')) + '" data-auto="' + (p && p.category ? '0' : '1') + '"><datalist id="cat-list">' + Array.from(new Set(Core.CATS.concat(S.products.map(Core.catOf)))).map(c => '<option value="' + esc(c) + '">').join('') + '</datalist></label><label class="fld"><span>بارکد کارخانه (اختیاری)</span><div class="inrow"><input class="inp ltr" name="barcode" value="' + esc(p ? (p.barcode || '') : (o.barcode || '')) + '" autocomplete="off"><button type="button" class="btn ghost sm" id="gf-scan">' + ico('scan') + '</button></div></label>' + moneyField('salePrice', p ? p.salePrice : 0, 'قیمت فروش پیش‌فرض') + moneyField('buyPrice', p ? p.buyPrice : 0, 'قیمت خرید پیش‌فرض') + (p || o.inInvoice ? '' : '<label class="fld"><span>موجودی اولیه (اختیاری)</span><input class="inp ltr" name="openQty" inputmode="decimal" placeholder="۰" autocomplete="off"></label><p class="hint">اگر همین الان از این کالا دارید، تعدادش را بنویسید. با «قیمت خرید» بالا در انبار ثبت می‌شود و در سود و زیان حساب نمی‌شود. اگر فقط می‌خواهید نام کالا در فهرست باشد، فقط «نام کالا» را بنویسید و بقیه را خالی بگذارید.</p>') + '<label class="fld"><span>حداقل موجودی (هشدار)</span><input class="inp ltr" name="minStock" inputmode="decimal" value="' + fa(p ? p.minStock : 0) + '"></label><button class="btn blue" type="submit">ذخیره</button></form>');
  const f = sh.q('#gf'); f.name.addEventListener('input', () => { if (f.cat.dataset.auto === '1') f.cat.value = f.name.value.trim() ? Core.guessCategory(f.name.value) : ''; }); f.cat.addEventListener('input', () => { f.cat.dataset.auto = f.cat.value.trim() ? '0' : '1'; }); sh.q('#gf-scan').onclick = () => openScanner({ title: 'اسکن بارکد کالا', onCode: t => { f.barcode.value = t; } }); f.onsubmit = async e => { e.preventDefault(); const d = { name: f.name.value, barcode: f.barcode.value, sku: f.sku.value, unit: f.unit.value, salePrice: Core.parseMoney(f.salePrice.value || '0'), buyPrice: Core.parseMoney(f.buyPrice.value || '0'), minStock: Core.parseNum(f.minStock.value || '0'), category: f.cat.value.trim() }; if (isNaN(d.salePrice) || isNaN(d.buyPrice) || isNaN(d.minStock)) return toast('مقادیر عددی نامعتبر است.', true); const oq = (!p && f.openQty && f.openQty.value.trim() !== '') ? Core.parseNum(f.openQty.value) : 0; if (isNaN(oq) || oq < 0) return toast('موجودی اولیه نامعتبر است.', true); if (oq > 0 && !(d.buyPrice > 0)) return toast('برای موجودی اولیه، قیمت خرید را هم وارد کنید.', true); let r = p ? Core.editProduct(S, p.id, d) : Core.addProduct(S, d); if (o.onSaved && r.ok && !p) { await save(); sh.close(); toast('کالا به انبار اضافه شد.'); o.onSaved(r.product); return; } if (r.ok && !p && oq > 0) { const a = Core.addAdjust(S, { productId: r.product.id, qty: oq, cost: d.buyPrice, date: today(), note: 'موجودی اولیه', opening: true }); if (!a.ok) { Core.deleteProduct(S, r.product.id); r = a; } } if (await done(r, 'ذخیره شد.')) sh.close(); };
  autoFocus(() => f.name);
}
function bulkProducts() {
  const sh = sheet('افزودن چند کالا با نام', '<form id="bf"><p class="hint">هر نام کالا را در یک خط بنویسید. فقط نام ثبت می‌شود؛ قیمت و موجودی را بعداً (مثلاً با فاکتور خرید) وارد می‌کنید. هر کالا خودکار در دسته خودش (آیفون، کابل، شارژر، قاب و…) قرار می‌گیرد. نام‌های تکراری نادیده گرفته می‌شوند.</p><textarea class="inp" name="t" rows="8" style="height:auto;padding:10px" placeholder="گوشی سامسونگ A15&#10;کابل شارژ تایپ‌سی&#10;قاب ژله‌ای"></textarea><button class="btn blue" type="submit">افزودن به انبار</button></form>');
  sh.q('#bf').onsubmit = async e => { e.preventDefault(); const names = Array.from(new Set(e.target.t.value.split(/\n/).map(s => s.trim()).filter(Boolean))); if (!names.length) return toast('نامی نوشته نشده است.', true); let add = 0, dup = 0; for (const n of names) { const r = Core.addProduct(S, { name: n }); if (r.ok) add++; else dup++; } if (add) await save(); sh.close(); toast(fa(add) + ' کالا اضافه شد و در دسته خودش قرار گرفت' + (dup ? ' (' + fa(dup) + ' مورد تکراری بود)' : '') + '.', !add); render(); };
  autoFocus(() => sh.q('[name=t]'));
}
function labelSheet(list) {
  const one = list.length === 1;
  const sh = sheet('چاپ برچسب کیو آر', '<form id="lf"><p class="hint">برگه A4 با ۲۴ برچسب (۷۰ × ۳۷ میلی‌متر، اندازه برگه‌های برچسب آماده). ' + (one ? '' : fa(list.length) + ' کالا انتخاب شده است.') + '</p><label class="fld"><span>' + (one ? 'تعداد برچسب' : 'تعداد برچسب از هر کالا') + '</span><input class="inp ltr" name="n" inputmode="numeric" value="' + fa(one ? 24 : 1) + '"></label><label class="chk"><input type="checkbox" name="price" checked> قیمت فروش روی برچسب باشد</label><label class="chk"><input type="checkbox" name="guides"> خط برش دور برچسب‌ها (برای کاغذ معمولی)</label><button class="btn blue" type="submit">ساخت فایل چاپ</button></form>');
  sh.q('#lf').onsubmit = e => { e.preventDefault(); const f = e.target, n = Core.parseNum(f.n.value); if (!(n >= 1 && n <= 480)) return toast('تعداد نامعتبر است.', true); sh.close(); printLabels(list, Math.round(n), { price: f.price.checked, guides: f.guides.checked }); };
}
function prodOpen(id) {
  const x = Core.productStats(S).find(s => s.product.id === id); if (!x) return; const p = x.product;
  const sh = sheet(p.name, '<div class="qrbox"><div id="pq-qr"></div><div><b>کیو آر کد کالا</b><small>برای ثبت سریع در فاکتور، این کد را روی کالا بچسبانید و اسکن کنید.</small>' + (p.barcode ? '<small class="ltr">بارکد: ' + esc(p.barcode) + '</small>' : '') + '<button class="btn ghost sm" data-l>' + ico('qr') + 'چاپ برچسب</button></div></div><div class="kv"><span>دسته</span><b>' + esc(Core.catOf(p)) + '</b><span>موجودی</span><b>' + Core.fmtQty(x.stock) + ' ' + esc(p.unit) + '</b>' + (can('cost') ? '<span>میانگین قیمت خرید</span><b>' + fmt(x.avg) + '</b><span>ارزش موجودی</span><b>' + fmt(x.value) + '</b>' : '') + '<span>قیمت فروش پیش‌فرض</span><b>' + fmt(p.salePrice) + '</b></div><div class="row2"><button class="btn blue" data-k>' + ico('book') + 'کاردکس</button><button class="btn ghost" data-a>' + ico('scale') + 'تعدیل موجودی</button><button class="btn ghost" data-e>' + ico('edit') + 'ویرایش</button><button class="btn red" data-d>' + ico('trash') + 'حذف</button></div>');
  const qc = qrCanvas(prodQrText(p), 220); qc.style.width = '110px'; qc.style.height = '110px'; sh.q('#pq-qr').appendChild(qc);
  if (!can('cost')) sh.q('[data-k]').remove(); if (!can('warehouse')) ['[data-a]', '[data-e]', '[data-d]'].forEach(k => sh.q(k).remove());
  sh.q('[data-l]').onclick = () => labelSheet([p]);
  if (sh.q('[data-k]')) sh.q('[data-k]').onclick = () => { sh.close(); goHash('#/kardex/' + p.id); }; if (sh.q('[data-a]')) { sh.q('[data-a]').onclick = () => { sh.close(); adjustForm(p); }; sh.q('[data-e]').onclick = () => { sh.close(); productForm(p); }; }
  if (sh.q('[data-d]')) sh.q('[data-d]').onclick = async () => { if (await confirmBox('کالای «' + p.name + '» حذف شود؟', 'حذف', true)) { sh.close(); await done(Core.deleteProduct(S, p.id), 'حذف شد.'); } };
}
function adjustForm(p) {
  const sh = sheet('تعدیل موجودی: ' + p.name, '<form id="af"><p class="hint">برای کم‌کردن موجودی (ضایعات، شمارش انبار) علامت منفی بگذارید؛ مثلاً ‎-۲‎. مقدار مثبت به موجودی اضافه می‌کند.</p><label class="fld"><span>مقدار تعدیل</span><input class="inp ltr" name="qty" inputmode="decimal" placeholder="-۲ یا ۵"></label>' + moneyField('cost', 0, 'قیمت واحد (فقط برای افزایش، اختیاری)') + dateField('date', today()) + '<label class="fld"><span>علت</span><input class="inp" name="note"></label><label class="hint"><input type="checkbox" name="opening"> موجودی اولیه است (در سود و زیان حساب نشود)</label><button class="btn blue" type="submit">ثبت تعدیل</button></form>');
  const f = sh.q('#af'); f.onsubmit = async e => { e.preventDefault(); const q = Core.parseNum(f.qty.value.replace(/[−–]/g, '-')), date = readDate(f, 'date'); if (isNaN(q) || !q) return toast('مقدار نامعتبر است.', true); if (!date) return toast('تاریخ نامعتبر است.', true); if (await done(Core.addAdjust(S, { productId: p.id, qty: q, cost: Core.parseMoney(f.cost.value || '0') || 0, date, note: f.note.value, opening: f.opening.checked }), 'تعدیل ثبت شد.')) sh.close(); };
}
function pageKardex(id) {
  const p = Core.byId(S.products, +id); if (!p) return { title: 'کاردکس', html: empty(ico('help'), 'کالا پیدا نشد.'), back: '#/products' };
  const mv = Core.productMoves(S, p.id);
  let h = '<div class="card flush"><div class="lh it"><span>شرح</span><span>ورود</span><span>خروج</span><span>موجودی</span></div>' + (mv.length ? mv.slice().reverse().map(m => '<div class="lr it"><span><b>' + esc(fa(m.label)) + '</b><small>' + fmtDate(m.date) + '</small></span><span class="credit">' + (m.delta > 0 ? Core.fmtQty(m.delta) : '') + '</span><span class="debit">' + (m.delta < 0 ? Core.fmtQty(-m.delta) : '') + '</span><span>' + Core.fmtQty(m.stock) + '</span></div>').join('') : '<div class="empty">حرکتی ثبت نشده است.</div>') + '</div>';
  return { title: 'کاردکس: ' + p.name, html: h, back: '#/products' };
}

/* ─────────── CHEQUES ─────────── */
/* ── warehouse analysis: what to reorder, what is not selling ── */
function pageStock() {
  const tab = UI.stockTab || 'reorder', t = today(), ins = Core.stockInsights(S, t);
  const wk = r => { const w = r * 7; return w >= 1 ? fa(Math.round(w)) : w > 0 ? 'کمتر از ۱' : '۰'; };
  let h = '<div class="stats">' + stat('نیاز به سفارش', fa(ins.reorder.length), ins.reorder.length ? 'debit' : 'zero', 'کالا') + stat('کالای راکد', fa(ins.stale.length), ins.stale.length ? 'debit' : 'zero', can('cost') ? 'سرمایه خوابیده: ' + fmt(ins.staleValue) : 'کالا') + '</div>';
  h += chips('stockTab', tab, [['reorder', 'پیشنهاد سفارش'], ['stale', 'کالاهای راکد']]);
  if (tab === 'reorder') {
    h += '<p class="hint">بر اساس فروش ۶۰ روز گذشته: کالاهایی که کمتر از یک هفته دیگر تمام می‌شوند یا به حداقل موجودی رسیده‌اند. مقدار پیشنهادی برای حدود ۳۰ روز فروش است.</p>';
    h += ins.reorder.length ? '<div class="card flush">' + ins.reorder.slice(0, 300).map(x => '<button class="row" data-act="prodOpen" data-id="' + x.product.id + '"><span><b>' + esc(x.product.name) + '</b><small>موجودی ' + Core.fmtQty(x.stock) + ' · فروش هفتگی حدود ' + wk(x.rate) + ' · ' + (x.stock <= 0 ? '<span class="debit">تمام شده</span>' : 'حدود ' + fa(Math.max(0, Math.floor(x.daysLeft))) + ' روز دیگر تمام می‌شود') + (x.minAuto || !(x.product.minStock > 0) ? '' : ' · حداقل: ' + Core.fmtQty(x.product.minStock)) + '</small></span><span class="end"><em class="credit">+' + Core.fmtQty(x.suggest) + '</em><small>پیشنهاد خرید</small></span></button>').join('') + '</div><button class="btn green" data-act="shareReorder">' + ico('share') + 'ارسال فهرست خرید</button>' : empty(ico('check'), 'فعلاً کالایی نیاز به سفارش ندارد.');
  } else {
    h += '<p class="hint">کالاهایی که موجودی دارند ولی ۶۰ روز یا بیشتر فروش نرفته‌اند (و در این مدت هم خریده نشده‌اند). با تخفیف یا فروش به همکار، سرمایه را آزاد کنید.</p>';
    h += ins.stale.length ? '<div class="card flush">' + ins.stale.slice(0, 300).map(x => '<button class="row" data-act="prodOpen" data-id="' + x.product.id + '"><span><b>' + esc(x.product.name) + '</b><small>' + (x.lastSale ? 'آخرین فروش: ' + fmtDate(x.lastSale) + ' (' + fa(x.idle) + ' روز پیش)' : 'هنوز فروش نرفته · ' + fa(x.idle) + ' روز در انبار') + '</small></span><span class="end"><em>' + Core.fmtQty(x.stock) + ' ' + esc(x.product.unit) + '</em>' + (can('cost') ? '<small>' + fmt(x.value) + '</small>' : '') + '</span></button>').join('') + '</div>' : empty(ico('check'), 'کالای راکدی ندارید.');
  }
  return { title: 'تحلیل انبار', html: h, back: '#/products' };
}
function shareReorder() {
  const ins = Core.stockInsights(S, today()); if (!ins.reorder.length) return toast('فهرستی برای ارسال نیست.');
  const by = {}; ins.reorder.forEach(x => { const c = Core.catOf(x.product); (by[c] = by[c] || []).push(x); });
  const lines = ['فهرست خرید پیشنهادی — ' + fmtDate(today()), ''];
  Object.keys(by).sort((a, b) => Core.catRank(a) - Core.catRank(b)).forEach(c => { lines.push('▪️ ' + c); by[c].forEach(x => lines.push('  • ' + x.product.name + ' — ' + Core.fmtQty(x.suggest) + ' ' + x.product.unit)); lines.push(''); });
  shareText(lines.join('\n').trim(), 'فهرست خرید');
}

/* ── warehouse: products backup, import, emptying ── */
function warehouseTools() {
  const n = S.products.length, adj = S.adjusts.length, inv = S.invoices.length;
  const sh = sheet('پشتیبان و حذف کالاها', '<div class="card"><div class="ch">' + ico('save') + 'پشتیبان کالاها</div><p class="hint">فهرست همه کالاها با دسته، قیمت‌ها، بارکد و <b>موجودی فعلی و میانگین قیمت خرید</b> در یک فایل ذخیره می‌شود. بعداً می‌توانید همین فایل را دوباره وارد کنید.</p><div class="row2"><button class="btn green" data-x>' + ico('share') + 'خروجی کالاها</button><button class="btn ghost" data-i>' + ico('folder') + 'ورود کالا از فایل</button></div><p class="hint">برای ورود، فایل پشتیبان کالاها، پشتیبان کامل برنامه، یا یک فایل متنی (هر خط یک نام کالا) را انتخاب کنید.</p></div>' +
    '<div class="card"><div class="ch">' + ico('trash') + 'حذف موجودی یا کالاها</div><label class="chk rs"><input type="radio" name="wm" value="stock" checked><span><b>فقط موجودی‌ها پاک شود</b><small>همه ' + fa(n) + ' کالا با نام، دسته و قیمت می‌مانند؛ موجودی همه صفر می‌شود.</small></span></label><label class="chk rs"><input type="radio" name="wm" value="all"><span><b>انبار کاملاً خالی شود</b><small>همه کالاها و موجودی‌شان حذف می‌شوند.</small></span></label>' +
    '<p class="hint">پاک می‌شود: ' + fa(adj) + ' ورود و تعدیل انبار' + (inv ? ' و <b class="debit">' + fa(inv) + ' فاکتور خرید و فروش</b> (چون موجودی را جابه‌جا کرده‌اند؛ حساب اشخاص هم به همان اندازه تغییر می‌کند)' : '') + '. اشخاص، دریافت و پرداخت‌ها، چک‌ها و هزینه‌ها دست نمی‌خورند.</p><label class="fld"><span>برای تأیید، کلمه «حذف» را بنویسید</span><input class="inp" name="cf" autocomplete="off"></label><button class="btn red" data-del>حذف</button></div>', { tall: true });
  sh.q('[data-x]').onclick = () => productExport();
  sh.q('[data-i]').onclick = () => { sh.close(); productImportPick(); };
  sh.q('[data-del]').onclick = async () => {
    const mode = sh.q('[name=wm]:checked').value;
    if (sh.q('[name=cf]').value.trim() !== 'حذف') return toast('کلمه تأیید درست نیست.', true);
    const r = Core.clearWarehouse(S, { products: mode === 'all', invoices: true }); if (!r.ok) return toast(r.error, true);
    sh.close(true);
    if (!(await backupFirst('پشتیبان قبل از حذف', 'پیشنهاد: اول «خروجی کالاها» را از همین صفحه بگیرید تا بتوانید کالاها را دوباره وارد کنید. پشتیبان کامل برنامه هم همه‌چیز (کالاها، فاکتورها و حساب‌ها) را نگه می‌دارد.', mode === 'all' ? 'انبار را خالی کن' : 'موجودی‌ها را پاک کن', true))) return;
    try { await kvSet('state_before_reset', JSON.stringify(S)); } catch (x) { /* ignore */ }
    S = r.state; UI.prodCat = ''; await save(); toast(mode === 'all' ? 'انبار خالی شد.' : 'موجودی همه کالاها صفر شد.'); render();
  };
}
async function productExport() {
  if (!S.products.length) return toast('کالایی برای خروجی وجود ندارد.', true);
  if (await exportFile('fixquick-products-' + stamp() + '.json', Core.exportProducts(S), 'application/json')) toast(fa(S.products.length) + ' کالا در فایل ذخیره شد.');
}
function productImportPick() {
  const i = document.createElement('input'); i.type = 'file'; i.accept = '.json,.txt,.csv,application/json,text/plain'; i.style.display = 'none'; document.body.appendChild(i);
  i.onchange = async () => { const f = i.files[0]; i.remove(); if (f) productImportText(await f.text()); };
  i.click();
}
async function productImportText(text) {
  const r = Core.parseProducts(text); if (!r.ok) return toast(r.error, true);
  const items = r.items, names = new Set(S.products.map(p => p.name)), fresh = items.filter(x => !names.has(String(x.name).trim()));
  const withStock = fresh.filter(x => x.stock > 0).length, cats = {}; fresh.forEach(x => { const c = x.category || Core.guessCategory(x.name); cats[c] = (cats[c] || 0) + 1; });
  const catList = Object.keys(cats).sort((a, b) => Core.catRank(a) - Core.catRank(b)).map(c => '<li>' + esc(c) + ': ' + fa(cats[c]) + '</li>').join('');
  const sh = sheet('ورود کالا از فایل', '<p class="msg">در فایل ' + fa(items.length) + ' کالا هست؛ <b>' + fa(fresh.length) + ' کالای جدید</b> اضافه می‌شود' + (items.length - fresh.length ? ' و ' + fa(items.length - fresh.length) + ' کالا چون هم‌نامش از قبل هست، رد می‌شود' : '') + '.</p>' + (catList ? '<div class="card"><div class="ch">دسته‌بندی خودکار</div><ul class="catsum">' + catList + '</ul></div>' : '') +
    (withStock ? '<label class="chk"><input type="checkbox" name="stk" checked> موجودی ' + fa(withStock) + ' کالا هم با میانگین قیمت خریدش وارد شود (موجودی اول دوره)</label>' : '') + '<button class="btn blue" data-ok' + (fresh.length ? '' : ' disabled') + '>وارد کن</button>');
  sh.q('[data-ok]').onclick = async () => {
    const stk = !!(sh.q('[name=stk]') && sh.q('[name=stk]').checked);
    const st2 = Object.assign({}, S, { products: S.products.slice(), adjusts: S.adjusts.slice() });
    const res = Core.importProducts(st2, fresh, { stock: stk }); const a = Core.audit(st2);
    if (a.length) { toast('ورود انجام نشد: ' + a[0], true); return; }
    S = st2; await save(); sh.close(); toast(fa(res.added) + ' کالا وارد شد' + (res.withStock ? ' (' + fa(res.withStock) + ' با موجودی)' : '') + '.'); UI.prodCat = ''; goHash('#/products'); render();
  };
}
function pageCheques() {
  const t = today(); const list = S.cheques.filter(c => UI.chqTab === 'open' ? !c.done : c.done).sort((a, b) => UI.chqTab === 'open' ? (a.dueDate < b.dueDate ? -1 : 1) : (a.doneAt < b.doneAt ? 1 : -1));
  const open = S.cheques.filter(c => !c.done), rec = open.filter(c => c.direction === 'receive').reduce((s, c) => s + c.amount, 0), pay = open.filter(c => c.direction === 'pay').reduce((s, c) => s + c.amount, 0);
  let h = '<div class="stats">' + stat('چک/قسط دریافتنی', fmt(rec), rec ? 'credit' : 'zero') + stat('چک/قسط پرداختنی', fmt(pay), pay ? 'debit' : 'zero') + '</div>' + chips('chqTab', UI.chqTab, [['open', 'در انتظار'], ['done', 'انجام‌شده']]);
  h += list.length ? '<div class="card flush">' + list.slice(0, UI.limChq).map(c => { const st = Core.chequeStatus(c, t), dd = Core.diffDays(t, c.dueDate); return '<div class="row static"><span><b>' + (c.kind === 'cheque' ? ico('receipt') : ico('cheque')) + esc(c.title) + '</b><small>' + (c.personId ? esc(personName(c.personId)) + ' · ' : '') + (c.direction === 'receive' ? 'دریافتی' : 'پرداختی') + ' · ' + fmtDate(c.dueDate) + (st === 'overdue' ? ' · <u class="debit">' + fa(-dd) + ' روز گذشته</u>' : st === 'soon' ? ' · ' + (dd === 0 ? 'امروز' : fa(dd) + ' روز دیگر') : '') + '</small></span><span class="end"><em>' + fmt(c.amount) + '</em>' + (c.done ? '<button class="mini" data-act="chqReopen" data-id="' + c.id + '">بازگردانی</button>' : '<button class="mini ok" data-act="chqDone" data-id="' + c.id + '">انجام شد</button>') + '<button class="mini" data-act="chqEdit" data-id="' + c.id + '">ویرایش</button><button class="mini" data-act="chqDel" data-id="' + c.id + '">حذف</button></span></div>'; }).join('') + '</div>' + moreBtn('limChq', Math.min(UI.limChq, list.length), list.length) : empty(ico('cheque'), UI.chqTab === 'open' ? 'موردی در انتظار نیست.' : 'موردی انجام نشده است.', '<button class="btn blue" data-act="addCheque">+ ثبت چک / قسط</button>');
  return { title: 'چک و اقساط', html: h, fab: ['addCheque', '+'], back: '#/more' };
}
function chequeForm(c) {
  let pid = c ? c.personId : null;
  const sh = sheet(c ? 'ویرایش چک / قسط' : 'ثبت چک / قسط', '<form id="cf"><div class="row2"><label class="fld"><span>نوع</span><select class="inp" name="kind"><option value="cheque">چک</option><option value="installment">قسط</option></select></label><label class="fld"><span>جهت</span><select class="inp" name="dir"><option value="receive">دریافتی (از شخص)</option><option value="pay">پرداختی (به شخص)</option></select></label></div><label class="fld"><span>شخص (اختیاری)</span><button type="button" class="inp pick" id="cf-p">' + esc(pid ? personName(pid) : 'انتخاب…') + '</button></label><label class="fld"><span>عنوان / شماره چک</span><input class="inp" name="title" value="' + esc(c ? c.title : '') + '"></label>' + moneyField('amount', c ? c.amount : 0, 'مبلغ') + dateField('due', c ? c.dueDate : today(), 'تاریخ سررسید') + '<label class="fld"><span>یادداشت</span><input class="inp" name="note" value="' + esc(c ? c.note : '') + '"></label><button class="btn blue" type="submit">' + (c ? 'ذخیره تغییرات' : 'ثبت') + '</button></form>');
  if (c) { sh.q('[name=kind]').value = c.kind; sh.q('[name=dir]').value = c.direction; }
  sh.q('#cf-p').onclick = () => pickList('انتخاب شخص', personItems(), v => { pid = +v; sh.q('#cf-p').textContent = personName(pid); });
  const f = sh.q('#cf'); f.onsubmit = async e => { e.preventDefault(); const due = readDate(f, 'due'), amount = Core.parseMoney(f.amount.value); if (!due) return toast('تاریخ نامعتبر است.', true); if (!amount) return toast('مبلغ را درست وارد کنید.', true); const dd = { kind: f.kind.value, direction: f.dir.value, personId: pid, title: f.title.value, amount, dueDate: due, note: f.note.value }; if (await done(c ? Core.editCheque(S, c.id, dd) : Core.addCheque(S, dd), c ? 'اصلاح شد.' : 'ثبت شد.')) sh.close(); };
}

/* ─────────── EXPENSES ─────────── */
function pageExpenses() {
  const list = S.expenses.slice().sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id); const m = Core.periodRange('month'); const mt = list.filter(e => e.date >= m.from && e.date <= m.to).reduce((s, e) => s + e.amount, 0);
  let h = '<div class="stats">' + stat('هزینه این ماه', fmt(mt), 'debit', UNIT()) + stat('جمع کل هزینه‌ها', fmt(list.reduce((s, e) => s + e.amount, 0)), '', UNIT()) + '</div>';
  h += list.length ? '<div class="card flush">' + list.map(e => '<button class="row" data-act="expOpen" data-id="' + e.id + '"><span><b>' + esc(e.title) + '</b><small>' + fmtDate(e.date) + (e.category ? ' · ' + esc(e.category) : '') + ' · ' + Core.METHODS[e.method] + '</small></span><em class="debit">' + fmt(e.amount) + '</em></button>').join('') + '</div>' : empty(ico('cash'), 'هزینه‌ای ثبت نشده است. (اجاره، حقوق، قبض و…)', '<button class="btn blue" data-act="addExpense">+ ثبت هزینه</button>');
  return { title: 'هزینه‌ها', html: h, fab: ['addExpense', '+'], back: '#/more' };
}
function expenseForm(e) {
  const sh = sheet(e ? 'ویرایش هزینه' : 'هزینه جدید', '<form id="ef"><label class="fld"><span>عنوان</span><input class="inp" name="title" value="' + esc(e ? e.title : '') + '"></label>' + moneyField('amount', e ? e.amount : 0, 'مبلغ') + '<div class="row2"><label class="fld"><span>دسته (اختیاری)</span><input class="inp" name="cat" value="' + esc(e ? e.category : '') + '" list="cats"><datalist id="cats">' + [...new Set(S.expenses.map(x => x.category).filter(Boolean))].map(c => '<option value="' + esc(c) + '">').join('') + '</datalist></label>' + methodSel(e && e.method) + '</div>' + dateField('date', e ? e.date : today()) + '<div class="row2"><button class="btn blue" type="submit">ذخیره</button>' + (e ? '<button class="btn red" type="button" data-del>حذف</button>' : '') + '</div></form>');
  const f = sh.q('#ef'); f.onsubmit = async ev => { ev.preventDefault(); const date = readDate(f, 'date'), amount = Core.parseMoney(f.amount.value); if (!date) return toast('تاریخ نامعتبر است.', true); if (!amount) return toast('مبلغ را درست وارد کنید.', true); const d = { title: f.title.value, amount, date, method: f.method.value, category: f.cat.value }; if (!e && !gate()) return; if (await done(e ? Core.editExpense(S, e.id, d) : Core.addExpense(S, d), 'ذخیره شد.')) { if (!e) bumpUsage(); sh.close(); } };
  const dl = sh.q('[data-del]'); if (dl) dl.onclick = async () => { if (await confirmBox('این هزینه حذف شود؟', 'حذف', true)) { sh.close(); await done(Core.deleteExpense(S, e.id), 'حذف شد.'); } };
}

/* ─────────── REPORTS ─────────── */
function repRange() { if (UI.rep === 'custom') return { from: UI.repFrom, to: UI.repTo }; return Core.periodRange(UI.rep, today(), fyMonth()); }
function pageReports() {
  const { from, to } = repRange(), r = Core.report(S, from, to), cs = Core.cashSummary(S, from, to), rp = Core.receivablePayable(S);
  const row = (l, v, c, b) => '<div class="rr' + (b ? ' b' : '') + '"><span>' + l + '</span><b class="' + (c || '') + '">' + fmt(v) + '</b></div>';
  let h = chips('rep', UI.rep, [['today', 'امروز'], ['yesterday', 'دیروز'], ['mtd', 'از اول ماه'], ['fytd', 'از اول سال مالی'], ['all', 'همه'], ['custom', 'دلخواه']]);
  if (UI.rep === 'custom') h += '<div class="card row2f">' + dateField('rf', UI.repFrom || today(), 'از') + dateField('rt', UI.repTo || today(), 'تا') + '<button class="btn blue sm" data-act="repApply">اعمال</button></div>';
  h += '<div class="hint center">' + (from ? fmtDate(from) : 'ابتدا') + ' تا ' + (to ? fmtDate(to) : 'امروز') + '</div>';
  if (from && to) {
    const pr = Core.prevRange(from, to), r0 = Core.report(S, pr.from, pr.to);
    const cmp = (l, now, was) => { const c = Core.pctChange(now, was); return '<div class="cmp"><small>' + l + '</small><b>' + fmt(now) + '</b><em class="' + (c == null ? '' : c > 0 ? 'credit' : c < 0 ? 'debit' : 'zero') + '">' + (c == null ? 'تازه' : (c > 0 ? '▲ ' : c < 0 ? '▼ ' : '') + fa(Math.abs(c)) + '٪') + '</em></div>'; };
    h += '<div class="card"><div class="ch">' + ico('chart') + 'مقایسه با دوره قبل <small class="hint">(' + fmtDate(pr.from) + ' تا ' + fmtDate(pr.to) + ')</small></div><div class="cmpg">' + cmp('فروش خالص', r.revenue, r0.revenue) + cmp('سود ناخالص', r.gross, r0.gross) + cmp('سود خالص', r.net, r0.net) + cmp('هزینه‌ها', r.expenses, r0.expenses) + '</div></div>';
  }
  const cp = Core.categoryProfit(S, from, to);
  if (cp.length) h += '<div class="card"><div class="ch">' + ico('package') + 'سود هر دسته کالا</div>' + cp.map(x => '<div class="rr"><span>' + esc(x.cat) + '<small> · فروش ' + fmt(x.rev) + ' · ' + fa(x.margin) + '٪</small></span><b class="' + (x.profit < 0 ? 'debit' : 'credit') + '">' + fmt(x.profit) + '</b></div>').join('') + '<p class="hint">سود هر دسته = فروش خالص منهای قیمت خرید همان کالاها (بدون هزینه‌ها و ارزش افزوده).</p></div>';
  const us = staffReport(from, to); if (us) h += us;
  h += '<div class="card"><div class="ch">سود و زیان</div>' + row('فروش', r.sales) + (r.saleReturns ? row('کسر: برگشت از فروش', r.saleReturns, 'debit') : '') + row('فروش خالص', r.revenue, '', 1) + row('کسر: بهای تمام‌شده کالای فروش‌رفته', r.cogs, 'debit') + (r.adjLoss ? row('کسر: ضایعات / تعدیل انبار', r.adjLoss, 'debit') : '') + row('سود ناخالص', r.gross, r.gross < 0 ? 'debit' : 'credit', 1) + row('کسر: هزینه‌ها', r.expenses, 'debit') + row('سود خالص', r.net, r.net < 0 ? 'debit' : 'credit', 1) + (r.discounts ? '<p class="hint">تخفیف‌های فروش در همین دوره: ' + fmt(r.discounts) + ' (در فروش خالص لحاظ شده)</p>' : '') + '</div>';
  if (r.vatOut || r.vatIn) h += '<div class="card"><div class="ch">ارزش افزوده</div>' + row('ارزش افزوده فروش (دریافتی از مشتری)', r.vatOut) + row('ارزش افزوده خرید (پرداختی)', r.vatIn) + row('خالص ارزش افزوده قابل پرداخت', r.vatNet, r.vatNet > 0 ? 'debit' : 'credit', 1) + '<p class="hint">ارزش افزوده جزو درآمد یا هزینه نیست و در سود و زیان حساب نشده است.</p></div>';
  h += '<div class="card"><div class="ch">گردش وجه نقد و بانک</div>' + row('دریافت‌ها', cs.in, 'credit') + row('پرداخت‌ها و هزینه‌ها', cs.out, 'debit') + row('خالص گردش', cs.net, cs.net < 0 ? 'debit' : 'credit', 1) + '<div class="rr sub"><span>نقد</span><b>' + fmt(cs.byMethod.cash) + '</b></div><div class="rr sub"><span>کارت/بانک</span><b>' + fmt(cs.byMethod.bank) + '</b></div><div class="rr sub"><span>چک</span><b>' + fmt(cs.byMethod.cheque) + '</b></div><div class="rr b"><span>موجودی فعلی صندوق/بانک</span><b>' + fmt(Core.cashBalance(S)) + '</b></div></div>';
  h += '<div class="card"><div class="ch">وضعیت کلی (تا امروز)</div>' + row('مطالبات از مشتریان', rp.receivable, 'debit') + row('بدهی به دیگران', rp.payable, 'credit') + row('ارزش موجودی انبار', Core.inventoryValue(S)) + row('خرید در دوره', r.purchases) + '</div>';
  const tc = Core.topPeople(S, 'sale', from, to, 5), tp = Core.topProducts(S, from, to, 5);
  if (tc.length) h += '<div class="card"><div class="ch">بهترین مشتریان</div>' + tc.map(x => row(esc(x.person ? x.person.name : '—'), x.total)).join('') + '</div>';
  if (tp.length) h += '<div class="card"><div class="ch">پرفروش‌ترین کالاها</div>' + tp.map(x => '<div class="rr"><span>' + esc(x.product ? x.product.name : '—') + '<small> ×' + Core.fmtQty(x.qty) + '</small></span><b>' + fmt(x.total) + '</b></div>').join('') + '</div>';
  const balAll = Core.balances(S), deb = S.people.map(p => ({ p, b: balAll[p.id] || 0 })).filter(x => x.b > 0).sort((a, b) => b.b - a.b).slice(0, 8);
  if (deb.length) h += '<div class="card"><div class="ch">بیشترین طلب‌های من</div>' + deb.map(x => '<button class="rr" data-act="go" data-h="#/person/' + x.p.id + '"><span>' + esc(x.p.name) + '</span><b class="debit">' + fmt(x.b) + '</b></button>').join('') + '</div>';
  h += '<div class="toolbar"><button class="btn ghost sm" data-act="csvPeople">' + ico('file') + 'CSV مانده اشخاص</button><button class="btn ghost sm" data-act="csvInvoices">' + ico('file') + 'CSV فاکتورها</button><button class="btn ghost sm" data-act="csvLedger">' + ico('file') + 'CSV کل تراکنش‌ها</button></div>';
  return { title: 'گزارش‌ها', html: h, back: '#/more' };
}

/* ─────────── MORE / SETTINGS ─────────── */
function pageMore() {
  const item = (ic, t, h, sub) => '<button class="row" data-act="go" data-h="' + h + '"><span><b>' + ic + ' ' + t + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</span><em>‹</em></button>';
  const open = S.cheques.filter(c => !c.done).length;
  return { title: 'بیشتر', html: '<div class="card flush">' + item(ico('chart'), 'گزارش‌ها و سود و زیان', '#/reports') + item(ico('cheque'), 'چک و اقساط', '#/cheques', open ? fa(open) + ' مورد در انتظار' : '') + item(ico('cash'), 'هزینه‌ها', '#/expenses') + item(ico('receipt'), 'همه فاکتورها', '#/invoices') + '<button class="row" data-act="transfer"><span><b>' + ico('transfer') + 'حواله بین اشخاص</b></span><em>‹</em></button>' + item(ico('settings'), 'تنظیمات و پشتیبان', '#/settings') + (isNative() ? '<button class="row" data-act="exitApp"><span><b>' + ico('exit') + 'خروج از برنامه</b></span><em>‹</em></button>' : '') + '</div>' + aboutCard() + '<p class="hint center">حسابداری فیکس کوییک · نسخه ' + fa(APP_VER) + (curName() ? ' · کاربر: ' + esc(curName()) + (isAdmin() ? ' (مدیر)' : '') : '') + '</p>' };
}
function aboutCard() {
  const lnk = (ic, t, s, u) => '<a class="ab-row" href="' + u + '" target="_blank" rel="noopener"><i>' + ic + '</i><span><b>' + t + '</b><small>' + s + '</small></span><em>‹</em></a>';
  return '<div class="card about"><div class="ab-h"><img src="logo.png" alt=""><div><b>پشتیبانی فیکس کوییک</b><small>سؤال یا مشکلی داشتید؟ در واتساپ پیام بدهید؛ در خدمتیم.</small></div></div>' +
    lnk(ico('chat'), 'واتساپ پشتیبانی', Core.toFa('09999917199'), 'https://wa.me/989999917199') +
    lnk(ico('phone'), 'تماس تلفنی', Core.toFa('09999917199'), 'tel:09999917199') +
    lnk(ico('globe'), 'وب‌سایت', 'fixq.ir', 'https://fixq.ir') +
    lnk(ico('insta'), 'اینستاگرام', '@fixq.ir', 'https://instagram.com/fixq.ir') +
    '<div class="ab-f">با مدیریت <b>محمد صادق ربانی</b><small>طراح و صاحب امتیاز برنامه</small></div></div>';
}
function pageSettings() {
  const days = S.settings.lastBackup ? Core.diffDays(S.settings.lastBackup, today()) : null;
  let h = '';
  if (isAdmin()) h += '<form class="card" id="setf"><label class="fld"><span>نام کسب‌وکار (روی گزارش‌ها)</span><input class="inp" name="business" value="' + esc(S.settings.business) + '"></label>' + moneyField('openingCash', S.settings.openingCash, 'موجودی اولیه صندوق/بانک') + '<div class="row2"><label class="fld"><span>درصد ارزش افزوده</span><input class="inp ltr" name="vatRate" inputmode="decimal" value="' + fa(vatRateSet()) + '"></label><label class="fld"><span>شروع سال مالی</span><select class="inp" name="fyMonth">' + Core.MONTHS.map((m, i) => '<option value="' + (i + 1) + '"' + (i + 1 === fyMonth() ? ' selected' : '') + '>۱ ' + m + '</option>').join('') + '</select></label></div><p class="hint">درصد ارزش افزوده روی فاکتورهای جدید اعمال می‌شود؛ فاکتورهای قبلی با همان درصد خودشان می‌مانند.</p><label class="fld"><span>هشدار سود کم در فاکتور فروش (درصد)</span><input class="inp ltr" name="minMargin" inputmode="decimal" value="' + fa(minMargin()) + '"></label><button class="btn blue" type="submit">ذخیره تنظیمات</button></form>';
  if (isAdmin()) h += '<form class="card" id="usf"><div class="ch">' + ico('store') + 'تنظیمات کاربری</div><label class="fld"><span>نام فروشنده روی فاکتور (نام مجموعه یا نام خانوادگی شما)</span><input class="inp" name="seller" maxlength="60" placeholder="' + esc(S.settings.business || 'مثلاً: موبایل ربانی') + '" value="' + esc(S.settings.sellerName || '') + '"></label><label class="fld"><span>واحد پول</span><select class="inp" name="unit"><option value="rial"' + (Core.unit === 'rial' ? ' selected' : '') + '>ریال</option><option value="toman"' + (Core.unit === 'toman' ? ' selected' : '') + '>تومان</option></select></label><p class="hint">نام فروشنده بالای فاکتور خرید و فروش چاپ می‌شود. اگر خالی باشد، «نام کسب‌وکار» چاپ می‌شود.</p><button class="btn blue" type="submit">ذخیره تنظیمات کاربری</button></form>';
  const st = S.settings, th = st.theme || 'auto', ac = st.accent || 'blue', fs = Number(st.fontScale) || 1;
  h += '<div class="card"><div class="ch">' + ico('palette') + 'ظاهر برنامه</div><div class="seg">' + [['light', ico('sun') + 'روز'], ['dark', ico('moon') + 'شب'], ['auto', ico('phonecell') + 'خودکار']].map(x => '<button type="button" class="' + (th === x[0] ? 'on' : '') + '" data-act="setTheme" data-v="' + x[0] + '">' + x[1] + '</button>').join('') + '</div><div class="sw">' + Object.keys(ACCENTS).map(k => '<button type="button" title="' + ACCENTS[k][2] + '" class="' + (ac === k ? 'on' : '') + '" style="background:' + ACCENTS[k][0] + '" data-act="setAccent" data-v="' + k + '"></button>').join('') + '</div><div class="fsr"><button type="button" data-act="fontStep" data-v="-1">A−</button><span class="v">اندازه نوشته: ' + fa(Math.round(fs * 100)) + '٪</span><button type="button" data-act="fontStep" data-v="1">A+</button></div><button type="button" class="lnk center" data-act="fontStep" data-v="0">بازگشت به اندازه عادی</button></div>';
  if (can('backup')) h += '<div class="card"><div class="ch">' + ico('save') + 'پشتیبان‌گیری</div><p class="hint">' + (days === null ? 'هنوز پشتیبان نگرفته‌اید.' : 'آخرین پشتیبان: ' + fmtDate(S.settings.lastBackup) + ' (' + fa(days) + ' روز پیش)') + '</p><p class="hint">اطلاعات فقط روی همین گوشی است. با حذف برنامه یا پاک‌کردن اطلاعات مرورگر از بین می‌رود؛ پس مرتب پشتیبان بگیرید و فایل را برای خودتان (مثلاً تلگرام/Drive) بفرستید.</p><div class="row2"><button class="btn green" data-act="backup">دریافت پشتیبان</button><button class="btn ghost" data-act="restore">بازیابی از فایل</button></div><input type="file" id="restore-file" accept=".json,application/json" hidden></div>';
  if (can('backup')) h += autoBackupCard();
  const au = S.settings.auth || {};
  if (isAdmin()) {
  h += '<div class="card"><div class="ch">' + ico('user') + 'حساب کاربری</div><p class="hint">نام کاربری: <b>' + esc(au.user || '') + '</b></p><div class="row2"><button class="btn ghost" data-act="changePass">تغییر رمز</button><button class="btn ghost" data-act="newCode">کد بازیابی جدید</button></div><button class="btn ghost" data-act="logout">' + ico('lock') + 'خروج و قفل برنامه</button>' + (isNative() ? '<button class="btn ghost" data-act="toggleBio">' + (S.settings.bio ? ico('finger') + 'اثر انگشت: فعال (غیرفعال کنم)' : ico('finger') + 'فعال‌سازی ورود با اثر انگشت') + '</button>' : '') + '</div>';
  h += usersCard() + lockCard();
  } else h += '<div class="card"><div class="ch">' + ico('user') + 'حساب کاربری</div><p class="hint">وارد شده با: <b>' + esc(CUR.user) + '</b> (کاربر زیرمجموعه)</p><button class="btn ghost" data-act="logout">' + ico('lock') + 'خروج و قفل برنامه</button></div>';
  const left = freeLeft();
  if (isAdmin()) h += '<div class="card"><div class="ch">' + ico('star') + 'نسخه برنامه</div>' + (licOk ? '<p class="hint">' + ico('check') + 'نسخه نامحدود فعال است.</p>' : '<p class="hint">نسخه رایگان: ' + fa(Math.min(usedDocs(), License.FREE_LIMIT)) + ' از ' + fa(License.FREE_LIMIT) + ' فاکتور و سند استفاده شده (' + fa(left) + ' باقی‌مانده).</p>') + '<button class="btn ' + (licOk ? 'ghost' : 'blue') + '" data-act="activate">' + (licOk ? 'جزئیات نسخه نامحدود' : ico('star') + 'فعال‌سازی نسخه نامحدود') + '</button></div>';
  const errN = diagLoad().length;
  h += '<div class="card"><div class="ch">' + ico('wrench') + 'گزارش خطا</div><p class="hint">اگر برنامه درست کار نکرد یا بسته شد، این گزارش را برای پشتیبانی بفرستید. فقط اطلاعات فنی (نسخه، گوشی، متن خطا) فرستاده می‌شود؛ نام اشخاص و مبالغ در آن نیست.</p><p class="hint">خطاهای ثبت‌شده: <b>' + fa(errN) + '</b></p><div class="row2"><button class="btn green" data-act="reportWa">ارسال در واتساپ</button><button class="btn ghost" data-act="reportShare">کپی / ارسال</button></div>' + (errN ? '<button class="lnk center" data-act="reportClear">پاک‌کردن خطاهای ثبت‌شده</button>' : '') + '</div>';
  h += '<div class="card"><div class="ch">' + ico('search') + 'بررسی سلامت اطلاعات</div><p class="hint">صحت ارتباط تراکنش‌ها، فاکتورها و موجودی انبار را بررسی می‌کند.</p><button class="btn ghost" data-act="audit">اجرای بررسی</button></div>';
  if (isAdmin()) h += '<div class="card"><div class="ch">' + ico('eraser') + 'خام کردن اطلاعات</div><p class="hint">فاکتورها، ورود کالا به انبار، دریافت و پرداخت‌ها، هزینه‌ها یا چک‌ها را پاک می‌کند تا از نو شروع کنید. <b>اشخاص و کالاها (نام، تلفن، قیمت، بارکد) پاک نمی‌شوند.</b></p><button class="btn ghost red" data-act="resetData">خام کردن اطلاعات…</button></div>';
  if (isAdmin()) h += '<div class="card"><div class="ch">' + ico('alert') + 'حذف همه اطلاعات</div><button class="btn red" data-act="wipe">پاک‌کردن کامل برنامه</button></div><p class="hint center">تعداد: ' + fa(S.people.length) + ' شخص · ' + fa(S.products.length) + ' کالا · ' + fa(S.invoices.length) + ' فاکتور · ' + fa(S.tx.length) + ' تراکنش</p>';
  return { title: 'تنظیمات', html: h, back: '#/more', mount: () => { bindLockCard(); if ($('#setf')) $('#setf').onsubmit = async e => { e.preventDefault(); const f = e.target, oc = f.openingCash.value.trim() === '' ? 0 : Core.parseMoney(f.openingCash.value); if (isNaN(oc)) return toast('مبلغ نامعتبر است.', true); const vr = Core.parseNum(f.vatRate.value || '0'); if (isNaN(vr) || vr < 0 || vr > 100) return toast('درصد ارزش افزوده نامعتبر است.', true); S.settings.business = f.business.value.trim(); S.settings.openingCash = oc; S.settings.vatRate = vr; S.settings.fyMonth = +f.fyMonth.value || 1; const mm = Core.parseNum(f.minMargin.value || '0'); if (!isNaN(mm) && mm >= 0 && mm <= 100) S.settings.minMargin = mm; await save(); toast('ذخیره شد.'); render(); }; if ($('#restore-file')) $('#restore-file').onchange = restoreFile; if ($('#usf')) $('#usf').onsubmit = saveUserSettings; } };
}
async function doBackup(noRender) { const ok = await exportFile('fixquick-backup-' + stamp() + '.json', Core.exportJSON(S), 'application/json'); if (ok) { S.settings.lastBackup = today(); S.settings.lastBackupAt = Date.now(); await save(); toast('پشتیبان آماده شد.'); if (!noRender) render(); } return !!ok; }
const hasDocs = () => S.invoices.length + S.tx.length + S.expenses.length + S.cheques.length + S.adjusts.length > 0;
// a step that needs a fresh backup first: [backup and continue] [continue without backup] [cancel]
function backupFirst(title, msgHtml, goLabel, danger) {
  return new Promise(res => {
    let done = false; const fin = v => { if (done) return; done = true; res(v); };
    const sh = sheet(title, '<div class="msg">' + msgHtml + '</div><button class="btn green" data-bk>' + ico('save') + 'اول پشتیبان بگیر، بعد ' + esc(goLabel) + '</button><button class="btn ghost' + (danger ? ' red' : '') + '" data-go>بدون پشتیبان ' + esc(goLabel) + '</button><button class="btn ghost" data-close>انصراف</button>', { onClose: () => fin(false) });
    sh.q('[data-bk]').onclick = async () => { if (await doBackup(true)) { sh.close(true); fin(true); } else toast('پشتیبان گرفته نشد؛ تغییری اعمال نشد.', true); };
    sh.q('[data-go]').onclick = () => { sh.close(true); fin(true); };
  });
}
async function saveUserSettings(e) {
  e.preventDefault(); const f = e.target, seller = f.seller.value.trim().slice(0, 60), unit = f.unit.value === 'toman' ? 'toman' : 'rial';
  if (unit !== Core.unit && hasDocs()) {
    const from = Core.unitName(), to = Core.unitName(unit);
    const ok = await backupFirst('تغییر واحد پول', 'واحد پول از <b>' + from + '</b> به <b>' + to + '</b> تغییر می‌کند. پیش از ادامه، به این نکته‌ها توجه کنید:<ul>' +
      '<li>هیچ عددی در حساب‌ها عوض نمی‌شود؛ همه مبالغ قبلی خودکار به ' + to + ' نمایش داده می‌شوند (هر ۱ تومان = ۱۰ ریال).</li>' +
      '<li>از این به بعد <b>همه مبالغ را باید به ' + to + ' وارد کنید</b>' + (unit === 'toman' ? ' (یک صفر کمتر از ریال)' : ' (یک صفر بیشتر از تومان)') + '. اشتباه در ورود مبلغ، حساب‌ها را ده برابر کم یا زیاد می‌کند.</li>' +
      '<li>فاکتورها و صورت‌حساب‌هایی که قبلاً چاپ یا ارسال کرده‌اید به ' + from + ' هستند و ممکن است با نسخه‌های جدید اشتباه گرفته شوند.</li>' +
      (unit === 'toman' ? '<li>مبلغ‌هایی که رقم آخرشان صفر نیست، به نزدیک‌ترین تومان گرد نمایش داده می‌شوند.</li>' : '') +
      '<li>با بازیابی یک پشتیبان قدیمی، واحد پول همان پشتیبان برمی‌گردد.</li></ul>توصیه می‌شود اول پشتیبان بگیرید.', 'تغییر بده');
    if (!ok) { f.unit.value = Core.unit; return; }
  }
  S.settings.sellerName = seller; S.settings.unit = unit; applySettings(S.settings); await save(); toast('تنظیمات کاربری ذخیره شد.'); render();
}
async function resetDataFlow() {
  const opts = [['invoices', 'فاکتورهای خرید و فروش و برگشتی‌ها', 'با دریافت و پرداخت‌هایی که روی همان فاکتورها ثبت شده', S.invoices.length],
    ['adjusts', 'ورود کالا به انبار و تعدیل موجودی', 'موجودی اولیه کالاها، کسری و اضافی انبار', S.adjusts.length],
    ['people', 'دریافت، پرداخت، حواله و مانده اول دوره اشخاص', 'تراکنش‌هایی که جدا از فاکتور ثبت شده‌اند', S.tx.filter(t => t.ref == null).length],
    ['expenses', 'هزینه‌ها', '', S.expenses.length], ['cheques', 'چک و اقساط', '', S.cheques.length]];
  const sh = sheet('خام کردن اطلاعات', '<p class="hint">چه چیزهایی پاک شود؟ <b>اشخاص و کالاها پاک نمی‌شوند.</b></p><div class="rsl">' + opts.map(o => '<label class="chk rs"><input type="checkbox" name="' + o[0] + '"' + (o[3] ? '' : ' disabled') + '><span><b>' + o[1] + ' <em>(' + fa(o[3]) + ')</em></b>' + (o[2] ? '<small>' + o[2] + '</small>' : '') + '</span></label>').join('') + '</div><button type="button" class="lnk" data-all>انتخاب همه</button><label class="fld"><span>برای تأیید، کلمه «خام» را بنویسید</span><input class="inp" name="cf" autocomplete="off"></label><button class="btn red" data-ok>خام کن</button>', { tall: true });
  sh.q('[data-all]').onclick = () => sh.qa('.rs input:not(:disabled)').forEach(i => { i.checked = true; });
  sh.q('[data-ok]').onclick = async () => {
    const o = {}; let any = false; sh.qa('.rs input').forEach(i => { o[i.name] = i.checked; any = any || i.checked; });
    if (!any) return toast('حداقل یک مورد را انتخاب کنید.', true);
    if (sh.q('[name=cf]').value.trim() !== 'خام') return toast('کلمه تأیید درست نیست.', true);
    const r = Core.resetData(S, o); if (!r.ok) return toast(r.error, true);
    sh.close(true);
    if (!(await backupFirst('پشتیبان قبل از خام کردن', 'موارد انتخاب‌شده برای همیشه پاک می‌شوند. اگر از قبل پشتیبان بگیرید، هر وقت خواستید می‌توانید همه را برگردانید.', 'خام کن', true))) return;
    try { await kvSet('state_before_reset', JSON.stringify(S)); } catch (x) { /* ignore */ }
    S = r.state; await save(); toast('اطلاعات انتخاب‌شده پاک شد؛ اشخاص و کالاها سر جایشان هستند.'); render();
  };
}
async function restoreFile(e) { const file = e.target.files[0]; e.target.value = ''; if (!file) return; await restoreText(await file.text()); }
async function restoreText(text) {
  const r = Core.parseBackup(text); if (!r.ok) return toast(r.error, true);
  const st = r.state; if (!(await confirmBox('اطلاعات فعلی کاملاً با فایل پشتیبان جایگزین می‌شود (' + fa(st.people.length) + ' شخص، ' + fa(st.invoices.length) + ' فاکتور، ' + fa(st.tx.length) + ' تراکنش). ادامه می‌دهید؟', 'جایگزین کن', true))) return;
  try { await kvSet('state_before_restore', JSON.stringify(S)); } catch (x) { /* ignore */ }
  const au0 = S.settings.auth, wasAdmin = isAdmin(); S = Object.assign(Core.emptyState(), st); if (!S.settings.auth && au0) S.settings.auth = au0; applySettings(S.settings); await licCheck(); await save(); toast('بازیابی انجام شد.'); goHash('#/home'); render();
  if (!wasAdmin) authGate(); // the restored file may have other users: log in again
}

/* ─────────── PIN lock ─────────── */
async function hashPin(pin, salt) { const data = new TextEncoder().encode(salt + ':' + pin); if (window.crypto && crypto.subtle) { const h = await crypto.subtle.digest('SHA-256', data); return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, '0')).join(''); } let x = 5381; for (const b of data) x = ((x << 5) + x + b) >>> 0; return 'f' + x; }
function pinPad(title, cb, o) {
  o = o || {}; let v = ''; const sh = sheet(title, '<div class="pin-dots" id="pd"></div><div class="pin-pad">' + [1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, '⌫'].map(k => k === '' ? '<i></i>' : '<button type="button" data-k="' + k + '">' + (k === '⌫' ? k : fa(k)) + '</button>').join('') + '</div>' + (o.extra || ''), { lock: !!o.lock });
  if (o.lock) { sh.el.classList.add('lock'); sh.q('[data-close]').remove(); }
  const dots = () => sh.q('#pd').innerHTML = [0, 1, 2, 3].map(i => '<span class="' + (i < v.length ? 'on' : '') + '"></span>').join(''); dots();
  sh.el.addEventListener('click', async e => { const b = e.target.closest('[data-k]'); if (!b) return; const k = b.dataset.k; if (k === '⌫') v = v.slice(0, -1); else if (v.length < 4) v += k; dots(); if (v.length === 4) { const res = await cb(v, sh); if (res === false) { v = ''; dots(); sh.q('#pd').classList.add('shake'); setTimeout(() => sh.q('#pd') && sh.q('#pd').classList.remove('shake'), 400); } } });
  return sh;
}
let lockedNow = false;
function showLockLegacy() {
  if (!S.settings.pinHash) return; lockedNow = true;
  pinPad('رمز برنامه را وارد کنید', async v => { if (await hashPin(v, S.settings.pinSalt) === S.settings.pinHash) { lockedNow = false; legacyOk = true; sheetStack.filter(s => s.o.lock).forEach(s => s.close(true)); setTimeout(() => authGate(), 50); return true; } return false; }, { lock: true, extra: '<button class="lnk center" id="forgot">رمز را فراموش کرده‌ام</button>' });
  const fg = $('#forgot'); if (fg) fg.onclick = async () => { alertBox('فراموشی رمز', 'رمز قابل بازیابی نیست. تنها راه، پاک‌کردن اطلاعات برنامه از تنظیمات گوشی (یا حذف و نصب مجدد) و سپس «بازیابی از فایل پشتیبان» است. اگر پشتیبان ندارید اطلاعات از دست می‌رود.'); };
}
function setPin() {
  let first = null; const sh = pinPad('رمز جدید (۴ رقم)', async (v, s) => {
    if (first === null) { first = v; s.q('b').textContent = 'تکرار رمز'; return false; }
    if (v !== first) { first = null; s.q('b').textContent = 'رمز جدید (۴ رقم)'; toast('تکرار رمز یکسان نبود.', true); return false; }
    const salt = String(Math.random()).slice(2); S.settings.pinSalt = salt; S.settings.pinHash = await hashPin(v, salt); await save(); s.close(); toast('رمز فعال شد.'); render(); return true;
  });
}

/* ─────────── actions ─────────── */
const actions = {
  go: d => { goHash(d.h); },
  chip: d => { UI[d.k] = d.v; if (d.k === 'prodCat') UI.limProd = 100; if (d.k === 'rep' && d.v === 'custom' && !UI.repFrom) { UI.repFrom = Core.periodRange('month').from; UI.repTo = today(); } render(); },
  addPerson: () => personForm(), editPerson: d => personForm(Core.byId(S.people, +d.p)),
  toggleArchived: () => { UI.showArchived = !UI.showArchived; render(); },
  archive: async d => { const p = Core.byId(S.people, +d.p); await done(Core.setArchived(S, p.id, !p.archived), p.archived ? 'فعال شد.' : 'بایگانی شد.'); goHash('#/people'); },
  delPerson: async d => { const p = Core.byId(S.people, +d.p); if (await confirmBox('«' + p.name + '» حذف شود؟', 'حذف', true)) { const r = Core.deletePerson(S, p.id); if (r.ok) { await save(); goHash('#/people'); toast('حذف شد.'); } else toast(r.error, true); } },
  txForm: d => { if (gate()) txForm(d.t, +d.p || null); }, quickTx: d => { if (gate()) txForm(d.t, null); }, txOpen: d => txOpen(+d.id), transfer: d => { if (gate()) transferForm(+d.p || null); },
  stmtRange: () => { const sh = sheet('بازه صورت‌حساب', '<form id="sr">' + dateField('f', UI.stmtFrom || Core.periodRange('month').from, 'از تاریخ') + dateField('t', UI.stmtTo || today(), 'تا تاریخ') + '<button class="btn blue" type="submit">اعمال</button></form>'); sh.q('#sr').onsubmit = e => { e.preventDefault(); const f = readDate(sh.q('#sr'), 'f'), t = readDate(sh.q('#sr'), 't'); if (!f || !t) return toast('تاریخ نامعتبر است.', true); if (f > t) return toast('تاریخ شروع بعد از پایان است.', true); UI.stmtFrom = f; UI.stmtTo = t; sh.close(); render(); }; },
  stmtClear: () => { UI.stmtFrom = UI.stmtTo = null; render(); },
  shareStmt: d => shareText(Core.statementText(S, +d.p, UI.stmtFrom, UI.stmtTo)),
  csvStmt: async d => { const L = Core.ledger(S, +d.p, UI.stmtFrom, UI.stmtTo); await exportFile('statement-' + stamp() + '.csv', csvFile([['تاریخ', 'شرح', 'اضافه (' + UNIT() + ')', 'کم (' + UNIT() + ')', 'مانده (' + UNIT() + ')']].concat(L.rows.map(r => [Core.isoToJalali(r.tx.date), r.tx.desc, r.debit ? Core.shown(r.debit) : '', r.credit ? Core.shown(r.credit) : '', Core.shown(r.balance)]))), 'text/csv'); },
  newInv: d => { if (!gate()) return; const q = d.p ? '?p=' + d.p : ''; const h = '#/new/' + (d.t || 'sale') + q; goHash(h); },
  pickInvPerson: () => pickList('انتخاب شخص', personItems(), v => { $('#nf [name=pid]').value = v; $('#nf-p').textContent = personName(+v); }, { addNew: 'شخص جدید', onAdd: () => personFormInline() }),
  pickProd: (d, el) => {
    const f = $('#nf'), type = f.type.value, row = el.closest('.it-row'), fill = p => fillRowProduct(row, p);
    const top = Core.frequentProducts(S, type, +f.pid.value || 0, 12);
    pickList('انتخاب کالا', Core.productStats(S).map(x => ({ value: x.product.id, label: x.product.name, sub: x.product.sku, cat: Core.catOf(x.product), right: Core.fmtQty(x.stock) + ' ' + x.product.unit, cls: x.stock <= 0 ? 'debit' : '' })).sort((a, b) => faCmp(a.label, b.label)), v => fill(Core.byId(S.products, +v)), { addNew: can('warehouse') ? 'کالای جدید' : '', cats: true, top, topLabel: (type === 'sale' || type === 'sale_return') ? 'پرخریدهای این مشتری' : 'پرتکرار از این فروشنده', onAdd: () => productForm(null, { inInvoice: true, onSaved: fill }) });
  },
  plGo: d => { UI.rep = d.k; goHash('#/reports'); },
  more: d => { UI[d.k] += { limInv: 100, limProd: 100, limLedger: 200 }[d.k] || 150; render(); },
  repGoR: d => { UI.rep = 'custom'; UI.repFrom = d.f; UI.repTo = d.to; goHash('#/reports'); },
  searchMore: () => { UI.searchLim = (UI.searchLim || 30) + 50; render(); },
  searchGo: d => { UI.searchLim = 30; UI.searchQ = d.q; rememberSearch(d.q); goHash('#/search'); if (location.hash === '#/search') render(); }, catGo: d => { UI.prodCat = d.c; UI.prodQ = ''; goHash('#/products'); }, repGo: d => { UI.rep = d.k; goHash('#/reports'); },
  bulkProducts: () => bulkProducts(), shareReorder: () => shareReorder(), whTools: () => warehouseTools(), prodImport: () => productImportPick(), prodExport: () => productExport(), bulkPeople: () => bulkPeople(),
  scanProd: () => openScanner({ title: 'اسکن کالا', onCode: t => { const p = findProductByCode(t); if (p) prodOpen(p.id); else confirmBox('کالایی با کد «' + t + '» پیدا نشد. کالای جدید با این بارکد ساخته شود؟', 'ساخت کالا').then(y => { if (y) productForm(null, { barcode: t }); }); } }),
  labelsAll: () => { const list = prodFiltered(); if (list.length > 960) return toast('اول با جستجو فهرست را کوتاه‌تر کنید (حداکثر ۹۶۰ کالا).', true); labelSheet(list); },
  scanInv: () => openScanner({ title: 'اسکن کالاها', hint: 'کالاها را پشت سر هم اسکن کنید؛ هر کد یک عدد به فاکتور اضافه می‌کند. برای پایان، ✕ را بزنید.', continuous: true, onCode: t => scanIntoInvoice(t) }),
  activate: () => paywall(),
  copyDev: async () => { const c = await myDeviceCode(); try { await navigator.clipboard.writeText(c); toast('کد دستگاه کپی شد.'); } catch (e) { shareText(c); } },
  reportWa: async () => { diagWhatsApp(await diagReport()); try { localStorage.setItem('fq_err_seen', String(diagLoad().length)); } catch (e) { /* ignore */ } },
  reportShare: async () => shareText(await diagReport(), 'گزارش خطا'),
  errSeen: () => { try { localStorage.setItem('fq_err_seen', String(diagLoad().length)); } catch (e) { /* ignore */ } render(); },
  reportClear: async () => { if (await confirmBox('خطاهای ثبت‌شده پاک شود؟', 'پاک کن')) { diagClear(); try { localStorage.setItem('fq_err_seen', '0'); } catch (e) { /* ignore */ } render(); } },
  printInv: d => printInvoice(+d.id),
  addRow: () => { addRow(); calcInvoice(); }, rmRow: (d, el) => { if ($$('.it-row').length > 1) { el.closest('.it-row').remove(); calcInvoice(); } },
  payFull: () => { const f = $('#nf'); f.paid.value = Core.fmtInput((+f.dataset.total || 0)); calcInvoice(); },
  payInv: d => { const i = Core.byId(S.invoices, +d.id), info = Core.invoiceInfo(S, i); const isRec = i.type === 'sale' || i.type === 'purchase_return'; txForm(isRec ? 'receipt' : 'payment', i.personId, null, { ref: i.id }); setTimeout(() => { const f = $('#tf'); f.amount.value = Core.fmtInput((info.remaining)); f.desc.value = 'تسویه فاکتور ' + fa(i.no); }, 30); },
  shareInv: d => shareText(invoiceText(Core.byId(S.invoices, +d.id))),
  delInv: async d => { const i = Core.byId(S.invoices, +d.id); if (await confirmBox('فاکتور ' + fa(i.no) + ' و همه پرداخت‌های ثبت‌شده‌اش حذف شود؟ اثر آن روی حساب و انبار برگردانده می‌شود.', 'حذف فاکتور', true)) { const r = Core.deleteInvoice(S, i.id); if (r.ok) { await save(); toast('حذف شد.'); goHash('#/invoices'); } else toast(r.error, true); } },
  addProduct: () => productForm(), prodOpen: d => prodOpen(+d.id),
  addCheque: () => chequeForm(),
  chqDone: async d => { const c = Core.byId(S.cheques, +d.id); const sh = sheet('انجام شد', '<p class="msg">' + esc(c.title) + ' — ' + fmt(c.amount) + ' ' + UNIT() + '</p>' + (c.personId ? '<button class="btn blue" data-rec>ثبت در حساب ' + esc(personName(c.personId)) + ' (' + (c.direction === 'receive' ? 'دریافت' : 'پرداخت') + ')</button>' : '') + '<button class="btn ghost" data-only>فقط علامت‌گذاری (بدون ثبت در حساب)</button>'); const go = async rec => { sh.close(); await done(Core.completeCheque(S, c.id, rec, today()), 'ثبت شد.'); }; const r = sh.q('[data-rec]'); if (r) r.onclick = () => go(true); sh.q('[data-only]').onclick = () => go(false); },
  chqReopen: async d => { await done(Core.reopenCheque(S, +d.id), 'بازگردانده شد.'); },
  chqEdit: d => chequeForm(Core.byId(S.cheques, +d.id)),
  chqDel: async d => { if (await confirmBox('این مورد حذف شود؟', 'حذف', true)) await done(Core.deleteCheque(S, +d.id), 'حذف شد.'); },
  addExpense: () => { if (gate()) expenseForm(); }, expOpen: d => expenseForm(Core.byId(S.expenses, +d.id)),
  repApply: () => { const f = readDate(document, 'rf'), t = readDate(document, 'rt'); if (!f || !t) return toast('تاریخ نامعتبر است.', true); if (f > t) return toast('تاریخ شروع بعد از پایان است.', true); UI.repFrom = f; UI.repTo = t; render(); },
  csvPeople: async () => { const b = Core.balances(S); await exportFile('balances-' + stamp() + '.csv', csvFile([['نام', 'تلفن', 'مانده (' + UNIT() + ')', 'وضعیت']].concat(S.people.map(p => [p.name, p.phone, Core.shown(Math.abs(b[p.id] || 0)), sign(b[p.id])]))), 'text/csv'); },
  csvInvoices: async () => { await exportFile('invoices-' + stamp() + '.csv', csvFile([['شماره', 'نوع', 'شخص', 'تاریخ', 'جمع (' + UNIT() + ')', 'تخفیف', 'ارزش افزوده', 'پرداخت‌شده', 'مانده', 'توضیحات / سریال']].concat(S.invoices.map(i => { const n = Core.invoiceInfo(S, i); return [i.no, Core.TYPE_FA[i.type], personName(i.personId), Core.isoToJalali(i.date), Core.shown(n.total), Core.shown(n.discount), Core.shown(n.vat), Core.shown(n.paid), Core.shown(n.remaining), invNotes(i).join(' | ')]; }))), 'text/csv'); },
  csvLedger: async () => { await exportFile('ledger-' + stamp() + '.csv', csvFile([['تاریخ', 'شخص', 'شرح', 'اضافه (' + UNIT() + ')', 'کم (' + UNIT() + ')']].concat(S.tx.slice().sort((a, b) => a.date < b.date ? -1 : 1).map(t => [Core.isoToJalali(t.date), personName(t.personId), t.desc, t.kind === 'debit' ? Core.shown(t.amount) : '', t.kind === 'credit' ? Core.shown(t.amount) : '']))), 'text/csv'); },
  toggleBio: () => toggleBio(), changePass: () => changePass(), newCode: () => newCode(), logout: () => authGate(),
  userEdit: d => userForm(d.id ? +d.id : null), lockClear: () => askPass(async () => { delete S.settings.lockDate; await save(); toast('قفل برداشته شد.'); render(); }), autoRestore: () => autoRestoreFlow(),
  backup: () => doBackup(), resetData: () => resetDataFlow(), exitApp: () => exitPrompt(), restore: () => $('#restore-file').click(), setPin: () => setPin(),
  setTheme: async d => { S.settings.theme = d.v; applyAppearance(S.settings); await save(); render(); },
  setAccent: async d => { S.settings.accent = d.v; applyAppearance(S.settings); await save(); render(); },
  fontStep: async d => { const v = Number(d.v); S.settings.fontScale = v === 0 ? 1 : Math.round(Math.min(FS_MAX, Math.max(FS_MIN, (Number(S.settings.fontScale) || 1) + v * 0.1)) * 100) / 100; applyAppearance(S.settings); await save(); render(); },
  audit: () => { const p = Core.audit(S); alertBox('نتیجه بررسی', p.length ? '<b class="debit">' + fa(p.length) + ' مشکل پیدا شد:</b><ul>' + p.slice(0, 10).map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' : ico('check') + 'همه‌چیز سالم است. حساب اشخاص، فاکتورها و موجودی انبار کاملاً هماهنگ‌اند.'); },
  wipe: async () => { if (!(await confirmBox('همه اطلاعات برنامه برای همیشه پاک می‌شود. قبلش پشتیبان گرفته‌اید؟', 'ادامه', true))) return; const sh = sheet('تأیید نهایی', '<p class="msg">برای تأیید، کلمه «حذف» را بنویسید.</p><input class="inp" id="wp"><button class="btn red" id="wp-ok">پاک کن</button>'); sh.q('#wp-ok').onclick = async () => { if (sh.q('#wp').value.trim() !== 'حذف') return toast('کلمه تأیید درست نیست.', true); sh.close(); const keep = Object.assign({}, S.settings); delete keep.openingCash; delete keep.lastBackup; S = Core.emptyState(); Object.assign(S.settings, keep); await save(); toast('همه اطلاعات پاک شد.'); goHash('#/home'); render(); }; }
};
function personFormInline() { // quick-add from invoice picker
  const sh = sheet('شخص جدید', '<form id="pq"><label class="fld"><span>نام</span><input class="inp" name="name" autocomplete="off"></label><label class="fld"><span>تلفن</span><input class="inp ltr" name="phone" inputmode="tel"></label><button class="btn blue" type="submit">ذخیره و انتخاب</button></form>');
  sh.q('#pq').onsubmit = async e => { e.preventDefault(); const f = e.target; const r = Core.addPerson(S, { name: f.name.value, phone: f.phone.value }); if (!r.ok) return toast(r.error, true); await save(); sh.close(); $('#nf [name=pid]').value = r.person.id; $('#nf-p').textContent = r.person.name; };
  autoFocus(() => sh.q('[name=name]'));
}

/* ─────────── router / shell ─────────── */
const routes = {
  home: pageHome, people: pagePeople, person: pagePerson, invoices: pageInvoices, inv: pageInvoice, edit: (a) => { const i = Core.byId(S.invoices, +a); return i ? pageNewInvoice(i.type, { edit: i }) : { title: 'ویرایش', html: empty(ico('help'), 'فاکتور پیدا نشد.'), back: '#/invoices' }; }, new: (a) => pageNewInvoice(a, Object.fromEntries(new URLSearchParams((location.hash.split('?')[1]) || ''))),
  search: pageSearch, products: pageProducts, stock: pageStock, kardex: pageKardex, cheques: pageCheques, expenses: pageExpenses, reports: pageReports, more: pageMore, settings: pageSettings
};
const navMap = { search: 'home', home: 'home', people: 'people', person: 'people', invoices: 'invoices', inv: 'invoices', edit: 'invoices', new: 'invoices', products: 'products', stock: 'products', kardex: 'products', more: 'more', cheques: 'more', expenses: 'more', reports: 'more', settings: 'more' };
let lastRoute = '';
function render() {
  const hash = (location.hash || '#/home').split('?')[0]; const [, page, arg] = hash.split('/'); const fn = routes[page] || routes.home;
  let res; try { res = routeAllowed(page) ? fn(arg) : { title: 'دسترسی محدود', html: empty(ico('lock'), 'برای دیدن این بخش اجازه ندارید. از مدیر برنامه بخواهید.', backTo('#/home')), back: '#/home' }; } catch (e) { console.error(e); diagLog('render', e.message, e.stack, hash); res = { title: 'خطا', html: '<div class="card"><b class="debit">خطای برنامه</b><p class="hint">' + esc(e.message) + '</p><p class="hint">لطفاً گزارش خطا را بفرستید تا برطرف شود. اطلاعات شما سالم است.</p><button class="btn green" data-act="reportWa">ارسال گزارش در واتساپ</button><button class="btn blue" data-act="go" data-h="#/home">بازگشت به خانه</button></div>' }; }
  const main = $('#main'), keep = main.scrollTop, same = lastRoute === hash; main.innerHTML = res.html; main.scrollTop = same ? keep : 0; lastRoute = hash; lastFull = location.hash || '#/home';
  $('#title').textContent = res.title; const bk = $('#back'); bk.hidden = !res.back; bk.dataset.h = res.back || '';
  $$('.nav [data-nav]').forEach(b => b.classList.toggle('on', b.dataset.nav === (navMap[page] || 'home')));
  const fab = $('#fab'); fab.hidden = !res.fab; if (res.fab) { fab.dataset.act = res.fab[0]; if (res.fab[1] === '+') fab.innerHTML = ico('plus'); else fab.textContent = res.fab[1]; fab.dataset.t = (res.fabData && res.fabData.t) || ''; }
  if (res.fab && !actAllowed(fab)) fab.hidden = true;
  if (!isAdmin()) $$('#main [data-act]').forEach(el => { if (!actAllowed(el)) el.remove(); });
  if (res.mount) res.mount();
}
// what a sub-user may open / press
function routeAllowed(page) {
  if (isAdmin()) return true;
  page = page || ((location.hash || '#/home').split('?')[0].split('/')[1] || 'home');
  const arg = (location.hash || '').split('?')[0].split('/')[2] || '';
  if (page === 'reports') return can('reports');
  if (page === 'kardex') return can('cost');
  if (page === 'edit') return can('edit');
  if (page === 'new' && (arg === 'purchase' || arg === 'purchase_return')) return can('purchase');
  return true;
}
const ACT_PERM = { addPerson: 'people', editPerson: 'people', archive: 'people', delPerson: 'people', bulkPeople: 'people', txForm: 'money', quickTx: 'money', transfer: 'money', payInv: 'money', addCheque: 'money', chqDone: 'money', chqReopen: 'edit', chqEdit: 'edit', chqDel: 'edit', addExpense: 'money', delInv: 'edit', addProduct: 'warehouse', bulkProducts: 'warehouse', whTools: 'warehouse', prodImport: 'warehouse', csvPeople: 'balances', csvStmt: 'balances', shareStmt: 'balances', csvLedger: 'reports', csvInvoices: 'reports', backup: 'backup', restore: 'backup', autoRestore: 'backup', plGo: 'reports', resetData: 'admin', wipe: 'admin', activate: 'admin', userEdit: 'admin', lockClear: 'admin', audit: 'admin' };
function actAllowed(el) {
  if (isAdmin()) return true; const a = el.dataset.act, need = ACT_PERM[a];
  if (need) return need === 'admin' ? false : can(need);
  if (a === 'go') { const h = el.dataset.h || ''; if (h.startsWith('#/reports')) return can('reports'); if (h.startsWith('#/edit/')) return can('edit'); if (h.startsWith('#/kardex/')) return can('cost'); if (/^#\/new\/purchase/.test(h)) return can('purchase'); }
  if (a === 'newInv' && (el.dataset.t === 'purchase' || el.dataset.t === 'purchase_return')) return can('purchase');
  return true;
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) return; const fn = actions[b.dataset.act]; if (fn) { e.preventDefault(); try { const r = fn(b.dataset, b, e); if (r && r.catch) r.catch(x => { diagLog('action', x && x.message || x, x && x.stack, b.dataset.act); toast('خطایی رخ داد؛ از تنظیمات «گزارش خطا» را بفرستید.', true); }); } catch (x) { diagLog('action', x.message, x.stack, b.dataset.act); toast('خطایی رخ داد؛ از تنظیمات «گزارش خطا» را بفرستید.', true); } }
});
let searchT;
document.addEventListener('input', e => {
  const i = e.target; const m = { 'people-q': 'peopleQ', 'inv-q': 'invQ', 'prod-q': 'prodQ', 'gs-q': 'searchQ' }[i.id]; if (!m) return; UI[m] = i.value; UI.searchLim = 30; UI.limPeople = 150; UI.limInv = 100; UI.limProd = 100; clearTimeout(searchT); searchT = setTimeout(() => { const cur = document.activeElement === i; const pos = i.selectionStart; render(); const n = $('#' + i.id); if (n && cur) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (x) { /* ignore */ } } }, 180);
});
let lastFull = '';
window.addEventListener('hashchange', () => { if ((location.hash || '#/home') !== lastFull) render(); }); // ignore duplicate events for the same address (would wipe an open form)

/* ─────────── account: register / login / recovery ─────────── */
/* ── fingerprint (native biometric prompt, Android) ── */
let bioReady = false, bioBusy = false;
const bioPlugin = () => { const P = window.Capacitor && window.Capacitor.Plugins; return isNative() && P ? (P.BiometricAuthNative || P.BiometricAuth || null) : null; };
async function bioAvail() { const b = bioPlugin(); if (!b) return false; try { const r = await b.checkBiometry(); return !!(r && r.isAvailable); } catch (e) { return false; } }
async function bioCheck() { bioReady = !!(S.settings.bio && await bioAvail()); }
async function bioAsk(reason) {
  const b = bioPlugin(); if (!b) return false;
  try { await b.internalAuthenticate({ reason: reason || 'برای ورود به برنامه اثر انگشت خود را بگذارید', cancelTitle: 'استفاده از رمز', allowDeviceCredential: false, androidTitle: 'فیکس کوییک', androidSubtitle: 'ورود با اثر انگشت', androidConfirmationRequired: false }); return true; } catch (e) { return false; }
}
async function bioLogin() {
  if (bioBusy || !lockedNow || !$('#bio')) return; bioBusy = true;
  try { if (await bioAsk()) { authClose(); render(); } } finally { bioBusy = false; }
}
async function offerBio() {
  if (S.settings.bio || S.settings.bioAsked || !(await bioAvail())) return;
  S.settings.bioAsked = true; await save();
  if (await confirmBox('از این به بعد با اثر انگشت وارد برنامه شوید و هر بار رمز نزنید؟', 'فعال‌سازی')) { if (await bioAsk('برای فعال‌سازی، اثر انگشت خود را بگذارید')) { S.settings.bio = true; await save(); toast('ورود با اثر انگشت فعال شد.'); render(); } else toast('فعال نشد. بعداً از تنظیمات می‌توانید فعال کنید.', true); }
}
async function toggleBio() {
  if (S.settings.bio) { S.settings.bio = false; await save(); toast('ورود با اثر انگشت غیرفعال شد.'); render(); return; }
  if (!(await bioAvail())) return toast('اثر انگشتی روی این گوشی فعال نیست. ابتدا در تنظیمات گوشی اثر انگشت اضافه کنید.', true);
  if (await bioAsk('برای فعال‌سازی، اثر انگشت خود را بگذارید')) { S.settings.bio = true; await save(); toast('ورود با اثر انگشت فعال شد.'); render(); } else toast('تأیید نشد.', true);
}

let legacyOk = false, failN = 0, failUntil = 0;
const SEC_QS = ['نام اولین مدرسه‌ی من چه بود؟', 'نام شهر تولد من چیست؟', 'نام بهترین دوست دوران کودکی من؟', 'مدل اولین گوشی من چه بود؟', 'نام حیوان خانگی (یا مورد علاقه) من؟'];
const normAns = s => Core.toEn(String(s || '')).replace(/[\s‌\-]+/g, '').toLowerCase();
const normCode = s => Core.toEn(String(s || '')).replace(/[^A-Za-z0-9]/g, '').toUpperCase();
function genCode() { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', b = new Uint8Array(12); (window.crypto || {}).getRandomValues ? crypto.getRandomValues(b) : b.forEach((_, i) => b[i] = Math.floor(Math.random() * 256)); const s = Array.from(b).map(x => A[x % A.length]).join(''); return s.slice(0, 4) + '-' + s.slice(4, 8) + '-' + s.slice(8, 12); }
const newSalt = () => String(Math.random()).slice(2) + Date.now();
async function mkAuth(user, pass, q, ans, code, old) {
  const a = Object.assign({}, old || {}); a.user = user; if (pass !== null) { a.salt = newSalt(); a.hash = await hashPin(pass, a.salt); }
  if (q !== undefined) { a.q = q; a.asalt = newSalt(); a.ahash = await hashPin(normAns(ans), a.asalt); }
  if (code) { a.rsalt = newSalt(); a.rhash = await hashPin(normCode(code), a.rsalt); }
  return a;
}
function authOverlay(html) {
  let o = $('#auth'); if (!o) { o = document.createElement('div'); o.id = 'auth'; document.body.appendChild(o); }
  o.innerHTML = '<div class="auth-box"><img class="auth-logo" src="logo.png" alt="">' + html + '</div>'; return o;
}
let nextSession = null;
function authClose() { const o = $('#auth'); if (o) o.remove(); lockedNow = false; if (nextSession) { CUR = nextSession; nextSession = null; } else setAdminSession(); }
function pwField(name, label, ac) { return '<label class="fld"><span>' + label + '</span><input class="inp ltr" type="password" name="' + name + '" id="pw-' + name + '" autocomplete="' + (ac || 'current-password') + '"></label>'; }
function authGate(relock) {
  if (!S.settings.auth) { if (S.settings.pinHash && !legacyOk) { showLockLegacy(); return; } return authWelcome(); }
  lockedNow = true; bioCheck().then(() => { if (lockedNow) authLogin(); });
}
const restoreBtn = '<button type="button" class="btn ghost" id="a-rs">' + ico('folder') + 'بازیابی از فایل پشتیبان</button><input type="file" id="a-rf" accept=".json,application/json" hidden>';
function bindRestore(o) { const b = $('#a-rs', o), f = $('#a-rf', o); if (!b) return; b.onclick = () => f.click(); f.onchange = async e => { const file = e.target.files[0]; e.target.value = ''; if (file) await authRestore(await file.text()); }; }
function authWelcome() {
  lockedNow = true;
  const o = authOverlay('<h2>به فیکس کوییک خوش آمدید</h2><p class="hint center">اولین بار است که برنامه را باز می‌کنید؟</p><button type="button" class="btn blue" id="a-new">' + ico('user') + 'ثبت‌نام (کاربر جدید)</button><p class="hint center" style="margin-top:18px">قبلاً حساب داشته‌اید؟ فایل پشتیبان را انتخاب کنید تا اطلاعات، نام کاربری، رمز و کد بازیابی قبلی‌تان برگردد.</p>' + restoreBtn);
  $('#a-new', o).onclick = () => authRegister(); bindRestore(o);
}
async function authRestore(text) {
  const r = Core.parseBackup(text); if (!r.ok) return toast(r.error, true);
  const st = r.state, has = S.people.length + S.products.length + S.invoices.length + S.tx.length;
  const msg = 'این فایل شامل ' + fa(st.people.length) + ' شخص، ' + fa(st.products.length) + ' کالا و ' + fa(st.invoices.length) + ' فاکتور است' + (st.settings.auth ? ' (حساب کاربری «' + st.settings.auth.user + '»)' : '') + '.' + (has ? ' اطلاعات فعلی این گوشی با آن جایگزین می‌شود.' : '') + ' ادامه می‌دهید؟';
  if (!(await confirmBox(msg, 'بازیابی', !!has))) return;
  try { await kvSet('state_before_restore', JSON.stringify(S)); } catch (x) { /* ignore */ }
  const au0 = S.settings.auth; S = Object.assign(Core.emptyState(), st); if (!S.settings.auth && au0) S.settings.auth = au0; applySettings(S.settings); legacyOk = false; await licCheck(); await save();
  if (S.settings.auth) { toast('بازیابی شد. با نام کاربری و رمز قبلی وارد شوید.'); authGate(); }
  else if (S.settings.pinHash) { toast('بازیابی شد. رمز ۴ رقمی قبلی را بزنید.'); authGate(); }
  else { toast('اطلاعات بازیابی شد؛ این پشتیبان حساب کاربری نداشت. یک حساب بسازید.'); authRegister(); }
}
function authRegister() {
  lockedNow = true;
  const o = authOverlay('<h2>ثبت‌نام</h2><p class="hint center">یک نام کاربری و رمز برای ورود به برنامه بسازید. اطلاعات فعلی شما حفظ می‌شود.</p><form id="af"><label class="fld"><span>نام کاربری</span><input class="inp ltr" name="u" id="fq-user" autocomplete="username" autocapitalize="none"></label>' + pwField('p1', 'رمز (حداقل ۶ نویسه)', 'new-password') + pwField('p2', 'تکرار رمز', 'new-password') + '<label class="fld"><span>سؤال امنیتی (برای بازیابی رمز)</span><select class="inp" name="q">' + SEC_QS.map(q => '<option>' + q + '</option>').join('') + '</select></label><label class="fld"><span>پاسخ</span><input class="inp" name="a" autocomplete="off"></label><button class="btn blue" type="submit">ثبت‌نام</button></form>' + restoreBtn + (S.settings.auth ? '' : '<button type="button" class="lnk center" id="a-bk">بازگشت</button>'));
  bindRestore(o); const bk = $('#a-bk', o); if (bk) bk.onclick = authWelcome;
  $('#af', o).onsubmit = async e => {
    e.preventDefault(); const f = e.target, u = f.u.value.trim(), p1 = f.p1.value, p2 = f.p2.value, a = f.a.value.trim();
    if (u.length < 3) return toast('نام کاربری حداقل ۳ نویسه باشد.', true);
    if (p1.length < 6) return toast('رمز حداقل ۶ نویسه باشد.', true);
    if (p1 !== p2) return toast('تکرار رمز یکسان نیست.', true);
    if (normAns(a).length < 2) return toast('پاسخ سؤال امنیتی را بنویسید.', true);
    const code = genCode(); S.settings.auth = await mkAuth(u, p1, f.q.value, a, code); delete S.settings.pinHash; delete S.settings.pinSalt; await save();
    showCode(code, () => { authClose(); toast('خوش آمدید.'); render(); offerBio(); });
  };
}
function showCode(code, next) {
  const o = authOverlay('<h2>کد بازیابی شما</h2><p class="hint center">اگر رمز را فراموش کردید، با این کد می‌توانید رمز جدید بسازید. آن را جای امن (عکس صفحه، پیام به خودتان) نگه دارید. این کد دوباره نمایش داده نمی‌شود.</p><div class="rcode">' + code + '</div><div class="row2"><button class="btn ghost" id="cc">کپی / ارسال</button></div><label class="chk"><input type="checkbox" id="sv"> کد را ذخیره کردم</label><button class="btn blue" id="cn">ادامه</button>');
  $('#cc', o).onclick = () => shareText('کد بازیابی فیکس کوییک: ' + code);
  $('#cn', o).onclick = () => { if (!$('#sv', o).checked) return toast('ابتدا کد را ذخیره کنید و تیک را بزنید.', true); next(); };
}
function lastUser() { let u = ''; try { u = localStorage.getItem('fq_lastuser') || ''; } catch (e) { /* ignore */ } const au = S.settings.auth || {}; return u && (findSubUser(u) || u.toLowerCase() === (au.user || '').toLowerCase()) ? u : (au.user || ''); }
function lastIsAdmin() { return lastUser().toLowerCase() === ((S.settings.auth || {}).user || '').toLowerCase(); }
function authLogin() {
  const au = S.settings.auth;
  const o = authOverlay('<h2>ورود</h2><form id="af"><label class="fld"><span>نام کاربری</span><input class="inp ltr" name="u" id="fq-user" value="' + esc(lastUser()) + '" autocomplete="username" autocapitalize="none"></label>' + pwField('p', 'رمز') + '<button class="btn blue" type="submit">ورود</button></form>' + (bioReady && lastIsAdmin() ? '<button class="btn ghost" id="bio" type="button">' + ico('finger') + 'ورود با اثر انگشت</button>' : '') + '<button class="lnk center" id="fg">رمز را فراموش کرده‌ام</button><button type="button" class="lnk center" id="a-rs">' + ico('folder') + 'بازیابی از فایل پشتیبان</button><input type="file" id="a-rf" accept=".json,application/json" hidden>');
  bindRestore(o);
  $('#af', o).onsubmit = async e => {
    e.preventDefault(); const f = e.target;
    if (Date.now() < failUntil) return toast('چند بار اشتباه زدید؛ ' + fa(Math.ceil((failUntil - Date.now()) / 1000)) + ' ثانیه صبر کنید.', true);
    const un = f.u.value.trim(), isAdm = un.toLowerCase() === au.user.toLowerCase();
    const ok = isAdm ? await hashPin(f.p.value, au.salt) === au.hash : await subLogin(un, f.p.value);
    if (ok) { failN = 0; try { localStorage.setItem('fq_lastuser', un); } catch (x) { /* ignore */ } if (!isAdm) { nextSession = CUR; } authClose(); if (!isAdm && !routeAllowed()) location.hash = '#/home'; render(); if (isAdm) offerBio(); return; }
    failN++; if (failN >= 5) { failUntil = Date.now() + Math.min(300, 15 * (failN - 4)) * 1000; } toast('نام کاربری یا رمز اشتباه است.', true); f.p.value = '';
  };
  $('#fg', o).onclick = authForgot;
  if (bioReady && lastIsAdmin()) { $('#bio', o).onclick = bioLogin; setTimeout(bioLogin, 350); }
}
function authForgot() {
  const au = S.settings.auth;
  const o = authOverlay('<h2>بازیابی رمز</h2><p class="hint center">یکی از دو راه را انتخاب کنید.</p><form id="af"><label class="fld"><span>کد بازیابی (مثل ABCD-EFGH-JKLM)</span><input class="inp ltr" name="c" autocomplete="off"></label><p class="hint center">— یا —</p><div class="hint">' + esc(au.q || '') + '</div><input class="inp" name="a" placeholder="پاسخ سؤال امنیتی" autocomplete="off"><button class="btn blue" type="submit">تأیید</button></form><button class="lnk center" id="bk">بازگشت</button><p class="hint center">اگر هر دو را ندارید، تنها راه، حذف برنامه و نصب دوباره و «بازیابی از فایل پشتیبان» است.</p>');
  $('#bk', o).onclick = authLogin;
  $('#af', o).onsubmit = async e => {
    e.preventDefault(); const f = e.target, c = normCode(f.c.value), a = normAns(f.a.value);
    if (Date.now() < failUntil) return toast('کمی صبر کنید و دوباره تلاش کنید.', true);
    let ok = false;
    if (c && au.rhash && await hashPin(c, au.rsalt) === au.rhash) ok = true;
    else if (!c && a && au.ahash && await hashPin(a, au.asalt) === au.ahash) ok = true;
    if (!ok) { failN++; if (failN >= 5) failUntil = Date.now() + 60e3; return toast('کد یا پاسخ درست نیست.', true); }
    failN = 0; authReset();
  };
}
function authReset() {
  const o = authOverlay('<h2>رمز جدید</h2><form id="af">' + pwField('p1', 'رمز جدید (حداقل ۶ نویسه)', 'new-password') + pwField('p2', 'تکرار رمز', 'new-password') + '<button class="btn blue" type="submit">ذخیره و ورود</button></form>');
  $('#af', o).onsubmit = async e => {
    e.preventDefault(); const f = e.target; if (f.p1.value.length < 6) return toast('رمز حداقل ۶ نویسه باشد.', true); if (f.p1.value !== f.p2.value) return toast('تکرار رمز یکسان نیست.', true);
    const code = genCode(); S.settings.auth = await mkAuth(S.settings.auth.user, f.p1.value, undefined, undefined, code, S.settings.auth); await save();
    showCode(code, () => { authClose(); toast('رمز جدید فعال شد.'); render(); });
  };
}
// ask for the current password before sensitive account changes
function askPass(then) {
  const sh = sheet('رمز فعلی', '<form id="pf">' + pwField('p', 'رمز فعلی را وارد کنید') + '<button class="btn blue" type="submit">تأیید</button></form>');
  sh.q('#pf').onsubmit = async e => { e.preventDefault(); const au = S.settings.auth; if (await hashPin(e.target.p.value, au.salt) !== au.hash) return toast('رمز اشتباه است.', true); sh.close(); then(); };
}
function changePass() {
  askPass(() => { const sh = sheet('تغییر رمز', '<form id="pf">' + pwField('p1', 'رمز جدید (حداقل ۶ نویسه)') + pwField('p2', 'تکرار رمز') + '<button class="btn blue" type="submit">ذخیره</button></form>');
    sh.q('#pf').onsubmit = async e => { e.preventDefault(); const f = e.target; if (f.p1.value.length < 6) return toast('رمز حداقل ۶ نویسه باشد.', true); if (f.p1.value !== f.p2.value) return toast('تکرار رمز یکسان نیست.', true); S.settings.auth = await mkAuth(S.settings.auth.user, f.p1.value, undefined, undefined, null, S.settings.auth); await save(); sh.close(); toast('رمز تغییر کرد.'); }; });
}
function newCode() {
  askPass(async () => { const code = genCode(); S.settings.auth = await mkAuth(S.settings.auth.user, null, undefined, undefined, code, S.settings.auth); await save(); showCode(code, () => { authClose(); toast('کد جدید فعال شد؛ کد قبلی باطل شد.'); }); });
}

/* ─────────── scanning into the invoice form ─────────── */
function scanIntoInvoice(text) {
  const f = $('#nf'); if (!f) return false;
  const p = findProductByCode(text);
  if (!p) {
    const type = f.type.value;
    if (type === 'purchase') { scanStop(); productForm(null, { inInvoice: true, barcode: /^FQP-/i.test(text) ? '' : text, onSaved: np => { putProductInRow(np); } }); return false; }
    toast('کالایی با کد «' + text + '» پیدا نشد.', true); return true;
  }
  putProductInRow(p); toast('➕ ' + p.name); return true;
}
// put a product into an invoice row: price = what this person paid last time (same kind of invoice), else the product's default price
function fillRowProduct(row, p) {
  const f = $('#nf'), type = f.type.value, pid = +f.pid.value || 0, saleSide = type === 'sale' || type === 'sale_return';
  row.dataset.pid = p.id; $('.pick', row).textContent = p.name; const pr = $('[name=price]', row);
  const last = Core.lastPrice(S, type, pid, p.id) || (type === 'sale_return' ? Core.lastPrice(S, 'sale', pid, p.id) : type === 'purchase_return' ? Core.lastPrice(S, 'purchase', pid, p.id) : null);
  if (!pr.value) { const dp = last ? last.price : saleSide ? p.salePrice : p.buyPrice; if (dp) pr.value = Core.fmtInput(dp); }
  const stk = Core.replay(S).stock[p.id], have = stk ? stk.stock : 0;
  $('.stk', row).innerHTML = esc('موجودی فعلی: ' + Core.fmtQty(have) + ' ' + p.unit) + (last ? ' · <b class="lastp">آخرین قیمت ' + (saleSide ? 'به' : 'از') + ' همین شخص: ' + fmt(last.price) + ' (' + fmtDate(last.date) + ')</b>' : '');
  $('.stk', row).classList.toggle('debit', have <= 0);
  if (have <= 0 && (type === 'sale' || type === 'purchase_return')) toast('«' + p.name + '» موجودی ندارد؛ فاکتور بدون موجودی ثبت نمی‌شود.', true);
  calcInvoice();
}
function putProductInRow(p) {
  const rows = $$('.it-row');
  const same = rows.find(r => +r.dataset.pid === p.id && !$('[name=sn]', r).value.trim());
  if (same) { const q = $('[name=qty]', same); q.value = fa(Core.toEn(q.value) * 1 + 1 || 1); calcInvoice(); return; }
  let row = rows.find(r => !r.dataset.pid); if (!row) { addRow(); const all = $$('.it-row'); row = all[all.length - 1]; }
  fillRowProduct(row, p);
}

/* ─────────── free limit & unlimited version ─────────── */
let licOk = false, devCodeCache = null;
async function myDeviceCode() {
  if (devCodeCache) return devCodeCache;
  let raw = null;
  try { const P = window.Capacitor && window.Capacitor.Plugins; if (isNative() && P && P.Device && P.Device.getId) { const r = await P.Device.getId(); raw = r && (r.identifier || r.uuid); } } catch (e) { /* ignore */ }
  if (!raw) { try { raw = await kvGet('device_id'); } catch (e) { /* ignore */ } if (!raw) { raw = 'w-' + Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, '0')).join(''); try { await kvSet('device_id', raw); } catch (e) { /* ignore */ } } }
  devCodeCache = await License.deviceCodeFrom(raw); return devCodeCache;
}
async function licCheck() {
  const l = S.settings.license; licOk = false;
  if (l && l.code) licOk = await License.verify(l.code, await myDeviceCode());
  return licOk;
}
function usedDocs() { let ls = 0; try { ls = +localStorage.getItem('fq_used') || 0; } catch (e) { /* ignore */ } return Math.max(License.countDocs(S), S.settings.usedDocs || 0, ls); }
function bumpUsage() { const n = usedDocs(); S.settings.usedDocs = n; try { localStorage.setItem('fq_used', String(n)); } catch (e) { /* ignore */ } }
function freeLeft() { return Math.max(0, License.FREE_LIMIT - usedDocs()); }
// call before creating a new invoice / receipt / payment / transfer / expense
function gate() { if (licOk || freeLeft() > 0) return true; paywall(true); return false; }
async function paywall(blocked) {
  const dev = await myDeviceCode(), used = usedDocs();
  const msg = 'سلام، درخواست فعال‌سازی نسخه نامحدود حسابداری فیکس کوییک را دارم.\nکد دستگاه: ' + dev + '\n(تصویر رسید واریز را هم می‌فرستم)';
  const sh = sheet(licOk ? 'نسخه نامحدود' : 'فعال‌سازی نسخه نامحدود', licOk ? '<div class="alert">' + ico('check') + 'نسخه نامحدود روی این گوشی فعال است. از همه امکانات بدون محدودیت استفاده کنید.</div><p class="hint">کد دستگاه: <b class="ltr">' + dev + '</b></p>' :
    (blocked ? '<div class="alert warn">ثبت رایگان شما (' + fa(License.FREE_LIMIT) + ' فاکتور و سند) تمام شده است. اطلاعات شما سالم است و می‌توانید همه را ببینید، پشتیبان بگیرید و چاپ کنید؛ برای ثبت جدید، نسخه نامحدود را فعال کنید.</div>' : '<p class="hint">تا الان ' + fa(Math.min(used, License.FREE_LIMIT)) + ' از ' + fa(License.FREE_LIMIT) + ' سند رایگان استفاده شده است.</p>') +
    '<div class="paybox"><div class="step"><b>۱</b><span>مبلغ <b>' + esc(License.PRICE_TEXT) + '</b> را به کارت زیر واریز کنید:<br><b class="ltr cardno">' + esc(License.CARD_NO) + '</b><br>به نام ' + esc(License.CARD_OWNER) + ' · ' + esc(License.CARD_BANK) + '<br><button type="button" class="lnk" id="pw-card">کپی شماره کارت</button></span></div>' +
    '<div class="step"><b>۲</b><span>تصویر رسید و کد دستگاه زیر را در واتساپ بفرستید:<br><b class="ltr devc">' + dev + '</b></span></div><div class="row2"><button type="button" class="btn green" id="pw-wa">ارسال در واتساپ</button><button type="button" class="btn ghost" data-act="copyDev">کپی کد دستگاه</button></div>' +
    '<div class="step"><b>۳</b><span>کد فعال‌سازی را که برایتان فرستاده می‌شود اینجا بچسبانید:</span></div><textarea class="inp ltr" id="pw-code" rows="3" style="height:auto;padding:10px" placeholder="XXXXX-XXXXX-…"></textarea><button type="button" class="btn blue" id="pw-ok">فعال‌سازی</button></div><p class="hint">کد فعال‌سازی فقط روی همین گوشی کار می‌کند.</p>');
  if (licOk) return;
  sh.q('#pw-card').onclick = async () => { try { await navigator.clipboard.writeText(License.CARD_NO.replace(/-/g, '')); toast('شماره کارت کپی شد.'); } catch (e) { toast(License.CARD_NO); } };
  sh.q('#pw-wa').onclick = () => { const a = document.createElement('a'); a.href = 'https://wa.me/' + License.SUPPORT_WA + '?text=' + encodeURIComponent(msg); a.target = '_blank'; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove(); };
  sh.q('#pw-ok').onclick = async () => {
    const code = sh.q('#pw-code').value; if (!License.normCode(code)) return toast('کد فعال‌سازی را وارد کنید.', true);
    if (await License.verify(code, dev)) { S.settings.license = { code: License.normCode(code), dev, at: Date.now() }; licOk = true; await save(); sh.close(); alertBox('🎉 فعال شد', 'نسخه نامحدود روی این گوشی فعال شد. از اعتماد شما سپاسگزاریم.'); render(); }
    else toast('کد فعال‌سازی درست نیست یا برای گوشی دیگری صادر شده است.', true);
  };
}

/* ─────────── Android back button / leaving the app ─────────── */
const capApp = () => { const P = window.Capacitor && window.Capacitor.Plugins; return isNative() && P ? (P.App || null) : null; };
let exitOpen = false;
function exitPrompt() {
  if (exitOpen) return; exitOpen = true;
  const days = S.settings.lastBackup ? Core.diffDays(S.settings.lastBackup, today()) : null;
  const last = days === null ? 'هنوز هیچ پشتیبانی نگرفته‌اید.' : days === 0 ? 'آخرین پشتیبان: امروز' : 'آخرین پشتیبان: ' + fa(days) + ' روز پیش (' + fmtDate(S.settings.lastBackup) + ')';
  const quit = () => { const A = capApp(); if (A && A.exitApp) A.exitApp(); else toast('برای خروج، برنامه را ببندید.'); };
  const sh = sheet('خروج از برنامه', '<div class="exitbox">' + ico('save', 'big') + '<p class="msg">قبل از خروج، از اطلاعات پشتیبان بگیرید تا اگر گوشی خراب یا گم شد، حساب‌هایتان از بین نرود.</p><p class="hint center">' + last + '</p></div><button class="btn green" data-bk>' + ico('save') + 'پشتیبان بگیر و خارج شو</button><button class="btn ghost" data-q>' + ico('exit') + 'خروج بدون پشتیبان</button><button class="btn ghost" data-close>انصراف (ماندن در برنامه)</button>', { onClose: () => { exitOpen = false; } });
  if (!can('backup')) sh.q('[data-bk]').remove(); else sh.q('[data-bk]').onclick = async () => { if (await doBackup(true)) { sh.close(true); exitOpen = false; quit(); } else toast('پشتیبان گرفته نشد.', true); };
  sh.q('[data-q]').onclick = () => { sh.close(true); exitOpen = false; quit(); };
}
function onBackButton() {
  if (document.getElementById('scan')) return scanStop();
  if (lockedNow) { const A = capApp(); if (A) A.exitApp(); return; }
  const top = sheetStack[sheetStack.length - 1];
  if (top) { if (!top.o.lock) top.close(); return; }
  const bk = $('#back'); const page = (location.hash || '#/home').split('?')[0].split('/')[1] || 'home';
  if (bk && !bk.hidden && bk.dataset.h) return goHash(bk.dataset.h);
  if (page !== 'home') return goHash('#/home');
  exitPrompt();
}
async function boot() {
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* ignore */ }
  await loadState(); try { await licCheck(); } catch (e) { /* ignore */ } render(); $('#splash').remove();
  authGate();
  try { const A = capApp(); if (A && A.addListener) A.addListener('backButton', onBackButton); } catch (e) { /* older build without the App plugin: Android's default back */ }
  setTimeout(() => autoBackup(), 4000);
  setTimeout(() => { try { Core.search(S, 'ا'); } catch (e) { /* warm up the search index */ } }, 6000);
  let hiddenAt = 0; document.addEventListener('visibilitychange', () => { if (document.hidden) { hiddenAt = Date.now(); if (Date.now() - autoBkAt > 30 * 60e3) autoBackup(true); return; } autoBackup(); if (hiddenAt && Date.now() - hiddenAt > 60e3 && !lockedNow) authGate(true); });
  if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !isNative()) navigator.serviceWorker.register('sw.js').catch(() => { });
}
window.addEventListener('DOMContentLoaded', boot);
