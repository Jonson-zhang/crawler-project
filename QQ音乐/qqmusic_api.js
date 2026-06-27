/**
 * QQ音乐 API 签名/加解密工具 — Object.create 原型链补环境
 *
 * 用法:
 *   node qqmusic_api.js sign <json_data>
 *   node qqmusic_api.js encrypt <json_data>
 *   node qqmusic_api.js decrypt <base64_data>
 *
 *   数据也可通过 --file <path> 或 stdin 传入
 *
 * 输出: JSON { success: true, result: "..." }
 */

const fs = require('fs');
const path = require('path');

// ── 保存 Node.js 原生引用（setupEnv 会隐藏 process/require/module）──
const _process = process;
const _require = require;
const _Buffer = Buffer;
const _setTimeout = setTimeout;
const _clearTimeout = clearTimeout;

// ── 1. 构建浏览器环境（Object.create 原型链方案）────────────────
const { setupEnv } = _require('../.claude/env-patch/env_patch.js');

setupEnv({
  url: 'https://y.qq.com/',
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
  platform: 'Win32',
  languages: ['zh-CN', 'zh'],
  screenWidth: 1920,
  screenHeight: 1080,
  colorDepth: 24,
  devicePixelRatio: 1,
  title: 'QQ音乐',
  cookie: '',
  hardwareConcurrency: 16,
  vendor: 'Google Inc.',

  canvas: true,
  webgl: false,
  plugins: false,    // QQ音乐不需要 plugins/mimeTypes
  storage: false,     // QQ音乐不需要 storage
  extraConstructors: true,
  crypto: false,      // 下面手工挂载 Node.js 原生 Web Crypto
});

// ── 2. 挂载真实的 Web Crypto API（QQ音乐加解密必须用真 crypto）──
const nodeWebCrypto = _require('crypto').webcrypto;
if (nodeWebCrypto) {
  global.crypto = nodeWebCrypto;
} else {
  // Node < 20 fallback
  global.crypto = globalThis.crypto || {
    getRandomValues(arr) {
      const bytes = _require('crypto').randomBytes(arr.length);
      for (let i = 0; i < arr.length; i++) arr[i] = bytes[i];
      return arr;
    },
    subtle: undefined,
    randomUUID() { return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'; },
  };
}

// ── 3. 初始化 webpack 模块系统 ─────────────────────────────────
global.window.webpackJsonp = [];
eval(fs.readFileSync(path.join(__dirname, 'runtime.js'), 'utf-8'));

// 加载必需的 chunk 文件
['common.chunk.js', 'vendor.chunk.js'].forEach(f => {
  const p = path.join(__dirname, f);
  if (fs.existsSync(p)) eval(fs.readFileSync(p, 'utf-8'));
});

// 执行模块8（包含签名/加解密函数）
const wpRequire = global.window.__webpack_require__;
if (wpRequire && wpRequire.m && wpRequire.m[8]) {
  wpRequire(8);
}

// ── 获取函数引用 ──────────────────────────────────────────────
const getSecuritySign = global.window._getSecuritySign;
const cgiEncrypt = global.window.__cgiEncrypt;
const cgiDecrypt = global.window.__cgiDecrypt;

// ── 主入口 ────────────────────────────────────────────────────
async function main() {
  const action = _process.argv[2];
  let input = _process.argv[3];

  // 支持 --file 参数：从文件读取大数据
  if (input === '--file' && _process.argv[4]) {
    input = fs.readFileSync(_process.argv[4], 'utf-8');
  }

  // 支持 stdin 输入
  if (input === '-' || (input === undefined && _process.argv.length <= 3)) {
    input = fs.readFileSync(0, 'utf-8');
  }

  if (!action || !input) {
    _process.stderr.write(JSON.stringify({ success: false, error: 'Usage: node qqmusic_api.js <sign|encrypt|decrypt> <data>' }) + '\n');
    _process.exit(1);
  }

  const timeout = _setTimeout(() => {
    _process.stderr.write(JSON.stringify({ success: false, error: 'Operation timed out' }) + '\n');
    _process.exit(1);
  }, 30000);

  try {
    let result;
    switch (action) {
      case 'sign':
        if (!getSecuritySign) throw new Error('Sign function not available');
        result = getSecuritySign(typeof input === 'string' ? input : JSON.stringify(input));
        break;
      case 'encrypt':
        if (!cgiEncrypt) throw new Error('Encrypt function not available');
        result = await cgiEncrypt(typeof input === 'string' ? input : JSON.stringify(input));
        break;
      case 'decrypt':
        if (!cgiDecrypt) throw new Error('Decrypt function not available');
        {
          const binaryBuf = _Buffer.from(input.trim(), 'base64');
          const uint8 = new Uint8Array(binaryBuf.buffer, binaryBuf.byteOffset, binaryBuf.byteLength);
          result = cgiDecrypt(uint8);
        }
        break;
      default:
        throw new Error('Unknown action: ' + action);
    }
    _clearTimeout(timeout);
    _process.stdout.write(JSON.stringify({ success: true, result: result }) + '\n');
    _process.exit(0);
  } catch (e) {
    _clearTimeout(timeout);
    _process.stderr.write(JSON.stringify({ success: false, error: e.message }) + '\n');
    _process.exit(1);
  }
}

main();
