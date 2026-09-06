param(
  [Parameter(Mandatory = $false)]
  [string]$BackupRoot = 'D:\FICONTER-BACKUPS'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$runner = Join-Path $PSScriptRoot 'run-owner-automatic-backup.ps1'
$watcher = Join-Path $PSScriptRoot 'watch-owner-backup-drive.ps1'
if (-not (Test-Path $runner)) { throw 'Automatic backup runner is missing.' }
if (-not (Test-Path $watcher)) { throw 'Backup-drive watcher is missing.' }

$stateDir = Join-Path $env:LOCALAPPDATA 'FICONTER\Recovery'
New-Item -ItemType Directory -Force -Path $stateDir | Out-Null
$credentialFile = Join-Path $stateDir 'backup-credentials.clixml'
$configFile = Join-Path $stateDir 'backup-config.json'

Write-Host ''
Write-Host 'FICONTER BACKUP-ON-CONNECT SETUP'
Write-Host 'A backup will run once whenever the configured external SSD becomes connected.'
Write-Host 'Credentials are encrypted by Windows DPAPI for your Windows user account.'
Write-Host 'Do not copy backup-credentials.clixml to the external SSD.'
Write-Host ''

$dbPassword = Read-Host 'Production Supabase database password' -AsSecureString
$s3AccessKey = Read-Host 'Dedicated Supabase Storage S3 backup access key ID'
$s3Secret = Read-Host 'Dedicated Supabase Storage S3 backup secret access key' -AsSecureString
$masterPassword = Read-Host 'FICONTER master recovery archive password' -AsSecureString

if ([string]::IsNullOrWhiteSpace($s3AccessKey)) { throw 'S3 access key ID is required.' }

$credential = [pscustomobject]@{
  DatabasePassword = $dbPassword
  StorageAccessKeyId = $s3AccessKey
  StorageSecretAccessKey = $s3Secret
  MasterPassword = $masterPassword
  CreatedUtc = (Get-Date).ToUniversalTime().ToString('o')
}
$credential | Export-Clixml -Path $credentialFile

$config = [ordered]@{
  BackupRoot = [System.IO.Path]::GetFullPath($BackupRoot)
  RepoRoot = $repoRoot
  CredentialFile = $credentialFile
  Runner = $runner
  Watcher = $watcher
  TriggerMode = 'drive_connect'
}
$config | ConvertTo-Json | Set-Content -Encoding UTF8 $configFile

$taskName = 'FICONTER Backup On SSD Connect'
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$watcher`" -ConfigFile `"$configFile`""
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero)

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description 'Watches for the FICONTER external backup SSD and creates one verified encrypted backup whenever it is connected.' -Force | Out-Null

Write-Host ''
Write-Host 'BACKUP-ON-CONNECT CONFIGURED.'
Write-Host "Destination: $BackupRoot"
Write-Host "Windows task: $taskName"
Write-Host 'Trigger: once whenever the external SSD changes from disconnected to connected.'
Write-Host ''
Write-Host 'IMPORTANT:'
Write-Host '- The SSD does NOT need to remain connected.'
Write-Host '- Keep it disconnected when not in use.'
Write-Host '- Reconnecting it later will trigger a new backup.'
Write-Host '- Production is read only during backup and is never overwritten.'
