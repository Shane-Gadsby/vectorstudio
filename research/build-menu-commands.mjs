#!/usr/bin/env node
// Builds docs/parity/menu-commands-30.1.csv: Illustrator 30.1's menu commands
// with their menu path, internal command id (the string app.executeMenuCommand
// takes, and the key in .kys files) and default key.
//
// Illustrator's custom-drawn UI can't be read from outside (see
// illustrator/probe-menus.ps1), so the tree is assembled from three sources:
// 1. .research/illustrator-30.1/vs-defaults.kys: the default shortcut set
//    saved from a LICENSED 30.1. Authoritative for which command ids exist
//    and their keys; it has no menu paths.
// 2. .research/ten-artai-menu-commands.html: a community list (ten-artai.com,
//    "Illustrator CC (ver.25) menu commands list") of menu path → command id.
//    Gives the paths, for ids that 30.1 still has.
// 3. docs/parity/shortcuts-30.1.csv: the 30.1 Keyboard Shortcuts text export
//    (display names, top-level menu, keys). Places ids the list lacks, by
//    matching their key under the same top-level menu.
//
// Usage: node scripts/research/build-menu-commands.mjs

import fs from "node:fs";
import path from "node:path";
import { REPO_ROOT, isMain } from "../lib/sources.mjs";
import { parseCsv, stringifyCsv } from "../lib/csv.mjs";

/** Parses a .kys file into { SectionName: [{ id, context, modifiers, represent, key }] }. */
export function parseKys(text) {
  const sections = {};
  let section = null;
  let entry = null;
  for (const line of text.replace(/\r\n?/g, "\n").split("\n")) {
    let m;
    if ((m = /^\/(\S+) \{$/.exec(line))) {
      section = m[1];
      sections[section] = [];
    } else if (section && (m = /^\t\/((?:\\ |[^ ])+) \{$/.exec(line))) {
      entry = { id: m[1].replace(/\\ /g, " ") };
      sections[section].push(entry);
    } else if (entry && (m = /^\t\t\/(\w+) (-?\d+)$/.exec(line))) {
      entry[m[1].toLowerCase()] = Number(m[2]);
    }
  }
  return sections;
}

const KEY_NAMES = { 9: "Tab", 14: "F1", 15: "F2", 16: "F3", 17: "F4", 18: "F5", 19: "F6", 20: "F7", 21: "F8", 22: "F9", 23: "F10", 24: "F11", 25: "F12" };
/** A .kys entry's key as Windows text: modifier bits 128 Alt, 32 Shift, 64 Ctrl. */
export function kysChord(entry) {
  if (!entry.key) return "";
  const mods = [];
  if (entry.modifiers & 128) mods.push("Alt");
  if (entry.modifiers & 32) mods.push("Shift");
  if (entry.modifiers & 64) mods.push("Ctrl");
  return [...mods, KEY_NAMES[entry.key] ?? String.fromCharCode(entry.key)].join("+");
}

const decode = (s) => s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&gt;/g, ">").replace(/&lt;/g, "<")
  .replace(/&#8230;/g, "…").replace(/&#8217;/g, "’").replace(/&nbsp;/g, " ").trim();

/** Parses the ten-artai page: <h3>Menu</h3> then rows of <td>path</td><td>id</td>. */
export function parseMenuList(html) {
  const rows = [];
  let menu = null;
  for (const m of html.matchAll(/<h3>([^<]+)<\/h3>|<tr><td>(.*?)<\/td><td>(.*?)<\/td><\/tr>/g)) {
    if (m[1]) menu = decode(m[1]);
    else rows.push({ menu, path: decode(m[2]).replace(/\s*[>/]\s*/g, " > "), id: decode(m[3]) });
  }
  return rows;
}

const norm = (s) => s.toLowerCase().replace(/[…]|\.\.\./g, "").replace(/\s+/g, " ").trim();

/**
 * Joins the sources. Every 30.1 menu id appears once. in_30_1 is "yes (id)"
 * when the .kys has the id, "yes (name)" when only the shortcut export has the
 * name, and "unconfirmed" otherwise (kept so renames and removals stay
 * visible). Paths from the v25 list may be stale (the 3D effects moved), so
 * they are labelled by source and never count as verified.
 */
export function buildMenuCommands({ kys, list, shortcuts }) {
  const kysMenus = kys.Menus ?? [];
  const byId = new Map(kysMenus.map((e) => [e.id.toLowerCase(), e]));
  // The .kys omits some commands the text export lists (Area Type Options, Type on a Path effects),
  // so a display-name match under the same top-level menu also confirms a command exists.
  const exportNames = new Set(shortcuts.filter((x) => x.section === "Menu Commands").map((x) => `${x.menu}|${norm(x.command)}`));
  const out = [];
  const placed = new Set();
  for (const r of list) {
    const k = byId.get(r.id.toLowerCase());
    const leaf = r.path.split(" > ").pop();
    const named = exportNames.has(`${r.menu}|${norm(leaf)}`);
    const notes = [];
    if (k && k.id !== r.id) notes.push(`list spells it ${r.id}`);
    if (!k && named) notes.push("id not in the 30.1 .kys; name is in the 30.1 shortcut export");
    if (!k && !named) notes.push("not found in 30.1's .kys or shortcut export: removed or renamed? check the menu");
    out.push({
      menu: r.menu, path: `${r.menu} > ${r.path}`, command_id: k ? k.id : r.id, key: k ? kysChord(k) : "",
      in_30_1: k ? "yes (id)" : named ? "yes (name)" : "unconfirmed", path_source: "ten-artai (v25)", note: notes.join("; "),
    });
    if (k) placed.add(k.id);
  }
  // Ids only 30.1 has: place by key under the text export's top-level menu.
  const exportByKey = new Map();
  for (const s of shortcuts.filter((x) => x.section === "Menu Commands" && x.key)) {
    const key = s.key.toLowerCase();
    if (!exportByKey.has(key)) exportByKey.set(key, []);
    exportByKey.get(key).push(s);
  }
  for (const e of kysMenus) {
    if (placed.has(e.id)) continue;
    const chord = kysChord(e);
    const hits = chord ? exportByKey.get(chord.toLowerCase()) ?? [] : [];
    const hit = hits.length === 1 ? hits[0] : null;
    out.push({
      menu: hit ? hit.menu : "", path: hit ? `${hit.menu} > … > ${hit.command}` : "", command_id: e.id, key: chord,
      in_30_1: "yes (id)", path_source: hit ? "shortcut export (key match)" : "",
      note: hit ? "" : e.context === 1 ? "text-editing context; no menu path known" : "no menu path known",
    });
  }
  const order = ["File", "Edit", "Object", "Type", "Select", "Effect", "View", "Window", "Help", "Other Panel"];
  const rank = (m) => (order.includes(m) ? order.indexOf(m) : m.startsWith("Other") ? order.length : order.length + 1);
  return out.map((r, i) => ({ r, i })).sort((a, b) => rank(a.r.menu) - rank(b.r.menu) || a.i - b.i).map(({ r }) => r);
}

export const COLUMNS = ["menu", "path", "command_id", "key", "in_30_1", "path_source", "note"];

if (isMain(import.meta.url)) {
  const research = path.join(REPO_ROOT, ".research");
  const kys = parseKys(fs.readFileSync(path.join(research, "illustrator-30.1", "vs-defaults.kys"), "utf8"));
  const list = parseMenuList(fs.readFileSync(path.join(research, "ten-artai-menu-commands.html"), "utf8"));
  const shortcuts = parseCsv(fs.readFileSync(path.join(REPO_ROOT, "docs", "parity", "shortcuts-30.1.csv"), "utf8")).rows;
  const rows = buildMenuCommands({ kys, list, shortcuts });
  const out = path.join(REPO_ROOT, "docs", "parity", "menu-commands-30.1.csv");
  fs.writeFileSync(out, stringifyCsv(COLUMNS, rows));
  const count = (f) => rows.filter(f).length;
  console.log(`build-menu-commands: ${rows.length} rows → ${path.relative(REPO_ROOT, out)}`);
  console.log(`  in 30.1 with a (v25) path:         ${count((r) => r.in_30_1.startsWith("yes") && r.path_source.startsWith("ten"))}`);
  console.log(`  in 30.1, placed by key:            ${count((r) => r.path_source.startsWith("shortcut"))}`);
  console.log(`  in 30.1, no path known:            ${count((r) => r.in_30_1.startsWith("yes") && !r.path)}`);
  console.log(`  unconfirmed in 30.1:               ${count((r) => r.in_30_1 === "unconfirmed")}`);
}
