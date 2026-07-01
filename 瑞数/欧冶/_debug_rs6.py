"""Debug RS6 VM execution — minimal env, check what error occurs."""
import subprocess, tempfile, json, re, sys
from pathlib import Path
import requests
from urllib.parse import urljoin

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36"

session = requests.Session()
session.headers.update({"User-Agent": UA})
r = session.get("https://www.ouyeel.com/steel")
html = r.text
meta_content = re.findall(r'<meta[^>]+content="([^"]*)"', html)[-1]
html_clean = re.sub(r'<!--\[if[^>]*>.*?<!\[endif\]-->', '', html, flags=re.DOTALL)
scripts = re.findall(r'<script[^>]*>(.*?)</script>', html_clean, re.DOTALL)
inline_js = next((s for s in scripts if "$_ts" in s), "")
ext_match = re.search(r'<script[^>]*src="(/[^"]+)"', html_clean)
ext_url = urljoin("https://www.ouyeel.com", ext_match.group(1))
r2 = session.get(ext_url, headers={"Referer": "https://www.ouyeel.com/steel"})
ext_js = r2.text

print(f"meta_content: {meta_content[:40]}")
print(f"inline_js: {len(inline_js)} bytes")
print(f"ext_js: {len(ext_js)} bytes")

# Build JS script using string concatenation (not f-string!) to preserve $
js_lines = []
js_lines.append("setTimeout = function() {};")
js_lines.append("setInterval = function() {};")
js_lines.append("clearTimeout = function() {};")
js_lines.append("clearInterval = function() {};")
js_lines.append("")
js_lines.append("var metacontent = " + json.dumps(meta_content) + ";")
js_lines.append("")
js_lines.append("window = {}; top = window; self = window;")
js_lines.append("window.ActiveXObject = undefined;")
js_lines.append("")
js_lines.append("document = { _cookie: '' };")
js_lines.append("Object.defineProperty(document, 'cookie', {")
js_lines.append("    get: function() { return this._cookie; },")
js_lines.append("    set: function(v) { this._cookie = this._cookie ? this._cookie + '; ' + v : v; }")
js_lines.append("});")
js_lines.append("")
js_lines.append("navigator = { userAgent: " + json.dumps(UA) + ", platform: 'Win32', webdriver: false };")
js_lines.append("screen = { width: 1920, height: 1080, colorDepth: 24 };")
js_lines.append("location = { href: 'https://www.ouyeel.com/steel', protocol: 'https:', host: 'www.ouyeel.com', hostname: 'www.ouyeel.com', port: '', pathname: '/steel', search: '', hash: '', origin: 'https://www.ouyeel.com' };")
js_lines.append("")
js_lines.append("// RSW inline JS")
js_lines.append(inline_js)
js_lines.append("")
js_lines.append('console.error("XXX inline done, nsd=" + (typeof $_ts !== "undefined" ? $_ts.nsd : "NA") + ", cd_len=" + (typeof $_ts !== "undefined" && $_ts.cd ? $_ts.cd.length : "NA"));')
js_lines.append("")
js_lines.append("// RSW external JS")
js_lines.append(ext_js)
js_lines.append("")
js_lines.append('console.error("XXX ext done, cookie_len=" + document._cookie.length);')
js_lines.append("")
js_lines.append('if (typeof _$gJ === "function") {')
js_lines.append('    console.error("XXX calling _$gJ");')
js_lines.append("    _$gJ();")
js_lines.append('    console.error("XXX _$gJ done, cookie_len=" + document._cookie.length);')
js_lines.append("} else {")
js_lines.append('    console.error("XXX _$gJ NOT FOUND");')
js_lines.append("    // Try other entry points")
js_lines.append('    if (typeof $_ts !== "undefined" && typeof $_ts.lcd === "function") {')
js_lines.append('        console.error("XXX calling $_ts.lcd()");')
js_lines.append("        $_ts.lcd();")
js_lines.append('        console.error("XXX $_ts.lcd() done, cookie_len=" + document._cookie.length);')
js_lines.append("    }")
js_lines.append("}")
js_lines.append("")
js_lines.append('var result = JSON.stringify({s: document._cookie.length, c: document._cookie.substring(0, 200)});')
js_lines.append("console.log(result);")

js = "\n".join(js_lines)

with tempfile.NamedTemporaryFile(mode="w", suffix=".js", delete=False, encoding="utf-8") as f:
    f.write(js)
    tmp_path = f.name

try:
    result = subprocess.run(
        ["node", tmp_path],
        capture_output=True, text=True, timeout=30,
        encoding="utf-8", errors="replace",
    )
    stderr_lines = result.stderr.strip().split("\n")
    print(f"\n=== STDERR ({len(stderr_lines)} lines) ===")
    for line in stderr_lines[:60]:
        print("  " + line[:200])
    if len(stderr_lines) > 60:
        print(f"  ... omitted {len(stderr_lines) - 60} lines")

    print(f"\n=== STDOUT ===")
    stdout = result.stdout.strip()
    if stdout:
        print("  " + stdout[:800])
    else:
        print("  (empty)")
except subprocess.TimeoutExpired:
    print("TIMEOUT (30s)")
finally:
    Path(tmp_path).unlink(missing_ok=True)
