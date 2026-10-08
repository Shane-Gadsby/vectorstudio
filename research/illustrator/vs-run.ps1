<#
Drives a LICENSED Illustrator in the Windows VM over SSH. One short, stateless invocation per
call, so nothing long-lived has to run in the guest:

    ssh vs-vm "powershell -ExecutionPolicy Bypass -File C:\vectorstudio\vs-run.ps1 ping"

This replaces vs-bridge.ps1's dial-out socket (decision: SSH is the channel). It keeps the one
capability that mattered about the bridge: **a script that opens a modal dialog does not wedge
anything.** `eval` starts the ExtendScript in a detached process and returns a handle at once, so
the SSH call ends while Illustrator is still busy; `windows`, `keys` and `screenshot` keep working
meanwhile, which is how a dialog gets dismissed; `status` collects the result. State lives in
files under -StateDir, because each SSH call is a new process and nothing is remembered in memory.

Commands:

  ping                            Illustrator version, document count, whether a modal is up
  eval <file.jsx> [-ArgsJson <j>] start it; prints {id}. Prepends `var VS_ARGS = <j>;`
  status -Id <id>                 {state: running|done|failed, result|error}
  cancel -Id <id>                 abandon it (the detached process is killed)
  windows                         Illustrator's top-level windows, which is how dialogs are found
  keys -Send "<keys>"             SendKeys into Illustrator, to drive a modal dialog
  screenshot [-WindowTitle <t>]   base64 PNG of that window, or of the screen
  stop                            kill every eval this script started

It runs only what the dev machine sends and installs nothing. Illustrator must already be running
in an interactive session: COM, SendKeys and screenshots all need a real desktop, so the RDP
session has to be connected and unlocked for anything dialog-related.
#>

[CmdletBinding()]
param(
  [Parameter(Position = 0, Mandatory = $true)]
  [ValidateSet('ping', 'eval', 'status', 'cancel', 'windows', 'keys', 'screenshot', 'stop')]
  [string]$Command,

  [Parameter(Position = 1)]
  [string]$ScriptFile = '',

  # JSON object exposed to the script as `VS_ARGS`. Paths inside it are Windows paths.
  [string]$ArgsJson = '{}',
  [string]$Id = '',
  [string]$Send = '',
  [string]$WindowTitle = '',
  [string]$StateDir = "$env:TEMP\vectorstudio-run",
  # `eval` gives up after this long, so a wedged script cannot leak a process for ever.
  [int]$TimeoutS = 1800
)

$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Force -Path $StateDir | Out-Null

# Every reply is one JSON object on stdout, so the dev machine never parses prose.
function Reply($obj) {
  $obj | ConvertTo-Json -Depth 12 -Compress
  exit 0
}
function Fail($message) {
  @{ ok = $false; error = [string]$message } | ConvertTo-Json -Depth 6 -Compress
  exit 1
}

function Get-Illustrator {
  try {
    # The running instance; this does not start one, by design — a research probe must never
    # silently launch an unlicensed-looking fresh install.
    return [Runtime.InteropServices.Marshal]::GetActiveObject('Illustrator.Application')
  } catch {
    Fail 'Illustrator is not running in this session. Start it in the VM first.'
  }
}

function Ai-Windows {
  Add-Type -AssemblyName UIAutomationClient -ErrorAction SilentlyContinue
  Get-Process -Name Illustrator -ErrorAction SilentlyContinue | ForEach-Object {
    $_.MainWindowTitle
    # Child windows (dialogs) do not show in MainWindowTitle, so ask the shell as well.
    try {
      $auto = [Windows.Automation.AutomationElement]::FromHandle($_.MainWindowHandle)
      $cond = New-Object Windows.Automation.PropertyCondition(
        [Windows.Automation.AutomationElement]::ControlTypeProperty,
        [Windows.Automation.ControlType]::Window)
      $auto.FindAll([Windows.Automation.TreeScope]::Children, $cond) | ForEach-Object { $_.Current.Name }
    } catch {}
  } | Where-Object { $_ } | Select-Object -Unique
}

switch ($Command) {

  'ping' {
    $ai = Get-Illustrator
    $titles = @(Ai-Windows)
    Reply @{
      ok        = $true
      version   = $ai.Version
      documents = $ai.Documents.Count
      windows   = $titles
      # A window other than the main one means something modal is waiting.
      modal     = ($titles | Where-Object { $_ -and $_ -notmatch '^Adobe Illustrator' }).Count -gt 0
      host      = $env:COMPUTERNAME
    }
  }

  'eval' {
    if (-not (Test-Path $ScriptFile)) { Fail "no such script: $ScriptFile" }
    try { $null = $ArgsJson | ConvertFrom-Json } catch { Fail "-ArgsJson is not valid JSON: $_" }

    $runId = [guid]::NewGuid().ToString('n').Substring(0, 12)
    $source = "var VS_ARGS = $ArgsJson;`r`n" + (Get-Content -Raw $ScriptFile)
    $jsx = Join-Path $StateDir "$runId.jsx"
    [IO.File]::WriteAllText($jsx, $source, (New-Object Text.UTF8Encoding $false))
    $out = Join-Path $StateDir "$runId.json"

    # The child outlives this SSH call. It is the child that blocks on a modal dialog, so the
    # call returns immediately and `windows`/`keys`/`screenshot` stay usable.
    $child = @"
`$ErrorActionPreference = 'Stop'
try {
  `$ai = [Runtime.InteropServices.Marshal]::GetActiveObject('Illustrator.Application')
  `$value = `$ai.DoJavaScriptFile('$jsx')
  @{ state = 'done'; result = [string]`$value } | ConvertTo-Json -Depth 12 | Set-Content -Encoding UTF8 '$out'
} catch {
  @{ state = 'failed'; error = `$_.Exception.Message } | ConvertTo-Json -Depth 6 | Set-Content -Encoding UTF8 '$out'
}
"@
    $childFile = Join-Path $StateDir "$runId.ps1"
    [IO.File]::WriteAllText($childFile, $child, (New-Object Text.UTF8Encoding $false))
    $p = Start-Process powershell -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', $childFile) -PassThru
    @{ pid = $p.Id; started = (Get-Date).ToString('o'); script = $ScriptFile; timeoutS = $TimeoutS } |
      ConvertTo-Json | Set-Content -Encoding UTF8 (Join-Path $StateDir "$runId.meta")
    Reply @{ ok = $true; id = $runId; pid = $p.Id }
  }

  'status' {
    if (-not $Id) { Fail 'status needs -Id' }
    $out = Join-Path $StateDir "$Id.json"
    $metaFile = Join-Path $StateDir "$Id.meta"
    if (-not (Test-Path $metaFile)) { Fail "unknown id: $Id" }
    if (Test-Path $out) {
      $r = Get-Content -Raw $out | ConvertFrom-Json
      $reply = @{ ok = $true; id = $Id; state = $r.state }
      if ($r.state -eq 'done') { $reply.result = $r.result } else { $reply.error = $r.error }
      Reply $reply
    }
    $meta = Get-Content -Raw $metaFile | ConvertFrom-Json
    $alive = [bool](Get-Process -Id $meta.pid -ErrorAction SilentlyContinue)
    $elapsed = ((Get-Date) - [datetime]::Parse($meta.started)).TotalSeconds
    if (-not $alive) { Reply @{ ok = $false; id = $Id; state = 'failed'; error = 'the eval process exited without writing a result' } }
    if ($elapsed -gt $meta.timeoutS) { Reply @{ ok = $false; id = $Id; state = 'failed'; error = "still running after $([int]$elapsed)s (timeout $($meta.timeoutS)s); cancel it" } }
    Reply @{ ok = $true; id = $Id; state = 'running'; elapsedS = [int]$elapsed; windows = @(Ai-Windows) }
  }

  'cancel' {
    if (-not $Id) { Fail 'cancel needs -Id' }
    $metaFile = Join-Path $StateDir "$Id.meta"
    if (-not (Test-Path $metaFile)) { Fail "unknown id: $Id" }
    $meta = Get-Content -Raw $metaFile | ConvertFrom-Json
    Stop-Process -Id $meta.pid -Force -ErrorAction SilentlyContinue
    @{ state = 'failed'; error = 'cancelled from the dev machine' } | ConvertTo-Json |
      Set-Content -Encoding UTF8 (Join-Path $StateDir "$Id.json")
    Reply @{ ok = $true; id = $Id; cancelled = $true }
  }

  'windows' {
    $null = Get-Illustrator
    Reply @{ ok = $true; windows = @(Ai-Windows) }
  }

  'keys' {
    if (-not $Send) { Fail 'keys needs -Send' }
    $ai = Get-Illustrator
    # Illustrator must be in front or the keys land somewhere else.
    try { $ai.Activate() } catch {}
    $proc = Get-Process -Name Illustrator -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($proc) {
      Add-Type -AssemblyName Microsoft.VisualBasic
      [Microsoft.VisualBasic.Interaction]::AppActivate($proc.Id)
    }
    Start-Sleep -Milliseconds 150
    Add-Type -AssemblyName System.Windows.Forms
    [Windows.Forms.SendKeys]::SendWait($Send)
    Reply @{ ok = $true; sent = $Send; windows = @(Ai-Windows) }
  }

  'screenshot' {
    Add-Type -AssemblyName System.Windows.Forms, System.Drawing
    $bounds = [Windows.Forms.Screen]::PrimaryScreen.Bounds
    $bmp = New-Object Drawing.Bitmap $bounds.Width, $bounds.Height
    $g = [Drawing.Graphics]::FromImage($bmp)
    $g.CopyFromScreen($bounds.Location, [Drawing.Point]::Empty, $bounds.Size)
    $ms = New-Object IO.MemoryStream
    $bmp.Save($ms, [Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose(); $bmp.Dispose()
    Reply @{ ok = $true; width = $bounds.Width; height = $bounds.Height; png = [Convert]::ToBase64String($ms.ToArray()) }
  }

  'stop' {
    $killed = 0
    Get-ChildItem -Path $StateDir -Filter '*.meta' -ErrorAction SilentlyContinue | ForEach-Object {
      $meta = Get-Content -Raw $_.FullName | ConvertFrom-Json
      if (Get-Process -Id $meta.pid -ErrorAction SilentlyContinue) {
        Stop-Process -Id $meta.pid -Force -ErrorAction SilentlyContinue
        $killed++
      }
    }
    Reply @{ ok = $true; killed = $killed }
  }
}
