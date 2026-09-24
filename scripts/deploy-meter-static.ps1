param(
  [Parameter(Mandatory = $true)][string]$ReleaseMetadata,
  [string]$InstanceId = 'i-04217238dfcdcbd78',
  [string]$Bucket = 'gg-artifacts-841019700679-us-east-1',
  [string]$Region = 'us-east-1'
)

$ErrorActionPreference = 'Stop'
$release = Get-Content -LiteralPath $ReleaseMetadata -Raw | ConvertFrom-Json
$artifact = "s3://$Bucket/$($release.Key)"
$signedUrl = aws s3 presign $artifact --expires-in 1800 --region $Region
if ($LASTEXITCODE -ne 0 -or -not $signedUrl) { throw 'Unable to sign the release artifact.' }

$command = @'
set -eu
archive=/tmp/smart-factory-meter-__STAMP__.tgz
stage=/var/www/.smart-factory-stage-__STAMP__
backup=/var/www/.smart-factory-backup-__STAMP__
curl -fsSL --retry 3 '__SIGNED_URL__' -o "$archive"
printf '%s  %s\n' '__SHA256__' "$archive" | sha256sum -c -
mkdir "$stage"
tar -xzf "$archive" -C "$stage"
test -s "$stage/index.html"
test -s "$stage/widgets/aituzero-meter/index.html"
grep -q 'Digital Manufacturing' "$stage/index.html"
grep -q 'Aituzero' "$stage/widgets/aituzero-meter/index.html"
printf 'smart-meter-__STAMP__\n' > "$stage/.deployed-commit"
chown -R nginx:nginx "$stage"
chmod -R a+rX "$stage"
mv /var/www/smart-factory "$backup"
if ! mv "$stage" /var/www/smart-factory; then mv "$backup" /var/www/smart-factory; exit 1; fi
if ! curl -fsS http://127.0.0.1/ | grep -q 'Digital Manufacturing' || ! curl -fsS http://127.0.0.1/widgets/aituzero-meter/ | grep -q 'Aituzero'; then
  mv /var/www/smart-factory /var/www/.smart-factory-failed-__STAMP__
  mv "$backup" /var/www/smart-factory
  echo 'Post-swap verification failed; restored previous static site.'
  exit 1
fi
echo 'Static site deployed. Previous release retained at __BACKUP__.'
'@
$command = $command.Replace('__STAMP__', $release.Stamp).Replace('__SHA256__', $release.Sha256).Replace('__SIGNED_URL__', $signedUrl).Replace('__BACKUP__', "/var/www/.smart-factory-backup-$($release.Stamp)")
$payload = @{
  DocumentName = 'AWS-RunShellScript'
  InstanceIds = @($InstanceId)
  Comment = "Aituzero meter static release $($release.Stamp)"
  Parameters = @{ commands = @($command) }
} | ConvertTo-Json -Depth 6 -Compress
$payloadPath = [System.IO.Path]::GetTempFileName()
try {
  [System.IO.File]::WriteAllText($payloadPath, $payload)
  $commandId = aws ssm send-command --region $Region --cli-input-json "file://$payloadPath" --query 'Command.CommandId' --output text
  if ($LASTEXITCODE -ne 0 -or -not $commandId) { throw 'Could not start the EC2 static release.' }
  $release | Add-Member -NotePropertyName CommandId -NotePropertyValue $commandId -Force
  $release | ConvertTo-Json | Set-Content -LiteralPath $ReleaseMetadata
  Write-Output "Started release $($release.Stamp) via SSM command $commandId"
} finally {
  Remove-Item -LiteralPath $payloadPath -Force -ErrorAction SilentlyContinue
}
