/**
 * sign_cli.js — _signature 签名 CLI（供 Python subprocess 调用）
 *
 * 用法:
 *   node sign_cli.js "/article/v4/tab_comments/?aid=24&..."
 *   输出: _02B4Z6wo00f01... (纯文本，stdout)
 *
 * 优化: 首次 init() 后缓存 signer 实例，后续调用复用
 */

const { ToutiaoSigner } = require("./sign");

const COOKIE = process.env.TOUTIAO_COOKIE || "";

let _signer = null;
let _initPromise = null;

async function getSigner() {
  if (_signer && _signer._ready) return _signer;
  if (_initPromise) {
    await _initPromise;
    return _signer;
  }

  _signer = new ToutiaoSigner({ cookie: COOKIE, debug: false });
  _initPromise = _signer.init().then(() => {
    _initPromise = null;
  });
  await _initPromise;
  return _signer;
}

async function main() {
  const apiPath = process.argv[2];
  if (!apiPath) {
    process.stderr.write("用法: node sign_cli.js <api_path>\n");
    process.exit(1);
  }

  try {
    const signer = await getSigner();
    const sig = signer.sign(apiPath);
    process.stdout.write(sig);
  } catch (e) {
    process.stderr.write("签名失败: " + e.message + "\n");
    process.exit(1);
  }
}

main();
