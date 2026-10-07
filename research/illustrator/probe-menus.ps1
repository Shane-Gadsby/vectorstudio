<#
VectorSuite research probe: capture Illustrator 30.1's menu structure (v2).

RESULT ON ILLUSTRATOR 30.1 (Windows 10, 2026-09-24): NO MENUS CAN BE READ THIS
WAY. Illustrator's UI is drawn by Adobe's own framework (DroverLord / OWL
window classes): none of its 149 windows owns a Win32 menu, and UI Automation
sees the frame as a single element with no children (Adobe documents only
JAWS mouse-echo support on Windows). The probe is kept as a diagnostic, since
its window and UI Automation dump shows at once whether a later version
changes this.

Run on Windows while a LICENSED Illustrator 30.1 is open with a document open
and nothing selected:

    powershell -ExecutionPolicy Bypass -File Z:\temp\vs-probe-menus.ps1

It writes vs-probe-menus.json next to itself.

Every run records DIAGNOSTICS (read-only): each top-level window of the
Illustrator process (class, title, visibility, native menu or not) and an
outline of each window's UI Automation tree (control type, name, class,
automation id, supported patterns; -OutlineDepth levels). v1 found no menu bar
in the window .NET reports as the main window, so v2 looks everywhere:

1. Win32: GetMenu on EVERY top-level window of the process. On a hit it reads
   the tree with GetMenuString / GetSubMenu, sending WM_INITMENUPOPUP (what
   Windows sends before a menu opens) so lazily built submenus fill in, then
   WM_UNINITMENUPOPUP. Nothing is shown and no command runs.
2. UI Automation: a MenuBar element in any of those windows, or failing that
   the element whose children are named File, Edit, Object, Type, Select ...
   Menus are opened and closed with the ExpandCollapse pattern only (you will
   see them flash). A menu item is NEVER invoked.

Long dynamic lists (fonts, recent files) are cut at -MaxItems entries.
#>
param(
  [string]$OutFile = (Join-Path $PSScriptRoot 'vs-probe-menus.json'),
  [int]$MaxItems = 400,
  [int]$MaxDepth = 8,
  [int]$OutlineDepth = 5,
  [int]$OutlineMaxNodes = 1500
)

$ErrorActionPreference = 'Stop'
$errors = New-Object System.Collections.Generic.List[string]
$notes = New-Object System.Collections.Generic.List[string]

Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Text;
using System.Runtime.InteropServices;
public static class VsWin {
  public delegate bool EnumProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc cb, IntPtr lParam);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr hWnd, StringBuilder sb, int n);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr hWnd, StringBuilder sb, int n);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern IntPtr GetMenu(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern int GetMenuItemCount(IntPtr hMenu);
  [DllImport("user32.dll")] public static extern IntPtr GetSubMenu(IntPtr hMenu, int nPos);
  [DllImport("user32.dll")] public static extern uint GetMenuState(IntPtr hMenu, uint uId, uint uFlags);
  [DllImport("user32.dll")] public static extern uint GetMenuItemID(IntPtr hMenu, int nPos);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  static extern int GetMenuString(IntPtr hMenu, uint uIDItem, StringBuilder lpString, int cchMax, uint flags);
  [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam);
  public static List<IntPtr> TopWindows(uint pid) {
    var list = new List<IntPtr>();
    EnumWindows((h, l) => { uint p; GetWindowThreadProcessId(h, out p); if (p == pid) list.Add(h); return true; }, IntPtr.Zero);
    return list;
  }
  public static string ClassName(IntPtr h) { var sb = new StringBuilder(256); GetClassName(h, sb, sb.Capacity); return sb.ToString(); }
  public static string Title(IntPtr h) { var sb = new StringBuilder(512); GetWindowText(h, sb, sb.Capacity); return sb.ToString(); }
  public static string MenuText(IntPtr hMenu, int pos) {
    var sb = new StringBuilder(512); GetMenuString(hMenu, (uint)pos, sb, sb.Capacity, 0x400); return sb.ToString();
  }
}
'@
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes
$AE = [System.Windows.Automation.AutomationElement]
$CT = [System.Windows.Automation.ControlType]
$Scope = [System.Windows.Automation.TreeScope]
$ECP = [System.Windows.Automation.ExpandCollapsePattern]

$MF_BYPOSITION = 0x400; $MF_GRAYED = 0x1; $MF_DISABLED = 0x2; $MF_CHECKED = 0x8; $MF_OWNERDRAW = 0x100; $MF_SEPARATOR = 0x800
$WM_INITMENUPOPUP = 0x0117; $WM_UNINITMENUPOPUP = 0x0125
$TOP_NAMES = @('File', 'Edit', 'Object', 'Type', 'Select', 'Effect', 'View', 'Window', 'Help')

$procs = @(Get-Process -Name 'Illustrator' -ErrorAction SilentlyContinue)
if (-not $procs.Count) { throw 'Illustrator is not running.' }
$proc = $procs | Where-Object { $_.MainWindowHandle -ne [IntPtr]::Zero } | Select-Object -First 1
if (-not $proc) { $proc = $procs[0] }

function Split-Label([string]$raw) {
  $parts = $raw -split "`t", 2
  $escaped = [string][char]1  # stands in for a literal "&&" while mnemonic "&"s are removed (works in PowerShell 5.1)
  $label = ($parts[0].Replace('&&', $escaped).Replace('&', '').Replace($escaped, '&')).Trim()
  $shortcut = if ($parts.Count -gt 1) { $parts[1].Trim() } else { '' }
  return @($label, $shortcut)
}

# ---------- diagnostics: windows ----------
$windows = New-Object System.Collections.Generic.List[object]
foreach ($p in $procs) {
  foreach ($h in [VsWin]::TopWindows([uint32]$p.Id)) {
    $menu = [VsWin]::GetMenu($h)
    $windows.Add([ordered]@{
      pid = $p.Id; hwnd = ('0x{0:X}' -f $h.ToInt64()); className = [VsWin]::ClassName($h); title = [VsWin]::Title($h)
      visible = [VsWin]::IsWindowVisible($h); isMainWindow = ($h -eq $p.MainWindowHandle)
      hasMenu = ($menu -ne [IntPtr]::Zero); menuItemCount = $(if ($menu -ne [IntPtr]::Zero) { [VsWin]::GetMenuItemCount($menu) } else { 0 })
      handle = $h
    })
  }
}

# ---------- diagnostics: UI Automation outline ----------
$script:outlineNodes = 0
function Get-Patterns($el) {
  try { return @($el.GetSupportedPatterns() | ForEach-Object { $_.ProgrammaticName -replace 'Identifiers\.Pattern$', '' -replace 'Pattern$', '' }) } catch { return @() }
}
function Get-Outline($el, [int]$depth) {
  $script:outlineNodes++
  $c = $el.Current
  $node = [ordered]@{ type = $c.ControlType.ProgrammaticName -replace '^ControlType\.', ''; name = $c.Name; className = $c.ClassName; automationId = $c.AutomationId; patterns = (Get-Patterns $el) }
  if ($depth -lt $OutlineDepth -and $script:outlineNodes -lt $OutlineMaxNodes) {
    $kids = New-Object System.Collections.Generic.List[object]
    $walker = [System.Windows.Automation.TreeWalker]::RawViewWalker
    $child = $walker.GetFirstChild($el)
    while ($child -and $script:outlineNodes -lt $OutlineMaxNodes) {
      $kids.Add((Get-Outline $child ($depth + 1)))
      $child = $walker.GetNextSibling($child)
    }
    if ($kids.Count) { $node.children = $kids }
  }
  return $node
}
$outline = New-Object System.Collections.Generic.List[object]
foreach ($w in $windows | Where-Object { $_.visible }) {
  try { $outline.Add([ordered]@{ hwnd = $w.hwnd; tree = (Get-Outline ($AE::FromHandle($w.handle)) 0) }) }
  catch { $errors.Add("outline $($w.hwnd): $($_.Exception.Message)") }
}

# ---------- 1. Win32 menus on any window ----------
$visited = New-Object 'System.Collections.Generic.HashSet[long]'
function Read-Win32Menu([IntPtr]$owner, [IntPtr]$hMenu, [int]$depth) {
  $items = New-Object System.Collections.Generic.List[object]
  if ($depth -gt $MaxDepth -or -not $visited.Add($hMenu.ToInt64())) { return ,$items }
  $count = [VsWin]::GetMenuItemCount($hMenu)
  for ($i = 0; $i -lt $count; $i++) {
    if ($items.Count -ge $MaxItems) { $items.Add([ordered]@{ truncated = $true; total = $count }); break }
    $state = [VsWin]::GetMenuState($hMenu, [uint32]$i, $MF_BYPOSITION)
    if ($state -band $MF_SEPARATOR) { $items.Add([ordered]@{ separator = $true }); continue }
    $label, $shortcut = Split-Label ([VsWin]::MenuText($hMenu, $i))
    $node = [ordered]@{ text = $label; shortcut = $shortcut
      enabled = -not (($state -band $MF_GRAYED) -or ($state -band $MF_DISABLED)); checked = [bool]($state -band $MF_CHECKED); ownerDraw = [bool]($state -band $MF_OWNERDRAW) }
    $sub = [VsWin]::GetSubMenu($hMenu, $i)
    if ($sub -ne [IntPtr]::Zero) {
      try {
        [void][VsWin]::SendMessage($owner, $WM_INITMENUPOPUP, $sub, [IntPtr]$i)
        $node.children = Read-Win32Menu $owner $sub ($depth + 1)
        [void][VsWin]::SendMessage($owner, $WM_UNINITMENUPOPUP, $sub, [IntPtr]::Zero)
      } catch { $errors.Add("win32 submenu '$label': $($_.Exception.Message)") }
    } else { $node.id = [VsWin]::GetMenuItemID($hMenu, $i) }
    $items.Add($node)
  }
  return ,$items
}

$method = $null
$menus = $null
foreach ($w in $windows | Where-Object { $_.hasMenu } | Sort-Object { -$_.menuItemCount }) {
  $candidate = Read-Win32Menu $w.handle ([VsWin]::GetMenu($w.handle)) 1
  $readable = @($candidate | Where-Object { $_.text }).Count
  if ($readable -ge 5) { $menus = $candidate; $method = "win32 ($($w.className) $($w.hwnd))"; break }
  $notes.Add("win32: window $($w.hwnd) ($($w.className)) has a menu with only $readable readable items")
}

# ---------- 2. UI Automation ----------
function Find-MenuBar {
  foreach ($w in $windows | Where-Object { $_.visible }) {
    $root = $AE::FromHandle($w.handle)
    $bar = $root.FindFirst($Scope::Descendants, (New-Object System.Windows.Automation.PropertyCondition($AE::ControlTypeProperty, $CT::MenuBar)))
    if ($bar) { $notes.Add("uia: MenuBar found in $($w.hwnd)"); return $bar }
  }
  # No MenuBar: find an element whose children include most of File, Edit, Object ...
  foreach ($w in $windows | Where-Object { $_.visible }) {
    $root = $AE::FromHandle($w.handle)
    $files = $root.FindAll($Scope::Descendants, (New-Object System.Windows.Automation.PropertyCondition($AE::NameProperty, 'File')))
    foreach ($f in $files) {
      $parent = [System.Windows.Automation.TreeWalker]::RawViewWalker.GetParent($f)
      if (-not $parent) { continue }
      $names = @($parent.FindAll($Scope::Children, [System.Windows.Automation.Condition]::TrueCondition) | ForEach-Object { $_.Current.Name })
      $hits = @($TOP_NAMES | Where-Object { $names -contains $_ }).Count
      if ($hits -ge 6) { $notes.Add("uia: menu-like container '$($parent.Current.ControlType.ProgrammaticName)' '$($parent.Current.ClassName)' in $($w.hwnd)"); return $parent }
    }
  }
  return $null
}

function Read-UiaItem($item, [int]$depth) {
  $c = $item.Current
  $node = [ordered]@{ text = $c.Name; shortcut = $c.AcceleratorKey; enabled = $c.IsEnabled; type = ($c.ControlType.ProgrammaticName -replace '^ControlType\.', '') }
  $pattern = $null
  if ($depth -le $MaxDepth -and $item.TryGetCurrentPattern($ECP::Pattern, [ref]$pattern) -and
      $pattern.Current.ExpandCollapseState -ne [System.Windows.Automation.ExpandCollapseState]::LeafNode) {
    try {
      $pattern.Expand()
      Start-Sleep -Milliseconds 300
      $popup = $item.FindFirst($Scope::Children, (New-Object System.Windows.Automation.PropertyCondition($AE::ControlTypeProperty, $CT::Menu)))
      if (-not $popup) {
        $menus = $AE::RootElement.FindAll($Scope::Children, (New-Object System.Windows.Automation.AndCondition(
          (New-Object System.Windows.Automation.PropertyCondition($AE::ControlTypeProperty, $CT::Menu)),
          (New-Object System.Windows.Automation.PropertyCondition($AE::ProcessIdProperty, $proc.Id)))))
        if ($menus.Count) { $popup = $menus[$menus.Count - 1] }
      }
      $children = New-Object System.Collections.Generic.List[object]
      if ($popup) {
        foreach ($child in $popup.FindAll($Scope::Children, [System.Windows.Automation.Condition]::TrueCondition)) {
          if ($children.Count -ge $MaxItems) { $children.Add([ordered]@{ truncated = $true }); break }
          $t = $child.Current.ControlType
          if ($t -eq $CT::Separator) { $children.Add([ordered]@{ separator = $true }) }
          elseif ($t -eq $CT::MenuItem) { $children.Add((Read-UiaItem $child ($depth + 1))) }
        }
      } else { $notes.Add("uia: '$($c.Name)' expanded but no popup menu was found") }
      $node.children = $children
    } catch { $errors.Add("uia '$($c.Name)': $($_.Exception.Message)") }
    finally { try { $pattern.Collapse() } catch {} ; Start-Sleep -Milliseconds 150 }
  } elseif ($depth -eq 1) {
    $node.patterns = (Get-Patterns $item)
  }
  return $node
}

if ($null -eq $menus) {
  try {
    $bar = Find-MenuBar
    if ($bar) {
      $method = 'uia'
      $menus = New-Object System.Collections.Generic.List[object]
      foreach ($item in $bar.FindAll($Scope::Children, [System.Windows.Automation.Condition]::TrueCondition)) {
        if ($item.Current.Name) { $menus.Add((Read-UiaItem $item 1)) }
      }
    } else { $errors.Add('uia: no menu bar or File/Edit/Object container found in any Illustrator window') }
  } catch { $errors.Add("uia: $($_.Exception.Message)") }
}

$result = [ordered]@{
  probe = 'menus'; version = 2; method = $method; capturedAt = (Get-Date).ToString('o')
  illustrator = [ordered]@{ fileVersion = $proc.MainModule.FileVersionInfo.FileVersion; productVersion = $proc.MainModule.FileVersionInfo.ProductVersion; processes = $procs.Count }
  os = [System.Environment]::OSVersion.VersionString
  menus = $(if ($menus) { $menus } else { @() })
  diagnostics = [ordered]@{ windows = @($windows | ForEach-Object { $x = [ordered]@{}; foreach ($k in $_.Keys) { if ($k -ne 'handle') { $x[$k] = $_[$k] } }; $x }); uiaOutline = $outline }
  notes = $notes
  errors = $errors
}
[System.IO.File]::WriteAllText($OutFile, ($result | ConvertTo-Json -Depth 60), (New-Object System.Text.UTF8Encoding $false))
Write-Host "VectorSuite menu probe v2: method=$method, $(@($result.menus).Count) top-level menus, $($windows.Count) windows, $($errors.Count) error(s)."
Write-Host "Wrote $OutFile"
