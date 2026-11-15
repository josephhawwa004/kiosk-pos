/**
 * Cafeteria POS -> Google Sheet
 * 1) Create a new Google Sheet. 2) Extensions > Apps Script, paste this file, save.
 * 3) Change SECRET below to any word, and put the same word in the app (Settings > Sheet secret).
 * 4) Deploy > New deployment > Web app: Execute as "Me", Who has access "Anyone". Copy the /exec link into the app.
 */
const SECRET = 'change-me';

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    if (SECRET && data.key !== SECRET) return out({ ok: false, error: 'wrong secret' });
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      writeSales(ss, data.sales || []);
      writeStock(ss, data.stock || []);
      writeDaily(ss);
    } finally { lock.releaseLock(); }
    return out({ ok: true, n: (data.sales || []).length });
  } catch (err) {
    return out({ ok: false, error: String(err) });
  }
}
function doGet() { return out({ ok: true, ping: true }); }
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

const HEAD = ['رقم العملية', 'التاريخ', 'الوقت', 'رقم الطلب', 'الصنف', 'الكمية', 'سعر الحبة', 'المجموع', 'النوع', 'طريقة الدفع', 'تكلفة الحبة', 'التكلفة', 'الربح', 'الحالة'];
const PAY = { cash: 'كاش', visa: 'فيزا', cliq: 'كليك' };

function sheet(ss, name, head) {
  let sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.setRightToLeft(true); if (head) { sh.appendRow(head); sh.setFrozenRows(1); sh.getRange(1, 1, 1, head.length).setFontWeight('bold'); } }
  return sh;
}

function writeSales(ss, sales) {
  if (!sales.length) return;
  const sh = sheet(ss, 'المبيعات التفصيلية', HEAD);
  const ids = {};
  sales.forEach((s) => { ids[s.id] = true; });
  // remove old rows of the same orders (an order can come again when it is voided)
  const last = sh.getLastRow();
  if (last > 1) {
    const col = sh.getRange(2, 1, last - 1, 1).getValues();
    for (let i = col.length - 1; i >= 0; i--) if (ids[col[i][0]]) sh.deleteRow(i + 2);
  }
  const rows = [];
  sales.forEach((s) => {
    const d = new Date(s.ts), time = Utilities.formatDate(d, 'Asia/Amman', 'HH:mm');
    const h = s.type === 'hosp';
    s.lines.forEach((l) => {
      const tot = l.price * l.qty / 1000, c = (l.cost || 0) * l.qty / 1000;
      rows.push([s.id, s.day, time, s.no, l.nameAr || l.name, l.qty, l.price / 1000, h ? -tot : tot, h ? 'ضيافة' : 'بيع', h ? '' : PAY[s.pay] || '', l.cost == null ? '' : l.cost / 1000, c, h ? -c : tot - c, s.voided ? 'ملغي' : '']);
    });
  });
  if (rows.length) sh.getRange(sh.getLastRow() + 1, 1, rows.length, HEAD.length).setValues(rows);
}

function writeStock(ss, stock) {
  if (!stock.length) return;
  const sh = sheet(ss, 'المخزون', null);
  sh.clear();
  const rows = [['الصنف', 'المخزون (حبة)', 'حبات بالصندوق', 'الحالة', 'آخر تحديث']];
  const now = Utilities.formatDate(new Date(), 'Asia/Amman', 'yyyy-MM-dd HH:mm');
  stock.forEach((s) => rows.push([s.name, s.stock, s.units, s.on, now]));
  sh.getRange(1, 1, rows.length, 5).setValues(rows);
  sh.getRange(1, 1, 1, 5).setFontWeight('bold'); sh.setFrozenRows(1);
}

function writeDaily(ss) {
  const src = ss.getSheetByName('المبيعات التفصيلية'); if (!src || src.getLastRow() < 2) return;
  const v = src.getRange(2, 1, src.getLastRow() - 1, HEAD.length).getValues();
  const days = {};
  const orders = {};
  v.forEach((r) => {
    if (r[13] === 'ملغي') return;
    const day = r[1] instanceof Date ? Utilities.formatDate(r[1], 'Asia/Amman', 'yyyy-MM-dd') : String(r[1]);
    const o = days[day] || (days[day] = { orders: 0, sales: 0, cash: 0, visa: 0, cliq: 0, cost: 0, hosp: 0 });
    if (r[8] === 'ضيافة') { o.hosp += Number(r[11]) || 0; return; }
    if (!orders[r[0]]) { orders[r[0]] = 1; o.orders++; }
    o.sales += Number(r[7]) || 0; o.cost += Number(r[11]) || 0;
    if (r[9] === 'كاش') o.cash += Number(r[7]) || 0; if (r[9] === 'فيزا') o.visa += Number(r[7]) || 0; if (r[9] === 'كليك') o.cliq += Number(r[7]) || 0;
  });
  const sh = sheet(ss, 'الملخص اليومي', null);
  sh.clear();
  const rows = [['اليوم', 'الطلبات', 'المبيعات', 'كاش', 'فيزا', 'كليك', 'التكلفة', 'الضيافة (تكلفة)', 'صافي الربح']];
  Object.keys(days).sort().forEach((d) => { const o = days[d]; rows.push([d, o.orders, o.sales, o.cash, o.visa, o.cliq, o.cost, -o.hosp, o.sales - o.cost - o.hosp]); });
  sh.getRange(1, 1, rows.length, 9).setValues(rows);
  sh.getRange(1, 1, 1, 9).setFontWeight('bold'); sh.setFrozenRows(1);
}
