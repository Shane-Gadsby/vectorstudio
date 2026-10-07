#!/usr/bin/env node
// Live link to the LICENSED Illustrator 30.1 in the Windows VM, so a research
// session can drive it interactively: run ExtendScript without writing a job
// file, call the COM object model, see which dialog is open, screenshot it and
// type into it.
//
// The VM side is `vs-bridge.ps1`, which the user starts once per session. It
// dials THIS process, because the Windows guest sits behind the WinBoat
// container's NAT: nothing can be forwarded in without republishing the
// container's ports, but the guest already routes outbound to us (that is how
// it reaches the internet). So we listen and it connects, which also means the
// VM needs no setup beyond starting the script.
//
//   # once, in the background: waits for the VM to dial in
//   node scripts/research/illustrator/bridge.mjs serve
//
//   # then one call per invocation, over the local control socket
//   node scripts/research/illustrator/bridge.mjs ping
//   node scripts/research/illustrator/bridge.mjs eval scripts/research/illustrator/check-ai-files.jsx --args '{"files":["Z:\\temp\\x.ai"]}'
//   node scripts/research/illustrator/bridge.mjs js 'app.documents.length + " open"'
//   node scripts/research/illustrator/bridge.mjs com Documents.Count
//   node scripts/research/illustrator/bridge.mjs windows
//   node scripts/research/illustrator/bridge.mjs shot --what dialog --out .research/dialog.png
//   node scripts/research/illustrator/bridge.mjs keys '{TAB}30{ENTER}'
//   node scripts/research/illustrator/bridge.mjs stop
//
// Driving a dialog is the point of it. A menu command that opens one never
// returns, which is what wedges vs-agent.ps1; here `eval --async` starts it and
// comes straight back, the dialog is then a window we can list, photograph and
// type into, and `status` collects the script's result once it closes:
//
//   id=$(bridge.mjs eval --async --js 'app.executeMenuCommand("…")' --id-only)
//   bridge.mjs shot --what dialog --out .research/d.png     # look at it
//   bridge.mjs keys '{TAB}{TAB}30{ENTER}'                   # fill it in
//   bridge.mjs status $id
//
// Security: this opens a TCP port on THIS machine (not in the VM), by default
// bound to the WinBoat bridge gateway alone, and a connection is dropped unless
// its hello carries the token from `~/Downloads/temp/jobs/bridge.json` — a file
// only reachable through the folder already shared with the VM. It is a private
// research tool (R0); don't run it on a shared network without --bind.

import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import { isMain } from "../../lib/sources.mjs";

export const JOBS_DIR = path.join(os.homedir(), "Downloads", "temp", "jobs");
export const CONTROL_SOCKET = path.join(os.tmpdir(), "vs-bridge.sock");
export const DEFAULT_PORT = 9000;
// Bumped whenever the wire contract changes. A VM still running an older
// vs-bridge.ps1 is rejected with a message saying to restart it, because the
// failure otherwise looks like a hang: v1 let an eval's own id overwrite the
// request's correlation number, so its replies were unrecognisable.
export const PROTOCOL = 5;

/**
 * Addresses to tell the VM to try, best first.
 *
 * The guest's default route goes through the container's bridge gateway on this
 * machine, so a `br-*` or `docker*` address is the one it can actually reach;
 * a LAN address is the fallback for a differently networked VM. Loopback is
 * useless to the guest and is left out.
 */
export function candidateAddresses(interfaces = os.networkInterfaces()) {
  const bridges = [];
  const others = [];
  for (const [name, addresses] of Object.entries(interfaces)) {
    for (const address of addresses ?? []) {
      if (address.family !== "IPv4" || address.internal) continue;
      (/^(br-|docker)/.test(name) ? bridges : others).push(address.address);
    }
  }
  return [...bridges, ...others];
}

/** Splits a stream of NDJSON into objects. Tolerates the CRLF PowerShell writes. */
export class LineReader {
  #buffer = "";

  /** @returns {object[]} whole lines parsed so far; a bad line comes back as `{ __parseError, line }`. */
  push(chunk) {
    this.#buffer += chunk;
    const out = [];
    let index;
    while ((index = this.#buffer.indexOf("\n")) >= 0) {
      const line = this.#buffer.slice(0, index).replace(/\r$/, "").trim();
      this.#buffer = this.#buffer.slice(index + 1);
      if (!line) continue;
      try {
        out.push(JSON.parse(line));
      } catch (error) {
        out.push({ __parseError: error.message, line });
      }
    }
    return out;
  }
}

/**
 * The request the VM turns into `var VS_ARGS = …;` followed by the script.
 *
 * `timeoutMs` sizes one round trip, not the script: the VM answers within a
 * quarter-second either way (see `Wait-Eval` in vs-bridge.ps1), and the overall
 * deadline is enforced here by `waitForEval`.
 */
export const ROUND_TRIP_MS = 30000;

export function buildEvalRequest(source, { args = {} } = {}) {
  return {
    op: "eval",
    source,
    // A JSON string, not an object: the VM pastes it in literally, so the
    // VS_ARGS header is byte-identical to the one run-job.mjs writes.
    argsJson: JSON.stringify(args ?? {}),
    timeoutMs: ROUND_TRIP_MS,
  };
}

/**
 * Polls an eval the VM has started until it finishes or `timeoutS` runs out.
 *
 * The waiting has to happen here rather than in the VM: its read loop is
 * single-threaded, so a long wait there would stop it answering `windows`,
 * `screenshot` and `keys` — the very things needed to get past a modal dialog.
 */
export async function waitForEval(started, { control = CONTROL_SOCKET, timeoutS = 600, pollMs = 250 } = {}) {
  let response = started;
  const deadline = Date.now() + timeoutS * 1000;
  while (response.ok && response.done === false) {
    if (Date.now() > deadline) {
      return { ...response, ok: false, error: `eval ${response.evalId} is still running after ${timeoutS}s; it is probably waiting on a dialog (try \`windows\`), and \`status ${response.evalId}\` still collects it` };
    }
    await sleep(pollMs);
    // evalId, not id: `id` is the correlation number the control server owns.
    response = await call({ op: "status", evalId: response.evalId, timeoutMs: ROUND_TRIP_MS }, { control });
  }
  return response;
}

// --- the server --------------------------------------------------------------

function log(quiet, ...parts) {
  if (!quiet) console.log(`${new Date().toISOString().slice(11, 19)}  ${parts.join(" ")}`);
}

export async function serve({
  port = DEFAULT_PORT, bind = "auto", jobsDir = JOBS_DIR, control = CONTROL_SOCKET, quiet = false,
} = {}) {
  const candidates = candidateAddresses();
  const bindAddress = bind === "auto" ? (candidates[0] ?? "0.0.0.0") : bind;
  const token = crypto.randomBytes(24).toString("hex");
  const endpointFile = path.join(jobsDir, "bridge.json");
  fs.mkdirSync(jobsDir, { recursive: true });

  let vm = null; // the VM's socket, once it has said hello
  let stale = null; // set when the VM's vs-bridge.ps1 is too old to talk to
  let nextId = 1;
  const pending = new Map(); // request id → { resolve, reject, timer }

  const send = (request, timeoutS) =>
    new Promise((resolve, reject) => {
      if (stale) {
        reject(new Error(stale));
        return;
      }
      if (!vm) {
        reject(new Error("the VM hasn't dialled in yet; start vs-bridge.ps1 in the VM (see scripts/README.md)"));
        return;
      }
      const id = nextId++;
      // Wait longer than the VM's own timeout, so that its "still running"
      // answer reaches us rather than us giving up on it first.
      const waitMs = Math.round((timeoutS ?? 600) * 1000) + 15000;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`the VM did not answer request ${id} (${request.op}) within ${Math.round(waitMs / 1000)}s`));
      }, waitMs);
      pending.set(id, { resolve, reject, timer });
      vm.write(`${JSON.stringify({ ...request, id })}\n`);
    });

  const vmServer = net.createServer((socket) => {
    const from = `${socket.remoteAddress}:${socket.remotePort}`;
    const reader = new LineReader();
    let greeted = false;
    // Drop anything that doesn't authenticate promptly: more than the VM may be
    // able to reach the port.
    const helloTimer = setTimeout(() => {
      if (!greeted) {
        log(quiet, `${from}: no hello within 10s, closing`);
        socket.destroy();
      }
    }, 10000);

    socket.setNoDelay(true);
    socket.setEncoding("utf8");
    socket.on("data", (chunk) => {
      for (const message of reader.push(chunk)) {
        if (message.__parseError) {
          log(quiet, `${from}: unparseable line: ${message.__parseError}`);
          continue;
        }
        if (!greeted) {
          if (message.type !== "hello" || message.token !== token) {
            log(quiet, `${from}: rejected (${message.type === "hello" ? "wrong token" : "no hello"})`);
            socket.destroy();
            return;
          }
          greeted = true;
          clearTimeout(helloTimer);
          if (vm && vm !== socket) vm.destroy(); // a reconnect supersedes the old socket
          vm = socket;
          // The script reconnects by itself when this server restarts, so a
          // version check is the only way to tell a freshly started copy from
          // an old one that merely re-read the token.
          stale = message.protocol === PROTOCOL
            ? null
            : `the VM is running vs-bridge.ps1 protocol ${message.protocol ?? "?"}, but this server speaks ${PROTOCOL}. `
              + "Copy scripts/research/illustrator/vs-bridge.ps1 to ~/Downloads/temp/ and restart it in the VM: "
              + "powershell -ExecutionPolicy Bypass -File Z:\\temp\\vs-bridge.ps1";
          log(quiet, `${from}: VM connected — Illustrator ${message.illustrator} on ${message.computer}, pid ${message.illustratorPid}`);
          if (stale) log(quiet, `${from}: WARNING — ${stale}`);
          continue;
        }
        if (message.type === "response") {
          const waiter = pending.get(message.id);
          if (!waiter) continue;
          clearTimeout(waiter.timer);
          pending.delete(message.id);
          waiter.resolve(message);
        } else {
          log(quiet, `${from}: ${JSON.stringify(message)}`);
        }
      }
    });
    socket.on("error", (error) => log(quiet, `${from}: ${error.message}`));
    socket.on("close", () => {
      clearTimeout(helloTimer);
      if (vm === socket) {
        vm = null;
        stale = null;
        log(quiet, `${from}: VM disconnected`);
      }
    });
  });

  // One request per control connection, so each CLI call is a short-lived
  // client and nothing else has to live in this process.
  const controlServer = net.createServer((socket) => {
    const reader = new LineReader();
    socket.setEncoding("utf8");
    socket.on("error", () => {});
    socket.on("data", async (chunk) => {
      for (const message of reader.push(chunk)) {
        let response;
        try {
          if (message.__parseError) throw new Error(`unparseable request: ${message.__parseError}`);
          else if (message.op === "__status") response = { ok: true, connected: Boolean(vm), stale, port: vmServer.address()?.port, bindAddress, candidates };
          else response = await send(message, message.timeoutMs ? message.timeoutMs / 1000 : undefined);
        } catch (error) {
          response = { ok: false, error: error.message };
        }
        if (message.op === "stop" && response?.ok) setTimeout(() => shutdown(0), 250);
        socket.write(`${JSON.stringify(response)}\n`);
        socket.end();
      }
    });
  });

  // Keepalive. It also wakes the VM's blocking read, so a `stop` file or a
  // closed socket is noticed rather than waiting for the next real request.
  const keepalive = setInterval(() => { if (vm) send({ op: "ping" }, 30).catch(() => {}); }, 30000);
  keepalive.unref();

  const onSignal = () => shutdown(0);

  const teardown = () => {
    clearInterval(keepalive);
    // Removed, not just ignored: a process that serves more than once (the
    // tests do) would otherwise pile up listeners until Node warns about it.
    for (const signal of ["SIGINT", "SIGTERM"]) process.off(signal, onSignal);
    for (const { timer } of pending.values()) clearTimeout(timer);
    fs.rmSync(endpointFile, { force: true });
    fs.rmSync(control, { force: true });
    if (vm) vm.destroy();
    try { vmServer.close(); } catch { /* already closing */ }
    try { controlServer.close(); } catch { /* already closing */ }
    log(quiet, "bridge stopped");
  };
  // Only the CLI exits the process; close() leaves it to the caller, so the
  // tests can start and stop a real bridge.
  const shutdown = (code) => {
    teardown();
    process.exit(code);
  };

  fs.rmSync(control, { force: true });
  await new Promise((resolve, reject) => {
    vmServer.once("error", reject);
    vmServer.listen(port, bindAddress, resolve);
  });
  await new Promise((resolve, reject) => {
    controlServer.once("error", reject);
    controlServer.listen(control, resolve);
  });

  // What we actually bound, which is not `port` when 0 asked for an ephemeral
  // one — and it is this that has to reach the VM.
  const boundPort = vmServer.address().port;

  // The VM reads this through the folder already shared with it, so the token
  // never crosses the network before it is needed and nothing has to be typed
  // in the VM.
  fs.writeFileSync(
    endpointFile,
    `${JSON.stringify({ protocol: PROTOCOL, port: boundPort, token, candidates, written: new Date().toISOString() }, null, 2)}\n`,
  );

  log(quiet, `listening on ${bindAddress}:${boundPort}; control socket ${control}`);
  log(quiet, `wrote ${endpointFile} (candidates: ${candidates.join(", ")})`);
  log(quiet, "in the VM, with Illustrator open: powershell -ExecutionPolicy Bypass -File Z:\\temp\\vs-bridge.ps1");

  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, onSignal);

  return {
    close: teardown,
    control,
    endpointFile,
    token,
    candidates,
    bindAddress,
    port: boundPort,
  };
}

// --- the client --------------------------------------------------------------

/** Sends one request through a running `serve` and resolves its response. */
export function call(request, { control = CONTROL_SOCKET } = {}) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(control)) {
      reject(new Error(`no bridge is serving (${control} is missing). Start it: node scripts/research/illustrator/bridge.mjs serve`));
      return;
    }
    const socket = net.createConnection(control);
    const reader = new LineReader();
    let settled = false;
    socket.setEncoding("utf8");
    socket.on("connect", () => socket.write(`${JSON.stringify(request)}\n`));
    socket.on("data", (chunk) => {
      for (const message of reader.push(chunk)) {
        if (settled) continue;
        settled = true;
        socket.end();
        if (message.__parseError) reject(new Error(`unparseable response: ${message.__parseError}`));
        else resolve(message);
      }
    });
    socket.on("error", (error) => { if (!settled) { settled = true; reject(error); } });
    socket.on("close", () => { if (!settled) reject(new Error("the bridge closed without answering")); });
  });
}

/** Runs a .jsx the way run-job.mjs does, but live, and waits for its result. */
export async function evalFile(scriptPath, options = {}) {
  const started = await call(buildEvalRequest(fs.readFileSync(scriptPath, "utf8"), options), options);
  return waitForEval(started, options);
}

// --- CLI ---------------------------------------------------------------------

const FLAGS_WITH_VALUES = [
  "--args", "--timeout", "--out", "--what", "--handle", "--method", "--delay", "--port", "--bind", "--control",
];

export const USAGE = `usage: bridge.mjs <command> [options]

  serve  [--port N] [--bind auto|ADDR] [--quiet]   listen for the VM (run it in the background)
  ping                                             version, open documents, any dialog
  eval   <script.jsx> [--args JSON] [--async] [--timeout S] [--id-only]
  js     '<source>'   [--args JSON] [--async] [--timeout S] [--id-only]
  status <id> [--timeout S]                        collect an --async eval
  cancel <id>                                      abandon our side of one
  com    <Dotted.Path> [--method NAME] [--args JSON-array]
  windows                                          top-level windows; says whether one is modal
  activate [--handle H]                            focus the dialog, else the main window
  keys   '<SendKeys>' [more…] [--delay MS] [--handle H]
  shot   [--what dialog|main|screen] [--out FILE]  PNG of it
  stop                                             shut the bridge down

Every path inside --args is a VM path (Z:\\temp\\…).`;

export function buildRequest(command, { positional, flag, has, args, timeoutS }) {
  switch (command) {
    case "ping":
      return { op: "ping" };
    case "eval": {
      if (!positional[0]) throw new Error("eval needs a .jsx path");
      return buildEvalRequest(fs.readFileSync(positional[0], "utf8"), { args });
    }
    case "js": {
      if (!positional[0]) throw new Error("js needs a source string");
      return buildEvalRequest(positional[0], { args });
    }
    case "status":
      return { op: "status", evalId: Number(positional[0]), timeoutMs: ROUND_TRIP_MS };
    case "cancel":
      return { op: "cancel", evalId: Number(positional[0]) };
    case "com":
      return { op: "com", path: positional[0] ?? "", method: flag("--method"), args: flag("--args") ? args : undefined };
    case "windows":
      return { op: "windows" };
    case "activate":
      return { op: "activate", handle: flag("--handle") ? Number(flag("--handle")) : undefined };
    case "keys": {
      if (positional.length === 0) throw new Error("keys needs at least one SendKeys string");
      return {
        op: "keys",
        keys: positional,
        delayMs: flag("--delay") ? Number(flag("--delay")) : undefined,
        handle: flag("--handle") ? Number(flag("--handle")) : undefined,
      };
    }
    case "shot":
      return { op: "screenshot", what: flag("--what") ?? "main" };
    case "stop":
      return { op: "stop" };
    default:
      throw new Error(`unknown command ${command ? `'${command}'` : "(none)"}\n\n${USAGE}`);
  }
}

async function main(argv) {
  const command = argv[0];
  const flag = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
  const has = (name) => argv.includes(name);
  // argv.slice(1)'s index i is argv[i + 1], so argv[i] is the token before it.
  const positional = argv.slice(1).filter((value, i) => !value.startsWith("--") && !FLAGS_WITH_VALUES.includes(argv[i]));
  const args = flag("--args") ? JSON.parse(flag("--args")) : {};
  const timeoutS = flag("--timeout") ? Number(flag("--timeout")) : 600;

  if (command === "serve") {
    await serve({
      port: Number(flag("--port") ?? DEFAULT_PORT),
      bind: flag("--bind") ?? "auto",
      control: flag("--control") ?? CONTROL_SOCKET,
      quiet: has("--quiet"),
    });
    return new Promise(() => {}); // serve until signalled
  }

  const request = buildRequest(command, { positional, flag, has, args, timeoutS });
  const control = flag("--control") ?? CONTROL_SOCKET;
  // No slack is added here: the control server sizes its own wait from
  // timeoutMs, so overriding it would make it wait longer than asked.
  let response = await call(request, { control });
  // An eval comes back as soon as the VM has started it. Unless asked to hand
  // the id straight over, wait it out here.
  if (["eval", "js"].includes(command) && !has("--async")) {
    response = await waitForEval(response, { control, timeoutS });
  }

  // A screenshot's payload is far too big to print: write it out and say where.
  if (command === "shot" && response.base64) {
    const out = flag("--out") ?? path.join(os.homedir(), "Downloads", "temp", `vs-shot-${Date.now()}.png`);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, Buffer.from(response.base64, "base64"));
    console.log(`${out} (${response.bytes} bytes, window ${response.handle})`);
    return response.ok ? 0 : 1;
  }
  if (has("--id-only")) {
    if (!response.evalId) throw new Error(`no eval id in the answer: ${JSON.stringify(response)}`);
    console.log(String(response.evalId));
    return response.ok ? 0 : 1;
  }
  // `type` and `id` are envelope, not answer.
  const { type, id, ...rest } = response;
  console.log(JSON.stringify(rest, null, 2));
  return response.ok ? 0 : 1;
}

if (isMain(import.meta.url)) {
  try {
    process.exitCode = await main(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
