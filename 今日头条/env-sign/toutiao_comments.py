"""
toutiao_comments.py — 今日头条文章评论获取（补环境方案）

用法:
    python toutiao_comments.py https://www.toutiao.com/article/7656329019402535474/
    python toutiao_comments.py 7656329019402535474
    python toutiao_comments.py https://www.toutiao.com/article/7656329019402535474/ -n 50
    设置 Cookie:
    set TOUTIAO_COOKIE="tt_webid=xxx; ttcid=xxx" && python toutiao_comments.py ...

输出: 文章全部评论（自动分页）
"""

import subprocess, json, re, sys, time
from pathlib import Path
from urllib.parse import urlencode

import requests

HERE = Path(__file__).parent

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/143.0.0.0 Safari/537.36"
)

COOKIE = ""  # 从环境变量或命令行设置


# ═══════════════════════════════════════════════════════════
# 文章 ID 提取
# ═══════════════════════════════════════════════════════════

def extract_article_id(url_or_id: str) -> str:
    """从 URL 或纯 ID 提取文章 ID"""
    s = url_or_id.strip()
    # 纯数字
    if re.match(r"^\d{10,}$", s):
        return s
    # /article/<id>  or /group/<id>
    for p in [r"/article/(\d+)", r"/group/(\d+)", r"group_id=(\d+)",
              r"item_id=(\d+)", r"article/(\d+)"]:
        m = re.search(p, s)
        if m:
            return m.group(1)
    raise ValueError(f"无法从 '{url_or_id}' 提取文章 ID")


# ═══════════════════════════════════════════════════════════
# 签名生成（通过 Node.js subprocess）
# ═══════════════════════════════════════════════════════════

def batch_sign(paths: list[str]) -> dict[str, str]:
    """批量生成 _signature，返回 {path: sig} 映射"""
    if not paths:
        return {}

    inp = "\n".join(paths)
    result = subprocess.run(
        ["node", str(HERE / "sign_batch.js")],
        input=inp,
        capture_output=True, text=True, timeout=30,
        cwd=str(HERE), encoding="utf-8", errors="replace",
    )

    sigs = {}
    for line in result.stdout.strip().split("\n"):
        if not line.strip():
            continue
        try:
            data = json.loads(line)
            sigs[data["path"]] = data.get("sig", "")
        except json.JSONDecodeError:
            pass

    stderr = result.stderr.strip()
    if stderr:
        print(f"  [signer] {stderr}", file=sys.stderr)

    return sigs


# ═══════════════════════════════════════════════════════════
# 评论获取
# ═══════════════════════════════════════════════════════════

def fetch_page(session: requests.Session, article_id: str,
               offset: int, sig: str) -> dict | None:
    """获取单页评论"""
    path = (
        f"/article/v4/tab_comments/"
        f"?aid=24&app_name=toutiao_web"
        f"&offset={offset}&count=20"
        f"&group_id={article_id}&item_id={article_id}"
    )
    full_url = f"https://www.toutiao.com{path}&_signature={sig}"

    try:
        resp = session.get(full_url, timeout=15)
        if resp.status_code == 200 and len(resp.content) > 50:
            return resp.json()
    except requests.RequestException as e:
        print(f"  HTTP 错误: {e}", file=sys.stderr)
    return None


def fetch_all_comments(article_id: str, max_comments: int | None = None
                       ) -> list[dict]:
    """获取文章全部评论"""
    session = requests.Session()
    session.headers.update({
        "User-Agent": UA,
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "zh-CN,zh;q=0.9",
        "Referer": "https://www.toutiao.com/",
        "Cookie": COOKIE,
    })

    # 1. 先获取第一页，确认 total
    print(f"  [1] 获取第一页...", file=sys.stderr)
    path0 = (
        f"/article/v4/tab_comments/"
        f"?aid=24&app_name=toutiao_web"
        f"&offset=0&count=20"
        f"&group_id={article_id}&item_id={article_id}"
    )
    sigs0 = batch_sign([path0])
    sig0 = sigs0.get(path0, "")
    if not sig0:
        print("  签名失败", file=sys.stderr)
        return []

    page0 = fetch_page(session, article_id, 0, sig0)
    if not page0 or page0.get("message") != "success":
        print(f"  API 失败: {page0}", file=sys.stderr)
        return []

    total = page0.get("total_number", 0)
    has_more = page0.get("has_more", False)
    print(f"  第一页成功，总计 {total} 条评论", file=sys.stderr)

    all_comments = _extract_comments(page0)
    count = 20 if max_comments is None else min(20, max_comments)

    # 2. 如果还有更多页，批量签名 + 批量获取
    if has_more and (max_comments is None or len(all_comments) < max_comments):
        # 计算需要的页数
        remaining = total - 20
        if max_comments:
            remaining = min(remaining, max_comments - len(all_comments))

        offsets = list(range(20, 20 + remaining, 20))
        # 限制 max_comments
        if max_comments and len(all_comments) + len(offsets) * 20 > max_comments:
            offsets = offsets[:(max_comments - len(all_comments) + 19) // 20]

        # 构建所有路径
        offset_paths = {}
        for off in offsets:
            p = (
                f"/article/v4/tab_comments/"
                f"?aid=24&app_name=toutiao_web"
                f"&offset={off}&count=20"
                f"&group_id={article_id}&item_id={article_id}"
            )
            offset_paths[p] = off

        if offset_paths:
            print(f"  [2] 批量签名 {len(offset_paths)} 页...", file=sys.stderr)
            sigs = batch_sign(list(offset_paths.keys()))

            for path_str, off in offset_paths.items():
                sig = sigs.get(path_str, "")
                if not sig:
                    continue
                page = fetch_page(session, article_id, off, sig)
                if page and page.get("message") == "success":
                    comments = _extract_comments(page)
                    all_comments.extend(comments)
                else:
                    break

                if max_comments and len(all_comments) >= max_comments:
                    break

    # 截断到 max
    if max_comments:
        all_comments = all_comments[:max_comments]

    return all_comments


def _extract_comments(data: dict) -> list[dict]:
    """从 API 响应中提取评论列表"""
    raw = data.get("data", {})
    if isinstance(raw, list):
        # data 是数组
        return [c["comment"] for c in raw if isinstance(c, dict) and "comment" in c]
    if isinstance(raw, dict):
        # data 是 {0: {comment:...}, 1: ...}
        result = []
        for v in raw.values():
            if isinstance(v, dict) and "comment" in v:
                result.append(v["comment"])
        return result
    return []


# ═══════════════════════════════════════════════════════════
# 格式化输出
# ═══════════════════════════════════════════════════════════

def format_time(ts: int) -> str:
    if not ts:
        return ""
    return time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(ts))


def print_comments(comments: list[dict]) -> None:
    """打印评论列表"""
    for c in comments:
        idx = comments.index(c) + 1
        user = c.get("user_name", "匿名")
        text = (c.get("text", "") or "").replace("\n", " ")
        loc = c.get("publish_loc_info", "")
        t = format_time(c.get("create_time", 0))
        likes = c.get("digg_count", 0)
        replies = c.get("reply_count", 0)

        loc_str = f" [{loc}]" if loc else ""
        print(f"[{idx:>3}] {user}{loc_str}  {t}")
        if text:
            print(f"      {text}")
        print(f"      👍{likes}  💬{replies}")
        print()


# ═══════════════════════════════════════════════════════════
# 主入口
# ═══════════════════════════════════════════════════════════

def main():
    global COOKIE
    import os
    COOKIE = os.environ.get("TOUTIAO_COOKIE", "")

    if len(sys.argv) < 2:
        print("用法: python toutiao_comments.py <文章URL或ID> [-n 数量]")
        print("示例: python toutiao_comments.py https://www.toutiao.com/article/7656329019402535474/")
        print("      python toutiao_comments.py 7656329019402535474 -n 50")
        print()
        print("环境变量: TOUTIAO_COOKIE (可选，提升获取数量)")
        sys.exit(1)

    url_or_id = sys.argv[1]
    max_n = None

    # 解析 -n 参数
    for i, arg in enumerate(sys.argv):
        if arg == "-n" and i + 1 < len(sys.argv):
            try:
                max_n = int(sys.argv[i + 1])
            except ValueError:
                pass

    # 提取文章 ID
    try:
        article_id = extract_article_id(url_or_id)
    except ValueError as e:
        print(f"错误: {e}", file=sys.stderr)
        sys.exit(1)

    print(f"文章 ID: {article_id}", file=sys.stderr)
    if COOKIE:
        print(f"Cookie: {COOKIE[:60]}...", file=sys.stderr)
    if max_n:
        print(f"限制: {max_n} 条", file=sys.stderr)
    print(file=sys.stderr)

    # 获取评论
    comments = fetch_all_comments(article_id, max_comments=max_n)

    if not comments:
        print("未获取到评论", file=sys.stderr)
        sys.exit(1)

    print(f"\n共 {len(comments)} 条评论\n")
    print(f"{'='*70}")
    print_comments(comments)
    print(f"{'='*70}")
    print(f"共 {len(comments)} 条评论")


if __name__ == "__main__":
    if sys.platform == "win32":
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    main()
