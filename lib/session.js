// Shared bootstrap: LIFF login → exchange for Supabase JWT → supabase client with that JWT.
(function () {
  const C = window.CONFIG;
  const KEY = "fs_session_v1";
  async function exchange() {
    const token = liff.getAccessToken();
    const r = await fetch(`${C.SUPABASE_URL}/functions/v1/auth`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ liffToken: token }),
    });
    const j = await r.json();
    if (r.status === 403) { location.replace(`denied.html?u=${encodeURIComponent(j.lineUserId)}&n=${encodeURIComponent(j.displayName || "")}`); throw new Error("denied"); }
    if (!r.ok) throw new Error(j.error || "auth failed");
    const s = { jwt: j.jwt, me: { userId: j.userId, role: j.role, name: j.name }, at: Date.now() };
    sessionStorage.setItem(KEY, JSON.stringify(s));
    return s;
  }
  async function ready() {
    try { await liff.init({ liffId: C.LIFF_ID }); }
    catch (_) { throw new Error("ยังไม่ได้ตั้งค่า LIFF ID"); }
    if (!liff.isLoggedIn()) { liff.login({ redirectUri: location.href }); return new Promise(() => {}); }
    let s = null;
    try { s = JSON.parse(sessionStorage.getItem(KEY) || "null"); } catch (_) { s = null; }
    if (!s || Date.now() - s.at > 11 * 3600 * 1000) s = await exchange();
    const supabase = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${s.jwt}` } }, auth: { persistSession: false },
    });
    return { supabase, me: s.me, jwt: s.jwt };
  }
  async function fn(name, body) {
    const s = JSON.parse(sessionStorage.getItem(KEY));
    const r = await fetch(`${C.SUPABASE_URL}/functions/v1/${name}`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${s.jwt}` }, body: JSON.stringify(body || {}),
    });
    return r.json();
  }
  window.App = { ready, fn };
})();
