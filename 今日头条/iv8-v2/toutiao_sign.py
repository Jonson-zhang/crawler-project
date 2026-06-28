"""
今日头条 a_bogus — Node.js subprocess (旧版 SDK 02_code.js)

iv8 无法处理 605KB 单行 minified 文件 → 走 Node.js subprocess。
Node.js 可以正常 eval 02_code.js 并通过 bogus._u() 生成 a_bogus。
"""

import json
import subprocess
from pathlib import Path
from urllib.parse import urlencode

BASE_DIR = Path(__file__).parent

SIGN_JS = BASE_DIR / "sign.js"


class ToutiaoSigner:
    """今日头条 a_bogus 签名器 — Node.js subprocess"""

    def sign(self, params_dict: dict) -> str:
        query_str = urlencode(params_dict)
        result = subprocess.run(
            ["node", str(SIGN_JS), query_str],
            capture_output=True, text=True, timeout=30,
            cwd=str(BASE_DIR), encoding="utf-8", errors="replace",
        )
        for line in result.stdout.strip().split("\n"):
            line = line.strip()
            if line.startswith("{") and "a_bogus" in line:
                data = json.loads(line)
                return data.get("a_bogus", "")
        return ""

    def close(self):
        pass
