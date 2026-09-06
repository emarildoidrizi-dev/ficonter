param(
  [Parameter(Mandatory = $true)]
  [string]$BackupRoot
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Require-Command([string]$Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "$Name is required."
  }
}

function To-PlainText([Security.SecureString]$SecureValue) {
  return [System.Net.NetworkCredential]::new('', $SecureValue).Password
}

Require-Command git
Require-Command pg_dump
Require-Command pg_restore
Require-Command rclone
Require-Command 7z

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$resolvedBackupRoot = [System.IO.Path]::GetFullPath($BackupRoot)

if ($resolvedBackupRoot.StartsWith($repoRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw 'BackupRoot must be outside the FICONTER repository.'
}

New-Item -ItemType Directory -Force -Path $resolvedBackupRoot | Out-Null

$stamp = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
$dateStamp = (Get-Date).ToString('yyyy-MM-dd')
$finalArchive = Join-Path $resolvedBackupRoot "FICONTER-MASTER-RECOVERY-$dateStamp.7z"

if (Test-Path $finalArchive) {
  throw "A recovery archive already exists for today: $finalArchive"
}

$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) "FICONTER-RECOVERY-$stamp-$([guid]::NewGuid().ToString('N'))"
$codeDir = Join-Path $tempRoot 'code'
$dbDir = Join-Path $tempRoot 'database'
$storageDir = Join-Path $tempRoot 'storage'
$manifestDir = Join-Path $tempRoot 'manifest'

New-Item -ItemType Directory -Force -Path $codeDir, $dbDir, $storageDir, $manifestDir | Out-Null

$secureDbPw = $null
$dbPass = $null
$secureS3Secret = $null
$s3Secret = $null
$secureMasterPw = $null
$masterPass = $null

try {
  Write-Host 'FICONTER owner-controlled offline recovery backup'
  Write-Host 'No Docker and no external backup destination are used.'

  $secureDbPw = Read-Host 'Enter production Supabase database password' -AsSecureString
  $dbPass = To-PlainText $secureDbPw

  $s3Access = Read-Host 'Enter TEMPORARY Supabase Storage S3 access key ID'
  if ([string]::IsNullOrWhiteSpace($s3Access)) {
    throw 'S3 access key ID is required.'
  }

  $secureS3Secret = Read-Host 'Enter TEMPORARY Supabase Storage S3 secret access key' -AsSecureString
  $s3Secret = To-PlainText $secureS3Secret

  $secureMasterPw = Read-Host 'Enter FICONTER MASTER recovery password' -AsSecureString
  $masterPass = To-PlainText $secureMasterPw
  if ([string]::IsNullOrWhiteSpace($masterPass)) {
    throw 'Master recovery password cannot be empty.'
  }

  Write-Host 'Creating full Git history backup...'
  & git -C $repoRoot bundle create (Join-Path $codeDir 'FICONTER-CODE.bundle') --all
  if ($LASTEXITCODE -ne 0) { throw 'Git bundle creation failed.' }

  & git -C $repoRoot archive --format=zip --output=(Join-Path $codeDir 'FICONTER-SOURCE.zip') HEAD
  if ($LASTEXITCODE -ne 0) { throw 'Git source snapshot creation failed.' }

  & git bundle verify (Join-Path $codeDir 'FICONTER-CODE.bundle') | Out-Host
  if ($LASTEXITCODE -ne 0) { throw 'Git bundle verification failed.' }

  Write-Host 'Creating production PostgreSQL backup...'
  $env:PGPASSWORD = $dbPass
  & pg_dump `
    --host='aws-0-eu-central-1.pooler.supabase.com' `
    --port=5432 `
    --username='postgres.bbqwhesigazgziiuexlv' `
    --dbname='postgres' `
    --format=custom `
    --no-owner `
    --no-privileges `
    --file=(Join-Path $dbDir 'FICONTER-PRODUCTION.dump')
  if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL backup failed.' }

  & pg_restore --list (Join-Path $dbDir 'FICONTER-PRODUCTION.dump') > $null
  if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL dump verification failed.' }
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue

  Write-Host 'Copying every Supabase Storage bucket locally...'
  $env:RCLONE_CONFIG_SUPABASE_TYPE = 's3'
  $env:RCLONE_CONFIG_SUPABASE_PROVIDER = 'Other'
  $env:RCLONE_CONFIG_SUPABASE_ACCESS_KEY_ID = $s3Access
  $env:RCLONE_CONFIG_SUPABASE_SECRET_ACCESS_KEY = $s3Secret
  $env:RCLONE_CONFIG_SUPABASE_ENDPOINT = 'https://bbqwhesigazgziiuexlv.storage.supabase.co/storage/v1/s3'
  $env:RCLONE_CONFIG_SUPABASE_REGION = 'eu-central-1'
  $env:RCLONE_CONFIG_SUPABASE_FORCE_PATH_STYLE = 'true'

  $buckets = @(& rclone lsf supabase: --dirs-only | ForEach-Object { $_.TrimEnd('/') } | Where-Object { $_ })
  if ($LASTEXITCODE -ne 0) { throw 'Unable to list Supabase Storage buckets.' }
  if ($buckets.Count -eq 0) { throw 'No Supabase Storage buckets were discovered.' }

  foreach ($bucket in $buckets) {
    Write-Host "Backing up Storage bucket: $bucket"
    $destination = Join-Path $storageDir $bucket
    New-Item -ItemType Directory -Force -Path $destination | Out-Null
    & rclone copy "supabase:$bucket" $destination
    if ($LASTEXITCODE -ne 0) { throw "Storage copy failed for bucket: $bucket" }
    & rclone check "supabase:$bucket" $destination --size-only --one-way
    if ($LASTEXITCODE -ne 0) { throw "Storage verification failed for bucket: $bucket" }
  }

  $configuration = @'
FICONTER RECOVERY CONFIGURATION - VALUES/SECRETS ARE NOT STORED HERE

Core hosting
- Application: Next.js / Node.js >= 22
- Source repository: emarildoidrizi-dev/ficonter
- Primary branch: main
- Production domain: ficonter.com
- Production domain: www.ficonter.com

Production Supabase
- Project name: ficonter
- Project ref: bbqwhesigazgziiuexlv
- Region: eu-central-1
- Database pooler host: aws-0-eu-central-1.pooler.supabase.com
- Database port: 5432
- Database name: postgres
- Database user: postgres.bbqwhesigazgziiuexlv
- Storage S3 endpoint: https://bbqwhesigazgziiuexlv.storage.supabase.co/storage/v1/s3
- Storage S3 region: eu-central-1

Required application configuration names
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY
- NEXT_PUBLIC_SITE_URL
- FICONTER_OWNER_EMAIL
- FICONTER_SUPER_ADMIN_EMAIL
- FICONTER_HEALTH_TOKEN
- OPENAI_API_KEY
- OPENAI_MODEL

PayPal configuration names when paid subscriptions are enabled
- NEXT_PUBLIC_PAYPAL_CLIENT_ID
- PAYPAL_CLIENT_ID
- PAYPAL_CLIENT_SECRET
- PAYPAL_API_BASE
- PAYPAL_WEBHOOK_ID
- PAYPAL_PLAN_PERSONAL_MONTHLY
- PAYPAL_PLAN_PERSONAL_ANNUAL
- PAYPAL_PLAN_BUSINESS_MONTHLY
- PAYPAL_PLAN_BUSINESS_ANNUAL

Security rule
- Secret VALUES do not belong in Git, this manifest, screenshots, or the recovery archive in plain text.
- Keep account recovery methods and secret values in a separate owner-controlled secret record.
'@
  $configuration | Set-Content -Encoding UTF8 (Join-Path $manifestDir 'RECOVERY-CONFIGURATION.txt')

  $recoveryFirst = @"
FICONTER EMERGENCY RECOVERY - READ FIRST
Created UTC: $stamp

1. Never restore directly over damaged Production first.
2. Extract this archive only on a trusted computer.
3. Verify manifest/SHA256SUMS.txt before using recovered files.
4. Recover code from code/FICONTER-CODE.bundle.
5. Restore database/database/FICONTER-PRODUCTION.dump into an isolated PostgreSQL/Supabase target.
6. Restore Storage bucket folders only after the replacement Storage service and bucket metadata are ready.
7. Recreate required environment variables from manifest/RECOVERY-CONFIGURATION.txt and the separate Owner Secrets Record.
8. Validate Auth, RLS, Realtime, Storage, payments and health checks before reconnecting ficonter.com.
9. Never publish production secrets or customer backup data to GitHub or cloud artifacts.

Known recovery evidence as of 2026-09-06:
- Git bundle isolated recovery: PASSED
- Core database data + auth.users isolated recovery: PASSED
- Storage extraction/count/byte recovery: PASSED
- Production was not modified during recovery testing.
"@
  $recoveryFirst | Set-Content -Encoding UTF8 (Join-Path $manifestDir 'READ-FIRST.txt')

  $backupInfo = @(
    'product=FICONTER',
    "created_utc=$stamp",
    'backup_type=owner_controlled_offline_master_encrypted',
    'docker_required=false',
    'external_cloud_backup_destination=false',
    'production_project_ref=bbqwhesigazgziiuexlv',
    'production_region=eu-central-1',
    'code_bundle=code/FICONTER-CODE.bundle',
    'code_snapshot=code/FICONTER-SOURCE.zip',
    'database_dump=database/FICONTER-PRODUCTION.dump',
    'database_format=postgres_custom_pg_dump',
    'storage_format=local_object_copy',
    'master_archive_encryption=7zAES_header_encryption',
    "storage_bucket_count=$($buckets.Count)"
  )
  $backupInfo | Set-Content -Encoding UTF8 (Join-Path $manifestDir 'BACKUP-INFO.txt')

  Write-Host 'Generating SHA-256 manifest...'
  Get-ChildItem -Path $tempRoot -File -Recurse |
    Where-Object { $_.FullName -notlike "*\manifest\SHA256SUMS.txt" } |
    Sort-Object FullName |
    ForEach-Object {
      $hash = (Get-FileHash -Algorithm SHA256 $_.FullName).Hash.ToLowerInvariant()
      $relative = [System.IO.Path]::GetRelativePath($tempRoot, $_.FullName).Replace('\', '/')
      "$hash  $relative"
    } | Set-Content -Encoding UTF8 (Join-Path $manifestDir 'SHA256SUMS.txt')

  Write-Host 'Creating AES-encrypted master recovery archive...'
  & 7z a $finalArchive "$tempRoot\*" -t7z -mx=1 -mhe=on "-p$masterPass" | Out-Host
  if ($LASTEXITCODE -ne 0) { throw 'Master archive creation failed.' }

  Write-Host 'Testing encrypted master recovery archive...'
  & 7z t $finalArchive "-p$masterPass" | Out-Host
  if ($LASTEXITCODE -ne 0) { throw 'Master archive verification failed.' }

  $archiveHash = (Get-FileHash -Algorithm SHA256 $finalArchive).Hash.ToLowerInvariant()
  $archiveBytes = (Get-Item $finalArchive).Length

  Write-Host ''
  Write-Host 'FICONTER OWNER BACKUP COMPLETED AND VERIFIED.'
  Write-Host "Archive: $finalArchive"
  Write-Host "Bytes: $archiveBytes"
  Write-Host "SHA256: $archiveHash"
  Write-Host 'Revoke/delete the temporary Supabase Storage S3 access key now.'
  Write-Host 'Keep the master password separate from the backup drive.'
}
finally {
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
  Remove-Item Env:RCLONE_CONFIG_SUPABASE_TYPE -ErrorAction SilentlyContinue
  Remove-Item Env:RCLONE_CONFIG_SUPABASE_PROVIDER -ErrorAction SilentlyContinue
  Remove-Item Env:RCLONE_CONFIG_SUPABASE_ACCESS_KEY_ID -ErrorAction SilentlyContinue
  Remove-Item Env:RCLONE_CONFIG_SUPABASE_SECRET_ACCESS_KEY -ErrorAction SilentlyContinue
  Remove-Item Env:RCLONE_CONFIG_SUPABASE_ENDPOINT -ErrorAction SilentlyContinue
  Remove-Item Env:RCLONE_CONFIG_SUPABASE_REGION -ErrorAction SilentlyContinue
  Remove-Item Env:RCLONE_CONFIG_SUPABASE_FORCE_PATH_STYLE -ErrorAction SilentlyContinue

  $dbPass = $null
  $secureDbPw = $null
  $s3Secret = $null
  $secureS3Secret = $null
  $masterPass = $null
  $secureMasterPw = $null

  if (Test-Path $tempRoot) {
    Remove-Item $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
  }
}
