#!/bin/bash
# ============================================================
# 一键恢复全部逆向环境 (MCP + Skills)
#
# 用法:
#   换电脑后，git clone 本项目，然后运行:
#   bash .claude/install-mcp.sh
#
# 安装清单: .claude/install.config.json（新增 MCP/Skill 只改它，不用改本脚本）
# ============================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

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

# ============================================================
# 第 1 步：检查基础依赖
# ============================================================
echo "[1/3] 检查基础依赖 ..."

find_python() {
  for candidate in python3 python py; do
    if command -v "$candidate" >/dev/null 2>&1; then
      if "$candidate" --version >/dev/null 2>&1; then
        command -v "$candidate"
        return 0
      fi
    fi
  done
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

# ============================================================
# 第 2 步：读取 install.config.json，安装 MCP + Skills
# ============================================================
echo "[2/3] 安装 MCP + Skills ..."

install_python_git() {
  local name="$1" url="$2" dir="$3"
  echo "  [$name] git clone + pip install ..."
  if [ ! -d "$PROJECT_DIR/$dir/src" ]; then
    if [ "$USE_PROXY" = "1" ]; then
      git clone "$url" "$PROJECT_DIR/$dir" \
        -c http.proxy="$PROXY" -c https.proxy="$PROXY"
    else
      git clone "$url" "$PROJECT_DIR/$dir"
    fi
  fi
  # 创建/复用 venv
  local mcp_venv="$SCRIPT_DIR/mcp-servers/.venv"
  if [ ! -d "$mcp_venv" ]; then
    case "$PYTHON" in
      py*) $PYTHON -m venv "$mcp_venv" ;;
      *)   "$PYTHON" -m venv "$mcp_venv" ;;
    esac
  fi
  "$mcp_venv/Scripts/pip" install -e "$PROJECT_DIR/$dir" -q 2>&1 | tail -1
}

install_npm() {
  local name="$1" dir="$2"
  echo "  [$name] npm install ..."
  cd "$PROJECT_DIR/$dir"
  npm install --silent 2>&1 | tail -1
}

install_git_clone() {
  local name="$1" url="$2" dir="$3"
  echo "  [$name] git clone ..."
  if [ ! -d "$PROJECT_DIR/$dir/.git" ]; then
    rm -rf "$PROJECT_DIR/$dir"
    if [ "$USE_PROXY" = "1" ]; then
      git clone "$url" "$PROJECT_DIR/$dir" \
        -c http.proxy="$PROXY" -c https.proxy="$PROXY"
    else
      git clone "$url" "$PROJECT_DIR/$dir"
    fi
  fi
}

install_git_extract() {
  local name="$1" url="$2" dir="$3" extract="$4"
  # 如果任一子目录已存在，跳过
  local first="${extract%%,*}"
  if [ -f "$PROJECT_DIR/$dir/$first/SKILL.md" ]; then
    echo "  [$name] (already extracted, skip)"
    return
  fi
  echo "  [$name] git clone + extract ..."
  local tmp="$SCRIPT_DIR/_tmp_extract"
  rm -rf "$tmp"
  if [ "$USE_PROXY" = "1" ]; then
    git clone "$url" "$tmp" \
      -c http.proxy="$PROXY" -c https.proxy="$PROXY"
  else
    git clone "$url" "$tmp"
  fi
  IFS=',' read -ra ITEMS <<< "$extract"
  for item in "${ITEMS[@]}"; do
    mv "$tmp/$item" "$PROJECT_DIR/$dir/"
  done
  rm -rf "$tmp"
}

# ---- 解析 JSON 并调用安装函数 ----
$PYTHON -c "
import json, sys

config_path = r'$SCRIPT_DIR/install.config.json'
with open(config_path) as f:
    config = json.load(f)

mcp_dir = r'$SCRIPT_DIR/mcp-servers'

# Output: one line per item, tab-separated: type|name|url|dir|extract(optional)
for item in config.get('mcpServers', []):
    t = item['type']
    name = item['name']
    url = item.get('url', '')
    d = item['dir']
    print(f'MCP\t{t}\t{name}\t{url}\t{d}')

for item in config.get('skills', []):
    t = item['type']
    name = item['name']
    url = item.get('url', '')
    d = item['dir']
    extr = ','.join(item.get('extract', []))
    print(f'SKL\t{t}\t{name}\t{url}\t{d}\t{extr}')
" | while IFS=$'\t' read -r category type name url dir extr; do
  if [ "$category" = "MCP" ]; then
    case "$type" in
      python-git) install_python_git "$name" "$url" "$dir" ;;
      npm)        install_npm        "$name"       "$dir" ;;
    esac
  elif [ "$category" = "SKL" ]; then
    case "$type" in
      git-clone)   install_git_clone   "$name" "$url" "$dir" ;;
      git-extract) install_git_extract "$name" "$url" "$dir" "$extr" ;;
    esac
  fi
done

say "MCP + Skills OK"

# ============================================================
# 第 3 步：生成本机 .mcp.json（机器相关的绝对路径）
# ============================================================
echo "[3/3] 生成 .mcp.json（本机绝对路径）..."
"$SCRIPT_DIR/mcp-servers/.venv/Scripts/python.exe" "$SCRIPT_DIR/fix-paths.py"

echo ""
echo "=========================================="
echo " 全部就绪。重启 VSCode 即可使用。"
echo "=========================================="
