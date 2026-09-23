param(
  [string]$RepoRoot = 'C:\Users\thoma\Documents\GitHub\DT-Desktop-Suite',
  [string]$DriveRoot = 'C:\DT\GoogleDrive\My Drive\DT_DESKTOP_SUITE_REPOSITORY_MIRROR'
)
$ErrorActionPreference = 'Stop'
$git = 'C:\Program Files\Git\cmd\git.exe'
if (!(Test-Path -LiteralPath $git)) { throw 'Git executable not found.' }
if (!(Test-Path -LiteralPath $RepoRoot)) { throw 'Repository root not found.' }
New-Item -ItemType Directory -Force -Path $DriveRoot | Out-Null
$current = Join-Path $DriveRoot 'CURRENT_TRACKED_SOURCE'
$history = Join-Path $DriveRoot 'GIT_HISTORY'
$receipts = Join-Path $DriveRoot 'RECEIPTS'
New-Item -ItemType Directory -Force -Path $current,$history,$receipts | Out-Null
$commit = (& $git -C $RepoRoot rev-parse HEAD).Trim()
$branch = (& $git -C $RepoRoot branch --show-current).Trim()
$version = (Get-Content -Raw -LiteralPath (Join-Path $RepoRoot 'package.json') | ConvertFrom-Json).version
$tracked = & $git -C $RepoRoot ls-files
if (Test-Path -LiteralPath $current) {
  Get-ChildItem -LiteralPath $current -Force | Remove-Item -Recurse -Force
}
foreach ($rel in $tracked) {
  $src = Join-Path $RepoRoot $rel
  if (!(Test-Path -LiteralPath $src)) { continue }
  $dst = Join-Path $current $rel
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $dst) | Out-Null
  Copy-Item -LiteralPath $src -Destination $dst -Force
}
$bundle = Join-Path $history ("DT-Desktop-Suite-{0}-{1}.bundle" -f $version,$commit.Substring(0,12))
& $git -C $RepoRoot bundle create $bundle --all
if ($LASTEXITCODE -ne 0) { throw 'Git bundle creation failed.' }
$manifest = [ordered]@{
  schema = 'dt-drive-git-mirror/1.0'
  mirrored_at = (Get-Date).ToString('o')
  repository = 'DT-Desktop-Suite'
  version = $version
  branch = $branch
  commit = $commit
  source_root = $RepoRoot
  drive_root = $DriveRoot
  tracked_file_count = @($tracked).Count
  bundle_path = $bundle
  bundle_sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $bundle).Hash
  source_policy = 'Drive mirrors canonical tracked Git content; transient local scratch artifacts excluded.'
}
$manifestPath = Join-Path $receipts ("MIRROR__{0}__{1}.json" -f $version,$commit.Substring(0,12))
$manifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $manifestPath -Encoding UTF8
$latest = Join-Path $DriveRoot 'LATEST_MIRROR.json'
Copy-Item -LiteralPath $manifestPath -Destination $latest -Force
& $git -C $RepoRoot bundle verify $bundle | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Drive Git bundle verification failed.' }
Write-Output ($manifest | ConvertTo-Json -Depth 5)
