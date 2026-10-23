// Round 3 (Mos 23 ต.ค.): one shared helper for the bottom toast, "do it + undo for 5 s", the shake on a missing field and the number roll.
// UXM.toast(text, { ms, undo })  bottom toast, aria-live polite · undo: fn → shows "เลิกทำ"
// UXM.later(text, run, undo)      undo pattern: the UI changes now, run() hits the server after 5 s (or at once when the page hides / a link is tapped)
// UXM.shake(el)                   scroll to el, shake it, focus it (the caller shows the field's message)
// UXM.roll(el, dir)               slide a number in from below (dir > 0) or above (dir < 0)
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

  window.UXM = { toast, hide, later, flush, shake, roll };
})();
