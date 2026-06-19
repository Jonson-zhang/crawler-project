#!/bin/bash
# ============================================================
# 一键恢复全部逆向环境 (MCP + Skills)
#
# 用法:
#   换电脑后，git clone 本项目，然后运行:
#   bash .claude/install-mcp.sh
#
# 相当于 uv.lock / package-lock.json 的"安装"步骤
# ============================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
MCP_DIR="$SCRIPT_DIR/mcp-servers"
SKILLS_DIR="$SCRIPT_DIR/skills"

# ---- 代理设置 (国内用户) ----
PROXY="${PROXY:-http://127.0.0.1:10808}"
USE_PROXY="${USE_PROXY:-0}"

say() { echo "[OK] $1"; }
die() { echo "[FAIL] $1"; exit 1; }

echo "=========================================="
echo " Crawler — 逆向环境恢复"
echo "=========================================="
echo "项目: $PROJECT_DIR"
echo "Windows 用户: 用 Git Bash 运行此脚本 (开始菜单 → Git Bash)"
echo ""

# ---- 依赖检查 ----
echo "[1/4] 检查基础依赖 ..."
# Windows: 优先找 python, 找不到再试 python3
if command -v python >/dev/null 2>&1; then
  PYTHON=python
elif command -v python3 >/dev/null 2>&1; then
  PYTHON=python3
else
  die "请先安装 Python 3.10+"
fi
command -v node >/dev/null 2>&1 || die "请先安装 Node.js 20+"
command -v npm  >/dev/null 2>&1 || die "请先安装 npm"

$PYTHON --version 2>&1 || die "Python 无法运行"
node --version
say "Python + Node.js OK"

# ---- MCP: camoufox-reverse-mcp (Python) ----
echo "[2/4] camoufox-reverse-mcp ..."
mkdir -p "$MCP_DIR"

if [ ! -d "$MCP_DIR/camoufox-reverse-mcp/src" ]; then
  echo "  git clone ..."
  if [ "$USE_PROXY" = "1" ]; then
    git clone https://github.com/WhiteNightShadow/camoufox-reverse-mcp.git \
      "$MCP_DIR/camoufox-reverse-mcp" \
      -c http.proxy="$PROXY" -c https.proxy="$PROXY"
  else
    git clone https://github.com/WhiteNightShadow/camoufox-reverse-mcp.git \
      "$MCP_DIR/camoufox-reverse-mcp"
  fi
fi

if [ ! -d "$MCP_DIR/.venv" ]; then
  $PYTHON -m venv "$MCP_DIR/.venv"
fi
"$MCP_DIR/.venv/Scripts/pip" install -e "$MCP_DIR/camoufox-reverse-mcp" -q 2>&1 | tail -1
say "camoufox-reverse-mcp installed"

# ---- MCP: js-reverse-mcp (Node.js) ----
echo "[3/4] js-reverse-mcp ..."
cd "$MCP_DIR/js-reverse-mcp"
npm install --silent 2>&1 | tail -1
say "js-reverse-mcp installed"

# ---- Skills ----
echo "[4/4] Skills ..."
if [ ! -d "$SKILLS_DIR/hello_js_reverse_skill/.git" ]; then
  rm -rf "$SKILLS_DIR/hello_js_reverse_skill"
  if [ "$USE_PROXY" = "1" ]; then
    git clone https://github.com/WhiteNightShadow/hello_js_reverse_skill.git \
      "$SKILLS_DIR/hello_js_reverse_skill" \
      -c http.proxy="$PROXY" -c https.proxy="$PROXY"
  else
    git clone https://github.com/WhiteNightShadow/hello_js_reverse_skill.git \
      "$SKILLS_DIR/hello_js_reverse_skill"
  fi
fi
# wasm-reverse skill 已在仓库中 (无 .git, 被 git 直接追踪), 无需额外安装
say "Skills OK"

echo ""
echo "=========================================="
echo " 全部就绪。重启 VSCode 即可使用。"
echo "=========================================="
