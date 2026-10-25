// Mos 26 ต.ค. (iPhone, LINE): the grey skeleton stayed above the loaded home page.
// ui.css hides a .sk with `.sk:has(~ .ld:not([hidden]):not(:empty))`, but LINE's iOS WebKit does not re-check that rule
// when content is written INTO an empty sibling (index.html and history.html fill .ld nodes instead of un-hiding them).
// So the skeleton is removed here for real once a later sibling .ld shows content, or the page shows #blocked / a .ux-block
// (success, slow load and failed load all end in one of those). A load that never ends keeps its skeleton, on purpose.
(function () {
  const sweep = () => {
    const blocked = document.querySelector("#blocked:not([hidden]), .ux-block");
    document.querySelectorAll(".sk").forEach((s) => {
      let n = s.nextElementSibling;
      while (n && !n.matches(".ld:not([hidden]):not(:empty)")) n = n.nextElementSibling;
      if (n || blocked) s.remove();
    });
    if (document.readyState !== "loading" && !document.querySelector(".sk")) mo.disconnect(); // still parsing: the .sk may not be in yet
  };
  const mo = new MutationObserver(sweep);
  mo.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["hidden"] });
})();
