#!/usr/bin/env python3
"""
小红书 — 推荐流爬取 (浏览器自动签名)

用法:
  python main.py            获取首页推荐 (50 条)
  python main.py --pages 3  获取 3 页

安全 SDK 通过浏览器 XHR 自动签名，Python 端只负责调度和展示。
"""

import json
import sys
import time
from pathlib import Path

BASE_DIR = Path(__file__).parent

# ═══ 可配置参数 ═══
PAGES = 3  # 默认抓取页数（每页约 20 条）
REQUEST_INTERVAL = 1.5  # 请求间隔（秒）


def safe_print(*args, **kwargs):
    try:
        print(*args, **kwargs)
    except UnicodeEncodeError:
        print(*(str(a).encode("ascii", "replace").decode() for a in args), **kwargs)
    sys.stdout.flush()


class XhsClient:
    """在浏览器中运行，SDK 自动签名"""

    def __init__(self):
        from cloakbrowser import launch

        safe_print("[*] 启动浏览器...")
        self._browser = launch(headless=True)
        self._page = self._browser.new_page()
        self._init_browser()

    def _init_browser(self):
        """导航到小红书，等 SDK 加载完毕"""
        safe_print("[*] 加载小红书...")
        self._page.goto(
            "https://www.xiaohongshu.com/explore",
            wait_until="domcontentloaded",
            timeout=30000,
        )
        time.sleep(5)

        # 关闭登录弹窗
        try:
            self._page.evaluate("document.querySelector('.close-button')?.click()")
            safe_print("[*] 已关闭登录弹窗")
        except Exception:
            pass
        time.sleep(3)

        # 滚动页面触发 SDK 初始化 + 首次 homefeed 请求
        for i in range(3):
            self._page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            time.sleep(1.5)

        safe_print("[OK] 浏览器就绪")

    def request(self, url: str, method: str = "POST", body: dict = None) -> dict:
        """在浏览器中发起 XHR，SDK 自动签名，返回响应"""
        body_str = json.dumps(body, ensure_ascii=False) if body else "{}"

        result = self._page.evaluate(
            """([url, method, body]) => {
                return new Promise((resolve) => {
                    const xhr = new XMLHttpRequest();
                    xhr.open(method, url, true);
                    xhr.setRequestHeader('content-type', 'application/json;charset=UTF-8');

                    xhr.onreadystatechange = function() {
                        if (xhr.readyState === 4) {
                            try {
                                resolve(JSON.parse(xhr.responseText));
                            } catch(e) {
                                resolve({_raw: xhr.responseText?.slice(0, 500), status: xhr.status});
                            }
                        }
                    };
                    xhr.onerror = function() {
                        resolve({_error: true, status: xhr.status});
                    };

                    xhr.send(body);

                    // 超时 30s
                    setTimeout(() => resolve({_timeout: true}), 30000);
                });
            }""",
            [url, method, body_str],
        )
        return result

    def homefeed(self, cursor: str = "") -> dict:
        """获取首页推荐流"""
        return self.request(
            "https://edith.xiaohongshu.com/api/sns/web/v1/homefeed",
            body={
                "cursor_score": cursor,
                "num": 20,
                "refresh_type": 1,
                "note_index": 0,
                "unread_begin_note_id": "",
                "unread_end_note_id": "",
                "unread_note_count": 0,
                "category": "homefeed_recommend",
            },
        )

    def close(self):
        self._browser.close()


def show_item(i: int, item: dict):
    """显示单篇文章信息"""
    note = item.get("note_card") or item
    title = note.get("display_title", note.get("title", "(无标题)"))
    desc = note.get("desc", "")
    user = note.get("user", {})
    author = user.get("nickname", user.get("nick_name", "?"))
    likes = note.get("interact_info", {}).get("liked_count", "?")

    if desc:
        desc = desc.replace("\n", " ")[:50]
    safe_print(f"  {i:2d}. {title[:60]}")
    if author != "?":
        safe_print(f"      @{author}  ❤{likes}")


def main():
    client = None
    total = 0

    try:
        client = XhsClient()

        cursor = ""
        for pg in range(1, PAGES + 1):
            safe_print(f"\n{'─' * 50}")
            safe_print(f"[*] 第 {pg}/{PAGES} 页 ...")

            data = client.homefeed(cursor)
            if not isinstance(data, dict):
                safe_print(f"[!] 异常响应: {str(data)[:200]}")
                break

            # 检查错误
            if data.get("_error") or data.get("_timeout") or data.get("_raw"):
                safe_print(f"[!] 请求失败: {json.dumps(data, ensure_ascii=False)[:200]}")
                break

            if not data.get("success") and data.get("code") != 0:
                safe_print(f"[!] API 错误: code={data.get('code')}, msg={data.get('msg', '?')}")
                break

            items = data.get("data", {}).get("notes") or data.get("data", {}).get("items", [])
            if not items:
                safe_print("(无数据)")
                break

            total += len(items)
            for i, it in enumerate(items, 1):
                show_item((pg - 1) * 20 + i, it)

            # 获取下一页 cursor
            cursor = data.get("data", {}).get("cursor", "")
            has_more = data.get("data", {}).get("has_more", False)
            if not has_more or not cursor:
                safe_print("(已到最后一页)")
                break

            time.sleep(REQUEST_INTERVAL)

    except Exception as e:
        safe_print(f"[FAIL] {e}")
        import traceback
        traceback.print_exc()

    finally:
        if client:
            safe_print(f"\n{'─' * 50}")
            safe_print(f"[+] 共 {total} 条")
            client.close()
            safe_print("[OK] 浏览器已关闭")


if __name__ == "__main__":
    import argparse

    p = argparse.ArgumentParser(description="小红书 — 推荐流爬取")
    p.add_argument("--pages", type=int, default=PAGES, help=f"抓取页数（默认 {PAGES}）")
    args = p.parse_args()
    PAGES = args.pages
    main()
