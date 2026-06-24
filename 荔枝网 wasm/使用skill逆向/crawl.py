#!/usr/bin/env python3
"""
荔枝网 (gdtv.cn) 新闻 API 爬取

原理：
  荔枝网使用 WASM (itouchtv_webqs) 对 API 请求签名。
  签名头: x-itouchtv-ca-key + x-itouchtv-ca-signature + x-itouchtv-ca-timestamp +
          x-itouchtv-device-id + x-itouchtv-client

  本脚本调用 Node.js sign_once.js (加载 vendor_w_fallback 纯 JS 版签名器)
  生成签名头，然后用 Python requests 发 HTTP 请求获取数据。

用法:
  python crawl.py --channel 117
  python crawl.py --channel 117 --pages 3 --output news.json
"""

import json
import subprocess
import sys
import time
from pathlib import Path
from urllib.parse import urlencode

import requests
import urllib3

urllib3.disable_warnings()

API_BASE = "https://gdtv-api.gdtv.cn"
BASE_DIR = Path(__file__).parent
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"


def get_sign_headers(path: str, query: str = "", method: str = "GET") -> dict:
    """调用 Node.js 签名器生成请求头"""
    result = subprocess.run(
        ["node", str(BASE_DIR / "sign_once.js"), method, path, query],
        capture_output=True, text=True, cwd=str(BASE_DIR), timeout=30,
    )
    if result.returncode != 0:
        raise RuntimeError(f"Signer failed: {result.stderr[:200]}")
    try:
        return json.loads(result.stdout.strip() or "{}")
    except json.JSONDecodeError:
        raise RuntimeError(f"Signer output not JSON: {result.stdout[:200]}")


def fetch_news(channel_id: int, page_size: int = 11, begin_score: int = 0) -> dict:
    """获取指定频道新闻"""
    path = "/api/channel/v1/news"
    query = f"beginScore={begin_score}&pageSize={page_size}&channelId={channel_id}"

    headers = {
        "User-Agent": UA,
        "Accept": "application/json, text/plain, */*",
        "Origin": "https://www.gdtv.cn",
        "Referer": "https://www.gdtv.cn/",
    }
    headers.update(get_sign_headers(path, query))

    resp = requests.get(f"{API_BASE}{path}?{query}", headers=headers, verify=False, timeout=15)
    return resp.json() if "json" in resp.headers.get("content-type", "") else resp.text


def _extract_items(data: dict) -> list:
    if isinstance(data, list):
        return data
    for key in ("data", "result", "list", "records", "items"):
        items = data.get(key)
        if isinstance(items, list):
            return items
    inner = data.get("data", {})
    if isinstance(inner, dict):
        for key in ("list", "records", "items", "content"):
            items = inner.get(key)
            if isinstance(items, list):
                return items
    return []


def crawl_channel(channel_id: int, pages: int = 1, page_size: int = 11) -> list:
    all_items = []
    for page in range(pages):
        begin = page * page_size
        print(f"  第 {page+1} 页...", end=" ", flush=True)
        try:
            data = fetch_news(channel_id, page_size, begin)
            if isinstance(data, dict):
                if data.get("errorCode") == 401:
                    print("401 签名失败")
                    break
                items = _extract_items(data)
                if items:
                    print(f"{len(items)} 条")
                    all_items.extend(items)
                    if len(items) < page_size:
                        break
                else:
                    print("无数据")
                    break
            else:
                print(f"异常: {str(data)[:100]}")
                break
        except Exception as e:
            print(f"错误: {e}")
            break
        time.sleep(1)
    return all_items


def main():
    import argparse
    p = argparse.ArgumentParser(description="荔枝网新闻爬取")
    p.add_argument("--channel", type=int, default=117, help="频道ID")
    p.add_argument("--pages", type=int, default=1, help="页数")
    p.add_argument("--pagesize", type=int, default=11, help="每页条数")
    p.add_argument("--output", type=str, default="gdtv_news.json")
    args = p.parse_args()

    print("=" * 60)
    print("  荔枝网新闻爬取 (Python + Node.js WASM 签名)")
    print(f"  频道 {args.channel}, {args.pages} 页 x {args.pagesize} 条")
    print("=" * 60)

    items = crawl_channel(args.channel, args.pages, args.pagesize)
    print(f"\n[+] 共 {len(items)} 条")

    if items:
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(items, f, ensure_ascii=False, indent=2)
        print(f"[+] 已保存 {args.output}")
        for i, item in enumerate(items[:10]):
            title = item.get("title", item.get("name", ""))
            print(f"  {i+1}. {title}")


if __name__ == "__main__":
    main()
