# Installs gyotaku on Windows from the latest release, or updates it.
#
#   irm https://raw.githubusercontent.com/xevrion/gyotaku/main/install.ps1 | iex
#
# It downloads the Windows build, checks it against the published checksum,
# puts it in %LOCALAPPDATA%\Programs\gyotaku, adds it to the Start menu and
# opens it. No administrator rights needed.
#
# To remove it again (your screenshots are never touched):
#
#   $env:GYOTAKU_UNINSTALL = 1; irm https://raw.githubusercontent.com/xevrion/gyotaku/main/install.ps1 | iex

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$Repo = 'xevrion/gyotaku'
$Dir = Join-Path $env:LOCALAPPDATA 'Programs\gyotaku'
$Shortcut = Join-Path ([Environment]::GetFolderPath('Programs')) 'gyotaku.lnk'
$RunKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'

function Stop-Gyotaku {
    Get-Process -Name 'gyotaku-app', 'gyotaku' -ErrorAction SilentlyContinue | Stop-Process -Force
    # Give Windows a moment to release the files before they're replaced.
    Start-Sleep -Milliseconds 500
}

if ($env:GYOTAKU_UNINSTALL) {
    Remove-Item Env:\GYOTAKU_UNINSTALL
    Write-Host 'Removing gyotaku' -ForegroundColor White
    Stop-Gyotaku
    Remove-ItemProperty -Path $RunKey -Name 'gyotaku' -ErrorAction SilentlyContinue
    Remove-Item -Recurse -Force $Dir -ErrorAction SilentlyContinue
    Remove-Item -Force $Shortcut -ErrorAction SilentlyContinue
    Write-Host "Removed. Your screenshots were not touched. The index and settings are still in"
    Write-Host "$env:APPDATA\gyotaku and $env:LOCALAPPDATA\gyotaku, delete those to remove them too."
    return
}

$arch = $env:PROCESSOR_ARCHITECTURE
if ($arch -ne 'AMD64' -and $arch -ne 'ARM64') {
    throw "gyotaku needs 64-bit Windows, this is $arch."
}
# ARM64 Windows runs the x64 build through its built-in emulation.
$name = 'gyotaku-x86_64-windows'
$base = "https://github.com/$Repo/releases/latest/download"
# $env:GYOTAKU_CHANNEL = 'dev' installs the rolling test build of main
# instead, which is rebuilt on every change.
if ($env:GYOTAKU_CHANNEL -eq 'dev') {
    $base = "https://github.com/$Repo/releases/download/dev"
    Write-Host 'Using the dev build, rebuilt on every change. Not for everyday use.' -ForegroundColor Yellow
}
$tmp = Join-Path ([IO.Path]::GetTempPath()) ("gyotaku-" + [Guid]::NewGuid())
New-Item -ItemType Directory -Path $tmp | Out-Null

try {
    Write-Host 'Downloading gyotaku for Windows' -ForegroundColor White
    $zip = Join-Path $tmp "$name.zip"
    $sum = Join-Path $tmp "$name.zip.sha256"
    Invoke-WebRequest -UseBasicParsing -Uri "$base/$name.zip" -OutFile $zip
    # Saved to a file and read back as text: GitHub serves it as binary, so
    # reading the response directly gives bytes, not the hash.
    Invoke-WebRequest -UseBasicParsing -Uri "$base/$name.zip.sha256" -OutFile $sum
    $expected = ((Get-Content -Raw $sum).Trim() -split '\s+')[0]
    $actual = (Get-FileHash -Algorithm SHA256 $zip).Hash
    if ($actual -ne $expected.ToUpper()) {
        throw 'The download does not match its checksum, nothing was installed.'
    }

    $updating = Test-Path (Join-Path $Dir 'gyotaku-app.exe')
    Write-Host "Installing to $Dir" -ForegroundColor White
    Stop-Gyotaku
    New-Item -ItemType Directory -Force -Path $Dir | Out-Null
    Expand-Archive -Force -Path $zip -DestinationPath $Dir
    Get-ChildItem $Dir | Unblock-File

    # Dev builds made on Linux compile gpui's shaders when they start, from
    # the folder they were built in, which Windows reads as that same path on
    # the system drive. Releases have them compiled in and ship no shaders.
    $shaders = Join-Path $Dir 'shaders'
    if (Test-Path (Join-Path $shaders 'where.txt')) {
        $where = (Get-Content -Raw (Join-Path $shaders 'where.txt')).Trim() -replace '/', '\'
        $into = Join-Path $env:SystemDrive $where
        New-Item -ItemType Directory -Force -Path $into | Out-Null
        Copy-Item -Force (Join-Path $shaders '*.hlsl') $into
    }

    $app = Join-Path $Dir 'gyotaku-app.exe'
    $shell = New-Object -ComObject WScript.Shell
    $link = $shell.CreateShortcut($Shortcut)
    $link.TargetPath = $app
    $link.WorkingDirectory = $Dir
    $link.Description = 'Search every screenshot by the text inside it'
    $link.Save()

    # Signed in with background reading on, the Run entry points at the app,
    # so it's pointed at this copy.
    if (Get-ItemProperty -Path $RunKey -Name 'gyotaku' -ErrorAction SilentlyContinue) {
        Set-ItemProperty -Path $RunKey -Name 'gyotaku' -Value "`"$app`" --background"
    }

    Start-Process -FilePath $app
    Write-Host ''
    if ($updating) {
        Write-Host 'Updated gyotaku.' -ForegroundColor Green
    } else {
        Write-Host 'Installed gyotaku. It just opened to pick your screenshot folders.' -ForegroundColor Green
    }
    Write-Host 'Press Alt+Shift+S anywhere to open or close it. It is also in the Start menu.'
} finally {
    Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
}
