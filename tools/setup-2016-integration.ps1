param([string]$Root = "D:\2x2-integration", [switch]$DownloadWebsite)
$ErrorActionPreference = "Stop"
$root = [IO.Path]::GetFullPath($Root).TrimEnd('\')
if ($root -ine "D:\2x2-integration") { throw "Only D:\2x2-integration is allowed." }
if (!(Test-Path "$root\server\server.mjs") -or !(Test-Path "$root\server\lib\native.mjs")) {
  throw "Integration server missing; nothing changed."
}
$backup = Join-Path $root (".2016-test-backup\" + (Get-Date -Format "yyyyMMdd-HHmmss"))
New-Item -ItemType Directory -Path $backup -Force | Out-Null
$proxyUri = "https://raw.githubusercontent.com/le-nt/2x2/9a4f65efe6f943ec2c53a5e490975119052cb54e/server/lib/website-2016.mjs"
$proxyNew = Join-Path $backup "website-2016.download.mjs"
Invoke-WebRequest -Uri $proxyUri -OutFile $proxyNew -UseBasicParsing
if (!([IO.File]::ReadAllText($proxyNew).Contains("export function createWebsiteProxy"))) {
  throw "Invalid proxy download; nothing changed."
}
$server = Join-Path $root "server\server.mjs"
$original = [IO.File]::ReadAllText($server)
$updated = $original
$nl = [Environment]::NewLine
$import = 'import { createWebsiteProxy, isLegacyRuntimePath } from "./lib/website-2016.mjs";'
$anchor = 'import { createGame } from "./lib/game.mjs";'
if (!$updated.Contains($import)) {
  if (!$updated.Contains($anchor)) { throw "Import anchor missing; nothing changed." }
  $updated = $updated.Replace($anchor, $anchor + $nl + $import)
}
$initializer = 'const website2016 = createWebsiteProxy();'
$anchor = 'const game = createGame({ db, root });'
if (!$updated.Contains($initializer)) {
  if (!$updated.Contains($anchor)) { throw "Initializer anchor missing; nothing changed." }
  $updated = $updated.Replace($anchor, $anchor + $nl + $initializer)
}
$route = '  if (website2016 && !isLegacyRuntimePath(urlPath)) return website2016(req, res);'
$anchor = '  if (game(req, res, urlPath)) return;'
if (!$updated.Contains($route)) {
  if (!$updated.Contains($anchor)) { throw "Route anchor missing; nothing changed." }
  $updated = $updated.Replace($anchor, $anchor + $nl + $route)
}
$listen = 'server.listen(port, process.env.RBX_2016_TEST_ONLY === "1" ? "127.0.0.1" : undefined, () => {'
$anchor = 'server.listen(port, () => {'
if (!$updated.Contains($listen)) {
  if (!$updated.Contains($anchor)) { throw "Listener anchor missing; nothing changed." }
  $updated = $updated.Replace($anchor, $listen)
}
$check = Join-Path $backup "server-syntax.mjs"
[IO.File]::WriteAllText($check, $updated, (New-Object Text.UTF8Encoding($false)))
& node --check $check
if ($LASTEXITCODE -ne 0) { throw "Invalid patched server; nothing changed." }
& node --check $proxyNew
if ($LASTEXITCODE -ne 0) { throw "Invalid proxy; nothing changed." }
Copy-Item $server (Join-Path $backup "server.mjs")
$proxyDest = Join-Path $root "server\lib\website-2016.mjs"
if (Test-Path $proxyDest) { Copy-Item $proxyDest (Join-Path $backup "website-2016.mjs") }
[IO.File]::WriteAllText($server, $updated, (New-Object Text.UTF8Encoding($false)))
Copy-Item $proxyNew $proxyDest -Force
Write-Host "Integration server patched (backups: $backup)" -ForegroundColor Green
$websiteRoot = Join-Path $root "third_party\Roblox-Website"
$websiteConfig = Join-Path $websiteRoot "Website\Web.config"
if (!(Test-Path $websiteConfig) -and $DownloadWebsite) {
  if (Test-Path $websiteRoot) { throw "Incomplete website folder exists; not overwriting it." }
  $zip = Join-Path $backup "Roblox-Website-2016.zip"
  $unzipped = Join-Path $backup "extracted"
  Write-Host "Downloading authentic 2016 ASP.NET website..." -ForegroundColor Cyan
  Invoke-WebRequest -Uri "https://github.com/Intelinsidecom/Roblox-Website/archive/refs/heads/2016.zip" -OutFile $zip -UseBasicParsing
  Expand-Archive $zip $unzipped
  $site = Get-ChildItem $unzipped -Directory | Where-Object {
    Test-Path (Join-Path $_.FullName "Website\Web.config")
  } | Select-Object -First 1
  if (!$site) { throw "Missing Website/Web.config in archive." }
  New-Item -ItemType Directory -Path (Split-Path $websiteRoot -Parent) -Force | Out-Null
  Move-Item $site.FullName $websiteRoot
}
if (Test-Path $websiteConfig) {
  Write-Host "2016 website found: $websiteRoot" -ForegroundColor Green
} else {
  Write-Warning "Run again with -DownloadWebsite to download the 2016 source ZIP."
}
Write-Host "D:\RBXBanland and its database were not changed." -ForegroundColor Green
