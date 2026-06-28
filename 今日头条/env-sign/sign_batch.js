/**
 * sign_batch.js — _signature 批量签名（供 Python subprocess 调用）
 *
 * 从 stdin 读取 API path（每行一个），初始化一次后批量签名，结果写入 stdout。
 *
 * 用法:
 *   echo "/path/a" | node sign_batch.js      # 单条
 *   printf "/path/a\n/path/b\n" | node sign_batch.js  # 多条
 *
 * 输出格式（每行一个 JSON）:
 *   {"path":"/path/a","sig":"_02B4Z6wo00f01..."}
 */

const readline = require("readline");
const { ToutiaoSigner } = require("./sign");

const COOKIE = process.env.TOUTIAO_COOKIE || "";

async function main() {
  // 1. 收集所有输入行
  const paths = [];
  const rl = readline.createInterface({ input: process.stdin });

  for await (const line of rl) {
    const p = line.trim();
    if (p) paths.push(p);
  }

  if (paths.length === 0) {
    process.exit(0);
  }

  // 2. 初始化签名器（一次性）
  const signer = new ToutiaoSigner({ cookie: COOKIE, debug: false });
  try {
    await signer.init();
  } catch (e) {
    process.stderr.write("signer init failed: " + e.message + "\n");
    process.exit(1);
  }

  // 3. 批量签名
  for (const p of paths) {
    try {
      const sig = signer.sign(p);
      process.stdout.write(JSON.stringify({ path: p, sig: sig }) + "\n");
    } catch (e) {
      process.stdout.write(JSON.stringify({ path: p, sig: "", error: e.message }) + "\n");
    }
  }

  signer.close();
}

main();
