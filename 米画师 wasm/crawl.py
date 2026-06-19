"""
米画师 (mihuashi.com) 橱窗素材爬虫

通过 sign.py 生成 M-S 签名头, 使用 requests 获取橱窗数据。

逆向分析:
  网站: https://www.mihuashi.com/
  接口: GET /api/v1/stalls
  参数: category, only_fast, order, page, per, state
  签名: M-S (88字符), M-T (Unix秒时间戳), Web-Version: frontend
  算法: Rust WASM signtool_sign(url_path, timestamp)
        signtool_new() 读取 favicon href + meta keywords content + crypto 随机数派生密钥
  响应: JSON, 含 stalls 列表 (title, author, price, image 等)

用法:
    python crawl.py                          # 默认: 分类 16, 1 页, 每页 20 条
    python crawl.py --category 16 --pages 3  # 3 页
    python crawl.py -c 1 -p 1 -s 40          # 分类 1, 1 页, 每页 40 条
"""

import argparse
import io
import sys
import time

import requests
from sign import sign_request

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

API_BASE = "https://www.mihuashi.com"
DEFAULT_CATEGORY = 16
DEFAULT_PER_PAGE = 20
DEFAULT_PAGES = 1


def fetch_stalls(
    category: int,
    page: int = 1,
    per: int = DEFAULT_PER_PAGE,
    only_fast: bool = False,
    order: int = 2,
    state: str = "forsale",
) -> dict:
    """获取一页橱窗数据。"""
    url_path = "/api/v1/stalls"
    params = {
        "category": category,
        "only_fast": str(only_fast).lower(),
        "order": order,
        "page": page,
        "per": per,
        "state": state,
    }

    headers = sign_request(url_path)
    headers.update({
        "accept": "application/json, text/plain, */*",
        "accept-language": "zh-CN,zh;q=0.9",
        "user-agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/148.0.0.0 Safari/537.36"
        ),
        "referer": f"https://www.mihuashi.com/stalls?category={category}",
    })

    url = f"{API_BASE}{url_path}"
    resp = requests.get(url, params=params, headers=headers, timeout=30)
    resp.raise_for_status()
    return resp.json()


def crawl(category: int, pages: int, per: int = DEFAULT_PER_PAGE):
    """爬取多页橱窗数据。"""
    all_stalls = []
    category_name = ""

    for pg in range(1, pages + 1):
        print(f"获取第 {pg}/{pages} 页 (category={category})...", end=" ", flush=True)

        data = fetch_stalls(category, page=pg, per=per)
        stalls = data.get("stalls", [])

        if not stalls:
            print("无数据，停止。")
            break

        # 取分类名
        cat_info = data.get("category", {})
        category_name = cat_info.get("name", category_name) or cat_info.get("label", "")

        new_count = 0
        for stall in stalls:
            sid = stall.get("id", "")
            if sid:
                all_stalls.append(stall)
                new_count += 1

        print(f"{len(stalls)} 条, 新增 {new_count} (累计 {len(all_stalls)})")

        # 最后一页可能不够 per 条
        if len(stalls) < per:
            print("已到最后一页。")
            break

        time.sleep(0.5)  # 礼貌延时

    return category_name, all_stalls


def print_stalls(category_name: str, stalls: list):
    """格式化打印橱窗列表到控制台。"""
    print(f"\n{'=' * 60}")
    print(f"分类: {category_name}")
    print(f"共 {len(stalls)} 个橱窗")
    print(f"{'=' * 60}")

    for i, stall in enumerate(stalls, 1):
        name = stall.get("name", "无标题")
        sid = stall.get("id", "")
        price = stall.get("price", "")
        cover = stall.get("cover_url", "")
        sales = stall.get("sales", 0)
        stock = stall.get("stock", 0)
        stall_type = stall.get("stall_type", "")
        limit = stall.get("limit", 1)

        print(f"\n[{i}] {name}")
        print(f"    ID: {sid}")
        if price:
            print(f"    价格: {price}")
        print(f"    销量: {sales}  库存: {stock}")
        if stall_type:
            print(f"    类型: {stall_type}  限购: {limit}")
        if cover:
            print(f"    图片: {cover}")


def parse_args():
    p = argparse.ArgumentParser(description="米画师 (mihuashi.com) 橱窗爬虫")
    p.add_argument(
        "--category", "-c", type=int, default=DEFAULT_CATEGORY,
        help=f"分类 ID (默认: {DEFAULT_CATEGORY})",
    )
    p.add_argument(
        "--pages", "-p", type=int, default=DEFAULT_PAGES,
        help=f"翻页数 (默认: {DEFAULT_PAGES})",
    )
    p.add_argument(
        "--per", "-s", type=int, default=DEFAULT_PER_PAGE,
        help=f"每页条数 (默认: {DEFAULT_PER_PAGE})",
    )
    return p.parse_args()


def main():
    args = parse_args()

    print("米画师橱窗爬虫 / mihuashi.com Stall Crawler")
    print(f"{'=' * 50}")
    print(f"分类 ID: {args.category}")
    print(f"翻页数:  {args.pages}")
    print(f"每页条数: {args.per}")
    print(f"{'=' * 50}")

    try:
        cat_name, stalls = crawl(args.category, args.pages, args.per)
    except Exception as e:
        print(f"\n错误: {e}", file=sys.stderr)
        sys.exit(1)

    if stalls:
        print_stalls(cat_name, stalls)
    else:
        print("\n未获取到任何橱窗数据。")


if __name__ == "__main__":
    main()
