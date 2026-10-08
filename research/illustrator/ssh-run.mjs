#!/usr/bin/env node
// Drives a LICENSED Illustrator in the Windows VM over SSH, by invoking `vs-run.ps1` in the guest.
// This is the control channel (decision: SSH replaces vs-bridge.ps1's dial-out socket).
//
//   node research/illustrator/ssh-run.mjs ping
//   node research/illustrator/ssh-run.mjs eval probe-baseline.jsx --args '{"what":"prefs"}'
//   node research/illustrator/ssh-run.mjs windows
//   node research/illustrator/ssh-run.mjs keys --send "{ENTER}"
//   node research/illustrator/ssh-run.mjs screenshot --out /tmp/ai.png
//
// `eval` returns only when the script finishes: it starts it, then polls `status`. Because the
// guest runs the script in a detached process, a modal dialog blocks neither the SSH call nor the
// poll, so `windows` / `keys` / `screenshot` can dismiss it from here while the eval waits. That
// is the one thing the old file-queue agent could not do.
//
// The VM's address is not hard-coded: the container forwards every TCP port to the guest (a
// catch-all DNAT rule), and the host routes to the container over the docker bridge, so the target
// is just the container's IP. See docs/vm-channel.md.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const exec = promisify(execFile);
const HERE = path.dirname(fileURLToPath(import.meta.url));

export const CONTAINER = process.env.VS_VM_CONTAINER ?? "WinBoat";
export const SSH_USER = process.env.VS_VM_USER ?? os.userInfo().username;
export const SSH_KEY = process.env.VS_VM_KEY ?? path.join(os.homedir(), ".ssh", "id_vectorstudio");
// Where `vs-run.ps1` and the .jsx files live, on the guest's OWN disk.
//
// Not the RDP share: `\\tsclient\temp` belongs to the interactive RDP logon session and an SSH
// session cannot see it at all ("Access is denied"). `stage` copies the scripts in over sftp
// instead, which is shell-independent and needs no share.
export const GUEST_SCRIPTS = process.env.VS_VM_SCRIPTS ?? String.raw`C:\vectorstudio`;
/** The same path as sftp addresses it. */
export const GUEST_SCRIPTS_POSIX = `/${GUEST_SCRIPTS.replace(/\\/g, "/")}`;
export const POLL_MS = 400;

/** The guest's address: the container's IP, which DNATs every port to the VM. */
export async function vmHost() {
  if (process.env.VS_VM_HOST) return process.env.VS_VM_HOST;
  const { stdout } = await exec("docker", [
    "inspect",
    CONTAINER,
    "--format",
    "{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}",
  ]);
  const ip = stdout.trim();
  if (!ip) throw new Error(`container ${CONTAINER} has no IP address; is it running?`);
  return ip;
}

/** One `vs-run.ps1` invocation. Returns its parsed JSON reply. */
export async function call(command, params = {}, { timeoutS = 120 } = {}) {
  const host = await vmHost();
  const args = [`${GUEST_SCRIPTS}\\vs-run.ps1`, command];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    args.push(`-${key}`, String(value));
  }
  // PowerShell is the guest's default shell (enable-ssh.ps1 sets it), so the command is passed as
  // one quoted argument list rather than wrapped in `powershell -c`.
  const remote = `& ${args.map((a) => `'${a.replace(/'/g, "''")}'`).join(" ")}`;
  const ssh = [
    "-i", SSH_KEY,
    "-o", "StrictHostKeyChecking=accept-new",
    "-o", "BatchMode=yes",
    "-o", `ConnectTimeout=10`,
    `${SSH_USER}@${host}`,
    remote,
  ];
  let stdout;
  try {
    ({ stdout } = await exec("ssh", ssh, { timeout: timeoutS * 1000, maxBuffer: 64 * 1024 * 1024 }));
  } catch (e) {
    // vs-run.ps1 exits 1 with a JSON error for expected failures; anything else is transport.
    const text = (e.stdout ?? "").trim();
    if (text.startsWith("{")) return JSON.parse(text);
    throw new Error(`ssh ${command} failed: ${(e.stderr || e.message || "").trim()}`);
  }
  const text = stdout.trim();
  if (!text.startsWith("{")) throw new Error(`${command}: expected JSON, got: ${text.slice(0, 200)}`);
  return JSON.parse(text);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Run a .jsx and wait for it. `onWait` sees each poll, so a caller can dismiss a dialog. */
export async function evalScript(scriptFile, { args = {}, timeoutS = 600, onWait } = {}) {
  const guestPath = scriptFile.includes("\\") ? scriptFile : `${GUEST_SCRIPTS}\\${path.basename(scriptFile)}`;
  const started = await call("eval", { ScriptFile: guestPath, ArgsJson: JSON.stringify(args), TimeoutS: timeoutS });
  if (!started.ok) throw new Error(`eval did not start: ${started.error}`);
  const deadline = Date.now() + timeoutS * 1000;
  for (;;) {
    await sleep(POLL_MS);
    const status = await call("status", { Id: started.id });
    if (status.state === "done") return status.result;
    if (status.state === "failed") throw new Error(`${path.basename(scriptFile)}: ${status.error}`);
    if (onWait) await onWait(status);
    if (Date.now() > deadline) {
      await call("cancel", { Id: started.id });
      throw new Error(`${path.basename(scriptFile)}: timed out after ${timeoutS}s (cancelled)`);
    }
  }
}

/** Push the scripts the guest needs onto its own disk, over sftp. */
export async function stageScripts() {
  const host = await vmHost();
  const names = fs.readdirSync(HERE).filter((n) => /\.(jsx|ps1)$/.test(n));
  await exec("ssh", [
    "-i", SSH_KEY, "-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=accept-new",
    `${SSH_USER}@${host}`,
    `New-Item -ItemType Directory -Force -Path '${GUEST_SCRIPTS}' | Out-Null`,
  ]);
  // One sftp session for the lot: a connection per file is slow and noisy. The batch goes in a
  // file rather than on stdin, because execFile cannot write a child's stdin — passing `input`
  // leaves `sftp -b -` waiting on it for ever.
  const batch = [`cd ${GUEST_SCRIPTS_POSIX}`, ...names.map((n) => `put "${path.join(HERE, n)}"`), "bye"].join("\n");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vs-stage-"));
  const batchFile = path.join(dir, "batch.sftp");
  fs.writeFileSync(batchFile, `${batch}\n`);
  try {
    await exec(
      "sftp",
      ["-b", batchFile, "-i", SSH_KEY, "-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=accept-new", `${SSH_USER}@${host}`],
      { timeout: 120_000 },
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  return names;
}

async function main(argv) {
  const [command, ...rest] = argv;
  const flag = (name) => {
    const i = rest.indexOf(`--${name}`);
    return i === -1 ? undefined : rest[i + 1];
  };
  if (!command || command === "--help") {
    process.stdout.write(
      "usage: ssh-run.mjs <ping|eval|status|cancel|windows|keys|screenshot|stage> [script.jsx] [--args JSON]\n" +
        "                   [--send KEYS] [--out FILE] [--id ID] [--timeout SECONDS]\n",
    );
    return 0;
  }
  if (command === "stage") {
    const staged = await stageScripts();
    process.stdout.write(`staged ${staged.length} file(s) into ${GUEST_SCRIPTS}:\n  ${staged.join("\n  ")}\n`);
    return 0;
  }
  if (command === "eval") {
    const script = rest.find((a) => a.endsWith(".jsx"));
    if (!script) throw new Error("eval needs a .jsx file");
    const result = await evalScript(script, {
      args: JSON.parse(flag("args") ?? "{}"),
      timeoutS: Number(flag("timeout") ?? 600),
      onWait: (s) => {
        if (s.windows?.some((w) => w && !/^Adobe Illustrator/.test(w))) {
          process.stderr.write(`  waiting — a dialog is up: ${s.windows.join(" | ")}\n`);
        }
      },
    });
    process.stdout.write(`${result}\n`);
    return 0;
  }
  const params = {};
  if (flag("id")) params.Id = flag("id");
  if (flag("send")) params.Send = flag("send");
  const reply = await call(command, params);
  if (command === "screenshot" && flag("out") && reply.png) {
    fs.writeFileSync(flag("out"), Buffer.from(reply.png, "base64"));
    process.stdout.write(`wrote ${flag("out")} (${reply.width}x${reply.height})\n`);
    return reply.ok ? 0 : 1;
  }
  process.stdout.write(`${JSON.stringify(reply, null, 2)}\n`);
  return reply.ok === false ? 1 : 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (e) => {
      process.stderr.write(`error: ${e.message}\n`);
      process.exit(1);
    },
  );
}
