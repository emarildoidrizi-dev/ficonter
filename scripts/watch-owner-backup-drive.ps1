param(
  [Parameter(Mandatory = $true)]
  [string]$ConfigFile
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$config = Get-Content $ConfigFile -Raw | ConvertFrom-Json
$backupRoot = [System.IO.Path]::GetFullPath([string]$config.BackupRoot)
$runner = [System.IO.Path]::GetFullPath([string]$config.Runner)
$driveRoot = [System.IO.Path]::GetPathRoot($backupRoot)
$stateDir = Join-Path $env:LOCALAPPDATA 'FICONTER\Recovery'
New-Item -ItemType Directory -Force -Path $stateDir | Out-Null
$stateFile = Join-Path $stateDir 'drive-presence.state'

function Test-BackupDrivePresent {
  return Test-Path $driveRoot
}

function Invoke-FiconterBackup {
  if (-not (Test-Path $backupRoot)) {
    New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null
  }

  $stamp = (Get-Date).ToUniversalTime().ToString('o')
  try {
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $runner -ConfigFile $ConfigFile
    if ($LASTEXITCODE -ne 0) { throw "Backup runner exited with code $LASTEXITCODE" }
    "present|$stamp|success" | Set-Content -Encoding UTF8 $stateFile
  }
  catch {
    "present|$stamp|failed|$($_.Exception.Message)" | Set-Content -Encoding UTF8 $stateFile
  }
}

$wasPresent = $false
if (Test-Path $stateFile) {
  $previous = Get-Content $stateFile -Raw -ErrorAction SilentlyContinue
  if ($previous -like 'present*') { $wasPresent = $true }
}

$currentPresent = Test-BackupDrivePresent
if ($currentPresent -and -not $wasPresent) {
  Invoke-FiconterBackup
}
elseif (-not $currentPresent) {
  'absent' | Set-Content -Encoding UTF8 $stateFile
}

while ($true) {
  Start-Sleep -Seconds 15
  $present = Test-BackupDrivePresent

  if ($present -and -not $currentPresent) {
    Invoke-FiconterBackup
  }
  elseif (-not $present -and $currentPresent) {
    'absent' | Set-Content -Encoding UTF8 $stateFile
  }

  $currentPresent = $present
}
