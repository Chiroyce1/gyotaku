# Runs the setup exe the way an update service or a careful person would:
# a silent install, an update over a running gyotaku, and a silent uninstall,
# checking what each one leaves behind. Used by CI.
#
#   contrib\windows\test-setup.ps1 dist\gyotaku-setup-x86_64.exe

param([Parameter(Mandatory)] [string] $Setup)

$ErrorActionPreference = 'Stop'
$Setup = (Resolve-Path $Setup).Path
$dir = Join-Path $env:LOCALAPPDATA 'Programs\gyotaku'
$app = Join-Path $dir 'gyotaku-app.exe'
$link = Join-Path ([Environment]::GetFolderPath('Programs')) 'gyotaku.lnk'
$uninstallKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\gyotaku_is1'
$runKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
$quiet = '/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART'

function Run($file, $arguments) {
    $p = Start-Process -FilePath $file -ArgumentList $arguments -Wait -PassThru
    if ($p.ExitCode) { throw "$file exited with $($p.ExitCode)" }
}

function Running {
    Get-Process gyotaku-app -ErrorAction SilentlyContinue |
        Where-Object { $_.Path -eq $app }
}

Write-Host 'install'
Run $Setup ($quiet + '/TASKS=startwithwindows')
foreach ($f in 'gyotaku-app.exe', 'gyotaku.exe', 'onnxruntime.dll', 'vcruntime140.dll', 'unins000.exe') {
    if (-not (Test-Path (Join-Path $dir $f))) { throw "$f is missing" }
}
if (-not (Test-Path $link)) { throw 'the Start menu shortcut is missing' }
$entry = Get-ItemProperty $uninstallKey
$version = (Get-Item $app).VersionInfo.ProductVersion
Write-Host "Apps and features: $($entry.DisplayName) $($entry.DisplayVersion), the exe says $version"
if ($entry.DisplayVersion -ne $version) { throw 'the installed version is not the one in Apps and features' }
$run = (Get-ItemProperty $runKey).gyotaku
if ($run -ne "`"$app`" --background") { throw "start with windows is '$run'" }
if (Running) { throw 'a silent install opened gyotaku' }

$out = & (Join-Path $dir 'gyotaku.exe') ocr tests\fixtures\settings.png --threads 2
$out
if (-not ($out -match 'cores per screenshot')) { throw 'the installed reader did not read the screenshot' }

Write-Host 'update over a running copy'
Start-Process -FilePath $app -ArgumentList '--background'
Start-Sleep -Seconds 3
$before = Running
if (-not $before) { throw 'gyotaku did not start' }
Run $Setup $quiet
Start-Sleep -Seconds 3
$after = Running
if (-not $after) { throw 'the update did not bring gyotaku back' }
if ($after.Id -eq $before.Id) { throw 'the update did not stop the old copy' }
$after | Stop-Process -Force
Start-Sleep -Milliseconds 500

Write-Host 'uninstall'
# Settings saved by the app have to survive a silent uninstall.
$config = Join-Path $env:APPDATA 'gyotaku\config'
New-Item -ItemType Directory -Force $config | Out-Null
'theme = "dark"' | Set-Content (Join-Path $config 'config.toml')
Run (Join-Path $dir 'unins000.exe') $quiet
# The uninstaller finishes from a copy of itself in TEMP, so the folder can
# outlive the process that was waited for by a moment.
foreach ($i in 1..30) {
    if (-not (Test-Path $dir)) { break }
    Start-Sleep -Seconds 1
}
if (Test-Path $dir) { throw 'the install folder is still there' }
if (Test-Path $link) { throw 'the Start menu shortcut is still there' }
if (Test-Path $uninstallKey) { throw 'it is still in Apps and features' }
if ((Get-ItemProperty $runKey).PSObject.Properties.Name -contains 'gyotaku') { throw 'it still starts with Windows' }
if (-not (Test-Path (Join-Path $config 'config.toml'))) { throw 'a silent uninstall deleted the settings' }
Remove-Item -Recurse -Force (Join-Path $env:APPDATA 'gyotaku')
Write-Host 'the setup installs, updates and uninstalls cleanly'
