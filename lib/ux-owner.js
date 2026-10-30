// ux-audit-2 · owner stream helpers shared by owner.html and holiday.html (owner view)
(function () {
  const WD = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัส", "ศุกร์", "เสาร์"];
  const MON = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  const LEAVE = { off: "หยุดประจำสัปดาห์", sick: "ลาป่วย", personal: "ลากิจ", special: "หยุดพิเศษ" };
  const today = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
  const bizDay = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10); // app.business_day(): before 05:00 Bangkok = yesterday
  const plus = (d, n) => { const x = new Date(d + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  const short = (d) => `${+d.slice(8, 10)} ${MON[+d.slice(5, 7) - 1]}`;          // 23 ต.ค.
  const dayName = (d) => `${WD[new Date(d + "T00:00:00Z").getUTCDay()]} ${short(d)}`; // ศุกร์ 23 ต.ค.
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // same words as leaveReplyText() in supabase/functions/_shared/message.ts
  function leaveText(r) {
    if (!r) return "ไม่พบคำขอ";
    if (r.error === "cancelled") return "คำขอนี้ยกเลิกแล้ว";
    if (r.error === "already") return `ตัดสินไปแล้ว: ${r.status === "approved" ? "อนุมัติ" : "ไม่อนุมัติ"}`;
    if (r.error) return "ไม่พบคำขอ";
    return `${r.status === "approved" ? "อนุมัติแล้ว" : "ไม่อนุมัติ"}: ${LEAVE[r.type] || r.type} ${short(String(r.date))} ของ ${r.name}`;
  }
  // → { ok, text } · ok=false only when the server call itself failed (the card stays)
  async function decideLeave(supabase, id, approve) {
    const { data, error } = await supabase.rpc("owner_decide_leave", { p_id: id, p_approve: approve });
    if (error) return { ok: false, text: "ทำไม่ได้ ลองกดอีกครั้ง\n" + App.errText(error) };
    return { ok: true, text: leaveText(data), data };
  }
  // fold rows: <button class="fold" aria-expanded="false"> + <div class="fold-body"><div>…</div></div>
  function folds(root, onOpen) {
    root.addEventListener("click", (e) => {
      const b = e.target.closest("button.fold"); if (!b || !root.contains(b)) return;
      const open = b.getAttribute("aria-expanded") !== "true";
      b.setAttribute("aria-expanded", String(open));
      if (open && onOpen) onOpen(b);
    });
  }
  window.UxOwner = { WD, MON, LEAVE, today, bizDay, plus, short, dayName, esc, leaveText, decideLeave, folds };

  // holiday.html owner view (P2-7): no request form · pending requests with อนุมัติ/ไม่อนุมัติ · month calendar of who is off
  window.HolidayOwner = async function (supabase) {
    const el = (id) => document.getElementById(id);
    ["cnt", "form", "listh", "list"].forEach((id) => { if (el(id)) el(id).hidden = true; });
    const own = el("own"); own.hidden = false; document.body.classList.add("grouped"); // mock ก lists for the owner view
    const T = today();
    const addM = (m, n) => new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7) - 1 + n, 1)).toISOString().slice(0, 7);
    const days = (m) => new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7), 0)).getUTCDate();
    const NOW = T.slice(0, 7), LAST = addM(NOW, 1); // requests reach 30 days ahead → this month + next
    let M = NOW;
    const sb = (w, h, x = "") => `<i class="sk-b" style="--w:${w};--h:${h}px${x}"></i>`;
    own.innerHTML = `<div id="pend"><span class="vh">กำลังเปิด…</span><h3 class="sec">${sb("30%", 15)}</h3><div class="card todo">${sb("66%", 18)}${sb("44%", 14, ";--gap:8px")}<div class="acts sk-row">${sb("calc(50% - 4px)", 44, ";--r:12px")}${sb("calc(50% - 4px)", 44, ";--r:12px")}</div></div></div><div class="cal-nav"><h2 id="calh"></h2><div><button id="cp" aria-label="เดือนก่อน">‹</button><button id="cn" aria-label="เดือนถัดไป">›</button></div></div><div id="cal" class="cal"></div>
      <div class="legend"><i class="ok">หยุด/ลา อนุมัติแล้ว</i><i class="wait">รออนุมัติ</i><span>ช่องเทา = ร้านหยุด</span></div>`;

    async function pending() {
      const { data, error } = await supabase.from("leave_requests").select("id,user_id,date,type,note,status,users:user_public(name)").eq("status", "pending").gte("date", T).order("date");
      if (error) { el("pend").innerHTML = `<p class="err">เปิดไม่ขึ้น: ${esc(App.errText(error))}</p>`; return; }
      const rows = (data || []).filter((r) => r.status === "pending" && r.date >= T);
      el("pend").innerHTML = `<h3 class="sec"${rows.length ? ' data-tone="wait"' : ""}>รออนุมัติ<span class="n">${rows.length ? `${rows.length} เรื่อง` : "ไม่มี"}</span></h3>` + (rows.length ? rows.map((r) => `<div class="card todo"><div class="t">${esc(r.users?.name || "-")} ${LEAVE[r.type] || esc(r.type)} ${dayName(r.date)}</div>${r.note ? `<div class="s">${esc(r.note)}</div>` : ""}
        <div class="acts"><button class="btn sm" data-i="${r.id}" data-ok="0">ไม่อนุมัติ</button><button class="btn sm tonal" data-i="${r.id}" data-ok="1">อนุมัติ</button></div></div>`).join("")
        : `<div class="empty tight"><img class="mascot sm" src="img/mascot-240.png" alt="" width="56" height="56"><p>ไม่มีคำขอรออนุมัติ</p></div>`);
    }
    async function cal() {
      el("calh").textContent = `ใครหยุดวันไหน ${MON[+M.slice(5, 7) - 1]} ${+M.slice(0, 4) + 543}`;
      el("cp").disabled = M <= addM(NOW, -6); el("cn").disabled = M >= LAST;
      const first = M + "-01", last = `${M}-${String(days(M)).padStart(2, "0")}`;
      const [{ data: lv }, { data: st }] = await Promise.all([
        supabase.from("leave_requests").select("date,status,users:user_public(name)").gte("date", first).lte("date", last).in("status", ["approved", "pending"]),
        supabase.from("settings").select("key,value").eq("key", "holidays").maybeSingle()]);
      const shut = new Set(Array.isArray(st?.value) ? st.value : []);
      const by = {}; (lv || []).filter((r) => r.date >= first && r.date <= last && (r.status === "approved" || r.status === "pending")).forEach((r) => (by[r.date] = by[r.date] || []).push(r));
      const pad = (new Date(first + "T00:00:00Z").getUTCDay() + 6) % 7; // week starts Monday
      let h = ["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"].map((w) => `<div class="wd">${w}</div>`).join("") + `<div class="c out"></div>`.repeat(pad);
      for (let i = 1; i <= days(M); i++) {
        const d = `${M}-${String(i).padStart(2, "0")}`, who = by[d] || [];
        h += `<div class="c${d === T ? " today" : ""}${shut.has(d) ? " shut" : ""}"><span class="n">${i}</span>${who.map((r) => `<i class="${r.status === "approved" ? "ok" : "wait"}">${esc(r.users?.name || "-")}</i>`).join("")}${shut.has(d) && !who.length ? `<i class="shop">ร้านหยุด</i>` : ""}</div>`;
      }
      el("cal").innerHTML = h;
    }
    el("cp").onclick = () => { M = addM(M, -1); cal(); };
    el("cn").onclick = () => { M = addM(M, 1); cal(); };
    // round 3 ง1: the card leaves now · owner_decide_leave runs after 5 s unless "เลิกทำ" (UXM in lib/ux-motion.js)
    el("pend").onclick = (e) => {
      const b = e.target.closest("button[data-i]"); if (!b) return;
      const card = b.closest(".todo"), ok = b.dataset.ok === "1"; card.querySelectorAll("button").forEach((x) => (x.disabled = true));
      card.classList.add("gone"); setTimeout(() => { if (card.classList.contains("gone")) card.hidden = true; }, 200);
      const back = () => { card.hidden = false; card.querySelectorAll("button").forEach((x) => (x.disabled = false)); requestAnimationFrame(() => card.classList.remove("gone")); };
      UXM.later(`${ok ? "อนุมัติ" : "ไม่อนุมัติ"} ${card.querySelector(".t").textContent}`, async () => {
        const r = await decideLeave(supabase, b.dataset.i, ok);
        if (!r.ok || r.data?.error) UXM.toast(r.text, { ms: 4000 });
        if (!r.ok) return back();
        await Promise.all([pending(), cal()]);
      }, back);
    };
    await Promise.all([pending(), cal()]);
  };
})();
