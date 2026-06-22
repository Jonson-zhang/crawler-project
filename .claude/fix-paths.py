"""Generate .mcp.json with machine-specific absolute paths.

Run by install-mcp.sh on every fresh clone.
.vscode/settings.json is NOT touched — it uses ${workspaceFolder} and GitDoc config stays portable.
"""
import json, os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ROOT_POSIX = str(ROOT).replace("\\", "/")

camoufox_args = ["-m", "camoufox_reverse_mcp"]

# 只在显式设置了环境变量时才加代理（国内爬虫通常直连，走代理反而触发风控）
proxy = os.environ.get("CAMOUFOX_PROXY", "")
if proxy:
    camoufox_args += ["--proxy", proxy]

mcp = {
    "mcpServers": {
        "js-reverse": {
            "type": "stdio",
            "command": "node",
            "args": [f"{ROOT_POSIX}/.claude/mcp-servers/js-reverse-mcp/node_modules/js-reverse-mcp/build/src/index.js"]
        },
        "camoufox-reverse": {
            "type": "stdio",
            "command": f"{ROOT_POSIX}/.claude/mcp-servers/.venv/Scripts/python.exe",
            "args": camoufox_args
        }
    }
}
(ROOT / ".mcp.json").write_text(json.dumps(mcp, indent=2) + "\n", encoding="utf-8")
print("[OK] .mcp.json generated")
