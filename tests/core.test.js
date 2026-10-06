const assert = require('assert'); const C = require('../www/core.js');
let n = 0; const t = (name, fn) => { try { fn(); n++; } catch (e) { console.error('FAIL', name, '\n ', e.message); process.exitCode = 1; } };

t('jalali matches independent reference for 70 years', () => {
  const ref = require('./jalali_ref.json'); let bad = 0;
  for (const [iso, jy, jm, jd] of ref) { const p = C.isoToParts(iso); if (p.jy !== jy || p.jm !== jm || p.jd !== jd) { if (bad++ < 3) console.error('  mismatch', iso, p, [jy, jm, jd]); } const back = C.partsToIso(jy, jm, jd); if (back !== iso) { if (bad++ < 3) console.error('  roundtrip', iso, back); } }
  assert.strictEqual(bad, 0);
});
t('known dates', () => { assert.strictEqual(C.isoToJalali('2026-10-05'), '1405/07/13'); assert.strictEqual(C.isoToJalali('2025-03-21'), '1404/01/01'); assert.strictEqual(C.isoToJalali('2025-03-20'), '1403/12/30'); assert.ok(C.isLeapJ(1403)); assert.ok(!C.isLeapJ(1404)); assert.strictEqual(C.weekdayIdx('2026-10-03'), 0 /* Saturday */); });
t('jalaliToIso', () => { assert.strictEqual(C.jalaliToIso('۱۴۰۵/۰۷/۱۳'), '2026-10-05'); assert.strictEqual(C.jalaliToIso('1404-1-1'), '2025-03-21'); assert.strictEqual(C.jalaliToIso('1404/12/30'), null); assert.strictEqual(C.jalaliToIso('1403/12/30'), '2025-03-20'); assert.strictEqual(C.jalaliToIso('1405/07/31'), null); assert.strictEqual(C.jalaliToIso('abc'), null); });
t('periods', () => { const m = C.periodRange('month', '2026-10-05'); assert.deepStrictEqual(m, { from: '2026-10-23'.replace('10-23', '09-23'), to: '2026-10-22' }); const w = C.periodRange('week', '2026-10-05'); assert.strictEqual(w.from, '2026-10-03'); assert.strictEqual(w.to, '2026-10-09'); });
t('numbers', () => { assert.strictEqual(C.parseMoney('۱,۲۳۴,۵۶۷'), 1234567); assert.ok(isNaN(C.parseMoney('abc'))); assert.ok(isNaN(C.parseMoney('-5'))); assert.ok(isNaN(C.parseMoney('1e30'))); assert.strictEqual(C.parseQty('۲٫۵'), 2.5); assert.ok(isNaN(C.parseQty('0'))); assert.strictEqual(C.fmt(1234567), '۱,۲۳۴,۵۶۷'); assert.strictEqual(C.fmtQty(1234.5), '۱,۲۳۴.۵'); });

function world() { const s = C.emptyState(); const a = C.addPerson(s, { name: 'علی' }).person, b = C.addPerson(s, { name: 'رضا' }).person; const p = C.addProduct(s, { name: 'گوشی' }).product; return { s, a, b, p }; }
const D = '2026-10-01';

t('weighted average + sale cogs + profit', () => {
  const { s, a, b, p } = world();
  assert.ok(C.addInvoice(s, { type: 'purchase', personId: b.id, date: D, items: [{ productId: p.id, qty: 10, price: 100 }] }).ok);   // 10 @100
  assert.ok(C.addInvoice(s, { type: 'purchase', personId: b.id, date: '2026-10-02', items: [{ productId: p.id, qty: 10, price: 200 }] }).ok); // avg 150
  const r = C.addInvoice(s, { type: 'sale', personId: a.id, date: '2026-10-03', items: [{ productId: p.id, qty: 4, price: 300 }], discount: 100, paid: 500, method: 'cash' });
  assert.ok(r.ok, r.error);
  const rp = C.replay(s); assert.strictEqual(rp.stock[p.id].stock, 16); assert.strictEqual(Math.round(rp.stock[p.id].avg), 150);
  assert.strictEqual(rp.cogs[r.invoice.id], 600);
  const rep = C.report(s); assert.strictEqual(rep.sales, 1100); assert.strictEqual(rep.cogs, 600); assert.strictEqual(rep.gross, 500); assert.strictEqual(rep.net, 500);
  assert.strictEqual(C.balanceOf(s, a.id), 600);          // 1100 - 500 paid
  assert.strictEqual(C.balanceOf(s, b.id), -3000);        // we owe supplier 1000+2000
  assert.strictEqual(C.cashBalance(s), 500);
  assert.strictEqual(C.inventoryValue(s), 2400);
  assert.deepStrictEqual(C.audit(s), []);
});
t('oversell blocked incl. same product on two lines, state untouched', () => {
  const { s, a, b, p } = world(); C.addInvoice(s, { type: 'purchase', personId: b.id, date: D, items: [{ productId: p.id, qty: 10, price: 100 }] });
  const before = JSON.stringify(s);
  const r = C.addInvoice(s, { type: 'sale', personId: a.id, date: D, items: [{ productId: p.id, qty: 8, price: 5 }, { productId: p.id, qty: 8, price: 5 }] });
  assert.ok(!r.ok); assert.ok(/کافی نیست/.test(r.error)); assert.strictEqual(JSON.stringify(s), before);
});
t('back-dated sale before purchase is rejected', () => {
  const { s, a, b, p } = world(); C.addInvoice(s, { type: 'purchase', personId: b.id, date: '2026-10-05', items: [{ productId: p.id, qty: 10, price: 100 }] });
  assert.ok(!C.addInvoice(s, { type: 'sale', personId: a.id, date: '2026-10-01', items: [{ productId: p.id, qty: 1, price: 5 }] }).ok);
});
t('delete purchase that would make stock negative is blocked; delete sale ok', () => {
  const { s, a, b, p } = world(); const pu = C.addInvoice(s, { type: 'purchase', personId: b.id, date: D, items: [{ productId: p.id, qty: 5, price: 100 }] }).invoice;
  const sa = C.addInvoice(s, { type: 'sale', personId: a.id, date: D, items: [{ productId: p.id, qty: 5, price: 150 }], paid: 100 }).invoice;
  const x = C.deleteInvoice(s, pu.id); assert.ok(!x.ok); assert.ok(C.byId(s.invoices, pu.id));
  assert.ok(C.deleteInvoice(s, sa.id).ok); assert.strictEqual(C.balanceOf(s, a.id), 0); assert.strictEqual(s.tx.filter(t => t.ref === sa.id).length, 0);
  assert.ok(C.deleteInvoice(s, pu.id).ok); assert.deepStrictEqual(C.audit(s), []);
});
t('returns: sale return restores stock & reverses cogs; purchase return', () => {
  const { s, a, b, p } = world(); C.addInvoice(s, { type: 'purchase', personId: b.id, date: D, items: [{ productId: p.id, qty: 10, price: 100 }] });
  C.addInvoice(s, { type: 'sale', personId: a.id, date: '2026-10-02', items: [{ productId: p.id, qty: 5, price: 200 }] });
  C.addInvoice(s, { type: 'sale_return', personId: a.id, date: '2026-10-03', items: [{ productId: p.id, qty: 2, price: 200 }] });
  assert.strictEqual(C.replay(s).stock[p.id].stock, 7); assert.strictEqual(C.balanceOf(s, a.id), 600);
  let rep = C.report(s); assert.strictEqual(rep.revenue, 600); assert.strictEqual(rep.cogs, 300); assert.strictEqual(rep.gross, 300);
  const pr = C.addInvoice(s, { type: 'purchase_return', personId: b.id, date: '2026-10-04', items: [{ productId: p.id, qty: 3, price: 100 }], paid: 100, method: 'bank' });
  assert.ok(pr.ok, pr.error); assert.strictEqual(C.replay(s).stock[p.id].stock, 4);
  assert.strictEqual(C.balanceOf(s, b.id), -800);   // -1000 credit, +300 return debit, -100 refund received
  rep = C.report(s); assert.strictEqual(rep.cogs, 300 + (300 - 300)); // purchase return at cost => no P&L effect
  assert.deepStrictEqual(C.audit(s), []);
});
t('purchase return above/below cost hits P&L', () => {
  const { s, b, p } = world(); C.addInvoice(s, { type: 'purchase', personId: b.id, date: D, items: [{ productId: p.id, qty: 10, price: 100 }] });
  C.addInvoice(s, { type: 'purchase_return', personId: b.id, date: D, items: [{ productId: p.id, qty: 2, price: 80 }] }); // refund 160 vs cost 200 => 40 loss
  assert.strictEqual(C.report(s).cogs, 40); assert.strictEqual(C.report(s).net, -40);
});
t('discount allocation sums exactly, no negative lines', () => {
  const inv = { items: [{ productId: 1, qty: 3, price: 333 }, { productId: 2, qty: 1, price: 1 }, { productId: 3, qty: 7, price: 17 }], discount: 77 };
  const t2 = C.invoiceTotals(inv); assert.strictEqual(t2.lines.reduce((a, l) => a + l.net, 0), t2.total); assert.strictEqual(t2.total, 999 + 1 + 119 - 77); t2.lines.forEach(l => assert.ok(l.net >= 0));
});
t('validation', () => {
  const { s, a, b, p } = world(); const base = { type: 'purchase', personId: b.id, date: D, items: [{ productId: p.id, qty: 1, price: 10 }] };
  assert.ok(!C.addInvoice(s, Object.assign({}, base, { date: '2026-13-01' })).ok);
  assert.ok(!C.addInvoice(s, Object.assign({}, base, { items: [] })).ok);
  assert.ok(!C.addInvoice(s, Object.assign({}, base, { items: [{ productId: 999, qty: 1, price: 1 }] })).ok);
  assert.ok(!C.addInvoice(s, Object.assign({}, base, { items: [{ productId: p.id, qty: 0, price: 1 }] })).ok);
  assert.ok(!C.addInvoice(s, Object.assign({}, base, { paid: 11 })).ok);
  assert.ok(!C.addInvoice(s, Object.assign({}, base, { discount: 11 })).ok);
  assert.ok(!C.addInvoice(s, Object.assign({}, base, { personId: 999 })).ok);
  assert.ok(C.addInvoice(s, Object.assign({}, base, { no: '7' })).ok); assert.ok(!C.addInvoice(s, Object.assign({}, base, { no: '7' })).ok);
  assert.ok(!C.addTx(s, { personId: a.id, kind: 'debit', amount: 0, date: D }).ok); assert.ok(!C.addTx(s, { personId: a.id, kind: 'debit', amount: 1.5, date: D }).ok); assert.ok(!C.addTx(s, { personId: a.id, kind: 'x', amount: 5, date: D }).ok);
  assert.ok(!C.addPerson(s, { name: '  ' }).ok); assert.ok(!C.addPerson(s, { name: 'علی' }).ok);
  assert.strictEqual(s.tx.filter(t => t.personId === a.id).length, 0); assert.deepStrictEqual(C.audit(s), []);
});
t('ledger running balance, opening, receipts/payments, period carry', () => {
  const s = C.emptyState(); const a = C.addPerson(s, { name: 'الف', opening: 1000, date: '2026-09-01' }).person;
  C.addTx(s, { personId: a.id, type: 'manual', kind: 'debit', amount: 500, date: '2026-09-10', desc: 'x' });
  C.addTx(s, { personId: a.id, type: 'receipt', amount: 300, date: '2026-09-20', method: 'bank' });
  C.addTx(s, { personId: a.id, type: 'payment', amount: 50, date: '2026-10-01', method: 'cash' });
  const L = C.ledger(s, a.id); assert.deepStrictEqual(L.rows.map(r => r.balance), [1000, 1500, 1200, 1250]); assert.strictEqual(L.closing, 1250);
  const L2 = C.ledger(s, a.id, '2026-09-15'); assert.strictEqual(L2.carry, 1500); assert.deepStrictEqual(L2.rows.map(r => r.balance), [1200, 1250]);
  const cs = C.cashSummary(s); assert.strictEqual(cs.byMethod.bank, 300); assert.strictEqual(cs.byMethod.cash, -50); assert.strictEqual(cs.net, 250);
  const rp = C.receivablePayable(s); assert.strictEqual(rp.receivable, 1250);
});
t('transfer pair and deletion', () => {
  const { s, a, b } = world(); assert.ok(C.addTransfer(s, { fromId: a.id, toId: b.id, amount: 700, date: D, desc: 'بابت کرایه' }).ok);
  assert.strictEqual(C.balanceOf(s, a.id), -700); assert.strictEqual(C.balanceOf(s, b.id), 700);
  assert.ok(!C.addTransfer(s, { fromId: a.id, toId: a.id, amount: 1, date: D }).ok);
  const id = s.tx[0].id; assert.ok(C.deleteTx(s, id).ok); assert.strictEqual(s.tx.length, 0);
});
t('invoice-linked ledger rows protected; receipt deletable', () => {
  const { s, a, b, p } = world(); C.addInvoice(s, { type: 'purchase', personId: b.id, date: D, items: [{ productId: p.id, qty: 1, price: 50 }], paid: 20 });
  const main = s.tx.find(t => t.type === 'invoice'); assert.ok(!C.deleteTx(s, main.id).ok); assert.ok(!C.editTx(s, main.id, { amount: 1, date: D }).ok);
  const pay = s.tx.find(t => t.type === 'payment'); assert.ok(C.editTx(s, pay.id, { amount: 25, date: D, desc: 'x', method: 'cheque' }).ok); assert.strictEqual(C.balanceOf(s, b.id), -25);
  assert.strictEqual(C.invoiceInfo(s, s.invoices[0]).paid, 25);
});
t('person delete/archive rules', () => {
  const { s, a } = world(); C.addTx(s, { personId: a.id, kind: 'debit', amount: 5, date: D });
  assert.ok(!C.deletePerson(s, a.id).ok); assert.ok(C.setArchived(s, a.id, true).ok);
  const c = C.addPerson(s, { name: 'تازه' }).person; assert.ok(C.deletePerson(s, c.id).ok);
});
t('inventory adjustments', () => {
  const { s, b, p } = world(); C.addInvoice(s, { type: 'purchase', personId: b.id, date: D, items: [{ productId: p.id, qty: 10, price: 100 }] });
  assert.ok(!C.addAdjust(s, { productId: p.id, qty: -11, date: D }).ok);
  const loss = C.addAdjust(s, { productId: p.id, qty: -2, date: '2026-10-02', note: 'شکسته' }).adjust; assert.strictEqual(C.report(s).adjLoss, 200); assert.strictEqual(C.replay(s).stock[p.id].stock, 8);
  assert.ok(C.addAdjust(s, { productId: p.id, qty: 5, cost: 160, date: '2026-10-03' }).ok); const st = C.replay(s).stock[p.id]; assert.strictEqual(st.stock, 13); assert.strictEqual(Math.round(st.avg), Math.round((8 * 100 + 5 * 160) / 13));
  assert.ok(!C.deleteProduct(s, p.id).ok);
});
t('cheques & installments', () => {
  const { s, a } = world(); const c = C.addCheque(s, { kind: 'cheque', direction: 'receive', personId: a.id, title: 'چک ۱۲۳', amount: 900, dueDate: '2026-10-10' }).cheque;
  assert.strictEqual(C.chequeStatus(c, '2026-10-05'), 'soon'); assert.strictEqual(C.chequeStatus(c, '2026-10-11'), 'overdue'); assert.strictEqual(C.chequeStatus(c, '2026-09-01'), 'later');
  assert.ok(C.completeCheque(s, c.id, true, '2026-10-10').ok); assert.strictEqual(C.balanceOf(s, a.id), -900); assert.strictEqual(C.cashSummary(s).byMethod.cheque, 900);
  assert.ok(!C.completeCheque(s, c.id, true).ok); assert.ok(C.reopenCheque(s, c.id).ok); assert.strictEqual(C.balanceOf(s, a.id), 0);
});
t('expenses & net profit & cash', () => {
  const { s, a, b, p } = world(); s.settings.openingCash = 1000; C.addInvoice(s, { type: 'purchase', personId: b.id, date: D, items: [{ productId: p.id, qty: 10, price: 100 }], paid: 1000 });
  C.addInvoice(s, { type: 'sale', personId: a.id, date: D, items: [{ productId: p.id, qty: 10, price: 150 }], paid: 1500 });
  C.addExpense(s, { title: 'اجاره', amount: 200, date: D }); const r = C.report(s, D, D);
  assert.strictEqual(r.net, 1500 - 1000 - 200); assert.strictEqual(C.cashBalance(s), 1000 - 1000 + 1500 - 200);
  assert.strictEqual(C.report(s, '2026-11-01', '2026-11-30').net, 0);
  assert.strictEqual(C.topPeople(s, 'sale', null, null)[0].total, 1500); assert.strictEqual(C.topProducts(s, null, null)[0].qty, 10);
});
t('backup roundtrip & corrupt files', () => {
  const { s, a, b, p } = world(); C.addInvoice(s, { type: 'purchase', personId: b.id, date: D, items: [{ productId: p.id, qty: 3, price: 7 }], paid: 5 });
  const r = C.parseBackup(C.exportJSON(s)); assert.ok(r.ok, r.error); assert.deepStrictEqual(r.state, JSON.parse(JSON.stringify(s)));
  assert.ok(!C.parseBackup('{bad').ok); assert.ok(!C.parseBackup('{"app":"other"}').ok);
  const o = JSON.parse(C.exportJSON(s)); o.data.tx[0].personId = 9999; assert.ok(!C.parseBackup(JSON.stringify(o)).ok);
  const o2 = JSON.parse(C.exportJSON(s)); o2.data.seq = 1; assert.ok(C.parseBackup(JSON.stringify(o2)).ok); // seq repaired
});
t('csv & statement text', () => { assert.strictEqual(C.csv([['a,b', 'c"d'], [1, null]]), '"a,b","c""d"\r\n1,'); const { s, a } = world(); C.addTx(s, { personId: a.id, kind: 'debit', amount: 5, date: D, desc: 'x' }); assert.ok(/مانده نهایی: ۵/.test(C.statementText(s, a.id))); });

// randomized invariants: any sequence of ops keeps audit clean and ledger == sum of invoices/payments
t('fuzz invariants', () => {
  let seed = 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const s = C.emptyState(); const ppl = [1, 2, 3].map(i => C.addPerson(s, { name: 'p' + i }).person); const prods = [1, 2].map(i => C.addProduct(s, { name: 'k' + i }).product);
  const types = ['purchase', 'sale', 'sale_return', 'purchase_return']; let okc = 0;
  for (let i = 0; i < 400; i++) {
    const r = rnd();
    if (r < 0.6) { const items = [...Array(1 + Math.floor(rnd() * 3))].map(() => ({ productId: prods[Math.floor(rnd() * 2)].id, qty: Math.ceil(rnd() * 5), price: Math.floor(rnd() * 500) })); const res = C.addInvoice(s, { type: types[Math.floor(rnd() * 4)], personId: ppl[Math.floor(rnd() * 3)].id, date: C.addDays('2026-09-01', Math.floor(rnd() * 40)), items, discount: Math.floor(rnd() * 50), paid: Math.floor(rnd() * 20) }); if (res.ok) okc++; }
    else if (r < 0.75 && s.invoices.length) C.deleteInvoice(s, s.invoices[Math.floor(rnd() * s.invoices.length)].id);
    else if (r < 0.9) C.addTx(s, { personId: ppl[Math.floor(rnd() * 3)].id, type: ['manual', 'receipt', 'payment'][Math.floor(rnd() * 3)], kind: 'debit', amount: 1 + Math.floor(rnd() * 300), date: '2026-09-15' });
    else C.addAdjust(s, { productId: prods[Math.floor(rnd() * 2)].id, qty: Math.floor(rnd() * 11) - 5 || 1, date: C.addDays('2026-09-01', Math.floor(rnd() * 40)) });
    const a = C.audit(s); if (a.length) throw new Error('audit failed at step ' + i + ': ' + a[0]);
  }
  assert.ok(okc > 50);
  const rp = C.replay(s); for (const id in rp.stock) assert.ok(rp.stock[id].stock >= 0);
  // sum of balances == total debits - total credits
  const tot = s.tx.reduce((a, t) => a + (t.kind === 'debit' ? t.amount : -t.amount), 0); assert.strictEqual(Object.values(C.balances(s)).reduce((a, b) => a + b, 0), tot);
});
console.log(n + ' tests passed');
