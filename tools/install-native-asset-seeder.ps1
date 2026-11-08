# Installs the tested source-side 2x2 asset recovery update.
# No repo reset or branch switch. Dry-run by default.
param(
  [string]$Root = "D:\RBXBanland",
  [switch]$Apply
)
$ErrorActionPreference = "Stop"
$branch = "fix/native-asset-routing-and-diagnostics"
$raw = "https://raw.githubusercontent.com/le-nt/2x2/$branch"
$files = @(
  "server/lib/asset-discovery.mjs",
  "server/lib/asset-resolver.mjs",
  "server/lib/native.mjs",
  "services/engine/App/util/ContentProvider.cpp",
  "tools/seed-native-assets.mjs",
  "tools/seed-full-archive.mjs",
  "tools/import-novetus-assets.py",
  "tools/asset-cache-manager.py",
  "tools/seed-novetus-assets.mjs",
  "tools/scan-binary-asset-ids.py",
  "tools/rbxl_binary_inventory.py",
  "tests/native-asset-seeder.test.mjs",
  "tests/asset-resolver.test.mjs",
  "tests/asset-upstream-errors.test.mjs",
  "docs/NATIVE-ASSET-LOADING-ROOT-CAUSES.md"
)
$Root = (Resolve-Path -LiteralPath $Root).Path
if (!(Test-Path (Join-Path $Root ".git"))) { throw "Not a Git repository: $Root" }
$dirty = @()
foreach ($relative in $files) {
  $dest=Join-Path $Root $relative
  if (Test-Path $dest) {
    $status = & git -C $Root status --porcelain -- $relative
    if ($LASTEXITCODE -ne 0) { throw "git status failed" }
    if ($status) { $dirty += $relative }
  }
}
if ($dirty.Count) {
  Write-Warning "Existing local edits or untracked files were detected. Nothing was changed."
  $dirty | ForEach-Object { Write-Warning $_ }
  throw "Review/stash or separately back up these changes before applying. The installer refuses to overwrite them."
}
Write-Host "Will update $($files.Count) source/test/documentation files in $Root" -ForegroundColor Cyan
$files | ForEach-Object { Write-Host "  $_" }
if (!$Apply) {
  Write-Host "Dry run: no files updated. Pass -Apply to install." -ForegroundColor Yellow
  return
}
$stamp=Get-Date -Format "yyyyMMdd-HHmmss"
$backup = Join-Path $Root "backup-asset-seeding-$stamp"
$staging=Join-Path $env:TEMP "2x2-asset-seeder-$stamp"
New-Item -ItemType Directory -Path $staging -Force | Out-Null
try {
  foreach ($relative in $files) {
    $local = Join-Path $staging $relative
    New-Item -ItemType Directory -Path (Split-Path $local) -Force | Out-Null
    $parts = @($relative -split "/" | ForEach-Object { [uri]::EscapeDataString($_) })
    $url = $raw + "/" + ($parts -join "/")
    Invoke-WebRequest -Uri $url -OutFile $local -UseBasicParsing
    if (!(Test-Path $local) -or (Get-Item $local).Length -eq 0) { throw "Missing download: $relative" }
  }
  foreach ($relative in $files) {
    $dest=Join-Path $Root $relative
    if (Test-Path $dest) {
      $copy=Join-Path $backup $relative
      New-Item -ItemType Directory -Path (Split-Path $copy) -Force | Out-Null
      Copy-Item $dest $copy -ErrorAction Stop
    }
  }
  foreach ($relative in $files) {
    $dest=Join-Path $Root $relative
    New-Item -ItemType Directory -Path (Split-Path $dest) -Force | Out-Null
    Copy-Item (Join-Path $staging $relative) $dest -Force -ErrorAction Stop
  }
  Write-Host "Source update installed. Backups: $backup" -ForegroundColor Green
  Write-Host "Native C++ changes still require copying into WSL and rebuilding UniversalClient."
  Write-Host "Restart Node after reviewing local configuration."
} finally {
  Remove-Item $staging -Recurse -Force -ErrorAction SilentlyContinue
}
