"""
米画师 M-S 签名 / 解密模块（subprocess 版）

通过 subprocess 调用 Node.js + WASM 生成请求签名头。
keywords 和 favicon 从页面动态获取，网站改版时自动适配。

依赖: Node.js, sign_tool.js, mhs_fe_sign_bg.wasm（同目录）
"""
import os
import re
import subprocess
import time

import requests

_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
_SIGN_TOOL = os.path.join(_SCRIPT_DIR, 'sign_tool.js')

# 动态获取的页面特征（首次调用时自动填充）
_page_features = None


def _fetch_page_features():
    """从米画师首页提取 keywords 和 favicon URL（无需签名）。"""
    global _page_features
    if _page_features is not None:
        return _page_features

    resp = requests.get('https://www.mihuashi.com/', timeout=10)
    html = resp.text

    keywords = ''
    m = re.search(r'<meta\s+name="keywords"\s+content="([^"]*)"', html)
    if m:
        keywords = m.group(1)

    favicon = ''
    m = re.search(r'<link\s+rel="icon"\s+href="([^"]*)"', html)
    if m:
        favicon = m.group(1)

    _page_features = (keywords, favicon)
    return _page_features


def sign_url(url_path: str, timestamp: int = None) -> tuple:
    """对 API 路径进行 M-S 签名。返回 (signature, timestamp)。"""
    if timestamp is None:
        timestamp = int(time.time())

    keywords, favicon = _fetch_page_features()

    result = subprocess.run(
        ['node', _SIGN_TOOL, url_path, str(timestamp), keywords, favicon],
        capture_output=True, text=True, timeout=30, cwd=_SCRIPT_DIR,
    )

    if result.returncode != 0:
        raise RuntimeError(f'签名失败: {result.stderr.strip()}')

    signature = result.stdout.strip()
    if not signature:
        raise RuntimeError('签名结果为空')

    return signature, timestamp


def get_request_headers(url_path: str, timestamp: int = None) -> dict:
    """获取带 M-S 签名的完整请求头。"""
    signature, ts = sign_url(url_path, timestamp)
    return {
        'M-S': signature,
        'M-T': str(ts),
        'Web-Version': 'frontend',
        'Authorization': 'Bearer null',
        'Accept': 'application/json, text/plain, */*',
    }
