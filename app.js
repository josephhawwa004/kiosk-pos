/* Cafeteria POS — works fully offline. Data lives in IndexedDB on this device. */
'use strict';

/* ---------- utils ---------- */
const $ = (s, r = document) => r.querySelector(s);
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const toFils = (jd) => { const n = parseFloat(String(jd).replace(',', '.')); return isNaN(n) || n < 0 ? null : Math.round(n * 1000); };
const jd = (fils) => (fils == null || isNaN(fils) ? '—' : (Math.round(fils) / 1000).toFixed(3));
const pad = (n) => String(n).padStart(2, '0');
const dayOf = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const timeOf = (ts) => { const d = new Date(ts); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
async function sha(s) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('pos:' + s)); return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join(''); }
const ICON = {
  cup: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z"/><path d="M17 9h1.5a2.5 2.5 0 0 1 0 5H17"/><path d="M9 3v2M12 3v2"/></svg>',
  lock: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
  search: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5F6168" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
  x: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  check: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  sync: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/></svg>',
  cart: '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#8F8B82" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6"/><circle cx="10" cy="20" r="1.2"/><circle cx="17" cy="20" r="1.2"/></svg>',
  moon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>',
  sun: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  back: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
};

/* ---------- language ---------- */
const T = {
  ar: {
    brand: 'MEU Kiosk', pos: 'نقطة البيع', offline: 'بدون إنترنت · كل شي محفوظ', online: 'متصل · كل شي محفوظ',
    sheetOk: 'الشيت محدّث', sheetPending: (n) => `${n} عملية بانتظار رفع الشيت`, sheetOff: 'الشيت مش مربوط',
    all: 'الكل', items: (n) => `${n} صنف`, search: 'ابحث عن صنف...', results: 'نتائج البحث', noResults: 'ما في أصناف',
    flavors: (n) => `${n} نكهات`, unavailable: 'غير متوفر', noPrice: 'بدون سعر', from: 'من', jd: 'د.أ',
    order: 'الطلب الحالي', clear: 'مسح الكل', emptyCart: 'السلة فاضية', emptyHint: 'اكبس على أي صنف لتضيفه',
    total: 'المجموع', cash: 'كاش', visa: 'فيزا', cliq: 'كليك', received: 'المبلغ المستلم من الزبون', exact: 'بالضبط',
    change: 'الباقي للزبون', short: 'المبلغ ناقص', hosp: 'ضيافة', checkout: 'إتمام البيع', pickFlavor: 'اختار النكهة', soldOut: 'خلصت',
    sold: (t, p) => `تم البيع · ${t} د.أ · ${p}`, hospDone: (t) => `تمت الضيافة · ${t} د.أ`, lessThan: 'المبلغ المستلم أقل من المجموع',
    pinTitle: 'كلمة سر الأدمن', pinHosp: 'مطلوبة للضيافة', pinDisc: 'مطلوبة للخصم', disc: 'خصم', sub: 'قبل الخصم', pinAdmin: 'للدخول على الـ Admin', wrongPin: 'كلمة السر غلط', ok: 'تأكيد', cancel: 'إلغاء',
    back: 'رجوع لشاشة البيع',
    tItems: 'الأصناف والمخزون', tItemsSub: 'أسعار، كميات، ON / OFF', tEod: 'End of Day', tEodSub: 'المبيعات والربح',
    tSales: 'سجل المبيعات', tSalesSub: 'كل الطلبات وإلغاؤها', tHosp: 'الضيافة', tHospSub: 'كل عمليات الضيافة',
    tBarista: 'الباريستا', tBaristaSub: 'قريباً', tSettings: 'الإعدادات', tSettingsSub: 'الشيت، كلمة السر، النسخ الاحتياطي',
  },
  en: {
    brand: 'MEU Kiosk', pos: 'Point of sale', offline: 'Offline · everything saved', online: 'Online · everything saved',
    sheetOk: 'Sheet up to date', sheetPending: (n) => `${n} waiting to upload`, sheetOff: 'Sheet not linked',
    all: 'All', items: (n) => `${n} items`, search: 'Search items...', results: 'Search results', noResults: 'No items found',
    flavors: (n) => `${n} flavours`, unavailable: 'Unavailable', noPrice: 'No price', from: 'from', jd: 'JD',
    order: 'Current order', clear: 'Clear all', emptyCart: 'Cart is empty', emptyHint: 'Tap any item to add it',
    total: 'Total', cash: 'Cash', visa: 'Visa', cliq: 'CliQ', received: 'Amount received', exact: 'Exact',
    change: 'Change', short: 'Not enough', hosp: 'Hospitality', checkout: 'Complete sale', pickFlavor: 'Pick a flavour', soldOut: 'Sold out',
    sold: (t, p) => `Sold · ${t} JD · ${p}`, hospDone: (t) => `Hospitality saved · ${t} JD`, lessThan: 'Received amount is less than the total',
    pinTitle: 'Admin password', pinHosp: 'Required for hospitality', pinDisc: 'Required for the discount', disc: 'Discount', sub: 'Before discount', pinAdmin: 'To open Admin', wrongPin: 'Wrong password', ok: 'Confirm', cancel: 'Cancel',
    back: 'Back to sales',
    tItems: 'Items & stock', tItemsSub: 'Prices, stock, ON / OFF', tEod: 'End of Day', tEodSub: 'Sales and profit',
    tSales: 'Sales log', tSalesSub: 'All orders, void', tHosp: 'Hospitality', tHospSub: 'All hospitality',
    tBarista: 'Barista', tBaristaSub: 'Coming soon', tSettings: 'Settings', tSettingsSub: 'Sheet, password, backup',
  },
};
const t = (k, ...a) => { const v = T[S.lang][k] ?? T.ar[k] ?? k; return typeof v === 'function' ? v(...a) : v; };
const L = (ar, en) => (S.lang === 'en' && en ? en : ar);

/* ---------- storage (IndexedDB) ---------- */
const DB = {
  db: null,
  open() {
    return new Promise((res, rej) => {
      const r = indexedDB.open('cafeteria-pos', 1);
      r.onupgradeneeded = () => {
        const db = r.result;
        db.createObjectStore('kv');
        const s = db.createObjectStore('sales', { keyPath: 'id' });
        s.createIndex('day', 'day');
        s.createIndex('synced', 'syncedFlag');
      };
      r.onsuccess = () => { DB.db = r.result; res(); };
      r.onerror = () => rej(r.error);
    });
  },
  tx(stores, mode, fn) {
    return new Promise((res, rej) => {
      const tx = DB.db.transaction(stores, mode);
      let out;
      tx.oncomplete = () => res(out);
      tx.onerror = () => rej(tx.error);
      tx.onabort = () => rej(tx.error || new Error('aborted'));
      out = fn(tx);
    });
  },
  req(r) { return new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); },
  async get(key) { return DB.req(DB.db.transaction('kv').objectStore('kv').get(key)); },
  set(key, val) { return DB.tx(['kv'], 'readwrite', (tx) => { tx.objectStore('kv').put(val, key); }); },
  async salesRange(from, to) {
    const idx = DB.db.transaction('sales').objectStore('sales').index('day');
    return DB.req(idx.getAll(IDBKeyRange.bound(from, to)));
  },
  async unsynced() { return DB.req(DB.db.transaction('sales').objectStore('sales').index('synced').getAll(0)); },
  async allSales() { return DB.req(DB.db.transaction('sales').objectStore('sales').getAll()); },
};

/* ---------- state ---------- */
const S = {
  lang: 'ar', view: 'sell', cat: 'all', q: '', cart: [], pay: 'cash', given: null,
  cats: [], groups: [], items: {}, settings: {}, dayCount: 0, pending: 0,
  admin: { tab: 'items', q: '', cat: 'all', from: dayOf(), to: dayOf() },
};

function seedCatalog() {
  const groups = [], items = {};
  SEED.groups.forEach((g, gi) => {
    groups.push({ id: g.id, ar: g.ar, en: g.en, cat: g.cat, order: gi });
    g.variants.forEach((v, vi) => {
      items[v.id] = { id: v.id, groupId: g.id, ar: v.ar, en: v.en, img: v.img, box: v.boxPrice == null ? null : Math.round(v.boxPrice * 1000), units: v.units, sell: null, stock: 0, off: false, sku: v.sku, order: vi };
    });
  });
  return { cats: SEED.cats, groups, items, seedVersion: SEED.version };
}

/* merge flavours into one item: stock is added up, any price already set is kept, old sales keep their names */
function mergeItems(cat, list) {
  list.forEach((m) => {
    const its = m.ids.map((id) => cat.items[id]).filter(Boolean); if (!its.length) return;
    const k = cat.items[m.keep] || its[0]; const pick = (f) => { const x = its.find((i) => i[f] != null && i[f] !== ''); return x ? x[f] : null; };
    k.stock = its.reduce((s, i) => s + (Number(i.stock) || 0), 0);
    k.sell = k.sell != null ? k.sell : pick('sell'); k.box = k.box != null ? k.box : pick('box'); k.units = k.units != null ? k.units : pick('units');
    k.off = its.every((i) => i.off); k.ar = m.ar; k.en = m.en; k.img = m.img;
    its.forEach((i) => { if (i !== k) delete cat.items[i.id]; });
  });
}
async function loadAll() {
  await DB.open();
  let cat = await DB.get('catalog');
  if (!cat) { cat = seedCatalog(); await DB.set('catalog', cat); }
  if ((cat.seedVersion || 1) < 2) { /* v2: raisin drink belongs with drinks */
    const g = cat.groups.find((x) => x.id === 'raisins');
    if (g) { g.cat = 'drinks'; g.ar = 'الرافدين زبيب العنب'; g.en = 'Al Rafidain Raisin Drink'; }
    cat.seedVersion = 2; await DB.set('catalog', cat);
  }
  if (cat.seedVersion < 4) { /* v4: water gets its own section, right under "All" */
    const custom = cat.cats.filter((c) => !SEED.cats.some((x) => x.id === c.id));
    cat.cats = [...SEED.cats, ...custom];
    const g = cat.groups.find((x) => x.id === 'berrywater');
    if (g) g.cat = 'water';
  }
  if (cat.seedVersion < 5) mergeItems(cat, MERGES_V5); /* v5: same-price flavours become one item */
  if (cat.seedVersion < 6) { /* v6: Matrix splits into Classic and Special flavours (gum, coffee cola, pina colada, lemon & mint) */
    const k = cat.items['matrix-1'];
    if (k) { k.ar = 'عادي'; k.en = 'Classic'; k.img = 'img/matrix-classic.webp'; }
    const sp = cat.items['matrix-6'];
    if (sp) { sp.ar = 'نكهات مميزة'; sp.en = 'Special Flavours'; sp.img = 'img/matrix-special.webp'; }
  }
  if (cat.seedVersion < 7) mergeItems(cat, MERGES_V7); /* v7: more same-price groups become one item */
  if (cat.seedVersion < 8) mergeItems(cat, [{ g: 'bm', keep: 'bm-2', ids: ['bm-2', 'bm-6'], ar: '185 مل', en: '185 ml', img: 'img/bm-small.webp' }]); /* v8: small BM cans together */
  if (cat.seedVersion < 9) mergeItems(cat, [{ g: 'kinza', keep: 'kinza', ids: ['kinza', 'kinza-6'], ar: null, en: null, img: 'img/kinza-mix.webp' }]); /* v9: Kinza soda water joins Kinza */
  if (cat.seedVersion < 10) mergeItems(cat, [{"g": "barbican", "keep": "barbican-1", "ids": ["barbican-1", "barbican-2"], "ar": "علب", "en": "Cans", "img": "img/barbican-cans.webp"}, {"g": "barbican", "keep": "barbican-3", "ids": ["barbican-3", "barbican-4", "barbican-5", "barbican-6"], "ar": "قزاز", "en": "Bottles", "img": "img/barbican-bottles.webp"}, {"g": "baladna", "keep": "baladna-1", "ids": ["baladna-1", "baladna-2", "baladna-3", "baladna-4"], "ar": "حليب", "en": "Flavoured milk", "img": "img/baladna-milk.webp"}]); /* v10: Barbican cans / bottles, Baladna milk / coffee milk */
  if (cat.seedVersion < 11) mergeItems(cat, [{"g": "bm", "keep": "bm-3", "ids": ["bm-3", "bm-4", "bm-5"], "ar": "نكهات", "en": "Flavours", "img": "img/bm-flavours.webp"}]); /* v11: BM pineapple, orange and berry together */
  if (cat.seedVersion < SEED.version) { /* v3+: add new items and flavours; never touch prices, stock or names already set */
    const fresh = seedCatalog();
    fresh.groups.forEach((g) => {
      const have = cat.groups.find((x) => x.id === g.id);
      if (have) have.order = g.order; else cat.groups.push(g);
    });
    Object.values(fresh.items).forEach((it) => {
      const have = cat.items[it.id];
      if (!have) cat.items[it.id] = it;
      else { have.order = it.order; if (have.ar == null && it.ar) { have.ar = it.ar; have.en = it.en; } }
    });
    cat.seedVersion = SEED.version; await DB.set('catalog', cat);
  }
  S.cats = cat.cats; S.groups = cat.groups; S.items = cat.items;
  S.settings = (await DB.get('settings')) || {};
  if (!S.settings.pin) { S.settings.pin = await sha('1234'); S.settings.lang = 'ar'; await DB.set('settings', S.settings); }
  if (!S.settings.pins) { S.settings.pins = { anas: await sha('1111'), lawrence: await sha('2222') }; await DB.set('settings', S.settings); }
  S.lang = S.settings.lang || 'ar';
  const today = await DB.salesRange(dayOf(), dayOf());
  S.dayCount = today.length;
  S.pending = (await DB.unsynced()).length;
}
const catalogDoc = () => ({ cats: S.cats, groups: S.groups, items: S.items, seedVersion: SEED.version });
const saveCatalog = () => DB.set('catalog', catalogDoc());
const saveSettings = () => DB.set('settings', S.settings);

/* ---------- catalog helpers ---------- */
const groupOf = (it) => S.groups.find((g) => g.id === it.groupId);
const itemsOf = (gid) => Object.values(S.items).filter((i) => i.groupId === gid).sort((a, b) => a.order - b.order);
const itemName = (it) => { const g = groupOf(it); const gn = g ? L(g.ar, g.en) : ''; const vn = L(it.ar, it.en); return vn ? `${gn} - ${vn}` : gn; };
const unitCost = (it) => (it.units > 0 && it.box != null ? it.box / it.units : null);
const isAvail = (it) => !it.off && it.stock > 0 && it.sell > 0;
const lowBoxes = () => (S.settings.lowBoxes > 0 ? S.settings.lowBoxes : 2);
const lowLimit = (it) => (it.units > 0 ? it.units * lowBoxes() : 10 * lowBoxes());
const lowItems = () => Object.values(S.items).filter((i) => !i.off && i.sell > 0 && i.stock > 0 && i.stock <= lowLimit(i));
function groupMatches(g, q) {
  if (!q) return true;
  const hay = [g.ar, g.en, ...itemsOf(g.id).flatMap((i) => [i.ar, i.en])].filter(Boolean).join(' ').toLowerCase();
  return q.toLowerCase().split(/\s+/).every((w) => hay.includes(w));
}

/* ---------- render: shell ---------- */
function render() {
  document.documentElement.lang = S.lang;
  document.documentElement.dataset.theme = S.settings.theme === 'dark' ? 'dark' : 'light';
  document.documentElement.dir = S.lang === 'ar' ? 'rtl' : 'ltr';
  const focus = rememberFocus();
  $('#app').innerHTML = header() + (S.view === 'sell' ? sellView() : adminView());
  restoreFocus(focus);
}
function rememberFocus() { const a = document.activeElement; return a && a.id ? { id: a.id, s: a.selectionStart, e: a.selectionEnd } : null; }
function restoreFocus(f) { if (!f) return; const el = document.getElementById(f.id); if (!el) return; el.focus(); try { if (f.s != null) el.setSelectionRange(f.s, f.e); } catch (e) { /* number inputs */ } }

function header() {
  const on = navigator.onLine;
  const sheet = !S.settings.sheetUrl ? t('sheetOff') : S.pending ? t('sheetPending', S.pending) : t('sheetOk');
  return `<header class="top">
    <div class="brand"><div class="logo">${ICON.cup}</div><div><b>${esc(t('brand'))}</b><small>${S.view === 'admin' ? 'Admin' : esc(t('pos'))}</small></div></div>
    <div class="grow"></div>
    <div class="pill"><span class="dot ${on ? 'on' : ''}"></span><span>${esc(on ? t('online') : t('offline'))}</span></div>
    <button class="pill" data-act="syncNow" style="color:#D4D5DA">${ICON.sync}<span>${esc(sheet)}</span></button>
    <button class="hbtn" data-act="openSheet">${S.lang === 'ar' ? 'افتح الشيت' : 'Open sheet'}</button>
    <button class="hbtn" data-act="theme" aria-label="${S.settings.theme === 'dark' ? 'Light mode' : 'Night mode'}">${S.settings.theme === 'dark' ? ICON.sun : ICON.moon}</button>
    <button class="hbtn" data-act="lang">${S.lang === 'ar' ? 'EN' : 'ع'}</button>
    ${S.view === 'sell'
      ? `<button class="hbtn" data-act="openAdmin">${ICON.lock}<span>Admin</span>${lowItems().length ? `<span class="lowdot num" title="low stock">${lowItems().length}</span>` : ''}</button>`
      : `<button class="hbtn" data-act="closeAdmin">${ICON.back}<span>${esc(t('back'))}</span></button>`}
  </header>`;
}

/* ---------- sell view ---------- */
function visibleGroups() {
  const q = S.q.trim();
  return S.groups.filter((g) => (S.cat === 'all' || g.cat === S.cat) && itemsOf(g.id).length && groupMatches(g, q)).sort((a, b) => a.order - b.order);
}
function sellView() {
  const cats = [{ id: 'all', ar: t('all'), en: t('all') }, ...S.cats];
  const nav = cats.map((c) => {
    const n = c.id === 'all' ? S.groups.length : S.groups.filter((g) => g.cat === c.id).length;
    return `<button class="sidebtn ${S.cat === c.id ? 'on' : ''}" data-act="cat" data-id="${c.id}" aria-pressed="${S.cat === c.id}"><b>${esc(L(c.ar, c.en))}</b><small>${esc(t('items', n))}</small></button>`;
  }).join('');
  return `<div class="body">
    <nav class="side cats scroll" aria-label="categories">${nav}</nav>
    <main class="sell">
      <div class="searchrow"><label class="search">${ICON.search}<span class="sr">${esc(t('search'))}</span>
        <input id="q" type="search" autocomplete="off" placeholder="${esc(t('search'))}" value="${esc(S.q)}" data-in="q">
        ${S.q ? `<button class="x" data-act="clearQ" aria-label="clear">${ICON.x}</button>` : ''}</label></div>
      <div id="gridArea" class="gridwrap scroll">${gridHtml()}</div>
    </main>
    <aside class="cart" id="cartArea">${cartHtml()}</aside>
  </div>`;
}
function gridHtml() {
  const gs = visibleGroups();
  const title = S.q.trim() ? t('results') : L(...(S.cat === 'all' ? [t('all'), t('all')] : (() => { const c = S.cats.find((x) => x.id === S.cat); return [c.ar, c.en]; })()));
  const head = `<div class="gridhead"><b>${esc(title)}</b><span>${esc(t('items', gs.length))}</span></div>`;
  if (!gs.length) return head + `<div class="empty"><b>${esc(t('noResults'))}</b></div>`;
  const tiles = gs.map((g) => {
    const its = itemsOf(g.id), avail = its.filter(isAvail), multi = its.length > 1;
    const prices = (avail.length ? avail : its).map((i) => i.sell).filter((p) => p > 0);
    const min = prices.length ? Math.min(...prices) : null, same = prices.every((p) => p === min);
    const off = !avail.length, priced = prices.length > 0;
    const img = its[0].img;
    const price = !priced ? t('noPrice') : `${multi && !same ? t('from') + ' ' : ''}${jd(min)} ${t('jd')}`;
    return `<button class="tile ${off ? 'off' : ''}" data-act="tile" data-id="${g.id}" ${off ? 'disabled' : ''} aria-label="${esc(L(g.ar, g.en))}${off ? ' - ' + esc(t('unavailable')) : ''}">
      <div class="ph"><img src="${esc(img)}" alt="" loading="lazy" decoding="async">
        ${multi ? `<span class="badge">${esc(t('flavors', its.length))}</span>` : ''}
        ${off ? `<span class="badge mid">${esc(t('unavailable'))}</span>` : ''}</div>
      <span class="nm">${esc(L(g.ar, g.en))}</span><span class="pr num">${esc(price)}</span></button>`;
  }).join('');
  return head + `<div class="grid">${tiles}</div>`;
}
const MERGES_V5 = [{"g": "super", "keep": "super-1", "ids": ["super-1", "super-2", "super-3", "super-4", "super-5"], "ar": null, "en": null, "img": "img/super-1.webp"}, {"g": "matrix", "keep": "matrix-1", "ids": ["matrix-1", "matrix-2", "matrix-3", "matrix-4", "matrix-5", "matrix-6", "matrix-7", "matrix-8", "matrix-9", "matrix-10"], "ar": null, "en": null, "img": "img/matrix-mix.webp"}, {"g": "kinza", "keep": "kinza", "ids": ["kinza", "kinza-2", "kinza-3", "kinza-4", "kinza-5"], "ar": "مشروب غازي", "en": "Soda", "img": "img/kinza-mix.webp"}, {"g": "monster", "keep": "monster-1", "ids": ["monster-1", "monster-2", "monster-3", "monster-4", "monster-5", "monster-6"], "ar": null, "en": null, "img": "img/monster-mix.webp"}, {"g": "luna", "keep": "luna-1", "ids": ["luna-1", "luna-2", "luna-3", "luna-4", "luna-5"], "ar": null, "en": null, "img": "img/luna-mix.webp"}, {"g": "redbull", "keep": "redbull-1", "ids": ["redbull-1", "redbull-2"], "ar": "عادي ولايت", "en": "Original & Lite", "img": "img/redbull-mix.webp"}];
const MERGES_V7 = [{"g": "freez", "keep": "freez-1", "ids": ["freez-1", "freez-2", "freez-3", "freez-4", "freez-5"], "ar": null, "en": null, "img": "img/freez-mix.webp"}, {"g": "bansella", "keep": "bansella-1", "ids": ["bansella-1", "bansella-2"], "ar": null, "en": null, "img": "img/bansella-mix.webp"}, {"g": "rani", "keep": "rani-1", "ids": ["rani-1", "rani-2"], "ar": null, "en": null, "img": "img/rani-mix.webp"}, {"g": "tonic", "keep": "tonic-1", "ids": ["tonic-1", "tonic-2"], "ar": null, "en": null, "img": "img/tonic-mix.webp"}, {"g": "glass", "keep": "glass-1", "ids": ["glass-1", "glass-2", "glass-3"], "ar": null, "en": null, "img": "img/glass-mix.webp"}, {"g": "almaraiprotein", "keep": "almaraiprotein-1", "ids": ["almaraiprotein-1", "almaraiprotein-2", "almaraiprotein-3"], "ar": null, "en": null, "img": "img/almaraiprotein-mix.webp"}, {"g": "canary", "keep": "canary-1", "ids": ["canary-1", "canary-2", "canary-3", "canary-4"], "ar": null, "en": null, "img": "img/canary-mix.webp"}, {"g": "tasco", "keep": "tasco-1", "ids": ["tasco-1", "tasco-2"], "ar": null, "en": null, "img": "img/tasco-mix.webp"}, {"g": "mrbrown", "keep": "mrbrown-1", "ids": ["mrbrown-1", "mrbrown-2", "mrbrown-3", "mrbrown-4", "mrbrown-5"], "ar": null, "en": null, "img": "img/mrbrown-mix.webp"}, {"g": "icetea", "keep": "icetea-1", "ids": ["icetea-1", "icetea-2", "icetea-3", "icetea-4", "icetea-5", "icetea-6", "icetea-7", "icetea-8"], "ar": null, "en": null, "img": "img/icetea-mix.webp"}, {"g": "blu", "keep": "blu-1", "ids": ["blu-1", "blu-2", "blu-3", "blu-4"], "ar": null, "en": null, "img": "img/blu-mix.webp"}, {"g": "black", "keep": "black-1", "ids": ["black-1", "black-2"], "ar": null, "en": null, "img": "img/black-mix.webp"}, {"g": "landessa", "keep": "landessa-1", "ids": ["landessa-1", "landessa-2", "landessa-3", "landessa-4", "landessa-5"], "ar": null, "en": null, "img": "img/landessa-mix.webp"}];
/* two admins; each one's password opens Admin, hospitality and the discount */
const ADMINS = [{ id: 'anas', ar: 'أنس', en: 'Anas' }, { id: 'lawrence', ar: 'لورنس', en: 'Lawrence' }];
const DISC_PCT = 30;
const cartSub = () => S.cart.reduce((a, l) => a + l.price * l.qty, 0);
const cartDisc = () => (S.disc && S.cart.length ? Math.round(cartSub() * S.disc.pct / 100) : 0);
const cartTotal = () => cartSub() - cartDisc();
const lineNet = (l) => (l.net != null ? l.net : l.price * l.qty);
const adminName = (ar) => { const x = ADMINS.find((d) => d.ar === ar); return x ? L(x.ar, x.en) : ar; };
function cartHtml() {
  if (!S.cart.length) S.disc = null;
  const total = cartTotal(), empty = !S.cart.length, count = S.cart.reduce((a, l) => a + l.qty, 0);
  const lines = empty
    ? `<div class="empty"><div class="ring">${ICON.cart}</div><b>${esc(t('emptyCart'))}</b><span>${esc(t('emptyHint'))}</span></div>`
    : S.cart.map((l, i) => {
      const it = S.items[l.id];
      return `<div class="line"><div class="thumb"><img src="${esc(it ? it.img : '')}" alt=""></div>
        <div class="info"><b>${esc(it ? itemName(it) : l.name)}</b><small class="num">${jd(l.price)} × ${l.qty}</small></div>
        <div class="qty"><button data-act="inc" data-i="${i}" aria-label="+">+</button><span class="num">${l.qty}</span><button data-act="dec" data-i="${i}" aria-label="-">−</button></div>
        <span class="lt num">${jd(l.price * l.qty)}</span></div>`;
    }).join('');
  const pays = ['cash', 'visa', 'cliq'].map((p) => `<button class="segbtn ${S.pay === p ? 'on' : ''}" data-act="pay" data-id="${p}" aria-pressed="${S.pay === p}">${esc(t(p))}</button>`).join('');
  let cash = '';
  if (S.pay === 'cash' && !empty) {
    const amts = [[t('exact'), total], ['1', 1000], ['5', 5000], ['10', 10000], ['20', 20000]];
    const ch = S.given == null ? null : S.given - total;
    cash = `<span class="lbl">${esc(t('received'))}</span>
      <div class="seg seg5">${amts.map(([lab, v]) => `<button class="segbtn ${S.given === v ? 'on' : ''}" data-act="given" data-v="${v}">${esc(lab)}</button>`).join('')}</div>
      <div class="change"><span>${esc(t('change'))}</span><b class="num">${ch == null ? '—' : ch < 0 ? esc(t('short')) : jd(ch) + ' ' + esc(t('jd'))}</b></div>`;
  }
  return `<div class="cartcard">
    <div class="carthead"><div><b>${esc(t('order'))}</b>${empty ? '' : `<span class="count num">${count}</span>`}</div>${empty ? '' : `<button class="btn-ghost" data-act="clearCart">${esc(t('clear'))}</button>`}</div>
    <div class="lines scroll">${lines}</div>
    <div class="cartfoot">
      ${S.disc ? `<div class="discrow"><span>${esc(t('sub'))}</span><span class="num">${jd(cartSub())}</span></div>
      <div class="discrow d"><span>${esc(t('disc'))} ${S.disc.pct}% · ${esc(adminName(S.disc.by))}</span><span class="num">-${jd(cartDisc())}</span><button class="xbtn" data-act="rmDisc" aria-label="remove discount">${ICON.x}</button></div>` : ''}
      <div class="total"><span>${esc(t('total'))}</span><b class="num">${jd(total)} <small>${esc(t('jd'))}</small></b></div>
      <div class="seg seg3" role="group">${pays}</div>${cash}
      <div class="actions"><button class="btn hosp" data-act="hosp" ${empty ? 'disabled' : ''}>${ICON.lock}<span>${esc(t('hosp'))}</span></button>
        <button class="btn hosp disc ${S.disc ? 'on' : ''}" data-act="disc" ${empty || S.disc ? 'disabled' : ''}>${ICON.lock}<span>${esc(t('disc'))} <span class="num">${DISC_PCT}%</span></span></button>
        <button class="btn primary big" data-act="checkout" ${empty ? 'disabled' : ''}>${esc(t('checkout'))}</button></div>
    </div></div>`;
}
const rerenderCart = () => { const c = $('#cartArea'); if (c) c.innerHTML = cartHtml(); };
const rerenderGrid = () => { const g = $('#gridArea'); if (g) g.innerHTML = gridHtml(); };

function addToCart(id) {
  const it = S.items[id];
  if (!it || !isAvail(it)) return;
  const inCart = S.cart.filter((l) => l.id === id).reduce((a, l) => a + l.qty, 0);
  if (inCart >= it.stock) { toast(S.lang === 'ar' ? `ما ضل غير ${it.stock} من ${itemName(it)}` : `Only ${it.stock} left`, true); return; }
  const l = S.cart.find((x) => x.id === id);
  if (l) l.qty++; else S.cart.push({ id, name: itemName(it), price: it.sell, qty: 1 });
  S.given = null;
  closeModal(); rerenderCart();
}

function flavorSheet(gid) {
  const g = S.groups.find((x) => x.id === gid), its = itemsOf(gid);
  const btns = its.map((i) => {
    const ok = isAvail(i);
    const sub = ok ? `${jd(i.sell)} ${t('jd')}` : !(i.sell > 0) ? t('noPrice') : t('soldOut');
    return `<button class="vbtn" data-act="addItem" data-id="${i.id}" ${ok ? '' : 'disabled'}><img src="${esc(i.img)}" alt=""><b>${esc(L(i.ar, i.en) || L(g.ar, g.en))}</b><span class="pr num">${esc(sub)}</span></button>`;
  }).join('');
  openModal(`<div class="modal" role="dialog" aria-label="${esc(L(g.ar, g.en))}">
    <div class="mhead"><div class="mimg"><img src="${esc(its[0].img)}" alt=""></div><div class="grow"><b>${esc(L(g.ar, g.en))}</b><small>${esc(t('pickFlavor'))}</small></div>
      <button class="close" data-act="closeModal" aria-label="close">${ICON.x}</button></div>
    <div class="mbody scroll"><div class="vgrid">${btns}</div></div></div>`);
}

/* ---------- checkout sound (stored with the app, so it plays offline) ---------- */
const SND = { ctx: null, buf: null };
async function loadSound() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    SND.ctx = new AC();
    const r = await fetch('sounds/cash.mp3'); SND.buf = await SND.ctx.decodeAudioData(await r.arrayBuffer());
  } catch (e) { /* no sound is fine */ }
}
function playCash(force) {
  if (!force && S.settings.sound === false) return;
  try {
    if (!SND.ctx || !SND.buf) return;
    if (SND.ctx.state === 'suspended') SND.ctx.resume();
    const s = SND.ctx.createBufferSource(); s.buffer = SND.buf; s.connect(SND.ctx.destination); s.start();
  } catch (e) { /* ignore */ }
}
document.addEventListener('pointerdown', () => { if (SND.ctx && SND.ctx.state === 'suspended') SND.ctx.resume(); }, true);

/* ---------- saving sales (one atomic write: sale + stock) ---------- */
async function saveSale(type, who) {
  if (!S.cart.length) return;
  for (const l of S.cart) { const it = S.items[l.id]; if (!it || it.stock < l.qty) { toast(S.lang === 'ar' ? 'المخزون ما بيكفي' : 'Not enough stock', true); return; } }
  const now = Date.now();
  const lines = S.cart.map((l) => { const it = S.items[l.id]; const c = unitCost(it); return { id: l.id, name: itemName(it), nameAr: (() => { const g = groupOf(it); return it.ar ? `${g.ar} - ${it.ar}` : g.ar; })(), qty: l.qty, price: l.price, cost: c == null ? null : Math.round(c * 1000) / 1000 }; });
  const sub = lines.reduce((a, l) => a + l.price * l.qty, 0);
  const disc = type === 'sale' && S.disc ? Math.round(sub * S.disc.pct / 100) : 0;
  if (disc) { /* spread the discount over the lines so item reports add up to the real total */
    let left = sub - disc;
    lines.forEach((l, i) => { l.net = i === lines.length - 1 ? left : Math.round(l.price * l.qty * (sub - disc) / sub); left -= i === lines.length - 1 ? 0 : l.net; });
  }
  const total = sub - disc;
  const cost = lines.reduce((a, l) => a + (l.cost || 0) * l.qty, 0);
  const sale = { id: now.toString(36) + '-' + Math.random().toString(36).slice(2, 6), ts: now, day: dayOf(new Date(now)), no: S.dayCount + 1, type, pay: type === 'sale' ? S.pay : null, given: type === 'sale' && S.pay === 'cash' ? S.given : null, lines, total, cost, voided: false, syncedFlag: 0 };
  if (disc) Object.assign(sale, { sub, disc, discPct: S.disc.pct, by: S.disc.by });
  if (type === 'hosp' && who) sale.by = who;
  const items = JSON.parse(JSON.stringify(S.items));
  for (const l of lines) items[l.id].stock -= l.qty;
  try {
    await DB.tx(['kv', 'sales'], 'readwrite', (tx) => {
      tx.objectStore('kv').put({ cats: S.cats, groups: S.groups, items, seedVersion: SEED.version }, 'catalog');
      tx.objectStore('sales').put(sale);
    });
  } catch (e) { toast((S.lang === 'ar' ? 'ما انحفظت العملية: ' : 'Not saved: ') + e.message, true); return; }
  const crossed = lines.filter((l) => { const before = S.items[l.id].stock, after = items[l.id].stock, lim = lowLimit(items[l.id]); return before > lim && after <= lim; }).map((l) => l.name);
  const empty = lines.filter((l) => S.items[l.id].stock > 0 && items[l.id].stock <= 0).map((l) => l.name);
  S.items = items; S.dayCount++; S.pending++;
  S.cart = []; S.given = null; S.disc = null;
  if (type === 'sale') playCash();
  toast(type === 'hosp' ? t('hospDone', jd(total)) : t('sold', jd(total), t(sale.pay)));
  if (empty.length || crossed.length) setTimeout(() => toast(empty.length
    ? (S.lang === 'ar' ? `خلص: ${empty.join('، ')}` : `Sold out: ${empty.join(', ')}`)
    : (S.lang === 'ar' ? `تنبيه: ضايل ${lowBoxes()} كرتونة أو أقل من ${crossed.join('، ')}` : `Low stock: ${crossed.join(', ')}`), true, 6000), 2700);
  render();
  syncSoon();
}

/* ---------- modals & toast ---------- */
function openModal(html) { $('#modal').innerHTML = `<div class="overlay" data-act="overlay">${html}</div>`; }
function closeModal() { $('#modal').innerHTML = ''; S.modal = null; }
let toastTimer;
function toast(msg, bad, ms) {
  $('#toast').innerHTML = `<div class="toast ${bad ? 'bad' : ''}" role="status"><span class="ok">${bad ? ICON.x.replace('currentColor', '#fff') : ICON.check}</span><span>${esc(msg)}</span></div>`;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('#toast').innerHTML = ''; }, ms || 2600);
}
function askPin(sub, onOk, code, title) {
  S.modal = { kind: 'pin', val: '', sub, onOk, err: '', code, title };
  drawPin();
}
function drawPin() {
  const m = S.modal;
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'];
  openModal(`<div class="modal narrow" role="dialog" aria-label="${esc(m.title || t('pinTitle'))}">
    <div class="mhead"><div class="grow"><b>${esc(m.title || t('pinTitle'))}</b><small>${esc(m.sub)}</small></div><button class="close" data-act="closeModal" aria-label="close">${ICON.x}</button></div>
    <div class="mbody"><div class="dots">${Array.from({ length: Math.max(4, m.val.length) }, (_, i) => `<i class="${i < m.val.length ? 'f' : ''}"></i>`).join('')}</div>
      <div class="err" style="text-align:center">${esc(m.err)}</div>
      <div class="pinpad">${keys.map((k) => `<button data-act="pin" data-k="${k}" ${k === 'ok' ? 'style="background:var(--acc);border-color:var(--acc);color:#fff;font-size:16px"' : ''}>${k === 'del' ? '⌫' : k === 'ok' ? esc(t('ok')) : k}</button>`).join('')}</div></div></div>`);
}
async function pinKey(k) {
  const m = S.modal; if (!m || m.kind !== 'pin') return;
  if (k === 'del') m.val = m.val.slice(0, -1);
  else if (k === 'ok') {
    if (m.code) { if (m.val === m.code) { const cb = m.onOk; closeModal(); cb(); return; } }
    else { const h = await sha(m.val), who = ADMINS.find((d) => (S.settings.pins || {})[d.id] === h); if (who) { const cb = m.onOk; closeModal(); cb(who.ar); return; } }
    m.err = t('wrongPin'); m.val = '';
  } else if (m.val.length < 8) { m.val += k; m.err = ''; }
  drawPin();
}

/* ---------- admin ---------- */
function adminView() {
  const tabs = [['items', 'tItems', 'tItemsSub'], ['eod', 'tEod', 'tEodSub'], ['sales', 'tSales', 'tSalesSub'], ['hosp', 'tHosp', 'tHospSub'], ['barista', 'tBarista', 'tBaristaSub'], ['settings', 'tSettings', 'tSettingsSub']];
  const nav = tabs.map(([id, a, b]) => `<button class="sidebtn ${S.admin.tab === id ? 'on' : ''}" data-act="tab" data-id="${id}"><b>${esc(t(a))}</b><small>${esc(t(b))}</small></button>`).join('');
  return `<div class="body"><nav class="side tabs scroll">${nav}</nav><main class="admin scroll" id="adminMain">${adminTabHtml()}</main></div>`;
}
let adminCache = null;
function adminTabHtml() {
  switch (S.admin.tab) {
    case 'items': return itemsTab();
    case 'eod': return reportTab('eod');
    case 'sales': return reportTab('sales');
    case 'hosp': return reportTab('hosp');
    case 'barista': return `<div class="empty" style="height:560px"><div class="ring">${ICON.cup.replace('#fff', '#8F8B82')}</div><b>${esc(t('tBarista'))}</b><span>${S.lang === 'ar' ? 'فاضية حالياً · بنعبّيها لما نتفق على حسبة القهوة' : 'Empty for now'}</span></div>`;
    case 'settings': return settingsTab();
  }
  return '';
}
const rerenderAdmin = () => { const m = $('#adminMain'); if (!m) return; const f = rememberFocus(); m.innerHTML = adminTabHtml(); restoreFocus(f); };

function itemsTab() {
  const q = S.admin.q.trim();
  const all = Object.values(S.items);
  const onN = all.filter(isAvail).length, lowN = lowItems().length;
  const needN = all.filter((i) => !(i.sell > 0) || !(i.units > 0)).length;
  const chips = [{ id: 'all', ar: 'الكل', en: 'All' }, ...S.cats, { id: 'need', ar: 'ناقصها معلومات', en: 'Missing info' }, { id: 'low', ar: 'قربت تخلص', en: 'Low stock' }]
    .map((c) => `<button class="chip ${S.admin.cat === c.id ? 'on' : ''}" data-act="acat" data-id="${c.id}">${esc(L(c.ar, c.en))}</button>`).join('');
  const gs = S.groups.filter((g) => (S.admin.cat === 'all' || ['need', 'low'].includes(S.admin.cat) || g.cat === S.admin.cat) && groupMatches(g, q)).sort((a, b) => a.order - b.order);
  let rows = '';
  for (const g of gs) {
    let its = itemsOf(g.id);
    if (S.admin.cat === 'need') its = its.filter((i) => !(i.sell > 0) || !(i.units > 0));
    if (S.admin.cat === 'low') its = its.filter((i) => i.stock > 0 && i.stock <= lowLimit(i));
    if (!its.length) continue;
    if (its.length > 1) rows += `<tr class="grp"><td colspan="8" class="s"><div class="namecell"><input class="nameinp grpname" id="gname-${g.id}" value="${esc(g.ar)}" data-chg="gname" data-id="${g.id}" aria-label="group name"><span>${esc(t('flavors', its.length))}</span></div></td></tr>`;
    for (const it of its) {
      const c = unitCost(it), p = it.sell > 0 && c != null ? it.sell - c : null;
      const on = isAvail(it), st = it.stock;
      const bx = it.units > 0 ? `${Math.floor(st / it.units)} ${S.lang === 'ar' ? 'صندوق و' : 'box + '}${st % it.units} ${S.lang === 'ar' ? 'حبة' : 'pcs'}` : '';
      const stCls = st <= 0 ? 'zero' : st <= lowLimit(it) ? 'low' : '';
      rows += `<tr class="${on ? '' : 'off'}">
        <td class="s"><div class="namecell"><div class="thumb"><img src="${esc(it.img)}" alt=""></div><div class="grow"><input class="nameinp" id="vname-${it.id}" value="${esc(its.length > 1 ? (it.ar || '') : g.ar)}" data-chg="${its.length > 1 ? 'vname' : 'gname'}" data-id="${its.length > 1 ? it.id : g.id}" aria-label="name"><small>${esc(its.length > 1 ? L(g.ar, g.en) : L(S.cats.find((x) => x.id === g.cat)?.ar, S.cats.find((x) => x.id === g.cat)?.en))}</small></div>
          <button class="btn sm" data-act="editItem" data-id="${it.id}" style="margin-inline-start:auto">${S.lang === 'ar' ? 'تعديل' : 'Edit'}</button></div></td>
        <td><input class="ti num" id="box-${it.id}" inputmode="decimal" value="${jd(it.box)}" data-chg="box" data-id="${it.id}" aria-label="box price"></td>
        <td><input class="ti u num ${it.units > 0 ? '' : 'need'}" id="units-${it.id}" inputmode="numeric" value="${it.units > 0 ? it.units : ''}" placeholder="؟" data-chg="units" data-id="${it.id}" aria-label="pieces per box"></td>
        <td><input class="ti num" id="cost-${it.id}" inputmode="decimal" value="${c == null ? '' : jd(c)}" placeholder="—" data-chg="cost" data-id="${it.id}" ${it.units > 0 ? '' : 'disabled'} aria-label="unit cost"></td>
        <td><input class="ti num ${it.sell > 0 ? '' : 'need'}" id="sell-${it.id}" inputmode="decimal" value="${it.sell > 0 ? jd(it.sell) : ''}" placeholder="؟" data-chg="sell" data-id="${it.id}" aria-label="selling price"></td>
        <td class="num ${p == null ? '' : p >= 0 ? 'pos' : 'neg'}">${p == null ? '—' : jd(p)}</td>
        <td><div class="stk"><div class="v"><span class="num ${stCls}">${st} ${S.lang === 'ar' ? 'حبة' : 'pcs'}</span><small>${esc(bx)}</small></div>
          <div class="bs"><button class="btn sm" data-act="stock" data-mode="box" data-id="${it.id}" ${it.units > 0 ? '' : 'disabled'}>+ ${S.lang === 'ar' ? 'صندوق' : 'Box'}</button><button class="btn sm" data-act="stock" data-mode="piece" data-id="${it.id}">+ ${S.lang === 'ar' ? 'حبة' : 'Pcs'}</button></div>
          <button class="btn sm" data-act="stock" data-mode="set" data-id="${it.id}" title="جرد">${S.lang === 'ar' ? 'جرد' : 'Count'}</button></div></td>
        <td><button class="switch ${on ? 'on' : ''}" role="switch" aria-checked="${on}" data-act="toggle" data-id="${it.id}"><i></i><span>${on ? 'ON' : 'OFF'}</span></button></td></tr>`;
    }
  }
  return `<div class="ahead"><div><h1>${esc(t('tItems'))}</h1><p>${S.lang === 'ar' ? 'عدّل سعر الصندوق، عدد الحبات، تكلفة الحبة أو سعر البيع، والباقي بيتحدّث لحاله. السعر الجديد بيمشي على المبيعات الجاية بس.' : 'Edit box price, pieces, unit cost or selling price; the rest updates. New prices apply to future sales only.'}</p></div>
      <button class="btn primary" data-act="newItem">+ ${S.lang === 'ar' ? 'صنف جديد' : 'New item'}</button></div>
    <div class="kpis k3"><div class="kpi"><span>${S.lang === 'ar' ? 'أصناف ON' : 'Items ON'}</span><b class="num">${onN}</b></div>
      <button class="kpi lowkpi" data-act="acat" data-id="low"><span>${S.lang === 'ar' ? `قربت تخلص (${lowBoxes()} كرتونة أو أقل)` : `Low stock (${lowBoxes()} boxes or less)`}</span><b class="num low">${lowN}</b></button>
      <div class="kpi"><span>${S.lang === 'ar' ? 'ناقصها سعر بيع أو عدد حبات' : 'Missing price or pieces'}</span><b class="num" style="color:var(--acc)">${needN}</b></div></div>
    <div class="toolbar"><label class="search">${ICON.search}<input id="aq" type="search" placeholder="${esc(t('search'))}" value="${esc(S.admin.q)}" data-in="aq"></label><div class="chips">${chips}</div></div>
    <div class="card"><table class="tbl"><thead><tr><th class="s" style="width:28%">${S.lang === 'ar' ? 'الصنف' : 'Item'}</th><th>${S.lang === 'ar' ? 'سعر الصندوق' : 'Box price'}</th><th>${S.lang === 'ar' ? 'حبات' : 'Pcs'}</th><th>${S.lang === 'ar' ? 'تكلفة الحبة' : 'Unit cost'}</th><th>${S.lang === 'ar' ? 'سعر البيع' : 'Price'}</th><th>${S.lang === 'ar' ? 'ربح الحبة' : 'Profit'}</th><th>${S.lang === 'ar' ? 'المخزون' : 'Stock'}</th><th>ON / OFF</th></tr></thead><tbody>${rows || `<tr><td colspan="8" style="height:120px;color:var(--muted)">${esc(t('noResults'))}</td></tr>`}</tbody></table></div>
    <p class="note">${S.lang === 'ar' ? 'لما مخزون أي صنف يوصل صفر بيصير OFF لحاله، وبيرجع ON لما تضيف كمية. والصنف بدون سعر بيع ما بينباع.' : 'Items at zero stock turn OFF automatically and come back ON when you add stock. Items without a price cannot be sold.'}</p>`;
}

async function changeField(field, id, raw) {
  if (field === 'gname' || field === 'vname') {
    const v = raw.trim();
    if (field === 'gname') { const g = S.groups.find((x) => x.id === id); if (!g) return; if (!v) { toast(S.lang === 'ar' ? 'الاسم ما بيصير يكون فاضي' : 'Name cannot be empty', true); rerenderAdmin(); return; } g.ar = v; }
    else { const it = S.items[id]; if (!it) return; it.ar = v || null; }
    await saveCatalog(); toast(S.lang === 'ar' ? 'انحفظ الاسم' : 'Name saved'); if (field === 'gname') rerenderAdmin(); return;
  }
  const it = S.items[id]; if (!it) return;
  if (field === 'units') { const v = parseInt(raw, 10); it.units = isNaN(v) || v <= 0 ? null : v; }
  else {
    const f = toFils(raw);
    if (raw.trim() === '') { if (field === 'sell') it.sell = null; }
    else if (f == null) { toast(S.lang === 'ar' ? 'رقم غلط' : 'Invalid number', true); rerenderAdmin(); return; }
    else if (field === 'box') it.box = f;
    else if (field === 'sell') it.sell = f;
    else if (field === 'cost' && it.units > 0) it.box = Math.round(f * it.units);
  }
  await saveCatalog();
  rerenderAdmin();
}

function stockModal(id, mode) {
  const it = S.items[id];
  const title = mode === 'box' ? (S.lang === 'ar' ? 'إضافة صناديق' : 'Add boxes') : mode === 'piece' ? (S.lang === 'ar' ? 'إضافة حبات' : 'Add pieces') : (S.lang === 'ar' ? 'جرد: العدد الفعلي بالحبات' : 'Count: actual pieces');
  const quick = mode === 'set' ? [] : [1, 2, 3, 5, 10];
  S.modal = { kind: 'stock', id, mode };
  openModal(`<div class="modal narrow" role="dialog" aria-label="${esc(title)}">
    <div class="mhead"><div class="mimg"><img src="${esc(it.img)}" alt=""></div><div class="grow"><b>${esc(title)}</b><small>${esc(itemName(it))} · ${S.lang === 'ar' ? 'الحالي' : 'now'}: ${it.stock}</small></div><button class="close" data-act="closeModal" aria-label="close">${ICON.x}</button></div>
    <div class="mbody">
      ${quick.length ? `<div class="seg seg5">${quick.map((n) => `<button class="segbtn" data-act="qset" data-v="${n}">${n}</button>`).join('')}</div>` : ''}
      <div class="field"><label for="qtyIn">${mode === 'box' ? (S.lang === 'ar' ? `عدد الصناديق (كل صندوق ${it.units} حبة)` : `Boxes (${it.units} pcs each)`) : (S.lang === 'ar' ? 'عدد الحبات' : 'Pieces')}</label>
        <input class="inp c num" id="qtyIn" type="number" inputmode="numeric" min="0" value="${mode === 'set' ? it.stock : 1}"></div>
      <div class="actions"><button class="btn" data-act="closeModal" style="flex:1">${esc(t('cancel'))}</button><button class="btn primary" data-act="stockOk" style="flex:2">${esc(t('ok'))}</button></div></div></div>`);
  setTimeout(() => { const i = $('#qtyIn'); if (i) { i.focus(); i.select(); } }, 50);
}
async function stockOk() {
  const m = S.modal, it = S.items[m.id];
  const n = parseInt($('#qtyIn').value, 10);
  if (isNaN(n) || n < 0) { toast(S.lang === 'ar' ? 'رقم غلط' : 'Invalid number', true); return; }
  const before = it.stock;
  if (m.mode === 'box') it.stock += n * it.units; else if (m.mode === 'piece') it.stock += n; else it.stock = n;
  await saveCatalog();
  const log = (await DB.get('stocklog')) || []; log.push({ ts: Date.now(), id: it.id, name: itemName(it), mode: m.mode, before, after: it.stock }); await DB.set('stocklog', log.slice(-2000));
  closeModal(); rerenderAdmin();
  toast(`${itemName(it)}: ${before} → ${it.stock}`);
}

/* item editor */
function itemModal(id) {
  const it = id ? S.items[id] : null, g = it ? groupOf(it) : null;
  S.modal = { kind: 'item', id, img: it ? it.img : null };
  const gopts = S.groups.slice().sort((a, b) => a.ar.localeCompare(b.ar, 'ar')).map((x) => `<option value="${x.id}" ${g && g.id === x.id ? 'selected' : ''}>${esc(L(x.ar, x.en))}</option>`).join('');
  const copts = S.cats.map((c) => `<option value="${c.id}" ${g && g.cat === c.id ? 'selected' : ''}>${esc(L(c.ar, c.en))}</option>`).join('');
  const A = S.lang === 'ar';
  openModal(`<div class="modal" role="dialog" aria-label="item">
    <div class="mhead"><div class="grow"><b>${it ? (A ? 'تعديل صنف' : 'Edit item') : (A ? 'صنف جديد' : 'New item')}</b><small>${A ? 'إذا الصنف نكهة لصنف موجود، اختار مجموعته' : 'If it is a flavour of an existing item, pick its group'}</small></div><button class="close" data-act="closeModal" aria-label="close">${ICON.x}</button></div>
    <div class="mbody scroll">
      <div class="row2"><div class="field"><label for="fGroup">${A ? 'المجموعة' : 'Group'}</label><select class="inp" id="fGroup"><option value="__new" ${g ? '' : 'selected'}>${A ? '+ مجموعة جديدة' : '+ New group'}</option>${gopts}</select></div>
        <div class="field"><label for="fCat">${A ? 'التصنيف' : 'Category'}</label><select class="inp" id="fCat">${copts}</select></div></div>
      <div class="row2"><div class="field"><label for="fGar">${A ? 'اسم المجموعة / الصنف (عربي)' : 'Group / item name (Arabic)'}</label><input class="inp" id="fGar" value="${esc(g ? g.ar : '')}"></div>
        <div class="field"><label for="fGen">${A ? 'الاسم بالإنجليزي' : 'Name (English)'}</label><input class="inp" id="fGen" dir="ltr" value="${esc(g ? g.en : '')}"></div></div>
      <div class="row2"><div class="field"><label for="fVar">${A ? 'النكهة (اختياري)' : 'Flavour (optional)'}</label><input class="inp" id="fVar" value="${esc(it ? it.ar || '' : '')}"></div>
        <div class="field"><label for="fVen">${A ? 'النكهة بالإنجليزي' : 'Flavour (English)'}</label><input class="inp" id="fVen" dir="ltr" value="${esc(it ? it.en || '' : '')}"></div></div>
      <div class="row2"><div class="field"><label for="fBox">${A ? 'سعر الصندوق (د.أ)' : 'Box price (JD)'}</label><input class="inp num" id="fBox" inputmode="decimal" value="${it ? jd(it.box) : ''}"></div>
        <div class="field"><label for="fUnits">${A ? 'عدد الحبات بالصندوق' : 'Pieces per box'}</label><input class="inp num" id="fUnits" inputmode="numeric" value="${it && it.units ? it.units : ''}"></div></div>
      <div class="row2"><div class="field"><label for="fSell">${A ? 'سعر بيع الحبة (د.أ)' : 'Selling price (JD)'}</label><input class="inp num" id="fSell" inputmode="decimal" value="${it && it.sell ? jd(it.sell) : ''}"></div>
        <div class="field"><label>${A ? 'الصورة' : 'Photo'}</label><div class="imgpick"><div class="thumb" id="fImgPrev">${it ? `<img src="${esc(it.img)}" alt="">` : ''}</div><label class="btn sm">${A ? 'اختار صورة' : 'Choose photo'}<input type="file" accept="image/*" id="fImg" class="sr"></label></div></div></div>
      <div class="err" id="fErr"></div>
      <div class="actions">${it ? `<button class="btn danger" data-act="delItem">${A ? 'حذف الصنف' : 'Delete'}</button>` : ''}<span class="grow"></span><button class="btn" data-act="closeModal">${esc(t('cancel'))}</button><button class="btn primary" data-act="saveItem">${A ? 'حفظ' : 'Save'}</button></div>
    </div></div>`);
}
function pickImage(file) {
  const r = new FileReader();
  r.onload = () => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, 240 / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
      S.modal.img = c.toDataURL('image/webp', 0.8);
      $('#fImgPrev').innerHTML = `<img src="${S.modal.img}" alt="">`;
    };
    img.src = r.result;
  };
  r.readAsDataURL(file);
}
async function saveItem() {
  const m = S.modal, A = S.lang === 'ar';
  const gsel = $('#fGroup').value, cat = $('#fCat').value, gar = $('#fGar').value.trim(), gen = $('#fGen').value.trim();
  const vAr = $('#fVar').value.trim(), vEn = $('#fVen').value.trim();
  const box = toFils($('#fBox').value || '0'), units = parseInt($('#fUnits').value, 10), sell = $('#fSell').value.trim() ? toFils($('#fSell').value) : null;
  if (!gar) { $('#fErr').textContent = A ? 'اكتب اسم الصنف' : 'Enter a name'; return; }
  if (box == null) { $('#fErr').textContent = A ? 'سعر الصندوق غلط' : 'Invalid box price'; return; }
  if (!m.img && !m.id) { m.img = 'icons/icon-192.png'; }
  let gid = gsel;
  if (gsel === '__new') { gid = 'g' + uid(); S.groups.push({ id: gid, ar: gar, en: gen, cat, order: S.groups.length }); }
  else { const g = S.groups.find((x) => x.id === gid); g.ar = gar; g.en = gen; g.cat = cat; }
  if (m.id) {
    const it = S.items[m.id];
    Object.assign(it, { groupId: gid, ar: vAr || null, en: vEn || null, box, units: isNaN(units) || units <= 0 ? null : units, sell, img: m.img || it.img });
  } else {
    const id = 'i' + uid();
    S.items[id] = { id, groupId: gid, ar: vAr || null, en: vEn || null, img: m.img, box, units: isNaN(units) || units <= 0 ? null : units, sell, stock: 0, off: false, sku: null, order: itemsOf(gid).length };
  }
  cleanupGroups();
  await saveCatalog();
  closeModal(); rerenderAdmin(); toast(A ? 'انحفظ' : 'Saved');
}
function cleanupGroups() { S.groups = S.groups.filter((g) => Object.values(S.items).some((i) => i.groupId === g.id)); }
async function delItem() {
  const m = S.modal, it = S.items[m.id];
  if (!confirm((S.lang === 'ar' ? 'حذف ' : 'Delete ') + itemName(it) + '؟')) return;
  delete S.items[m.id]; cleanupGroups(); await saveCatalog(); closeModal(); rerenderAdmin();
}

/* ---------- reports ---------- */
async function loadRange() {
  const sales = await DB.salesRange(S.admin.from, S.admin.to);
  sales.sort((a, b) => b.ts - a.ts);
  adminCache = { key: S.admin.from + S.admin.to + S.admin.tab, sales };
  rerenderAdmin();
}
function aggregate(sales) {
  const live = sales.filter((s) => !s.voided);
  const sold = live.filter((s) => s.type === 'sale'), hosp = live.filter((s) => s.type === 'hosp');
  const rev = sold.reduce((a, s) => a + s.total, 0), cogs = sold.reduce((a, s) => a + s.cost, 0);
  const hospSell = hosp.reduce((a, s) => a + s.total, 0), hospCost = hosp.reduce((a, s) => a + s.cost, 0);
  const byPay = { cash: 0, visa: 0, cliq: 0 }; sold.forEach((s) => { byPay[s.pay] = (byPay[s.pay] || 0) + s.total; });
  const byItem = {};
  sold.forEach((s) => s.lines.forEach((l) => { const k = l.id; const o = byItem[k] || (byItem[k] = { name: l.name, qty: 0, rev: 0, cost: 0 }); o.qty += l.qty; o.rev += lineNet(l); o.cost += (l.cost || 0) * l.qty; }));
  const byDay = {};
  live.forEach((s) => { const o = byDay[s.day] || (byDay[s.day] = { day: s.day, orders: 0, rev: 0, cost: 0, hospSell: 0, hospCost: 0, cash: 0, visa: 0, cliq: 0 }); if (s.type === 'sale') { o.orders++; o.rev += s.total; o.cost += s.cost; o[s.pay] += s.total; } else { o.hospSell += s.total; o.hospCost += s.cost; } });
  const disc = sold.reduce((a, s) => a + (s.disc || 0), 0), discN = sold.filter((s) => s.disc).length;
  return { sold, hosp, rev, cogs, hospSell, hospCost, profit: rev - cogs - hospCost, byPay, byItem, byDay, orders: sold.length, disc, discN };
}
function dateBar() {
  const A = S.lang === 'ar';
  return `<div class="datebar"><label class="sr" for="dFrom">from</label><input type="date" id="dFrom" value="${S.admin.from}" data-date="from"><span>${A ? 'إلى' : 'to'}</span><label class="sr" for="dTo">to</label><input type="date" id="dTo" value="${S.admin.to}" data-date="to">
    <button class="chip" data-act="range" data-id="today">${A ? 'اليوم' : 'Today'}</button><button class="chip" data-act="range" data-id="week">${A ? 'آخر 7 أيام' : 'Last 7 days'}</button><button class="chip" data-act="range" data-id="month">${A ? 'هالشهر' : 'This month'}</button></div>`;
}
function reportTab(kind) {
  const key = S.admin.from + S.admin.to + S.admin.tab;
  if (!adminCache || adminCache.key !== key) { loadRange(); return `<div class="empty">...</div>`; }
  const A = S.lang === 'ar', ag = aggregate(adminCache.sales);
  const rangeTxt = S.admin.from === S.admin.to ? S.admin.from : `${S.admin.from} → ${S.admin.to}`;
  const exportBtns = `<button class="btn primary" data-act="openSheet">${A ? 'افتح الشيت' : 'Open sheet'}</button><button class="btn dark" data-act="syncNow">${A ? 'رفع على الشيت' : 'Upload to sheet'}</button><button class="btn" data-act="excel">${A ? 'تنزيل Excel' : 'Download Excel'}</button>`;
  if (kind === 'eod') {
    const pays = ['cash', 'visa', 'cliq'], col = { cash: 'var(--acc)', visa: 'var(--ink)', cliq: '#7C7F88' };
    const bars = pays.map((p) => { const v = ag.byPay[p] || 0, pct = ag.rev ? Math.round((v / ag.rev) * 100) : 0; return `<div class="bar"><div class="t"><span>${esc(t(p))}</span><span class="num">${jd(v)} <small>· ${pct}%</small></span></div><div class="track"><div class="fill" style="width:${pct}%;background:${col[p]}"></div></div></div>`; }).join('');
    const top = Object.values(ag.byItem).sort((a, b) => b.qty - a.qty);
    const trs = top.map((o) => `<tr><td class="s">${esc(o.name)}</td><td class="num">${o.qty}</td><td class="num">${jd(o.rev)}</td><td class="num">${jd(o.cost)}</td><td class="num pos">${jd(o.rev - o.cost)}</td></tr>`).join('');
    return `<div class="ahead"><div><h1>End of Day</h1><p>${esc(rangeTxt)}</p></div><div class="actions">${exportBtns}</div></div>
      <div class="toolbar">${dateBar()}</div>
      <div class="kpis"><div class="kpi dark"><span>${A ? 'إجمالي المبيعات' : 'Total sales'}</span><b class="num">${jd(ag.rev)}</b><small>${ag.orders} ${A ? 'طلب' : 'orders'} · ${esc(t('jd'))}${ag.disc ? ` · ${A ? 'خصومات' : 'discounts'} -${jd(ag.disc)} (${ag.discN})` : ''}</small></div>
        <div class="kpi"><span>${A ? 'تكلفة اللي انباع' : 'Cost of goods'}</span><b class="num">${jd(ag.cogs)}</b><small>${esc(t('jd'))}</small></div>
        <div class="kpi"><span>${A ? 'الضيافة (بالتكلفة)' : 'Hospitality (cost)'}</span><b class="num neg">-${jd(ag.hospCost)}</b><small>${A ? 'بسعر البيع' : 'at price'}: -${jd(ag.hospSell)}</small></div>
        <div class="kpi"><span>${A ? 'صافي الربح' : 'Net profit'}</span><b class="num ${ag.profit >= 0 ? 'pos' : 'neg'}">${jd(ag.profit)}</b><small>${esc(t('jd'))}</small></div></div>
      <div class="cols"><div class="card"><h2>${A ? 'حسب طريقة الدفع' : 'By payment'}</h2><div class="bars">${bars}</div><div class="drawer"><span>${A ? 'لازم يكون بالدرج كاش' : 'Cash expected in drawer'}</span><span class="num">${jd(ag.byPay.cash || 0)} ${esc(t('jd'))}</span></div></div>
        <div class="card"><h2>${A ? 'الأصناف المباعة' : 'Items sold'}</h2><div class="scroll" style="max-height:360px"><table class="tbl"><thead><tr><th class="s">${A ? 'الصنف' : 'Item'}</th><th>${A ? 'الكمية' : 'Qty'}</th><th>${A ? 'الإيراد' : 'Revenue'}</th><th>${A ? 'التكلفة' : 'Cost'}</th><th>${A ? 'الربح' : 'Profit'}</th></tr></thead><tbody>${trs || `<tr><td colspan="5" style="height:80px;color:var(--muted)">${A ? 'ما في مبيعات' : 'No sales'}</td></tr>`}</tbody></table></div></div></div>`;
  }
  if (kind === 'hosp') {
    const rows = ag.hosp.flatMap((s) => s.lines.map((l) => `<tr><td class="num">${s.day} ${timeOf(s.ts)}</td><td class="s">${esc(l.name)}${s.by ? ` <small style="color:var(--muted)">· ${esc(adminName(s.by))}</small>` : ''}</td><td class="num">${l.qty}</td><td class="num neg">-${jd(l.price * l.qty)}</td><td class="num">${jd((l.cost || 0) * l.qty)}</td></tr>`)).join('');
    return `<div class="ahead"><div><h1>${esc(t('tHosp'))}</h1><p>${A ? 'بتنحسب تكلفة بدون إيراد، وبتطلع بالإكسل بالسالب' : 'Counted as cost with no revenue; negative in Excel'}</p></div><div class="actions">${exportBtns}</div></div>
      <div class="toolbar">${dateBar()}</div>
      <div class="card"><table class="tbl"><thead><tr><th>${A ? 'الوقت' : 'Time'}</th><th class="s">${A ? 'الصنف' : 'Item'}</th><th>${A ? 'الكمية' : 'Qty'}</th><th>${A ? 'بسعر البيع' : 'At price'}</th><th>${A ? 'التكلفة' : 'Cost'}</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="5" style="height:80px;color:var(--muted)">${A ? 'ما في ضيافة' : 'None'}</td></tr>`}<tr><td></td><td class="s"><b>${A ? 'المجموع' : 'Total'}</b></td><td></td><td class="num neg">-${jd(ag.hospSell)}</td><td class="num">${jd(ag.hospCost)}</td></tr></tbody></table></div>`;
  }
  const rows = adminCache.sales.map((s) => `<tr class="${s.voided ? 'voided' : ''}"><td class="num">#${s.no}</td><td class="num">${s.day} ${timeOf(s.ts)}</td><td class="s">${esc(s.lines.map((l) => `${l.name} ×${l.qty}`).join('، '))}</td>
    <td>${s.type === 'hosp' ? `<span class="tag h">${esc(t('hosp'))}${s.by ? ' · ' + esc(adminName(s.by)) : ''}</span>` : `<span class="tag">${esc(t(s.pay))}</span>`}${s.disc ? ` <span class="tag d">${esc(t('disc'))} ${s.discPct}% · ${esc(adminName(s.by))}</span>` : ''}</td><td class="num ${s.type === 'hosp' ? 'neg' : ''}">${s.type === 'hosp' ? '-' : ''}${jd(s.total)}</td>
    <td>${s.voided ? (A ? 'ملغي' : 'Void') : `<button class="btn sm danger" data-act="void" data-id="${s.id}">${A ? 'إلغاء' : 'Void'}</button>`}</td></tr>`).join('');
  return `<div class="ahead"><div><h1>${esc(t('tSales'))}</h1><p>${A ? 'إلغاء أي طلب بيرجّع الكمية للمخزون وبيشيله من الحسابات' : 'Voiding returns the stock and removes it from totals'}</p></div><div class="actions">${exportBtns}</div></div>
    <div class="toolbar">${dateBar()}</div>
    <div class="card"><table class="tbl"><thead><tr><th>#</th><th>${A ? 'الوقت' : 'Time'}</th><th class="s">${A ? 'الأصناف' : 'Items'}</th><th>${A ? 'النوع' : 'Type'}</th><th>${A ? 'المبلغ' : 'Amount'}</th><th></th></tr></thead><tbody>${rows || `<tr><td colspan="6" style="height:80px;color:var(--muted)">${A ? 'ما في طلبات' : 'No orders'}</td></tr>`}</tbody></table></div>`;
}
async function voidSale(id) {
  const A = S.lang === 'ar';
  const sale = adminCache.sales.find((s) => s.id === id);
  if (!sale || sale.voided || !confirm(A ? `إلغاء الطلب #${sale.no}؟ الكمية بترجع للمخزون.` : `Void order #${sale.no}?`)) return;
  const items = JSON.parse(JSON.stringify(S.items));
  sale.lines.forEach((l) => { if (items[l.id]) items[l.id].stock += l.qty; });
  const upd = Object.assign({}, sale, { voided: true, voidedAt: Date.now(), syncedFlag: 0 });
  await DB.tx(['kv', 'sales'], 'readwrite', (tx) => { tx.objectStore('kv').put({ cats: S.cats, groups: S.groups, items, seedVersion: SEED.version }, 'catalog'); tx.objectStore('sales').put(upd); });
  S.items = items; Object.assign(sale, upd); S.pending++;
  rerenderAdmin(); toast(A ? 'انلغى الطلب' : 'Order voided'); syncSoon();
}
function setRange(id) {
  const d = new Date();
  if (id === 'today') { S.admin.from = S.admin.to = dayOf(); }
  if (id === 'week') { S.admin.to = dayOf(); d.setDate(d.getDate() - 6); S.admin.from = dayOf(d); }
  if (id === 'month') { S.admin.to = dayOf(); S.admin.from = dayOf(new Date(d.getFullYear(), d.getMonth(), 1)); }
  adminCache = null; rerenderAdmin();
}

/* ---------- Excel ---------- */
function loadScript(src) { return new Promise((res, rej) => { if (window.XLSX) return res(); const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('load')); document.head.appendChild(s); }); }
async function exportExcel() {
  await loadScript('vendor/xlsx-style.js');
  const sales = (await DB.salesRange(S.admin.from, S.admin.to)).filter((s) => !s.voided).sort((a, b) => a.ts - b.ts);
  const ag = aggregate(sales);
  const r3 = (f) => Math.round(f) / 1000;
  const payName = { cash: 'كاش', visa: 'فيزا', cliq: 'كليك' };
  const period = S.admin.from === S.admin.to ? S.admin.from : `${S.admin.from} إلى ${S.admin.to}`;

  /* look: every value in its own bordered cell, 18pt bold, right-to-left */
  const B = { style: 'thin', color: { rgb: 'B9B5AC' } };
  const BORDER = { top: B, bottom: B, left: B, right: B };
  const AL = { horizontal: 'center', vertical: 'center', wrapText: true, readingOrder: 2 };
  const ST = {
    title: { font: { name: 'Arial', sz: 22, bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: 'C2410C' } }, alignment: AL, border: BORDER },
    sub: { font: { name: 'Arial', sz: 16, bold: true, color: { rgb: '5F6168' } }, alignment: AL },
    head: { font: { name: 'Arial', sz: 18, bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '17181C' } }, alignment: AL, border: BORDER },
    cell: { font: { name: 'Arial', sz: 18, bold: true, color: { rgb: '17181C' } }, alignment: AL, border: BORDER },
    zebra: { font: { name: 'Arial', sz: 18, bold: true, color: { rgb: '17181C' } }, fill: { fgColor: { rgb: 'F4F3F0' } }, alignment: AL, border: BORDER },
    total: { font: { name: 'Arial', sz: 18, bold: true, color: { rgb: '8A2E07' } }, fill: { fgColor: { rgb: 'FFF1E8' } }, alignment: AL, border: BORDER },
  };
  const wb = XLSX.utils.book_new();
  /* sheet = list of blocks; each block: {title, head, rows, money:[col idx], total:[row] } */
  function sheet(name, blocks, widths) {
    const ws = {}, merges = [], rowsH = [];
    const ncol = widths.length;
    let r = 0;
    const put = (c, v, s, fmt) => {
      const ref = XLSX.utils.encode_cell({ r, c });
      const cell = v === '' || v == null ? { t: 's', v: '' } : typeof v === 'number' ? { t: 'n', v } : { t: 's', v: String(v) };
      const st = JSON.parse(JSON.stringify(s));
      if (cell.t === 'n') { const f = fmt || '0'; cell.z = f; st.numFmt = f; }
      cell.s = st; ws[ref] = cell;
    };
    const fullRow = (text, s, h, w = ncol) => { for (let c = 0; c < w; c++) put(c, c === 0 ? text : '', s); if (w > 1) merges.push({ s: { r, c: 0 }, e: { r, c: w - 1 } }); rowsH[r] = { hpt: h }; r++; };
    fullRow(name, ST.title, 40);
    fullRow('الفترة: ' + period, ST.sub, 30);
    r++;
    blocks.forEach((b, bi) => {
      if (bi > 0) r++;
      const w = b.head.filter((h) => h !== '').length;
      const fmtOf = (c, i) => ((b.money || []).includes(c) && !(b.intRows || []).includes(i) ? '0.000' : '0');
      if (b.title) fullRow(b.title, ST.head, 34, w);
      b.head.slice(0, w).forEach((h, c) => put(c, h, ST.head)); rowsH[r] = { hpt: 32 }; r++;
      if (!b.rows.length) { fullRow('لا يوجد بيانات', ST.cell, 30, w); }
      b.rows.forEach((row, i) => {
        row.slice(0, w).forEach((v, c) => put(c, v, i % 2 ? ST.zebra : ST.cell, fmtOf(c, i)));
        rowsH[r] = { hpt: 30 }; r++;
      });
      if (b.total) { b.total.slice(0, w).forEach((v, c) => put(c, v, ST.total, fmtOf(c, -1))); rowsH[r] = { hpt: 32 }; r++; }
    });
    ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: r - 1, c: ncol - 1 } });
    ws['!merges'] = merges; ws['!rows'] = rowsH; ws['!cols'] = widths.map((w) => ({ wch: w }));
    ws['!views'] = [{ RTL: true }];
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
  const sum = (rows, c) => rows.reduce((a, x) => a + (typeof x[c] === 'number' ? x[c] : 0), 0);

  /* 1. summary */
  const top = Object.values(ag.byItem).sort((a, b) => b.qty - a.qty).slice(0, 10).map((o) => [o.name, o.qty, r3(o.rev), r3(o.rev - o.cost)]);
  const payRows = ['cash', 'visa', 'cliq'].map((p) => { const v = ag.byPay[p] || 0; return [payName[p], r3(v), ag.rev ? Math.round((v / ag.rev) * 100) + '%' : '0%', '']; });
  sheet('الملخص العام', [
    { title: 'الأرقام الرئيسية', head: ['البند', 'القيمة (د.أ)', '', ''], money: [1], intRows: [0], rows: [
      ['عدد الطلبات', ag.orders, '', ''], ['إجمالي المبيعات (بعد الخصم)', r3(ag.rev), '', ''], ['الخصومات', -r3(ag.disc), '', ''], ['تكلفة اللي انباع', r3(ag.cogs), '', ''],
      ['الضيافة بسعر البيع', -r3(ag.hospSell), '', ''], ['الضيافة بالتكلفة', -r3(ag.hospCost), '', '']], total: ['صافي الربح', r3(ag.profit), '', ''] },
    { title: 'حسب طريقة الدفع', head: ['طريقة الدفع', 'المبلغ (د.أ)', 'النسبة', ''], money: [1], rows: payRows, total: ['المجموع', r3(ag.rev), '100%', ''] },
    { title: 'الأكثر مبيعاً', head: ['الصنف', 'الكمية', 'الإيراد (د.أ)', 'الربح (د.أ)'], money: [2, 3], rows: top },
  ], [36, 24, 22, 22]);

  /* 2. detailed sales */
  const det = [];
  sales.forEach((s) => s.lines.forEach((l) => {
    const h = s.type === 'hosp', gross = l.price * l.qty, tot = h ? gross : lineNet(l), c = (l.cost || 0) * l.qty;
    det.push([s.day, timeOf(s.ts), s.no, l.nameAr || l.name, l.qty, r3(l.price), s.disc ? -r3(gross - tot) : '', h ? -r3(tot) : r3(tot), h ? 'ضيافة' : 'بيع', h ? '' : payName[s.pay], l.cost == null ? '' : r3(l.cost), r3(c), h ? -r3(c) : r3(tot - c), s.by || '']);
  }));
  sheet('المبيعات التفصيلية', [{ head: ['التاريخ', 'الوقت', 'رقم الطلب', 'الصنف', 'الكمية', 'سعر الحبة', 'الخصم', 'المجموع', 'النوع', 'طريقة الدفع', 'تكلفة الحبة', 'التكلفة', 'الربح', 'الأدمن'],
    money: [5, 6, 7, 10, 11, 12], rows: det, total: ['المجموع', '', '', '', sum(det, 4), '', r3(Math.round(sum(det, 6) * 1000)), r3(Math.round(sum(det, 7) * 1000)), '', '', '', r3(Math.round(sum(det, 11) * 1000)), r3(Math.round(sum(det, 12) * 1000)), ''] }],
  [18, 12, 14, 40, 12, 16, 14, 16, 14, 16, 16, 16, 16, 14]);

  /* 3. items */
  const items = Object.values(ag.byItem).sort((a, b) => b.rev - a.rev).map((o) => [o.name, o.qty, r3(o.rev), r3(o.cost), r3(o.rev - o.cost)]);
  sheet('ملخص الأصناف', [{ head: ['الصنف', 'الكمية المباعة', 'الإيراد (د.أ)', 'التكلفة (د.أ)', 'الربح (د.أ)'], money: [2, 3, 4], rows: items,
    total: ['المجموع', sum(items, 1), r3(ag.rev), r3(ag.cogs), r3(ag.rev - ag.cogs)] }], [40, 20, 20, 20, 20]);

  /* 4. daily */
  const days = Object.values(ag.byDay).sort((a, b) => a.day.localeCompare(b.day)).map((d) => [d.day, d.orders, r3(d.rev), r3(d.cash), r3(d.visa), r3(d.cliq), r3(d.cost), -r3(d.hospCost), r3(d.rev - d.cost - d.hospCost)]);
  sheet('الملخص اليومي', [{ head: ['اليوم', 'الطلبات', 'المبيعات', 'كاش', 'فيزا', 'كليك', 'التكلفة', 'الضيافة (تكلفة)', 'صافي الربح'], money: [2, 3, 4, 5, 6, 7, 8], rows: days,
    total: ['المجموع', ag.orders, r3(ag.rev), r3(ag.byPay.cash || 0), r3(ag.byPay.visa || 0), r3(ag.byPay.cliq || 0), r3(ag.cogs), -r3(ag.hospCost), r3(ag.profit)] }],
  [18, 14, 18, 16, 16, 16, 18, 20, 18]);

  /* 5. hospitality */
  const hosp = [];
  ag.hosp.forEach((s) => s.lines.forEach((l) => hosp.push([s.day, timeOf(s.ts), l.nameAr || l.name, l.qty, -r3(l.price * l.qty), 'ضيافة', r3((l.cost || 0) * l.qty), s.by || ''])));
  sheet('الضيافة', [{ head: ['التاريخ', 'الوقت', 'الصنف', 'الكمية', 'بسعر البيع (د.أ)', 'ملاحظة', 'التكلفة (د.أ)', 'الأدمن'], money: [4, 6], rows: hosp,
    total: ['المجموع', '', '', sum(hosp, 3), -r3(ag.hospSell), '', r3(ag.hospCost), ''] }], [18, 12, 40, 12, 22, 14, 20, 14]);

  /* 6. stock */
  const stock = [];
  S.groups.slice().sort((a, b) => a.order - b.order).forEach((g) => itemsOf(g.id).forEach((it) => {
    const c = unitCost(it), cat = S.cats.find((x) => x.id === g.cat);
    stock.push([it.ar ? `${g.ar} - ${it.ar}` : g.ar, cat ? cat.ar : '', isAvail(it) ? 'ON' : 'OFF', it.stock, it.units ? Math.floor(it.stock / it.units) : '', it.units ? it.stock % it.units : '', it.units || '', r3(it.box), c == null ? '' : r3(c), it.sell ? r3(it.sell) : '', it.sell && c != null ? r3(it.sell - c) : '']);
  }));
  sheet('المخزون', [{ head: ['الصنف', 'التصنيف', 'الحالة', 'المخزون (حبة)', 'صناديق', 'حبات', 'حبات بالصندوق', 'سعر الصندوق', 'تكلفة الحبة', 'سعر البيع', 'ربح الحبة'], money: [7, 8, 9, 10], rows: stock }],
  [40, 22, 12, 18, 12, 12, 18, 18, 18, 16, 16]);

  wb.Workbook = { Views: [{ RTL: true }] };
  XLSX.writeFile(wb, `مبيعات-${S.admin.from}${S.admin.from === S.admin.to ? '' : '_' + S.admin.to}.xlsx`);
  toast(S.lang === 'ar' ? 'تنزّل ملف Excel' : 'Excel downloaded');
}

/* ---------- Google Sheet sync (only part that needs internet; waits quietly) ---------- */
let syncing = false, syncTimer;
function syncSoon(ms = 1500) { clearTimeout(syncTimer); syncTimer = setTimeout(syncNow, ms); }
/* the sheet shows each line at its price after discount, and who gave a discount or hospitality */
function forSheet(s) {
  if (!s.disc && !s.by) return s;
  const tag = s.disc ? ` (خصم ${s.discPct}% · ${s.by})` : ` (${s.by})`;
  return Object.assign({}, s, { lines: s.lines.map((l) => Object.assign({}, l, { nameAr: (l.nameAr || l.name) + tag, price: s.disc ? lineNet(l) / l.qty : l.price })) });
}
async function syncNow(manual) {
  if (syncing) return;
  if (!S.settings.sheetUrl) { if (manual) toast(S.lang === 'ar' ? 'الشيت مش مربوط · اربطه من الإعدادات' : 'Link the sheet in Settings', true); return; }
  if (!navigator.onLine) { if (manual) toast(S.lang === 'ar' ? 'ما في إنترنت · بيترفع لحاله لما يرجع' : 'Offline · will upload when online', true); return; }
  const batch = (await DB.unsynced()).sort((a, b) => a.ts - b.ts).slice(0, 200);
  const reset = !!S.settings.pendingReset;
  /* the item list goes up too whenever it changed (new items, stock, ON/OFF, names), even with no new sale */
  const stock = S.groups.slice().sort((a, b) => a.order - b.order).flatMap((g) => itemsOf(g.id).map((it) => ({ name: it.ar ? `${g.ar} - ${it.ar}` : g.ar, stock: it.stock, units: it.units || '', on: isAvail(it) ? 'ON' : 'OFF' })));
  const sig = await sha(JSON.stringify(stock));
  if (!manual && !batch.length && !reset && sig === S.settings.stockSig) { S.pending = 0; refreshHeader(); if (manual) toast(t('sheetOk')); return; }
  syncing = true;
  try {
    const res = await fetch(S.settings.sheetUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ key: S.settings.sheetKey || '', reset, sales: batch.map(forSheet), stock }) });
    const out = await res.json();
    if (!out.ok) throw new Error(out.error || 'sheet');
    if (out.url && out.url !== S.settings.sheetView) { S.settings.sheetView = out.url; }
    await DB.tx(['sales'], 'readwrite', (tx) => { const st = tx.objectStore('sales'); batch.forEach((s) => st.put(Object.assign({}, s, { syncedFlag: 1 }))); });
    if (reset) { if (!out.reset) throw new Error(S.lang === 'ar' ? 'حدّث كود الشيت ليقدر يمسح' : 'update the sheet script to allow clearing'); S.settings.pendingReset = false; if (manual) toast(S.lang === 'ar' ? 'انمسح الشيت كمان' : 'Sheet cleared too'); }
    S.settings.stockSig = sig; S.settings.lastSync = Date.now(); await saveSettings();
    S.pending = (await DB.unsynced()).length;
    if (manual) toast(S.lang === 'ar' ? 'انرفع على الشيت' : 'Uploaded');
    if (S.pending) syncSoon(500);
  } catch (e) {
    if (manual) toast((S.lang === 'ar' ? 'ما زبط الرفع، بنحاول بعدين: ' : 'Upload failed, will retry: ') + e.message, true);
  } finally { syncing = false; refreshHeader(); }
}
const DEFAULT_SHEET_VIEW = 'https://docs.google.com/spreadsheets/d/13u_SyXFSbmTGcsq9Vus5iYVEGtCP2aL0zLF2Up1vZyw/edit';
function sheetViewUrl() { return S.settings.sheetView || DEFAULT_SHEET_VIEW; }
function openSheet() {
  if (!navigator.onLine) { toast(S.lang === 'ar' ? 'لازم إنترنت لفتح الشيت' : 'Internet needed to open the sheet', true); return; }
  if (S.pending && S.settings.sheetUrl) syncNow();
  window.open(sheetViewUrl(), '_blank', 'noopener');
}
function refreshHeader() { const h = $('header.top'); if (h) h.outerHTML = header(); }

/* ---------- settings & backup ---------- */
function settingsTab() {
  const A = S.lang === 'ar';
  const last = S.settings.lastSync ? new Date(S.settings.lastSync).toLocaleString('en-GB') : (A ? 'ولا مرة' : 'never');
  let storage = '';
  return `<div class="ahead"><div><h1>${esc(t('tSettings'))}</h1></div></div>
  <div class="setgrid">
    <div class="setcard"><h3>${A ? 'ربط Google Sheet' : 'Google Sheet link'}</h3>
      <p>${A ? 'بعد ما تعمل الشيت حسب التعليمات، الصق الرابط هون. المبيعات بتترفع لحالها أول ما يكون في إنترنت، وإذا ما في بتستنى.' : 'Paste the web-app link. Sales upload automatically whenever there is internet.'}</p>
      <div class="field"><label for="sUrl">${A ? 'رابط الشيت (Web app URL)' : 'Web app URL'}</label><input class="inp" id="sUrl" dir="ltr" value="${esc(S.settings.sheetUrl || '')}" placeholder="https://script.google.com/macros/s/.../exec"></div>
      <div class="field"><label for="sKey">${A ? 'الرمز السري للشيت' : 'Sheet secret'}</label><input class="inp" id="sKey" dir="ltr" value="${esc(S.settings.sheetKey || '')}"></div>
      <div class="field"><label for="sView">${A ? 'رابط فتح الشيت (docs.google.com)' : 'Sheet link to open (docs.google.com)'}</label><input class="inp" id="sView" dir="ltr" value="${esc(sheetViewUrl())}" placeholder="https://docs.google.com/spreadsheets/d/.../edit"></div>
      <p>${A ? 'آخر رفع' : 'Last upload'}: ${esc(last)} · ${A ? 'بالانتظار' : 'pending'}: ${S.pending}</p>
      <div class="actions"><button class="btn primary" data-act="saveSheet" style="flex:1">${A ? 'حفظ' : 'Save'}</button><button class="btn dark" data-act="syncNow" style="flex:1">${A ? 'ارفع هلأ' : 'Upload now'}</button></div></div>
${ADMINS.map((d) => `    <div class="setcard"><h3>${A ? 'كلمة سر' : 'Password'} · ${esc(L(d.ar, d.en))}</h3><p>${A ? `أرقام بس، من 4 لـ 8. بتفتح الـ Admin والضيافة والخصم، وبيتسجل اسم ${d.ar} بالإكسل.` : 'Digits only, 4 to 8. Opens Admin, hospitality and the discount.'}</p>
      <div class="field"><label for="pNew-${d.id}">${A ? 'كلمة السر الجديدة' : 'New password'}</label><input class="inp c num" id="pNew-${d.id}" type="password" inputmode="numeric" maxlength="8"></div>
      <div class="field"><label for="pNew2-${d.id}">${A ? 'أعد كتابتها' : 'Repeat it'}</label><input class="inp c num" id="pNew2-${d.id}" type="password" inputmode="numeric" maxlength="8"></div>
      <button class="btn primary" data-act="savePin" data-id="${d.id}">${A ? `غيّر كلمة سر ${d.ar}` : `Change ${d.en}'s password`}</button></div>
`).join('')}    <div class="setcard"><h3>${A ? 'صوت إتمام البيع' : 'Checkout sound'}</h3><p>${A ? 'صوت "كا-تشينغ" بيطلع مع كل بيعة. بيشتغل بدون نت.' : 'A cha-ching plays after every sale. Works offline.'}</p>
      <div class="actions"><button class="btn ${S.settings.sound === false ? '' : 'primary'}" data-act="toggleSound" style="flex:1">${S.settings.sound === false ? (A ? 'الصوت: OFF' : 'Sound: OFF') : (A ? 'الصوت: ON' : 'Sound: ON')}</button><button class="btn dark" data-act="testSound" style="flex:1">${A ? 'جرّب الصوت' : 'Play it'}</button></div></div>
    <div class="setcard"><h3>${A ? 'تنبيه المخزون' : 'Low stock alert'}</h3><p>${A ? 'النظام بينبهك لما يضل من الصنف هالعدد من الكراتين أو أقل: بعد البيعة مباشرة، وبرقم أحمر على زر Admin، وبفلتر "قربت تخلص".' : 'Alert when this many boxes or fewer are left.'}</p>
      <div class="field"><label for="lowB">${A ? 'نبّهني لما يضل (كرتونة)' : 'Alert at (boxes)'}</label><input class="inp c num" id="lowB" type="number" inputmode="numeric" min="1" max="20" value="${lowBoxes()}"></div>
      <button class="btn primary" data-act="saveLow">${A ? 'حفظ' : 'Save'}</button></div>
    <div class="setcard"><h3>${A ? 'نسخة احتياطية' : 'Backup'}</h3><p>${A ? 'نزّل ملف فيه كل شي: الأصناف والأسعار والمخزون وكل المبيعات. احفظه بمكان ثاني، وبترجّعه على أي جهاز.' : 'Download a file with everything. Restore it on any device.'}</p>
      <div class="actions"><button class="btn dark" data-act="backup" style="flex:1">${A ? 'نزّل نسخة' : 'Download backup'}</button><label class="btn" style="flex:1">${A ? 'استرجاع نسخة' : 'Restore'}<input type="file" accept=".json,application/json" id="restoreIn" class="sr"></label></div></div>
    <div class="setcard"><h3>${A ? 'بداية جديدة' : 'Fresh start'}</h3><p>${A ? 'بيمسح كل المبيعات والضيافة وسجل الجرد، وبيصفّر المخزون. الأصناف والأسعار والصور وعدد الحبات بيضلوا زي ما هم. استخدمه بعد التجربة وقبل أول يوم شغل.' : 'Deletes all sales, hospitality and stock history, and sets stock to zero. Items, prices and photos stay.'}</p>
      <button class="btn danger" data-act="freshStart">${ICON.lock}<span>${A ? 'امسح بيانات التجربة' : 'Delete test data'}</span></button></div>
    <div class="setcard"><h3>${A ? 'التخزين على التابلت' : 'Storage on this tablet'}</h3><p id="storageInfo">${storage}</p>
      <p>${A ? 'كل شي محفوظ على التابلت نفسه، والنظام بيشتغل بدون إنترنت. لا تمسح بيانات Chrome، ونزّل نسخة احتياطية كل أسبوع.' : 'Everything is stored on this tablet. Do not clear Chrome data; download a backup weekly.'}</p></div>
  </div>`;
}
async function fillStorageInfo() {
  const el = $('#storageInfo'); if (!el) return;
  const A = S.lang === 'ar';
  let persisted = false; try { persisted = navigator.storage && (await navigator.storage.persisted()); } catch (e) { /* */ }
  const all = await DB.allSales();
  el.textContent = `${A ? 'عدد العمليات المحفوظة' : 'Saved orders'}: ${all.length} · ${A ? 'حماية من المسح' : 'Protected storage'}: ${persisted ? (A ? 'مفعّلة' : 'on') : (A ? 'مش مفعّلة (ثبّت التطبيق على الشاشة)' : 'off (install the app)')}`;
}
async function backup() {
  const data = { app: 'cafeteria-pos', at: new Date().toISOString(), catalog: catalogDoc(), settings: Object.assign({}, S.settings, { pin: undefined }), sales: await DB.allSales(), stocklog: (await DB.get('stocklog')) || [] };
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `نسخة-احتياطية-${dayOf()}.json`; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  S.settings.lastBackup = Date.now(); saveSettings();
}
async function freshStart() {
  const A = S.lang === 'ar';
  const n = (await DB.allSales()).length;
  if (!confirm(A ? `رح ينمسح ${n} عملية بيع وضيافة من النظام ومن الـ Google Sheet، والمخزون بيصير صفر. الأصناف والأسعار بيضلوا. متأكد؟` : `Delete ${n} orders here and in the Google Sheet, and set stock to zero?`)) return;
  const items = JSON.parse(JSON.stringify(S.items));
  Object.values(items).forEach((it) => { it.stock = 0; it.off = false; });
  await DB.tx(['kv', 'sales'], 'readwrite', (tx) => { tx.objectStore('sales').clear(); tx.objectStore('kv').put([], 'stocklog'); tx.objectStore('kv').put({ cats: S.cats, groups: S.groups, items, seedVersion: SEED.version }, 'catalog'); });
  S.items = items; S.dayCount = 0; S.pending = 0; S.cart = []; adminCache = null;
  delete S.settings.lastSync; S.settings.pendingReset = !!S.settings.sheetUrl; await saveSettings();
  render(); toast(A ? 'صار النظام نظيف · بداية جديدة' : 'Clean start');
  if (S.settings.pendingReset) syncNow(true);
}
async function restore(file) {
  const A = S.lang === 'ar';
  try {
    const data = JSON.parse(await file.text());
    if (data.app !== 'cafeteria-pos' || !data.catalog || !Array.isArray(data.sales)) throw new Error('file');
    if (!confirm(A ? `استرجاع النسخة؟ فيها ${data.sales.length} عملية. البيانات الحالية بتنستبدل.` : 'Restore? Current data will be replaced.')) return;
    await DB.tx(['kv', 'sales'], 'readwrite', (tx) => { tx.objectStore('kv').put(data.catalog, 'catalog'); tx.objectStore('kv').put(data.stocklog || [], 'stocklog'); const st = tx.objectStore('sales'); st.clear(); data.sales.forEach((s) => st.put(s)); });
    location.reload();
  } catch (e) { toast(A ? 'الملف مش نسخة احتياطية صحيحة' : 'Not a valid backup file', true); }
}

/* ---------- events ---------- */
document.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const a = el.dataset.act, id = el.dataset.id;
  if (a === 'overlay') { if (e.target === el && S.modal?.kind !== 'pin') closeModal(); return; }
  switch (a) {
    case 'cat': S.cat = id; render(); $('#gridArea')?.scrollTo(0, 0); break;
    case 'clearQ': S.q = ''; render(); break;
    case 'tile': { const its = itemsOf(id); if (its.length === 1) addToCart(its[0].id); else flavorSheet(id); break; }
    case 'addItem': addToCart(id); break;
    case 'closeModal': closeModal(); break;
    case 'inc': { const l = S.cart[+el.dataset.i]; const it = S.items[l.id]; if (l.qty >= it.stock) { toast(S.lang === 'ar' ? `ما ضل غير ${it.stock}` : `Only ${it.stock} left`, true); break; } l.qty++; S.given = null; rerenderCart(); break; }
    case 'dec': { const i = +el.dataset.i; if (S.cart[i].qty > 1) S.cart[i].qty--; else S.cart.splice(i, 1); S.given = null; rerenderCart(); break; }
    case 'clearCart': S.cart = []; S.given = null; S.disc = null; rerenderCart(); break;
    case 'pay': S.pay = id; S.given = null; rerenderCart(); break;
    case 'given': S.given = +el.dataset.v; rerenderCart(); break;
    case 'checkout':
      if (S.pay === 'cash' && S.given != null && S.given < cartTotal()) { toast(t('lessThan'), true); break; }
      saveSale('sale'); break;
    case 'hosp': askPin(t('pinHosp'), (who) => saveSale('hosp', who)); break;
    case 'disc': if (S.cart.length && !S.disc) askPin(t('pinDisc'), (who) => { S.disc = { pct: DISC_PCT, by: who }; S.given = null; rerenderCart(); }); break;
    case 'rmDisc': S.disc = null; S.given = null; rerenderCart(); break;
    case 'pin': pinKey(el.dataset.k); break;
    case 'theme': S.settings.theme = S.settings.theme === 'dark' ? 'light' : 'dark'; saveSettings(); render(); if (S.admin.tab === 'settings' && S.view === 'admin') fillStorageInfo(); break;
    case 'lang': S.lang = S.lang === 'ar' ? 'en' : 'ar'; S.settings.lang = S.lang; saveSettings(); render(); break;
    case 'openAdmin': askPin(t('pinAdmin'), () => { S.view = 'admin'; adminCache = null; render(); }); break;
    case 'closeAdmin': S.view = 'sell'; render(); break;
    case 'syncNow': syncNow(true); break;
    case 'tab': S.admin.tab = id; adminCache = null; render(); if (id === 'settings') fillStorageInfo(); break;
    case 'acat': S.admin.cat = id; rerenderAdmin(); break;
    case 'toggle': {
      const it = S.items[id];
      if (it.stock <= 0) { toast(S.lang === 'ar' ? 'المخزون صفر · ضيف كمية ليصير ON' : 'Stock is zero · add stock first', true); break; }
      if (!(it.sell > 0)) { toast(S.lang === 'ar' ? 'حط سعر بيع أول' : 'Set a price first', true); break; }
      it.off = !it.off; await saveCatalog(); rerenderAdmin(); break;
    }
    case 'stock': stockModal(id, el.dataset.mode); break;
    case 'qset': $('#qtyIn').value = el.dataset.v; break;
    case 'stockOk': stockOk(); break;
    case 'newItem': itemModal(null); break;
    case 'editItem': itemModal(id); break;
    case 'saveItem': saveItem(); break;
    case 'delItem': delItem(); break;
    case 'range': setRange(id); break;
    case 'void': voidSale(id); break;
    case 'excel': try { await exportExcel(); } catch (err) { toast('Excel: ' + err.message, true); } break;
    case 'openSheet': openSheet(); break;
    case 'toggleSound': S.settings.sound = S.settings.sound === false; await saveSettings(); render(); if (S.settings.sound) playCash(); break;
    case 'testSound': playCash(true); break;
    case 'saveSheet': S.settings.sheetUrl = $('#sUrl').value.trim(); S.settings.sheetKey = $('#sKey').value.trim(); S.settings.sheetView = $('#sView').value.trim(); await saveSettings(); toast(S.lang === 'ar' ? 'انحفظ' : 'Saved'); refreshHeader(); syncSoon(300); break;
    case 'savePin': {
      const id = el.dataset.id, who = ADMINS.find((d) => d.id === id), other = ADMINS.find((d) => d.id !== id);
      const a1 = $('#pNew-' + id).value, a2 = $('#pNew2-' + id).value;
      if (!/^\d{4,8}$/.test(a1)) { toast(S.lang === 'ar' ? 'لازم 4 لـ 8 أرقام' : '4 to 8 digits', true); break; }
      if (a1 !== a2) { toast(S.lang === 'ar' ? 'الكلمتين مش متطابقات' : 'They do not match', true); break; }
      if (a1 === '0000') { toast(S.lang === 'ar' ? '0000 محجوزة لكبسة المسح، اختار غيرها' : '0000 is reserved, pick another', true); break; }
      const h = await sha(a1);
      if (other && S.settings.pins[other.id] === h) { toast(S.lang === 'ar' ? `هاي كلمة سر ${other.ar}، اختار وحدة مختلفة` : 'That is the other admin\'s password', true); break; }
      S.settings.pins[id] = h; await saveSettings(); $('#pNew-' + id).value = $('#pNew2-' + id).value = ''; toast(S.lang === 'ar' ? `تغيّرت كلمة سر ${who.ar}` : 'Password changed'); break;
    }
    case 'backup': backup(); break;
    case 'saveLow': { const n = parseInt($('#lowB').value, 10); if (!(n >= 1 && n <= 20)) { toast(S.lang === 'ar' ? 'رقم من 1 لـ 20' : '1 to 20', true); break; } S.settings.lowBoxes = n; await saveSettings(); refreshHeader(); toast(S.lang === 'ar' ? `انحفظ: التنبيه لما يضل ${n} كرتونة` : 'Saved'); break; }
    case 'freshStart': askPin(S.lang === 'ar' ? 'لحماية البيانات من المسح بالغلط' : 'Protects your data from accidental deletion', freshStart, '0000', S.lang === 'ar' ? 'كلمة سر المسح' : 'Delete password'); break;
  }
});
document.addEventListener('input', (e) => {
  const k = e.target.dataset.in;
  if (k === 'q') { S.q = e.target.value; rerenderGrid(); }
  if (k === 'aq') { S.admin.q = e.target.value; rerenderAdmin(); }
});
document.addEventListener('change', (e) => {
  const el = e.target;
  if (el.dataset.chg) changeField(el.dataset.chg, el.dataset.id, el.value);
  if (el.dataset.date) { S.admin[el.dataset.date] = el.value; if (S.admin.from > S.admin.to) S.admin.to = S.admin.from; adminCache = null; rerenderAdmin(); }
  if (el.id === 'fImg' && el.files[0]) pickImage(el.files[0]);
  if (el.id === 'restoreIn' && el.files[0]) restore(el.files[0]);
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.dataset.chg) e.target.blur();
  if (e.key === 'Enter' && e.target.id === 'qtyIn') stockOk();
});
window.addEventListener('online', () => { refreshHeader(); syncSoon(500); });
window.addEventListener('offline', refreshHeader);
setInterval(() => { if (navigator.onLine) syncNow(); }, 60000);
setInterval(() => { if (dayOf() !== S.today) { S.today = dayOf(); S.dayCount = 0; } }, 30000);

/* ---------- start ---------- */
(async function start() {
  try {
    await loadAll();
    S.today = dayOf();
    render();
    loadSound();
    setTimeout(() => { if (navigator.onLine) syncNow(); }, 3000);
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      const hadOld = !!navigator.serviceWorker.controller;
      navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((reg) => { reg.update().catch(() => {}); setInterval(() => reg.update().catch(() => {}), 30 * 60000); }).catch(() => {});
      /* a new version was installed: switch to it as soon as the cashier is not in the middle of an order */
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!hadOld) return;
        const tryReload = () => { if (!S.cart.length && !S.modal) location.reload(); else setTimeout(tryReload, 5000); };
        tryReload();
      });
    }
    syncSoon(3000);
  } catch (e) {
    document.body.innerHTML = `<div style="padding:40px;font-family:sans-serif"><h2>خطأ بالتشغيل</h2><p>${esc(e.message)}</p></div>`;
  }
})();
