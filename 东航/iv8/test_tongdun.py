"""
东航 Tongdun SDK — iv8 直接加载方案

跳过 React SPA，直接在 iv8 中运行 Tongdun 指纹收集链:
  monitor.js → fm.js → Worker → 收集指纹 → 上报 → 获取 blackbox

流程:
  1. 设置 _fmOpt 初始化配置（从 ceair HTML inline script 提取）
  2. 加载 monitor.js（Tongdun 错误监控）
  3. 加载 fm.js（TrustDeviceJs Pro v4.2.4 指纹收集）
  4. 推进事件循环 → Worker 执行 → postMessage 收集指纹
  5. XHR 上报 Tongdun → 获取 blackbox/sessionStorage
  6. ssxmod_itna cookie → document.cookie（由 SDK 或 Ceair 服务端写入）
"""

import json
import sys
from pathlib import Path
from curl_cffi import requests as cr
import iv8

HERE = Path(__file__).parent

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
      "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")


def build_ceair_stubs() -> str:
    """东航页面专属 minimal stubs — 比通用 stubs.js 更精简"""
    return """
self = window; globalThis = window;
document.readyState = 'complete';
document.hidden = false; document.visibilityState = 'visible';
document.all = undefined;
document.title = '中国东方航空';

// navigator
navigator.sendBeacon = function() { return true; };
navigator.languages = navigator.languages || ['zh-CN', 'zh'];
navigator.language = navigator.language || 'zh-CN';
navigator.plugins = navigator.plugins || [];
navigator.mimeTypes = navigator.mimeTypes || [];

// Performance
if (!performance.now) performance.now = function() { return Date.now(); };

// DOM
document.getElementsByTagName = function(t) {
    return t === 'script' ? [{ parentNode: { insertBefore: function() {} } }] : [];
};
document.querySelector = function() { return null; };
document.getElementById = function() { return null; };
document.addEventListener = function() {};
document.removeEventListener = function() {};
document.createElement = function(t) {
    var el = {
        tagName: (t||'').toUpperCase(), type: '', async: false,
        src: '', style: {}, parentNode: null,
        appendChild: function(){}, removeChild: function(){},
        setAttribute: function(k,v){ if(k==='src') this.src=v; },
        getAttribute: function(k){ return (k==='src') ? this.src : null; },
        children: [], childNodes: [],
        addEventListener: function(){}, removeEventListener: function(){},
        getElementsByTagName: function(){ return []; },
        querySelectorAll: function(){ return []; },
    };
    return el;
};
document.createElementNS = function(ns, tag) { return document.createElement(tag); };

// document.body/head
try {
    Object.defineProperty(document, 'body', {
        get: function() { return document.createElement('body'); }, configurable: true
    });
    Object.defineProperty(document, 'head', {
        get: function() { return document.createElement('head'); }, configurable: true
    });
} catch(e) {}

// Cookie
var _dc = '';
Object.defineProperty(document, 'cookie', {
    get: function() { return _dc; },
    set: function(v) {
        if (!v) return;
        var parts = v.split(';');
        var kv = parts[0].split('=');
        var k = kv[0].trim();
        if (_dc) {
            var re = new RegExp('(^|; )' + k + '=[^;]*');
            if (re.test(_dc)) _dc = _dc.replace(re, '$1' + parts[0]);
            else _dc += '; ' + parts[0];
        } else {
            _dc = parts[0];
        }
    },
    configurable: true
});

// sessionStorage
var _ss = {};
window.sessionStorage = {
    getItem: function(k) { return _ss[String(k)] || null; },
    setItem: function(k, v) { _ss[String(k)] = String(v); },
    removeItem: function(k) { delete _ss[String(k)]; },
    clear: function() { _ss = {}; },
    get length() { return Object.keys(_ss).length; },
    key: function(n) { return Object.keys(_ss)[n] || null; }
};
window.localStorage = {
    getItem: function(k) { return _ss[String(k)] || null; },
    setItem: function(k, v) { _ss[String(k)] = String(v); },
    removeItem: function(k) { delete _ss[String(k)]; },
    clear: function() { _ss = {}; },
    get length() { return Object.keys(_ss).length; },
    key: function(n) { return Object.keys(_ss)[n] || null; }
};

// Observers
window.MutationObserver = function() { this.observe=function(){}; this.disconnect=function(){}; };

// Crypto
if (!window.crypto) window.crypto = {};
if (!window.crypto.getRandomValues) {
    window.crypto.getRandomValues = function(buf) {
        for (var i=0;i<buf.length;i++) buf[i]=Math.floor(Math.random()*256);
        return buf;
    };
}
if (!window.crypto.subtle) {
    window.crypto.subtle = {
        digest: function(){ return Promise.resolve(new ArrayBuffer(32)); },
        encrypt: function(){ return Promise.resolve(new ArrayBuffer(32)); },
        decrypt: function(){ return Promise.resolve(new ArrayBuffer(32)); },
        sign: function(){ return Promise.resolve(new ArrayBuffer(32)); },
        verify: function(){ return Promise.resolve(true); },
        importKey: function(){ return Promise.resolve({}); },
        generateKey: function(){ return Promise.resolve({}); },
    };
}

// Image
window.Image = function(w,h) {
    this.width=w||1; this.height=h||1; this.src='';
    this.onload=null; this.onerror=null; this.complete=true;
};

// chrome
window.chrome = {runtime:{}, app:{isInstalled:false}, loadTimes:function(){return{};}};

// setImmediate
window.setImmediate = function(fn){return setTimeout(fn,0);};
window.clearImmediate = function(id){clearTimeout(id);};

// Intl
window.Intl = window.Intl || {};
window.Intl.DateTimeFormat = window.Intl.DateTimeFormat || function(){
    return {resolvedOptions:function(){return {locale:'zh-CN',timeZone:'Asia/Shanghai'};}};
};

// EventSource stub
window.EventSource = function(url) { this.url=url; this.readyState=0; };
"""


def run():
    """运行 Tongdun SDK 并等待 ssxmod_itna 生成"""
    session = cr.Session(impersonate="chrome124")
    session.headers.update({"User-Agent": UA})

    # ── Step 1: Download Tongdun chain ──
    print("[1] Downloading Tongdun SDK chain...")
    r = session.get("https://m.ceair.com/mapp/reserve/flightList", timeout=15)

    # Extract fm.js version from the HTML (dynamic)
    import re
    html = r.text
    fm_ver = "0.1"  # default
    m = re.search(r'fm\.js\?ver=([\d.]+)', html)
    if m:
        fm_ver = m.group(1)

    # Build token-time-random path
    import time as _time
    t = int(_time.time() / 3600)
    fm_url = f"https://static.tongdun.net/v3/fm.js?ver={fm_ver}&t={t}"

    monitor_js = session.get("https://static.tongdun.net/monitor/monitor.js", timeout=10).text
    fm_js = session.get(fm_url, timeout=15).text
    bytegoofy_js = session.get(
        "https://lf1-cdn-tos.bytegoofy.com/goofy/developer/jssdk/jssdk-1.2.0.js",
        timeout=10,
    ).text

    print(f"  monitor.js: {len(monitor_js)} chars")
    print(f"  fm.js ({fm_ver}): {len(fm_js)} chars")
    print(f"  bytegoofy: {len(bytegoofy_js)} chars")

    # ── Step 2: Create iv8 context ──
    print("[2] Creating iv8 context...")
    ctx = iv8.JSContext(
        mode="prod",
        environment={
            "navigator": {
                "userAgent": UA,
                "platform": "Win32",
                "webdriver": False,
            },
            "screen": {"width": 412, "height": 915},
            "location": {
                "href": "https://m.ceair.com/mapp/reserve/flightList",
                "origin": "https://m.ceair.com",
                "hostname": "m.ceair.com",
                "protocol": "https:",
                "pathname": "/mapp/reserve/flightList",
            },
        },
    )
    ctx.__enter__()

    # Load polyfills
    pf_path = HERE / "iv8_polyfills.js"
    ctx.eval(pf_path.read_text("utf-8"), name="iv8_polyfills.js")

    # Load minimal stubs
    ctx.eval(build_ceair_stubs(), name="ceair_stubs")
    print("  Polyfills + stubs loaded")

    # ── Step 3: Initialize _fmOpt ──
    print("[3] Initializing _fmOpt...")
    ctx.eval(f"""
    var fpHost = "https://fp.tongdun.net";
    var imgSrc = "https://fp.tongdun.net/fp/clear.png?partnerCode=ceair&appName=ceair_web&tokenId=";
    window._fmOpt = {{
        partner: 'ceair',
        appName: 'ceair_web',
        token: 'ceair-' + new Date().getTime() + '-' + Math.random().toString(16).substr(2),
        fmb: true,
        success: function(data) {{
            window.sessionStorage.setItem("blackbox", data);
            window._blackbox = data;
        }},
        fpHost: fpHost
    }};
    window._fmToken = window._fmOpt.token;
    """)

    # Pre-insert the "clear.png" Image to avoid network fetch
    ctx.eval(f"""
    var cimg = new Image(1,1);
    cimg.onload = function() {{ window._fmOpt.imgLoaded = true; }};
    cimg.src = imgSrc + window._fmOpt.token;
    """)

    # ── Step 4: Load Tongdun SDKs ──
    print("[4] Loading Tongdun SDKs...")

    print("  Loading bytegoofy...")
    try:
        ctx.eval(bytegoofy_js, name="bytegoofy.js")
        print("    OK")
    except Exception as e:
        print(f"    Warning: {e}")

    print("  Loading monitor.js...")
    try:
        ctx.eval(monitor_js, name="monitor.js")
        print("    OK")
    except Exception as e:
        print(f"    ERROR: {e}")

    print("  Loading fm.js...")
    try:
        ctx.eval(fm_js, name="fm.js")
        print("    OK")
    except Exception as e:
        print(f"    ERROR: {e}")
        ctx.__exit__(None, None, None)
        return None

    # ── Step 5: Event loop — let Worker run, collect fingerprint, report ──
    print("[5] Running event loop (30 iterations, 500ms each)...")
    seen_urls = set()
    for iteration in range(60):
        ctx.eval("window.__iv8__.eventLoop.sleep(500)")

        # Check netLog for new network requests
        r = ctx.eval("""JSON.stringify({
            entries: Array.from(window.__iv8__.netLog.entries).map(function(e,i){
                return {i:i, method:e.method, url:e.url.substring(0,120), status:e.status}
            }),
            blackbox: window.sessionStorage.getItem('blackbox'),
            cookieLen: document.cookie.split('; ').filter(Boolean).length,
            hasSsxmod: document.cookie.indexOf('ssxmod') >= 0,
            cookie: document.cookie.substring(0, 300),
        })""")
        state = json.loads(r)

        # Download any new URLs from netLog
        for e in state.get("entries", []):
            url = e["url"]
            if url not in seen_urls and not url.startswith("data:") and url != "about:blank":
                seen_urls.add(url)
                try:
                    full_url = url if url.startswith("http") else \
                        ("https://m.ceair.com" + url if url.startswith("/") else url)
                    sr = session.get(full_url, timeout=15)
                    ctx.add_resource(full_url, sr.text, sr.status_code, dict(sr.headers))
                    print(f"  [{iteration:2d}] + {url[:85]} ({len(sr.text)}c)")
                except Exception as ex:
                    pass

        if iteration % 10 == 0:
            bb = state.get("blackbox", "N/A")
            if bb:
                bb = bb[:50] + "..."
            print(
                f"  [{iteration:2d}] entries={len(state['entries'])} "
                f"cookies={state['cookieLen']} ssxmod={state['hasSsxmod']} "
                f"blackbox={bb}"
            )

        if state.get("hasSsxmod"):
            print(f"\n!!! SSXMOD FOUND at iteration {iteration} !!!")
            break

        if state.get("blackbox") and iteration > 30:
            print(f"\n  [Blackbox received, ssxmod may need separate server call]")
            break

    # ── Step 6: Final state ──
    r = ctx.eval("""JSON.stringify({
        entries: window.__iv8__.netLog.entries.length,
        urls: Array.from(window.__iv8__.netLog.entries).map(function(e,i){
            return i+':'+e.method+' '+e.url.substring(0,100)+' status='+e.status
        }),
        blackbox: (window.sessionStorage.getItem('blackbox') || '').substring(0, 200),
        cookie: document.cookie.substring(0, 500),
        hasSsxmod: document.cookie.indexOf('ssxmod') >= 0,
    })""")
    result = json.loads(r)

    print(f"\n{'='*60}")
    print(f"Final: {result['entries']} entries, ssxmod={result['hasSsxmod']}")
    print(f"Blackbox: {result['blackbox'][:100]}")
    print(f"Cookie ({result['cookie'].count(';')+1} items):")
    for c in result["cookie"].split("; "):
        if c.strip():
            print(f"  {c[:120]}")

    print(f"\nNetLog URLs:")
    for u in result.get("urls", [])[:20]:
        print(f"  {u}")

    ctx.__exit__(None, None, None)
    return result


if __name__ == "__main__":
    run()
