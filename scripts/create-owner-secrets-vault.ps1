param(
  [Parameter(Mandatory = $false)]
  [string]$BackupRoot = 'D:\FICONTER-BACKUPS'
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

$resolvedBackupRoot = [System.IO.Path]::GetFullPath($BackupRoot)
New-Item -ItemType Directory -Force -Path $resolvedBackupRoot | Out-Null

$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) "FICONTER-SECRETS-$([guid]::NewGuid().ToString('N'))"
New-Item -ItemType Directory -Force -Path $tempRoot | Out-Null

$secretFile = Join-Path $tempRoot 'FICONTER-OWNER-SECRETS.txt'
$archivePath = Join-Path $resolvedBackupRoot 'FICONTER-OWNER-SECRETS.7z'
$secureVaultPw = $null
$vaultPass = $null

try {
  Write-Host ''
  Write-Host 'FICONTER OWNER SECRETS VAULT'
  Write-Host 'The real values you type are written only to a temporary file and then encrypted.'
  Write-Host 'Do not paste screenshots of this session into chat.'
  Write-Host ''

  $fields = [ordered]@{
    'SUPABASE_DATABASE_PASSWORD' = 'Production Supabase database password'
    'SUPABASE_SECRET_OR_SERVICE_ROLE_KEY' = 'SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY'
    'NEXT_PUBLIC_SUPABASE_ANON_KEY' = 'Supabase publishable/anon key'
    'FICONTER_HEALTH_TOKEN' = 'FICONTER health token'
    'OPENAI_API_KEY' = 'OpenAI API key (leave blank if unused)'
    'PAYPAL_CLIENT_SECRET' = 'PayPal client secret (leave blank if unused)'
    'PAYPAL_WEBHOOK_ID' = 'PayPal webhook ID (leave blank if unused)'
    'EMAIL_PROVIDER_SECRET' = 'Resend/SMTP/API secret used by Production (leave blank if unused)'
  }

  $lines = New-Object System.Collections.Generic.List[string]
  $lines.Add('FICONTER OWNER SECRETS RECOVERY RECORD')
  $lines.Add("Created UTC: $((Get-Date).ToUniversalTime().ToString('u'))")
  $lines.Add('')
  $lines.Add('ACCOUNT RECOVERY')
  $lines.Add("GitHub recovery method: $(Read-Host 'GitHub recovery email/phone/method (no password required)')")
  $lines.Add("Supabase recovery method: $(Read-Host 'Supabase recovery email/phone/method (no password required)')")
  $lines.Add("Vercel recovery method: $(Read-Host 'Vercel recovery email/phone/method (no password required)')")
  $lines.Add("Domain registrar recovery method: $(Read-Host 'Domain registrar recovery method')")
  $lines.Add("Google Workspace recovery method: $(Read-Host 'Google Workspace recovery method')")
  $lines.Add("PayPal recovery method: $(Read-Host 'PayPal recovery method (leave blank if unused)')")
  $lines.Add('')
  $lines.Add('PRODUCTION SECRET VALUES')

  foreach ($entry in $fields.GetEnumerator()) {
    $secureValue = Read-Host $entry.Value -AsSecureString
    $plainValue = To-PlainText $secureValue
    $lines.Add("$($entry.Key)=$plainValue")
    $plainValue = $null
    $secureValue = $null
  }

  $lines.Add('')
  $lines.Add('NON-SECRET REFERENCES')
  $lines.Add("FICONTER_OWNER_EMAIL=$(Read-Host 'FICONTER owner email')")
  $lines.Add("FICONTER_SUPER_ADMIN_EMAIL=$(Read-Host 'FICONTER super admin email')")
  $lines.Add("NEXT_PUBLIC_SITE_URL=$(Read-Host 'Production site URL')")
  $lines.Add("OPENAI_MODEL=$(Read-Host 'OpenAI model name (leave blank if unused)')")
  $lines.Add("PAYPAL_API_BASE=$(Read-Host 'PayPal API base (leave blank if unused)')")
  $lines.Add("PAYPAL_PLAN_PERSONAL_MONTHLY=$(Read-Host 'PayPal Personal monthly plan ID (leave blank if unused)')")
  $lines.Add("PAYPAL_PLAN_PERSONAL_ANNUAL=$(Read-Host 'PayPal Personal annual plan ID (leave blank if unused)')")
  $lines.Add("PAYPAL_PLAN_BUSINESS_MONTHLY=$(Read-Host 'PayPal Business monthly plan ID (leave blank if unused)')")
  $lines.Add("PAYPAL_PLAN_BUSINESS_ANNUAL=$(Read-Host 'PayPal Business annual plan ID (leave blank if unused)')")

  $lines | Set-Content -Encoding UTF8 $secretFile

  $secureVaultPw = Read-Host 'Enter the FICONTER recovery vault password' -AsSecureString
  $vaultPass = To-PlainText $secureVaultPw
  if ([string]::IsNullOrWhiteSpace($vaultPass)) {
    throw 'Recovery vault password cannot be empty.'
  }

  if (Test-Path $archivePath) {
    $confirm = Read-Host 'FICONTER-OWNER-SECRETS.7z already exists. Type REPLACE to overwrite it'
    if ($confirm -ne 'REPLACE') {
      throw 'Owner secrets vault was not changed.'
    }
    Remove-Item $archivePath -Force
  }

  & 7z a $archivePath $secretFile -t7z -mx=1 -mhe=on "-p$vaultPass" | Out-Host
  if ($LASTEXITCODE -ne 0) { throw 'Owner secrets archive creation failed.' }

  & 7z t $archivePath "-p$vaultPass" | Out-Host
  if ($LASTEXITCODE -ne 0) { throw 'Owner secrets archive verification failed.' }

  Write-Host ''
  Write-Host 'OWNER SECRETS VAULT CREATED AND VERIFIED.'
  Write-Host "Archive: $archivePath"
  Write-Host 'Keep the vault password OUTSIDE D:\FICONTER-BACKUPS.'
}
finally {
  $vaultPass = $null
  $secureVaultPw = $null
  if (Test-Path $secretFile) {
    Remove-Item $secretFile -Force -ErrorAction SilentlyContinue
  }
  if (Test-Path $tempRoot) {
    Remove-Item $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
  }
}
