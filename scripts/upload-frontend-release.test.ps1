# Offline checks: intercept scp so this file cannot contact an EC2 host.
$ErrorActionPreference = 'Stop'
$uploadScript = Join-Path $PSScriptRoot 'upload-frontend-release.ps1'
$testRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('smart-factory-upload-test-' + [Guid]::NewGuid().ToString('N'))
$expectedTestRoot = [System.IO.Path]::GetFullPath($testRoot)
New-Item -ItemType Directory -Path $testRoot | Out-Null
$identity = Join-Path $testRoot 'fake identity.pem'
$archive = Join-Path $testRoot 'smart-factory-frontend.tar.gz'
Set-Content -LiteralPath $identity -Value 'Test fixture, not an SSH key.'
Set-Content -LiteralPath $archive -Value 'Checksum test fixture, not a production release.'
$global:frontendUploadTestArguments = @()
$global:frontendUploadTestCalls = 0
$global:frontendUploadTestExitCode = 0
function scp {
  $global:frontendUploadTestArguments = @($args)
  $global:frontendUploadTestCalls += 1
  $global:LASTEXITCODE = $global:frontendUploadTestExitCode
}
function Assert-That([bool]$condition, [string]$message) {
  if (-not $condition) { throw $message }
}
function Expect-Failure([scriptblock]$action, [string]$messagePattern) {
  $failed = $false
  try { & $action | Out-Null }
  catch {
    $failed = $true
    Assert-That ($_.Exception.Message -match $messagePattern) "Unexpected validation error: $($_.Exception.Message)"
  }
  Assert-That $failed 'Expected a validation failure.'
}
$arguments = @{
  Destination = 'ec2-user@3.239.12.96'
  IdentityFile = $identity
  WebRoot = '/var/www/smart-factory'
  ReleaseArchive = $archive
  SkipBuild = $true
}
try {
  $parseErrors = $null
  [System.Management.Automation.Language.Parser]::ParseFile($uploadScript, [ref]$null, [ref]$parseErrors) | Out-Null
  Assert-That ($parseErrors.Count -eq 0) 'Upload script has a PowerShell syntax error.'
  Expect-Failure { & $uploadScript @arguments } 'checksum is missing'
  Set-Content -LiteralPath "$archive.sha256" -Value ((('0' * 64)) + '  smart-factory-frontend.tar.gz')
  Expect-Failure { & $uploadScript @arguments } 'checksum does not match'
  $actualHash = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
  Set-Content -LiteralPath "$archive.sha256" -Value "$actualHash  smart-factory-frontend.tar.gz"
  $badRoot = $arguments.Clone()
  $badRoot.WebRoot = '/var/www/other-app'
  Expect-Failure { & $uploadScript @badRoot } 'documented'
  $badDestination = $arguments.Clone()
  $badDestination.Destination = '-oProxyCommand=unexpected'
  Expect-Failure { & $uploadScript @badDestination } 'explicit SSH login'
  Assert-That ($global:frontendUploadTestCalls -eq 0) 'Validation failures must not invoke scp.'
  & $uploadScript @arguments 6>$null
  Assert-That ($global:frontendUploadTestCalls -eq 1) 'A validated archive must invoke scp once.'
  Assert-That ($global:frontendUploadTestArguments.Count -eq 5) 'scp must receive exactly identity, archive, checksum and destination arguments.'
  Assert-That ($global:frontendUploadTestArguments[0] -ceq '-i') 'Identity flag was not preserved.'
  Assert-That ($global:frontendUploadTestArguments[1] -ceq $identity) 'Identity path containing a space must remain one argument.'
  Assert-That ($global:frontendUploadTestArguments[2] -ceq $archive) 'Archive path was changed.'
  Assert-That ($global:frontendUploadTestArguments[3] -ceq "$archive.sha256") 'Checksum path was changed.'
  Assert-That ($global:frontendUploadTestArguments[4] -ceq 'ec2-user@3.239.12.96:~/') 'Upload must target the explicit SSH login home directory.'
  $global:frontendUploadTestExitCode = 1
  Expect-Failure { & $uploadScript @arguments } 'upload failed'
  Write-Output 'Frontend upload checks passed. All scp calls were intercepted; no network connection was made.'
} finally {
  Remove-Item Function:scp -ErrorAction SilentlyContinue
  Remove-Variable -Name frontendUploadTestArguments,frontendUploadTestCalls,frontendUploadTestExitCode -Scope Global -ErrorAction SilentlyContinue
  # Delete only this invocation's checked absolute temporary fixture directory.
  $resolvedTestRoot = (Resolve-Path -LiteralPath $testRoot).ProviderPath
  if ($resolvedTestRoot -cne $expectedTestRoot -or
      [System.IO.Path]::GetFileName($resolvedTestRoot) -notlike 'smart-factory-upload-test-*') {
    throw 'Refusing to clean an unexpected fixture directory.'
  }
  Remove-Item -LiteralPath $resolvedTestRoot -Recurse -Force
}
