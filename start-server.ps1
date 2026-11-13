$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot 'server')
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw 'Install Node.js 22 or newer, then reopen PowerShell.'
}
if (-not (Test-Path '.env')) {
  Write-Host 'First launch: enter the GigaChat authorization key and your extension password.'
  $apiSecure = Read-Host 'GigaChat authorization key (not access token)' -AsSecureString
  $passwordSecure = Read-Host 'Extension password' -AsSecureString
  $api = [System.Net.NetworkCredential]::new('', $apiSecure).Password
  $access = [System.Net.NetworkCredential]::new('', $passwordSecure).Password
  if ($access.Length -lt 4) { throw 'Password must have at least 4 characters.' }
  if ($api -notmatch '^[A-Za-z0-9+/=_-]+$') { throw 'Invalid authorization key format.' }
  $secretBytes = New-Object byte[] 48
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  $rng.GetBytes($secretBytes)
  $rng.Dispose()
  $secret = [Convert]::ToBase64String($secretBytes)
  # Encode the password as a JSON quoted value for Node's env parser.
  if ($access.Contains('"') -or $access.Contains("`r") -or $access.Contains("`n")) { throw 'Use a password without quotes or line breaks.' }
  $lines = @('PORT=3000', ('ACCESS_PASSWORD="' + $access + '"'), ('SESSION_SECRET=' + $secret), ('GIGACHAT_AUTH_KEY=' + $api), 'GIGACHAT_SCOPE=GIGACHAT_API_PERS', 'GIGACHAT_MODEL=GigaChat-2-Max', 'GIGACHAT_BASE_URL=https://api.giga.chat/v1', 'DAILY_LIMIT=100')
  [System.IO.File]::WriteAllLines((Join-Path $PWD '.env'), $lines, (New-Object System.Text.UTF8Encoding($false)))
  $api = $null; $access = $null; $secret = $null; $lines = $null
}
Write-Host 'Keep this window open. Extension server URL: http://localhost:3000'
node --env-file=.env index.js
