#!/usr/bin/env node
// Queues an ExtendScript job for vs-agent.ps1 in the Windows VM and waits
// for its result.
//
// Prefer `bridge.mjs` (with `vs-bridge.ps1` in the VM): it runs the same .jsx
// files with the same VS_ARGS header over a live socket, with no job file and no
// polling, and — unlike this — a script that opens a dialog doesn't wedge it.
// This is kept as the fallback for when the bridge can't be used.
//
//   node scripts/research/illustrator/run-job.mjs <script.jsx> [--args '<json>'] [--name <job>] [--timeout <s>]
//
// The job is <script> with `var VS_ARGS = <json>;` prepended, written to
// ~/Downloads/temp/jobs/ (the VM's Z:\temp\jobs). Paths inside --args are
// Windows paths as the VM sees them (Z:\...). Prints the agent's result and
// exits 1 if the job failed or timed out (or the agent isn't running).

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { isMain } from "../../lib/sources.mjs";

export const JOBS_DIR = path.join(os.homedir(), "Downloads", "temp", "jobs");

/** The job source: a VS_ARGS header, then the script (its #target line kept). */
export function buildJob(scriptText, args) {
  return `var VS_ARGS = ${JSON.stringify(args ?? {})};\r\n${scriptText}`;
}

export async function runJob(scriptPath, { args = {}, name, timeoutS = 600, jobsDir = JOBS_DIR } = {}) {
  const alive = path.join(jobsDir, "agent.alive");
  if (!fs.existsSync(alive) || Date.now() - fs.statSync(alive).mtimeMs > 15000) {
    throw new Error(`vs-agent isn't running (no fresh ${alive}). Start it in the VM: powershell -ExecutionPolicy Bypass -File Z:\\temp\\vs-agent.ps1`);
  }
  const job = `${name ?? path.basename(scriptPath, ".jsx")}-${Date.now()}`;
  const resultFile = path.join(jobsDir, "done", `${job}.result.txt`);
  fs.writeFileSync(path.join(jobsDir, `${job}.jsx`), buildJob(fs.readFileSync(scriptPath, "utf8"), args));
  const deadline = Date.now() + timeoutS * 1000;
  while (Date.now() < deadline) {
    if (fs.existsSync(resultFile)) {
      await sleep(200); // let the agent finish writing
      const text = fs.readFileSync(resultFile, "utf8").replace(/^\uFEFF/, "");
      return { job, ok: text.startsWith("OK"), text };
    }
    await sleep(500);
  }
  throw new Error(`job ${job} timed out after ${timeoutS}s`);
}

if (isMain(import.meta.url)) {
  const argv = process.argv.slice(2);
  const opt = (flag) => { const i = argv.indexOf(flag); return i >= 0 ? argv[i + 1] : undefined; };
  const script = argv.find((a, i) => !a.startsWith("--") && !["--args", "--name", "--timeout"].includes(argv[i - 1]));
  if (!script) {
    console.error("usage: run-job.mjs <script.jsx> [--args '<json>'] [--name <job>] [--timeout <s>]");
    process.exitCode = 2;
  } else {
    try {
      const r = await runJob(script, { args: opt("--args") ? JSON.parse(opt("--args")) : {}, name: opt("--name"), timeoutS: Number(opt("--timeout") ?? 600) });
      console.log(`${r.job}: ${r.text}`);
      if (!r.ok) process.exitCode = 1;
    } catch (error) {
      console.error(error.message);
      process.exitCode = 1;
    }
  }
}
