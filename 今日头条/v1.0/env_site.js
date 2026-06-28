/**
 * env_site.js — 今日头条 浏览器环境补丁
 *
 * 基于 .claude/env-patch/env_patch.js 通用框架。
 * 加载 toutiao SDK (acrawler + sdk-glue + bdms) 以生成 a_bogus。
 *
 * ══ 二阶段补环境工作流 ══
 *
 *   阶段 1 — 发现:
 *     DEBUG_PROXY=true node sign.js
 *     → 退出时自动打印「📋 补丁代码」报告
 *
 *   阶段 2 — 补全:
 *     → 复制报告中的补丁代码 → 粘贴到下方 → 重跑验证
 *
 * ⚠️ 天花板判定:
 *   如果 3 轮补环境后签名仍错误，切 iv8 方案。
 *   详见 .claude/env-patch/README.md#env_patch-天花板
 */

const _process = process;
const _require = require;
const _fs = _require("fs");
const _path = _require("path");
const __dir = __dirname;

const { setupEnv, sn, mf, mc, watch } = _require(
  "../../.claude/env-patch/env_patch.js",
);

// ═══════════════════════════════════════════════════════════════
// 1. 站点配置
// ═══════════════════════════════════════════════════════════════
setupEnv({
  url: "https://www.toutiao.com/",
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
  platform: "Win32",
  languages: ["zh-CN", "zh"],
  screenWidth: 1920,
  screenHeight: 1080,
  title: "今日头条",
  cookie: "",

  canvas: true,
  webgl: true,        // bdms SDK 会访问 WebGL
  plugins: true,      // bdms SDK 检查 plugins/mimeTypes
  storage: true,      // bdms SDK 使用 localStorage 缓存
  extraConstructors: true,
  crypto: true,

  // ByteDance SDK 要求 window === global (SDKRuntime 注册到 window 上)
  windowToGlobal: true,
});

// 替换为 Node.js 原生 Web Crypto
global.crypto = _require("crypto").webcrypto;

// ═══════════════════════════════════════════════════════════════
// 2. 站点特有覆盖 — 头条 SDK 依赖的额外环境
// ═══════════════════════════════════════════════════════════════

// --- document.currentScript (SDK 读取自己的 script src) ---
Object.defineProperty(document, "currentScript", {
  get() {
    return {
      src: "https://lf-security.bytegoofy.com/obj/security-secsdk/runtime_bundler_52.js",
      getAttribute() { return null; },
    };
  },
  configurable: true,
  enumerable: true,
});

// --- Node.js specific: global.process might be checked ---
// env_patch already sets process = undefined for windowToGlobal: true,
// but some SDK code expects it to exist. Re-expose if needed.
// global.process = _process;

// --- document.writeln (used by runtime_bundler to inject scripts) ---
document.writeln = function (html) {
  // Extract script src from the HTML
  const match = html.match(/src="([^"]+)"/);
  if (match) {
    const src = match[1];
    // The SDK tries to load config/project/strategy modules dynamically.
    // We skip remote loading — the core a_bogus functionality is in bdms.js.
    console.log("[env_site] document.writeln skipped:", src.substring(0, 80));
  }
};

// --- Navigator.sendBeacon (SDK uses it for reporting) ---
navigator.sendBeacon = function () { return true; };

// --- PerformanceObserver ---
if (typeof global.PerformanceObserver === "undefined") {
  global.PerformanceObserver = function () {};
  global.PerformanceObserver.prototype = {
    observe() {},
    disconnect() {},
    takeRecords() { return []; },
  };
}

// --- Request / Response / Headers (SDK fetch hook checks these) ---
if (typeof global.Request === "undefined") {
  global.Request = function (input, init) {
    this.url = typeof input === "string" ? input : input.url;
    this.method = (init && init.method) || "GET";
    this.headers = init && init.headers ? init.headers : {};
    this.body = init && init.body ? init.body : null;
  };
}
if (typeof global.Response === "undefined") {
  global.Response = function (body, init) {
    this.body = body;
    this.status = (init && init.status) || 200;
    this.headers = init && init.headers ? init.headers : {};
    this.ok = this.status >= 200 && this.status < 300;
  };
  global.Response.prototype.json = function () {
    return Promise.resolve(JSON.parse(this.body));
  };
  global.Response.prototype.text = function () {
    return Promise.resolve(this.body);
  };
}
if (typeof global.Headers === "undefined") {
  global.Headers = function (init) {
    this._headers = {};
    if (init) {
      if (init instanceof global.Headers) {
        init.forEach((v, k) => (this._headers[k] = v));
      } else if (Array.isArray(init)) {
        init.forEach(([k, v]) => (this._headers[k] = v));
      } else {
        Object.assign(this._headers, init);
      }
    }
  };
  global.Headers.prototype.get = function (k) { return this._headers[k]; };
  global.Headers.prototype.set = function (k, v) { this._headers[k] = v; };
  global.Headers.prototype.forEach = function (cb) {
    Object.entries(this._headers).forEach(([k, v]) => cb(v, k));
  };
  global.Headers.prototype.entries = function () {
    return Object.entries(this._headers)[Symbol.iterator]();
  };
}

// --- MutationObserver (SDK observer hook) ---
if (typeof global.MutationObserver === "undefined") {
  global.MutationObserver = function (cb) { this._cb = cb; };
  global.MutationObserver.prototype = {
    observe() {},
    disconnect() {},
    takeRecords() { return []; },
  };
}

// --- Image 构造函数 (Canvas 指纹关键 — 缺了 a_bogus 指纹失效) ---
if (typeof global.Image === "undefined") {
  global.Image = function (w, h) {
    this.width = w || 0;
    this.height = h || 0;
    this.src = "";
    this.onload = null;
    this.onerror = null;
    this.complete = false;
    this.naturalWidth = 0;
    this.naturalHeight = 0;
  };
}

// --- Audio / AudioContext (音频指纹) ---
if (typeof global.Audio === "undefined") {
  global.Audio = function () {};
  global.Audio.prototype = { play: function () {}, pause: function () {}, load: function () {} };
}
if (typeof global.OfflineAudioContext === "undefined") {
  global.OfflineAudioContext = function (channels, length, sampleRate) {
    this.sampleRate = sampleRate || 44100;
    this.length = length || 128;
    this.numberOfChannels = channels || 2;
  };
  global.OfflineAudioContext.prototype = {
    createOscillator: function () {
      return {
        type: "sine", frequency: { value: 440 },
        connect: function () {}, start: function () {}, stop: function () {},
      };
    },
    createDynamicsCompressor: function () { return { connect: function () {} }; },
    createGain: function () { return { connect: function () {}, gain: { value: 1 } }; },
    createBiquadFilter: function () { return { connect: function () {}, type: "lowpass", frequency: { value: 350 } }; },
    createBuffer: function (c, len, sr) { return { getChannelData: function () { return new Float32Array(len); }, length: len, numberOfChannels: c, sampleRate: sr }; },
    startRendering: function () { return Promise.resolve(new AudioBuffer({ length: this.length, sampleRate: this.sampleRate })); },
    destination: {},
    sampleRate: 44100,
  };
}

// --- document.createEvent / execCommand ---
document.createEvent = function (type) {
  return { initEvent: function () {}, initMouseEvent: function () {}, initUIEvent: function () {} };
};
document.execCommand = function () { return false; };

// --- navigator.connection (网络信息) ---
Object.defineProperty(navigator, "connection", {
  get: function () {
    return { effectiveType: "4g", rtt: 50, downlink: 10, saveData: false, onchange: null };
  },
  configurable: true, enumerable: true,
});

// --- navigator.storage ---
Object.defineProperty(navigator, "storage", {
  get: function () {
    return {
      estimate: function () { return Promise.resolve({ quota: 0, usage: 0 }); },
      persist: function () { return Promise.resolve(false); },
      persisted: function () { return Promise.resolve(false); },
    };
  },
  configurable: true, enumerable: true,
});

// --- navigator.userAgentData (Chrome 新版 API) ---
Object.defineProperty(navigator, "userAgentData", {
  get: function () {
    return {
      brands: [{ brand: "Google Chrome", version: "148" }, { brand: "Chromium", version: "148" }, { brand: "Not/A)Brand", version: "99" }],
      mobile: false,
      platform: "Windows",
      getHighEntropyValues: function () { return Promise.resolve({}); },
    };
  },
  configurable: true, enumerable: true,
});

// --- window.pageYOffset (滚动位置) ---
Object.defineProperty(global, "pageYOffset", { value: 0, writable: true, configurable: true });
Object.defineProperty(global, "pageXOffset", { value: 0, writable: true, configurable: true });

// --- navigator.scheduling (env_patch 缺失) ---
Object.defineProperty(Navigator.prototype, "scheduling", {
  get: function () { return { isInputPending: function () { return false; } }; },
  configurable: true, enumerable: true,
});

// --- navigator.permissions (env_patch 缺失) ---
Object.defineProperty(Navigator.prototype, "permissions", {
  get: function () { return { query: function () { return Promise.resolve({ state: "prompt", onchange: null }); } }; },
  configurable: true, enumerable: true,
});

// --- Canvas toDataURL 更真实指纹 (env_patch 返回空 base64) ---
(function () {
  var origToDataURL = HTMLCanvasElement.prototype.toDataURL;
  if (origToDataURL && origToDataURL.toString().includes("data:image/png;base64,")) {
    HTMLCanvasElement.prototype.toDataURL = function () {
      // Return a more realistic png header (minimal valid PNG)
      return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAARgAAAA8CAYAAAC9xKUYAAAD2ElEQVR4nO3cQWrbQABAUe//y7mLLroIBCjPfkKWs8iu5/l+f38BAPgL/wBgBLAAjAAWgBHAAjACWABGAKsx3fuH4+//N3Cc6c5vN7+PAd7z+/X9Be/DjBjAAm/4/BYBBrAAjAAWgBHAWjN9AHgBg0IIdd25L7kIYPoAPbA3Pj2/54zP3vs+HjN+0dfX9yu1v3/vf7y/937G2K/Lprshns7g+vse7P2+D5LLo+/10D63dmPZ1jo/+/rD+eHg/M3/+t8k8zPfJ6c9w9eR9zLvr5vzeON+XEPCfM/90fD2+zsZf85aABaAEcACMAJYAEYAC8AIYAEYASwAI4AFYASwnvDxfQAHYX8uuvVkA2y2V3PnhLx+C7Ox56NOd/sb3VqxLva5ZwCb17lc2+u1P3p2/f3WLuvXf/4Ys+kZ5lb9W5pn/9brn/KH5Iff5P5ZYAFMAns5bwzLcwAqgAVgBLAATACremi3N0SAOTvP7c3K7avrf/rODIADM88ZX5xdz8j1i3X0e9e1gT8f/T0+cv17j3v0tj+3rn42c63PjC9yDn23niNjV3MNPADYt/Zsz7kHwB9gRd8Z7e2KtPY4zD0GjgHs6PeAPx69XGDUADawJj8Ap+7n2Wfe36T02JHR5s6N+yvPfLZ6rrdz3o3Xb3Z+7t0Dz/+Hh5k52I4Ntm/z0q72Po3uOXPk+vufvvfxn/Vwfu2ReQNEPM3HdPPWmY8hAAOBhd80LgMABTAAjAMWv4BCAARgBLAAjgAVgBLAifn/+fQD8G0/rvHrfASNbb9kq9Mk/+3c29u+qV1+2eoaLZ+3y1Rqw2nlk/W6vbfVPPGv6H1m/o1cuvfsb7ZQAfYABwAIwAlgARgALwAhgARgBLAAjgAVgBLAeq8xnH/3U/9NpP03uz7J+/Nbcp8b2fI6k2zaADWBPfm5m/ZuLf1vPtx8A+39mYAHAXj/Bz+2uHgNWxKsALAAjgAVgBLAAjAAWgBHAAnhzfwFZ7F/BLc+5aAAAAABJRU5ErkJggg==";
    };
  }
})();

// --- WebGL 指纹对齐 ---
(function () {
  var origGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type) {
    if (type === "webgl" || type === "experimental-webgl") {
      return typeof origGetContext === "function" ? origGetContext.call(this, type) : null;
    }
    if (typeof origGetContext === "function") return origGetContext.call(this, type);
    return null;
  };
})();

// --- 隐藏 Node.js 特征 ---
delete global.queueMicrotask;

// --- 安全探针 (Anti-bot detection probes — 必须 undefined) ---
// env_patch 已做大部分，头条 SDK 额外检查这些
["_phantom", "__nightmare", "callPhantom", "cefSharp", "CefSharp", "eoapi", "eoWebBrowserDispatcher"].forEach(function (k) {
  if (typeof global[k] !== "undefined") Object.defineProperty(global, k, { value: undefined, writable: true, configurable: true });
});

// ═══════════════════════════════════════════════════════════════
// 3. 导出
// ═══════════════════════════════════════════════════════════════
module.exports = {
  envReady: true,
};
