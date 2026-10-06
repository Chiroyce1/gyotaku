# Builds dist\gyotaku-setup-x86_64.exe from a folder holding the files of
# the release zip, with Inno Setup 6, installing it first if it's missing.
#
#   contrib\windows\build-setup.ps1 dist\gyotaku-x86_64-windows

param([Parameter(Mandatory)] [string] $Payload)

$ErrorActionPreference = 'Stop'
$iscc = Join-Path ${env:ProgramFiles(x86)} 'Inno Setup 6\ISCC.exe'
if (-not (Test-Path $iscc)) {
    choco install innosetup --yes --no-progress | Out-Host
}
$payload = (Resolve-Path $Payload).Path
& $iscc /Qp "/DPayload=$payload" (Join-Path $PSScriptRoot 'gyotaku.iss')
if ($LASTEXITCODE) { throw "iscc exited with $LASTEXITCODE" }
