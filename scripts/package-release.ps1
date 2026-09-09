param(
  [string]$Destination = (Join-Path ([Environment]::GetFolderPath('Desktop')) 'DT Works Suite Transfer')
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$version = (Get-Content (Join-Path $repo 'package.json') | ConvertFrom-Json).version
$releaseName = 'DT Works Suite ' + $version
$release = Join-Path $Destination $releaseName

if (Test-Path $release) {
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  Move-Item $release ($release + '.previous-' + $stamp)
}

$installers = Join-Path $release 'Installers'
$portable = Join-Path $release 'Portable Programs'
$launchers = Join-Path $release 'Agent Launchers'
$icons = Join-Path $release 'Icons'
$docs = Join-Path $release 'Directions'
@($installers, $portable, $launchers, $icons, $docs) | ForEach-Object {
  New-Item -ItemType Directory -Path $_ -Force | Out-Null
}

Copy-Item (Join-Path $repo 'dist\DT Desktop Suite Setup 0.1.0.exe') (Join-Path $installers 'DT Desktop Suite Setup.exe')
Copy-Item (Join-Path $repo 'dist-command\DT Command Center Setup 0.1.0.exe') (Join-Path $installers 'DT Command Center Setup.exe')
Copy-Item (Join-Path $repo 'dist\DT Desktop Suite 0.1.0.exe') (Join-Path $portable 'DT Desktop Suite.exe')
Copy-Item (Join-Path $repo 'dist-command\DT Command Center Portable 0.1.0.exe') (Join-Path $portable 'DT Command Center.exe')
Copy-Item (Join-Path $repo 'apps\desktop\assets\icons\*.ico') $icons

$agents = @(
  @{ Id='librarian'; Name='The Librarian' },
  @{ Id='evaluation'; Name='DT Evaluation Engine' },
  @{ Id='hallucination'; Name='Hallucination Inspector' },
  @{ Id='evidence'; Name='Evidence Mapper' },
  @{ Id='branch-retest'; Name='Branch Retest Lab' },
  @{ Id='equation'; Name='Equation Workbench' },
  @{ Id='prediction'; Name='Prediction Lab' },
  @{ Id='prism'; Name='Prism Defense' },
  @{ Id='propulsion'; Name='Propulsion Conservation' },
  @{ Id='civilization'; Name='Civilization Systems' },
  @{ Id='memory'; Name='Consumer Memory Vault' },
  @{ Id='telemetry'; Name='Execution Telemetry' }
)

foreach ($agent in $agents) {
  $line = '@start "" "%~dp0..\Portable Programs\DT Desktop Suite.exe" --agent=' + $agent.Id
  Set-Content -Path (Join-Path $launchers ($agent.Name + '.cmd')) -Value $line -Encoding ascii
}
$suiteLauncher = '@start "" "%~dp0Portable Programs\DT Desktop Suite.exe"'
$commandLauncher = '@start "" "%~dp0Portable Programs\DT Command Center.exe"'
Set-Content -Path (Join-Path $release 'OPEN DT DESKTOP SUITE.cmd') -Value $suiteLauncher -Encoding ascii
Set-Content -Path (Join-Path $release 'OPEN DT COMMAND CENTER.cmd') -Value $commandLauncher -Encoding ascii

$readme = @'
DT WORKS SUITE — TRANSFER PACKAGE

Fast start:
1. Open Portable Programs\DT Desktop Suite.exe, or use OPEN DT DESKTOP SUITE.cmd.
2. Select one of twelve agents and run local bounded analysis without connecting an AI.
3. To use an AI, connect your own provider key in the top console.
4. Export the Consumer Memory Vault before moving computers.

Installers:
- Installers\DT Desktop Suite Setup.exe
- Installers\DT Command Center Setup.exe

Security and custody:
- This package contains no API keys, recovery tickets, vault history, or personal credentials.
- Provider credentials are encrypted by Windows on the receiving computer.
- Imported vaults are verified and archived without overwriting local history.
- Prism is authorized synthetic defense only.
- Experimental calculations and simulations are not established scientific validation.

Integrity:
Compare files against SHA256SUMS.txt before installing or sharing.
'@
Set-Content -Path (Join-Path $docs 'START HERE.txt') -Value $readme -Encoding utf8
$files = Get-ChildItem $release -File -Recurse | Where-Object { $_.Name -ne 'SHA256SUMS.txt' }
$hashLines = foreach ($file in $files) {
  $relative = $file.FullName.Substring($release.Length + 1)
  $hash = (Get-FileHash $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
  $hash + '  ' + $relative
}
Set-Content -Path (Join-Path $release 'SHA256SUMS.txt') -Value $hashLines -Encoding ascii

$zip = Join-Path $Destination ($releaseName + '.zip')
if (Test-Path $zip) {
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  Move-Item $zip ($zip + '.previous-' + $stamp)
}
& tar.exe -a -c -f $zip -C $Destination $releaseName
if ($LASTEXITCODE -ne 0) { throw 'Native ZIP packaging failed' }

Write-Output ('RELEASE=' + $release)
Write-Output ('ZIP=' + $zip)
Write-Output ('FILES=' + (Get-ChildItem $release -File -Recurse).Count)
Write-Output ('ZIP_SHA256=' + (Get-FileHash $zip -Algorithm SHA256).Hash)
