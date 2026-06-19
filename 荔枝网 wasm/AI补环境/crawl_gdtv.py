"""
荔枝网 (gdtv.cn) 频道新闻爬虫 / gdtv.cn Channel News Crawler

通过 Node.js subprocess 调用 WASM 签名模块生成安全头,
然后用 Python requests 发送 API 请求获取数据。

用法 / Usage:
    python crawl_gdtv.py                         # 频道 246, 1 页 (默认)
    python crawl_gdtv.py --channel 246 --pages 3 # 3 页
    python crawl_gdtv.py --channel 249 -s 80     # 每页 80 条

签名模块: gdtv_sign.py (调用 sign.js)
"""

import argparse
import json
import sys
from datetime import datetime

import requests
from gdtv_sign import sign_request

API_BASE = "https://gdtv-api.gdtv.cn"
DEFAULT_CHANNEL_ID = 246
DEFAULT_PAGE_SIZE = 40
DEFAULT_PAGES = 5


def fetch_news(
    channel_id: int, page_size: int, device_id: str = "", begin_score: int = 0
) -> dict:
    """获取指定频道的一页新闻数据。"""
    url = f"{API_BASE}/api/channel/v1/news"
    params = {
        "pageSize": page_size,
        "channelId": channel_id,
        "beginScore": begin_score,
    }

    # 生成签名头
    query_string = "&".join(f"{k}={v}" for k, v in params.items())
    full_url = f"{url}?{query_string}"
    headers = sign_request("GET", full_url, device_id=device_id)
    headers = {k: str(v) for k, v in headers.items()}

    # 添加通用请求头
    headers.update(
        {
            "accept": "application/json, text/plain, */*",
            "accept-language": "zh-CN,zh;q=0.9",
            "origin": "https://www.gdtv.cn",
            "referer": "https://www.gdtv.cn/",
            "user-agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/148.0.0.0 Safari/537.36"
            ),
        }
    )

    resp = requests.get(url, params=params, headers=headers, timeout=30)
    resp.raise_for_status()
    return resp.json()


def crawl(channel_id: int, total_pages: int, page_size: int, device_id: str = ""):
    """爬取频道新闻数据,返回 (频道名, 新闻列表)。"""
    all_news = []
    channel_name = ""
    seen_ids = set()
    begin_score = 0

    for pg in range(1, total_pages + 1):
        print(
            f"\n获取第 {pg}/{total_pages} 页 (beginScore={begin_score})...",
            end=" ",
            flush=True,
        )

        data = fetch_news(channel_id, page_size, device_id, begin_score)
        if pg == 1:
            channel_name = data.get("name", "未知")

        news_list = data.get("list", [])
        new_items = 0
        min_score = None
        for item in news_list:
            try:
                news_data = json.loads(item.get("data", "{}"))
                news_id = news_data.get("id", "")
                score = news_data.get("releasedAt", 0)
                if score:
                    if min_score is None or score < min_score:
                        min_score = score
                if news_id and news_id not in seen_ids:
                    seen_ids.add(news_id)
                    all_news.append(news_data)
                    new_items += 1
            except json.JSONDecodeError:
                pass

        print(f"{len(news_list)} 条, 新增 {new_items} (累计 {len(all_news)})")

        if new_items == 0 or min_score is None:
            print("没有新数据, 停止翻页")
            break

        begin_score = min_score

    return channel_name, all_news


def print_news(channel_name: str, news_list: list):
    """打印新闻列表到控制台。"""
    print(f"\n{'=' * 60}")
    print(f"频道: {channel_name}")
    print(f"共 {len(news_list)} 条新闻")
    print(f"{'=' * 60}")

    for i, news in enumerate(news_list, 1):
        title = news.get("title", "无标题")
        news_id = news.get("id", "")
        released_at = news.get("releasedAt", 0)
        cover_url = news.get("coverUrl", "")
        read_count = news.get("readCount", 0)
        author = news.get("author", "")

        if released_at:
            try:
                dt = datetime.fromtimestamp(released_at / 1000)
                time_str = dt.strftime("%Y-%m-%d %H:%M:%S")
            except (ValueError, OSError):
                time_str = str(released_at)
        else:
            time_str = "未知"

        print(f"\n[{i}] {title}")
        print(f"    ID: {news_id}")
        print(f"    时间: {time_str}")
        print(f"    阅读: {read_count}")
        if author:
            print(f"    作者: {author}")
        if cover_url:
            print(f"    封面: {cover_url}")


def parse_args():
    p = argparse.ArgumentParser(description="荔枝网新闻爬虫")
    p.add_argument(
        "--channel",
        "-c",
        type=int,
        default=DEFAULT_CHANNEL_ID,
        help=f"频道ID (默认: {DEFAULT_CHANNEL_ID})",
    )
    p.add_argument(
        "--pages",
        "-p",
        type=int,
        default=DEFAULT_PAGES,
        help=f"页数 (默认: {DEFAULT_PAGES})",
    )
    p.add_argument(
        "--page-size",
        "-s",
        type=int,
        default=DEFAULT_PAGE_SIZE,
        help=f"每页条数 (默认: {DEFAULT_PAGE_SIZE})",
    )
    return p.parse_args()


def main():
    args = parse_args()

    print("荔枝网新闻爬虫 / gdtv.cn News Crawler")
    print(f"{'=' * 50}")
    print(f"频道ID: {args.channel}")
    print(f"页数: {args.pages}")
    print(f"每页条数: {args.page_size}")
    print(f"{'=' * 50}")

    try:
        channel_name, news_list = crawl(args.channel, args.pages, args.page_size)
    except Exception as e:
        print(f"\n错误: {e}")
        sys.exit(1)

    if news_list:
        print_news(channel_name, news_list)
    else:
        print("\n未获取到任何新闻数据。")


if __name__ == "__main__":
    main()
