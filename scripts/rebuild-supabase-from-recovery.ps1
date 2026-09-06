param(
  [Parameter(Mandatory = $true)]
  [string]$RecoveryArchive,

  [Parameter(Mandatory = $true)]
  [string]$TargetProjectRef,

  [Parameter(Mandatory = $true)]
  [string]$TargetRegion,

  [Parameter(Mandatory = $true)]
  [string]$TargetDbHost,

  [Parameter(Mandatory = $false)]
  [int]$TargetDbPort = 5432,

  [Parameter(Mandatory = $false)]
  [string]$TargetDbName = 'postgres',

  [Parameter(Mandatory = $true)]
  [string]$TargetDbUser,

  [Parameter(Mandatory = $true)]
  [string]$TargetStorageS3Endpoint
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

Require-Command 7z
Require-Command pg_restore
Require-Command psql
Require-Command rclone

$archive = (Resolve-Path $RecoveryArchive).Path
$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) "FICONTER-REBUILD-$([guid]::NewGuid().ToString('N'))"
New-Item -ItemType Directory -Force -Path $tempRoot | Out-Null

$secureArchivePw = $null
$archivePass = $null
$secureDbPw = $null
$dbPass = $null
$secureS3Secret = $null
$s3Secret = $null

try {
  Write-Host ''
  Write-Host 'FICONTER SUPABASE RECOVERY REBUILD'
  Write-Host 'This script is for an EMPTY replacement project only.'
  Write-Host 'Never point this script at Production.'
  Write-Host ''

  $confirm = Read-Host "Type the target project ref '$TargetProjectRef' to confirm the isolated rebuild target"
  if ($confirm -ne $TargetProjectRef) {
    throw 'Target confirmation failed.'
  }

  if ($TargetProjectRef -eq 'bbqwhesigazgziiuexlv') {
    throw 'Refusing to restore into the FICONTER Production project.'
  }

  $secureArchivePw = Read-Host 'Enter FICONTER recovery archive password' -AsSecureString
  $archivePass = To-PlainText $secureArchivePw

  Write-Host 'Extracting recovery archive...'
  & 7z x $archive "-o$tempRoot" "-p$archivePass" -y | Out-Host
  if ($LASTEXITCODE -ne 0) { throw 'Recovery archive extraction failed.' }

  $dump = Join-Path $tempRoot 'database\FICONTER-PRODUCTION.dump'
  $storageRoot = Join-Path $tempRoot 'storage'
  if (-not (Test-Path $dump)) { throw 'Database dump was not found in recovery archive.' }
  if (-not (Test-Path $storageRoot)) { throw 'Storage backup was not found in recovery archive.' }

  & pg_restore --list $dump > $null
  if ($LASTEXITCODE -ne 0) { throw 'Database dump failed validation.' }

  $secureDbPw = Read-Host 'Enter TARGET Supabase database password' -AsSecureString
  $dbPass = To-PlainText $secureDbPw
  $env:PGPASSWORD = $dbPass

  Write-Host ''
  Write-Host 'Restoring database into isolated target...'
  Write-Host 'Some managed Supabase auth/storage ownership warnings can be expected with a full logical dump.'

  $restoreLog = Join-Path $tempRoot 'pg-restore.log'
  & pg_restore `
    --host=$TargetDbHost `
    --port=$TargetDbPort `
    --username=$TargetDbUser `
    --dbname=$TargetDbName `
    --no-owner `
    --no-privileges `
    --verbose `
    $dump 2>&1 | Tee-Object -FilePath $restoreLog | Out-Host

  $restoreExit = $LASTEXITCODE
  if ($restoreExit -ne 0) {
    Write-Warning "pg_restore completed with exit code $restoreExit. Validation will determine whether the FICONTER application data recovered correctly."
  }

  Write-Host ''
  Write-Host 'Validating core FICONTER data...'
  $validationSql = @'
select 'transactions' as table_name, count(*)::bigint as row_count from public.transactions
union all select 'bills', count(*) from public.bills
union all select 'debts', count(*) from public.debts
union all select 'goals', count(*) from public.goals
union all select 'monthly_budget_plans', count(*) from public.monthly_budget_plans
union all select 'credit_card_monthly_records', count(*) from public.credit_card_monthly_records
union all select 'profiles', count(*) from public.profiles
union all select 'businesses', count(*) from public.businesses
union all select 'auth_users', count(*) from auth.users
order by table_name;
'@

  & psql `
    --host=$TargetDbHost `
    --port=$TargetDbPort `
    --username=$TargetDbUser `
    --dbname=$TargetDbName `
    --set=ON_ERROR_STOP=1 `
    --command=$validationSql | Out-Host
  if ($LASTEXITCODE -ne 0) { throw 'Core database validation failed.' }

  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue

  Write-Host ''
  Write-Host 'Preparing Storage restore...'
  $s3Access = Read-Host 'Enter TARGET Supabase Storage S3 access key ID'
  $secureS3Secret = Read-Host 'Enter TARGET Supabase Storage S3 secret access key' -AsSecureString
  $s3Secret = To-PlainText $secureS3Secret

  $env:RCLONE_CONFIG_TARGET_TYPE = 's3'
  $env:RCLONE_CONFIG_TARGET_PROVIDER = 'Other'
  $env:RCLONE_CONFIG_TARGET_ACCESS_KEY_ID = $s3Access
  $env:RCLONE_CONFIG_TARGET_SECRET_ACCESS_KEY = $s3Secret
  $env:RCLONE_CONFIG_TARGET_ENDPOINT = $TargetStorageS3Endpoint
  $env:RCLONE_CONFIG_TARGET_REGION = $TargetRegion
  $env:RCLONE_CONFIG_TARGET_FORCE_PATH_STYLE = 'true'

  $bucketDirs = @(Get-ChildItem $storageRoot -Directory)
  if ($bucketDirs.Count -eq 0) { throw 'No Storage bucket folders were found in the recovery archive.' }

  foreach ($bucket in $bucketDirs) {
    Write-Host "Restoring Storage bucket: $($bucket.Name)"
    & rclone copy $bucket.FullName "target:$($bucket.Name)"
    if ($LASTEXITCODE -ne 0) { throw "Storage upload failed for bucket: $($bucket.Name)" }

    & rclone check $bucket.FullName "target:$($bucket.Name)" --size-only --one-way
    if ($LASTEXITCODE -ne 0) { throw "Storage verification failed for bucket: $($bucket.Name)" }
  }

  Write-Host ''
  Write-Host 'DATABASE + STORAGE REBUILD COMPLETED AND VALIDATED.'
  Write-Host 'Next: configure Auth/Realtime/SMTP/environment variables, deploy FICONTER privately, and run the zero-rebuild acceptance test before any domain cutover.'
}
finally {
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
  Remove-Item Env:RCLONE_CONFIG_TARGET_TYPE -ErrorAction SilentlyContinue
  Remove-Item Env:RCLONE_CONFIG_TARGET_PROVIDER -ErrorAction SilentlyContinue
  Remove-Item Env:RCLONE_CONFIG_TARGET_ACCESS_KEY_ID -ErrorAction SilentlyContinue
  Remove-Item Env:RCLONE_CONFIG_TARGET_SECRET_ACCESS_KEY -ErrorAction SilentlyContinue
  Remove-Item Env:RCLONE_CONFIG_TARGET_ENDPOINT -ErrorAction SilentlyContinue
  Remove-Item Env:RCLONE_CONFIG_TARGET_REGION -ErrorAction SilentlyContinue
  Remove-Item Env:RCLONE_CONFIG_TARGET_FORCE_PATH_STYLE -ErrorAction SilentlyContinue

  $archivePass = $null
  $secureArchivePw = $null
  $dbPass = $null
  $secureDbPw = $null
  $s3Secret = $null
  $secureS3Secret = $null

  if (Test-Path $tempRoot) {
    Remove-Item $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
  }
}
