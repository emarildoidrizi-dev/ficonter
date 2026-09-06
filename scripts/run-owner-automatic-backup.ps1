param(
  [Parameter(Mandatory = $true)]
  [string]$ConfigFile
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Require-Command([string]$Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) { throw "$Name is required." }
}
function To-PlainText([Security.SecureString]$SecureValue) {
  return [System.Net.NetworkCredential]::new('', $SecureValue).Password
}

Require-Command git
Require-Command pg_dump
Require-Command pg_restore
Require-Command rclone
Require-Command 7z

$config = Get-Content $ConfigFile -Raw | ConvertFrom-Json
$backupRoot = [System.IO.Path]::GetFullPath([string]$config.BackupRoot)
$repoRoot = [System.IO.Path]::GetFullPath([string]$config.RepoRoot)
$credentialFile = [string]$config.CredentialFile

if (-not (Test-Path $backupRoot)) { throw "Backup drive/folder unavailable: $backupRoot" }
if (-not (Test-Path $repoRoot)) { throw "FICONTER repository unavailable: $repoRoot" }
if (-not (Test-Path $credentialFile)) { throw 'Encrypted backup credentials are unavailable.' }

$credential = Import-Clixml $credentialFile
$dbPass = To-PlainText $credential.DatabasePassword
$s3Secret = To-PlainText $credential.StorageSecretAccessKey
$masterPass = To-PlainText $credential.MasterPassword
$s3Access = [string]$credential.StorageAccessKeyId

$stamp = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
$dateStamp = (Get-Date).ToString('yyyy-MM-dd')
$finalArchive = Join-Path $backupRoot "FICONTER-MASTER-RECOVERY-$dateStamp.7z"
$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) "FICONTER-AUTO-$stamp-$([guid]::NewGuid().ToString('N'))"
$codeDir = Join-Path $tempRoot 'code'
$dbDir = Join-Path $tempRoot 'database'
$storageDir = Join-Path $tempRoot 'storage'
$manifestDir = Join-Path $tempRoot 'manifest'
New-Item -ItemType Directory -Force -Path $codeDir, $dbDir, $storageDir, $manifestDir | Out-Null

try {
  if (Test-Path $finalArchive) {
    $finalArchive = Join-Path $backupRoot "FICONTER-MASTER-RECOVERY-$stamp.7z"
  }

  $bundlePath = Join-Path $codeDir 'FICONTER-CODE.bundle'
  $sourceZipPath = Join-Path $codeDir 'FICONTER-SOURCE.zip'
  & git -C $repoRoot bundle create $bundlePath --all
  if ($LASTEXITCODE -ne 0) { throw 'Git bundle creation failed.' }
  & git -C $repoRoot archive --format=zip "--output=$sourceZipPath" HEAD
  if ($LASTEXITCODE -ne 0) { throw 'Git source snapshot failed.' }
  & git -C $repoRoot bundle verify $bundlePath > $null
  if ($LASTEXITCODE -ne 0) { throw 'Git bundle verification failed.' }

  $dbDumpPath = Join-Path $dbDir 'FICONTER-PRODUCTION.dump'
  $env:PGPASSWORD = $dbPass
  & pg_dump --host='aws-0-eu-central-1.pooler.supabase.com' --port=5432 --username='postgres.bbqwhesigazgziiuexlv' --dbname='postgres' --format=custom --no-owner --no-privileges "--file=$dbDumpPath"
  if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL backup failed.' }
  & pg_restore --list $dbDumpPath > $null
  if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL dump verification failed.' }
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue

  $env:RCLONE_CONFIG_SUPABASE_TYPE = 's3'
  $env:RCLONE_CONFIG_SUPABASE_PROVIDER = 'Other'
  $env:RCLONE_CONFIG_SUPABASE_ACCESS_KEY_ID = $s3Access
  $env:RCLONE_CONFIG_SUPABASE_SECRET_ACCESS_KEY = $s3Secret
  $env:RCLONE_CONFIG_SUPABASE_ENDPOINT = 'https://bbqwhesigazgziiuexlv.storage.supabase.co/storage/v1/s3'
  $env:RCLONE_CONFIG_SUPABASE_REGION = 'eu-central-1'
  $env:RCLONE_CONFIG_SUPABASE_FORCE_PATH_STYLE = 'true'

  $buckets = @(& rclone lsf supabase: --dirs-only | ForEach-Object { $_.TrimEnd('/') } | Where-Object { $_ })
  if ($LASTEXITCODE -ne 0 -or $buckets.Count -eq 0) { throw 'Unable to discover Supabase Storage buckets.' }

  foreach ($bucket in $buckets) {
    $destination = Join-Path $storageDir $bucket
    New-Item -ItemType Directory -Force -Path $destination | Out-Null
    & rclone copy "supabase:$bucket" $destination
    if ($LASTEXITCODE -ne 0) { throw "Storage copy failed: $bucket" }
    & rclone check "supabase:$bucket" $destination --size-only --one-way
    if ($LASTEXITCODE -ne 0) { throw "Storage verification failed: $bucket" }
  }

  @(
    'product=FICONTER',
    "created_utc=$stamp",
    'backup_type=owner_controlled_automatic_offline',
    'docker_required=false',
    'production_project_ref=bbqwhesigazgziiuexlv',
    "storage_bucket_count=$($buckets.Count)"
  ) | Set-Content -Encoding UTF8 (Join-Path $manifestDir 'BACKUP-INFO.txt')

  Get-ChildItem -Path $tempRoot -File -Recurse |
    Where-Object { $_.FullName -notlike "*\manifest\SHA256SUMS.txt" } |
    Sort-Object FullName |
    ForEach-Object {
      $hash = (Get-FileHash -Algorithm SHA256 $_.FullName).Hash.ToLowerInvariant()
      $relative = [System.IO.Path]::GetRelativePath($tempRoot, $_.FullName).Replace('\', '/')
      "$hash  $relative"
    } | Set-Content -Encoding UTF8 (Join-Path $manifestDir 'SHA256SUMS.txt')

  & 7z a $finalArchive "$tempRoot\*" -t7z -mx=1 -mhe=on "-p$masterPass" > $null
  if ($LASTEXITCODE -ne 0) { throw 'Encrypted master archive creation failed.' }
  & 7z t $finalArchive "-p$masterPass" > $null
  if ($LASTEXITCODE -ne 0) { throw 'Encrypted master archive verification failed.' }

  $logPath = Join-Path $backupRoot 'FICONTER-AUTOMATIC-BACKUP-STATUS.txt'
  @(
    'status=SUCCESS',
    "completed_utc=$((Get-Date).ToUniversalTime().ToString('o'))",
    "archive=$finalArchive",
    "sha256=$((Get-FileHash -Algorithm SHA256 $finalArchive).Hash.ToLowerInvariant())"
  ) | Set-Content -Encoding UTF8 $logPath
}
catch {
  $logPath = Join-Path $backupRoot 'FICONTER-AUTOMATIC-BACKUP-STATUS.txt'
  @(
    'status=FAILED',
    "failed_utc=$((Get-Date).ToUniversalTime().ToString('o'))",
    "message=$($_.Exception.Message)"
  ) | Set-Content -Encoding UTF8 $logPath
  throw
}
finally {
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
  Get-ChildItem Env:RCLONE_CONFIG_SUPABASE_* -ErrorAction SilentlyContinue | ForEach-Object { Remove-Item "Env:$($_.Name)" -ErrorAction SilentlyContinue }
  $dbPass = $null
  $s3Secret = $null
  $masterPass = $null
  if (Test-Path $tempRoot) { Remove-Item $tempRoot -Recurse -Force -ErrorAction SilentlyContinue }
}
