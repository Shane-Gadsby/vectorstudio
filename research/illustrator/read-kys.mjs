#!/usr/bin/env node
// Reads Illustrator's keyboard-shortcut set (`.kys`) from the licensed VM and checks it against
// `docs/parity/matrix.csv`. This is the authority for every `field: Shortcut` row: the file lists
// each command with the keys bound to it, or `/Key 0` when nothing is bound, so it settles both
// "what is the shortcut" and "is there one at all".
//
//   node research/illustrator/read-kys.mjs fetch          # copy the set out of the VM over sftp
//   node research/illustrator/read-kys.mjs dump [--bound] # command id -> chord
//   node research/illustrator/read-kys.mjs check          # cross-check the matrix, report conflicts
//
// The set lives at %APPDATA%\Adobe\Adobe Illustrator 30 Settings\en_US\x64\keys.kys in the guest.
// It is the licensed install's own file, which is the only sanctioned source — never the
// unlicensed repack at ../illustrator (see AGENTS.md).

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const exec = promisify(execFile);
const HERE = path.dirname(fileURLToPath(import.meta.url));

export const GUEST_KYS =
  process.env.VS_KYS ?? "/C:/Users/schme16/AppData/Roaming/Adobe/Adobe Illustrator 30 Settings/en_US/x64";
/** Gitignored: it is the licensed install's own file, so it stays out of the repository. */
export const LOCAL_KYS = path.join(os.homedir(), ".research", "kys");

/** F1..F12 are encoded 14..25, so a bare number is not a character. */
export function keyName(code) {
  if (code === 0) return null;
  if (code >= 14 && code <= 25) return `F${code - 13}`;
  if (code >= 32 && code < 127) return String.fromCharCode(code).toUpperCase();
  return `<${code}>`;
}

export const MODIFIER_BITS = [
  [128, "Alt"],
  [64, "Ctrl"],
  [32, "Shift"],
];

/** A chord as (sorted modifiers, key), so `Shift+Ctrl+N` and `Cmd+Shift+N` compare equal. */
export function chordOf({ Modifiers = 0, Key = 0 }) {
  const key = keyName(Key);
  if (!key) return null;
  return { mods: MODIFIER_BITS.filter(([bit]) => Modifiers & bit).map(([, n]) => n).sort(), key };
}

export const formatChord = (c) => (c ? [...c.mods, c.key].join("+") : "(none)");

/** The same shape from a matrix cell (`Shift+Ctrl+N`, `Ctrl++`, `F7`). */
export function parseChord(text) {
  const s = (text ?? "").trim();
  if (!s) return null;
  const parts = s.split("+");
  const mods = [];
  let key = "";
  parts.forEach((part, i) => {
    const t = part.trim();
    const last = i === parts.length - 1;
    const low = t.toLowerCase();
    if (!last && (low === "ctrl" || low === "cmd" || low === "command")) mods.push("Ctrl");
    else if (!last && (low === "alt" || low === "opt" || low === "option")) mods.push("Alt");
    else if (!last && low === "shift") mods.push("Shift");
    else key = t === "" ? "+" : t.toUpperCase();
  });
  return key ? { mods: [...new Set(mods)].sort(), key } : null;
}

export const sameChord = (a, b) =>
  !!a && !!b && a.key === b.key && a.mods.length === b.mods.length && a.mods.every((m, i) => m === b.mods[i]);

/**
 * Parse a `.kys` set.
 *
 * It is a PostScript-style dictionary of `/Menus`, `/Tools` and `/type` sections holding
 * `/<command> { /Context n /Modifiers n /Represent n /Key n }`. A command whose name has spaces
 * escapes them (`/Live\ Pathfinder\ Outline`), which a naive `[^\s]+` id pattern misses — that
 * mistake reads a bound command as absent. `/Key 0` means the command exists with nothing bound,
 * so the file distinguishes "no shortcut" from "not a command".
 */
export function parseKys(text) {
  const entries = new Map();
  const re = /\/((?:[^\s{/\\]|\\ )+)\s*\{\s*((?:\/\w+\s+-?\d+\s*)+)\}/g;
  for (const m of text.matchAll(re)) {
    const id = m[1].replace(/\\ /g, " ");
    const fields = {};
    for (const f of m[2].matchAll(/\/(\w+)\s+(-?\d+)/g)) fields[f[1]] = Number(f[2]);
    // A command can appear per context (a menu item and a type-mode binding); keep the bound one.
    const existing = entries.get(id);
    if (!existing || (!existing.Key && fields.Key)) entries.set(id, fields);
  }
  return entries;
}

async function fetchKys(host) {
  fs.mkdirSync(LOCAL_KYS, { recursive: true });
  const batch = [`cd "${GUEST_KYS}"`, `lcd ${LOCAL_KYS}`, "get keys.kys", "bye"].join("\n");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vs-kys-"));
  const batchFile = path.join(dir, "b.sftp");
  fs.writeFileSync(batchFile, `${batch}\n`);
  try {
    const { SSH_KEY, SSH_USER } = await import("./ssh-run.mjs");
    await exec("sftp", ["-b", batchFile, "-i", SSH_KEY, "-o", "BatchMode=yes", `${SSH_USER}@${host}`], {
      timeout: 60_000,
    });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  return path.join(LOCAL_KYS, "keys.kys");
}

export function loadLocal() {
  const file = path.join(LOCAL_KYS, "keys.kys");
  if (!fs.existsSync(file)) throw new Error(`no local copy: run \`read-kys.mjs fetch\` first (${file})`);
  return parseKys(fs.readFileSync(file, "latin1"));
}

/** Compare each matrix shortcut row with the set. */
export function check(entries, rows) {
  const out = { agree: [], differ: [], unbound: [], absent: [], noId: [] };
  for (const row of rows) {
    if (row.field !== "Shortcut" || row.scope !== "in" || !row.default.trim()) continue;
    const id = row.command_id.trim();
    if (!id) {
      out.noId.push(row);
      continue;
    }
    const f = entries.get(id);
    if (!f) {
      out.absent.push(row);
      continue;
    }
    const theirs = chordOf(f);
    if (!theirs) {
      out.unbound.push(row);
      continue;
    }
    (sameChord(parseChord(row.default), theirs) ? out.agree : out.differ).push({ row, theirs });
  }
  return out;
}

function readMatrix(repo) {
  const text = fs.readFileSync(path.join(repo, "docs/parity/matrix.csv"), "utf8");
  const records = [];
  let cur = "";
  for (const line of text.split("\n")) {
    cur = cur ? `${cur}\n${line}` : line;
    if ((cur.match(/"/g) ?? []).length % 2 === 0) {
      if (cur) records.push(cur);
      cur = "";
    }
  }
  const split = (line) => {
    const out = [];
    let field = "";
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"' && quoted && line[i + 1] === '"') (field += '"'), i++;
      else if (c === '"') quoted = !quoted;
      else if (c === "," && !quoted) (out.push(field), (field = ""));
      else field += c;
    }
    out.push(field);
    return out;
  };
  const header = split(records[0]);
  return records.slice(1).map((r) => Object.fromEntries(split(r).map((v, i) => [header[i], v])));
}

async function main(argv) {
  const [command = "check", ...rest] = argv;
  const repo = path.resolve(HERE, "../..");
  if (command === "fetch") {
    const { vmHost } = await import("./ssh-run.mjs");
    const file = await fetchKys(await vmHost());
    const entries = parseKys(fs.readFileSync(file, "latin1"));
    const bound = [...entries.values()].filter((f) => f.Key).length;
    process.stdout.write(`fetched ${file}\n  ${entries.size} commands, ${bound} with a key bound\n`);
    return 0;
  }
  const entries = loadLocal();
  if (command === "dump") {
    const onlyBound = rest.includes("--bound");
    for (const [id, f] of [...entries].sort()) {
      const c = chordOf(f);
      if (onlyBound && !c) continue;
      process.stdout.write(`${id}\t${formatChord(c)}\n`);
    }
    return 0;
  }
  if (command !== "check") throw new Error(`unknown command: ${command}`);
  const r = check(entries, readMatrix(repo));
  const bound = [...entries.values()].filter((f) => f.Key).length;
  process.stdout.write(
    `keys.kys: ${entries.size} commands, ${bound} bound, ${entries.size - bound} explicitly unbound\n\n` +
      `matrix shortcut rows checked against it:\n` +
      `  agree             ${String(r.agree.length).padStart(4)}\n` +
      `  DIFFER            ${String(r.differ.length).padStart(4)}\n` +
      `  unbound in 30.1   ${String(r.unbound.length).padStart(4)}  (the row claims a shortcut the install does not bind)\n` +
      `  id not in the set ${String(r.absent.length).padStart(4)}  (a different id spelling, or not a menu command)\n` +
      `  no command_id     ${String(r.noId.length).padStart(4)}  (cannot be joined)\n`,
  );
  const show = (title, items, fmt) => {
    if (!items.length) return;
    process.stdout.write(`\n${title}\n`);
    for (const it of items.slice(0, 40)) process.stdout.write(`  ${fmt(it)}\n`);
    if (items.length > 40) process.stdout.write(`  … and ${items.length - 40} more\n`);
  };
  show("DIFFER — the install disagrees with the row:", r.differ, ({ row, theirs }) =>
    `${row.id.padEnd(10)} ${row.element.slice(0, 44).padEnd(46)} matrix ${row.default.padEnd(18)} 30.1 ${formatChord(theirs)}`,
  );
  show("Unbound in 30.1 — the row should have no shortcut:", r.unbound, (row) =>
    `${row.id.padEnd(10)} ${row.element.slice(0, 44).padEnd(46)} matrix claims ${row.default}`,
  );
  return r.differ.length || r.unbound.length ? 1 : 0;
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
