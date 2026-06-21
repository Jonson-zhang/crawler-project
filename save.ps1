# 一键保存并推送: .\save.ps1 "提交说明"
param([string]$msg = "quick save")
Set-Location $PSScriptRoot
git add -A
git commit -m $msg
git push
