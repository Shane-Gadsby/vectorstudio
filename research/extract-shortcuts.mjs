#!/usr/bin/env node
// Extracts the default keyboard shortcut tables from the fetched Adobe docs
// (.research/illustrator-docs.json, made by fetch-illustrator-docs.console.js)
// into docs/parity/shortcuts-default.csv: one row per shortcut, facts only
// (section, command, Windows keys, macOS keys). Task 0.4.3's starting point.
//
// Adobe's page lists "the most helpful shortcuts", not every binding, so this
// is a partial baseline: the full .kys set still needs a licensed 30.1.
//
// Usage: node scripts/research/extract-shortcuts.mjs [path/to/illustrator-docs.json]

import fs from "node:fs";
import path from "node:path";
import { REPO_ROOT, isMain } from "../lib/sources.mjs";

export const SHORTCUTS_PAGE = "/illustrator/using/default-keyboard-shortcuts.html";

const cells = (line) => line.split("|").slice(1, -1).map((c) => c.trim());

/**
 * Parses the page's markdown tables. A table counts when its header row has
 * "Windows" and "macOS" columns; its section is the nearest `##` heading.
 * @returns {{ section: string, command: string, windows: string, macos: string }[]}
 */
export function parseShortcutTables(markdown) {
  const rows = [];
  let section = "";
  let columns = null;
  for (const line of markdown.split("\n")) {
    if (/^#{2,3} /.test(line)) {
      section = line.replace(/^#+ /, "").trim();
      columns = null;
      continue;
    }
    if (!line.startsWith("|")) {
      if (line.trim()) columns = null;
      continue;
    }
    const row = cells(line);
    if (!columns) {
      const win = row.findIndex((c) => /^windows$/i.test(c));
      const mac = row.findIndex((c) => /^mac ?os$/i.test(c));
      columns = win > 0 && mac > 0 ? { win, mac } : null;
      continue;
    }
    const command = row[0];
    if (!command) continue;
    rows.push({ section, command, windows: row[columns.win] ?? "", macos: row[columns.mac] ?? "" });
  }
  return rows;
}

export function toCsv(rows, meta) {
  const q = (s) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const header = "section,command,windows,macos,source,source_updated,verified_30_1";
  return [header, ...rows.map((r) =>
    [r.section, r.command, r.windows, r.macos, meta.url, meta.lastUpdated ?? "", ""].map(q).join(","),
  )].join("\n") + "\n";
}

if (isMain(import.meta.url)) {
  const input = process.argv[2] ?? path.join(REPO_ROOT, ".research", "illustrator-docs.json");
  const docs = JSON.parse(fs.readFileSync(input, "utf8"));
  const page = docs.pages?.[SHORTCUTS_PAGE];
  if (!page?.markdown) {
    console.error(`extract-shortcuts: ${SHORTCUTS_PAGE} is missing from ${input}; re-run the fetch script`);
    process.exitCode = 1;
  } else {
    const rows = parseShortcutTables(page.markdown);
    const out = path.join(REPO_ROOT, "docs", "parity", "shortcuts-default.csv");
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, toCsv(rows, page));
    const sections = new Set(rows.map((r) => r.section));
    console.log(`extract-shortcuts: ${rows.length} shortcuts in ${sections.size} sections → ${path.relative(REPO_ROOT, out)}`);
  }
}
