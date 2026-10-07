#!/usr/bin/env node
// `%AI11_BeginTextDocument` inspector (task 0.3.3).
//
// The block holds two ASCII85 payloads, `/AI11TextDocument` and
// `/AI11UndoFreeTextDocument`, with the document ruler origin
// (`x y /RulerOrigin ,`) after the first:
//
//   %AI11_BeginTextDocument
//   /AI11TextDocument : /ASCII85Decode ,
//   %<ascii85 lines>…~>
//   7991 8341 /RulerOrigin ,
//   ;
//   /AI11UndoFreeTextDocument : /ASCII85Decode ,
//   %<ascii85 lines>…~>
//   ;
//   %AI11_EndTextDocument
//
// Each payload decodes to Adobe's binary EngineData tree. This parses both
// with PhotoSuite's BinaryTreeParser (pulled into src/photosuite/ by
// `npm run shared:sync`), checks that PhotoSuite's serializer writes the same
// bytes back (or at least an equal tree), expands the numeric wire keys with
// PhotoSuite's PSD key map and lists the keys it doesn't name, and lists the
// stories' text. Findings: docs/ai-format/text-document-30.1.md.
//
//   node scripts/research/ai-text-document.mjs <file.ai>… [--json] [--dump <out.json>]

import fs from "node:fs";
import { isMain } from "../lib/sources.mjs";
import { decodeAscii85, extractAiStream } from "../ai-dump.mjs";
import { sectionText } from "./ai-write-spike.mjs";
import { BinaryTreeParser } from "../../src/photosuite/document/formats/psd/engine-binary-parsers.js";
import { EngineDataCodec } from "../../src/photosuite/features/text/engine-data-codec.js";

/** Splits the block into its two ASCII85 payloads and the ruler origin. */
export function splitTextDocument(block) {
  const parts = { textDocument: "", undoFree: "", rulerOrigin: null, names: [] };
  let current = null;
  for (const line of block.split(/\r\n|\r|\n/)) {
    let m;
    if ((m = /^\/(AI11\w+) : \/ASCII85Decode ,$/.exec(line))) {
      parts.names.push(m[1]);
      current = m[1] === "AI11TextDocument" ? "textDocument" : m[1] === "AI11UndoFreeTextDocument" ? "undoFree" : null;
    } else if ((m = /^(-?[\d.]+) (-?[\d.]+) \/RulerOrigin ,$/.exec(line))) {
      parts.rulerOrigin = [Number(m[1]), Number(m[2])];
    } else if (line === ";") {
      current = null;
    } else if (current && line.startsWith("%") && !line.startsWith("%AI")) {
      parts[current] += line.slice(1);
    }
  }
  return parts;
}

/** A write buffer with the interface PhotoSuite's serializers expect. */
export function growableBuffer() {
  return {
    size: 16,
    data: new Uint8Array(16),
    ensureCapacity(offset, count) {
      if (offset + count <= this.size) return;
      while (offset + count > this.size) this.size *= 2;
      const grown = new Uint8Array(this.size);
      grown.set(this.data);
      this.data = grown;
    },
  };
}

/** Parses one payload; reports whether PhotoSuite's serializer reproduces its bytes. */
export function parsePayload(ascii85) {
  const bytes = decodeAscii85(ascii85);
  const tree = BinaryTreeParser.parse(bytes);
  const buf = growableBuffer();
  const len = BinaryTreeParser.serialize(tree, buf);
  const rewritten = Buffer.from(buf.data.subarray(0, len));
  let firstDiff = -1;
  const n = Math.min(rewritten.length, bytes.length);
  for (let i = 0; i < n; i++) if (rewritten[i] !== bytes[i]) { firstDiff = i; break; }
  if (firstDiff < 0 && rewritten.length !== bytes.length) firstDiff = n;
  const reparsed = BinaryTreeParser.parse(rewritten);
  const semanticDiff = treeDifference(tree, reparsed);
  const readable = EngineDataCodec.expandEngineDataWire(tree);
  const keyMapDiff = treeDifference(tree, EngineDataCodec.collapseEngineDataWire(readable));
  return { bytes, tree, rewritten, roundTrips: firstDiff < 0, firstDiff, semanticallyEqual: !semanticDiff, semanticDiff,
    readable, unmapped: [...unmappedWireKeys(readable)], keyMapRoundTrips: !keyMapDiff, keyMapDiff };
}

/**
 * First difference between two parsed trees, comparing numbers ("f"/"i"
 * prefixed values, or plain numbers) by value; null when they are equal.
 */
export function treeDifference(a, b, path = "") {
  if (typeof a === "string" && typeof b === "string") {
    const num = /^[fi]?-?(\d+\.?\d*|\.\d+)(e-?\d+)?$/;
    if (a === b) return null;
    if (num.test(a) && num.test(b) && a[0] === b[0] && Number(a.replace(/^[fi]/, "")) === Number(b.replace(/^[fi]/, ""))) return null;
    return { path, a, b };
  }
  if (typeof a !== typeof b || Array.isArray(a) !== Array.isArray(b)) return { path, a: typeof a, b: typeof b };
  if (a && typeof a === "object") {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) {
      const d = treeDifference(a[k], b[k], Array.isArray(a) ? `${path}[${k}]` : path ? `${path}.${k}` : k);
      if (d) return d;
    }
    return null;
  }
  return a === b ? null : { path, a, b };
}

/**
 * Readable-key paths where a numeric wire key survived
 * EngineDataCodec.expandEngineDataWire (keys PhotoSuite's PSD map doesn't
 * name). Array indices are written as `[]`.
 */
export function unmappedWireKeys(readable, path = "", out = new Set()) {
  if (Array.isArray(readable)) readable.forEach((v) => unmappedWireKeys(v, `${path}[]`, out));
  else if (readable && typeof readable === "object") {
    for (const [k, v] of Object.entries(readable)) {
      const at = path ? `${path}.${k}` : k;
      if (/^_\d+$/.test(k)) out.add(at);
      else unmappedWireKeys(v, at, out);
    }
  }
  return out;
}

/** Every string value in a parsed tree with its key path (for finding story text). */
export function strings(node, path = "", out = []) {
  if (typeof node === "string") out.push({ path, value: node });
  else if (Array.isArray(node)) node.forEach((v, i) => strings(v, `${path}[${i}]`, out));
  else if (node && typeof node === "object") for (const [k, v] of Object.entries(node)) strings(v, path ? `${path}.${k}` : k, out);
  return out;
}

/** Shape summary: keys and value kinds to a depth. */
export function outline(node, depth = 2) {
  if (Array.isArray(node)) return depth ? [`array(${node.length})`, node.length ? outline(node[0], depth - 1) : null] : `array(${node.length})`;
  if (node && typeof node === "object") {
    if (!depth) return `{${Object.keys(node).length} keys}`;
    return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, outline(v, depth - 1)]));
  }
  return typeof node === "string" ? `string(${node.length})` : node;
}

export function inspectTextDocument(aiBytes) {
  const stream = extractAiStream(aiBytes).data;
  const block = sectionText(stream, "%AI11_BeginTextDocument", "%AI11_EndTextDocument");
  if (!block) return null;
  const parts = splitTextDocument(block);
  const result = { names: parts.names, rulerOrigin: parts.rulerOrigin };
  for (const key of ["textDocument", "undoFree"]) {
    if (!parts[key]) continue;
    try {
      const p = parsePayload(parts[key]);
      result[key] = { bytes: p.bytes.length, head: p.bytes.subarray(0, 24).toString("latin1"), roundTrips: p.roundTrips, firstDiff: p.firstDiff,
        semanticallyEqual: p.semanticallyEqual, semanticDiff: p.semanticDiff, keyMapRoundTrips: p.keyMapRoundTrips, keyMapDiff: p.keyMapDiff,
        unmapped: p.unmapped, tree: p.tree, readable: p.readable };
    } catch (error) {
      result[key] = { error: String(error?.message ?? error) };
    }
  }
  return result;
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const d = args.indexOf("--dump");
  const dump = d >= 0 ? args[d + 1] : null;
  const files = args.filter((a, i) => !a.startsWith("--") && (d < 0 || i !== d + 1));
  const all = {};
  for (const file of files) {
    const r = inspectTextDocument(fs.readFileSync(file));
    if (!r) { console.log(`${file}: no %AI11 text document`); continue; }
    all[file] = r;
    console.log(`${file}\n  payloads: ${r.names.join(", ")}; ruler origin ${JSON.stringify(r.rulerOrigin)}`);
    for (const key of ["textDocument", "undoFree"]) {
      const p = r[key];
      if (!p) continue;
      if (p.error) { console.log(`  ${key}: PARSE ERROR ${p.error}`); continue; }
      const top = Object.keys(p.tree);
      console.log(`  ${key}: ${p.bytes} B, starts ${JSON.stringify(p.head)}, top keys [${top.join(" ")}], PhotoSuite re-serialises it ${p.roundTrips ? "byte-identically" : `differently from byte ${p.firstDiff}`}, ` +
        `and it parses back ${p.semanticallyEqual ? "to an equal tree (numbers compared by value)" : `DIFFERENT at ${JSON.stringify(p.semanticDiff)}`}`);
      console.log(`    readable keys: ${p.keyMapRoundTrips ? "expand/collapse round-trips" : `expand/collapse DIFFERS at ${JSON.stringify(p.keyMapDiff)}`}; ` +
        `${p.unmapped.length} path(s) keep numeric wire keys${p.unmapped.length ? `: ${p.unmapped.slice(0, 6).join("  ")}${p.unmapped.length > 6 ? "  …" : ""}` : ""}`);
      const texts = strings(p.tree).filter((s) => s.value.length > 2 && /[A-Za-z]{3}/.test(s.value) && !/^[\w-]+$/.test(s.value));
      if (texts.length) console.log(`    text-like strings: ${texts.slice(0, 8).map((s) => `${s.path}=${JSON.stringify(s.value.slice(0, 60))}`).join("  ")}`);
    }
  }
  if (dump) fs.writeFileSync(dump, JSON.stringify(all, (k, v) => (v instanceof Uint8Array ? `<${v.length} bytes>` : v), 1));
}
