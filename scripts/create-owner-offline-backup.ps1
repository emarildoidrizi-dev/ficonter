param(
  [Parameter(Mandatory = $true)]
  [string]$BackupRoot
)

$ErrorActionPreference = 'Stop'

function Require-Command([string]$Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "$Name is required."
  }
}

function Require-Env([string]$Name) {
  $value = [Environment]::GetEnvironmentVariable($Name)
  if ([string]::IsNullOrWhiteSpace($value)) {
    throw "Missing required environment variable: $Name"
  }
  return $value
}

Require-Command git
Require-Command supabase
Require-Command rclone

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$resolvedBackupRoot = [System.IO.Path]::GetFullPath($BackupRoot)

if ($resolvedBackupRoot.StartsWith($repoRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw 'BackupRoot must be outside the FICONTER repository.'
}

$stamp = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
$root = Join-Path $resolvedBackupRoot "FICONTER-$stamp"
$codeDir = Join-Path $root 'code'
$dbDir = Join-Path $root 'database'
$storageDir = Join-Path $root 'storage'
$manifestDir = Join-Path $root 'manifest'

New-Item -ItemType Directory -Force -Path $codeDir, $dbDir, $storageDir, $manifestDir | Out-Null

$dbUrl = Require-Env 'SUPABASE_DB_URL'
$s3Endpoint = Require-Env 'SUPABASE_STORAGE_S3_ENDPOINT'
$s3Region = Require-Env 'SUPABASE_STORAGE_S3_REGION'
$s3Access = Require-Env 'SUPABASE_STORAGE_S3_ACCESS_KEY_ID'
$s3Secret = Require-Env 'SUPABASE_STORAGE_S3_SECRET_ACCESS_KEY'

Write-Host 'Creating owner-controlled code backup...'
Push-Location $repoRoot
try {
  git bundle create (Join-Path $codeDir 'ficonter-full-history.bundle') --all
  git archive --format=zip --output=(Join-Path $codeDir 'ficonter-main-source.zip') HEAD
} finally {
  Pop-Location
}

Write-Host 'Creating Supabase logical database backup...'
supabase db dump --db-url $dbUrl -f (Join-Path $dbDir 'roles.sql') --role-only
supabase db dump --db-url $dbUrl -f (Join-Path $dbDir 'schema.sql')
supabase db dump --db-url $dbUrl -f (Join-Path $dbDir 'data.sql') --data-only --use-copy -x storage.buckets_vectors -x storage.vector_indexes

$env:RCLONE_CONFIG_SUPABASE_TYPE = 's3'
$env:RCLONE_CONFIG_SUPABASE_PROVIDER = 'Other'
$env:RCLONE_CONFIG_SUPABASE_ACCESS_KEY_ID = $s3Access
$env:RCLONE_CONFIG_SUPABASE_SECRET_ACCESS_KEY = $s3Secret
$env:RCLONE_CONFIG_SUPABASE_ENDPOINT = $s3Endpoint
$env:RCLONE_CONFIG_SUPABASE_REGION = $s3Region
$env:RCLONE_CONFIG_SUPABASE_FORCE_PATH_STYLE = 'true'

Write-Host 'Copying Supabase Storage to owner-controlled local media...'
$buckets = @(rclone lsf supabase: --dirs-only | ForEach-Object { $_.TrimEnd('/') } | Where-Object { $_ })
if ($buckets.Count -eq 0) {
  throw 'No Supabase Storage buckets were discovered.'
}

foreach ($bucket in $buckets) {
  $destination = Join-Path $storageDir $bucket
  New-Item -ItemType Directory -Force -Path $destination | Out-Null
  rclone copy "supabase:$bucket" $destination
  rclone check "supabase:$bucket" $destination --size-only --one-way
}

$manifest = @(
  "product=FICONTER",
  "created_utc=$stamp",
  "backup_type=owner_controlled_offline",
  "production_project_ref=bbqwhesigazgziiuexlv",
  "production_region=eu-central-1",
  "code_bundle=code/ficonter-full-history.bundle",
  "code_snapshot=code/ficonter-main-source.zip",
  "database_format=supabase_cli_logical_dump",
  "storage_format=local_object_copy"
)
$manifest | Set-Content -Encoding UTF8 (Join-Path $manifestDir 'backup-info.txt')

Get-ChildItem -Path $root -File -Recurse |
  Where-Object { $_.FullName -notlike "*\manifest\sha256.txt" } |
  Sort-Object FullName |
  ForEach-Object {
    $hash = (Get-FileHash -Algorithm SHA256 $_.FullName).Hash.ToLowerInvariant()
    $relative = [System.IO.Path]::GetRelativePath($root, $_.FullName).Replace('\', '/')
    "$hash  $relative"
  } | Set-Content -Encoding UTF8 (Join-Path $manifestDir 'sha256.txt')

Write-Host "Owner-controlled FICONTER backup completed: $root"
Write-Host 'Keep this backup only on encrypted media you physically control.'
