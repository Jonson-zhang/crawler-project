# ============================================================
# Crawler - MCP + Skills recovery (PowerShell)
# Usage: .\.claude\install-mcp.ps1
# ============================================================
$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path $MyInvocation.MyCommand.Path -Parent
$ProjectDir = Split-Path $ScriptDir -Parent
$McpDir = Join-Path $ScriptDir "mcp-servers"
$SkillsDir = Join-Path $ScriptDir "skills"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " Crawler - MCP & Skills Recovery" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Project: $ProjectDir"
Write-Host ""

# ---- Check deps ----
Write-Host "[1/5] Checking Node.js + Python ..."
$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) { $python = Get-Command python3 -ErrorAction SilentlyContinue }
if (-not $python) { throw "Install Python 3.10+ first" }
Write-Host "  Python: $( & $python.Source --version 2>&1 )"
Write-Host "  Node:   $( node --version 2>&1 )"
Write-Host "[OK] Python + Node.js OK" -ForegroundColor Green

# ---- camoufox-reverse-mcp (Python) ----
Write-Host "[2/5] camoufox-reverse-mcp ..."
New-Item -ItemType Directory -Force -Path $McpDir | Out-Null
$CamouSrc = Join-Path $McpDir "camoufox-reverse-mcp"
if (-not (Test-Path "$CamouSrc\src")) {
    Write-Host "  git clone ..."
    git clone https://github.com/WhiteNightShadow/camoufox-reverse-mcp.git $CamouSrc
}
$VenvDir = Join-Path $McpDir ".venv"
if (-not (Test-Path $VenvDir)) {
    & $python.Source -m venv $VenvDir
}
$Pip = Join-Path $VenvDir "Scripts\pip.exe"
& $Pip install -e $CamouSrc -q
Write-Host "[OK] camoufox-reverse-mcp installed" -ForegroundColor Green

# ---- js-reverse-mcp (Node.js) ----
Write-Host "[3/5] js-reverse-mcp ..."
Push-Location (Join-Path $McpDir "js-reverse-mcp")
npm install --silent
Pop-Location
Write-Host "[OK] js-reverse-mcp installed" -ForegroundColor Green

# ---- Git auto-backup ----
Write-Host "[4/5] auto-backup hook ..."
git config core.hooksPath .githooks
Write-Host "[OK] git post-commit auto-push enabled" -ForegroundColor Green

# ---- Skills ----
Write-Host "[5/5] Skills ..."
$HelloSkill = Join-Path $SkillsDir "hello_js_reverse_skill"
if (-not (Test-Path "$HelloSkill\.git")) {
    Remove-Item -Recurse -Force $HelloSkill -ErrorAction SilentlyContinue
    git clone https://github.com/WhiteNightShadow/hello_js_reverse_skill.git $HelloSkill
}
Write-Host "[OK] Skills ready (wasm-reverse already in repo)" -ForegroundColor Green

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " All done. Restart VSCode to use." -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
