<#
Turns on OpenSSH Server in the Windows VM and authorises one public key, so the dev machine can
drive Illustrator without anyone typing in the VM again. Run it ONCE, in the VM, elevated:

    powershell -ExecutionPolicy Bypass -File \\tsclient\temp\enable-ssh.ps1 -PublicKey "ssh-ed25519 AAAA... host"

Or, with the key already on the share as `id_vectorstudio.pub`:

    powershell -ExecutionPolicy Bypass -File \\tsclient\temp\enable-ssh.ps1

This is the only step that needs the VM's keyboard. Everything after it goes over SSH.

It installs nothing but Windows' own optional OpenSSH.Server capability, and authorises exactly the
key given. The listener is reachable only through the port the container forwards, which is
published on 127.0.0.1 on the dev machine, so it is not exposed to the network.
#>

param(
  # The public key to authorise. Defaults to id_vectorstudio.pub beside this script.
  [string]$PublicKey = '',
  [string]$KeyFile = (Join-Path $PSScriptRoot 'id_vectorstudio.pub'),
  # Where sshd keeps keys for members of Administrators: one file for all of them, not the
  # per-user ~/.ssh/authorized_keys, which sshd ignores for admins on Windows.
  [string]$AdminKeys = "$env:ProgramData\ssh\administrators_authorized_keys"
)

$ErrorActionPreference = 'Stop'

function Require-Admin {
  $me = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
  if (-not $me.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Run this from an elevated PowerShell (Run as administrator).'
  }
}

function Read-Key {
  if ($PublicKey) { return $PublicKey.Trim() }
  if (Test-Path $KeyFile) { return (Get-Content -Raw $KeyFile).Trim() }
  throw "No key: pass -PublicKey, or put id_vectorstudio.pub next to this script ($KeyFile)."
}

Require-Admin
$key = Read-Key
if ($key -notmatch '^(ssh-ed25519|ssh-rsa|ecdsa-sha2-\S+) \S+') {
  throw "That does not look like an OpenSSH public key: $($key.Substring(0, [Math]::Min(40, $key.Length)))…"
}

Write-Output '==> OpenSSH Server capability'
$cap = Get-WindowsCapability -Online -Name 'OpenSSH.Server*'
if ($cap.State -ne 'Installed') {
  Add-WindowsCapability -Online -Name $cap.Name | Out-Null
  Write-Output "    installed $($cap.Name)"
} else {
  Write-Output '    already installed'
}

Write-Output '==> sshd service'
Set-Service -Name sshd -StartupType Automatic
if ((Get-Service sshd).Status -ne 'Running') { Start-Service sshd }
Write-Output "    $((Get-Service sshd).Status), startup $((Get-Service sshd).StartType)"

Write-Output '==> authorised key'
New-Item -ItemType Directory -Force -Path (Split-Path $AdminKeys) | Out-Null
$existing = if (Test-Path $AdminKeys) { Get-Content $AdminKeys } else { @() }
if ($existing -contains $key) {
  Write-Output '    already authorised'
} else {
  Add-Content -Path $AdminKeys -Value $key
  Write-Output "    added to $AdminKeys"
}
# sshd refuses this file unless only Administrators and SYSTEM can write it.
icacls $AdminKeys /inheritance:r /grant 'Administrators:F' /grant 'SYSTEM:F' | Out-Null
Write-Output '    permissions tightened (Administrators + SYSTEM only)'

Write-Output '==> PowerShell as the default shell'
# So `ssh host "Get-Process"` works without wrapping every command in powershell -c.
$pwsh = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
New-ItemProperty -Path 'HKLM:\SOFTWARE\OpenSSH' -Name DefaultShell -Value $pwsh -PropertyType String -Force | Out-Null
Write-Output "    $pwsh"

Write-Output '==> firewall'
if (-not (Get-NetFirewallRule -Name 'VectorStudio-SSH' -ErrorAction SilentlyContinue)) {
  New-NetFirewallRule -Name 'VectorStudio-SSH' -DisplayName 'OpenSSH Server (VectorStudio)' `
    -Enabled True -Direction Inbound -Protocol TCP -Action Allow -LocalPort 22 | Out-Null
  Write-Output '    allowed TCP 22 inbound'
} else {
  Write-Output '    rule already present'
}

Write-Output ''
Write-Output 'Done. From the dev machine, once the container forwards a port to 22:'
Write-Output '    ssh -i ~/.ssh/id_vectorstudio -p <port> <user>@127.0.0.1 "Get-Date"'
