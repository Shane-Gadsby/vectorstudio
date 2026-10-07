#!/usr/bin/env node
// `%AI9_BeginDocumentData` reader and writer (task 0.3.4).
//
// The block, and every `%_` art dictionary in the art stream, is a serialised
// dictionary in a small postfix language, one or more tokens per `%_` line:
//
//   /Type :            open a container (Document, Dictionary, Array, XMLNode,
//                      ArtDictionary, XMLUID, …)
//   ;                  close it; the container becomes the pending value
//   <operands> /Type   make a typed value: Int, Real, Bool, String,
//                      UnicodeString (one operand, none for an empty string;
//                      AI10 splits long strings into several literals),
//                      RealPoint, RealPointRelToROrigin (two)
//   (Key) ,            store the pending value under a string key
//   /Name ,            … under a name key (the document's /Recorded and
//                      /NotRecorded sections)
//   ,                  … without a key (array elements)
//   /FillStyle : <art operators> /Def ;
//                      a paint style as raw art-stream operators (also
//                      StrokeStyle, BlendStyle, and SimpleStyle … /Paint ;)
//
// A keyed `,` with no pending value is a flag on the open container, as in
// `/Dictionary : /NotRecorded ,`; with operands but no type it stores them
// untyped (art styles: `1 /Visible ,`). Operands left in a container when it
// closes (`/XMLUID : (Layer_1) ;`) are kept as its operands, and a value
// pending there as its inner value (`/GObjRef : (Anon …) /ArtStyle ;`). A name
// after a closed container tags it (`; /Dict ;`, `/Execution ;`, ` /Def ;`).
//
// The same language, without the `%_` prefix, holds the art styles
// (%AI9_BeginArtStyles) and SVG filters (%AI10_BeginSVGFilter). The parser
// records whitespace that differs from the writer's default layout, so every
// fixture's document data, art styles, SVG filters and art dictionaries
// (ai-art-objects.mjs, which also cuts out their ASCII85 and X= art payloads)
// write back byte for byte. Findings: docs/ai-format/document-data-30.1.md,
// docs/ai-format/live-features-30.1.md.
//
//   node scripts/research/ai-document-data.mjs <file.ai>… [--json <out.json>] [--keys]

import fs from "node:fs";
import { isMain } from "../lib/sources.mjs";
import { decodeAscii85, extractAiStream } from "../ai-dump.mjs";
import { sectionText } from "./ai-write-spike.mjs";

const POINTS = new Set(["RealPoint", "RealPointRelToROrigin"]);
// Paint styles hold raw art operators up to the name that ends them.
const RAW = new Map([["FillStyle", "Def"], ["StrokeStyle", "Def"], ["BlendStyle", "Def"], ["SimpleStyle", "Paint"]]);

/** Splits `%_` text into tokens; `(…)` strings keep their source form, escapes included. */
export function tokenize(text) {
  const tokens = [];
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === " " || c === "\t" || c === "\r" || c === "\n") { i++; continue; }
    if (c === "(") {
      let depth = 0, j = i;
      for (; j < text.length; j++) {
        if (text[j] === "\\") { j++; continue; }
        if (text[j] === "(") depth++;
        else if (text[j] === ")" && --depth === 0) break;
      }
      tokens.push({ kind: "string", text: text.slice(i, j + 1), at: i, end: j + 1 });
      i = j + 1;
      continue;
    }
    if (c === ":" || c === ";" || c === ",") { tokens.push({ kind: c, at: i, end: i + 1 }); i++; continue; }
    let j = i + 1;
    while (j < text.length && !" \t\r\n(:;,".includes(text[j])) j++;
    const word = text.slice(i, j);
    // `/<digits>` is an operand: some /Int values are written that way (Live Paint's
    // `/1133903872 /Int`, Scribble's random seed `/-746421769 /Int`).
    tokens.push(word[0] === "/" && !/^\/-?\d+$/.test(word) ? { kind: "name", text: word.slice(1), at: i, end: j } : { kind: "operand", text: word, at: i, end: j });
    i = j;
  }
  return tokens;
}

/** Decodes a PDF-style literal string's source form. */
export function decodeString(source) {
  const body = source.slice(1, -1);
  const escapes = { n: "\n", r: "\r", t: "\t", b: "\b", f: "\f" };
  return body.replace(/\\([0-7]{1,3}|.)/gs, (_, e) => (/^[0-7]/.test(e) ? String.fromCharCode(parseInt(e, 8)) : escapes[e] ?? e));
}

/** Encodes a string as a literal, escaping only what must be. */
export function encodeString(value) {
  return `(${value.replace(/[\\()]/g, (c) => `\\${c}`)})`;
}

/**
 * Parses dictionary text (line prefixes already removed, lines joined with
 * \n) into containers:
 *   { type, flags: [key…], operands: [text…], inner?, entries: [{ key, value }] }
 * where key is "(Key)" source, "/Name" or null, and value is a container,
 * { type, operands } for a typed value (type null when untyped, as in art
 * styles' `1 /Visible ,`), or { type, raw } for a paint style.
 *
 * `blobs` are payloads the caller cut out of the text and replaced with a
 * `\uE000<index>` line (a character no latin1 stream holds): ASCII85 data (`/Binary : /ASCII85Decode ,`,
 * `/ForeignObject … /Data ,`) and embedded art (`X=` … `X+`). They become
 * operands as given (objects, not strings), and the writer puts them back
 * verbatim.
 *
 * Whitespace that differs from the writer's default layout is recorded, so
 * the writer reproduces it: `gap` before an entry's key (or its bare `,`) and
 * before a tag name, `closeGap` before a container's `;`, `lead` before a
 * top-level container or an entry that doesn't start on a line of its own
 * (`/SmoothShadingStyle : (…) 7 /ColorPoints ,`), `gaps` between a value's
 * operands when they are split over lines (a freeform gradient's
 * `/ColorPoint`s), and `flagsAt` for flags written after the header line
 * (`/Data ,`).
 */
export function parseDictionary(text, blobs = []) {
  const tokens = tokenize(text);
  const root = { type: "<root>", flags: [], operands: [], entries: [] };
  const stack = [root];
  let pending = null;
  let operands = [];
  let opGaps = [];          // the whitespace before each operand, index 0 unused
  let valueAt = null;       // the token an entry's value starts at, for its lead
  const gapBefore = (t) => text.slice(t > 0 ? tokens[t - 1].end : 0, tokens[t].at);
  /** Attaches the operand gaps to a value, unless they are all the default single space. */
  const withGaps = (value) => {
    if (opGaps.slice(1).some((g) => g !== " ")) value.gaps = opGaps;
    return value;
  };
  const clear = () => { operands = []; opGaps = []; };
  const openedAt = new Map(); // container -> the token its `/Type` sits at, for its entry's lead
  for (let t = 0; t < tokens.length; t++) {
    const tok = tokens[t];
    const top = stack[stack.length - 1];
    if (valueAt === null && tok.kind !== ";") valueAt = t;
    const next = tokens[t + 1]?.kind;
    if (tok.kind === "name" && next === ":") {
      if (RAW.has(tok.text)) {
        // Raw art operators up to "/Def ;" (or "/Paint ;"), kept as written (CRLF line breaks as \n).
        const stop = RAW.get(tok.text);
        let end = t + 2;
        while (end < tokens.length && !(tokens[end].kind === "name" && tokens[end].text === stop && tokens[end + 1]?.kind === ";")) end++;
        if (end >= tokens.length) throw new Error(`unterminated /${tok.text}`);
        pending = { type: tok.text, raw: text.slice(tokens[t + 1].at + 1, tokens[end].at) };
        t = end + 1;
        continue;
      }
      const opened = { type: tok.text, flags: [], operands: [], entries: [] };
      if (stack.length === 1) {
        const lead = gapBefore(t);
        if (lead !== (root.entries.length ? "\n" : "")) opened.lead = lead;
      }
      openedAt.set(opened, t);
      stack.push(opened);
      valueAt = null; // the container's first entry starts inside it
      t++;
    } else if (tok.kind === "," || (next === "," && (tok.kind === "string" || tok.kind === "name"))) {
      const gap = gapBefore(t);
      let key = null;
      if (tok.kind !== ",") { key = tok.kind === "string" ? tok.text : `/${tok.text}`; t++; }
      if (!pending && operands.length) pending = withGaps({ type: null, operands });
      if (pending) {
        const entry = { key, value: pending };
        if (gap !== defaultKeyGap(pending)) entry.gap = gap;
        // A typed value with no operands is written " /Type", so its line already starts with a space.
        const leadDefault = pending.type != null && !pending.entries && !pending.raw && !pending.operands?.length ? "\n " : "\n";
        const lead = valueAt === null ? leadDefault : gapBefore(valueAt);
        if (top !== root && lead !== leadDefault) entry.lead = lead;
        top.entries.push(entry);
      } else {
        // A flag: on the header line (`/Dictionary : /NotRecorded ,`) unless recorded otherwise.
        if (top.entries.length || gap !== " ") (top.flagsAt ??= top.flags.map(() => null))[top.flags.length] = [top.entries.length, gap];
        else if (top.flagsAt) top.flagsAt[top.flags.length] = null;
        top.flags.push(key);
      }
      pending = null;
      valueAt = null;
      clear();
    } else if (tok.kind === "name") {
      // A name after a closed container tags it (art styles: `; /Dict ;`,
      // `/Execution ;`, ` /Def ;`); otherwise it types the operands before it.
      if (pending && !operands.length) {
        pending = { type: tok.text, of: pending };
        const gap = gapBefore(t);
        if (gap !== "\n ") pending.gap = gap;
      } else {
        pending = withGaps({ type: tok.text, operands });
      }
      clear();
    } else if (tok.kind === "operand" || tok.kind === "string") {
      const blob = tok.kind === "operand" && /^\uE000(\d+)$/.exec(tok.text);
      operands.push(blob ? blobs[Number(blob[1])] : tok.text);
      opGaps.push(gapBefore(t));
    } else if (tok.kind === ";") {
      if (stack.length === 1) throw new Error(`unbalanced ; at ${tok.at}`);
      const closed = stack.pop();
      valueAt = openedAt.get(closed); // the whole container is the value, from its `/Type`
      closed.operands = operands;
      withGaps(closed);
      if (pending) closed.inner = pending; // /GObjRef : (Anon …) /ArtStyle ;
      if (!isOneLine(closed)) {
        const gap = gapBefore(t);
        if (gap !== defaultCloseGap(closed)) closed.closeGap = gap;
      }
      clear();
      pending = closed;
      if (stack.length === 1) { root.entries.push({ key: null, value: closed, bare: true }); pending = null; valueAt = null; }
    } else {
      throw new Error(`unexpected ${tok.kind} at ${tok.at}`);
    }
  }
  if (stack.length !== 1) throw new Error(`${stack.length - 1} container(s) left open`);
  root.operands = operands; // a bare list, as in %AI9_BeginArtStyleList
  withGaps(root);
  return root;
}

const isBlob = (o) => typeof o !== "string";
/** Written on one line: /XMLUID : (Layer_1) ;  and  /GObjRef : (Anon …) /ArtStyle ; */
const isOneLine = (v) => v.entries && !v.entries.length && !v.flags.length && !v.operands.some(isBlob) && (v.operands.length || (v.inner && !v.inner.of));
const defaultKeyGap = (v) => (v.raw != null ? " \n " : POINTS.has(v.type) ? "\n " : " ");
const defaultCloseGap = (v) => (v.operands.length ? (isBlob(v.operands.at(-1)) ? "\n" : " ") : "\n");

/** Writes a parsed tree back as CRLF lines, each starting with `prefix`, in Illustrator's layout. */
export function writeDictionary(root, prefix = "") {
  // Composed as text with \n line breaks; a blob is a line of its own, "\uE000<index>".
  const blobs = [];
  const join = (list, gaps) => list.map((o, i) => (i ? (gaps?.[i] ?? " ") : "") + o).join("");
  const ops = (list, gaps) => join(list.map((o) => (isBlob(o) ? `\n\uE000${blobs.push(o) - 1}` : o)), gaps).replace(/ \n/g, "\n").replace(/^\n/, "");
  const tail = (e) => (e.bare ? "" : (e.gap ?? defaultKeyGap(e.value)) + (e.key == null ? "," : `${e.key} ,`));
  const text = (v) => {
    if (v.of) return `${text(v.of)}${v.gap ?? "\n "}/${v.type}`;
    if (v.raw != null) return `/${v.type} :${v.raw}/${RAW.get(v.type)} ;`;
    if (isOneLine(v)) {
      const inner = v.inner ? [...v.inner.operands, `/${v.inner.type}`] : [];
      return `/${v.type} : ${[...v.operands, ...inner].join(" ")} ;`;
    }
    if (v.entries) {
      let s = `/${v.type} :`;
      const flagsAt = (i) => v.flags.forEach((f, n) => { if (v.flagsAt?.[n]?.[0] === i) s += `${v.flagsAt[n][1]}${f} ,`; });
      v.flags.forEach((f, n) => { if (!v.flagsAt?.[n]) s += ` ${f} ,`; });
      v.entries.forEach((e, i) => { flagsAt(i); s += `${e.lead ?? "\n"}${text(e.value)}${tail(e)}`; });
      flagsAt(v.entries.length);
      if (v.inner) s += `\n${text(v.inner)}`;
      if (v.operands.length) s += `\n${ops(v.operands, v.gaps)}`;
      return `${s}${v.closeGap ?? defaultCloseGap(v)};`;
    }
    if (v.type == null) return ops(v.operands, v.gaps);
    if (POINTS.has(v.type)) return `${join(v.operands, v.gaps)} /${v.type}`;
    // Older saves (AI10) split long strings into 50-byte literals, one per line.
    const strings = v.operands.length > 1 && v.operands.every((o) => o[0] === "(");
    return `${v.gaps ? join(v.operands, v.gaps) : v.operands.join(strings ? "\n" : " ")} /${v.type}`;
  };
  let out = root.entries.map((e, i) => `${e.value.lead ?? (i ? "\n" : "")}${text(e.value)}${tail(e)}`).join("");
  root.operands.forEach((o, i) => { out += `${out ? (i ? root.gaps?.[i] ?? "\n" : "\n") : ""}${o}`; });
  return out.split("\n").map((l) => {
    const blob = /^\uE000(\d+)$/.exec(l);
    return blob ? blobs[Number(blob[1])].raw : `${prefix}${l}`;
  }).map((l) => `${l}\r\n`).join("");
}

/**
 * Parses the lines of a section written without a prefix (art styles, SVG
 * filters), cutting out ASCII85 data as blobs the way the art scanner does:
 * after a line ending `/ASCII85Decode ,` or `/Data ,`, every line up to the
 * one holding `~>` is data (the Photoshop-style effects' `(data)`).
 * `lines` are the section's lines without their CRLF, markers excluded.
 */
export function parseSectionLines(lines) {
  const logical = [];
  const blobs = [];
  for (let i = 0; i < lines.length; i++) {
    logical.push(lines[i]);
    if (!/\/(ASCII85Decode|Data) ,\s*$/.test(lines[i])) continue;
    const from = i + 1;
    do i++; while (i < lines.length && !lines[i].includes("~>"));
    logical.push(`\uE000${blobs.push({ kind: "ascii85", raw: lines.slice(from, i + 1).join("\r\n") }) - 1}`);
  }
  return parseDictionary(logical.join("\n"), blobs);
}

/** Parses the `%_` lines of a block (other lines, such as the Begin/End markers, are ignored). */
export function parseDictionaryStream(block) {
  // Lines end CRLF; a lone CR inside a paint style's operators stays in its line.
  return parseDictionary(block.split("\r\n").filter((l) => l.startsWith("%_")).map((l) => l.slice(2)).join("\n"));
}

/** Writes a tree as `%_` lines. */
export function writeDictionaryStream(root) {
  return writeDictionary(root, "%_");
}

/** The `%AI9_BeginDocumentData` block of a file, or null. */
export function documentDataBlock(aiBytes) {
  return sectionText(extractAiStream(aiBytes).data, "%AI9_BeginDocumentData", "%AI9_EndDocumentData");
}

/** The block's `%_` lines as written (what writeDictionaryStream must reproduce). */
export function dictionaryLines(block) {
  return block.split("\r\n").filter((l) => l.startsWith("%_")).map((l) => `${l}\r\n`).join("");
}

/** A blob's plain form: `{ "@ascii85": hex }` (or its size when long), `{ "@art": "<n> lines" }`. */
function plainBlob(blob) {
  if (blob.kind === "art") return { "@art": `${blob.raw.split("\r\n").length} lines` };
  const bytes = decodeAscii85(blob.raw.split("\r\n").map((l) => l.slice(1)).join(""));
  return { "@ascii85": bytes.length <= 256 ? bytes.toString("hex") : `${bytes.length} bytes` };
}

/** An operand's plain form: strings decoded, numbers as numbers, blobs by plainBlob, anything else as written. */
const plainOperand = (o) => (isBlob(o) ? plainBlob(o) : o[0] === "(" ? decodeString(o) : Number.isNaN(Number(o)) ? o : Number(o));

/** Plain JSON view: containers become objects (arrays for /Array), values their decoded form. */
export function plain(value) {
  if (value.of) return { [`/${value.type}`]: plain(value.of) };
  if (value.raw != null) return { [`/${value.type}`]: value.raw.trim() };
  if (value.type == null) return value.operands.map(plainOperand);
  if (value.entries) {
    if (value.type === "Array") return value.entries.map((e) => plain(e.value));
    const out = {};
    if (value.type !== "Dictionary" && value.type !== "<root>") out["@type"] = value.type;
    if (value.flags.length) out["@flags"] = value.flags;
    if (value.type === "<root>" && value.operands.length) out["@list"] = value.operands.map((o) => (o[0] === "(" ? decodeString(o) : o));
    if (value.inner) out["@value"] = plain(value.inner);
    if (value.operands.length) out["@operands"] = value.operands.map((o) => (isBlob(o) ? plainBlob(o) : o[0] === "(" ? decodeString(o) : o));
    value.entries.forEach((e, i) => {
      const k = e.key == null ? `#${i}` : e.key[0] === "(" ? decodeString(e.key) : e.key;
      // Repeated keys (an art style filter's several /Part entries) collect into a list.
      const v = plain(e.value);
      if (!(k in out)) out[k] = v;
      else if (Array.isArray(out[k]) && out[k].repeated) out[k].push(v);
      else out[k] = Object.assign([out[k], v], { repeated: true });
    });
    return out;
  }
  const ops = value.operands.map((o) => (isBlob(o) ? plainBlob(o) : o[0] === "(" ? decodeString(o) : Number(o[0] === "/" ? o.slice(1) : o)));
  if (POINTS.has(value.type)) return value.type === "RealPoint" ? ops : { [value.type]: ops };
  if (value.type === "Bool") return ops[0] !== 0;
  if (value.type === "String" || value.type === "UnicodeString") return ops.join("");
  // Int, Real, …: one number; others (a symbol's /RTransformMatrix) keep all their operands.
  return ops.length === 1 ? ops[0] : { [value.type]: ops };
}

/** The two sections: { recorded, notRecorded } containers of the /Document. */
export function documentSections(root) {
  const doc = root.entries.find((e) => e.value.type === "Document")?.value;
  if (!doc) return null;
  const find = (name) => doc.entries.find((e) => e.key === name)?.value ?? null;
  return { document: doc, recorded: find("/Recorded"), notRecorded: find("/NotRecorded") };
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const j = args.indexOf("--json");
  const jsonOut = j >= 0 ? args[j + 1] : null;
  const files = args.filter((a, i) => !a.startsWith("--") && (j < 0 || i !== j + 1));
  const all = {};
  for (const file of files) {
    const block = documentDataBlock(fs.readFileSync(file));
    if (!block) { console.log(`${file}: no %AI9 document data`); continue; }
    const tree = parseDictionaryStream(block);
    const same = writeDictionaryStream(tree) === dictionaryLines(block);
    const s = documentSections(tree);
    console.log(`${file}: ${block.length} B; writer ${same ? "reproduces it byte for byte" : "DIFFERS"}; ` +
      `${s?.recorded?.entries.length ?? 0} recorded and ${s?.notRecorded?.entries.length ?? 0} not-recorded entries`);
    if (args.includes("--keys") && s) {
      for (const [name, section] of [["recorded", s.recorded], ["notRecorded", s.notRecorded]]) {
        for (const e of section?.entries ?? []) console.log(`  ${name.padEnd(11)} ${(e.value.type ?? "").padEnd(22)} ${e.key}`);
      }
    }
    all[file] = plain(tree);
  }
  if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(all, null, 1));
}
