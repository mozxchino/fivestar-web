// ux-audit-2 stream "data" (settings · costs): bottom sheet on a native <dialog class="bsheet">
// UXD.sheet(dlg) → { open(), close() } · tap on the dim area, the × or a [data-close] button closes it (Escape: native)
window.UXD = {
  sheet(dlg) {
    dlg.addEventListener("click", (e) => { if (e.target === dlg || e.target.closest(".x, [data-close]")) dlg.close(); });
    // Mos 5 พ.ย.: the iPhone keyboard covered the box being typed in (เพิ่มรายการ: search results, the bag count) · every sheet now sits on top of
    // the keyboard (same lift as the bag sheet in ux-motion.js) and scrolls the focused box into view: a search box to the top so its results show under it
    const vv = window.visualViewport, body = dlg.querySelector(".body");
    const show = () => { const a = document.activeElement; if (!body || !a || !body.contains(a) || !a.matches("input, textarea, select")) return;
      const r = a.getBoundingClientRect(), b = body.getBoundingClientRect();
      if (a.type === "text" || a.type === "search") body.scrollTop += r.top - b.top - 8;
      else if (r.bottom > b.bottom - 8) body.scrollTop += r.bottom - b.bottom + 8; else if (r.top < b.top) body.scrollTop += r.top - b.top - 8; };
    const fit = () => { if (!dlg.open || !vv) return; const full = dlg.classList.contains("full");
      dlg.style.bottom = Math.max(0, innerHeight - vv.height - vv.offsetTop) + "px";
      if (full) { dlg.style.top = vv.offsetTop + "px"; dlg.style.height = dlg.style.maxHeight = vv.height + "px"; }
      else dlg.style.maxHeight = Math.max(260, vv.height - 12) + "px";
      requestAnimationFrame(show); };
    if (vv) { vv.addEventListener("resize", fit); vv.addEventListener("scroll", fit); }
    dlg.addEventListener("focusin", () => setTimeout(fit, 50));
    dlg.addEventListener("close", () => { ["bottom", "top", "height", "maxHeight"].forEach((k) => { dlg.style[k] = ""; }); });
    return { open: () => { dlg.showModal(); if (body) body.scrollTop = 0; fit(); }, close: () => dlg.close() };
  },
};
