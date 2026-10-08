# The licensed-Illustrator channel

Every `confidence: verified` row in the parity matrix came from a **licensed** Illustrator 30.1
running in a Windows VM. This is how the dev machine drives it.

**SSH is the channel.** It replaced `vs-bridge.ps1`'s dial-out socket (decided 2026-10-08), so
there is nothing long-lived to start in the guest and nothing to keep alive between probes.

## How the VM is reachable, and why no port forwarding is needed

WinBoat runs the guest in a `dockur/windows` container (`WinBoat`) with qemu on a `tap` interface.
Two facts make SSH free:

1. The container has a **catch-all DNAT rule** — every TCP port arriving at the container's address
   is forwarded to the guest, bar a handful used by the container itself:

   ```
   DNAT tcp -- 0.0.0.0/0 172.18.0.2 multiport dports !5700,5900,7100,8006,8004,7149 to:172.30.0.2
   ```

2. The **host routes to the container** over the docker bridge (`172.18.0.1` → `172.18.0.2`).

So the dev machine reaches *any* guest port by dialling the container's IP. No `docker compose`
change, no published port, no container restart.

> `vs-bridge.ps1`'s header says "nothing can be forwarded in without republishing the container's
> ports", which is why it dials outward. **That is not true for this container** — it holds for a
> user-mode qemu netdev, not for this tap + catch-all-DNAT setup. The bridge's design was sound
> under its assumption; the assumption was simply wrong here.

The container's IP is not stable across recreation, so nothing hard-codes it:
`ssh-run.mjs` asks `docker inspect` each run. `VS_VM_HOST` overrides it.

## One-time setup

Both steps need the VM's keyboard; nothing after them does.

**1. The share.** `~/.winboat/winboat.config.json` carries extra FreeRDP arguments, and the drive
redirection is what the guest sees as `\\tsclient\temp`:

```json
"rdpArgs": ["/drive:temp,/home/<you>/Downloads/temp"]
```

Create `~/Downloads/temp/jobs`, then **reconnect WinBoat** so FreeRDP picks the argument up. The
share only exists while an RDP session is connected.

**2. sshd in the guest.** Stage the scripts and run the enabler once, elevated, in the VM:

```sh
node research/illustrator/ssh-run.mjs stage        # copies *.jsx and *.ps1 onto the share
```
```powershell
powershell -ExecutionPolicy Bypass -File \\tsclient\temp\enable-ssh.ps1
```

It installs Windows' own `OpenSSH.Server` capability, authorises
`~/.ssh/id_vectorstudio.pub` in `administrators_authorized_keys` (the only file sshd reads for
administrators on Windows), tightens that file's ACL, makes PowerShell the default shell and opens
TCP 22. It installs nothing else.

Check it from here:

```sh
node research/illustrator/ssh-run.mjs ping
```

## What SSH can and cannot reach

**SSH lands in session 0; Illustrator runs in the interactive RDP session (2).** Measured:

```
sshSession=0 illustratorSession=2
GetActiveObject('Illustrator.Application') → 0x800401E3 MK_E_UNAVAILABLE
```

COM's running-object table is **per session**, so an SSH session cannot see Illustrator's COM
object at all — and neither can it SendKeys to it or screenshot it. The staged script was never
the obstacle; the session boundary is. So driving COM "as if running on the VM" does not work from
SSH, however the command is delivered.

Anything touching Illustrator therefore has to execute **inside session 2**, and the way across is
a scheduled task registered to run as the logged-on user with `-LogonType Interactive`. Triggered
from SSH, it starts in that user's session:

```
registered with UserId=schme16
RESULT: session=2 com=30.1.0
```

`-UserId "$env:USERDOMAIN\$env:USERNAME"` fails from session 0 with *"No mapping between account
names and security IDs was done"*; the bare username resolves.

So SSH's value is that it can now *start* the session-2 work unattended, instead of someone typing
in the VM. It does not remove the need for a connected, unlocked RDP session.

### Not everything needs session 2

Much of what a parity probe wants is a **file**, and files need no session crossing. The whole
shortcut surface is the clearest case: Illustrator's keyboard bindings live in `keys.kys`, which
`read-kys.mjs` simply copies out over sftp. That settled all four disputed shortcut rows without
COM, ExtendScript or a scheduled task — and `Adobe Illustrator Prefs`, beside it, settled a wrong
default the same way (`/maximumUndoDepth 100`). Reach for a file first, COM second, ExtendScript only when
the scripting DOM is the only way in — and note that **shortcuts are not in the scripting DOM at
all**, so ExtendScript could never have answered those rows.

## Driving Illustrator

```sh
node research/illustrator/ssh-run.mjs ping                                  # version, documents, modal?
node research/illustrator/ssh-run.mjs eval probe-baseline.jsx --args '{}'   # run and wait
node research/illustrator/ssh-run.mjs windows                               # find a dialog
node research/illustrator/ssh-run.mjs keys --send "{ENTER}"                 # dismiss it
node research/illustrator/ssh-run.mjs screenshot --out /tmp/ai.png
```

Each call is one short SSH invocation of `vs-run.ps1`, which keeps its state in files under the
guest's `%TEMP%\vectorstudio-run` because nothing is remembered between calls.

### Modal dialogs

This is the part that makes the channel worth having, and the reason a plain
`ssh host "...DoJavaScript..."` is not enough. ExtendScript **blocks** while a dialog is up, so a
synchronous call would hang until someone dismissed it by hand — which is exactly how the old
`vs-agent.ps1` file queue used to wedge.

So `eval` starts the script in a **detached** process and returns a handle immediately. The SSH
call ends while Illustrator is still busy; `windows`, `keys` and `screenshot` keep answering, and
`status` collects the result. `ssh-run.mjs`'s `evalScript` polls for you and hands each poll to an
`onWait` callback, so a caller can notice a dialog and drive it:

```js
await evalScript("make-fixtures.jsx", {
  onWait: async (s) => {
    if (s.windows.some((w) => /Envelope Options/.test(w))) await call("keys", { Send: "{ENTER}" });
  },
});
```

**Illustrator must already be running in a connected, unlocked RDP session.** COM, SendKeys and
screenshots all need a real desktop: SSH removes the need to *type* in the VM, not the need for a
session to exist. `vs-run.ps1` attaches to a running instance and never starts one, so a probe
cannot quietly launch a fresh unlicensed-looking install.

## Rules

- **Verification happens here and nowhere else.** The Illustrator at `../illustrator/` on the dev
  machine is an unlicensed repack: never read its presets, shortcuts, resources, binaries or
  outputs, and never make fixtures or reference outputs from it.
- **Anything the VM produces is private research.** `.ai` files saved by the licensed install carry
  Adobe's bundled startup content and the author's user name, so they stay in the gitignored
  `fixtures/ai/`. See [`parity/README.md`](parity/README.md#reference-fixtures).
- `vs-bridge.ps1` and `vs-agent.ps1` are kept for now as a fallback for a VM where SSH cannot be
  enabled. Prefer `ssh-run.mjs`.
