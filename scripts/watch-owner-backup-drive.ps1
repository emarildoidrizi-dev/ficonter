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

function Show-FiconterNotification([string]$Title, [string]$Message, [bool]$IsError = $false) {
  try {
    Add-Type -AssemblyName System.Windows.Forms -ErrorAction Stop
    Add-Type -AssemblyName System.Drawing -ErrorAction Stop

    $notification = New-Object System.Windows.Forms.NotifyIcon
    $notification.Icon = if ($IsError) { [System.Drawing.SystemIcons]::Error } else { [System.Drawing.SystemIcons]::Information }
    $notification.BalloonTipIcon = if ($IsError) { [System.Windows.Forms.ToolTipIcon]::Error } else { [System.Windows.Forms.ToolTipIcon]::Info }
    $notification.BalloonTipTitle = $Title
    $notification.BalloonTipText = $Message
    $notification.Text = 'FICONTER Backup'
    $notification.Visible = $true
    $notification.ShowBalloonTip(10000)
    Start-Sleep -Seconds 4
    $notification.Dispose()
  }
  catch {
    try {
      $shell = New-Object -ComObject WScript.Shell
      [void]$shell.Popup($Message, 8, $Title, $(if ($IsError) { 16 } else { 64 }))
    }
    catch {
      # Notification failure must never change backup success/failure handling.
    }
  }
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
    Show-FiconterNotification 'FICONTER backup complete' 'Backup completed and verified successfully. You can safely eject the FICONTER SSD.'
  }
  catch {
    "present|$stamp|failed|$($_.Exception.Message)" | Set-Content -Encoding UTF8 $stateFile
    Show-FiconterNotification 'FICONTER backup failed' 'The backup did not complete successfully. Keep the SSD connected and check FICONTER-AUTOMATIC-BACKUP-STATUS.txt.' $true
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
