<#
VectorSuite research bridge: a live connection to a LICENSED Illustrator in the
Windows VM, so a session can drive it interactively instead of dropping one
.jsx at a time into a folder and waiting (vs-agent.ps1).

Start it once per session, in the VM, with Illustrator open:

    powershell -ExecutionPolicy Bypass -File Z:\temp\vs-bridge.ps1

It reads Z:\temp\jobs\bridge.json -- written by the dev machine's
`node scripts/research/illustrator/bridge.mjs serve` -- dials the dev machine on
the port named there, presents the token, and then serves requests over that one
socket until told to stop, reconnecting on its own if the dev machine's server
restarts.

It dials OUT rather than listening, because the Windows guest sits behind the
container's NAT: nothing can be forwarded in without republishing the
container's ports, but the guest already routes outbound to the dev machine
(that is how it reaches the internet). So no port is opened on Windows and the
VM's plumbing is untouched.

Requests and responses are newline-delimited JSON, one object per line, UTF-8.
The operations:

  ping                     Illustrator version, document count, bridge uptime
  eval                     run ExtendScript (DoJavaScript) with a VS_ARGS header,
                           reporting an error instead of an empty result
  status, cancel           poll or abandon an eval that is still running
  com                      call the COM object model directly, by dotted path
  windows                  Illustrator's top-level windows, which finds dialogs
  activate                 bring Illustrator to the foreground
  keys                     SendKeys into it, to drive a modal dialog
  screenshot               PNG of a window or of the screen, base64
  stop                     shut the bridge down

Every eval runs in its own runspace AND this script never waits more than
$PollMs for one, so a script that opens a modal dialog blocks neither of them:
`windows`, `screenshot` and `keys` keep answering while it waits, and the dev
machine polls `status` until it finishes. That is what makes a dialog scriptable
at all, and it is the whole reason this exists -- with vs-agent.ps1 a menu
command that opens a dialog wedges the agent until someone dismisses it by
hand.

It runs only what the dev machine sends, and installs nothing. Stop it with
Ctrl+C, with a `stop` request, or by creating jobs\stop.
#>
param(
  # Written by the dev machine; holds the port, the token and the addresses to try.
  [string]$Endpoint = (Join-Path $PSScriptRoot 'jobs\bridge.json'),
  # Milliseconds between reconnect attempts, and per-address connect timeout.
  [int]$RetryMs = 2000,
  [int]$ConnectTimeoutMs = 1500,
  # The longest this script ever waits for a running eval before it answers. The
  # read loop must not block: see Wait-Eval.
  [int]$PollMs = 250
)

$ErrorActionPreference = 'Stop'
# Bumped whenever the wire contract changes, so a stale copy of this script
# still running in the VM is detected instead of silently failing. v2 renamed an
# eval's identifier to `evalId` and made the read loop non-blocking; v3 reports
# ExtendScript errors, which until then came back as success with no value; v4
# eval's the body instead of inlining it, so a script's last expression is still
# its result; v5 reports whether the VM's session is attached and falls back to
# PrintWindow for a window shot when it is not.
$PROTOCOL = 5

# Marks an ExtendScript error in a script's return value. DoJavaScript reports a
# failed script as an EMPTY return, which is indistinguishable from a script that
# returns nothing -- so a broken job looked like a successful one with no output.
# Wrap-Script catches the error inside the script and prefixes this instead.
$ERROR_MARK = 'VS_BRIDGE_ERROR:'

Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms

# Window enumeration, focus and screen capture. Written as C# rather than
# P/Invoke signatures in PowerShell because EnumWindows needs a delegate.
Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;

namespace VSBridge {
  public class WinInfo {
    public long Handle; public int Pid; public string Title; public string Class;
    public int X; public int Y; public int Width; public int Height;
    public bool Visible; public bool Enabled; public bool Minimized; public long Owner;
  }

  public static class Win {
    private delegate bool EnumProc(IntPtr hWnd, IntPtr lParam);
    [DllImport("user32.dll")] private static extern bool EnumWindows(EnumProc cb, IntPtr p);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern int GetWindowTextW(IntPtr h, StringBuilder s, int max);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern int GetClassNameW(IntPtr h, StringBuilder s, int max);
    [DllImport("user32.dll")] private static extern bool GetWindowRect(IntPtr h, out RECT r);
    [DllImport("user32.dll")] private static extern bool IsWindowVisible(IntPtr h);
    [DllImport("user32.dll")] private static extern bool IsWindowEnabled(IntPtr h);
    [DllImport("user32.dll")] private static extern bool IsIconic(IntPtr h);
    [DllImport("user32.dll")] private static extern IntPtr GetWindow(IntPtr h, uint cmd);
    [DllImport("user32.dll")] private static extern int GetWindowThreadProcessId(IntPtr h, out int pid);
    [DllImport("user32.dll")] private static extern bool SetForegroundWindow(IntPtr h);
    [DllImport("user32.dll")] private static extern bool ShowWindow(IntPtr h, int cmd);
    [DllImport("user32.dll")] private static extern bool BringWindowToTop(IntPtr h);
    [DllImport("user32.dll")] private static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] private static extern bool AttachThreadInput(int from, int to, bool attach);
    [DllImport("kernel32.dll")] private static extern int GetCurrentThreadId();

    [StructLayout(LayoutKind.Sequential)] private struct RECT { public int Left, Top, Right, Bottom; }
    private const uint GW_OWNER = 4;
    private const int SW_RESTORE = 9;

    private static string Text(IntPtr h) {
      StringBuilder sb = new StringBuilder(512);
      GetWindowTextW(h, sb, sb.Capacity);
      return sb.ToString();
    }

    /// Every top-level window of the given process (0 = all processes).
    public static List<WinInfo> Windows(int pid) {
      List<WinInfo> found = new List<WinInfo>();
      EnumWindows(delegate(IntPtr h, IntPtr p) {
        int wpid; GetWindowThreadProcessId(h, out wpid);
        if (pid != 0 && wpid != pid) return true;
        RECT r; GetWindowRect(h, out r);
        StringBuilder cls = new StringBuilder(256);
        GetClassNameW(h, cls, cls.Capacity);
        found.Add(new WinInfo {
          Handle = h.ToInt64(), Pid = wpid, Title = Text(h), Class = cls.ToString(),
          X = r.Left, Y = r.Top, Width = r.Right - r.Left, Height = r.Bottom - r.Top,
          Visible = IsWindowVisible(h), Enabled = IsWindowEnabled(h), Minimized = IsIconic(h),
          Owner = GetWindow(h, GW_OWNER).ToInt64()
        });
        return true;
      }, IntPtr.Zero);
      return found;
    }

    /// Focus a window. Attaching to its input thread is what makes
    /// SetForegroundWindow work when we are not already the active process.
    public static bool Activate(long handle) {
      IntPtr h = new IntPtr(handle);
      if (IsIconic(h)) ShowWindow(h, SW_RESTORE);
      int target; GetWindowThreadProcessId(h, out target);
      int mine = GetCurrentThreadId();
      AttachThreadInput(mine, target, true);
      BringWindowToTop(h);
      bool ok = SetForegroundWindow(h);
      AttachThreadInput(mine, target, false);
      return ok || GetForegroundWindow() == h;
    }

    public static long Foreground() { return GetForegroundWindow().ToInt64(); }

    [DllImport("user32.dll")] private static extern bool PrintWindow(IntPtr h, IntPtr hdc, uint flags);
    private const uint PW_RENDERFULLCONTENT = 2;

    /// True when something has keyboard focus, which it does not when the VM's
    /// session is detached (nobody attached over RDP). Screen capture and
    /// SendKeys both need an attached session, so this is what to check first
    /// when either fails.
    public static bool SessionAttached() { return GetForegroundWindow() != IntPtr.Zero; }

    /// PNG of a window, asking it to render itself rather than copying the
    /// screen. Works with the session detached, when CopyFromScreen cannot,
    /// but a window that draws through the GPU can come back blank.
    public static byte[] PrintWindowPng(long handle) {
      RECT r; GetWindowRect(new IntPtr(handle), out r);
      int w = r.Right - r.Left, h = r.Bottom - r.Top;
      if (w <= 0 || h <= 0) throw new Exception("window has no area");
      using (Bitmap bmp = new Bitmap(w, h, PixelFormat.Format32bppArgb)) {
        using (Graphics g = Graphics.FromImage(bmp)) {
          IntPtr hdc = g.GetHdc();
          try {
            if (!PrintWindow(new IntPtr(handle), hdc, PW_RENDERFULLCONTENT)) throw new Exception("PrintWindow refused");
          } finally { g.ReleaseHdc(hdc); }
        }
        using (MemoryStream ms = new MemoryStream()) {
          bmp.Save(ms, ImageFormat.Png);
          return ms.ToArray();
        }
      }
    }

    /// PNG of a window's on-screen rectangle, or of the whole virtual screen
    /// when handle is 0. CopyFromScreen is used rather than PrintWindow so that
    /// what comes back is what is actually on screen, dialog and all.
    public static byte[] CapturePng(long handle) {
      Rectangle box;
      if (handle == 0) {
        box = System.Windows.Forms.SystemInformation.VirtualScreen;
      } else {
        RECT r; GetWindowRect(new IntPtr(handle), out r);
        box = new Rectangle(r.Left, r.Top, r.Right - r.Left, r.Bottom - r.Top);
      }
      if (box.Width <= 0 || box.Height <= 0) throw new Exception("window has no area on screen");
      using (Bitmap bmp = new Bitmap(box.Width, box.Height, PixelFormat.Format32bppArgb)) {
        using (Graphics g = Graphics.FromImage(bmp)) g.CopyFromScreen(box.Left, box.Top, 0, 0, box.Size);
        using (MemoryStream ms = new MemoryStream()) {
          bmp.Save(ms, ImageFormat.Png);
          return ms.ToArray();
        }
      }
    }
  }
}
'@ -ReferencedAssemblies System.Drawing, System.Windows.Forms

$started = Get-Date
$stopFile = Join-Path (Split-Path -Parent $Endpoint) 'stop'
$jobs = @{}       # eval id -> @{ ps, handle, runspace, started, source }
$nextJobId = 1

function Write-Log([string]$text) {
  Write-Host ("{0}  {1}" -f (Get-Date).ToString('HH:mm:ss'), $text)
}

function Get-Illustrator {
  try { return [Runtime.InteropServices.Marshal]::GetActiveObject('Illustrator.Application') }
  catch { return New-Object -ComObject 'Illustrator.Application' }
}

function Get-IllustratorPid {
  $p = Get-Process -Name 'Illustrator' -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($p) { return $p.Id }
  return 0
}

# --- ExtendScript, each run in its own runspace -------------------------------
#
# A runspace per eval is the point of the whole bridge: DoJavaScript does not
# return while a modal dialog is up, so running it on the socket thread would
# stop the bridge answering until someone clicked the dialog. Here it blocks a
# throwaway thread instead and `windows`, `screenshot` and `keys` still work.

# Builds the source actually handed to DoJavaScript: any preprocessor
# directives, then the VS_ARGS header, then the body wrapped so that an error
# comes back as a value we can recognise.
function Wrap-Script([string]$argsJson, [string]$source) {
  # #target, #include and friends are read before the script is parsed and have
  # to precede any code, so they are hoisted rather than wrapped.
  $directives = New-Object System.Collections.Generic.List[string]
  $body = New-Object System.Collections.Generic.List[string]
  foreach ($line in ($source -split "`r?`n")) {
    if ($line -match '^\s*#\s*(target|include|includepath|engine|strict|script|scriptname)\b') { $directives.Add($line) }
    else { $body.Add($line) }
  }

  $text = ''
  if ($directives.Count -gt 0) { $text += ($directives -join "`r`n") + "`r`n" }
  if ($argsJson) { $text += "var VS_ARGS = $argsJson;`r`n" }

  # The body is eval'd rather than inlined into the function, so that the
  # script's last expression is still its result. Every job script in this repo
  # is a self-wrapped IIFE ending `})();` and depends on that; inlining the body
  # in a function body instead -- which looks equivalent -- made all of them
  # return undefined, because a function needs an explicit `return`. Three things
  # were confirmed against the licensed 30.1 before settling on this: eval hands
  # back an IIFE's value, it hands back the completion value of a multi-statement
  # body, and a direct eval still sees VS_ARGS in the enclosing scope. Error line
  # numbers stay the body's own, too.
  $literal = ($body -join "`r`n") | ConvertTo-Json -Compress
  $text += "(function () { try { return eval($literal); }"
  $text += " catch (vsError) { return '$ERROR_MARK' + vsError.toString()"
  $text += " + (vsError.line ? ' (line ' + vsError.line + ')' : ''); } })()`r`n"
  return $text
}

function Start-Eval([string]$source) {
  $rs = [runspacefactory]::CreateRunspace()
  $rs.ApartmentState = 'STA'
  $rs.ThreadOptions = 'ReuseThread'
  $rs.Open()
  $ps = [powershell]::Create()
  $ps.Runspace = $rs
  [void]$ps.AddScript({
    param($src)
    $app = [Runtime.InteropServices.Marshal]::GetActiveObject('Illustrator.Application')
    [string]$app.DoJavaScript($src)
  }).AddArgument($source)
  $id = $script:nextJobId
  $script:nextJobId++
  $jobs[$id] = @{ ps = $ps; handle = $ps.BeginInvoke(); runspace = $rs; started = Get-Date; source = $source }
  return $id
}

function Complete-Eval([int]$id) {
  $job = $jobs[$id]
  $secs = [math]::Round(((Get-Date) - $job.started).TotalSeconds, 2)
  try {
    $out = $job.ps.EndInvoke($job.handle)
    $value = if ($out -and $out.Count -gt 0) { [string]$out[0] } else { '' }
    if ($value.StartsWith($ERROR_MARK)) {
      $result = @{ ok = $false; evalId = $id; done = $true; seconds = $secs; error = $value.Substring($ERROR_MARK.Length) }
    } else {
      $result = @{ ok = $true; evalId = $id; done = $true; seconds = $secs; value = $value }
    }
  } catch {
    # An ExtendScript error arrives as a COM exception; its message is the
    # script's error text, which is what we want to report.
    $result = @{ ok = $false; evalId = $id; done = $true; seconds = $secs; error = $_.Exception.Message }
  }
  $job.ps.Dispose()
  $job.runspace.Dispose()
  $jobs.Remove($id)
  return $result
}

# Waits one short slice only, never the caller's whole budget.
#
# The read loop is single-threaded, so whatever this blocks on blocks the whole
# bridge -- which was the flaw the first version shipped with: a synchronous eval
# left `windows`, `screenshot` and `keys` unanswerable, exactly the wedge
# vs-agent.ps1 suffers from. So the dev machine owns the deadline and polls with
# `status`, and this answers within $PollMs whatever happens. A quick script
# finishes inside the first slice and so still costs one round trip.
function Wait-Eval([int]$id) {
  $job = $jobs[$id]
  if ($job.handle.AsyncWaitHandle.WaitOne($PollMs)) { return Complete-Eval $id }
  # Still running -- very often a modal dialog, so name any that are up: the
  # caller can photograph it and type into it now, then poll again.
  #
  # `evalId`, never `id`: `id` is the request's correlation number, and a result
  # that carried its own `id` would overwrite it when the response is assembled,
  # leaving the dev machine waiting for a reply it could no longer recognise.
  return @{
    ok = $true; evalId = $id; done = $false; pending = $true
    seconds = [math]::Round(((Get-Date) - $job.started).TotalSeconds, 2)
    dialogs = @(Get-DialogWindows | ForEach-Object { $_.title })
  }
}

# --- Windows and dialogs ------------------------------------------------------

function Get-AllWindows {
  # Not $pid: that is a read-only automatic variable (this process).
  $aiPid = Get-IllustratorPid
  if ($aiPid -eq 0) { return @() }
  $fg = [VSBridge.Win]::Foreground()
  return @([VSBridge.Win]::Windows($aiPid) | Where-Object { $_.Visible -and $_.Width -gt 0 } | ForEach-Object {
    @{
      handle = $_.Handle; title = $_.Title; class = $_.Class
      x = $_.X; y = $_.Y; width = $_.Width; height = $_.Height
      enabled = $_.Enabled; minimized = $_.Minimized; owner = $_.Owner
      foreground = ($_.Handle -eq $fg)
      owned = ($_.Owner -ne 0)
    }
  })
}

function Select-MainWindow($all) {
  $all | Where-Object { -not $_.owned -and $_.title } | Sort-Object { -($_.width * $_.height) } | Select-Object -First 1
}

function Get-MainWindow { Select-MainWindow (Get-AllWindows) }

# A modal dialog is up exactly when Illustrator's main window is disabled.
# Testing for an owned window is not enough on its own: every floating panel is
# owned too, so that alone reports a dialog whenever a panel is undocked.
function Get-DialogWindows {
  $all = @(Get-AllWindows)
  $main = Select-MainWindow $all
  if (-not $main -or $main.enabled) { return @() }
  return @($all | Where-Object { $_.owned -and $_.enabled -and $_.title -and $_.width -gt 100 })
}

# --- The COM object model, by dotted path ------------------------------------
#
# `com` reaches the same object model ExtendScript sees, but from outside
# Illustrator, so it answers while a dialog is up and needs no script at all.
# Only a name path is accepted -- no expressions -- so a request cannot smuggle
# PowerShell in.

function Resolve-ComPath($root, [string]$path) {
  $current = $root
  if (-not $path) { return $current }
  foreach ($step in $path.Split('.')) {
    if ($step -notmatch '^[A-Za-z_][A-Za-z0-9_]*(\[[0-9]+\])?$') { throw "bad path step '$step'" }
    $index = $null
    if ($step -match '^(.*)\[([0-9]+)\]$') { $step = $Matches[1]; $index = [int]$Matches[2] }
    $current = $current.$step
    if ($null -ne $index) { $current = $current.Item($index) }
  }
  return $current
}

function Invoke-Com($request) {
  $app = Get-Illustrator
  $target = Resolve-ComPath $app ([string]$request.path)
  if ($request.method) {
    $callArgs = @()
    if ($request.args) { $callArgs = @($request.args) }
    $value = $target.GetType().InvokeMember([string]$request.method, 'InvokeMethod', $null, $target, $callArgs)
  } else {
    $value = $target
  }
  # COM objects don't serialise; report what we can describe instead.
  if ($null -eq $value) { return $null }
  if ($value -is [string] -or $value -is [bool] -or $value -is [int] -or $value -is [double] -or $value -is [long]) { return $value }
  return @{ type = $value.GetType().FullName; text = [string]$value }
}

# --- Request dispatch --------------------------------------------------------

function Invoke-Request($request) {
  switch ([string]$request.op) {
    'ping' {
      $app = Get-Illustrator
      $main = Get-MainWindow
      return @{
        ok = $true; protocol = $PROTOCOL
        illustrator = [string]$app.Version
        documents = [int]$app.Documents.Count
        activeDocument = if ($app.Documents.Count -gt 0) { [string]$app.ActiveDocument.Name } else { $null }
        dialogs = @(Get-DialogWindows | ForEach-Object { $_.title })
        mainWindow = $main
        uptimeSeconds = [math]::Round(((Get-Date) - $started).TotalSeconds, 1)
        pendingEvals = @($jobs.Keys)
        # False means keys and screenshots will not work: nothing is attached to
        # the VM's desktop.
        sessionAttached = [VSBridge.Win]::SessionAttached()
      }
    }
    'eval' {
      # Same VS_ARGS header the .jsx job scripts already expect, so an existing
      # job runs here unchanged.
      $source = Wrap-Script ([string]$request.argsJson) ([string]$request.source)
      $id = Start-Eval $source
      $result = Wait-Eval $id
      $result['started'] = $true
      return $result
    }
    'status' {
      $id = [int]$request.evalId
      if (-not $jobs.ContainsKey($id)) { return @{ ok = $false; error = "no eval $id (already collected?)" } }
      return Wait-Eval $id
    }
    'cancel' {
      $id = [int]$request.evalId
      if (-not $jobs.ContainsKey($id)) { return @{ ok = $false; error = "no eval $id" } }
      $job = $jobs[$id]
      # Stop() cannot interrupt a COM call that is blocked on a dialog; it only
      # abandons our side. The dialog still has to be dismissed.
      try { $job.ps.Stop() } catch {}
      try { $job.ps.Dispose(); $job.runspace.Dispose() } catch {}
      $jobs.Remove($id)
      return @{ ok = $true; evalId = $id; cancelled = $true }
    }
    'com' { return @{ ok = $true; value = (Invoke-Com $request) } }
    'windows' {
      $all = @(Get-AllWindows)
      $main = Select-MainWindow $all
      return @{
        ok = $true; windows = $all
        sessionAttached = [VSBridge.Win]::SessionAttached()
        modal = [bool]($main -and -not $main.enabled)
        dialogs = @(Get-DialogWindows | ForEach-Object { $_.title })
      }
    }
    'activate' {
      $handle = 0
      if ($request.handle) { $handle = [long]$request.handle }
      if ($handle -eq 0) {
        $dialog = @(Get-DialogWindows) | Select-Object -First 1
        $target = if ($dialog) { $dialog } else { Get-MainWindow }
        if (-not $target) { return @{ ok = $false; error = 'Illustrator has no visible window' } }
        $handle = $target.handle
      }
      $ok = [VSBridge.Win]::Activate($handle)
      Start-Sleep -Milliseconds 150
      $result = @{ ok = $ok; handle = $handle; foreground = [VSBridge.Win]::Foreground(); sessionAttached = [VSBridge.Win]::SessionAttached() }
      if (-not $ok -and -not $result.sessionAttached) {
        # Nothing at all has focus, so this is not about which window: Windows
        # has no interactive session. SendKeys cannot work either until one is.
        $result['error'] = 'the VM session looks detached (nothing has keyboard focus), so no window can be focused and SendKeys will not arrive. Open the WinBoat window and try again.'
      }
      return $result
    }
    'keys' {
      # SendKeys goes to whatever has focus, so focus first unless told not to.
      if ($request.activate -ne $false) {
        $r = Invoke-Request @{ op = 'activate'; handle = $request.handle }
        if (-not $r.ok) { return @{ ok = $false; error = "could not focus a window: $($r.error)"; sessionAttached = $r.sessionAttached } }
      }
      $delay = 40
      if ($request.delayMs) { $delay = [int]$request.delayMs }
      $sent = @()
      foreach ($chunk in @($request.keys)) {
        [System.Windows.Forms.SendKeys]::SendWait([string]$chunk)
        $sent += [string]$chunk
        Start-Sleep -Milliseconds $delay
      }
      return @{ ok = $true; sent = $sent; foreground = [VSBridge.Win]::Foreground() }
    }
    'screenshot' {
      $handle = 0
      if ($request.handle) { $handle = [long]$request.handle }
      if ($request.what -eq 'dialog') {
        $dialog = @(Get-DialogWindows) | Select-Object -First 1
        if (-not $dialog) { return @{ ok = $false; error = 'no dialog is open' } }
        $handle = $dialog.handle
      } elseif ($request.what -eq 'main') {
        $main = Get-MainWindow
        if (-not $main) { return @{ ok = $false; error = 'Illustrator has no visible window' } }
        $handle = $main.handle
      }
      $attached = [VSBridge.Win]::SessionAttached()
      $method = 'screen'
      try {
        $png = [VSBridge.Win]::CapturePng($handle)
      } catch {
        # CopyFromScreen fails with "The handle is invalid" when the VM's session
        # is detached: there is no desktop to copy from. Ask the window to draw
        # itself instead, which needs no session -- though a GPU-drawn window can
        # come back blank, and the whole screen cannot be had this way at all.
        if ($handle -eq 0) {
          return @{
            ok = $false
            error = "cannot capture the screen: $($_.Exception.Message)" + $(if (-not $attached) { ' -- the VM session looks detached (nothing has keyboard focus). Open the WinBoat window so Windows has a desktop to draw, or ask for --what main/dialog, which can fall back to asking the window to render itself.' } else { '' })
            sessionAttached = $attached
          }
        }
        try {
          $png = [VSBridge.Win]::PrintWindowPng($handle)
          $method = 'printwindow'
        } catch {
          return @{
            ok = $false
            error = "cannot capture window ${handle}: $($_.Exception.Message)" + $(if (-not $attached) { ' -- and the VM session looks detached (nothing has keyboard focus); open the WinBoat window and try again.' } else { '' })
            sessionAttached = $attached
          }
        }
      }
      return @{
        ok = $true; handle = $handle; format = 'png'; method = $method
        sessionAttached = $attached; bytes = $png.Length; base64 = [Convert]::ToBase64String($png)
      }
    }
    'stop' { $script:stopping = $true; return @{ ok = $true; stopping = $true } }
    default { return @{ ok = $false; error = "unknown op '$($request.op)'" } }
  }
}

# --- Connect and serve -------------------------------------------------------

function Connect-DevMachine($config) {
  foreach ($address in @($config.candidates)) {
    $client = New-Object System.Net.Sockets.TcpClient
    try {
      $async = $client.BeginConnect([string]$address, [int]$config.port, $null, $null)
      if ($async.AsyncWaitHandle.WaitOne($ConnectTimeoutMs) -and $client.Connected) {
        $client.EndConnect($async)
        $client.NoDelay = $true
        Write-Log "connected to ${address}:$($config.port)"
        return $client
      }
      $client.Close()
    } catch {
      try { $client.Close() } catch {}
    }
  }
  return $null
}

$script:stopping = $false
Write-Log "bridge starting; endpoint file $Endpoint"
if (Test-Path $stopFile) { Remove-Item $stopFile }

while (-not $script:stopping -and -not (Test-Path $stopFile)) {
  if (-not (Test-Path $Endpoint)) {
    Write-Log "waiting for $Endpoint (run 'bridge.mjs serve' on the dev machine)"
    Start-Sleep -Milliseconds $RetryMs
    continue
  }
  $config = Get-Content -Path $Endpoint -Raw -Encoding UTF8 | ConvertFrom-Json
  $client = Connect-DevMachine $config
  if (-not $client) {
    Write-Log "no answer on port $($config.port) from any of: $($config.candidates -join ', ')"
    Start-Sleep -Milliseconds $RetryMs
    continue
  }

  try {
    $stream = $client.GetStream()
    $encoding = New-Object System.Text.UTF8Encoding($false)
    $reader = New-Object System.IO.StreamReader($stream, $encoding)
    $writer = New-Object System.IO.StreamWriter($stream, $encoding)
    $writer.AutoFlush = $true

    $app = Get-Illustrator
    $hello = @{
      type = 'hello'; protocol = $PROTOCOL; token = [string]$config.token
      illustrator = [string]$app.Version
      computer = $env:COMPUTERNAME; user = $env:USERNAME
      pid = $PID; illustratorPid = (Get-IllustratorPid)
      started = $started.ToString('o')
    }
    $writer.WriteLine(($hello | ConvertTo-Json -Compress -Depth 6))

    while (-not $script:stopping -and -not (Test-Path $stopFile)) {
      $line = $reader.ReadLine()
      if ($null -eq $line) { Write-Log 'dev machine closed the connection'; break }
      if (-not $line.Trim()) { continue }
      $request = $null
      try { $request = $line | ConvertFrom-Json } catch {
        $writer.WriteLine((@{ type = 'response'; id = 0; ok = $false; error = "unparseable request: $($_.Exception.Message)" } | ConvertTo-Json -Compress))
        continue
      }
      $id = 0
      if ($request.id) { $id = [int]$request.id }
      Write-Log "op $($request.op) (#$id)"
      try {
        $result = Invoke-Request $request
      } catch {
        $result = @{ ok = $false; error = $_.Exception.Message }
      }
      # The envelope is written last, so no result key can shadow the
      # correlation id however an op is changed later.
      $response = @{}
      foreach ($key in $result.Keys) { $response[$key] = $result[$key] }
      $response['type'] = 'response'
      $response['id'] = $id
      # Depth 12: `windows` nests, and a screenshot's base64 is one long string.
      $writer.WriteLine(($response | ConvertTo-Json -Compress -Depth 12))
    }
  } catch {
    Write-Log "connection error: $($_.Exception.Message)"
  } finally {
    try { $client.Close() } catch {}
  }
  if (-not $script:stopping) { Start-Sleep -Milliseconds $RetryMs }
}

foreach ($id in @($jobs.Keys)) {
  try { $jobs[$id].ps.Dispose(); $jobs[$id].runspace.Dispose() } catch {}
}
Remove-Item $stopFile -ErrorAction SilentlyContinue
Write-Log 'bridge stopped'
