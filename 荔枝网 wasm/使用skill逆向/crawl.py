"""
荔枝网 (gdtv.cn) 频道新闻爬虫

通过调用 sign.py 生成签名头，使用 requests 发送 API 请求获取数据。

逆向分析:
  - 网站: https://www.gdtv.cn/
  - 接口: GET https://gdtv-api.gdtv.cn/api/channel/v1/news
  - 参数: pageSize, channelId, currentPage (或 beginScore 翻页)
  - 签名头: x-itouchtv-ca-key / x-itouchtv-ca-signature / x-itouchtv-ca-timestamp
           x-itouchtv-client / x-itouchtv-device-id
  - 签名算法: Rust WASM (wasm-bindgen), B.a(method, url, devId, client, data, ext) → Map
  - 响应: JSON, data 字段为 JSON 字符串需二次解析

用法:
    python crawl.py                          # 默认: 频道 246, 5 页, 每页 40 条
    python crawl.py --channel 246 --pages 3  # 频道 246, 3 页
    python crawl.py -c 249 -p 1 -s 80        # 频道 249, 1 页, 每页 80 条
"""

import argparse
import json
import sys
from datetime import datetime, timezone, timedelta

import requests
from sign import sign_request

# 常量
API_BASE = "https://gdtv-api.gdtv.cn"
DEFAULT_CHANNEL_ID = 246
DEFAULT_PAGE_SIZE = 40
DEFAULT_PAGES = 5
CST = timezone(timedelta(hours=8))


def fetch_news(
    channel_id: int,
    page_size: int = DEFAULT_PAGE_SIZE,
    begin_score: int = 0,
    device_id: str = "",
) -> dict:
    """
    获取指定频道的一页新闻。

    Args:
        channel_id:  频道 ID
        page_size:   每页条数
        begin_score: 翻页游标 (上一页最后一条的 releasedAt 时间戳)
        device_id:   设备标识 (为空则自动生成)

    Returns:
        API 响应的 JSON dict
    """
    url = f"{API_BASE}/api/channel/v1/news"
    params = {
        "pageSize": page_size,
        "channelId": channel_id,
        "beginScore": begin_score,
    }

    # 构建完整 URL 传给签名函数
    query_string = "&".join(f"{k}={v}" for k, v in params.items())
    full_url = f"{url}?{query_string}"

    # 获取动态签名头
    signed_headers = sign_request("GET", full_url, device_id=device_id)
    headers = {k: str(v) for k, v in signed_headers.items()}

    # 合并通用请求头
    headers.update({
        "accept": "application/json, text/plain, */*",
        "accept-language": "zh-CN,zh;q=0.9",
        "origin": "https://www.gdtv.cn",
        "referer": "https://www.gdtv.cn/",
        "user-agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/148.0.0.0 Safari/537.36"
        ),
    })

    resp = requests.get(url, params=params, headers=headers, timeout=30)
    resp.raise_for_status()
    return resp.json()


def crawl(
    channel_id: int,
    total_pages: int,
    page_size: int = DEFAULT_PAGE_SIZE,
    device_id: str = "",
):
    """
    爬取指定频道的多页新闻。

    Args:
        channel_id:  频道 ID
        total_pages: 最大翻页数
        page_size:   每页条数
        device_id:   设备标识

    Returns:
        (频道名称, 新闻列表)
    """
    all_news = []
    channel_name = ""
    seen_ids = set()
    begin_score = 0

    for pg in range(1, total_pages + 1):
        print(f"获取第 {pg}/{total_pages} 页 (beginScore={begin_score})...", end=" ", flush=True)

        data = fetch_news(channel_id, page_size, begin_score, device_id)

        if pg == 1:
            channel_name = data.get("name", "未知频道")

        news_list = data.get("list", [])
        new_count = 0
        min_score = None

        for item in news_list:
            try:
                inner = json.loads(item.get("data", "{}"))
            except json.JSONDecodeError:
                continue

            nid = inner.get("id", "")
            score = inner.get("releasedAt", 0)

            if score and (min_score is None or score < min_score):
                min_score = score

            if nid and nid not in seen_ids:
                seen_ids.add(nid)
                all_news.append(inner)
                new_count += 1

        print(f"{len(news_list)} 条, 新增 {new_count} (累计 {len(all_news)})")

        # 没有新数据或无法继续翻页则退出
        if new_count == 0 or min_score is None:
            print("没有更多数据，停止翻页。")
            break

        begin_score = min_score

    return channel_name, all_news


def format_time(ts_ms: int) -> str:
    """将毫秒时间戳转为北京时间字符串。"""
    if not ts_ms:
        return "未知"
    try:
        dt = datetime.fromtimestamp(ts_ms / 1000, tz=CST)
        return dt.strftime("%Y-%m-%d %H:%M:%S")
    except (ValueError, OSError):
        return str(ts_ms)


def print_news(channel_name: str, news_list: list):
    """格式化打印新闻列表到控制台。"""
    print(f"\n{'=' * 60}")
    print(f"频道: {channel_name}")
    print(f"共 {len(news_list)} 条新闻")
    print(f"{'=' * 60}")

    for i, news in enumerate(news_list, 1):
        title = news.get("title", "无标题")
        nid = news.get("id", "")
        released = format_time(news.get("releasedAt", 0))
        read_count = news.get("readCount", 0)
        author = news.get("author", "")
        cover = news.get("coverUrl", "")

        print(f"\n[{i}] {title}")
        print(f"    ID: {nid}")
        print(f"    时间: {released}")
        print(f"    阅读: {read_count}")
        if author:
            print(f"    作者: {author}")
        if cover:
            print(f"    封面: {cover}")


def parse_args():
    p = argparse.ArgumentParser(description="荔枝网 (gdtv.cn) 新闻爬虫")
    p.add_argument(
        "--channel", "-c",
        type=int,
        default=DEFAULT_CHANNEL_ID,
        help=f"频道 ID (默认: {DEFAULT_CHANNEL_ID})",
    )
    p.add_argument(
        "--pages", "-p",
        type=int,
        default=DEFAULT_PAGES,
        help=f"翻页数 (默认: {DEFAULT_PAGES})",
    )
    p.add_argument(
        "--page-size", "-s",
        type=int,
        default=DEFAULT_PAGE_SIZE,
        help=f"每页条数 (默认: {DEFAULT_PAGE_SIZE})",
    )
    return p.parse_args()


def main():
    args = parse_args()

    print("荔枝网新闻爬虫 / gdtv.cn News Crawler")
    print(f"{'=' * 50}")
    print(f"频道 ID: {args.channel}")
    print(f"翻页数:  {args.pages}")
    print(f"每页条数: {args.page_size}")
    print(f"{'=' * 50}")

    try:
        channel_name, news_list = crawl(
            args.channel, args.pages, args.page_size
        )
    except Exception as e:
        print(f"\n错误: {e}", file=sys.stderr)
        sys.exit(1)

    if news_list:
        print_news(channel_name, news_list)
    else:
        print("\n未获取到任何新闻数据。")


if __name__ == "__main__":
    main()
