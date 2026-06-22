"""Rewrite .mcp.json and .vscode/settings.json with absolute paths for this machine."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Use forward slashes — Windows handles them fine, no escaping headaches
# Use POSIX-style paths which work everywhere
ROOT_POSIX = str(ROOT).replace("\\", "/")

# --- .mcp.json ---
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
            "args": ["-m", "camoufox_reverse_mcp", "--proxy", "http://127.0.0.1:10808"]
        }
    }
}
(ROOT / ".mcp.json").write_text(json.dumps(mcp, indent=2) + "\n", encoding="utf-8")
print("[OK] .mcp.json updated")

# --- .vscode/settings.json ---
(ROOT / ".vscode").mkdir(exist_ok=True)
settings = {
    "python.defaultInterpreterPath": f"{ROOT_POSIX}/.venv/Scripts/python.exe",
    "code-runner.clearPreviousOutput": True,
    "code-runner.runInTerminal": True,
    "code-runner.saveFileBeforeRun": True,
}
(ROOT / ".vscode" / "settings.json").write_text(json.dumps(settings, indent=4) + "\n", encoding="utf-8")
print("[OK] .vscode/settings.json updated")
