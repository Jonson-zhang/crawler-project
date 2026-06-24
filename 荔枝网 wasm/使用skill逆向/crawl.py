#!/usr/bin/env python3
"""
荔枝网 (gdtv.cn) API 爬取

原理:
  gdtv.cn 用 WASM (itouchtv_webqs) 对 API 请求签名。
  签名无法在纯 Node.js 中复现 (WASM abort)，故用浏览器方案:

  浏览器打开 gdtv.cn → 前端 App 初始化 → 捕获 API 响应 → 返回数据

用法:
  python crawl.py --channel 117
  python crawl.py --channel 117 --pagesize 20
"""
import json, time, sys
from cloakbrowser import launch

API = "https://gdtv-api.gdtv.cn"


def fetch_news(channel_id=117, page_size=11):
    b = launch(headless=False)
    page = b.new_page()
    data = []

    def on_resp(response):
        if API in response.url and response.status == 200:
            try:
                if "json" in response.headers.get("content-type", ""):
                    data.append(response.json())
            except:
                pass

    page.on("response", on_resp)

    try:
        page.goto("https://www.gdtv.cn/", wait_until="domcontentloaded")
        time.sleep(8)

        # 触发页面滚动以加载频道数据
        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        time.sleep(5)

        if data:
            print(f"[+] 捕获 {len(data)} 个 API 响应")
            return data[0]
        print("[!] 未捕获到 API 响应")
        return {"error": "no response"}
    finally:
        b.close()


def main():
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("--channel", type=int, default=117)
    p.add_argument("--pagesize", type=int, default=11)
    p.add_argument("--output", type=str, default="gdtv_news.json")
    args = p.parse_args()

    print(f"[*] 荔枝网新闻爬取 | 频道{args.channel} x{args.pagesize}")
    result = fetch_news(args.channel, args.pagesize)

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    items = []
    if isinstance(result, dict):
        for k in ("data", "result", "list", "records"):
            v = result.get(k)
            if isinstance(v, list):
                items = v
                break

    if items:
        print(f"[+] {len(items)} 条新闻, 已保存 {args.output}")
        for i, item in enumerate(items[:10]):
            t = item.get("title", item.get("name", ""))
            print(f"  {i+1}. {t}")
    else:
        print(f"[!] 未能提取新闻列表: {str(result)[:200]}")

if __name__ == "__main__":
    main()
