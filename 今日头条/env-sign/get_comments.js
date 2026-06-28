/**
 * get_comments.js — 获取今日头条文章全部评论 (补环境方案)
 * ========================================================
 *
 * 用法:
 *   node get_comments.js 7656329019402535474
 *   TOUTIAO_COOKIE="tt_webid=xxx; ttcid=xxx" node get_comments.js 7656329019402535474
 *
 * 输出: 文章全部评论 (自动翻页), JSON 格式
 */

const https = require("https");
const { ToutiaoSigner } = require("./sign");

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36";

const COOKIE = process.env.TOUTIAO_COOKIE || "";

// ═══════════════════════════════════════════════════════════════════
// HTTP 请求
// ═══════════════════════════════════════════════════════════════════

function httpGet(urlStr, cookie) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const opts = {
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method: "GET",
      headers: {
        "User-Agent": UA,
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "zh-CN,zh;q=0.9",
        Referer: "https://www.toutiao.com/",
        Cookie: cookie,
      },
      timeout: 15000,
    };
    const req = https.request(opts, (res) => {
      let data = "";
      res.setEncoding("utf-8");
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode === 200) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error("JSON parse error: " + data.slice(0, 200)));
          }
        } else {
          reject(
            new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`)
          );
        }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });
    req.end();
  });
}

// ═══════════════════════════════════════════════════════════════════
// 评论获取
// ═══════════════════════════════════════════════════════════════════

async function fetchComments(articleId, signer, cookie) {
  const allComments = [];
  let offset = 0;
  const count = 20;
  let hasMore = true;
  let page = 0;

  while (hasMore) {
    page++;
    const queryPath =
      `/article/v4/tab_comments/?aid=24&app_name=toutiao_web` +
      `&offset=${offset}&count=${count}` +
      `&group_id=${articleId}&item_id=${articleId}`;

    const sig = signer.sign(queryPath);
    const fullUrl = `https://www.toutiao.com${queryPath}&_signature=${encodeURIComponent(sig)}`;

    process.stderr.write(
      `  第 ${page} 页 (offset=${offset})... `
    );

    try {
      const data = await httpGet(fullUrl, cookie);

      // data 是 { 0: {comment:{...}}, 1: {...}, ... } 的对象
      const rawComments = data?.data || {};
      const commentList = Object.values(rawComments)
        .filter((v) => v && v.comment)
        .map((v) => v.comment);

      const total = data?.total_number ?? "?";

      if (commentList.length === 0) {
        process.stderr.write(`无评论\n`);
        hasMore = false;
        break;
      }

      allComments.push(...commentList);
      process.stderr.write(
        `${commentList.length} 条 (累计 ${allComments.length}/${total})\n`
      );

      hasMore = data?.has_more ?? false;
      offset += count;
    } catch (e) {
      process.stderr.write(`失败: ${e.message}\n`);
      hasMore = false;
    }
  }

  return allComments;
}

// ═══════════════════════════════════════════════════════════════════
// 格式化输出
// ═══════════════════════════════════════════════════════════════════

function formatComment(c, index) {
  return {
    index: index + 1,
    user: c.user_name || "匿名",
    text: (c.text || "").replace(/\n/g, " "),
    time: c.create_time
      ? new Date(c.create_time * 1000).toISOString().slice(0, 19).replace("T", " ")
      : "",
    likes: c.digg_count ?? 0,
    replies: c.reply_count ?? 0,
    location: c.publish_loc_info || "",
    comment_id: c.id_str || String(c.id),
  };
}

// ═══════════════════════════════════════════════════════════════════
// 主流程
// ═══════════════════════════════════════════════════════════════════

async function main() {
  const articleId = process.argv[2];
  if (!articleId) {
    console.error("用法: node get_comments.js <article_id>");
    console.error(
      "示例: node get_comments.js 7656329019402535474"
    );
    process.exit(1);
  }

  console.error("=== 今日头条文章评论获取 (补环境方案) ===\n");
  console.error(`文章 ID: ${articleId}`);
  console.error(`Cookie: ${COOKIE ? COOKIE.slice(0, 50) + "..." : "(无)"}\n`);

  // 1. 初始化签名器
  console.error("[1] 初始化签名器 (acrawler.js + JSONP)...");
  const signer = new ToutiaoSigner({ cookie: COOKIE, debug: false });
  await signer.init();
  console.error("    完成\n");

  // 2. 获取全部评论
  console.error("[2] 获取评论...");
  const comments = await fetchComments(articleId, signer, COOKIE);
  console.error(`\n    共 ${comments.length} 条评论\n`);

  // 3. 输出
  const result = {
    article_id: articleId,
    total: comments.length,
    comments: comments.map(formatComment),
  };

  console.log(JSON.stringify(result, null, 2));

  // 4. 摘要
  console.error("=== 评论摘要 ===");
  for (const c of result.comments.slice(0, 30)) {
    const loc = c.location ? ` [${c.location}]` : "";
    console.error(
      `[${c.index}] ${c.user}${loc}: ${c.text.slice(0, 80)}...  👍${c.likes}  💬${c.replies}`
    );
  }
  if (result.comments.length > 30) {
    console.error(`... 还有 ${result.comments.length - 30} 条`);
  }

  signer.close();
}

main().catch((e) => {
  console.error("失败:", e.message);
  process.exit(1);
});
