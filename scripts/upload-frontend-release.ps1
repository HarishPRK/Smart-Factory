# Builds and uploads static files only. Installation remains a separate EC2 step.
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$Destination,
  [Parameter(Mandatory = $true)][string]$IdentityFile,
  [Parameter(Mandatory = $true)][string]$WebRoot,
  [string]$ReleaseArchive,
  [string]$SiteWiseApi,
  [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
if ($Destination -notmatch '^[A-Za-z_][A-Za-z0-9_.-]*@[A-Za-z0-9][A-Za-z0-9.-]*$') {
  throw 'Destination must be an explicit SSH login and hostname, for example ec2-user@3.239.12.96.'
}
if ($WebRoot -cne '/var/www/smart-factory') {
  throw 'This release targets the documented /var/www/smart-factory root only. Confirm the current Nginx root before uploading.'
}
if (-not (Test-Path -LiteralPath $IdentityFile -PathType Leaf)) {
  throw 'The SSH identity file does not exist. Supply its full local path.'
}
$resolvedIdentity = (Resolve-Path -LiteralPath $IdentityFile).ProviderPath
if (-not $ReleaseArchive) {
  $ReleaseArchive = Join-Path $projectRoot 'dist/releases/smart-factory-frontend.tar.gz'
}
$resolvedArchive = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($ReleaseArchive)
if ([System.IO.Path]::GetFileName($resolvedArchive) -cne 'smart-factory-frontend.tar.gz') {
  throw 'Use the filename smart-factory-frontend.tar.gz so the printed EC2 commands match the uploaded archive.'
}
if ($SkipBuild -and $SiteWiseApi) {
  throw 'SiteWiseApi affects the build. Omit SkipBuild when setting it.'
}
Get-Command scp -ErrorAction Stop | Out-Null

if (-not $SkipBuild) {
  Get-Command node -ErrorAction Stop | Out-Null
  $buildArguments = @((Join-Path $PSScriptRoot 'package-frontend-release.mjs'), '--output', $resolvedArchive)
  if ($SiteWiseApi) { $buildArguments += @('--sitewise-api', $SiteWiseApi) }
  & node @buildArguments
  if ($LASTEXITCODE -ne 0) { throw 'Frontend packaging failed. No files were uploaded.' }
}
$checksumPath = "$resolvedArchive.sha256"
if (-not (Test-Path -LiteralPath $resolvedArchive -PathType Leaf) -or
    -not (Test-Path -LiteralPath $checksumPath -PathType Leaf)) {
  throw 'The release archive or its checksum is missing. Build the release first.'
}
$checksumLine = (Get-Content -LiteralPath $checksumPath -Raw).Trim()
if ($checksumLine -notmatch '^([a-fA-F0-9]{64})\s{2}smart-factory-frontend\.tar\.gz$') {
  throw 'The checksum file does not identify this release archive.'
}
$expectedHash = $Matches[1]
$actualHash = (Get-FileHash -LiteralPath $resolvedArchive -Algorithm SHA256).Hash
if ($actualHash -ine $expectedHash) { throw 'The release checksum does not match. No files were uploaded.' }

# Argument arrays preserve local identity/archive paths containing spaces.
# scp sends only these two release files to the login user's home directory.
& scp -i $resolvedIdentity $resolvedArchive $checksumPath "${Destination}:~/"
if ($LASTEXITCODE -ne 0) { throw 'Release upload failed. Do not install until both files have uploaded successfully.' }

Write-Host ''
Write-Host 'Upload complete. No remote installation or service restart was performed.'
Write-Host 'Log into EC2, then run:'
Write-Host @'
set -euo pipefail
cd "$HOME"
sha256sum -c smart-factory-frontend.tar.gz.sha256
release_dir=$(mktemp -d "$HOME/smart-factory-frontend.XXXXXXXX")
tar -xzf smart-factory-frontend.tar.gz -C "$release_dir"
cd "$release_dir"
sha256sum --check --strict --quiet SHA256SUMS
sudo bash install.sh --web-root /var/www/smart-factory
'@
