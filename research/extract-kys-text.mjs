#!/usr/bin/env node
// Parses the text export of Illustrator's Edit > Keyboard Shortcuts > Export
// Text (the [Illustrator Defaults] set, from a licensed 30.1) into
// docs/parity/shortcuts-30.1.csv. This is the full default set for task 0.4.3;
// shortcuts-default.csv (from Adobe's help page) is a partial subset.
//
// The export's quirks, all handled here:
// - CRLF line endings.
// - "Tools": one tool per line, "Name<TAB>Key", or just "Name" when unbound.
// - "Menu Commands": the menu tree flattened to one item per line, with NO
//   separator between command and key ("NewCtrl+N"). Keys are recognised as
//   a trailing modifier chord or function key. Submenu nesting is lost; only
//   the top-level menu is known, tracked by the fixed order of the menus.
// - After the menus come keyboard-only command groups headed "Other Select",
//   "Other Text", "Other Object", "Other Panel" and "Other Misc"; their rows
//   get menu "Other: Select" and so on.
// - Keys are Windows keys (the export was made on Windows). macOS swaps Ctrl
//   for Cmd and Alt for Option.
//
// Usage: node scripts/research/extract-kys-text.mjs [export.txt]

import fs from "node:fs";
import path from "node:path";
import { REPO_ROOT, isMain } from "../lib/sources.mjs";
import { stringifyCsv } from "../lib/csv.mjs";

export const TOP_MENUS = ["File", "Edit", "Object", "Type", "Select", "Effect", "View", "Window", "Help"];
const OTHER_GROUP = /^Other (Select|Text|Object|Panel|Misc)$/;

// A trailing chord ("Alt+Shift+Ctrl+S", "Ctrl+[", "Shift+Ctrl+1"), or a bare function key.
const CHORD = /((?:(?:Alt|Shift|Ctrl)\+)+(?:F\d{1,2}|Tab|Space|Enter|Esc|Delete|Backspace|Home|End|PgUp|PgDn|Up|Down|Left|Right|.))$|(F\d{1,2})$/;

/** Splits "NewCtrl+N" into { command: "New", key: "Ctrl+N" }. */
export function splitMenuLine(line) {
  const m = CHORD.exec(line);
  if (!m || m.index === 0) return { command: line.trim(), key: "" };
  return { command: line.slice(0, m.index).trim(), key: m[0] };
}

/** @returns {{ section: string, menu: string, command: string, key: string }[]} */
export function parseKysText(text) {
  const rows = [];
  let section = "";
  let menuIndex = -1;
  let other = "";
  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.replace(/\s+$/, "");
    if (!line) continue;
    if (line === "Tools" || line === "Menu Commands") {
      section = line;
      menuIndex = -1;
      continue;
    }
    if (section === "Tools") {
      const [command, key = ""] = line.split("\t");
      rows.push({ section, menu: "", command: command.trim(), key: key.trim() });
    } else if (section === "Menu Commands") {
      if (!other && line === TOP_MENUS[menuIndex + 1]) {
        menuIndex++;
        continue;
      }
      const group = OTHER_GROUP.exec(line);
      if (group && menuIndex === TOP_MENUS.length - 1) {
        other = `Other: ${group[1]}`;
        continue;
      }
      const { command, key } = line.includes("\t") ? { command: line.split("\t")[0].trim(), key: line.split("\t")[1].trim() } : splitMenuLine(line);
      rows.push({ section, menu: other || (TOP_MENUS[menuIndex] ?? ""), command, key });
    }
  }
  return rows;
}

if (isMain(import.meta.url)) {
  const input = process.argv[2] ?? path.join(REPO_ROOT, ".research", "illustrator-30.1", "shortcuts-30.1.txt");
  const rows = parseKysText(fs.readFileSync(input, "utf8"));
  const out = path.join(REPO_ROOT, "docs", "parity", "shortcuts-30.1.csv");
  fs.writeFileSync(out, stringifyCsv(["section", "menu", "command", "key"], rows));
  const bound = rows.filter((r) => r.key).length;
  console.log(`extract-kys-text: ${rows.length} commands (${bound} with a default key) → ${path.relative(REPO_ROOT, out)}`);
}
