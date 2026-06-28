/**
 * debug-proxy.js — 可选 Proxy 调试监控模块 + 补丁代码生成
 * ============================================================
 *
 * 二阶段补环境工作流:
 *
 *   阶段 1 — 发现:
 *     DEBUG_PROXY=true node your_script.js
 *     → 运行时实时日志（get/set/undefined 警告）
 *     → 退出时自动打印「补丁代码」报告
 *
 *   阶段 2 — 补全:
 *     → 复制报告末尾的补丁代码 → env_site.js 的「站点特有覆盖」区域
 *     → 重跑验证 → 重复直到签名成功 + 红色 🔴 未知属性清零
 *
 * 启用方式:
 *   Windows CMD:    set DEBUG_PROXY=true
 *   PowerShell:     $env:DEBUG_PROXY="true"
 *   Git Bash:       DEBUG_PROXY=true node your_script.js
 *
 * 用法 (在 env_site.js 中):
 *   const { watch } = require("../../.claude/env-patch/debug-proxy.js");
 *   global.window    = watch(global.window,    "window");
 *   global.document  = watch(global.document,  "document");
 *   global.navigator = watch(global.navigator, "navigator");
 *
 * DEBUG_PROXY 未设置时，watch() 直接返回原对象 — 零性能开销。
 * 独立于 env_patch.js，无需修改框架文件。
 */

const DEBUG_MODE =
  process.env.DEBUG_PROXY === "true" || process.env.DEBUG_PROXY === "1";

// ═══════════════════════════════════════════════════════════════
// 模块级收集器（所有 handler 共享）
// ═══════════════════════════════════════════════════════════════

/** key = "objName.propName" — 所有被访问过的属性 */
const _accessed = new Set();

/** key = "objName.propName" — 返回 undefined 的属性 */
const _undefined = new Set();

// ═══════════════════════════════════════════════════════════════
// 日志工具
// ═══════════════════════════════════════════════════════════════

function v_log(...args) {
  if (DEBUG_MODE) console.log(...args);
}

const __seenLogKeys = new Set();
function logOnce(key, ...args) {
  if (__seenLogKeys.has(key)) return;
  __seenLogKeys.add(key);
  v_log(...args);
}

// ═══════════════════════════════════════════════════════════════
// 忽略列表 — 内部属性/方法不记录
// ═══════════════════════════════════════════════════════════════

const DEFAULT_IGNORE = new Set([
  "prototype", "constructor", "__proto__",
  Symbol.toStringTag, Symbol.iterator, Symbol.hasInstance,
  Symbol.toPrimitive, Symbol.asyncIterator,
  Symbol.match, Symbol.replace, Symbol.search, Symbol.split,
  Symbol.species, Symbol.unscopables,
  "toString", "valueOf", "hasOwnProperty", "toJSON", "toLocaleString",
  "isPrototypeOf", "propertyIsEnumerable",
  "call", "apply", "bind",
  "__defineGetter__", "__defineSetter__",
  "__lookupGetter__", "__lookupSetter__",
  "inspect", "customInspect", "domain",
]);

// ═══════════════════════════════════════════════════════════════
// KNOWN_DEFAULTS — 已知浏览器属性的默认值
// ═══════════════════════════════════════════════════════════════
//
// 值含义:
//   字符串      = getter 表达式，生成 Object.defineProperty 代码
//   null        = 允许 undefined（平台特定/桌面端不应有的属性）
//   undefined   = 未知，需从真浏览器采集

// 知识库值 = getter 函数体的 return 表达式（不含 function 壳和 return 关键字）
// flushReport 自动包装为: get: function p() { return <值>; }
const KNOWN_DEFAULTS = {
  // ── Navigator ──
  "navigator.scheduling":     `{ isInputPending: function() { return false; } }`,
  "navigator.permissions":    `{ query: function() { return Promise.resolve({ state: "prompt", onchange: null }); } }`,
  "navigator.mediaDevices":   `{ enumerateDevices: function() { return Promise.resolve([]); }, getUserMedia: function() { return Promise.reject(new Error("NotAllowedError")); } }`,
  "navigator.serviceWorker":  `undefined`,
  "navigator.bluetooth":      `{ getAvailability: function() { return Promise.resolve(false); } }`,
  "navigator.storage":        `{ estimate: function() { return Promise.resolve({ quota: 0, usage: 0 }); }, persist: function() { return Promise.resolve(false); }, persisted: function() { return Promise.resolve(false); } }`,
  "navigator.credentials":    `{ get: function() { return Promise.resolve(null); }, create: function() { return Promise.resolve(null); }, store: function() { return Promise.resolve(null); }, preventSilentAccess: function() { return Promise.resolve(); } }`,
  "navigator.clipboard":      `{ read: function() { return Promise.reject(new Error("NotAllowedError")); }, readText: function() { return Promise.reject(new Error("NotAllowedError")); }, write: function() { return Promise.resolve(); }, writeText: function() { return Promise.resolve(); } }`,
  "navigator.keyboard":       `{ getLayoutMap: function() { return Promise.resolve(new Map()); }, lock: function() { return Promise.reject(new Error()); }, unlock: function() {} }`,
  "navigator.connection":     `{ effectiveType: "4g", rtt: 50, downlink: 10, saveData: false, onchange: null }`,

  // ── Window — browser sniffing ──
  "window.chrome":                `{ loadTimes: function() {}, csi: function() {}, app: {} }`,
  "window.safari":                `undefined`,
  "window.opera":                 `undefined`,
  "window.opr":                   `undefined`,
  "window.StyleMedia":            `(function() { var SM = function() {}; SM.prototype = { matchMedium: function() { return false; }, type: "screen" }; return SM; })()`,
  "window.WebGLRenderingContext":  `global.WebGLRenderingContext || function() {}`,
  "window.mozInnerScreenY":       `undefined`,
  "window.mozPaintCount":         `undefined`,
  "window.webkitURL":             `global.URL`,

  // ── Document ──
  "document.all":          `undefined`,
  "document.documentMode": `undefined`,
  "document.evaluate":     `function(expression, contextNode, resolver, type, result) { return { iterateNext: function() { return null; }, snapshotLength: 0, snapshotItem: function() { return null; }, resultType: type || 0, singleNodeValue: null, booleanValue: false, numberValue: 0, stringValue: "", invalidIteratorState: false }; }`,

  // ── WeChat / 移动端 (桌面端应为 undefined) ──
  "window.WeixinJSBridge":       null,
  "window.__wxWebEnv":           null,
  "window.__wxjs_environment":   null,
  "window.__wxjs_is_wkwebview":  null,

  // ── Window — JS 标准全局 (windowToGlobal: false 时需显式挂载) ──
  "window.Math":              `global.Math`,
  "window.Promise":           `global.Promise`,
  "window.setTimeout":        `global.setTimeout`,
  "window.setInterval":       `global.setInterval`,
  "window.clearTimeout":      `global.clearTimeout`,
  "window.clearInterval":     `global.clearInterval`,
  "window.addEventListener":  `global.addEventListener`,
  "window.removeEventListener": `global.removeEventListener`,
  "window.localStorage":      `global.localStorage`,
  "window.sessionStorage":    `global.sessionStorage`,
};

// ═══════════════════════════════════════════════════════════════
// 格式化工具
// ═══════════════════════════════════════════════════════════════

function _format(v) {
  if (v === undefined) return "undefined";
  if (v === null) return "null";
  if (typeof v === "function") {
    const n = v.name || "(anonymous)";
    return `[Function: ${n}]`;
  }
  if (typeof v === "object") {
    const tag = v[Symbol.toStringTag] || v.constructor?.name || "Object";
    return `[${tag}]`;
  }
  const s = JSON.stringify(v);
  return s.length > 80 ? s.slice(0, 80) + "…" : s;
}

// ═══════════════════════════════════════════════════════════════
// createHandler — 构建 Proxy handler
// ═══════════════════════════════════════════════════════════════

function createHandler(objName, targetObj) {
  return {
    get(target, prop, receiver) {
      if (prop === Symbol.toPrimitive) {
        return function (hint) {
          if (hint === "string") return "[object " + objName + "]";
          if (hint === "number") return NaN;
          return null;
        };
      }

      if (DEFAULT_IGNORE.has(prop)) {
        return Reflect.get(target, prop, receiver);
      }

      const value = Reflect.get(target, prop, receiver);
      const propStr =
        typeof prop === "symbol" ? prop.toString() : String(prop);
      const fullKey = objName + "." + propStr;

      _accessed.add(fullKey);

      if (value === undefined) {
        _undefined.add(fullKey);
        logOnce(
          "undef:" + fullKey,
          `\x1b[33m⚠️  [GET] ${fullKey} → undefined\x1b[0m`,
        );
      } else {
        logOnce("get:" + fullKey, `[GET] ${fullKey} → ${_format(value)}`);
      }

      if (
        objName === "window" &&
        typeof value === "function" &&
        !(value.prototype && value.prototype.constructor === value)
      ) {
        return value.bind(target);
      }

      return value;
    },

    set(target, prop, value, receiver) {
      if (DEFAULT_IGNORE.has(prop)) {
        return Reflect.set(target, prop, value, receiver);
      }

      const propStr =
        typeof prop === "symbol" ? prop.toString() : String(prop);
      const fullKey = objName + "." + propStr;

      _accessed.add(fullKey + " (set)");
      logOnce("set:" + fullKey, `[SET] ${fullKey} = ${_format(value)}`);

      return Reflect.set(target, prop, value, receiver);
    },
  };
}

// ═══════════════════════════════════════════════════════════════
// watch — 主入口
// ═══════════════════════════════════════════════════════════════

function watch(obj, name) {
  if (!DEBUG_MODE) return obj;
  if (typeof obj !== "object" && typeof obj !== "function") return obj;
  return new Proxy(obj, createHandler(name, obj));
}

// ═══════════════════════════════════════════════════════════════
// flushReport — 退出时自动生成补环境报告
// ═══════════════════════════════════════════════════════════════

function _groupByObj(set) {
  const byObj = {};
  for (const k of set) {
    const dot = k.indexOf(".");
    const obj = dot >= 0 ? k.slice(0, dot) : k;
    const prop = dot >= 0 ? k.slice(dot + 1) : k;
    if (!byObj[obj]) byObj[obj] = [];
    byObj[obj].push(prop);
  }
  return byObj;
}

function flushReport() {
  if (!DEBUG_MODE) return;
  if (_accessed.size === 0) return;

  const objs = ["navigator", "document", "location", "screen", "window"];
  const accessedByObj = _groupByObj(_accessed);

  // ── Build patch code snippets for known defaults ──
  const patches = {};                  // objName → [code lines]
  const unknown = [];                  // full keys with no known default
  const intentional = [];              // full keys where KNOWN_DEFAULTS is null

  for (const fullKey of _undefined) {
    const dot = fullKey.indexOf(".");
    const objName = fullKey.slice(0, dot);
    const prop = fullKey.slice(dot + 1);

    const known = KNOWN_DEFAULTS[fullKey];
    if (known === null) {
      intentional.push(fullKey);
      continue;
    }
    if (known !== undefined) {
      let code;

      // Detect if the known value is a global reference — use value binding
      // instead of getter to avoid circular getter (e.g. window.Math → global.Math)
      const isGlobalRef = /^global\./.test(known);
      const isSimpleLiteral = /^(undefined|null|true|false|\d+)/.test(known);

      if (isGlobalRef || isSimpleLiteral) {
        // Value binding — simpler, no getter overhead
        if (objName === "window") {
          code =
`Object.defineProperty(global, '${prop}', {
  value: ${known},
  writable: true, configurable: true, enumerable: true,
});`;
        } else {
          code =
`Object.defineProperty(${objName}, '${prop}', {
  value: ${known},
  writable: true, configurable: true, enumerable: true,
});`;
        }
      } else if (objs.includes(objName)) {
        // Prototype-level getter for navigator/document/location/screen etc.
        const ctor =
          objName === "navigator" ? "Navigator" :
          objName === "document"  ? "HTMLDocument" :
          objName === "location"  ? "Location" :
          objName === "screen"    ? "Screen" :
          objName === "window"    ? null : null;

        if (ctor) {
          code =
`Object.defineProperty(${ctor}.prototype, '${prop}', {
  get: function ${prop}() { return ${known}; },
  configurable: true, enumerable: true,
});`;
        } else {
          code =
`Object.defineProperty(global, '${prop}', {
  get() { return ${known}; },
  configurable: true, enumerable: true,
});`;
        }
      } else {
        code = `// ${fullKey}: ${known}`;
      }

      if (!patches[objName]) patches[objName] = [];
      patches[objName].push(code);
    } else {
      unknown.push(fullKey);
    }
  }

  // ── Print report ──
  console.log("");
  console.log("═".repeat(60));
  console.log("\x1b[1m📊 debug-proxy 环境属性扫描报告\x1b[0m");
  console.log("═".repeat(60));

  // Section 1: All accessed
  console.log("");
  console.log(`── 属性访问清单 (${_accessed.size} 个) ──`);
  for (const obj of objs) {
    const props = accessedByObj[obj];
    if (!props || props.length === 0) continue;
    const uniq = [...new Set(props)].sort();
    console.log(`\n  \x1b[1m${obj}\x1b[0m (${uniq.length})`);
    for (const p of uniq) {
      const full = obj + "." + p.replace(" (set)", "");
      const isUndef = _undefined.has(full);
      const isSet = p.endsWith(" (set)");
      const mark = isSet ? "📝" : isUndef ? "\x1b[33m⚠️\x1b[0m" : "\x1b[32m✅\x1b[0m";
      console.log(`    ${mark} ${p}`);
    }
  }

  // Section 2: Undefined summary
  if (_undefined.size > 0) {
    console.log("");
    console.log(`── 需要补的属性 (${_undefined.size} 个) ──`);
    for (const k of [..._undefined].sort()) {
      const known = KNOWN_DEFAULTS[k];
      if (known === null) {
        console.log(`  \x1b[90m  ${k}  ➖ 平台特定，允许 undefined\x1b[0m`);
      } else if (known !== undefined) {
        console.log(`  \x1b[33m🟡 ${k}  — 已知默认值\x1b[0m`);
      } else {
        console.log(`  \x1b[31m🔴 ${k}  — 未知，需从真浏览器采集\x1b[0m`);
      }
    }
  }

  // Section 3: Ready-to-paste patches
  const patchObjNames = Object.keys(patches).sort();
  if (patchObjNames.length > 0) {
    console.log("");
    console.log("═".repeat(60));
    console.log("\x1b[1m📋 复制到 env_site.js 的补丁代码\x1b[0m");
    console.log("═".repeat(60));
    console.log("// ══ 粘贴到「站点特有覆盖」区域 ══");
    console.log("");

    for (const obj of patchObjNames) {
      console.log(`// --- 补: ${obj} ---`);
      for (const code of patches[obj]) {
        console.log(code);
        console.log("");
      }
    }
  }

  // Section 4: Unknowns
  if (unknown.length > 0) {
    console.log("// ══ 以下属性未知默认值，需从真浏览器采集 ══");
    for (const k of unknown.sort()) {
      console.log(`// ${k} = ???  ← 在浏览器 console 执行: ${k.replace("window.", "")}`);
    }
    console.log("");
  }

  // Section 5: Intentional skips
  if (intentional.length > 0) {
    console.log("// ══ 以下属性平台特定/桌面端不应有，无需补 ══");
    for (const k of intentional.sort()) {
      console.log(`// ${k} — 允许 undefined`);
    }
    console.log("");
  }

  console.log("═".repeat(60));
  console.log("\x1b[1m💡 阶段 1 完成 → 补丁代码粘贴到 env_site.js → 重跑\x1b[0m");
  console.log("═".repeat(60));
}

// ── 自动注册退出钩子 ──
if (DEBUG_MODE) {
  process.on("exit", flushReport);

  // Also hook SIGINT (Ctrl+C) so we don't lose the report
  process.on("SIGINT", () => {
    flushReport();
    process.exit(0);
  });
}

// ═══════════════════════════════════════════════════════════════
// 导出
// ═══════════════════════════════════════════════════════════════

module.exports = {
  DEBUG_MODE,
  watch,
  createHandler,
  flushReport,       // 手动调用
  v_log,
  logOnce,
  DEFAULT_IGNORE,
  KNOWN_DEFAULTS,    // 可追加
};
