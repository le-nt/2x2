
param(
  [string]$Root = 'C:\RBXBanland',
  [string]$Output = "$env:USERPROFILE\Desktop\2x2-source-structured.zip"
)
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
$rootPath = (Resolve-Path -LiteralPath $Root).Path.TrimEnd('\','/')
$excludedFolders = @('.git','node_modules','clients','map-pack','backup-native','backup-map-pack','target','build','dist','assets','textures','maps','aya-maps')
$extensions = @('.py','.js','.mjs','.cjs','.json','.html','.css','.md','.ps1','.bat','.toml','.yml','.yaml')
$skipFiles = @('server/config.json','server/data/','site/data/aya-maps/','site/native-client/','server/native/maps/')
$files = Get-ChildItem -LiteralPath $rootPath -File -Recurse | Where-Object {
  $relative = $_.FullName.Substring($rootPath.Length + 1).Replace('\','/')
  $parts = $relative.Split('/')
  ($extensions -contains $_.Extension.ToLowerInvariant()) -and
  ($_.Length -lt 10MB) -and
  -not (@($parts | Where-Object { $excludedFolders -contains $_ -or $_ -like 'backup-*' }).Count) -and
  -not (@($skipFiles | Where-Object { $relative.StartsWith($_,[StringComparison]::OrdinalIgnoreCase) -or $relative -eq $_ }).Count)
}
$out = [IO.Path]::GetFullPath($Output)
if ([IO.File]::Exists($out)) { [IO.File]::Delete($out) }
$archive = [System.IO.Compression.ZipFile]::Open($out,[System.IO.Compression.ZipArchiveMode]::Create)
try {
  foreach ($file in $files) {
    $relative = $file.FullName.Substring($rootPath.Length + 1).Replace('\','/')
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $file.FullName, $relative, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
  }
} finally { $archive.Dispose() }
Write-Host "Wrote $($files.Count) files to $out"
