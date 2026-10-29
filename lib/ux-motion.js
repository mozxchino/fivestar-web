// Round 3 (Mos 23 ต.ค.): one shared helper for the bottom toast, "do it + undo for 5 s", the shake on a missing field and the number roll.
// UXM.toast(text, { ms, undo })  bottom toast, aria-live polite · undo: fn → shows "เลิกทำ"
// UXM.later(text, run, undo)      undo pattern: the UI changes now, run() hits the server after 5 s (or at once when the page hides / a link is tapped)
// UXM.shake(el)                   scroll to el, shake it, focus it (the caller shows the field's message)
// UXM.roll(el, dir)               slide a number in from below (dir > 0) or above (dir < 0)
// UXM.unit(u)                    product unit code from the CPF/POS list (EA, PC, ...) → Thai (same map as message.ts and order_display)
// UXM.bags(linesEl, products)    count rows for products with pack_size > 1: tap the สด box → sheet "ถุงเต็ม + เศษ", total written back
// UXM.dateTh(input, empty)        native date picker stays, the box shows Thai (จันทร์ 26 ต.ค.) instead of the phone's language
(function () {
  const still = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  let box = null, hideT = 0;
  const el = () => {
    if (box) return box;
    box = document.createElement("div"); box.className = "ux-toast"; box.setAttribute("role", "status"); box.setAttribute("aria-live", "polite");
    box.innerHTML = '<span></span><button type="button" hidden>เลิกทำ</button>';
    document.body.appendChild(box); return box;
  };
  if (document.body) el(); else document.addEventListener("DOMContentLoaded", el); // live region exists before the first message
  // keep the toast above a sticky bottom bar (approve · settings · close) so it never covers the red button
  const lift = () => { const s = [...document.querySelectorAll(".sticky")].find((x) => x.offsetParent && x.getBoundingClientRect().top < innerHeight);
    box.style.bottom = s ? `${Math.max(16, innerHeight - s.getBoundingClientRect().top + 8)}px` : ""; };
  function hide() { clearTimeout(hideT); if (box) box.classList.remove("on"); }
  function toast(text, o = {}) {
    const b = el(), btn = b.querySelector("button");
    clearTimeout(hideT); lift();
    b.querySelector("span").textContent = "";
    requestAnimationFrame(() => { b.querySelector("span").textContent = text; }); // fresh text → screen readers announce it
    btn.hidden = !o.undo; btn.onclick = o.undo ? () => { hide(); o.undo(); } : null;
    b.classList.add("on");
    hideT = setTimeout(hide, o.ms || (o.undo ? 5000 : 2000));
  }

  const pend = new Set();
  const flush = () => Promise.all([...pend].map((j) => j.fire())); // → resolves when the server calls are done
  function later(text, run, undo, ms = 5000) {
    flush(); // ponytail: one undo at a time · an older pending job commits when a new one starts
    const job = { done: false, fire() { if (job.done) return; job.done = true; clearTimeout(job.t); pend.delete(job); hide(); return Promise.resolve().then(run); } };
    job.t = setTimeout(() => job.fire(), ms);
    pend.add(job);
    toast(text, { ms, undo: () => { if (job.done) return; job.done = true; clearTimeout(job.t); pend.delete(job); undo && undo(); } });
    return job;
  }
  // LINE closes the page or the phone locks → commit now · ponytail: fetch during pagehide may be cut off, visibilitychange (earlier) is the main path
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush(); });
  addEventListener("pagehide", flush);
  // tapping a link inside the app while a job waits: commit first, then go
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a[href]"); if (!a || !pend.size || a.target || e.defaultPrevented) return;
    e.preventDefault(); flush().finally(() => { location.href = a.href; });
  }, true);

  function restart(x, cls) { x.classList.remove("ux-shake", "roll-up", "roll-dn"); void x.offsetWidth; x.classList.add(cls); x.addEventListener("animationend", () => x.classList.remove(cls), { once: true }); }
  function shake(x) {
    if (!x) return;
    x.scrollIntoView({ block: "center", behavior: still() ? "auto" : "smooth" });
    if (x.focus) x.focus({ preventScroll: true });
    restart(x, "ux-shake");
  }
  const roll = (x, dir) => { if (x && dir) restart(x, dir > 0 ? "roll-up" : "roll-dn"); };

  // Mos 26 ต.ค.: units came out as EA / PC and an iPhone set to English showed "Oct 26, 2026" in date boxes
  const UNIT = { EA: "ตัว", PC: "ชิ้น", PAC: "แพ็ค", BT: "ขวด", Kg: "กก." };
  const unit = (u) => (u ? UNIT[u] ?? u : "");
  const V = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
  const dateTh = (input, empty = "เลือกวัน") => {
    const w = document.createElement("span"), t = document.createElement("b");
    w.className = "th-date"; t.setAttribute("aria-hidden", "true"); input.before(w); w.append(input, t);
    const cell = !!input.closest(".cell"), cs = getComputedStyle(input), base = parseFloat(cs.minWidth) || 0;
    t.style.paddingLeft = cs.paddingLeft;
    const draw = () => {
      const v = V.get.call(input);
      t.textContent = v ? new Date(v + "T00:00:00Z").toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" }).replace(/^วัน(\S+?)ที่ /, "$1 ") : empty;
      w.classList.toggle("empty", !v);
      if (cell) input.style.minWidth = Math.max(base, Math.ceil(t.offsetWidth + parseFloat(cs.paddingRight))) + "px"; // the row box grows with the Thai text
    };
    Object.defineProperty(input, "value", { configurable: true, get() { return V.get.call(this); }, set(v) { V.set.call(this, v); draw(); } }); // .value = … from page code
    input.addEventListener("input", draw); input.addEventListener("change", draw); draw();
  };

  // 0046 (Mos 30 ต.ค.): ของที่มาเป็นถุง/แพ็ค นับเป็น "กี่ถุงเต็ม + เศษกี่ตัว" · the สด box of such a row is read-only, a tap opens one shared sheet,
  // the sheet writes the total back (and fires input so the page's own validation runs) · UXM.bags(linesEl, products)
  let bagDlg = null;
  const bagEl = () => {
    if (bagDlg) return bagDlg;
    bagDlg = document.createElement("dialog"); bagDlg.id = "bagS"; bagDlg.className = "bsheet"; bagDlg.setAttribute("aria-labelledby", "bagT");
    bagDlg.innerHTML = `<div class="body"><div class="grab"></div><div class="hd"><b id="bagT"></b><button type="button" class="x" aria-label="ปิด">✕</button></div>
      <p class="bag-hint" id="bagH"></p>
      <label class="field" for="bagB" id="bagBl">ถุงเต็ม</label><div class="in"><input id="bagB" type="number" inputmode="numeric" pattern="[0-9]*" min="0" enterkeyhint="next" placeholder="0"><span class="sfx" id="bagBu">ถุง</span></div>
      <label class="field" for="bagL" id="bagLl">นอกถุง (เศษ)</label><div class="in"><input id="bagL" type="number" inputmode="numeric" pattern="[0-9]*" min="0" enterkeyhint="done" placeholder="0"><span class="sfx" id="bagLu">ตัว</span></div>
      <div class="bag-total">รวม <b id="bagN">0</b> <span id="bagNu"></span></div>
      <button type="button" class="btn primary" id="bagOK">ตกลง</button></div>`;
    document.body.appendChild(bagDlg);
    // Enter / "ถัดไป" / "เสร็จ" on the keyboard: first box → second box · second box → ตกลง
    bagDlg.querySelector("#bagB").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); bagDlg.querySelector("#bagL").focus(); } });
    bagDlg.querySelector("#bagL").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); bagDlg.querySelector("#bagOK").click(); } });
    bagDlg.addEventListener("click", (e) => { if (e.target === bagDlg || e.target.closest(".x")) bagDlg.close(); });
    // the iPhone number pad has no Enter key and covers the bottom of the screen → lift the sheet above the keyboard so ตกลง stays visible (taps are enough)
    const vv = window.visualViewport;
    const fit = () => { if (!bagDlg.open || !vv) return; bagDlg.style.bottom = Math.max(0, innerHeight - vv.height - vv.offsetTop) + "px"; bagDlg.style.maxHeight = Math.max(260, vv.height - 12) + "px"; };
    if (vv) { vv.addEventListener("resize", fit); vv.addEventListener("scroll", fit); }
    bagDlg.fit = fit; bagDlg.addEventListener("close", () => { bagDlg.style.bottom = ""; bagDlg.style.maxHeight = ""; });
    return bagDlg;
  };
  function bags(root, prods) {
    const by = {}; (prods || []).forEach((p) => { by[p.id] = p; });
    root.querySelectorAll(".grid[data-id]").forEach((g) => {
      const p = by[g.dataset.id], rf = g.querySelector(".rf"); if (!p || !rf || !(+p.pack_size > 1)) return;
      const pk = +p.pack_size, bu = p.buy_unit || "ถุง", u = unit(p.unit) || "ชิ้น";
      rf.readOnly = true; rf.setAttribute("inputmode", "none"); rf.placeholder = "แตะ";
      const say = () => { let m = g.querySelector(".bagsay"); if (!m) { m = document.createElement("span"); m.className = "bagsay"; g.querySelector(".meta")?.appendChild(m); }
        m.textContent = rf.dataset.b !== undefined ? `สด ${+rf.dataset.b || 0} ${bu} + ${+rf.dataset.l || 0} ${u}` : ""; };
      const open = () => {
        const d = bagEl(), B = d.querySelector("#bagB"), L = d.querySelector("#bagL"), N = d.querySelector("#bagN");
        d.querySelector("#bagT").textContent = `${p.name} เหลือสด`;
        d.querySelector("#bagH").textContent = `1 ${bu} = ${pk} ${u}\nนับ${bu}ที่ยังเต็ม แล้วนับที่เหลือนอก${bu}`; // 2 lines, no middot (css: pre-line)
        d.querySelector("#bagBl").textContent = `${bu}เต็ม`; d.querySelector("#bagLl").textContent = `นอก${bu} (เศษ)`;
        d.querySelector("#bagBu").textContent = bu; d.querySelector("#bagLu").textContent = u; d.querySelector("#bagNu").textContent = u;
        B.value = rf.dataset.b ?? ""; L.value = rf.dataset.l ?? (rf.dataset.b === undefined && rf.value !== "" ? rf.value : "");
        const sum = () => { N.textContent = (+B.value || 0) * pk + (+L.value || 0); }; B.oninput = L.oninput = sum; sum();
        d.querySelector("#bagOK").onclick = () => {
          if (B.value === "" && L.value === "") { delete rf.dataset.b; delete rf.dataset.l; rf.value = ""; }
          else { rf.dataset.b = +B.value || 0; rf.dataset.l = +L.value || 0; rf.value = (+B.value || 0) * pk + (+L.value || 0); }
          say(); rf.dispatchEvent(new Event("input", { bubbles: true })); rf.dispatchEvent(new Event("change", { bubbles: true })); d.close();
          const nx = [...root.querySelectorAll("input:not([disabled])")].filter((i) => i.offsetParent); const i = nx.indexOf(rf); if (nx[i + 1]) nx[i + 1].focus();
        };
        d.showModal(); setTimeout(() => { B.focus(); d.fit(); }, 60);
      };
      rf.addEventListener("click", open); rf.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
    });
  }

  // 0046 (Mos 30 ต.ค.): a number box that already shows 0 (or 10) must not turn into 012 when typed into → select all on focus;
  // iOS ignores select() on some builds, so a plain 0 is cleared too and comes back on blur when nothing was typed
  document.addEventListener("focusin", (e) => { const el = e.target; if (!(el instanceof HTMLInputElement) || el.type !== "number" || el.readOnly) return;
    try { el.select(); } catch (_) {}
    if (el.value !== "" && +el.value === 0) { el.dataset.z0 = el.value; el.value = ""; } });
  document.addEventListener("focusout", (e) => { const el = e.target; if (!(el instanceof HTMLInputElement) || el.dataset.z0 === undefined) return;
    if (el.value === "") el.value = el.dataset.z0; delete el.dataset.z0; });

  window.UXM = { toast, hide, later, flush, shake, roll, unit, dateTh, bags };
})();
