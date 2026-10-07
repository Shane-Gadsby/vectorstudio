#!/usr/bin/env node
// Art-stream scanner for live objects (task 0.3.5).
//
// Finds, in an `.ai` art stream, everything that isn't plain PostScript-style
// art: the dictionaries (`/ArtDictionary :`, `/SymbolInstance :`,
// `/ForeignObject :`, the `%AI17` Repeat objects), the plugin objects
// (`(Name) a b n XP` and their n bytes of hex data) and the `%AI17` versioned
// content markers. Findings: docs/ai-format/live-features-30.1.md.
//
// A dictionary is written in the dictionary language of ai-document-data.mjs,
// with the art's line prefix (`%_` for art old readers must skip, none inside
// `%AI17` versioned content). Two kinds of payload interrupt it, and are cut
// out as blobs, kept verbatim:
//   - ASCII85 data after `/Binary : /ASCII85Decode ,` or `/Data ,`: lines
//     that start with a bare `%`, up to `~>` (Live Paint, ForeignObject);
//   - art after `X=`, up to the matching `X+` (envelope, Repeat), which is
//     scanned in turn for the dictionaries inside it.
// `%%BeginData: n` payloads (raster pixels) are skipped by byte count.
//
// `--effects` lists the effect filters in the art styles (%AI9_BeginArtStyles):
// each BasicFilter's plugin name, title and parameter dictionary. `--named`
// lists each named object in the art with the effects of its style (how the
// hand-made fixtures' named rectangles are checked).
//
//   node scripts/research/ai-art-objects.mjs <file.ai>… [--keys] [--effects] [--named] [--json <out.json>]

import fs from "node:fs";
import { isMain } from "../lib/sources.mjs";
import { extractAiStream } from "../ai-dump.mjs";
import { parseDictionary, parseSectionLines, plain, tokenize, writeDictionary } from "./ai-document-data.mjs";
import { sectionText } from "./ai-write-spike.mjs";

/** Sections parsed elsewhere (ai-document-data.mjs, ai-text-document.mjs), skipped whole. */
const SKIP = new Map([
  ["%AI9_BeginDocumentData", "%AI9_EndDocumentData"],
  ["%AI11_BeginTextDocument", "%AI11_EndTextDocument"],
  ["%AI9_BeginArtStyles", "%AI9_EndArtStyles"],
  ["%AI10_BeginSVGFilter", "%AI10_EndSVGFilter"],
  ["%AI9_BeginArtStyleList", "%AI9_EndArtStyleList"],
]);

const DICTIONARY_START = /^ *\/\w+ :$/;
const PLUGIN_OBJECT = /^\((.*)\) (-?\d+) (-?\d+) (\d+) XP$/;
const BEGIN_DATA = /%%BeginData:\s*(\d+)/;

/** Reads the CRLF line at `pos`: { line, next }. A `%%BeginData: n` line's next skips its n bytes. */
function readLine(text, pos) {
  let end = text.indexOf("\r\n", pos);
  if (end < 0) end = text.length;
  const line = text.slice(pos, end);
  let next = Math.min(end + 2, text.length);
  const data = BEGIN_DATA.exec(line);
  if (data) next += Number(data[1]);
  return { line, next };
}

/** Strips `prefix` from a line of a prefixed run, or returns null if the line doesn't carry it. */
const unprefix = (line, prefix) => (line.startsWith(prefix) ? line.slice(prefix.length) : null);

/** Change in container depth over one logical line (`/Type :` opens, `;` closes). */
function depthChange(logical) {
  const tokens = tokenize(logical);
  let d = 0;
  tokens.forEach((t, i) => {
    if (t.kind === "name" && tokens[i + 1]?.kind === ":") d++;
    else if (t.kind === ";") d--;
  });
  return d;
}

/**
 * Reads the dictionary whose first line is at `start`, written with `prefix`.
 * @returns {{ start, end, prefix, raw, tree, blobs, blank }} where raw is the
 *   exact source text (the trailing blank prefix line included when `blank`).
 */
export function readDictionary(text, start, prefix) {
  const logical = [];
  const blobs = [];
  let pos = start;
  let depth = 0;
  let dataNext = false;
  do {
    if (pos >= text.length) throw new Error(`dictionary at ${start} is not closed`);
    if (dataNext) {
      // ASCII85 data: bare `%` lines up to the one holding `~>`, whatever they start with.
      const from = pos;
      let line;
      do ({ line, next: pos } = readLine(text, pos)); while (!line.includes("~>") && pos < text.length);
      logical.push(`\uE000${blobs.push({ kind: "ascii85", raw: text.slice(from, pos - 2) }) - 1}`);
      dataNext = false;
      continue;
    }
    const { line, next } = readLine(text, pos);
    const lg = unprefix(line, prefix);
    if (lg == null) throw new Error(`line at ${pos} lacks the dictionary's prefix ${JSON.stringify(prefix)}: ${JSON.stringify(line.slice(0, 60))}`);
    if (lg.trim() === "X=") {
      // Embedded art up to the matching X+, kept verbatim (its own prefixes and binary data included).
      const from = pos;
      let nest = 0;
      for (;;) {
        const r = readLine(text, pos);
        const inner = unprefix(r.line, prefix)?.trim();
        if (inner === "X=") nest++;
        else if (inner === "X+") nest--;
        pos = r.next;
        if (nest === 0) break;
        if (pos >= text.length) throw new Error(`X= at ${from} is not closed`);
      }
      logical.push(`\uE000${blobs.push({ kind: "art", raw: text.slice(from, pos - 2) }) - 1}`);
      continue;
    }
    logical.push(lg);
    depth += depthChange(lg);
    dataNext = /\/(ASCII85Decode|Data) ,\s*$/.test(lg);
    pos = next;
  } while (depth > 0 || dataNext);
  // A blank prefix line usually ends the run.
  const after = readLine(text, pos);
  const blank = pos < text.length && after.line === prefix;
  const end = blank ? after.next : pos;
  return { start, end, prefix, raw: text.slice(start, end), tree: parseDictionary(logical.join("\n"), blobs), blobs, blank };
}

/** Writes a dictionary read by readDictionary back, which must equal its raw text. */
export function writeArtDictionary(d) {
  return writeDictionary(d.tree, d.prefix) + (d.blank ? `${d.prefix}\r\n` : "");
}

/**
 * Scans art-stream text. Items, in stream order:
 *   { kind: "dictionary", …readDictionary, type, after, nested: [items of its art blobs] }
 *   { kind: "plugin", start, end, name, args: [a, b], data: Buffer, after }
 *   { kind: "versioned", start, line }            (%AI17_… markers)
 * `after` is the art line just before (without prefix): what the item follows,
 * as `U` (a group closed), `f` (a filled path), `N` (a raster) or `XP`.
 */
export function scanArt(text) {
  const items = [];
  let pos = 0;
  let previous = "";
  while (pos < text.length) {
    const { line, next } = readLine(text, pos);
    const skipTo = SKIP.get(line);
    if (skipTo) {
      const at = text.indexOf(`\r\n${skipTo}`, pos);
      pos = at < 0 ? text.length : at + 2;
      continue;
    }
    if (line.startsWith("%AI17_")) {
      items.push({ kind: "versioned", start: pos, line });
      pos = next;
      continue;
    }
    const prefix = line.startsWith("%_") ? "%_" : "";
    const logical = line.slice(prefix.length);
    if (DICTIONARY_START.test(logical)) {
      const d = readDictionary(text, pos, prefix);
      const type = d.tree.entries[0]?.value.type;
      const nested = d.blobs.filter((b) => b.kind === "art").flatMap((b) => scanArt(b.raw));
      items.push({ kind: "dictionary", type, after: previous, nested, ...d });
      pos = d.end;
      continue;
    }
    const xp = PLUGIN_OBJECT.exec(logical);
    if (xp) {
      // n bytes as hex on the following `%` lines (60 digits each).
      const n = Number(xp[4]);
      let hex = "";
      let p = next;
      while (hex.length < 2 * n) {
        const r = readLine(text, p);
        hex += r.line.slice(1 + prefix.length);
        p = r.next;
      }
      items.push({ kind: "plugin", start: pos, end: p, name: xp[1], args: [Number(xp[2]), Number(xp[3])], data: Buffer.from(hex, "hex"), after: previous });
      previous = "XP";
      pos = p;
      continue;
    }
    if (logical.trim()) previous = logical.trim();
    pos = next;
  }
  return items;
}

/** Every dictionary in a scan, nested ones included, depth first. */
export function allDictionaries(items) {
  return items.flatMap((i) => (i.kind === "dictionary" ? [i, ...allDictionaries(i.nested)] : []));
}

/**
 * The filters of every art style in art-stream text, in order:
 * { style, filter, title, params } where filter is the /Filter operands'
 * first string ("Adobe Drop Shadow"), and params the plain view of its
 * parameter dictionary (null when it has none).
 */
export function styleFilters(text) {
  const block = sectionText(text, "%AI9_BeginArtStyles", "%AI9_EndArtStyles");
  if (!block) return [];
  const tree = parseSectionLines(block.split("\r\n").slice(1, -1));
  const out = [];
  const operand = (v, key) => v.entries.find((e) => e.key === key)?.value.operands[0];
  const walk = (v, style) => {
    if (!v || typeof v !== "object") return;
    if (v.type === "KnownStyle") style = plain({ type: null, operands: [operand(v, "/Name")] })[0];
    if (v.type === "BasicFilter") {
      const dict = v.entries.find((e) => e.value.type === "Dictionary")?.value ?? v.inner?.of;
      const title = operand(v, "/Title");
      out.push({ style, filter: plain({ type: null, operands: [operand(v, "/Filter")] })[0],
        title: title ? plain({ type: null, operands: [title] })[0] : null, params: dict ? plain(dict) : null });
    }
    for (const e of v.entries ?? []) walk(e.value, style);
    walk(v.inner, style);
    walk(v.of, style);
  };
  walk(tree, null);
  return out;
}

/**
 * Decodes the `(data)` of a Photoshop-style effect (`PSAdapter_plugin_*`): a
 * flattened descriptor, big-endian. A u32 version (1), then items to the end:
 * a four-character key, a u32 form, a four-character type, and the value:
 *   form 0:          type `long` (i32), `doub` (f64) or `bool` (u8)
 *   form 0x2000:     an enum; the type is the enum type, then a 4cc value
 *   form 0x80000000: a nested descriptor; the type is its class, then a u32
 *                    byte length and the descriptor (version and items)
 * Returns { key: value }, enums as "Type.Value", nested ones as objects with
 * "@class". Throws on anything else, so an unknown form shows up.
 */
export function decodePluginDescriptor(bytes) {
  const cc = (at) => bytes.toString("latin1", at, at + 4);
  const read = (start, end) => {
    if (bytes.readUInt32BE(start) !== 1) throw new Error(`descriptor version ${bytes.readUInt32BE(start)} at ${start}`);
    const out = {};
    let p = start + 4;
    while (p < end) {
      const key = cc(p), form = bytes.readUInt32BE(p + 4), type = cc(p + 8);
      p += 12;
      if (form === 0x2000) { out[key] = `${type.trim()}.${cc(p).trim()}`; p += 4; }
      else if (form === 0x80000000) {
        const length = bytes.readUInt32BE(p);
        out[key] = { "@class": type.trim(), ...read(p + 4, p + 4 + length) };
        p += 4 + length;
      } else if (form === 0 && type === "long") { out[key] = bytes.readInt32BE(p); p += 4; }
      else if (form === 0 && type === "doub") { out[key] = bytes.readDoubleBE(p); p += 8; }
      else if (form === 0 && type === "bool") { out[key] = bytes[p] !== 0; p += 1; }
      else throw new Error(`unknown item ${key} form ${form.toString(16)} type ${type} at ${p - 12}`);
    }
    return out;
  };
  return read(0, bytes.length);
}

/**
 * Each named object in the art, in stream order, with its art style and that
 * style's effect filters: [{ name, style, effects: [styleFilters entries] }].
 * An object's name is its XMLUID (XML-name escaped: `_x31__Stylize…` for
 * "1 Stylize…"); the next `n (Style) XW` after it is its style. Fills,
 * strokes and plumbing filters are left out of `effects`.
 */
export function namedObjectEffects(text) {
  const filters = styleFilters(text);
  const body = text.slice(text.indexOf("%AI5_BeginLayer"));
  const out = [];
  const re = /\/XMLUID : \(([^)]*)\) ;|\d+ \(([^)]+)\) XW/g;
  let m, name = null;
  while ((m = re.exec(body))) {
    if (m[1]) { name = m[1]; continue; }
    if (name == null) continue;
    out.push({ name, style: m[2], effects: filters.filter((f) => f.style === m[2] && !/ Style Filter$|^Conduit Filter$/.test(f.filter)) });
    name = null;
  }
  return out;
}

/** The art stream of `.ai` bytes as latin1 text. */
export function artText(aiBytes) {
  const { data } = extractAiStream(aiBytes);
  return data ? Buffer.from(data).toString("latin1") : "";
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const j = args.indexOf("--json");
  const jsonOut = j >= 0 ? args[j + 1] : null;
  const files = args.filter((a, i) => !a.startsWith("--") && (j < 0 || i !== j + 1));
  const all = {};
  for (const file of files) {
    const text = artText(fs.readFileSync(file));
    const items = scanArt(text);
    const dicts = allDictionaries(items);
    const exact = dicts.filter((d) => writeArtDictionary(d) === d.raw).length;
    const plugins = items.filter((i) => i.kind === "plugin");
    console.log(`${file}: ${dicts.length} dictionaries (${exact} written back byte for byte), ` +
      `${plugins.length} plugin objects${plugins.length ? ` (${plugins.map((p) => `${p.name} ${p.args.join(" ")} +${p.data.length} B`).join("; ")})` : ""}`);
    if (args.includes("--keys")) {
      const show = (list, indent) => {
        for (const i of list) {
          if (i.kind === "versioned") console.log(`${indent}${i.line}`);
          else if (i.kind === "plugin") console.log(`${indent}XP ${i.name} [${i.args}] after ${i.after}: ${i.data.toString("hex")}`);
          else {
            const keys = i.tree.entries[0]?.value.entries.map((e) => e.key ?? ",").join(" ");
            console.log(`${indent}${i.prefix || "  "} /${i.type} after ${JSON.stringify(i.after)}: ${keys}`);
            show(i.nested, `${indent}    `);
          }
        }
      };
      show(items, "  ");
    }
    if (args.includes("--effects")) {
      for (const f of styleFilters(text)) {
        if (!f.params || / Style Filter$|^Conduit Filter$/.test(f.filter)) continue; // fills, strokes and plumbing
        const data = f.filter.startsWith("PSAdapter_plugin_") && f.params.data?.["@operands"]?.[0]?.["@ascii85"];
        const params = data ? { ...f.params, data: decodePluginDescriptor(Buffer.from(data, "hex")) } : f.params;
        console.log(`  ${f.style}: ${f.filter}${f.title ? ` (${f.title})` : ""} ${JSON.stringify(params)}`);
      }
    }
    if (args.includes("--named")) {
      for (const o of namedObjectEffects(text)) {
        console.log(`  ${o.name}: ${o.effects.map((f) => `${f.filter} (${f.title}) ${Object.keys(f.params ?? {}).filter((k) => k !== "@flags").length} keys`).join(", ") || "no effect"}`);
      }
    }
    all[file] = items.map(function view(i) {
      if (i.kind === "plugin") return { plugin: i.name, args: i.args, data: i.data.toString("hex"), after: i.after };
      if (i.kind === "versioned") return { versioned: i.line };
      return { dictionary: i.type, prefix: i.prefix, after: i.after, value: plain(i.tree.entries[0].value), nested: i.nested.map(view) };
    });
  }
  if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(all, null, 1));
}
