<#
VectorSuite research agent: runs ExtendScript jobs in a LICENSED Illustrator
on the user's behalf, so research rounds need no manual steps.

Start it once per session, in the Windows VM, with Illustrator open:

    powershell -ExecutionPolicy Bypass -File Z:\temp\vs-agent.ps1

It watches <this folder>\jobs\ for *.jsx files (written there from the dev
machine as ~/Downloads/temp/jobs/) and, oldest name first, runs each one in
Illustrator through its COM interface (Application.DoJavaScriptFile). Each job
is moved to jobs\done\ with a <job>.result.txt holding the script's return
value or the error. Every run is appended to jobs\agent.log, and
jobs\agent.alive is refreshed each poll so the dev machine can tell the agent
is up.

What it can do: run the .jsx files placed in that one folder, inside
Illustrator. It opens no port and installs nothing. Stop it with Ctrl+C, or
by creating jobs\stop.
#>
param(
  [string]$Jobs = (Join-Path $PSScriptRoot 'jobs'),
  [int]$PollMs = 1500
)

$ErrorActionPreference = 'Stop'
foreach ($d in @($Jobs, (Join-Path $Jobs 'done'))) { if (-not (Test-Path $d)) { New-Item -ItemType Directory -Path $d | Out-Null } }
$log = Join-Path $Jobs 'agent.log'
$alive = Join-Path $Jobs 'agent.alive'
$stop = Join-Path $Jobs 'stop'
if (Test-Path $stop) { Remove-Item $stop }

function Write-Log([string]$text) {
  $line = "{0}  {1}" -f (Get-Date).ToString('yyyy-MM-dd HH:mm:ss'), $text
  Add-Content -Path $log -Value $line -Encoding UTF8
  Write-Host $line
}

function Get-Illustrator {
  try { return [Runtime.InteropServices.Marshal]::GetActiveObject('Illustrator.Application') }
  catch { return New-Object -ComObject 'Illustrator.Application' }
}

$app = Get-Illustrator
Write-Log "agent started: Illustrator $($app.Version), watching $Jobs"

while (-not (Test-Path $stop)) {
  Set-Content -Path $alive -Value (Get-Date).ToString('o') -Encoding UTF8
  $next = Get-ChildItem -Path $Jobs -Filter '*.jsx' -File | Sort-Object Name | Select-Object -First 1
  if (-not $next) { Start-Sleep -Milliseconds $PollMs; continue }

  $name = $next.BaseName
  $done = Join-Path $Jobs 'done'
  $result = Join-Path $done "$name.result.txt"
  Write-Log "run  $($next.Name)"
  $started = Get-Date
  try {
    try { $value = $app.DoJavaScriptFile($next.FullName) }
    catch [System.Runtime.InteropServices.COMException] {
      # Illustrator was restarted since the agent started: reconnect once.
      $app = Get-Illustrator
      $value = $app.DoJavaScriptFile($next.FullName)
    }
    $secs = [math]::Round(((Get-Date) - $started).TotalSeconds, 1)
    Set-Content -Path $result -Value ("OK in ${secs}s`r`n" + [string]$value) -Encoding UTF8
    Write-Log "ok   $($next.Name) (${secs}s)"
  } catch {
    Set-Content -Path $result -Value ("ERROR`r`n" + $_.Exception.Message) -Encoding UTF8
    Write-Log "FAIL $($next.Name): $($_.Exception.Message)"
  }
  Move-Item -Path $next.FullName -Destination (Join-Path $done $next.Name) -Force
}
Remove-Item $stop -ErrorAction SilentlyContinue
Write-Log "agent stopped"
