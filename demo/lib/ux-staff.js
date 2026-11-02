// Staff-side helpers (ux-audit-2 · stream staff): today's real status → next task, and the "งานถัดไป" button on done screens.
// Reads only what staff RLS already allows: shop_days (30 days) · orders/order_items (today ±1).
(function () {
  const today = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10); // Bangkok date
  const bizDay = () => new Date(Date.now() + 2 * 3600e3).toISOString().slice(0, 10); // same as app.business_day(): before 05:00 Bangkok still counts as yesterday (0047)
  const back = (n) => { const d = new Date(today() + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
  const hm = (t) => t ? new Date(t).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Bangkok" }) : "";
  const thd = (d, o) => new Date(d + "T00:00:00Z").toLocaleDateString("th-TH", Object.assign({ day: "numeric", month: "short", timeZone: "UTC" }, o));
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  // Pure: day row + today's sent order items → where the staff member is in the day.
  function plan(day, items) {
    items = items || [];
    const waiting = items.some((i) => i.qty_received == null && i.received_at == null);
    const got = items.filter((i) => i.received_at);
    const short = got.filter((i) => +i.qty_received < +(i.qty_final ?? i.qty_proposed)).length;
    const recvAt = got.map((i) => i.received_at).sort()[0] || null;
    const receive = !items.length ? "none" : waiting ? "wait" : short ? "short" : "ok";
    const closed = day?.status === "sent" || day?.status === "closed";
    let next;
    if (day?.status === "holiday") next = { key: "holiday", label: "วันนี้ร้านหยุด", sub: "ดูประวัติ 30 วัน", href: "history.html" };
    else if (closed) next = { key: "done", label: "ปิดร้านแล้ว วันนี้", sub: `ปิด ${hm(day.closed_at)} น. แตะดูประวัติ 30 วัน`, href: "history.html" };
    else if (!day?.opened_at) next = { key: "open", label: "เปิดร้าน", sub: "ถ่ายรูปหน้าร้าน แล้วกดเปิด", href: "open.html" };
    else if (waiting) next = { key: "receive", label: "รับของ", sub: `ของ CPF ${items.length} อย่าง นับแล้วกดรับ`, href: "receive.html" };
    else next = { key: "close", label: "ปิดร้าน", sub: "นับของเหลือ นับเงิน ถ่าย 2 รูป", href: "close.html" };
    return { day, receive, short, recvAt, next };
  }

  async function status(supabase) {
    const d = today();
    const [a, b] = await Promise.all([
      supabase.from("shop_days").select("status,opened_at,closed_at").eq("date", d).maybeSingle(),
      supabase.from("orders").select("id,order_items(qty_proposed,qty_final,qty_received,received_at)").eq("for_date", d)
        .in("status", ["sent", "failed"]).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (a.error || b.error) throw a.error || b.error; // qa3 #2: a failed order read is not "ไม่มีของมา"
    return plan(a.data, b.data?.order_items);
  }

  // Done screens: add the next-task button (red by default) into/after `el`.
  async function showNext(supabase, el, primary = true, where = "beforeend") {
    try {
      const st = await status(supabase), n = st.next;
      // Mos 26 ต.ค.: ปิดร้าน is offered only once today's goods are in (or the shop said none came) · straight after
      // opening with no order on file the natural step is the home page, which shows the day, never "ไปปิดร้าน"
      if (n.key === "close" && st.receive === "none") return el.insertAdjacentHTML(where, `<a class="btn${primary ? " primary" : ""} ux-next" href="index.html">กลับหน้าหลัก</a>`);
      const t = n.key === "done" || n.key === "holiday" ? "ดูประวัติ" : "ไป" + n.label; // ไปรับของ, ไปปิดร้าน (verb + thing, no dot in buttons)
      el.insertAdjacentHTML(where, `<a class="btn${primary && t !== "ดูประวัติ" ? " primary" : ""} ux-next" href="${n.href}">${t}</a>`);
    } catch (e) { console.error("next task", e); } // ponytail: no button if the read fails · the back arrow still goes home
  }

  // round 6 (manager role): a page this role can't use → one mascot block with the reason and the way out, instead of a form the server would refuse
  // only(me, ["staff", "owner"], "หน้านี้สำหรับพนักงานในร้าน", "…", "owner.html", "ไปหน้าวันนี้") → true when blocked
  function only(me, roles, title, sub, href, label) {
    if (roles.includes(me.role)) return false;
    document.body.classList.add("ux-only");
    document.querySelector(".topbar").insertAdjacentHTML("afterend", `<section class="done ux-block" role="status"><span class="mascot"><img src="img/mascot-240.png" alt="" width="80" height="80"></span><h2>${esc(title)}</h2><p>${esc(sub)}</p><div class="acts"><a class="btn primary" href="${esc(href)}">${esc(label)}</a></div></section>`);
    return true;
  }
  const ROLE = { owner: "เจ้าของ", manager: "ผู้จัดการ", staff: "พนักงาน" };

  window.UXS = { today, bizDay, back, hm, thd, esc, plan, status, showNext, only, ROLE };
})();
