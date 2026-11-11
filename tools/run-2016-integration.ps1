param(
  [string]$Root = "D:\2x2-integration",
  [int]$NodePort = 8091,
  [int]$WebsitePort = 8090,
  [switch]$Build
)
$ErrorActionPreference = "Stop"
$root = [IO.Path]::GetFullPath($Root).TrimEnd('\')
if ($root -ine "D:\2x2-integration") { throw "Only the integration directory can be launched." }
if ($NodePort -eq $WebsitePort -or $NodePort -lt 1024 -or $WebsitePort -lt 1024) {
  throw "Choose two distinct unprivileged ports."
}
$website = Join-Path $root "third_party\Roblox-Website\Website"
if (!(Test-Path (Join-Path $website "Web.config"))) {
  throw "Install actual website source first using tools/setup-2016-integration.ps1 -DownloadWebsite"
}
if (!(Test-Path (Join-Path $root "server\lib\website-2016.mjs"))) {
  throw "Install 2016 proxy into test server first."
}
if ($Build) {
  Push-Location $website
  try {
    & dotnet build
    if ($LASTEXITCODE -ne 0) { throw "ASP.NET website compilation failed." }
  } finally { Pop-Location }
}
$pf86 = [Environment]::GetFolderPath("ProgramFilesX86")
$candidates = @(
  (Join-Path $pf86 "IIS Express\iisexpress.exe"),
  (Join-Path $env:ProgramFiles "IIS Express\iisexpress.exe")
)
$iis = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (!$iis) { throw "IIS Express not installed." }
foreach ($port in @($NodePort, $WebsitePort)) {
  $client = New-Object Net.Sockets.TcpClient
  try {
    $pending = $client.BeginConnect("127.0.0.1", $port, $null, $null)
    if ($pending.AsyncWaitHandle.WaitOne(350)) {
      try { $client.EndConnect($pending); throw "Port $port is already occupied; refusing to stop existing processes." }
      catch [Net.Sockets.SocketException] { }
    }
  } finally { $client.Close() }
}
$testData = Join-Path $root ".2016-test-data"
New-Item -ItemType Directory -Path $testData -Force | Out-Null
$env:RBX_DATA_DIR = $testData
$env:RBX_2016_WEBSITE_URL = "http://127.0.0.1:$WebsitePort"
$env:RBX_2016_TEST_ONLY = "1"
$env:RBX_HTTPS_PORT = "0"
$node = Get-Command node.exe -ErrorAction Stop
$arguments = @("/path:" + [char]34 + $website + [char]34, "/port:$WebsitePort")
$iisProcess = Start-Process -FilePath $iis -ArgumentList $arguments -PassThru
try {
  $nodeProcess = Start-Process -FilePath $node.Source -WorkingDirectory $root -ArgumentList @("server/server.mjs", "$NodePort") -PassThru
  Write-Host "2016 website testing at http://127.0.0.1:$NodePort" -ForegroundColor Green
  Write-Host "IIS Express PID: $($iisProcess.Id); Node PID: $($nodeProcess.Id)"
  Write-Host "Dedicated test SQLite directory: $testData"
  Write-Warning "Authentication and catalog integration are not yet complete. This does not use the production database."
} catch {
  if (!$iisProcess.HasExited) { Stop-Process -Id $iisProcess.Id }
  throw
}
