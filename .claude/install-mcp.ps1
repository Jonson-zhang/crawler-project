# ============================================================
# 一键恢复全部逆向环境 (MCP + Skills) — PowerShell 版
#
# 用法:
#   .\.claude\install-mcp.ps1
#
# 安装清单: .claude/install.config.json（新增 MCP/Skill 只改它，不用改本脚本）
# ============================================================
$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path $MyInvocation.MyCommand.Path -Parent
$ProjectDir = Split-Path $ScriptDir -Parent
$McpDir = Join-Path $ScriptDir "mcp-servers"
$SkillsDir = Join-Path $ScriptDir "skills"

# ---- 代理设置 ----
$Proxy = if ($env:PROXY) { $env:PROXY } else { "http://127.0.0.1:10808" }
$UseProxy = if ($env:USE_PROXY -eq "1") { $true } else { $false }

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " Crawler — 逆向环境恢复" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Project: $ProjectDir"
Write-Host ""

# ============================================================
# 第 1 步：检查基础依赖
# ============================================================
Write-Host "[1/3] 检查基础依赖 ..."

$python = (Get-Command python -ErrorAction SilentlyContinue),
          (Get-Command python3 -ErrorAction SilentlyContinue),
          (Get-Command py -ErrorAction SilentlyContinue) | Where-Object { $_ } | Select-Object -First 1
if (-not $python) { throw "请先安装 Python 3.10+" }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw "请先安装 Node.js 20+" }
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw "请先安装 npm" }

Write-Host "  Python: $( & $python.Source --version 2>&1 )"
Write-Host "  Node:   $( node --version 2>&1 )"
Write-Host "[OK] Python + Node.js OK" -ForegroundColor Green

# ============================================================
# 第 2 步：读取 install.config.json，安装 MCP + Skills
# ============================================================
Write-Host "[2/3] 安装 MCP + Skills ..."

$Config = Get-Content (Join-Path $ScriptDir "install.config.json") -Raw | ConvertFrom-Json
$McpVenv = Join-Path $McpDir ".venv"

# ---- 安装函数 ----
function Install-PythonGit($name, $url, $dir) {
    Write-Host "  [$name] git clone + pip install ..."
    $target = Join-Path $ProjectDir $dir
    if (-not (Test-Path "$target\src")) {
        if ($UseProxy) {
            git clone $url $target -c http.proxy="$Proxy" -c https.proxy="$Proxy"
        } else {
            git clone $url $target
        }
    }
    if (-not (Test-Path $McpVenv)) {
        & $python.Source -m venv $McpVenv
    }
    $pip = Join-Path $McpVenv "Scripts\pip.exe"
    & $pip install -e $target -q
}

function Install-Npm($name, $dir) {
    Write-Host "  [$name] npm install ..."
    $target = Join-Path $ProjectDir $dir
    Push-Location $target
    npm install --silent
    Pop-Location
}

function Install-GitClone($name, $url, $dir) {
    Write-Host "  [$name] git clone ..."
    $target = Join-Path $ProjectDir $dir
    if (-not (Test-Path "$target\.git")) {
        Remove-Item -Recurse -Force $target -ErrorAction SilentlyContinue
        if ($UseProxy) {
            git clone $url $target -c http.proxy="$Proxy" -c https.proxy="$Proxy"
        } else {
            git clone $url $target
        }
    }
}

function Install-GitExtract($name, $url, $dir, $extract) {
    $target = Join-Path $ProjectDir $dir
    $items = $extract -split ','
    $firstItem = Join-Path $target $items[0]
    if (Test-Path "$firstItem\SKILL.md") {
        Write-Host "  [$name] (already extracted, skip)"
        return
    }
    Write-Host "  [$name] git clone + extract ..."
    $tmp = Join-Path $ScriptDir "_tmp_extract"
    Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
    if ($UseProxy) {
        git clone $url $tmp -c http.proxy="$Proxy" -c https.proxy="$Proxy"
    } else {
        git clone $url $tmp
    }
    foreach ($item in $items) {
        Move-Item (Join-Path $tmp $item) $target
    }
    Remove-Item -Recurse -Force $tmp
}

# ---- 执行安装 ----
foreach ($item in $Config.mcpServers) {
    switch ($item.type) {
        "python-git" { Install-PythonGit $item.name $item.url $item.dir }
        "npm"        { Install-Npm $item.name $item.dir }
    }
}

foreach ($item in $Config.skills) {
    switch ($item.type) {
        "git-clone"   { Install-GitClone $item.name $item.url $item.dir }
        "git-extract" { Install-GitExtract $item.name $item.url $item.dir ($item.extract -join ',') }
    }
}

Write-Host "[OK] MCP + Skills OK" -ForegroundColor Green

# ============================================================
# 第 3 步：生成本机 .mcp.json
# ============================================================
Write-Host "[3/3] 生成 .mcp.json（本机绝对路径）..."
$FixPaths = Join-Path $ScriptDir "fix-paths.py"
$McpPython = Join-Path $McpVenv "Scripts\python.exe"
& $McpPython $FixPaths

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " 全部就绪。重启 VSCode 即可使用。" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
