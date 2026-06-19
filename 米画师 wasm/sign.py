"""
米画师 (mihuashi.com) API 签名模块

通过 subprocess 调用 Node.js sign.js 获取 M-S 签名。
sign.js 加载 WASM 模块 signtool_sign, 补全 42 个 wbg 导入。

用法:
    from sign import sign_request
    headers = sign_request("/api/v1/stalls")
"""

import json
import os
import subprocess
import time

_DIR = os.path.dirname(os.path.abspath(__file__))
_SIGN_JS = os.path.join(_DIR, "sign.js")
_NODE = "node"


def sign_url(url_path: str, timestamp: int = 0, timeout: int = 30) -> str:
    """
    对 URL 路径签名。

    Args:
        url_path:  API 路径 (如 "/api/v1/stalls"，不含 query string)
        timestamp: Unix 秒级时间戳，0 表示自动生成
        timeout:   子进程超时秒数

    Returns:
        88 字符签名字符串 (M-S header 值)
    """
    if timestamp <= 0:
        timestamp = int(time.time())

    proc = subprocess.run(
        [_NODE, _SIGN_JS, url_path, str(timestamp)],
        capture_output=True,
        encoding="utf-8",
        errors="replace",
        timeout=timeout,
        cwd=_DIR,
    )

    if proc.returncode != 0:
        raise RuntimeError(
            f"sign.js 执行失败 (exit {proc.returncode}):\n"
            f"stderr: {proc.stderr}"
        )

    return proc.stdout.strip()


def sign_request(url_path: str, timestamp: int = 0) -> dict:
    """
    生成完整的签名请求头。

    Returns:
        {"M-S": "88字符签名", "M-T": "时间戳", "Web-Version": "frontend"}
    """
    if timestamp <= 0:
        timestamp = int(time.time())

    ms = sign_url(url_path, timestamp)
    return {
        "M-S": ms,
        "M-T": str(timestamp),
        "Web-Version": "frontend",
    }


if __name__ == "__main__":
    h = sign_request("/api/v1/stalls")
    print(json.dumps(h, indent=2, ensure_ascii=False))
