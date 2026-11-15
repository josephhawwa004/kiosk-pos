const SECRET = 'kiosk-2026';
const TZ = 'Asia/Amman';

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    if (SECRET && data.key !== SECRET) return out({ ok: false, error: 'wrong secret' });
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const lock = LockService.getScriptLock(); lock.waitLock(25000);
    try {
      writeSales(ss, data.sales || []);
      writeStock(ss, data.stock || []);
      writeDaily(ss);
      writeSummary(ss);
      tidy(ss);
    } finally { lock.releaseLock(); }
    const home = ss.getSheetByName('الملخص العام');
    return out({ ok: true, n: (data.sales || []).length, url: ss.getUrl() + (home ? '#gid=' + home.getSheetId() : '') });
  } catch (err) { return out({ ok: false, error: String(err) }); }
}
function doGet() { return out({ ok: true, ping: true }); }
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

const HEAD = ['رقم العملية', 'التاريخ', 'الوقت', 'رقم الطلب', 'الصنف', 'الكمية', 'سعر الحبة', 'المجموع', 'النوع', 'طريقة الدفع', 'تكلفة الحبة', 'التكلفة', 'الربح', 'الحالة'];
const PAY = { cash: 'كاش', visa: 'فيزا', cliq: 'كليك' };
const C = { ink: '#17181C', acc: '#C2410C', soft: '#F4F3F0', totBg: '#FFF1E8', totInk: '#8A2E07', line: '#B9B5AC' };

function getSheet(ss, name) { let sh = ss.getSheetByName(name); if (!sh) sh = ss.insertSheet(name); sh.setRightToLeft(true); return sh; }

/* ---------- data ---------- */
function writeSales(ss, sales) {
  const sh = getSheet(ss, 'المبيعات التفصيلية');
  if (sh.getLastRow() === 0) sh.appendRow(HEAD);
  if (!sales.length) return;
  const ids = {}; sales.forEach((s) => { ids[s.id] = true; });
  const last = sh.getLastRow();
  if (last > 1) { const col = sh.getRange(2, 1, last - 1, 1).getValues(); for (let i = col.length - 1; i >= 0; i--) if (ids[col[i][0]]) sh.deleteRow(i + 2); }
  const rows = [];
  sales.forEach((s) => {
    const time = Utilities.formatDate(new Date(s.ts), TZ, 'HH:mm'), h = s.type === 'hosp';
    s.lines.forEach((l) => {
      const tot = l.price * l.qty / 1000, c = (l.cost || 0) * l.qty / 1000;
      rows.push([s.id, s.day, time, s.no, l.nameAr || l.name, l.qty, l.price / 1000, h ? -tot : tot, h ? 'ضيافة' : 'بيع', h ? '' : PAY[s.pay] || '', l.cost == null ? '' : l.cost / 1000, c, h ? -c : tot - c, s.voided ? 'ملغي' : '']);
    });
  });
  if (rows.length) sh.getRange(sh.getLastRow() + 1, 1, rows.length, HEAD.length).setValues(rows);
}
function detailRows(ss) {
  const sh = ss.getSheetByName('المبيعات التفصيلية'); if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, HEAD.length).getValues().filter((r) => r[13] !== 'ملغي').map((r) => {
    r[1] = r[1] instanceof Date ? Utilities.formatDate(r[1], TZ, 'yyyy-MM-dd') : String(r[1]); return r;
  });
}
function writeStock(ss, stock) {
  if (!stock.length) return;
  const sh = getSheet(ss, 'المخزون'); sh.clear();
  const now = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm');
  const rows = [['الصنف', 'المخزون (حبة)', 'حبات بالصندوق', 'الحالة', 'آخر تحديث']];
  stock.forEach((s) => rows.push([s.name, s.stock, s.units, s.on, now]));
  sh.getRange(1, 1, rows.length, 5).setValues(rows);
}
function writeDaily(ss) {
  const days = {}, orders = {};
  detailRows(ss).forEach((r) => {
    const o = days[r[1]] || (days[r[1]] = { orders: 0, sales: 0, cash: 0, visa: 0, cliq: 0, cost: 0, hosp: 0 });
    if (r[8] === 'ضيافة') { o.hosp += Number(r[11]) || 0; return; }
    if (!orders[r[0]]) { orders[r[0]] = 1; o.orders++; }
    const v = Number(r[7]) || 0; o.sales += v; o.cost += Number(r[11]) || 0;
    if (r[9] === 'كاش') o.cash += v; if (r[9] === 'فيزا') o.visa += v; if (r[9] === 'كليك') o.cliq += v;
  });
  const sh = getSheet(ss, 'الملخص اليومي'); sh.clear();
  const rows = [['اليوم', 'الطلبات', 'المبيعات', 'كاش', 'فيزا', 'كليك', 'التكلفة', 'الضيافة (تكلفة)', 'صافي الربح']];
  const tot = ['المجموع', 0, 0, 0, 0, 0, 0, 0, 0];
  Object.keys(days).sort().reverse().forEach((d) => {
    const o = days[d], row = [d, o.orders, o.sales, o.cash, o.visa, o.cliq, o.cost, -o.hosp, o.sales - o.cost - o.hosp];
    rows.push(row); for (let i = 1; i < 9; i++) tot[i] += row[i];
  });
  if (rows.length > 1) rows.push(tot);
  sh.getRange(1, 1, rows.length, 9).setValues(rows);
}
function writeSummary(ss) {
  const today = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  const rs = detailRows(ss).filter((r) => r[1] === today);
  let rev = 0, cost = 0, hs = 0, hc = 0; const pay = { 'كاش': 0, 'فيزا': 0, 'كليك': 0 }, orders = {}, items = {};
  rs.forEach((r) => {
    if (r[8] === 'ضيافة') { hs += -(Number(r[7]) || 0); hc += Number(r[11]) || 0; return; }
    orders[r[0]] = 1; rev += Number(r[7]) || 0; cost += Number(r[11]) || 0; pay[r[9]] = (pay[r[9]] || 0) + (Number(r[7]) || 0);
    const it = items[r[4]] || (items[r[4]] = { q: 0, rev: 0, p: 0 }); it.q += Number(r[5]) || 0; it.rev += Number(r[7]) || 0; it.p += Number(r[12]) || 0;
  });
  const sh = getSheet(ss, 'الملخص العام'); sh.clear(); sh.clearFormats();
  sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).breakApart();
  let r = 1;
  const title = (text, bg, fg, size, w) => { const g = sh.getRange(r, 1, 1, w); g.merge().setValue(text).setBackground(bg).setFontColor(fg).setFontSize(size).setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle'); sh.setRowHeight(r, 44); r++; };
  const table = (name, head, rows, money, total, intRows) => {
    const w = head.length;
    title(name, C.ink, '#FFFFFF', 18, w);
    const all = [head].concat(rows.length ? rows : [[ 'لا يوجد بيانات' ].concat(Array(w - 1).fill(''))]).concat(total ? [total] : []);
    const g = sh.getRange(r, 1, all.length, w); g.setValues(all);
    styleBlock(g, money, !!total, intRows);
    r += all.length + 1;
  };
  title('الملخص العام · ' + today, C.acc, '#FFFFFF', 22, 4); r++;
  table('الأرقام الرئيسية', ['البند', 'القيمة (د.أ)'],
    [['عدد الطلبات', Object.keys(orders).length], ['إجمالي المبيعات', rev], ['تكلفة اللي انباع', cost], ['الضيافة بسعر البيع', -hs], ['الضيافة بالتكلفة', -hc]],
    [2], ['صافي الربح', rev - cost - hc], [0]);
  table('حسب طريقة الدفع', ['طريقة الدفع', 'المبلغ (د.أ)', 'النسبة'],
    ['كاش', 'فيزا', 'كليك'].map((p) => [p, pay[p] || 0, rev ? (pay[p] || 0) / rev : 0]), [2], ['المجموع', rev, rev ? 1 : 0]);
  sh.getRange(r - 5, 3, 4, 1).setNumberFormat('0%');
  const top = Object.keys(items).map((k) => [k, items[k].q, items[k].rev, items[k].p]).sort((a, b) => b[1] - a[1]).slice(0, 10);
  table('الأكثر مبيعاً اليوم', ['الصنف', 'الكمية', 'الإيراد (د.أ)', 'الربح (د.أ)'], top, [3, 4], null);
  sh.setColumnWidth(1, 300); sh.setColumnWidths(2, 3, 190);
  ss.setActiveSheet(sh); ss.moveActiveSheet(1);
}

/* ---------- look: tables, 18pt bold, borders, dark headings ---------- */
function styleBlock(g, moneyCols, hasTotal, intRows) {
  const rows = g.getNumRows(), cols = g.getNumColumns(), sh = g.getSheet(), r0 = g.getRow(), c0 = g.getColumn();
  g.setFontFamily('Arial').setFontSize(18).setFontWeight('bold').setFontColor(C.ink)
    .setHorizontalAlignment('center').setVerticalAlignment('middle').setWrap(true)
    .setBorder(true, true, true, true, true, true, C.line, SpreadsheetApp.BorderStyle.SOLID);
  sh.getRange(r0, c0, 1, cols).setBackground(C.ink).setFontColor('#FFFFFF');
  const bgs = [];
  for (let i = 1; i < rows; i++) bgs.push(Array(cols).fill(i % 2 ? '#FFFFFF' : C.soft));
  if (rows > 1) sh.getRange(r0 + 1, c0, rows - 1, cols).setBackgrounds(bgs);
  if (hasTotal) sh.getRange(r0 + rows - 1, c0, 1, cols).setBackground(C.totBg).setFontColor(C.totInk);
  (moneyCols || []).forEach((c) => { if (rows > 1) sh.getRange(r0 + 1, c0 + c - 1, rows - 1, 1).setNumberFormat('0.000'); });
  (intRows || []).forEach((i) => moneyCols.forEach((c) => sh.getRange(r0 + 1 + i, c0 + c - 1).setNumberFormat('0')));
  for (let i = 0; i < rows; i++) sh.setRowHeight(r0 + i, i === 0 ? 40 : 36);
}
function styleSheet(sh, cols, moneyCols, widths, hasTotal) {
  const n = sh.getLastRow(); if (n < 1) return;
  sh.setFrozenRows(1);
  styleBlock(sh.getRange(1, 1, n, cols), moneyCols, hasTotal);
  widths.forEach((w, i) => sh.setColumnWidth(i + 1, w));
}
function tidy(ss) {
  const d = ss.getSheetByName('المبيعات التفصيلية');
  if (d) { styleSheet(d, HEAD.length, [7, 8, 11, 12, 13], [10, 150, 90, 110, 300, 90, 130, 130, 100, 130, 130, 130, 130, 100]); d.hideColumns(1); d.getRange(2, 2, Math.max(1, d.getLastRow() - 1), 1).setNumberFormat('yyyy-mm-dd'); }
  const s = ss.getSheetByName('المخزون'); if (s) styleSheet(s, 5, [], [300, 170, 170, 110, 200]);
  const y = ss.getSheetByName('الملخص اليومي'); if (y && y.getLastRow() > 1) styleSheet(y, 9, [3, 4, 5, 6, 7, 8, 9], [150, 110, 140, 130, 130, 130, 140, 170, 150], true);
  const def = ss.getSheetByName('Sheet1') || ss.getSheetByName('الورقة1');
  if (def && ss.getSheets().length > 1 && def.getLastRow() === 0) ss.deleteSheet(def);
}

/* run once by hand from the editor to re-format sheets that already exist */
function formatNow() { const ss = SpreadsheetApp.getActiveSpreadsheet(); writeDaily(ss); writeSummary(ss); tidy(ss); }
