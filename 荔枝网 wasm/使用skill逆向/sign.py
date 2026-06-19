"""
荔枝网 (gdtv.cn) API 签名模块

通过 subprocess 调用 Node.js sign.js 获取签名头。
sign.js 在 Node.js 引擎中加载 WASM 签名模块，自动处理反篡改检测。

逆向分析过程:
  - 目标: https://www.gdtv.cn/channelDetail/246
  - API:  https://gdtv-api.gdtv.cn/api/channel/v1/news
  - 签名头: x-itouchtv-ca-key / x-itouchtv-ca-signature / x-itouchtv-ca-timestamp
  - 技术栈: Rust → WASM (wasm-bindgen) → webpack chunk (vendor_w)
  - 核心函数: B.a(method, url, deviceId, clientType, data, undefined) → Map
  - WASM 模块: lizhi.wasm (itouchtv_webqs_bg)

用法:
    from sign import sign_request
    headers = sign_request("GET", "https://gdtv-api.gdtv.cn/api/channel/v1/news")
"""

import json
import os
import subprocess
import uuid

_DIR = os.path.dirname(os.path.abspath(__file__))
_SIGN_JS = os.path.join(_DIR, "sign.js")
_NODE_EXE = "node"
_NODE_OPTS = ["--max-old-space-size=4096"]


def sign_request(
    method: str,
    url: str,
    device_id: str = "",
    client_type: str = "WEB_PC",
    data: str = "",
    timeout: int = 60,
) -> dict:
    """
    调用 Node.js sign.js 生成签名头。

    Args:
        method:      HTTP 方法 (GET / POST)
        url:         完整的 API URL (含 query string)
        device_id:   设备 ID，为空则自动生成 UUID
        client_type: 客户端类型，默认 WEB_PC
        data:        请求体 (POST 时使用)
        timeout:     超时秒数

    Returns:
        dict: 签名头键值对，如:
              {"Content-Type": "application/json",
               "X-ITOUCHTV-Ca-Timestamp": "1781705970111",
               "X-ITOUCHTV-Ca-Signature": "Y/N2M6DgGesRJrnirNVWEu...",
               "X-ITOUCHTV-Ca-Key": "89541943007407288657755311868534",
               "X-ITOUCHTV-CLIENT": "WEB_PC",
               "X-ITOUCHTV-DEVICE-ID": "WEB_xxxx-xxxx-xxxx"}
    """
    if not device_id:
        device_id = f"WEB_{uuid.uuid4()}"

    cmd = [_NODE_EXE] + _NODE_OPTS + [
        _SIGN_JS,
        method,
        url,
        device_id,
        client_type,
        data,
    ]

    proc = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=timeout,
        cwd=_DIR,
    )

    if proc.returncode != 0:
        raise RuntimeError(
            f"sign.js 执行失败 (exit code {proc.returncode}):\n"
            f"stderr: {proc.stderr}"
        )

    # sign.js 输出 JSON 格式的签名头
    headers = json.loads(proc.stdout.strip())
    return headers


if __name__ == "__main__":
    h = sign_request(
        "GET",
        "https://gdtv-api.gdtv.cn/api/channel/v1/news"
        "?pageSize=5&channelId=246&currentPage=1",
    )
    print(json.dumps(h, indent=2, ensure_ascii=False))
