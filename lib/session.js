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
    if (!r.ok) { console.error("auth", j.error); throw new Error("เข้าแอปไม่ได้ ปิดแล้วเปิดใหม่ใน LINE"); }
    const s = { jwt: j.jwt, me: { userId: j.userId, role: j.role, name: j.name }, at: Date.now() };
    sessionStorage.setItem(KEY, JSON.stringify(s));
    return s;
  }
  async function ready() {
    try { await liff.init({ liffId: C.LIFF_ID }); }
    catch (e) { console.error(e); throw new Error(C.LIFF_ID.startsWith("<") ? "ยังไม่ได้ตั้งค่า LIFF ID" : "เปิดใน LINE ไม่ขึ้น ปิดแล้วเปิดใหม่ใน LINE"); }
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
    const s = JSON.parse(sessionStorage.getItem(KEY) || "null");
    if (!s) throw new Error("ต้องเปิดแอปใหม่");
    const r = await fetch(`${C.SUPABASE_URL}/functions/v1/${name}`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${s.jwt}` }, body: JSON.stringify(body || {}),
    });
    return r.json();
  }
  // Any error → plain Thai: what happened + what to do next. Thai text from our own `raise exception` passes through.
  // Round 2: the help line depends on the role (owner and manager have no "แจ้งปัญหา" button).
  const role = () => { try { return JSON.parse(sessionStorage.getItem(KEY) || "null")?.me?.role || "staff"; } catch (_) { return "staff"; } };
  const help = () => (role() === "staff" ? "ถ้ายังไม่ได้ กดแจ้งปัญหา" : "ถ้ายังไม่ได้ ปิดแล้วเปิดแอปใหม่ใน LINE");
  const perm = () => (role() === "owner" ? "บัญชีนี้ทำเรื่องนี้ไม่ได้\nปิดแล้วเปิดแอปใหม่ใน LINE แล้วลองอีกครั้ง" : "บัญชีนี้ทำเรื่องนี้ไม่ได้\nให้เจ้าของทำ หรือปิดแล้วเปิดแอปใหม่");
  const NUM = "ช่องนี้ใส่ได้แค่ตัวเลข\nลบตัวอักษรออก แล้วกดอีกครั้ง"; // a letter typed in a number box (Postgres 22P02)
  // rule text: a string (the help line is added) or a function that gives the whole message
  const RULES = [
    [/failed to fetch|networkerror|load failed|network request failed|timeout|aborted/i, "เน็ตหลุด เช็กสัญญาณแล้วกดอีกครั้ง"],
    [/jwt expired|pgrst30[13]|invalid jwt|bad_token|jwt/i, () => "เข้าแอปนานเกินไป\nปิดแล้วเปิดแอปใหม่ใน LINE"],
    [/owner only/i, () => "ทำได้เฉพาะเจ้าของ\nให้เจ้าของทำให้"],
    [/receiving allowed only for today/i, "รับของได้เฉพาะของวันนี้"],
    [/staff (cannot|may only)|must be self|42501|permission denied|row-level security/i, perm],
    [/23505|duplicate key/i, "มีอยู่แล้ว ไม่ต้องบันทึกซ้ำ เปิดหน้าใหม่แล้วดูอีกครั้ง"],
    [/23514|check constraint|violates check/i, "ตัวเลขไม่ถูก ตรวจช่องที่กรอกแล้วกดอีกครั้ง"],
    [/23502|not-null|null value/i, "กรอกไม่ครบ ตรวจช่องที่ว่างแล้วกดอีกครั้ง"],
    [/22P02|invalid input syntax/i, () => NUM],
  ];
  const rule = (all) => { for (const [re, th] of RULES) if (re.test(all)) return typeof th === "function" ? th() : `${th}\n${help()}`; };
  function errText(e) {
    const raw = String(e?.message || e?.error || e || "");
    const all = `${e?.code || ""} ${raw} ${e?.details || ""} ${e?.hint || ""}`;
    // Postgres quotes the typed value, which can be Thai letters → check this one before the Thai pass-through
    if (/22P02|invalid input syntax/i.test(all)) { console.error("app error", e); return NUM; }
    if (raw.trim() === "ไม่มีสิทธิ์") return perm(); // our own one-line raise (52 places) says what happened but not what to do
    if (/[฀-๿]/.test(raw)) return raw;
    console.error("app error", e);
    return rule(all) || "ระบบมีปัญหา ลองใหม่อีกครั้ง\n" + help();
  }
  window.App = { ready, fn, errText };
})();
