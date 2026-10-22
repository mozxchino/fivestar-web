// Resize on-device (long side ≤ 1600px, JPEG q0.82) then upload to bucket photos under today's Bangkok date.
// Photo.picker: camera-only input + thumbnails (tap = full screen, ✕ = drop from the list) — one helper for every page.
(function () {
  const FRESH_MS = 3 * 60 * 1000;
  const STALE = "ต้องถ่ายใหม่ตอนนี้ · เลือกรูปจากเครื่องไม่ได้";
  function todayPrefix() {
    const d = new Date(Date.now() + 7 * 3600 * 1000);          // Bangkok wall clock
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getUTCFullYear()}/${p(d.getUTCMonth() + 1)}/${p(d.getUTCDate())}/`;
  }
  // ponytail: iOS/LINE own the picker, so a gallery photo can't be blocked outright; a just-taken photo has lastModified ≈ now,
  // an old gallery photo doesn't. Unknown lastModified (0/missing) is let through.
  function isFresh(file, now = Date.now()) {
    const t = Number(file?.lastModified) || 0;
    return !t || now - t <= FRESH_MS;
  }
  async function shrink(file) {
    const bmp = await createImageBitmap(file);
    const s = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise((r) => c.toBlob(r, "image/jpeg", 0.82));
  }
  async function put(supabase, type, blob) {
    const path = `${todayPrefix()}${type}-${crypto.randomUUID()}.jpg`;
    const { error } = await supabase.storage.from("photos").upload(path, blob, { contentType: "image/jpeg", upsert: false });
    if (error) throw error;
    return path;
  }
  async function upload(supabase, type, file) { return put(supabase, type, await shrink(file)); }
  async function url(supabase, path) {
    const { data, error } = await supabase.storage.from("photos").createSignedUrl(path, 3600);
    if (error) throw error;
    return data.signedUrl;
  }
  function view(src) {
    const o = document.createElement("div");
    o.className = "photo-view"; o.setAttribute("role", "dialog"); o.setAttribute("aria-label", "รูปเต็มจอ แตะเพื่อปิด");
    o.innerHTML = `<img alt="รูปที่ถ่าย"><p>แตะเพื่อปิด</p>`;
    o.querySelector("img").src = src;
    o.onclick = () => o.remove();
    document.body.appendChild(o);
  }
  // paths: the array the page sends to the server (mutated in place) · max 1 = a new photo replaces the old one
  // ponytail: a deleted photo stays in storage as an orphan file; only its path leaves the list
  function picker(supabase, input, o) {
    const { paths, type, name, max = Infinity, failText } = o;
    input.removeAttribute("multiple");
    input.setAttribute("accept", "image/*"); input.setAttribute("capture", "environment");
    const box = document.createElement("div"); box.className = "thumbs";
    const status = o.status || Object.assign(document.createElement("p"), { className: "muted" });
    // thumbnails + count sit right under their own button (an existing status line is moved there)
    input.closest("label").after(box);
    box.after(status);
    const shots = []; // { path, src }
    const say = (t) => { status.textContent = t; };
    const draw = () => {
      box.innerHTML = "";
      shots.forEach((s, i) => {
        const d = document.createElement("div"); d.className = "thumb";
        d.innerHTML = `<button type="button" class="see" aria-label="ดู${name}รูปที่ ${i + 1} เต็มจอ"><img alt=""></button><button type="button" class="x" aria-label="ลบรูปนี้"><span aria-hidden="true">✕</span></button>`;
        d.querySelector("img").src = s.src;
        d.querySelector(".see").onclick = () => view(s.src);
        d.querySelector(".x").onclick = () => { URL.revokeObjectURL(s.src); shots.splice(i, 1); paths.splice(i, 1); draw(); };
        box.appendChild(d);
      });
      say(shots.length ? `${name} ${shots.length} รูป · แตะรูปเพื่อดูใหญ่` : "");
      o.onChange?.(paths);
    };
    input.onchange = async () => {
      const f = input.files[0]; input.value = "";
      if (!f) return;
      if (!isFresh(f)) { say(STALE); return; }
      if (shots.length >= max && max > 1) { say(`ได้ถึง ${max} รูป · ลบรูปเดิมก่อน`); return; }
      say("กำลังส่งรูป…");
      try {
        const blob = await shrink(f);
        const path = await put(supabase, type, blob);
        if (max === 1 && shots.length) { URL.revokeObjectURL(shots[0].src); shots.length = 0; paths.length = 0; }
        shots.push({ path, src: URL.createObjectURL(blob) }); paths.push(path);
        draw();
      } catch (e) { say(failText || "ส่งรูปไม่ขึ้น ลองถ่ายใหม่: " + App.errText(e)); }
    };
    return { paths };
  }
  window.Photo = { upload, url, todayPrefix, picker, isFresh, STALE };
})();
