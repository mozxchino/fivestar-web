// Resize on-device (long side ≤ 1600px, JPEG q0.82) then upload to bucket photos under today's Bangkok date.
(function () {
  function todayPrefix() {
    const d = new Date(Date.now() + 7 * 3600 * 1000);          // Bangkok wall clock
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getUTCFullYear()}/${p(d.getUTCMonth() + 1)}/${p(d.getUTCDate())}/`;
  }
  async function shrink(file) {
    const bmp = await createImageBitmap(file);
    const s = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise((r) => c.toBlob(r, "image/jpeg", 0.82));
  }
  async function upload(supabase, type, file) {
    const blob = await shrink(file);
    const path = `${todayPrefix()}${type}-${crypto.randomUUID()}.jpg`;
    const { error } = await supabase.storage.from("photos").upload(path, blob, { contentType: "image/jpeg", upsert: false });
    if (error) throw error;
    return path;
  }
  async function url(supabase, path) {
    const { data, error } = await supabase.storage.from("photos").createSignedUrl(path, 3600);
    if (error) throw error;
    return data.signedUrl;
  }
  window.Photo = { upload, url, todayPrefix };
})();
