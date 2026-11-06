# Signs Windows programs with a code-signing certificate (Authenticode), so that Windows shows the publisher's name instead of "unknown publisher".
#   ./sign-windows.ps1 file1.exe file2.exe
# The certificate comes from two repository secrets: WINDOWS_CERT_PFX_BASE64 (the .pfx file, base64) and WINDOWS_CERT_PASSWORD.
# Without them nothing is signed and the build says so (a warning, not a failure): the update signature of desktop-release.yml is a separate thing and does not depend on this.
param([Parameter(Mandatory, ValueFromRemainingArguments)][string[]]$Files)
$ErrorActionPreference = 'Stop'
if (-not $env:WINDOWS_CERT_PFX_BASE64) {
  Write-Host "::warning::WINDOWS_CERT_PFX_BASE64 is not set, so these programs are NOT signed with a certificate: Windows SmartScreen will warn about an unknown publisher. ($($Files -join ', '))"
  exit 0
}
$pfx = Join-Path $env:RUNNER_TEMP 'codesign.pfx'
[IO.File]::WriteAllBytes($pfx, [Convert]::FromBase64String($env:WINDOWS_CERT_PFX_BASE64))
try {
  $tool = Get-ChildItem "${env:ProgramFiles(x86)}\Windows Kits\10\bin\*\x64\signtool.exe" | Sort-Object FullName -Descending | Select-Object -First 1
  if (-not $tool) { throw 'signtool.exe was not found on this machine.' }
  foreach ($f in $Files) {
    & $tool.FullName sign /f $pfx /p $env:WINDOWS_CERT_PASSWORD /fd SHA256 /td SHA256 /tr http://timestamp.digicert.com /d 'EyeTime' $f
    if ($LASTEXITCODE -ne 0) { throw "Signing $f failed." }
    & $tool.FullName verify /pa $f
    if ($LASTEXITCODE -ne 0) { throw "The signature of $f does not verify." }
    Write-Host "signed: $f"
  }
} finally { Remove-Item $pfx -Force -ErrorAction SilentlyContinue }
