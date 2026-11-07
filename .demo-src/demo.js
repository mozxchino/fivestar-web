// Practice mode (Mos 3 Nov): loaded FIRST on every demo page, in place of the LIFF SDK, supabase-js, config.js and session.js.
// Fakes LINE login + the database in this browser tab only. Nothing leaves the phone: every request to another site is blocked here,
// and the real app's storage (same github.io origin) is never read or written (all keys get a "demo:" prefix).
(function () {
  "use strict";
  const page = location.pathname.split("/").pop() || "index.html";

  // ---- 1. storage: same origin as the real app on github.io → keep demo keys apart (a real close draft must never show up here, or the other way)
  const wrap = (s) => ({
    getItem: (k) => s.getItem("demo:" + k), setItem: (k, v) => s.setItem("demo:" + k, v), removeItem: (k) => s.removeItem("demo:" + k),
    clear: () => Object.keys(s).filter((k) => k.startsWith("demo:")).forEach((k) => s.removeItem(k)),
    key: (i) => Object.keys(s).filter((k) => k.startsWith("demo:"))[i]?.slice(5) ?? null,
    get length() { return Object.keys(s).filter((k) => k.startsWith("demo:")).length; },
  });
  const LS = wrap(window.localStorage), SS = wrap(window.sessionStorage);
  Object.defineProperty(window, "localStorage", { configurable: true, get: () => LS });
  Object.defineProperty(window, "sessionStorage", { configurable: true, get: () => SS });

  // ---- 2. network: only files of this demo folder may load · anything else (Supabase, LINE, any API) is refused before it leaves
  const blocked = (window.__blocked = []);
  const local = (u) => { if (/^(data|blob):/.test(String(u))) return true; try { const x = new URL(u, location.href); return x.origin === location.origin && !x.pathname.includes("__demo_blocked"); } catch (_) { return false; } };
  const realFetch = window.fetch.bind(window);
  window.fetch = (u, o) => {
    const url = typeof u === "string" ? u : u?.url;
    if (local(url)) return realFetch(u, o);
    blocked.push(url); console.warn("demo: blocked", url);
    return Promise.resolve(new Response("null", { status: 200, headers: { "Content-Type": "application/json" } }));
  };
  const xo = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (m, u, ...a) { if (!local(u)) { blocked.push(u); u = "data:application/json,null"; } return xo.call(this, m, u, ...a); };
  if (navigator.sendBeacon) navigator.sendBeacon = (u) => { blocked.push(u); return true; };
  window.WebSocket = window.EventSource = function (u) { blocked.push(u); throw new Error("demo: no network"); };
  window.CONFIG = { SUPABASE_URL: "/__demo_blocked", SUPABASE_ANON_KEY: "demo", LIFF_ID: "demo" };

  // ---- 3. who and which moment of the day (start.html sets it)
  const ST_KEY = "fs_demo";
  let S = null; try { S = JSON.parse(SS.getItem(ST_KEY) || "null"); } catch (_) {}
  if (!S && page !== "start.html") { location.replace("start.html"); return; }
  S = S || { role: "staff", scene: "notopen" };
  const ME = { staff: { userId: "u2", role: "staff", name: "น้องฝน" }, manager: { userId: "u4", role: "manager", name: "พี่บี" }, owner: { userId: "u1", role: "owner", name: "มอส" } }[S.role];
  SS.setItem("fs_session_v1", JSON.stringify({ jwt: "demo", me: ME, at: Date.now() })); // pages read the role from here before App.ready

  // ---- 4. dates (Bangkok) · the shop day runs to 05:00, so between 00:00 and 05:00 the demo clock goes back 6 hours (evening of the same shop day)
  // otherwise the home page (calendar day) and the close page (shop day) would look at two different days
  if (new Date(Date.now() + 7 * 3600e3).getUTCHours() < 5) {
    const RD = Date, SHIFT = -6 * 3600e3;
    window.Date = class extends RD { constructor(...a) { if (a.length) super(...a); else super(RD.now() + SHIFT); } static now() { return RD.now() + SHIFT; } };
  }
  const bkk = (n = 0) => new Date(Date.now() + 7 * 3600e3 + n * 864e5).toISOString().slice(0, 10);
  const plus = (d, n) => new Date(Date.parse(d + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10);
  const dow = (d) => new Date(d + "T00:00:00Z").getUTCDay(); // 1 = Monday (shop closed, CPF does not deliver)
  const at = (d, h, m) => new Date(`${d}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00+07:00`).toISOString();
  const now = () => new Date().toISOString();
  const D = bkk();
  let seq = 0; const nid = (p) => `${p}${Date.now().toString(36)}${(seq++).toString(36)}`;

  // ---- 5. products: real names, units, bag sizes, prices and categories (products table, read only, 3 Nov 2026) · short fake ids
  // [sort, name, unit, pack, kind, supplier, cost, par weekday, par weekend, sold per day, buy unit, count_mode, count_cols, category, extra]
  const CAT = { 1: "ไก่ย่าง", 2: "ไก่ทอด", 3: "ไก่จ๊อ ไส้กรอก", 4: "ของทานเสริม", 5: "น้ำ เครื่องดื่ม", 6: "ของใช้" };
  const PR = [
    [101, "ไก่ย่างต้นตำรับ", "EA", 5, "cpf", "cpf", 120, 10, 15, 11.6, "ถุง", "count", "both", { order_as: "เซ็ตไก่หมัก+เป๊ปซี่" }],
    [102, "ไก่ย่างพริกไทยดำ", "EA", 5, "cpf", "cpf", 130, 5, 5, 0, "ถุง", "count", "both"],
    [103, "ไก่ย่างทรงเครื่อง", "EA", 5, "cpf", "cpf", 110, 10, 15, 6.3, "ถุง", "count", "both"],
    [104, "อกไก่อบซานอ้อย", "PC", 5, "cpf", "cpf", 59, 10, 10, 4.5, "ถุง", "count", "both"],
    [201, "น่องสะโพกทอดน้ำปลา", "PC", 6, "cpf", "cpf", 43, 6, 12, 5, "ถุง", "count", "both"],
    [202, "ไก่ทอดสูตรสไปซี่ (ผ่า4)", "PC", 4, "cpf", "cpf", 47, 0, 0, 0, "ถุง", "count", "both", { active: false }],
    [203, "น่องสะโพกทอดสูตรสไปซี่", "PC", 6, "cpf", "cpf", 47, 6, 6, 2.3, "ถุง", "count", "both"],
    [204, "ไก่สวรรค์", "PC", 6, "cpf", "cpf", null, 0, 0, 0, "ถุง", "count", "both", { active: false }],
    [213, "บีแอลทอดสไปซี่", "PC", 6, "cpf", "cpf", 28, 0, 0, 3.4, "ถุง", "count", "both"],
    [301, "ไก่จ๊อ", "เส้น", 10, "cpf", "cpf", 17, 40, 50, 27.7, "ถุง", "count", "both"],
    [302, "ไก่จ๊อพริกสด", "เส้น", 10, "cpf", "cpf", 17, 20, 30, 11.3, "ถุง", "count", "both"],
    [303, "ไก่จ๊อสูตรไส้อั่ว", "เส้น", 10, "cpf", "cpf", 12, 10, 10, 9, "ถุง", "count", "both"],
    [304, "ไส้กรอกจัมโบ้", "เส้น", 12, "cpf", "cpf", 17, 12, 12, 4, "ถุง", "count", "both"],
    [305, "ไก่จ๊อผักสามสี", "PC", 10, "cpf", "cpf", 17, 0, 0, 0, "ถุง", "count", "both", { active: false }],
    [401, "แพตตี้กุ้ง", "PC", 10, "cpf", "cpf", null, 0, 0, 0, "ถุง", "count", "both", { active: false }],
    [402, "เกี๊ยวซ่าไก่", "PC", 1, "cpf", "cpf", null, 0, 0, 0, "ถุง", "count", "both", { active: false }],
    [403, "น้ำพริกกากหมูต้มยำ", "PC", 1, "cpf", "cpf", null, 0, 0, 0, "ถุง", "count", "both", { active: false }],
    [405, "น้ำพริกปลาร้าบอง", "PC", 6, "cpf", "cpf", 20, 6, 6, 0.5, "ถุง", "count", "both", { reorder_at: 6 }],
    [406, "น้ำพริกปลาร้าบองแมงดา", "PC", 6, "cpf", "cpf", 20, 6, 6, 0.5, "ถุง", "count", "both", { reorder_at: 6 }],
    [407, "น้ำพริกตาแดง", "PC", 6, "cpf", "cpf", 20, 6, 6, 0.5, "ถุง", "count", "both", { reorder_at: 6 }],
    [408, "ข้าวเหนียวดิบ", "Kg", 1, "self", "self", null, 0, 0, 2, "กระสอบ", "count", "fresh", { low_at: 2 }],
    [409, "ข้าวเหนียวห่อ", "ห่อ", 1, "self", "self", 5, 0, 0, null, "ห่อ", "count", "cooked", { made_here: true }],
    [501, "น้ำดื่ม Alife", "BT", 12, "cpf", "cpf", 5, 0, 0, 0.1, "แพ็ค", "count", "fresh"],
    [502, "เป๊ปซี่", "BT", 24, "cpf", "cpf", 0, 0, 0, 3.8, "แพ็ค", "count", "fresh"],
    [601, "ฟอยด์ห่อไก่ย่าง", "ม้วน", 2, "consumable", "cpf", 224, 0, 0, null, "ม้วน", "tick", "fresh"],
    [602, "ถุงร้อน 6×9", "แพ็ค", 1, "consumable", "self", null, 0, 0, null, "แพ็ค", "tick", "fresh"],
    [603, "ถุงร้อน 4×6", "แพ็ค", 1, "consumable", "self", null, 0, 0, null, "แพ็ค", "tick", "fresh"],
    [604, "ถุงหูหิ้ว 6x14 นิ้ว (เล็ก)", "แพ็ค", 5, "consumable", "cpf", 34, 0, 0, null, "แพ็ค", "tick", "fresh"],
    [605, "ถุงมือ", "กล่อง", 1, "consumable", "self", null, 0, 0, null, "กล่อง", "tick", "fresh"],
    [606, "ถุงหูหิ้ว 9x15 นิ้ว (ใหญ่)", "แพ็ค", 5, "consumable", "cpf", 50, 0, 0, null, "แพ็ค", "tick", "fresh"],
    [607, "ไม้เสียบลูกชิ้น เบอร์ 9", "แพ็ค", 1, "consumable", "self", null, 0, 0, null, "แพ็ค", "tick", "fresh"],
    [608, "น้ำจิ้มเป็นซอง ต้นตำรับ", "ซอง", 200, "consumable", "cpf", 2.65, 0, 0, null, "ถุง", "tick", "fresh"],
    [609, "น้ำจิ้มเป็นซอง แจ่วห้าดาว", "ซอง", 200, "consumable", "cpf", 2.65, 0, 0, null, "ถุง", "tick", "fresh"],
    [610, "น้ำจิ้มเป็นซอง สูตรหวาน", "ซอง", 250, "consumable", "cpf", 1.45, 0, 0, null, "ถุง", "tick", "fresh"],
    [611, "น้ำจิ้มเป็นซอง บ๊วย", "ซอง", 250, "consumable", "cpf", 1.25, 0, 0, null, "ถุง", "tick", "fresh"],
    [612, "ทิชชู่", "แพ็ค", 1, "consumable", "self", null, 0, 0, null, "แพ็ค", "tick", "fresh"],
    [613, "น้ำยาเช็ดคราบมัน", "ขวด", 1, "consumable", "self", null, 0, 0, null, "ขวด", "tick", "fresh"],
    [614, "น้ำยาล้างจาน", "ขวด", 1, "consumable", "self", null, 0, 0, null, "ขวด", "tick", "fresh"],
    [615, "น้ำยาถูพื้น", "ขวด", 1, "consumable", "self", null, 0, 0, null, "ขวด", "tick", "fresh"],
    [616, "ผงซักฟอก", "ถุง", 1, "consumable", "self", null, 0, 0, null, "ถุง", "tick", "fresh"],
    [617, "น้ำมันทอด", "ขวด", 1, "consumable", "self", null, 0, 0, null, "ขวด", "tick", "fresh"],
  ].map(([sort, name, unit, pack_size, kind, supplier, cost_price, par_weekday, par_weekend, seed_daily, buy_unit, count_mode, count_cols, x]) => Object.assign({
    id: "p" + sort, sort, name, unit, pack_size, kind, supplier, order_as: null, cost_price, store_price: null, delivery_price: null, par_weekday, par_weekend, active: true,
    seed_daily, made_here: false, low_at: null, buy_unit, count_mode, stick_size: null, count_cols, category: CAT[String(sort)[0]], reorder_at: null }, x));
  const TH = { EA: "ตัว", PC: "ชิ้น", BT: "ขวด", Kg: "กก.", PAC: "แพ็ค" }, th = (u) => TH[u] || u;
  const P = Object.fromEntries(PR.map((p) => [p.id, p]));
  // what CPF brings on a normal day (about 4,000 baht a bill, like the real shop)
  const LOT = { p101: 10, p103: 5, p104: 5, p201: 6, p203: 6, p301: 30, p302: 10, p303: 10, p304: 12 };

  // ---- 6. the fake database (seeded per scene, kept in this tab's sessionStorage until start.html picks again)
  const DB_KEY = "fs_demo_db";
  let T = null; try { T = JSON.parse(SS.getItem(DB_KEY) || "null"); } catch (_) {}
  if (!T || T.__day !== D || T.__scene !== S.scene + S.seed) T = seed();
  const persist = () => { try { SS.setItem(DB_KEY, JSON.stringify(T)); } catch (e) { console.warn("demo: state not kept", e); } };
  persist();

  function seed() {
    const t = { __day: D, __scene: S.scene + S.seed, products: PR.map((p) => ({ ...p })), shop_days: [], stock_lines: [], orders: [], order_items: [], deposits: [], expenses: [],
      made_logs: [], waste_logs: [], consumable_checks: [], month_inputs: [], pending_users: [], issues: [], leave_requests: [] };
    t.users = [
      { id: "u1", line_user_id: "demo1", name: "มอส", role: "owner", active: true, started_at: "2026-10-31", salary_month: null, off_days_per_month: 4, std_hours_per_day: 10, ot_rate_hour: null, ended_at: null },
      { id: "u2", line_user_id: "demo2", name: "น้องฝน", role: "staff", active: true, started_at: "2026-09-25", salary_month: 15000, off_days_per_month: 4, std_hours_per_day: 11, ot_rate_hour: 50, ended_at: null },
      { id: "u4", line_user_id: "demo4", name: "พี่บี", role: "manager", active: true, started_at: "2026-10-31", salary_month: null, off_days_per_month: 4, std_hours_per_day: 8, ot_rate_hour: null, ended_at: null },
      { id: "u3", line_user_id: "demo3", name: "พี่เอ", role: "staff", active: false, started_at: "2026-06-01", salary_month: 14000, off_days_per_month: 4, std_hours_per_day: 10, ot_rate_hour: 50, ended_at: "2026-09-20" }];
    const set = { auto_send_at: "12:30", bonus_per_day: 100, bonus_threshold: 7000, closed_day_extra: 0, cpf_fee_pct: 1.5, cpf_no_delivery_dow: [1], delivery_at: "14:00", go_live_date: "2026-10-31",
      grab_gp: 30, holidays: [], leave_holidays: [], lineman_gp: 20, min_bag_categories: ["ของทานเสริม", "น้ำ เครื่องดื่ม"], open_dates: dow(D) === 1 ? [D] : [], order_buffer_pct: 35,
      order_lead_days: 2, overstock_days: 3, remind_at: "21:00", sales_mention: "@new", shop_closed_dow: [1], shop_name: "สาขาอ่อนนุช 44 จุด 3", shopee_gp: 30,
      sales_group_id: "demo-g1", staff_group_id: "demo-g2", cash_float: 1000 };
    t.settings = Object.entries(set).map(([key, value]) => ({ key, value }));
    t.line_sources = [{ source_id: "demo-g1", source_type: "group", display_name: "กลุ่มสั่งของ CP (ทดลอง)" }, { source_id: "demo-g2", source_type: "group", display_name: "ห้าดาว พนักงาน (ทดลอง)" }];
    t.pending_users = [{ source_id: "demo9", display_name: "Nok ✿", first_seen: at(D, 8, 12), last_seen: at(D, 8, 12) }];
    t.expense_items = [["ค่าเช่าร้าน", "fixed"], ["ค่าไฟ", "fixed"], ["ค่าน้ำ", "fixed"], ["แก๊สปิกนิก", "gas"], ["ค่าธรรมเนียมฝากเงิน", "fee"], ["ซ่อมเตา", "other"]]
      .map(([name, category], i) => ({ id: "e" + i, name, category, active: true, created_at: at("2026-10-31", 9, 0) }));
    // 30 days back: Mondays closed, the rest a normal ~6,000 baht day
    for (let k = 30; k >= 1; k--) {
      const d = plus(D, -k);
      if (dow(d) === 1) { t.shop_days.push({ date: d, status: "holiday", opened_at: null, closed_at: null }); continue; }
      const pos = 5200 + ((k * 733) % 2100), exp = Math.round(pos * 0.55 / 10) * 10, cnt = exp + [0, 0, -20, 0, 10, 0][k % 6];
      t.shop_days.push({ date: d, status: "sent", opened_at: at(d, 9, k % 7), opened_by: "u2", open_photo: "demo/open.jpg", closed_at: at(d, 20, 10 + k % 15), closed_by: "u2",
        cash_expected: exp, cash_counted: cnt, pos_total: pos, ot_hours: k === 4 ? 1 : 0, ot_approved_at: null, note: k === 2 ? "ลูกค้าถามไก่ต้นตำรับ ของหมดตอน 6 โมงเย็น" : null,
        photos: ["demo/fridge.jpg"], pos_photo: "demo/pos.jpg", waste_none: k % 3 !== 0, close_detail: { cash: { taken_out: Math.max(0, cnt - 1000) } } });
      if (k >= 2) t.deposits.push({ id: "dp" + k, date: d, amount: Math.max(0, cnt - 1000) - 10, fee: 10, taken_out: Math.max(0, cnt - 1000), gap: 0, slip: "demo/slip.jpg",
        created_by: "u2", created_at: at(plus(d, 1), 10, 5), updated_at: at(plus(d, 1), 10, 5), confirmed_by: k > 3 ? "u1" : null, confirmed_at: k > 3 ? at(plus(d, 1), 12, 0) : null });
      addOrder(t, d, "sent", k === 6 ? { p302: 0 } : {}); // every open day gets a lot (Sunday night's order lands Tuesday) · day 6: CPF short 1 row
    }
    // stock counted at last night's close (what today starts with) + the last week for the history page
    const last = t.shop_days.filter((x) => x.status === "sent").map((x) => x.date).slice(-7);
    for (const d of last) for (const p of PR) if (p.active && p.kind !== "consumable") {
      const sold = Math.round(p.seed_daily ?? 0), open = Math.round((p.seed_daily ?? 3) * 1.4) + (p.id === "p408" ? 3 : 0), rec = recv(t, d, p.id);
      t.stock_lines.push({ date: d, product_id: p.id, open_fresh: open, open_cooked: 0, received: rec, remain_fresh: Math.max(0, open + rec - sold - (p.id === "p301" && d === last[3] ? 2 : 0)),
        remain_cooked: 0, waste: p.id === "p301" && d === last[3] ? 2 : 0, sold, source: "close", updated_at: at(d, 20, 15), extra_in: 0 });
    }
    t.waste_logs.push({ id: "w1", date: last[3], product_id: "p301", qty: 2, kg: 0.3, photos: ["demo/w1.jpg", "demo/w2.jpg"], created_by: "u2", created_at: at(last[3], 15, 10) });
    t.consumable_checks.push({ date: last[6], product_id: "p602", status: "low" }, { date: last[6], product_id: "p610", status: "low" });
    // today: CPF lot ordered 2 nights ago · tomorrow's lot was sent last night · today's row follows the chosen moment
    addOrder(t, D, "sent", {}, true); // practice: a lot to receive even on a Monday (the real CPF does not deliver Mondays)
    if (dow(plus(D, 1)) !== 1) addOrder(t, plus(D, 1), "sent", {}, true);
    const open = { date: D, status: "open", opened_at: null, opened_by: null, closed_at: null, closed_by: null, cash_expected: null, cash_counted: null, pos_total: null, ot_hours: 0, note: null, photos: [] };
    const sc = S.scene;
    if (sc !== "notopen") Object.assign(open, { opened_at: at(D, 9, 4), opened_by: "u2", open_photo: "demo/open.jpg" });
    if (sc === "received" || sc === "closed") receiveToday(t, at(D, 14, 12));
    for (const p of PR) if (p.active && p.kind !== "consumable") {
      const y = t.stock_lines.find((l) => l.date === last[last.length - 1] && l.product_id === p.id);
      t.stock_lines.push({ date: D, product_id: p.id, open_fresh: y ? y.remain_fresh : 0, open_cooked: 0, received: sc === "received" || sc === "closed" ? recv(t, D, p.id) : 0,
        remain_fresh: null, remain_cooked: null, waste: 0, sold: null, source: null, updated_at: at(D, 9, 4), extra_in: 0 });
    }
    if (sc === "opened" || sc === "received") t.made_logs.push({ id: "m1", date: D, product_id: "p409", qty: 20, created_by: "u2", created_at: at(D, 9, 40 ) });
    if (sc === "closed") closeToday(t, { pos_total: 6240, cash_expected: 3420, cash_counted: 3420, detail: { cash: { taken_out: 2420 } }, lines: [], consumables: [{ product_id: "p602", status: "low" }] }, at(D, 20, 18), "u2");
    t.shop_days.push(open);
    if (sc === "closed") Object.assign(open, { status: "sent", closed_at: at(D, 20, 18), closed_by: "u2", cash_expected: 3420, cash_counted: 3420, pos_total: 6240, photos: ["demo/fridge.jpg"], pos_photo: "demo/pos.jpg" });
    t.issues = [
      { id: "i1", date: plus(D, -1), created_at: at(plus(D, -1), 11, 20), created_by: "u2", type: "equipment", text: "เตาย่างหัวซ้ายไฟไม่ติด ต้องกดหลายรอบ", photos: ["demo/stove.jpg"], status: "open", ack_by: null, ack_at: null },
      { id: "i2", date: plus(D, -5), created_at: at(plus(D, -5), 18, 5), created_by: "u2", type: "customer", text: "ลูกค้าบอกไก่ย่างไม่สุก ขอเปลี่ยนตัวใหม่", photos: [], status: "ack", ack_by: "u1", ack_at: at(plus(D, -5), 19, 0) }];
    t.leave_requests = [
      { id: "l1", user_id: "u2", date: plus(D, 9), type: "personal", note: "พาแม่ไปหาหมอ", status: "pending", auto: false, requested_at: at(plus(D, -1), 20, 30) },
      { id: "l2", user_id: "u2", date: plus(D, 16), type: "special", note: null, status: "approved", auto: false, requested_at: at(plus(D, -6), 12, 0), decided_by: "u1", decided_at: at(plus(D, -6), 13, 0) }];
    const m1 = D.slice(0, 8) + "01";
    t.expenses = [
      ["fixed", "ค่าเช่าร้าน", 10000, "owner", "e0"], ["gas", "แก๊สปิกนิก", 480, "cash", "e3"], ["raw", "ข้าวเหนียวดิบ", 450, "cash", null, "p408", 15], ["supply", "ถุงร้อน 6×9", 85, "cash", null, "p602", 2],
    ].map(([category, name, amount, paid_by, item_id, product_id, qty], i) => ({ id: "x" + i, date: m1 > plus(D, -2) ? D : plus(D, -2 + (i % 2)), category, name, item_id: item_id || null, product_id: product_id || null,
      qty: qty || null, amount, paid_by, photo: "demo/receipt.jpg", created_by: paid_by === "owner" ? "u1" : "u2", created_at: at(D, 8, i) }));
    return t;
  }
  function addOrder(t, d, status, short = {}, pending = false) {
    const id = "o" + d.replaceAll("-", "");
    t.orders.push({ id, for_date: d, created_at: at(plus(d, -2), 21, 2), status, approved_by: "u1", sent_at: at(plus(d, -2), 21, 6), sent_mode: "manual", message_text: null, revision: 1, plan: null, paid_at: pending ? null : at(d, 14, 30), paid_amount: null });
    for (const [pid, q] of Object.entries(LOT).concat([["p601", 2]])) t.order_items.push({ order_id: id, product_id: pid, qty_proposed: q, qty_final: q,
      qty_received: pending ? null : (short[pid] ?? q), received_at: pending ? null : at(d, 14, 8), receipt_photos: pending ? [] : ["demo/bill.jpg"] });
  }
  function recv(t, d, pid) { return +(t.order_items.find((i) => i.order_id === "o" + d.replaceAll("-", "") && i.product_id === pid)?.qty_received || 0); }
  function receiveToday(t, when, items, photos) {
    const oid = "o" + D.replaceAll("-", ""), got = Object.fromEntries((items || []).map((x) => [x.product_id, x.qty_received]));
    t.order_items.filter((i) => i.order_id === oid).forEach((i) => Object.assign(i, { qty_received: got[i.product_id] ?? i.qty_final, received_at: when, receipt_photos: photos || ["demo/bill.jpg"] }));
    t.stock_lines.filter((l) => l.date === D).forEach((l) => { l.received = recv(t, D, l.product_id); });
  }
  // what the 21:00 close does: the day row, the count, the consumable ticks, then tonight's CPF order (arrives the day after tomorrow)
  function closeToday(t, p, when, by) {
    const day = t.shop_days.find((x) => x.date === D);
    if (day) Object.assign(day, { status: "sent", closed_at: when, closed_by: by, cash_expected: p.cash_expected ?? null, cash_counted: p.cash_counted ?? null, pos_total: p.pos_total ?? null, close_detail: p.detail || null, ot_hours: p.ot_hours || 0, note: p.note || null });
    for (const r of p.lines || []) { const l = t.stock_lines.find((x) => x.date === D && x.product_id === r.product_id); if (l) Object.assign(l, { remain_fresh: r.remain_fresh, remain_cooked: r.remain_cooked, waste: r.waste || 0 }); }
    t.consumable_checks = t.consumable_checks.filter((c) => c.date !== D).concat((p.consumables || []).map((c) => ({ date: D, product_id: c.product_id, status: c.status })));
    let arrive = plus(D, 2), mult = 1;
    if (dow(arrive) === 1) { arrive = plus(arrive, 1); } // no CPF on Monday → Tuesday's lot
    if (dow(D) === 6) return; // Saturday night: no order (Monday no delivery), Sunday's order covers it
    if (dow(D) === 0) mult = 1;
    const id = "o" + arrive.replaceAll("-", "");
    if (t.orders.some((o) => o.id === id)) return;
    const items = [];
    for (const p of PR) if (p.active && p.kind === "cpf" && p.seed_daily) {
      const l = t.stock_lines.find((x) => x.date === D && x.product_id === p.id), left = l && l.remain_fresh != null ? +l.remain_fresh + (+l.remain_cooked || 0) : Math.round(p.seed_daily);
      const incoming = recv(t, plus(D, 1), p.id) || (t.order_items.find((i) => i.order_id === "o" + plus(D, 1).replaceAll("-", "") && i.product_id === p.id)?.qty_final || 0);
      const target = p.seed_daily * 2.5 * 1.35 * mult, need = target - left - incoming, bags = need <= 0 ? 0 : Math.round(need / p.pack_size + 0.0001) || (need >= p.pack_size / 2 ? 1 : 0);
      items.push({ product_id: p.id, name: p.name, qty: bags * p.pack_size, left, incoming, use: p.seed_daily, target: +target.toFixed(1), over: left > p.seed_daily * 3 + 0.01 && p.seed_daily > 0 ? true : undefined, days_left: p.seed_daily ? +(left / p.seed_daily).toFixed(1) : null });
    }
    const low = (p.consumables || []).filter((c) => P[c.product_id]?.supplier === "cpf" && c.status !== "ok").map((c) => c.product_id);
    const plan = { night: D, arrive, deliver_at: "14:00", none: false, mult, until: plus(arrive, 1), gap: [], opening: false, items, self_buy: [] };
    t.orders.push({ id, for_date: arrive, created_at: when, status: "proposed", approved_by: null, sent_at: null, sent_mode: null, message_text: null, revision: 1, plan, paid_at: null, paid_amount: null });
    for (const x of items) if (x.qty > 0) t.order_items.push({ order_id: id, product_id: x.product_id, qty_proposed: x.qty, qty_final: x.qty, qty_received: null, received_at: null, receipt_photos: [] });
    for (const pid of low.length ? low : ["p601"]) t.order_items.push({ order_id: id, product_id: pid, qty_proposed: P[pid].pack_size, qty_final: P[pid].pack_size, qty_received: null, received_at: null, receipt_photos: [] });
  }

  // ---- 7. a small PostgREST look-alike: filters, order, limit, embedded rows, insert / update / upsert / delete on the tables above
  const ALIAS = { product_admin: "products", product_names: "products", user_public: "users" };
  const KEYS = { settings: ["key"], month_inputs: ["ym"], deposits: ["date"], stock_lines: ["date", "product_id"], consumable_checks: ["date", "product_id"], order_items: ["order_id", "product_id"], shop_days: ["date"], pending_users: ["source_id"], line_sources: ["source_id"] };
  const val = (r, c) => { if (c.includes("->>")) { const [a, b] = c.split("->>"); const v = (r[a] || {})[b]; return v == null ? null : String(v); } return r[c]; };
  const num = (v) => v !== null && v !== "" && !isNaN(v);
  const cmp = (a, b) => num(a) && num(b) ? +a - +b : String(a).localeCompare(String(b));
  const OPS = {
    eq: (a, b) => a != null && String(a) === String(b), neq: (a, b) => a == null || String(a) !== String(b),
    gt: (a, b) => a != null && cmp(a, b) > 0, gte: (a, b) => a != null && cmp(a, b) >= 0, lt: (a, b) => a != null && cmp(a, b) < 0, lte: (a, b) => a != null && cmp(a, b) <= 0,
    in: (a, b) => b.map(String).includes(String(a)), is: (a, b) => b === null || b === "null" ? a == null : a === b,
  };
  const orPart = (s) => { const m = s.match(/^([\w>-]+)\.(\w+)\.(.*)$/); if (!m) return () => true; const [, c, op, v] = m;
    const arg = op === "in" ? v.replace(/^\(|\)$/g, "").split(",") : v === "null" ? null : v; return (r) => (OPS[op] || (() => true))(val(r, c), arg); };
  function embeds(sel) {
    const out = []; let depth = 0, cur = "";
    for (const ch of sel || "") { if (ch === "(") depth++; if (ch === ")") depth--; if (ch === "," && !depth) { out.push(cur.trim()); cur = ""; } else cur += ch; }
    out.push(cur.trim());
    return out.map((tok) => tok.match(/^(\w+)(?::(\w+))?(?:!\w+)?\((.*)\)$/s)).filter(Boolean).map(([, a, rel]) => ({ as: a, rel: rel || a }));
  }
  const rows = (name) => (T[ALIAS[name] || name] ||= []);
  function attach(r, ems) {
    const o = { ...r };
    for (const { as, rel } of ems) {
      if (rel === "order_items") o[as] = rows("order_items").filter((i) => i.order_id === r.id).map((i) => ({ ...i }));
      else if (rel === "products" || rel === "product_names") o[as] = r.product_id ? { ...(rows("products").find((p) => p.id === r.product_id) || {}) } : null;
      else if (rel === "users" || rel === "user_public") o[as] = r.user_id ? { ...(rows("users").find((u) => u.id === r.user_id) || {}) } : null;
    }
    return o;
  }
  const defaults = (name, r) => Object.assign(
    ["shop_days", "settings", "stock_lines", "consumable_checks", "month_inputs", "order_items", "pending_users", "line_sources"].includes(name) ? {} : { id: nid(name[0]) },
    ["issues", "waste_logs", "made_logs", "expenses"].includes(name) ? { date: D, created_at: now() } : {}, r);
  function from(table) {
    const name = ALIAS[table] || table, st = { f: [], ord: [], lim: null, off: 0, single: false, op: "select", sel: "*", ret: false, payload: null };
    const run = () => {
      let all = rows(name), hit = all.filter((r) => st.f.every((f) => f(r))), data;
      if (st.op === "select") data = hit;
      else if (st.op === "delete") { T[name] = all.filter((r) => !hit.includes(r)); data = hit; }
      else if (st.op === "update") { hit.forEach((r) => Object.assign(r, st.payload)); data = hit; }
      else { // insert / upsert
        const keys = KEYS[name] || ["id"], list = (Array.isArray(st.payload) ? st.payload : [st.payload]).map((r) => ({ ...r }));
        data = list.map((r) => { const old = st.op === "upsert" && all.find((x) => keys.every((k) => x[k] != null && String(x[k]) === String(r[k])));
          if (old) return Object.assign(old, r); const n = defaults(name, r); all.push(n); return n; });
      }
      if (st.op !== "select") { persist(); if (!st.ret) return { data: null, error: null }; }
      data = data.slice();
      for (const [c, asc] of st.ord.slice().reverse()) data.sort((a, b) => (val(a, c) == null) - (val(b, c) == null) || (asc ? 1 : -1) * cmp(val(a, c) ?? "", val(b, c) ?? ""));
      if (st.lim != null || st.off) data = data.slice(st.off, st.lim == null ? undefined : st.off + st.lim);
      const ems = embeds(st.sel); data = data.map((r) => attach(r, ems));
      return { data: st.single ? data[0] ?? null : data, error: null, count: data.length };
    };
    const api = {
      select(s) { if (st.op === "select") st.sel = s || "*"; else { st.ret = true; st.sel = s || "*"; } return api; },
      insert(v) { st.op = "insert"; st.payload = v; return api; }, upsert(v) { st.op = "upsert"; st.payload = v; return api; },
      update(v) { st.op = "update"; st.payload = v; return api; }, delete() { st.op = "delete"; return api; },
      or(s) { const parts = s.split(/,(?![^(]*\))/).map(orPart); st.f.push((r) => parts.some((p) => p(r))); return api; },
      not(c, op, v) { const f = OPS[op] || (() => false); st.f.push((r) => !f(val(r, c), v)); return api; },
      match(o) { Object.entries(o).forEach(([c, v]) => st.f.push((r) => OPS.eq(val(r, c), v))); return api; },
      order(c, o) { st.ord.push([c, !o || o.ascending !== false]); return api; }, limit(n) { st.lim = n; return api; }, range(a, b) { st.off = a; st.lim = b - a + 1; return api; },
      single() { st.single = true; return api; }, maybeSingle() { st.single = true; return api; },
      then(res, rej) { return Promise.resolve().then(run).then(res, rej); },
    };
    for (const op of Object.keys(OPS)) api[op] = (c, v) => { st.f.push((r) => OPS[op](val(r, c), v)); return api; };
    return new Proxy(api, { get: (o, k) => k in o ? o[k] : () => o }); // ponytail: an unknown filter (ilike, contains…) is ignored, the page still gets rows
  }

  // ---- 8. server functions: each does what the real one does to the tables above, then says it worked
  const dayRow = (d) => rows("shop_days").find((x) => x.date === d);
  const setting = (k) => rows("settings").find((s) => s.key === k)?.value;
  const review = (oid) => {
    const o = rows("orders").find((x) => x.id === oid), plan = o?.plan, pi = Object.fromEntries((plan?.items || []).map((x) => [x.product_id, x]));
    return rows("order_items").filter((i) => i.order_id === oid).map((i) => { const p = P[i.product_id] || {}, x = pi[i.product_id] || {};
      return { product_id: i.product_id, sort: p.sort, label: p.order_as ? "เซ็ตไก่หมัก" : p.name, name: p.name, unit: p.unit, qty: +(i.qty_final ?? i.qty_proposed), unit_th: th(p.unit),
        order_as: p.order_as, sets: p.order_as ? +(i.qty_final ?? i.qty_proposed) / p.pack_size : null, qty_proposed: +i.qty_proposed, pack_size: p.pack_size, kind: p.kind,
        remaining: p.kind === "consumable" ? null : x.left ?? null, incoming: x.incoming ?? 0, par: x.target ?? null, daily_use: x.use ?? null, use_src: p.kind === "consumable" ? "tick" : "avg7" }; });
  };
  const leaveRow = (id) => rows("leave_requests").find((l) => l.id === id);
  const madeTotal = () => rows("made_logs").filter((m) => m.date === D).reduce((a, m) => a + +m.qty, 0);
  const month = (y, m) => { const ym = `${y}-${String(m).padStart(2, "0")}`; return rows("shop_days").filter((d) => d.date.startsWith(ym)); };
  const RPC = {
    unclosed_day: () => null, ensure_day: ({ d }) => { if (!dayRow(d)) rows("shop_days").push({ date: d, status: "open", opened_at: null, closed_at: null, photos: [] }); return null; },
    open_shop: ({ photo }) => { Object.assign(dayRow(D) || {}, { opened_at: now(), opened_by: ME.userId, open_photo: photo || null, status: "open" }); return null; },
    receive_order: ({ items, photos }) => { receiveToday(T, now(), items, photos); return null; },
    // 0102: the staff picks move (next delivery day, Monday skipped) or cancel · demo keeps it simple: cancel = received 0, move = order date + 1 (or +2 over Monday)
    next_delivery_day: ({ d }) => { const x = new Date(d + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + 1); if (x.getUTCDay() === 1) x.setUTCDate(x.getUTCDate() + 1); return x.toISOString().slice(0, 10); },
    no_delivery: ({ p_order, p_action }) => { const o = rows("orders").find((r) => r.id === p_order); if (!o) return null;
      if (p_action === "cancel") { receiveToday(T, now(), rows("order_items").filter((i) => i.order_id === o.id).map((i) => ({ product_id: i.product_id, qty_received: 0 }))); o.plan = Object.assign({}, o.plan, { no_delivery: "cancel" }); return { action: "cancel", date: o.for_date }; }
      const was = o.for_date; const x = new Date(was + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + 1); if (x.getUTCDay() === 1) x.setUTCDate(x.getUTCDate() + 1); o.for_date = x.toISOString().slice(0, 10);
      o.plan = Object.assign({}, o.plan, { moved_from: (o.plan && o.plan.moved_from) || was }); rows("order_items").filter((i) => i.order_id === o.id).forEach((i) => { i.qty_received = null; i.received_at = null; i.receipt_photos = []; });
      return { action: "move", from: was, to: o.for_date }; },
    no_delivery_today: () => { receiveToday(T, now(), rows("order_items").filter((i) => i.order_id === "o" + D.replaceAll("-", "")).map((i) => ({ product_id: i.product_id, qty_received: 0 }))); return null; },
    close_check: ({ d }) => ({ waste_none: !!dayRow(d)?.waste_none, waste_logs: rows("waste_logs").filter((w) => w.date === d).length,
      items: rows("stock_lines").filter((l) => l.date === d && P[l.product_id]?.seed_daily >= 3).map((l) => { const p = P[l.product_id], e = Math.max(0, +l.open_fresh + +l.open_cooked + +l.received - Math.round(p.seed_daily));
        return { product_id: p.id, name: p.name, unit: th(p.unit), expected: e, min: Math.max(0, e - Math.max(p.pack_size / 2, p.seed_daily)) }; }) }),
    close_day: ({ p }) => { closeToday(T, p, now(), ME.userId); return null; },
    waste_none: ({ d }) => { Object.assign(dayRow(d) || {}, { waste_none: true }); return null; },
    waste_delete: ({ wid }) => { T.waste_logs = rows("waste_logs").filter((w) => w.id !== wid); return null; },
    add_made: ({ p_product, p_qty }) => { rows("made_logs").push({ id: nid("m"), date: D, product_id: p_product, qty: p_qty, created_by: ME.userId, created_at: now() }); return madeTotal(); },
    undo_made: (a) => { const l = rows("made_logs"), i = a && a.log_id ? l.findIndex((m) => m.id === a.log_id) : l.length - 1; if (i >= 0) l.splice(i, 1); return madeTotal(); },
    add_expense: ({ p }) => { const e = defaults("expenses", { ...p, created_by: ME.userId }); if (!e.date) e.date = D; rows("expenses").push(e); return e.id; },
    delete_expense: ({ eid }) => { T.expenses = rows("expenses").filter((e) => e.id !== eid); return null; },
    deposit_taken_out: ({ d }) => { const x = dayRow(d); return x?.close_detail?.cash?.taken_out ?? (x?.cash_counted != null ? Math.max(0, x.cash_counted - 1000) : null); },
    save_deposit: ({ p }) => { const out = RPC.deposit_taken_out({ d: p.date }), amt = +p.amount || 0, fee = +p.fee || 0;
      let x = rows("deposits").find((r) => r.date === p.date); if (!x) rows("deposits").push(x = { id: nid("dp"), date: p.date, created_by: ME.userId, created_at: now(), confirmed_at: null });
      Object.assign(x, { amount: amt, fee, slip: p.slip || x.slip || null, taken_out: out, gap: out == null ? null : amt + fee - out, updated_at: now() }); return { ...x }; },
    // 0094: owner marks the transfer received (deposit.html "เงินโอนไม่ครบ")
    receive_deposit: ({ d, a }) => { const out = RPC.deposit_taken_out({ d }), amt = a == null ? out : +a; if (!amt) return { ok: false, why: "amount" };
      let x = rows("deposits").find((r) => r.date === d); if (!x) rows("deposits").push(x = { id: nid("dp"), date: d, created_by: ME.userId, created_at: now() });
      Object.assign(x, { amount: amt, fee: 0, slip: null, taken_out: out, gap: out == null ? null : amt - out, confirmed_by: ME.userId, confirmed_at: now(), updated_at: now() }); return { ok: true, ...x }; },
    confirm_deposit: ({ d }) => { Object.assign(rows("deposits").find((r) => r.date === d) || {}, { confirmed_by: ME.userId, confirmed_at: now() }); return null; },
    request_leave: ({ d, p_type, note }) => { const l = { id: nid("l"), user_id: ME.userId, date: d, type: p_type, note, status: "pending", auto: false, requested_at: now() }; rows("leave_requests").push(l); return { id: l.id, status: "pending" }; },
    cancel_leave: ({ p_id }) => { Object.assign(leaveRow(p_id) || {}, { status: "cancelled" }); return null; },
    owner_decide_leave: ({ p_id, p_approve }) => { const l = leaveRow(p_id) || {}; Object.assign(l, { status: p_approve ? "approved" : "rejected", decided_by: ME.userId, decided_at: now() });
      return { status: l.status, type: l.type, date: l.date, name: rows("users").find((u) => u.id === l.user_id)?.name }; },
    leave_counters: () => ({ month_days: rows("leave_requests").filter((l) => l.user_id === ME.userId && l.status === "approved" && l.date.slice(0, 7) === D.slice(0, 7)).length, week_used: 0 }),
    short_days: () => rows("orders").filter((o) => o.for_date < D && rows("order_items").some((i) => i.order_id === o.id && i.qty_received != null && +i.qty_received < +i.qty_final)).map((o) => o.for_date),
    approve_ot: ({ d }) => { Object.assign(dayRow(d) || {}, { ot_approved_at: now(), ot_approved_by: ME.userId }); return null; },
    set_received: ({ pid, qty, d }) => { const l = rows("stock_lines").find((x) => x.date === d && x.product_id === pid); if (l) l.received = qty; return null; },
    set_pos_total: ({ d, amount }) => { Object.assign(dayRow(d) || {}, { pos_total: amount }); return null; },
    set_off_days: ({ p_user_id, n }) => { Object.assign(rows("users").find((u) => u.id === p_user_id) || {}, { off_days_per_month: n }); return null; },
    set_manager: ({ p_user_id, p_on }) => { Object.assign(rows("users").find((u) => u.id === p_user_id) || {}, { role: p_on ? "manager" : "staff" }); return null; },
    deactivate_user: ({ p_user_id }) => { Object.assign(rows("users").find((u) => u.id === p_user_id) || {}, { active: false, ended_at: D }); return null; },
    approve_user: ({ p_line_user_id, p_name, p_role }) => { T.pending_users = rows("pending_users").filter((x) => x.source_id !== p_line_user_id);
      const u = { id: nid("u"), line_user_id: p_line_user_id, name: p_name, role: p_role || "staff", active: true, started_at: D, salary_month: null, off_days_per_month: 4, std_hours_per_day: 10, ot_rate_hour: 50 }; rows("users").push(u); return u.id; },
    staff_bonus: ({ y, m }) => { const days = month(y, m).filter((d) => +d.pos_total > 7000).length; return { amount: days * 100, threshold: setting("bonus_threshold") || 7000, days, per_day: setting("bonus_per_day") || 100 }; },
    month_summary: ({ y, m }) => { const ds = month(y, m);
      return { days_worked: ds.filter((d) => d.opened_at).length, days_closed_sent: ds.filter((d) => d.status === "sent").length, days_holiday: ds.filter((d) => d.status === "holiday").length,
        ot_hours: ds.reduce((a, d) => a + (+d.ot_hours || 0), 0), ot_approved_hours: ds.filter((d) => d.ot_approved_at).reduce((a, d) => a + (+d.ot_hours || 0), 0),
        waste_total: rows("stock_lines").filter((l) => l.date.startsWith(`${y}-${String(m).padStart(2, "0")}`)).reduce((a, l) => a + (+l.waste || 0), 0),
        cash_short_total: ds.reduce((a, d) => a + (d.cash_expected != null && d.cash_counted != null ? Math.max(0, d.cash_expected - d.cash_counted) : 0), 0), cpf_short_days: RPC.short_days().length }; },
    month_costs: ({ y, m }) => { const ym = `${y}-${String(m).padStart(2, "0")}`, ds = month(y, m).filter((d) => d.status === "sent"), sales = ds.reduce((a, d) => a + (+d.pos_total || 0), 0);
      const inp = rows("month_inputs").find((r) => r.ym === ym), ex = rows("expenses").filter((e) => e.date.startsWith(ym)), exT = ex.reduce((a, e) => a + +e.amount, 0);
      const os = rows("orders").filter((o) => o.for_date.startsWith(ym) && o.status === "sent"), its = rows("order_items").filter((i) => os.some((o) => o.id === i.order_id) && i.qty_received != null);
      const cost = (k) => its.filter((i) => (P[i.product_id]?.kind === "consumable") === k).reduce((a, i) => a + +i.qty_received * (+P[i.product_id]?.cost_price || 0), 0);
      const cpf = cost(false), cons = cost(true), fee = Math.round((cpf + cons) * 0.015), lm = inp ? +inp.lineman_sales || 0 : Math.round(sales * 0.39), gp = Math.round(lm * 0.2);
      const pay = { salary: 15000 * ds.length / 26 | 0, ot: 0, bonus: ds.filter((d) => +d.pos_total > 7000).length * 100 }, fixed = 0;
      const revenue = inp ? (+inp.store_sales || 0) + lm + (+inp.grab_sales || 0) + (+inp.shopee_sales || 0) : sales;
      return { inputs: Object.assign({ store_sales: null, lineman_sales: null, grab_sales: null, shopee_sales: null, rent: null, wages: null, utilities: null, gas: null, misc: null, note: "" }, inp || {}),
        gp: { lineman_gp: 20, grab_gp: 30, shopee_gp: 30 }, cost_source: "expenses", pay, fixed_missing: ["ค่าไฟ", "ค่าน้ำ"], expense_total: exT, revenue, gp_cost: gp, cpf_cost: cpf,
        cpf_consumable_cost: cons, cpf_fee: fee, cpf_fee_pct: 1.5, cpf_consumables: [], waste_cost: 34, fixed, net: revenue - gp - cpf - cons - fee - exT - pay.salary - pay.bonus,
        days_open: ds.length, avg_daily_sales: ds.length ? Math.round(sales / ds.length) : 0, stock_sales_est: sales, has_inputs: !!inp, missing_cost: [],
        per_product: PR.filter((p) => p.active && p.kind === "cpf" && LOT[p.id]).map((p) => { const r = its.filter((i) => i.product_id === p.id).reduce((a, i) => a + +i.qty_received, 0); return { name: p.name, received: r, sold: Math.round(r * 0.95), waste: 0, cost_price: p.cost_price, cost: r * p.cost_price }; }) }; },
    // ordering (approve.html / opening.html)
    night_plan: ({ d }) => rows("orders").filter((o) => o.plan && o.plan.night === d).map((o) => o.plan)[0] || { night: d, arrive: plus(d, 2), deliver_at: "14:00", none: false, items: [], self_buy: [] },
    night_order: () => { const o = rows("orders").find((x) => x.plan && x.plan.night === D); return o ? { order_id: o.id, existing: o.status !== "proposed", arrive: o.for_date } : { order_id: null, arrive: plus(D, 2) }; },
    order_review: ({ oid }) => review(oid),
    order_set_qty: ({ oid, pid, qty }) => { Object.assign(rows("order_items").find((i) => i.order_id === oid && i.product_id === pid) || {}, { qty_final: qty }); return null; },
    order_item_remove: ({ oid, pid }) => { T.order_items = rows("order_items").filter((i) => !(i.order_id === oid && i.product_id === pid)); return null; },
    order_item_add: ({ oid, pid, qty }) => { rows("order_items").push({ order_id: oid, product_id: pid, qty_proposed: qty, qty_final: qty, qty_received: null, received_at: null, receipt_photos: [] }); return null; },
    order_add_list: ({ oid }) => PR.filter((p) => p.active && p.supplier === "cpf" && !rows("order_items").some((i) => i.order_id === oid && i.product_id === p.id))
      .map((p) => ({ product_id: p.id, name: p.name, label: p.name, unit: p.unit, unit_th: th(p.unit), pack_size: p.pack_size, kind: p.kind, sort: p.sort, category: p.category, buy_unit: p.buy_unit })),
    order_skip: ({ oid }) => { Object.assign(rows("orders").find((o) => o.id === oid) || {}, { status: "skipped", skipped_by: ME.userId, skipped_at: now() }); return null; },
    first_order: ({ d }) => { const o = rows("orders").find((x) => x.plan && x.plan.night === d); if (o) return { order_id: o.id };
      closeToday(T, { lines: [], consumables: [] }, now(), ME.userId); return { order_id: rows("orders").slice(-1)[0].id }; },
    set_opening_stock: ({ d, items }) => { for (const it of items || []) { let l = rows("stock_lines").find((x) => x.date === d && x.product_id === it.product_id);
      if (!l) rows("stock_lines").push(l = { date: d, product_id: it.product_id, open_fresh: 0, open_cooked: 0, received: 0, waste: 0 }); Object.assign(l, { remain_fresh: it.fresh ?? it.remain_fresh ?? it.qty ?? 0, remain_cooked: it.cooked ?? it.remain_cooked ?? 0 }); }
      return (items || []).length; },
    // 0093 bill check (Mos 3 Nov): the latest received order before today plays a bill paid at its bill total · the bill side is what came in,
    // with the first product 3 baht above our cost so the owner strip and bill-check.html have a gap · ใช้ราคาบนใบ / ยอมรับส่วนต่าง close it
    bill_open: () => billDemo().filter((b) => !b.settled_at && Math.abs(b.gap) > 1).map((b) => ({ order_id: b.order_id, for_date: b.for_date, paid: b.paid, system: b.system, gap: b.gap })),
    bill_check: ({ oid }) => billDemo().find((b) => b.order_id === oid) || null,
    bill_use_price: ({ pid, cost }) => { const p = rows("products").find((x) => x.id === pid); if (p) p.cost_price = +cost; return { ok: true }; },
    bill_accept_gap: ({ oid, note }) => { const st = (T.__bill ||= {})[oid]; if (st) Object.assign(st, { settled_at: now(), note }); return { ok: true }; },
    // 0092: paying a CPF bill needs the slip (same checks as the real pay_bill; the slip stays in this phone, pay-notify sends nothing)
    pay_bill: ({ oid, amount, slip }) => { if (!(+amount > 0 && +amount <= 100000)) throw new Error("ใส่ยอดเป็นตัวเลข 1 ถึง 100,000 บาท");
      if (!/^\d{4}\/\d{2}\/\d{2}\/payslip-[0-9a-f-]{36}\.jpg$/.test(slip || "")) throw new Error("แนบรูปสลิปก่อน");
      Object.assign(rows("orders").find((o) => o.id === oid) || {}, { paid_at: now(), paid_amount: r2(+amount), paid_slip: slip, paid_by: ME.userId }); return { ok: true }; },
    // 0098: "ใน 1 ชุดมี" for a new WE POS menu (same checks as the real menu_map_save; the demo has no new menus until one is added)
    menu_map_save: ({ p_name, p_items }) => { if (!p_name || !Array.isArray(p_items)) throw new Error("ข้อมูลไม่ครบ");
      if (p_items.some((i) => !rows("products").some((p) => p.id === i.product_id) || !(+i.qty > 0))) throw new Error("สินค้าหรือจำนวนไม่ถูก");
      T.wepos_menu_map = rows("wepos_menu_map").filter((r) => r.wepos_name !== p_name).concat(p_items.length ? p_items.map((i) => ({ wepos_name: p_name, product_id: i.product_id, qty: +i.qty, confidence: "mos" })) : [{ wepos_name: p_name, product_id: null, qty: null, confidence: "mos" }]);
      rows("wepos_menu_new").filter((r) => r.name === p_name).forEach((r) => { r.decided_at = now(); }); return { ok: true }; },
  };
  const r2 = (v) => Math.round(v * 100) / 100;
  function billDemo() {
    const o = rows("orders").filter((x) => x.for_date < D && rows("order_items").some((i) => i.order_id === x.id && i.received_at)).sort((a, b) => a.for_date < b.for_date ? -1 : 1).slice(-1)[0];
    if (!o) return [];
    const P = Object.fromEntries(rows("products").map((p) => [p.id, p])), its = rows("order_items").filter((i) => i.order_id === o.id && +i.qty_received > 0);
    const st = ((T.__bill ||= {})[o.id] ||= { unit: Object.fromEntries(its.map((i, k) => [i.product_id, (+P[i.product_id]?.cost_price || 0) + (k === 0 ? 3 : 0)])), settled_at: null, note: null });
    const rws = its.map((i) => { const p = P[i.product_id] || {}; return { product_id: i.product_id, name: p.name, unit: p.unit, received: +i.qty_received,
      cost: +p.cost_price || 0, bill_qty: +i.qty_received, bill_amount: r2((st.unit[i.product_id] ?? 0) * i.qty_received) }; });
    const system = r2(rws.reduce((a, r) => a + r.received * r.cost, 0) * 1.015), paid = r2(rws.reduce((a, r) => a + r.bill_amount, 0) * 1.015);
    return [{ order_id: o.id, for_date: o.for_date, paid, paid_slip: null, system, gap: r2(paid - system), fee_pct: 1.5, settled_at: st.settled_at, gap_note: st.note,
      bill_total: paid, photos: its.flatMap((i) => i.receipt_photos || []).filter((v, k, a) => a.indexOf(v) === k), rows: rws }];
  }
  const calls = (window.__calls = []);
  const client = {
    from,
    rpc(n, a) {
      calls.push(["rpc", n]);
      return { then(res, rej) { return Promise.resolve().then(() => {
        if (!(n in RPC)) { (window.__unstub ||= []).push(n); console.warn("demo: rpc not faked", n); return { data: null, error: null }; }
        let data; try { data = RPC[n](a || {}); } catch (e) { return { data: null, error: { message: e.message } }; } // a refused fake shows like a server error
        persist(); return { data, error: null };
      }).then(res, rej); } };
    },
    storage: { from: () => ({
      upload: async (path, blob) => { calls.push(["upload", path]); try { SHOTS[path] = URL.createObjectURL(blob); } catch (_) {} return { data: { path }, error: null }; },
      createSignedUrl: async (path) => ({ data: { signedUrl: SHOTS[path] || "img/mascot-240.png" }, error: null }),
      list: async () => ({ data: [], error: null }),
    }) },
  };
  const SHOTS = {}; // a photo picked on this page shows again from memory · it is never sent anywhere
  // LINE messages, the CPF order, notifications: answer like the real functions, send nothing
  async function fn(name, body) {
    calls.push(["fn", name]);
    if (name === "send-order") { const o = rows("orders").find((x) => x.id === body?.order_id); if (o) Object.assign(o, { status: "sent", sent_at: now(), sent_mode: "manual", approved_by: ME.userId }); persist(); }
    return { ok: true, sent: false, demo: true, message: "โหมดทดลอง ไม่ได้ส่งจริง" };
  }
  window.liff = { init: async () => {}, isLoggedIn: () => true, isInClient: () => false, getAccessToken: () => "demo", login() {}, logout() {}, closeWindow() { location.href = "index.html"; },
    getProfile: async () => ({ userId: "demo", displayName: ME.name }), getContext: () => null, sendMessages: async () => {} };
  window.supabase = { createClient: () => client };
  // a fake call never fails, but pages still call errText
  window.App = { ready: async () => ({ supabase: client, me: { ...ME }, jwt: "demo" }), fn, errText: (e) => String(e?.message || e || "ระบบมีปัญหา ลองใหม่อีกครั้ง") };
  window.DEMO = { state: S, reset: () => { SS.removeItem(DB_KEY); SS.removeItem(ST_KEY); } };

  // ---- 9. the yellow strip on every page (DESIGN.md wait tones) · tap "เปลี่ยน" to pick another role or moment
  const css = document.createElement("style");
  css.textContent = `:root{--demo-h:30px;--chrome-h:calc(96px + env(safe-area-inset-top))}
body{padding-top:var(--demo-h)!important}.topbar{top:var(--demo-h)!important}
.demo-bar{position:fixed;top:0;left:0;right:0;z-index:1000;height:var(--demo-h);display:flex;align-items:center;justify-content:center;gap:10px;padding:0 12px;
background:var(--tint-wait,#FFF6D6);color:var(--on-wait,#7A5B00);border-bottom:1px solid var(--border-wait,#EBD48A);font:600 12.5px/1 var(--font-body,sans-serif);white-space:nowrap}
.demo-bar a{color:inherit;text-decoration:underline;text-underline-offset:2px;font-weight:700;padding:8px 0}`;
  document.head.appendChild(css);
  const bar = () => { if (document.querySelector(".demo-bar")) return; const b = document.createElement("div"); b.className = "demo-bar"; b.setAttribute("role", "note");
    b.innerHTML = `<span>โหมดทดลอง · ข้อมูลปลอม · กดอะไรก็ไม่บันทึกจริง</span>${page === "start.html" ? "" : '<a href="start.html">เปลี่ยน</a>'}`; document.body.prepend(b); };
  if (document.body) bar(); else document.addEventListener("DOMContentLoaded", bar);
})();
