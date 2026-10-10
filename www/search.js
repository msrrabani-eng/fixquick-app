/* Smart global search: one box for people, products, categories, invoices, serials/IMEI, amounts and short commands. */
'use strict';
const SEARCH_TIPS = ['آیفون ۱۳ پرو', 'طلب علی', 'فاکتور ۲۵', 'موجودی کابل', 'فروش امروز', '۰۹۱۲', '۵۶۷۸ (۴ رقم آخر سریال)'];
function recentSearches() { try { return JSON.parse(localStorage.getItem('fq_recent') || '[]'); } catch (e) { return []; } }
function rememberSearch(q) { q = String(q || '').trim(); if (q.length < 2) return; try { const r = recentSearches().filter(x => x !== q); r.unshift(q); localStorage.setItem('fq_recent', JSON.stringify(r.slice(0, 8))); } catch (e) { /* ignore */ } }

function smartSearch(q) {
  const out = { answer: [], serials: [], people: [], products: [], cats: [], invoices: [], tx: [] };
  const raw = Core.toEn(String(q || '')).trim(); if (!raw) return out;
  const digits = raw.replace(/[\s\-]/g, ''), onlyNum = /^\d+$/.test(digits), words = Core.searchWords(raw);
  const bal = Core.balances(S), stats = Core.productStats(S), stockOf = id => { const x = stats.find(s => s.product.id === id); return x ? x.stock : 0; };
  const findPeople = (text, n) => S.people.map(p => ({ p, sc: Core.fuzzyScore(p.name + ' ' + (p.phone || '') + ' ' + (p.note || ''), Core.searchWords(text)) })).filter(x => x.sc).sort((a, b) => b.sc - a.sc || faCmp(a.p.name, b.p.name)).slice(0, n || 8).map(x => x.p);
  const findProducts = (text, n) => S.products.map(p => ({ p, sc: Core.fuzzyScore(p.name + ' ' + (p.sku || '') + ' ' + (p.barcode || '') + ' ' + Core.catOf(p), Core.searchWords(text)) })).filter(x => x.sc).sort((a, b) => b.sc - a.sc || faCmp(a.p.name, b.p.name)).slice(0, n || 10).map(x => x.p);

  // ── short commands ──
  let m;
  if ((m = raw.match(/^(طلب|بدهی|مانده|حساب)\s+(.+)$/))) {
    findPeople(m[2], 5).forEach(p => out.answer.push({ kind: 'balance', p, b: bal[p.id] || 0 }));
  } else if ((m = raw.match(/^(فاکتور|فاکتورهای|شماره)\s*(\d+)$/))) {
    S.invoices.filter(i => Core.toEn(i.no) === m[2]).forEach(i => out.invoices.push(i));
  } else if ((m = raw.match(/^(موجودی|انبار)\s+(.+)$/))) {
    findProducts(m[2], 12).forEach(p => out.answer.push({ kind: 'stock', p, stock: stockOf(p.id) }));
  } else if ((m = raw.match(/^(سریال|imei|ایمی|ای ام ای ای)\s*(.+)$/i))) {
    out.serials = Core.serialHistory(S, m[2], 20);
  }
  const per = raw.match(/(امروز|دیروز|این ماه|ماه|هفته|سال|امسال)/);
  if (per && /(فروش|سود|درآمد|گزارش|خلاصه|امروز|دیروز)/.test(raw) && raw.split(/\s+/).length <= 3) {
    const k = { 'امروز': 'today', 'دیروز': 'yesterday', 'این ماه': 'mtd', 'ماه': 'mtd', 'هفته': 'week', 'سال': 'fytd', 'امسال': 'fytd' }[per[1]];
    const rg = Core.periodRange(k, today(), fyMonth()); out.answer.push({ kind: 'report', label: per[1], k, rg, r: Core.report(S, rg.from, rg.to), n: S.invoices.filter(i => i.type === 'sale' && i.date >= rg.from && i.date <= rg.to).length });
  }
  if (out.answer.length || out.invoices.length || out.serials.length) return out;

  // ── numbers: IMEI, phone, invoice number, serial tail, amount ──
  if (onlyNum) {
    if (digits.length >= 4) out.serials = Core.serialHistory(S, digits, 10);
    if (/^(98|0098|0)?9\d{2,9}$/.test(digits) || digits.startsWith('09')) S.people.filter(p => Core.toEn(p.phone || '').replace(/\D/g, '').includes(digits.replace(/^(0098|98)/, '0'))).slice(0, 8).forEach(p => out.people.push(p));
    if (digits.length <= 7) S.invoices.filter(i => Core.toEn(i.no) === digits).forEach(i => out.invoices.push(i));
    if (digits.length >= 4) {
      const amt = Core.parseMoney(digits);
      if (amt) {
        S.invoices.filter(i => Core.invoiceTotals(i).total === amt && !out.invoices.includes(i)).slice(-10).forEach(i => out.invoices.push(i));
        S.tx.filter(t => t.amount === amt && t.type !== 'invoice').slice(-10).forEach(t => out.tx.push(t));
      }
    }
    S.products.filter(p => p.barcode && Core.toEn(p.barcode).includes(digits) || p.sku && Core.toEn(p.sku) === digits).slice(0, 5).forEach(p => out.products.push(p));
    return out;
  }
  // ── words: fuzzy across people, products, categories; serials/notes inside invoices ──
  out.people = findPeople(raw, 8);
  out.products = findProducts(raw, 12);
  const cc = Core.categoryCounts(S); out.cats = cc.filter(c => Core.fuzzyScore(c.cat, words)).slice(0, 6);
  if (/[a-z]/i.test(raw) && /\d/.test(raw) && raw.replace(/\s/g, '').length >= 6) out.serials = Core.serialHistory(S, raw, 10);
  if (raw.length >= 3) S.invoices.filter(i => (i.note && matchQ(i.note, raw)) || i.items.some(l => l.note && matchQ(l.note, raw))).slice(-10).reverse().forEach(i => out.invoices.push(i));
  return out;
}

function serialCard(x) {
  const p = Core.byId(S.products, x.productId);
  return '<div class="card sn"><div class="ch"><span class="ltr snum">' + esc(x.serial) + '</span><span class="bd ' + (x.inStock ? 'ok' : x.state === 'فروخته شده' ? 'mid' : 'no') + '">' + x.state + '</span></div>' +
    '<p class="hint">' + esc(p ? p.name : '—') + (x.profit != null && can('cost') ? ' · سود این دستگاه: <b class="' + (x.profit < 0 ? 'debit' : 'credit') + '">' + fmt(x.profit) + '</b>' : '') + '</p>' + (x.luhn === false ? '<div class="alert warn">این IMEI از نظر رقم کنترلی معتبر نیست؛ ممکن است اشتباه ثبت شده باشد.</div>' : '') +
    '<div class="tl">' + x.events.map(e => '<button class="tli t-' + e.type + '" data-act="go" data-h="#/inv/' + e.invoiceId + '"><i></i><span><b>' + Core.TYPE_FA[e.type] + ' · ' + esc(personName(e.personId)) + '</b><small>' + fmtDate(e.date) + ' · فاکتور ' + fa(e.no) + (e.type === 'purchase' && !can('cost') ? '' : ' · ' + fmt(e.price)) + '</small></span></button>').join('') + '</div></div>';
}
function pageSearch() {
  const q = UI.searchQ || '';
  let h = '<div class="gs"><input class="inp" id="gs-q" type="search" enterkeyhint="search" placeholder="جستجوی همه‌چیز: شخص، کالا، سریال، فاکتور، مبلغ…" value="' + esc(q) + '" autocomplete="off"></div>';
  if (!q.trim()) {
    const rec = recentSearches();
    if (rec.length) h += '<div class="ch">جستجوهای اخیر</div><div class="chips wrap">' + rec.map(r => '<button class="chip" data-act="searchGo" data-q="' + esc(r) + '">' + esc(r) + '</button>').join('') + '</div>';
    h += '<div class="card"><div class="ch">' + ico('search') + 'چه چیزهایی را می‌شود جستجو کرد؟</div><div class="chips wrap">' + SEARCH_TIPS.map(t => '<button class="chip" data-act="searchGo" data-q="' + esc(t.replace(/ \(.*\)$/, '')) + '">' + esc(t) + '</button>').join('') + '</div><p class="hint">غلط تایپی کوچک، «ی/ي»، عدد فارسی یا انگلیسی و حتی انگلیسی‌نویسی (iphone 13) را می‌فهمد. عدد ۱۵ رقمی = IMEI، شماره با ۰۹ = تلفن، عدد کوتاه = شماره فاکتور، عدد بزرگ = مبلغ.</p></div>';
    return { title: 'جستجو', html: h, back: '#/home', mount: () => autoFocus(() => $('#gs-q')) };
  }
  const r = smartSearch(q); let any = false;
  const sec = (title, body) => { any = true; return '<div class="ch gs-h">' + title + '</div>' + body; };
  if (r.answer.length) h += sec('پاسخ', '<div class="card">' + r.answer.map(a => {
    if (a.kind === 'balance') return '<button class="rr" data-act="go" data-h="#/person/' + a.p.id + '"><span>' + esc(a.p.name) + '</span><b class="' + (a.b > 0 ? 'debit' : a.b < 0 ? 'credit' : 'zero') + '">' + (can('balances') ? fmt(Math.abs(a.b)) + ' ' + (a.b > 0 ? 'طلب شما' : a.b < 0 ? 'بدهی شما' : 'تسویه') : '—') + '</b></button>';
    if (a.kind === 'stock') return '<button class="rr" data-act="prodOpen" data-id="' + a.p.id + '"><span>' + esc(a.p.name) + '</span><b class="' + (a.stock <= 0 ? 'debit' : '') + '">' + Core.fmtQty(a.stock) + ' ' + esc(a.p.unit) + '</b></button>';
    if (a.kind === 'report') return '<div class="rr b"><span>' + esc(a.label) + ' · ' + fa(a.n) + ' فاکتور فروش</span><b>' + fmt(a.r.revenue) + '</b></div>' + (can('reports') && can('cost') ? '<div class="rr"><span>سود خالص</span><b class="' + (a.r.net < 0 ? 'debit' : 'credit') + '">' + fmt(a.r.net) + '</b></div><button class="lnk" data-act="repGo" data-k="' + a.k + '">گزارش کامل</button>' : '');
    return '';
  }).join('') + '</div>');
  if (r.serials.length) h += sec('سریال / IMEI', r.serials.map(serialCard).join(''));
  if (r.people.length) h += sec('اشخاص', '<div class="card flush">' + r.people.map(p => { const b = Core.balanceOf(S, p.id); return '<div class="row gsr"><button class="gsl" data-act="go" data-h="#/person/' + p.id + '"><b>' + esc(p.name) + '</b><small>' + esc(p.phone || '') + (can('balances') && b ? ' · ' + fmt(Math.abs(b)) + (b > 0 ? ' طلب' : ' بدهی') : '') + '</small></button><span class="gsa"><button class="mini" data-act="newInv" data-t="sale" data-p="' + p.id + '">فروش</button>' + (can('money') ? '<button class="mini" data-act="txForm" data-t="receipt" data-p="' + p.id + '">دریافت</button>' : '') + '</span></div>'; }).join('') + '</div>');
  if (r.products.length) h += sec('کالاها', '<div class="card flush">' + r.products.map(p => { const st = Core.replay(S).stock[p.id]; return '<button class="row" data-act="prodOpen" data-id="' + p.id + '"><span><b>' + esc(p.name) + '</b><small>' + esc(Core.catOf(p)) + (p.salePrice ? ' · ' + fmt(p.salePrice) : '') + '</small></span><em class="' + (!st || st.stock <= 0 ? 'debit' : '') + '">' + Core.fmtQty(st ? st.stock : 0) + ' ' + esc(p.unit) + '</em></button>'; }).join('') + '</div>');
  if (r.cats.length) h += sec('دسته‌ها', '<div class="chips wrap">' + r.cats.map(c => '<button class="chip" data-act="catGo" data-c="' + esc(c.cat) + '">' + esc(c.cat) + ' <i>' + fa(c.n) + '</i></button>').join('') + '</div>');
  if (r.invoices.length) h += sec('فاکتورها', '<div class="card flush">' + r.invoices.slice(0, 15).map(i => invRow(i, q)).join('') + '</div>');
  if (r.tx.length) h += sec('دریافت و پرداخت با همین مبلغ', '<div class="card flush">' + r.tx.map(t => '<button class="row" data-act="txOpen" data-id="' + t.id + '"><span><b>' + esc(personName(t.personId)) + '</b><small>' + esc(fa(t.desc || Core.TYPE_FA[t.type] || '')) + ' · ' + fmtDate(t.date) + '</small></span><em>' + fmt(t.amount) + '</em></button>').join('') + '</div>');
  if (!any) h += empty(ico('search'), 'چیزی پیدا نشد. کوتاه‌تر بنویسید یا فقط بخشی از نام را بزنید.');
  return { title: 'جستجو', html: h, back: '#/home', mount: () => { clearTimeout(pageSearch.t); pageSearch.t = setTimeout(() => rememberSearch(q), 1500); } };
}
