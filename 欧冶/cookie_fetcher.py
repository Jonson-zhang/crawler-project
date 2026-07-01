"""
欧冶钢材网 - 浏览器 Cookie 获取器

通过 Camoufox 反检测浏览器自动访问欧冶网站，
等待瑞数挑战完成，提取 Cookie 供后续 API 调用。

使用方式：
  1. 独立运行（需要 Camoufox 浏览器）：
     python cookie_fetcher.py

  2. 在 Claude Code 中通过 MCP 交互式使用：
     见下方文档

依赖：pip install httpx
"""

import json
import time
import sys
from pathlib import Path
from typing import Optional

# 尝试导入 httpx（仅用于主程序执行）
try:
    import httpx
except ImportError:
    httpx = None


class OuyeelCookieFetcher:
    """
    欧冶 Cookie 获取器

    通过浏览器访问目标网站，等待瑞数挑战完成，
    提取 Cookie 并保存到本地文件。
    """

    def __init__(self, data_dir: Optional[Path] = None):
        self.data_dir = data_dir or Path(__file__).parent
        self.cookie_file = self.data_dir / "cookies.json"
        self.target_url = "https://www.ouyeel.com/steel/search?channel=RJ&pageIndex=1&pageSize=50"

    def save_cookies(self, cookies: dict) -> None:
        """保存 Cookie 到文件"""
        self.cookie_file.write_text(
            json.dumps(cookies, ensure_ascii=False, indent=2),
            encoding="utf-8"
        )
        print(f"[✓] Cookie 已保存到: {self.cookie_file}")

    def load_cookies(self) -> dict:
        """从文件加载 Cookie"""
        if self.cookie_file.exists():
            return json.loads(self.cookie_file.read_text(encoding="utf-8"))
        return {}

    def check_cookies_valid(self, cookies: dict) -> bool:
        """
        检查 Cookie 是否有效

        通过直接调用 API 验证 Cookie 的有效性。
        """
        if not cookies.get("T0k1m0u5AfREO") and not cookies.get("T0k1m0u5AfREP"):
            return False

        if httpx is None:
            return True  # 无法验证，假定有效

        try:
            cookie_str = "; ".join(f"{k}={v}" for k, v in cookies.items())
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0",
                "Content-Type": "application/x-www-form-urlencoded",
                "Origin": "https://www.ouyeel.com",
                "Cookie": cookie_str,
            }
            data = {
                "criteriaJson": json.dumps({
                    "pageSize": 1,
                    "channel": "RJ",
                    "pageIndex": 0,
                    "jsonParam": {"channel": "RJ", "keywordAnalyseResult": None},
                })
            }
            resp = httpx.post(
                "https://www.ouyeel.com/search-ng/commoditySearch/queryCommodityResult",
                headers=headers,
                data=data,
                timeout=15,
                follow_redirects=True,
            )
            return resp.status_code == 200
        except Exception:
            return False

    def format_browser_cookies(self, browser_cookies: list) -> dict:
        """
        将从浏览器获取的 Cookie 列表转为字典

        Args:
            browser_cookies: 浏览器 Cookie 列表，每项包含 name, value, domain 等字段
        """
        result = {}
        for c in browser_cookies:
            name = c.get("name")
            value = c.get("value")
            if name and value:
                result[name] = value
        return result

    def test_api(self, page_num: int = 0, page_size: int = 50) -> Optional[dict]:
        """
        使用当前 Cookie 测试 API 调用

        Args:
            page_num: 页码 (0=第一页)
            page_size: 每页数量 (默认50)
        """
        cookies = self.load_cookies()
        if not cookies:
            print("[!] 未找到 Cookie")
            return None

        if httpx is None:
            print("[!] 需要安装 httpx: pip install httpx")
            return None

        cookie_str = "; ".join(f"{k}={v}" for k, v in cookies.items())
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0",
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "zh-CN,zh;q=0.5",
            "Content-Type": "application/x-www-form-urlencoded",
            "Origin": "https://www.ouyeel.com",
            "Referer": "https://www.ouyeel.com/steel/search",
            "Cookie": cookie_str,
        }

        criteria = {
            "pageSize": page_size,
            "channel": "RJ",
            "pageIndex": page_num,
            "maxPage": page_size,
            "jsonParam": {"channel": "RJ", "keywordAnalyseResult": None},
        }

        data = {"criteriaJson": json.dumps(criteria, ensure_ascii=False)}

        try:
            print(f"\n[*] 正在查询: pageIndex={page_num}, pageSize={page_size}")
            resp = httpx.post(
                "https://www.ouyeel.com/search-ng/commoditySearch/queryCommodityResult",
                headers=headers,
                data=data,
                timeout=30,
                follow_redirects=False,
            )

            if resp.status_code == 200:
                result = resp.json()
                count = result.get("count", 0)
                result_list = json.loads(result.get("resultList", "[]"))
                print(f"[✓] 查询成功: 总数={count}, 本页={len(result_list)}")
                return result
            elif resp.status_code == 202:
                print("[✗] Cookie 已过期，需要重新获取")
                return None
            else:
                print(f"[✗] 请求失败: HTTP {resp.status_code}")
                print(f"    响应: {resp.text[:200]}")
                return None

        except Exception as e:
            print(f"[✗] 请求异常: {e}")
            return None

    def interactive_mode(self):
        """交互模式"""
        print("=" * 50)
        print("  欧冶钢材网 - API 查询工具")
        print("=" * 50)

        cookies = self.load_cookies()
        if cookies:
            valid = self.check_cookies_valid(cookies)
            if valid:
                print("[✓] 已有有效 Cookie")
            else:
                print("[!] Cookie 已过期")

        while True:
            print("\n" + "-" * 30)
            print("1. 查询第一页")
            print("2. 查询指定页")
            print("3. 查询最近上架")
            print("4. 查询其他频道")
            print("5. 退出")
            print("-" * 30)

            choice = input("请选择 [1-5]: ").strip()
            if choice == "1":
                self.test_api(page_num=0, page_size=50)
            elif choice == "2":
                try:
                    page = int(input("页码 (1=第一页): ").strip())
                    self.test_api(page_num=page - 1, page_size=50)
                except ValueError:
                    print("无效输入")
            elif choice == "3":
                self.test_api(page_num=0, page_size=50,
                              sort_type=3, sort_direction="DESC")
            elif choice == "4":
                print("频道列表:")
                print("  RJ - 热卷")
                print("  LC - 冷轧")
                print("  ZX - 中厚板")
                print("  GX - 管材")
                print("  TP - 特钢")
                print("  PZ - 盘条/棒线")
                channel = input("输入频道: ").strip().upper()
                self.test_api(page_num=0, page_size=20)
            elif choice == "5":
                break


def main():
    fetcher = OuyeelCookieFetcher()

    if len(sys.argv) > 1 and sys.argv[1] == "--interactive":
        fetcher.interactive_mode()
    elif len(sys.argv) > 1 and sys.argv[1] == "--test":
        fetcher.test_api()
    else:
        print("欧冶 Cookie 获取器")
        print("=" * 50)
        print()
        print("获取 Cookie 的方式:")
        print()
        print("方式 1: 在 Claude Code 中使用 Camoufox MCP")
        print("  → 浏览器会自动处理瑞数挑战")
        print("  → 使用 cookies 工具获取 Cookie 后保存到 cookies.json")
        print()
        print("方式 2: 手动获取后保存")
        print("  → 在 Chrome 开发者工具中访问目标页面")
        print("  → 在 Application → Cookies 中复制 T0k1m0u5AfREP 等 Cookie")
        print("  → 更新 cookies.json")
        print()
        print("常用命令:")
        print("  python cookie_fetcher.py --test      # 测试 Cookie 是否有效")
        print("  python cookie_fetcher.py --interactive  # 交互模式")
        print("  python solver.py                     # 运行主求解器")
        print()


if __name__ == "__main__":
    main()
