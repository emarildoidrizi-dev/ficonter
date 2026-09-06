param(
  [Parameter(Mandatory = $false)]
  [string]$BackupRoot = 'D:\FICONTER-BACKUPS',

  [Parameter(Mandatory = $false)]
  [ValidateSet('Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday')]
  [string]$DayOfWeek = 'Sunday',

  [Parameter(Mandatory = $false)]
  [string]$Time = '20:00'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$runner = Join-Path $PSScriptRoot 'run-owner-automatic-backup.ps1'
if (-not (Test-Path $runner)) { throw 'Automatic backup runner is missing.' }

$stateDir = Join-Path $env:LOCALAPPDATA 'FICONTER\Recovery'
New-Item -ItemType Directory -Force -Path $stateDir | Out-Null
$credentialFile = Join-Path $stateDir 'backup-credentials.clixml'
$configFile = Join-Path $stateDir 'backup-config.json'

Write-Host ''
Write-Host 'FICONTER AUTOMATIC BACKUP SETUP'
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
  DayOfWeek = $DayOfWeek
  Time = $Time
  CredentialFile = $credentialFile
}
$config | ConvertTo-Json | Set-Content -Encoding UTF8 $configFile

$taskName = 'FICONTER Owner Automatic Backup'
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$runner`" -ConfigFile `"$configFile`""
$trigger = New-ScheduledTaskTrigger -Weekly -WeeksInterval 1 -DaysOfWeek $DayOfWeek -At $Time
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 4)

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description 'Creates a verified encrypted FICONTER owner recovery backup on the external SSD.' -Force | Out-Null

Write-Host ''
Write-Host 'AUTOMATIC BACKUP CONFIGURED.'
Write-Host "Schedule: every $DayOfWeek at $Time"
Write-Host "Destination: $BackupRoot"
Write-Host "Windows task: $taskName"
Write-Host ''
Write-Host 'IMPORTANT: the external SSD must be connected at backup time.'
Write-Host 'If it is not connected, the run will fail safely and Production will not be changed.'
