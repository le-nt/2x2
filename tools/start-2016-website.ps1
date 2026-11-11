param(
    [int]$WebsitePort = 8090,
    [switch]$Build,
    [switch]$SkipNode,
    [switch]$SkipSubmodule
)
# Starts the actual ASP.NET 2016 website and (unless -SkipNode) the existing 2x2 Node backend.
# No tracked code, database, maps, WASM binaries, or original site files are overwritten.
$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$source = Join-Path $root "third_party\Roblox-Website"
$website = Join-Path $source "Website"

if (-not $SkipSubmodule) {
    Write-Host "Fetching pinned 2016 website source (first download is large)..." -ForegroundColor Cyan
    & git -C $root submodule update --init --recursive -- third_party/Roblox-Website
    if ($LASTEXITCODE -ne 0) { throw "Git submodule checkout failed. Existing 2x2 files have not been replaced." }
}
if (-not (Test-Path (Join-Path $website "Web.config"))) {
    throw "Missing 2016 ASP.NET Website/Web.config. Run git submodule update --init --recursive."
}

if ($Build) {
    $dotnet = Get-Command dotnet -ErrorAction SilentlyContinue
    if (-not $dotnet) { throw ".NET SDK not found; install the ASP.NET/.NET Framework build prerequisites." }
    Push-Location $website
    try {
        & dotnet build
        if ($LASTEXITCODE -ne 0) { throw "2016 website build failed. Check .NET Framework targeting packs and Visual Studio Build Tools." }
    }
    finally { Pop-Location }
}

$pf86 = [Environment]::GetFolderPath("ProgramFilesX86")
$candidates = @(
    (Join-Path $pf86 "IIS Express\iisexpress.exe"),
    (Join-Path $env:ProgramFiles "IIS Express\iisexpress.exe")
)
$iis = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $iis) {
    throw "IIS Express is not installed. Install IIS Express before running the 2016 ASP.NET website."
}

# Use a loopback origin. The Node reverse proxy deliberately rejects remote origins.
$origin = "http://127.0.0.1:$WebsitePort"
Write-Host "Starting the 2016 website at $origin" -ForegroundColor Cyan
$iisArgs = @("/path:`"$website`"", "/port:$WebsitePort")
$iisProcess = Start-Process -FilePath $iis -ArgumentList $iisArgs -PassThru
Write-Host "IIS Express PID: $($iisProcess.Id)" -ForegroundColor DarkGray

if (-not $SkipNode) {
    $node = Get-Command node.exe -ErrorAction SilentlyContinue
    if (-not $node) { throw "Node.js not found on PATH. IIS Express was started, but 2x2 Node was not." }
    $env:RBX_2016_WEBSITE_URL = $origin
    Write-Host "Starting 2x2 with the 2016 frontend proxy enabled..." -ForegroundColor Cyan
    $nodeProcess = Start-Process -FilePath $node.Source -WorkingDirectory $root -ArgumentList @("server/server.mjs") -PassThru
    Write-Host "2x2 Node PID: $($nodeProcess.Id)" -ForegroundColor DarkGray
}
Write-Host "The 2016 website is now selected as the public frontend for this 2x2 server process." -ForegroundColor Green
Write-Warning "Website authentication, accounts, catalog, and game UI still need migration; this startup does not merge their databases."
