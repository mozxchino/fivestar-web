// ux-audit-2 stream "data" (settings · costs): bottom sheet on a native <dialog class="bsheet">
// UXD.sheet(dlg) → { open(), close() } · tap on the dim area or the × closes it
window.UXD = {
  sheet(dlg) {
    dlg.addEventListener("click", (e) => { if (e.target === dlg || e.target.closest(".x")) dlg.close(); });
    return { open: () => { dlg.showModal(); dlg.querySelector(".body").scrollTop = 0; }, close: () => dlg.close() };
  },
};
