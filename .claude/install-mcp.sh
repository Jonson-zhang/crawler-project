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
echo "[1/5] 检查基础依赖 ..."

# 按优先级找可用的 Python（Windows Store 空壳 --version 会 exit 49，被过滤）
find_python() {
  for candidate in python3 python py; do
    if command -v "$candidate" >/dev/null 2>&1; then
      if "$candidate" --version >/dev/null 2>&1; then
        command -v "$candidate"
        return 0
      fi
    fi
  done
  # py launcher 指定版本
  if command -v py >/dev/null 2>&1; then
    if py -3.13 --version >/dev/null 2>&1; then
      echo "py -3.13"
      return 0
    fi
  fi
  return 1
}

PYTHON="$(find_python)" || die "请先安装 Python 3.10+"
command -v node >/dev/null 2>&1 || die "请先安装 Node.js 20+"
command -v npm  >/dev/null 2>&1 || die "请先安装 npm"

case "$PYTHON" in
  py*) $PYTHON --version ;;
  *)   "$PYTHON" --version ;;
esac
node --version
say "Python + Node.js OK"

# ---- MCP: camoufox-reverse-mcp (Python) ----
echo "[2/5] camoufox-reverse-mcp ..."
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
  case "$PYTHON" in
    py*) $PYTHON -m venv "$MCP_DIR/.venv" ;;
    *)   "$PYTHON" -m venv "$MCP_DIR/.venv" ;;
  esac
fi
"$MCP_DIR/.venv/Scripts/pip" install -e "$MCP_DIR/camoufox-reverse-mcp" -q 2>&1 | tail -1
say "camoufox-reverse-mcp installed"

# ---- MCP: js-reverse-mcp (Node.js) ----
echo "[3/5] js-reverse-mcp ..."
cd "$MCP_DIR/js-reverse-mcp"
npm install --silent 2>&1 | tail -1
say "js-reverse-mcp installed"

# ---- Skills ----
echo "[4/5] Skills ..."
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

if [ ! -f "$SKILLS_DIR/ast-deobfuscation/SKILL.md" ]; then
  echo "  git clone xbsReverseSkill ..."
  rm -rf "$SKILLS_DIR/xbsReverseSkill_temp"
  if [ "$USE_PROXY" = "1" ]; then
    git clone https://github.com/lwjjike/xbsReverseSkill.git \
      "$SKILLS_DIR/xbsReverseSkill_temp" \
      -c http.proxy="$PROXY" -c https.proxy="$PROXY"
  else
    git clone https://github.com/lwjjike/xbsReverseSkill.git \
      "$SKILLS_DIR/xbsReverseSkill_temp"
  fi
  mv "$SKILLS_DIR/xbsReverseSkill_temp/ast-deobfuscation"     "$SKILLS_DIR/"
  mv "$SKILLS_DIR/xbsReverseSkill_temp/web-reverse-algorithm" "$SKILLS_DIR/"
  mv "$SKILLS_DIR/xbsReverseSkill_temp/web-reverse-env"       "$SKILLS_DIR/"
  rm -rf "$SKILLS_DIR/xbsReverseSkill_temp"
fi
say "Skills OK"

# ---- 生成 .mcp.json（机器相关的绝对路径） ----
echo "[5/5] 生成 .mcp.json ..."
"$MCP_DIR/.venv/Scripts/python.exe" "$SCRIPT_DIR/fix-paths.py"
say ".mcp.json 已生成为当前机器路径"

echo ""
echo "=========================================="
echo " 全部就绪。重启 VSCode 即可使用。"
echo "=========================================="
