# A real Windows check of the real thing: install silently, look at the service, the pipe, the hosts file, the window, then remove it.
# Run by .github/workflows/desktop.yml on a Windows machine. Writes what it sees to $Out (screenshots, logs).
param([string]$Setup, [string]$Out = "smoke-out")
$ErrorActionPreference = "Continue"
New-Item -ItemType Directory -Force $Out | Out-Null
$script:fails = 0
function Check($ok, $what) { if ($ok) { Write-Host "ok   $what" } else { Write-Host "FAIL $what"; $script:fails++ } }

function Ask($obj) {
  $c = New-Object System.IO.Pipes.NamedPipeClientStream(".", "eyetime-helper", [System.IO.Pipes.PipeDirection]::InOut)
  $c.Connect(5000)
  $w = New-Object System.IO.StreamWriter($c); $w.AutoFlush = $true
  $r = New-Object System.IO.StreamReader($c)
  $w.WriteLine(($obj | ConvertTo-Json -Depth 8 -Compress))
  $line = $r.ReadLine()
  $c.Dispose()
  return ($line | ConvertFrom-Json)
}

function Shot($name) {
  Add-Type -AssemblyName System.Windows.Forms, System.Drawing
  $b = [System.Windows.Forms.SystemInformation]::VirtualScreen
  $bmp = New-Object System.Drawing.Bitmap $b.Width, $b.Height
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.CopyFromScreen($b.Left, $b.Top, 0, 0, $bmp.Size)
  $bmp.Save("$Out\$name.png"); $g.Dispose(); $bmp.Dispose()
}

Write-Host "== install (silent)"
$p = Start-Process -FilePath $Setup -ArgumentList "--silent", "--log", "$Out\setup.log" -PassThru -Wait
Get-Content "$Out\setup.log" -ErrorAction SilentlyContinue | Select-Object -Last 12
Check ($p.ExitCode -eq 0) "installer exit code is 0 (was $($p.ExitCode))"
$dir = "$env:ProgramFiles\EyeTime"
Check (Test-Path "$dir\eyetime.exe") "eyetime.exe is installed"
Check (Test-Path "$dir\eyetime-helper.exe") "eyetime-helper.exe is installed"
$svc = Get-Service EyeTimeHelper -ErrorAction SilentlyContinue
Check ($svc -and $svc.Status -eq "Running") "the service is running ($($svc.Status))"
Check (Test-Path "$env:ProgramData\Microsoft\Windows\Start Menu\Programs\EyeTime.lnk") "the Start menu shortcut exists"
Check ($null -ne (Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\EyeTime" -ErrorAction SilentlyContinue)) "listed in Apps and features"

Write-Host "== the helper answers"
try {
  $pong = Ask @{ op = "ping" }
  Check ($pong.ok) "ping over the pipe"
  $st = (Ask @{ op = "status" }).data
  Check ($st.version) "status has a version ($($st.version))"
  Write-Host "     agent connected: $($st.agentConnected)   hosts ok: $($st.hostsOk)"
} catch { Check $false "the pipe: $_" }

Write-Host "== a real block: the hosts file"
try {
  $items = @(@{ name = "YouTube"; type = "site"; g = "dis"; color = ""; domain = ""; exe = "" })
  $r = Ask @{ op = "set_state"; keys = @{ "et-items" = $items } }
  Check ($r.ok) "set_state accepted ($($r.code))"
  $r = Ask @{ op = "start_session"; name = "smoke"; minutes = 5; level = 1; blocks = @(); scene = ""; allow_breaks = $false; dnd = $false; mute = $false; close_now = $false }
  Check ($r.ok) "session started ($($r.code) $($r.message))"
  Start-Sleep -Seconds 6
  $hosts = Get-Content "$env:SystemRoot\System32\drivers\etc\hosts" -Raw
  Check ($hosts -match "EYETIME BEGIN" -and $hosts -match "youtube\.com") "the hosts file has the block"
  Check (Test-Path "$env:ProgramData\EyeTime\hosts.original") "the original hosts file was kept"
  Check ($hosts -match "localhost") "the rest of the hosts file is still there"
  # the way out: a Timeout session asks for the chosen challenge; the default is a short hold
  $c = Ask @{ op = "challenge"; action = "end_session" }
  Check ($c.ok) "a challenge is given ($($c.data.kind))"
  Start-Sleep -Seconds 4
  $done = Ask @{ op = "complete"; challenge_id = $c.data.id; answer = "" }
  Check ($done.ok) "the challenge ends the session ($($done.code))"
  Start-Sleep -Seconds 5
  $hosts = Get-Content "$env:SystemRoot\System32\drivers\etc\hosts" -Raw
  Check ($hosts -notmatch "EYETIME BEGIN") "the block is gone from the hosts file after the session"
} catch { Check $false "the block test: $_" }

Write-Host "== the window"
# the window is started with its debugging port open, so that a script can click through it and take pictures
$env:EYETIME_DEBUG_PORT = "9222"
$app = Start-Process -FilePath "$dir\eyetime.exe" -PassThru
Start-Sleep -Seconds 10
$alive = -not $app.HasExited
Check $alive "eyetime.exe is still running after 10 seconds"
if ($alive) { try { $app.Refresh(); Write-Host "     main window title: '$($app.MainWindowTitle)'" } catch {} }
Shot "window"
Get-Process msedgewebview2 -ErrorAction SilentlyContinue | Select-Object -First 1 | ForEach-Object { Write-Host "     WebView2 process present" }
if ($alive) {
  Write-Host "== click through the real window"
  Push-Location (Split-Path $PSScriptRoot -Parent)
  npm install --no-save playwright 2>&1 | Select-Object -Last 2
  $env:OUT = (Resolve-Path $Out).Path
  node tests/win_ui.cjs 2>&1 | Tee-Object -FilePath "$Out\ui.log"
  Check ($LASTEXITCODE -eq 0) "the window works when clicked through (see ui.log and ui_*.png)"
  Pop-Location
  Stop-Process -Id $app.Id -Force -ErrorAction SilentlyContinue
}

Write-Host "== the native host (what the browser extension talks to)"
try {
  $psi = New-Object System.Diagnostics.ProcessStartInfo("$dir\eyetime-helper.exe", "chrome-extension://ohpkalpfhikadmajknogifbcljaennho/")
  $psi.RedirectStandardInput = $true; $psi.RedirectStandardOutput = $true; $psi.UseShellExecute = $false; $psi.CreateNoWindow = $true
  $h = [System.Diagnostics.Process]::Start($psi)
  $msg = [System.Text.Encoding]::UTF8.GetBytes('{"op":"ping"}')
  $h.StandardInput.BaseStream.Write([BitConverter]::GetBytes([int32]$msg.Length), 0, 4)
  $h.StandardInput.BaseStream.Write($msg, 0, $msg.Length); $h.StandardInput.BaseStream.Flush()
  $lenBytes = New-Object byte[] 4; $null = $h.StandardOutput.BaseStream.Read($lenBytes, 0, 4)
  $n = [BitConverter]::ToInt32($lenBytes, 0); $buf = New-Object byte[] $n; $null = $h.StandardOutput.BaseStream.Read($buf, 0, $n)
  $reply = [System.Text.Encoding]::UTF8.GetString($buf) | ConvertFrom-Json
  Check ($reply.ok) "the native host answers a ping from a browser (framed messages)"
  $evil = [System.Text.Encoding]::UTF8.GetBytes('{"op":"set_state","keys":{}}')
  $h.StandardInput.BaseStream.Write([BitConverter]::GetBytes([int32]$evil.Length), 0, 4)
  $h.StandardInput.BaseStream.Write($evil, 0, $evil.Length); $h.StandardInput.BaseStream.Flush()
  $null = $h.StandardOutput.BaseStream.Read($lenBytes, 0, 4)
  $n = [BitConverter]::ToInt32($lenBytes, 0); $buf = New-Object byte[] $n; $null = $h.StandardOutput.BaseStream.Read($buf, 0, $n)
  $reply = [System.Text.Encoding]::UTF8.GetString($buf) | ConvertFrom-Json
  Check ((-not $reply.ok) -and $reply.code -eq "denied") "the native host refuses anything but site, decision, ping and status"
  $h.Kill()
} catch { Check $false "the native host: $_" }
Check (Test-Path "$dir\extension\manifest.json") "the extension files are installed"
Check ($null -ne (Get-ItemProperty "HKLM:\SOFTWARE\Google\Chrome\NativeMessagingHosts\com.eyetime.helper" -ErrorAction SilentlyContinue)) "Chrome is told where the native host is"

Write-Host "== uninstall: refused first, then allowed after the challenge"
try {
  $u = Ask @{ op = "uninstall" }
  Check (-not $u.ok -and $u.code -eq "challenge") "uninstall needs permission first ($($u.code))"
  $c = Ask @{ op = "challenge"; action = "uninstall" }
  Start-Sleep -Seconds 4
  $d = Ask @{ op = "complete"; challenge_id = $c.data.id; answer = "" }
  Check ($d.ok) "permission to uninstall was given"
} catch { Check $false "the uninstall permission: $_" }
$p = Start-Process -FilePath "$dir\eyetime-setup.exe" -ArgumentList "--uninstall", "--silent", "--log", "$Out\uninstall.log" -PassThru -Wait
Get-Content "$Out\uninstall.log" -ErrorAction SilentlyContinue | Select-Object -Last 8
Check ($p.ExitCode -eq 0) "uninstaller exit code is 0 (was $($p.ExitCode))"
Start-Sleep -Seconds 3
Check (-not (Get-Service EyeTimeHelper -ErrorAction SilentlyContinue)) "the service is gone"
Check (-not (Test-Path "$dir\eyetime.exe")) "the program files are gone"
$hosts = Get-Content "$env:SystemRoot\System32\drivers\etc\hosts" -Raw
Check ($hosts -notmatch "EYETIME") "the hosts file is clean"
Check ($null -eq (Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\EyeTime" -ErrorAction SilentlyContinue)) "no longer listed in Apps and features"
Check ($null -eq (Get-ItemProperty "HKLM:\SOFTWARE\Google\Chrome\NativeMessagingHosts\com.eyetime.helper" -ErrorAction SilentlyContinue)) "the browser registration is removed"
Get-Content "$env:ProgramData\EyeTime\helper.log" -ErrorAction SilentlyContinue | Select-Object -Last 20 | Out-File "$Out\helper.log"

if ($script:fails -gt 0) { Write-Host "$($script:fails) check(s) FAILED"; exit 1 } else { Write-Host "ALL OK" }
