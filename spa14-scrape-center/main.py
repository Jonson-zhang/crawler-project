#!/usr/bin/env python3
"""
spa14.scrape.center API 客户端 (Python)

Sign 算法（从 WASM 反编译）:
  encrypt(offset, timestamp) = offset + timestamp // 3 + 16358

WASM 函数反汇编:
  local.get 0      ;; offset
  local.get 1      ;; timestamp (Unix 秒)
  i32.const 3
  i32.div_s        ;; timestamp // 3 (有符号整除)
  i32.add          ;; offset + timestamp // 3
  i32.const 16358  ;; 常量 (LEB128: e6 ff 00 → 16358)
  i32.add          ;; offset + timestamp // 3 + 16358
"""

import sys
import time
import urllib.request

# 修复 Windows 终端 GBK 编码问题
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
import urllib.error
import json
import ssl
from typing import Optional, List, Dict, Any, Callable

BASE_URL = "https://spa14.scrape.center"
HEADERS = {
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "zh-CN,zh;q=0.9",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
    "Referer": "https://spa14.scrape.center/",
}


def generate_sign(offset: int, timestamp: Optional[int] = None) -> int:
    """
    生成 sign 参数

    Args:
        offset: 分页偏移量 (0, 10, 20, ...)
        timestamp: Unix 秒级时间戳，默认当前时间

    Returns:
        sign 值
    """
    if timestamp is None:
        timestamp = int(time.time())
    return offset + timestamp // 3 + 16358


def _make_request(url: str) -> Dict[str, Any]:
    """发送 GET 请求并返回 JSON"""
    req = urllib.request.Request(url, headers=HEADERS)
    ctx = ssl.create_default_context()

    try:
        with urllib.request.urlopen(req, context=ctx, timeout=15) as resp:
            body = resp.read().decode("utf-8")
            return json.loads(body)
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {e.code}: {body[:200]}")
    except urllib.error.URLError as e:
        raise RuntimeError(f"请求失败: {e.reason}")


def fetch_movies(offset: int = 0, limit: int = 10) -> Dict[str, Any]:
    """
    获取电影列表（底层 offset 接口）

    Args:
        offset: 分页偏移量
        limit: 每页条数（默认 10）

    Returns:
        {"count": int, "results": [...]}
    """
    timestamp = int(time.time())
    sign = generate_sign(offset, timestamp)
    url = f"{BASE_URL}/api/movie/?limit={limit}&offset={offset}&sign={sign}"
    return _make_request(url)


def fetch_page(page: int, limit: int = 10) -> Dict[str, Any]:
    """
    按页码获取电影列表（页码从 1 开始）

    Args:
        page: 页码（1, 2, 3, ...）
        limit: 每页条数（默认 10）

    Returns:
        {"count": int, "results": [...], "page": int, "limit": int}
    """
    offset = (page - 1) * limit
    data = fetch_movies(offset, limit)
    data["page"] = page
    data["limit"] = limit
    return data


def fetch_movie_by_id(movie_id: int) -> Optional[Dict[str, Any]]:
    """
    按 ID 查询单部电影

    Args:
        movie_id: 电影 ID（1 起始）

    Returns:
        电影信息 dict，未找到返回 None
    """
    data = fetch_movies(offset=movie_id - 1, limit=1)
    results = data.get("results", [])
    return results[0] if results else None


def fetch_all_movies(
    limit: int = 10,
    on_page: Optional[Callable[[Dict[str, Any], int], None]] = None,
    max_pages: int = 0,
) -> Dict[str, int]:
    """
    翻页抓取全部电影

    Args:
        limit: 每页条数
        on_page: 每页回调 (page_data, page_index)
        max_pages: 最大页数（0 = 全部）

    Returns:
        {"total": int, "fetched": int}
    """
    data = fetch_movies(0, limit)
    total = data["count"]
    fetched = len(data.get("results", []))

    if on_page:
        on_page(data, 0)

    page = 1
    while fetched < total and (max_pages == 0 or page < max_pages):
        data = fetch_movies(page * limit, limit)
        fetched += len(data.get("results", []))
        if on_page:
            on_page(data, page)
        page += 1
        time.sleep(0.5)  # 避免触发频率限制

    return {"total": total, "fetched": fetched}


def print_movie(m: Dict[str, Any]) -> None:
    """格式化打印一部电影"""
    print(f"  [{m['id']}] {m['name']} ({m['alias']})")
    print(f"      上映: {m['published_at']} | {m['minute']}分钟 | 评分: {m['score']}")
    print(f"      分类: {', '.join(m['categories'])}")
    print(f"      地区: {', '.join(m['regions'])}")


# ═══════════════════════════════════════════════════════
# 配置区 — 修改这里的参数即可
# ═══════════════════════════════════════════════════════
CONFIG = {
    "start_page": 1,   # 起始页码（1 开始）
    "pages": 3,        # 要获取的页数
    "limit": 10,       # 每页条数（上限 10）
}


def print_all_movies(data: Dict[str, Any]) -> None:
    """格式化打印一页的全部电影"""
    page = data.get("page", "?")
    print(f"\n{'─' * 50}")
    print(f"  第 {page} 页 (共 {data['count']} 部)")
    print(f"{'─' * 50}")
    for m in data["results"]:
        print(f"  [{m['id']:>3}] {m['name']:<12} {m['score']}分  "
              f"{m['published_at']}  {', '.join(m['categories'])}")


# ─── 主程序 ──────────────────────────────────────────
if __name__ == "__main__":
    print("=== spa14.scrape.center 电影 API ===\n")
    print(f"配置: 从第 {CONFIG['start_page']} 页开始，取 {CONFIG['pages']} 页，每页 {CONFIG['limit']} 条\n")

    all_movies = []
    for i in range(CONFIG["pages"]):
        page = CONFIG["start_page"] + i
        data = fetch_page(page, CONFIG["limit"])
        print_all_movies(data)
        all_movies.extend(data["results"])
        if i < CONFIG["pages"] - 1:
            time.sleep(0.5)

    print(f"\n{'─' * 50}")
    print(f"  共获取 {len(all_movies)} 部电影")
    print(f"{'─' * 50}")
