"""
gdtv.cn API 签名模块 — Node.js subprocess 方式

通过调用 Node.js sign.js 脚本获取签名头。
sign.js 在真实 JS 引擎中加载 WASM 签名模块,自动处理反篡改检测。

用法:
    from gdtv_sign import sign_request
    headers = sign_request("GET", "https://gdtv-api.gdtv.cn/api/channel/v1/news")
"""

import subprocess
import json
import os
import uuid

_DIR = os.path.dirname(os.path.abspath(__file__))
_SIGN_JS = os.path.join(_DIR, "sign.js")
_NODE_PATH = "node"
_NODE_OPTS = ["--max-old-space-size=4096"]


def sign_request(method: str, url: str, device_id: str = "",
                 client_type: str = "WEB_PC", data: str = "") -> dict:
    """
    调用 Node.js sign.js 生成签名头。

    Args:
        method: HTTP 方法 (GET/POST)
        url: 完整 API URL
        device_id: 设备 ID (为空则自动生成)
        client_type: 客户端类型
        data: 请求体 (POST 时用)

    Returns:
        dict: 包含 X-ITOUCHTV-Ca-* 等签名头的字典
    """
    if not device_id:
        device_id = f"WEB_{uuid.uuid4()}"

    cmd = [_NODE_PATH] + _NODE_OPTS + [
        _SIGN_JS, method, url, device_id, client_type, data
    ]

    proc = subprocess.run(
        cmd, capture_output=True, text=True, timeout=60,
        cwd=_DIR
    )

    if proc.returncode != 0:
        raise RuntimeError(
            f"sign.js failed (exit {proc.returncode}):\n"
            f"stderr: {proc.stderr}"
        )

    # stdout 是 JSON 格式的签名头
    headers = json.loads(proc.stdout.strip())
    return headers


if __name__ == "__main__":
    # 测试
    h = sign_request(
        "GET",
        "https://gdtv-api.gdtv.cn/api/channel/v1/news?pageSize=5&channelId=246&currentPage=1",
        device_id="WEB_test"
    )
    print(json.dumps(h, indent=2, ensure_ascii=False))
