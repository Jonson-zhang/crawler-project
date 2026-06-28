/**
 * debug-proxy.js — 可选 Proxy 调试监控模块
 * ===========================================
 *
 * 对浏览器环境对象施加 Proxy 监控，拦截所有属性 get/set 操作并输出日志。
 * 用于定位"缺了哪个属性"这类补环境问题。
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
 * 日志默认去重（同一属性只记一次），避免刷屏。
 * 独立于 env_patch.js，无需修改框架文件。
 */

const DEBUG_MODE =
  process.env.DEBUG_PROXY === "true" || process.env.DEBUG_PROXY === "1";

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
// 忽略列表 — 内部属性/方法不记录，减少日志噪音
// ═══════════════════════════════════════════════════════════════

const DEFAULT_IGNORE = new Set([
  // 原型链内部
  "prototype",
  "constructor",
  "__proto__",
  // Symbol 标签
  Symbol.toStringTag,
  Symbol.iterator,
  Symbol.hasInstance,
  Symbol.toPrimitive,
  Symbol.asyncIterator,
  Symbol.match,
  Symbol.replace,
  Symbol.search,
  Symbol.split,
  Symbol.species,
  Symbol.unscopables,
  // Object.prototype 方法
  "toString",
  "valueOf",
  "hasOwnProperty",
  "toJSON",
  "toLocaleString",
  "isPrototypeOf",
  "propertyIsEnumerable",
  // Function.prototype 方法
  "call",
  "apply",
  "bind",
  // 废弃方法（某些检测会访问）
  "__defineGetter__",
  "__defineSetter__",
  "__lookupGetter__",
  "__lookupSetter__",
  // Node.js 内部
  "inspect",
  "customInspect",
  "domain",
]);

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
      // Symbol.toPrimitive 特殊处理：返回 [object <name>]
      if (prop === Symbol.toPrimitive) {
        return function (hint) {
          if (hint === "string") return "[object " + objName + "]";
          if (hint === "number") return NaN;
          return null;
        };
      }

      // 忽略列表直接透传
      if (DEFAULT_IGNORE.has(prop)) {
        return Reflect.get(target, prop, receiver);
      }

      const value = Reflect.get(target, prop, receiver);
      const propStr =
        typeof prop === "symbol" ? prop.toString() : String(prop);
      const key = "get:" + objName + "." + propStr;

      // undefined 警告（最高价值日志）
      if (value === undefined) {
        logOnce(
          "undef:" + key,
          `\x1b[33m⚠️  [GET] ${objName}.${propStr} → undefined\x1b[0m`,
        );
      } else {
        logOnce(key, `[GET] ${objName}.${propStr} → ${_format(value)}`);
      }

      // window 上的函数自动 bind，防止 Illegal invocation
      if (
        objName === "window" &&
        typeof value === "function" &&
        // 跳过构造函数（有 prototype 且 constructor 指向自身）
        !(
          value.prototype &&
          value.prototype.constructor === value
        )
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
      const key = "set:" + objName + "." + propStr;

      logOnce(key, `[SET] ${objName}.${propStr} = ${_format(value)}`);

      return Reflect.set(target, prop, value, receiver);
    },
  };
}

// ═══════════════════════════════════════════════════════════════
// watch — 主入口
// ═══════════════════════════════════════════════════════════════

/**
 * 对 obj 施加 Proxy 监控。DEBUG_PROXY 关闭时返回原对象。
 *
 * @param {object|function} obj  - 要监控的对象
 * @param {string}          name - 对象名（日志前缀）
 * @returns {object|function} Proxy 包装后的对象（或原对象）
 */
function watch(obj, name) {
  if (!DEBUG_MODE) return obj;
  if (typeof obj !== "object" && typeof obj !== "function") return obj;
  return new Proxy(obj, createHandler(name, obj));
}

// ═══════════════════════════════════════════════════════════════
// 导出
// ═══════════════════════════════════════════════════════════════

module.exports = {
  DEBUG_MODE,
  watch,
  createHandler,
  v_log,
  logOnce,
  DEFAULT_IGNORE, // 允许站点在 env_site.js 中追加: DEFAULT_IGNORE.add("myNoisyProp")
};
