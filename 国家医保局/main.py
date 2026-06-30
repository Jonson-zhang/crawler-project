"""
国家医保局 — 医疗机构信息查询
=============================

使用 jsdom 补环境方案运行原始 app.js 加密逻辑。

原理:
  Python → subprocess → Node.js (jsdom + app.js)
  → jsdom 提供浏览器环境 → app.js 正常初始化
  → XHR 拦截器捕获加密请求 → 返回给 Python

用法:
  python main.py                          # 默认查询 "北京协和医院"
  python main.py "北京大学第一医院"          # 指定关键词
  python main.py 医院 --page 2 --size 5    # 分页
"""

import sys
import json
import subprocess
import argparse
import requests
from pathlib import Path

HERE = Path(__file__).parent

API_URL = "https://fuwu.nhsa.gov.cn/ebus/fuwu/api/nthl/api/CommQuery/queryFixedHospital"
SERVER_JS = HERE / "加密服务器.js"


class NhsaClient:
    """国家医保局 API 客户端 (补环境方案)"""

    def __init__(self):
        pass

    def _encrypt_via_node(self, params):
        """通过 Node.js 子进程生成加密请求"""
        r = subprocess.run(
            ["node", str(SERVER_JS), "encrypt", json.dumps(params, ensure_ascii=False)],
            capture_output=True, text=True, cwd=str(HERE), timeout=30,
        )
        if r.returncode != 0:
            raise RuntimeError(f"Node encrypt error: {r.stderr}")
        for line in r.stdout.strip().split("\n"):
            try:
                resp = json.loads(line)
                if resp.get("result") and isinstance(resp["result"], dict) and "headers" in resp["result"]:
                    return resp["result"]
            except Exception:
                pass
        raise RuntimeError(f"No encrypt result in: {r.stdout[:200]}")

    def search(self, keyword="", page_num=1, page_size=10):
        """查询医疗机构"""
        print(f"[Nhsa] Encrypting: keyword={keyword}", file=sys.stderr)
        encrypted = self._encrypt_via_node({
            "keyword": keyword,
            "pageNum": page_num,
            "pageSize": page_size,
        })

        headers = encrypted["headers"]
        body_json = json.dumps(encrypted["body"], ensure_ascii=False, separators=(",", ":"))

        print(f"[Nhsa] x-tif-signature: {headers.get('x-tif-signature', '?')[:16]}...", file=sys.stderr)

        # 2. 发送 HTTP 请求
        session = requests.Session()
        session.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0",
        })

        resp = session.post(API_URL, headers=headers, data=body_json, timeout=30)

        result = resp.json() if resp.status_code == 200 else {
            "code": -1, "message": f"HTTP {resp.status_code}"
        }

        return result

    def close(self):
        pass


def format_results(result):
    """格式化输出"""
    if result.get("code") != 0:
        print(f"查询失败: {result.get('message', 'Unknown')}")
        return

    # jsdom 方案暂不实现响应解密 (需要 SM4 密钥)
    # 但我们可以从 API 返回的结构中提取信息
    data_section = result.get("data", {})
    enc_data_section = data_section.get("data", {})

    print(f"\n请求成功! code={result['code']}, message={result.get('message')}")

    if enc_data_section.get("encData"):
        print(f"响应已加密 (encData: {enc_data_section['encData'][:32]}...)")
        print(f"encType: {enc_data_section.get('encType')}, signType: {enc_data_section.get('signType')}")

    print(json.dumps(result, ensure_ascii=False, indent=2)[:2000])


def main():
    parser = argparse.ArgumentParser(description="国家医保局 医疗机构查询")
    parser.add_argument("keyword", nargs="?", default="北京协和医院")
    parser.add_argument("--page", "-p", type=int, default=1)
    parser.add_argument("--size", "-s", type=int, default=10)
    args = parser.parse_args()

    client = NhsaClient()
    try:
        result = client.search(args.keyword, args.page, args.size)
        format_results(result)
    except RuntimeError as e:
        print(f"错误: {e}")
    except requests.exceptions.RequestException as e:
        print(f"网络错误: {e}")
    except Exception as e:
        print(f"错误: {e}")
        import traceback
        traceback.print_exc()
    finally:
        client.close()


if __name__ == "__main__":
    main()
