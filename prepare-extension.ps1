$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Install Node.js 22+ and reopen PowerShell.' }
$version = & node -p 'parseInt(process.versions.node)'
if ([int]$version -lt 22) { throw 'Node.js 22 or newer is required.' }
$keySecure = Read-Host 'GigaChat authorization key (without Basic prefix)' -AsSecureString
$passwordSecure = Read-Host 'Unlock password' -AsSecureString
try {
  $payload = @{
    authKey = [System.Net.NetworkCredential]::new('', $keySecure).Password
    password = [System.Net.NetworkCredential]::new('', $passwordSecure).Password
  } | ConvertTo-Json -Compress
  $payload | & node .\tools\seal-key.mjs
  if ($LASTEXITCODE -ne 0) { throw 'Key encryption failed.' }
  & node .\tools\build.mjs
  if ($LASTEXITCODE -ne 0) { throw 'Extension packaging failed.' }
} finally {
  $payload = $null
  $keySecure.Dispose()
  $passwordSecure.Dispose()
}
