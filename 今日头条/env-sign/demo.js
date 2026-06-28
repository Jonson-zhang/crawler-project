/**
 * demo.js — 签名器快速测试
 *
 * 用法: node demo.js
 * 作用: 验证 sign.js 初始化 + 签名是否正常，与 Python 层无关
 */

const { ToutiaoSigner } = require("./sign");

async function main() {
  console.log("=== _signature 签名器测试 ===\n");

  const signer = new ToutiaoSigner({ debug: true });
  try {
    await signer.init();
    console.log("初始化 OK\n");

    const path = "/article/v4/tab_comments/?aid=24&app_name=toutiao_web&offset=0&count=20&group_id=7630793912500437540&item_id=7630793912500437540";
    const sig = signer.sign(path);
    console.log(`签名: ${sig}`);
    console.log(`长度: ${sig.length}  模式: ${signer.getMode(sig)}`);

    const sig2 = signer.sign(path);
    console.log(`确定性: ${sig === sig2 ? "OK" : "FAIL"}`);

    const sig3 = signer.sign(path + "&x=1");
    console.log(`URL敏感: ${sig !== sig3 ? "OK" : "FAIL"}`);
  } catch (e) {
    console.error("失败:", e.message);
    process.exit(1);
  } finally {
    signer.close();
  }
}

main();
