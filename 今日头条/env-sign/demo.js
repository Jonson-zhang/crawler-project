/**
 * demo.js — 今日头条 _signature 补环境方案使用示例
 *
 * 基于 acrawler.js SDK, 在 Node.js vm 沙箱中生成 _signature。
 * 签名长度 47 字符 (短签名已验证可通过 API 验证)。
 *
 * 用法:
 *   node demo.js                              # 基本演示
 *   TOUTIAO_COOKIE="tt_webid=..." node demo.js # 带 Cookie (JSONP 可选)
 */

const { ToutiaoSigner } = require("./sign");

// 从环境变量读取 Cookie (JSONP 请求时需要，可留空)
const COOKIE = process.env.TOUTIAO_COOKIE || "";

async function main() {
  console.log("=== 今日头条 _signature 签名 — 纯 Node.js 补环境 ===\n");

  // 1. 创建签名器
  const signer = new ToutiaoSigner({
    cookie: COOKIE,
    debug: true,
  });

  try {
    // 2. 初始化 (含 JSONP 请求到 xxbg.snssdk.com)
    console.log("[1] 初始化签名器...");
    await signer.init();
    console.log("    完成\n");

    // 3. 生成 _signature
    console.log("[2] 生成 _signature...");

    const commentPath =
      "/article/v4/tab_comments/?aid=24&app_name=toutiao_web&offset=0&count=20" +
      "&group_id=7630793912500437540&item_id=7630793912500437540";

    const sig = signer.sign(commentPath);
    console.log(`    _signature = ${sig}`);
    console.log(`    长度: ${sig.length}`);
    console.log(`    模式: ${signer.getMode(sig)}\n`);

    // 4. 一致性检查
    console.log("[3] 一致性检查...");
    const sig2 = signer.sign(commentPath);
    console.log(`    相同输入 => 相同输出: ${sig === sig2 ? "是 ✓" : "否 ✗"}`);

    const sig3 = signer.sign(commentPath + "&foo=bar");
    console.log(`    不同URL => 不同签名: ${sig !== sig3 ? "是 ✓" : "否 ✗"}\n`);

    // 5. 测试多个 API
    console.log("[4] 不同 API 签名:");

    const apis = [
      "/api/pc/info",
      "/hot-event/hot-board/?origin=toutiao_pc",
      "/api/pc/user/follow",
    ];

    for (const api of apis) {
      const s = signer.sign(api);
      console.log(`    ${api}`);
      console.log(`    => ${s.slice(0, 50)}... (${s.length} chars)`);
    }

    console.log("\n=== 完成 ===");
  } catch (e) {
    console.error("签名失败:", e.message);
  } finally {
    signer.close();
  }
}

main();
