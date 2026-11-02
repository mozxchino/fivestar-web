"""Build the practice copy of the shop app from the live site files in this repo → demo/ (fake login/data, no Supabase, no LINE).

Runs in .github/workflows/demo.yml on every push to main, so /demo/ always matches the live pages.
usage: python3 .demo-src/build.py [--out demo] | --scan <dir>

Nothing in demo/ can reach Supabase or LINE: the real SDKs, config.js (URL + anon key) and session.js are not copied,
demo.js is the first script of every page, and the safety scan at the end fails the build loudly if anything slipped in.
"""
import argparse, pathlib, re, shutil, sys

SRC = pathlib.Path(__file__).resolve().parent
ROOT = SRC.parent  # the live site: *.html, lib/, img/
DROP = ["lib/config.js", "lib/session.js"]
STRIP = [  # script tags that load the real thing · removed from every page
    r'<script src="https://static\.line-scdn\.net/liff/[^"]*"></script>',
    r'<script src="https://cdn\.jsdelivr\.net/npm/@supabase/supabase-js[^"]*"></script>',
    r'<script src="lib/config\.js[^"]*"></script>',
    r'<script src="lib/session\.js[^"]*"></script>',
]
FIRST = '<script src="lib/demo.js"></script>'
FORBIDDEN = {  # text that must not exist anywhere in demo/
    "supabase.co": "Supabase address",
    "aklolnzcwqpzywxzkbiw": "Supabase project ref",
    "eyJhbGciOi": "a JWT (anon key)",
    "2012144092": "the real LIFF id",
    "api.line.me": "LINE API",
    "static.line-scdn.net": "LINE SDK",
    "@supabase/supabase-js": "supabase-js SDK",
    "lib/config.js": "config.js",
    "lib/session.js": "session.js",
}


def build(out):
    if out.exists():
        shutil.rmtree(out)
    out.mkdir()
    for d in ("lib", "img"):
        shutil.copytree(ROOT / d, out / d, ignore=shutil.ignore_patterns(".DS_Store"))
    for f in ROOT.glob("*.html"):
        shutil.copy(f, out / f.name)
    for f in DROP:
        (out / f).unlink()
    shutil.copy(SRC / "demo.js", out / "lib" / "demo.js")
    shutil.copy(SRC / "start.html", out / "start.html")
    # a gallery photo is allowed in practice (the real app wants a photo taken in the last 3 minutes)
    ph = out / "lib" / "photo.js"
    s = ph.read_text()
    old = "return !t || now - t <= FRESH_MS;"
    if old not in s:
        sys.exit("FAIL photo.js: freshness check not found, update build_demo.py")
    ph.write_text(s.replace(old, "return true; // demo: any picture", 1))
    for page in sorted(out.glob("*.html")):
        s = page.read_text()
        for pat in STRIP:
            s = re.sub(pat, "", s)
        if FIRST not in s:
            s = s.replace('<meta charset="utf-8">', '<meta charset="utf-8">' + FIRST, 1)
        page.write_text(s)


def not_faked(out):
    """RPC names the pages call that demo.js has no fake for (that button does nothing in practice) · a warning, not a failure"""
    js = (SRC / "demo.js").read_text()
    block = js[js.index("const RPC = {"):]
    block = block[:block.index("\n  };")]
    faked = set(re.findall(r"^    ([a-z_0-9]+): ", block, re.M)) | set(re.findall(r", ([a-z_0-9]+): \(", block))
    called = set()
    for f in [*out.glob("*.html"), *(out / "lib").glob("*.js")]:
        called |= set(re.findall(r"""\.rpc\(\s*["']([a-z_0-9]+)""", f.read_text()))
    return sorted(called - faked)


def scan(out):
    bad = []
    for f in sorted(out.rglob("*")):
        if f.suffix not in (".html", ".js", ".css", ".json", ".txt", ".md"):
            continue
        s, rel = f.read_text(errors="replace"), f.relative_to(out)
        bad += [f"{rel}: {why} ({needle})" for needle, why in FORBIDDEN.items() if needle in s]
        if f.suffix == ".html":
            if re.search(r'<script[^>]+src="(https?:)?//', s):
                bad.append(f"{rel}: loads a script from another site")
            first = s.find("<script")
            if first == -1 or not s.startswith(FIRST, first):
                bad.append(f"{rel}: lib/demo.js is not the first script")
        if f.suffix == ".js" and f.name != "demo.js" and re.search(r"\bfetch\(\s*[`'\"]https?:", s):
            bad.append(f"{rel}: fetch to an outside address")
    return bad


if __name__ == "__main__":
    a = argparse.ArgumentParser()
    a.add_argument("--out", default=str(ROOT / "demo"))
    a.add_argument("--scan", metavar="DIR", help="only run the safety scan on DIR (e.g. the demo/ folder inside the Pages repo before pushing)")
    o = a.parse_args()
    if o.scan:
        bad = scan(pathlib.Path(o.scan).resolve())
        print("\n".join(["SAFETY CHECK FAILED", *bad]) if bad else f"OK  {o.scan} · safety check passed", file=sys.stderr if bad else sys.stdout)
        sys.exit(1 if bad else 0)
    out = pathlib.Path(o.out).resolve()
    if out == ROOT or out == SRC or out.parent != ROOT:
        sys.exit("FAIL --out must be a new folder directly inside the repo (default demo/)")
    build(out)
    bad = scan(out)
    pages = len(list(out.glob("*.html")))
    if bad:
        print("\n".join(["SAFETY CHECK FAILED", *bad]), file=sys.stderr)
        sys.exit(1)
    miss = not_faked(out)
    if miss:
        print("::warning::demo has no fake for " + ", ".join(miss) + " (add them to .demo-src/demo.js)")
    print(f"OK  {out} · {pages} pages · safety check passed ({len(FORBIDDEN)} forbidden strings, outside scripts, demo.js first)")
