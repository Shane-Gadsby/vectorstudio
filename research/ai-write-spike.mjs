#!/usr/bin/env node
// Minimal `.ai` write spike (task 0.3.6).
//
// Writes `.ai` files with VectorSuite's own container code, modelled on what
// Illustrator 30.1 writes (docs/ai-format/container-30.1.md):
// - PDF 1.6: catalog (one optional-content group per layer, as Illustrator
//   does), one page per artboard, and a content stream drawing the art, so
//   PDF viewers show it;
// - the page's /PieceInfo << /Illustrator << /Private … >> >> dictionary with
//   /AIMetaData (the stream's header comments, up to %%EndComments) and
//   /AIPrivateData1..N, 65,536-byte blocks with no PDF filter;
// - the art stream zstd-compressed behind %AI24_ZStandard_Data, or plain.
//
// The CLI writes a bisection series for opening in a licensed Illustrator
// 30.1, from "Illustrator's own stream in our container" down to "a stream
// written from scratch", to find what Illustrator needs:
//
//   node scripts/research/ai-write-spike.mjs --from <Illustrator minimal .ai> --out <dir>
//
// Research code: the app's writer (Phase 6.3) will be built from these findings.

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import crypto from "node:crypto";
import { isMain } from "../lib/sources.mjs";

export const BLOCK_SIZE = 65536;
const ZSTD_HEADER = "%AI24_ZStandard_Data";

/** Illustrator's PDF date form: D:YYYYMMDDHHmmSS+HH'mm'. */
export function pdfDate(date) {
  const p = (n) => String(n).padStart(2, "0");
  const off = -date.getTimezoneOffset();
  const sign = off >= 0 ? "+" : "-";
  return `D:${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}` +
    `${sign}${p(Math.floor(Math.abs(off) / 60))}'${p(Math.abs(off) % 60)}'`;
}

/** The header comments of an art stream: everything up to %%EndComments and the blank line after it. */
export function headerComments(stream) {
  const text = stream.toString("latin1");
  const m = /%%EndComments\r?\n(\r?\n)?/.exec(text);
  if (!m) throw new Error("art stream has no %%EndComments");
  return Buffer.from(text.slice(0, m.index + m[0].length), "latin1");
}

/**
 * Builds a `.ai` (PDF container + private data) around `stream`.
 * @param {object} o
 * @param {Buffer} o.stream the decompressed art stream
 * @param {"zstd"|"none"} [o.compression]
 * @param {number[]} o.artboard [left, bottom, right, top] in points (the page's MediaBox)
 * @param {string} o.pageContent PDF content-stream operators drawing the art (inside the layer's OCG)
 * @param {string} [o.layerName]
 * @param {string} [o.title]
 * @param {Date} [o.date]
 * @returns {Buffer}
 */
export function writeAiFile(o) {
  const date = pdfDate(o.date ?? new Date());
  const [x0, y0, x1, y1] = o.artboard;
  const box = `[${x0} ${y0} ${x1} ${y1}]`;
  const payload = o.compression === "none"
    ? o.stream
    : Buffer.concat([Buffer.from(ZSTD_HEADER, "latin1"), zlib.zstdCompressSync(o.stream)]);
  const blocks = [];
  for (let i = 0; i < payload.length; i += BLOCK_SIZE) blocks.push(payload.subarray(i, i + BLOCK_SIZE));
  const content = zlib.deflateSync(Buffer.from(`/OC /MC0 BDC \n${o.pageContent}\nEMC \n`, "latin1"));
  const meta = headerComments(o.stream);
  const esc = (s) => s.replace(/[\\()]/g, (c) => "\\" + c);

  // Object numbers.
  const CATALOG = 1, PAGES = 2, PAGE = 3, CONTENT = 4, OCG = 5, PIECE = 6, PRIVATE = 7, META = 8, INFO = 9, FIRST_BLOCK = 10;
  const objects = new Map();
  const dict = (n, text) => objects.set(n, { head: text, stream: null });
  const stream = (n, text, data) => objects.set(n, { head: text.replace("%LEN%", String(data.length)), stream: data });

  dict(CATALOG, `<</OCProperties<</D<</ON[${OCG} 0 R]/Order[${OCG} 0 R]/RBGroups[]>>/OCGs[${OCG} 0 R]>>/Pages ${PAGES} 0 R/Type/Catalog>>`);
  dict(PAGES, `<</Count 1/Kids[${PAGE} 0 R]/Type/Pages>>`);
  dict(PAGE, `<</ArtBox${box}/BleedBox${box}/Contents ${CONTENT} 0 R/CropBox${box}/LastModified(${date})/MediaBox${box}` +
    `/Parent ${PAGES} 0 R/Resources<</Properties<</MC0 ${OCG} 0 R>>>>/TrimBox${box}/Type/Page/PieceInfo<</Illustrator ${PIECE} 0 R>>>>`);
  stream(CONTENT, "<</Filter/FlateDecode/Length %LEN%>>", content);
  dict(OCG, `<</Name(${esc(o.layerName ?? "Layer 1")})/Type/OCG/Usage<</CreatorInfo<</Creator(VectorSuite)/Subtype/Artwork>>>>>>`);
  dict(PIECE, `<</LastModified(${date})/Private ${PRIVATE} 0 R>>`);
  const refs = blocks.map((_, i) => `/AIPrivateData${i + 1} ${FIRST_BLOCK + i} 0 R`).join("");
  // /RoundtripStreamType names the compression: 2 zstd, 1 deflate (CC Legacy), absent when uncompressed.
  // Claiming 2 over plain data makes Illustrator report a partial read and fall back to the PDF page.
  const streamType = o.compression === "none" ? "" : "/RoundtripStreamType 2";
  dict(PRIVATE, `<</AIMetaData ${META} 0 R${refs}/ContainerVersion 12/CreatorVersion 30/NumBlock ${blocks.length}${streamType}/RoundtripVersion 24>>`);
  stream(META, "<</Length %LEN%>>", meta);
  dict(INFO, `<</CreationDate(${date})/Creator(VectorSuite write spike)/ModDate(${date})/Producer(VectorSuite)/Title(${esc(o.title ?? "Untitled")})>>`);
  blocks.forEach((b, i) => stream(FIRST_BLOCK + i, "<</Length %LEN%>>", b));

  // Serialise with a classic xref table.
  const chunks = [Buffer.from("%PDF-1.6\r%\xe2\xe3\xcf\xd3\r\n", "latin1")];
  let offset = chunks[0].length;
  const offsets = [];
  const push = (buf) => { chunks.push(buf); offset += buf.length; };
  const count = FIRST_BLOCK + blocks.length;
  for (let n = 1; n < count; n++) {
    const obj = objects.get(n);
    offsets[n] = offset;
    push(Buffer.from(`${n} 0 obj\r${obj.head}`, "latin1"));
    if (obj.stream) {
      push(Buffer.from("stream\r\n", "latin1"));
      push(obj.stream);
      push(Buffer.from("\r\nendstream", "latin1"));
    }
    push(Buffer.from("\rendobj\r", "latin1"));
  }
  const xrefAt = offset;
  let xref = `xref\r\n0 ${count}\r\n0000000000 65535 f\r\n`;
  for (let n = 1; n < count; n++) xref += `${String(offsets[n]).padStart(10, "0")} 00000 n\r\n`;
  const id = crypto.createHash("md5").update(o.stream).digest("hex").toUpperCase();
  xref += `trailer\r\n<</Size ${count}/Root ${CATALOG} 0 R/Info ${INFO} 0 R/ID[<${id}><${id}>]>>\r\nstartxref\r\n${xrefAt}\r\n%%EOF\r\n`;
  push(Buffer.from(xref, "latin1"));
  return Buffer.concat(chunks);
}

const CRLF = "\r\n";

/** A from-scratch art stream: one artboard, one layer, one filled RGB rectangle. */
export function scratchStream({ artboard = [0, 0, 400, 300], rect = [50, 100, 250, 250], rgb = [1, 0, 0], title = "write-spike" } = {}) {
  const [bx0, by0, bx1, by1] = rect;
  const [r, g, b] = rgb;
  const lines = [
    "%!PS-Adobe-3.0 ",
    "%%Creator: Adobe Illustrator(R) 24.0",
    "%%AI8_CreatorVersion: 30.1.0",
    "%%For: (VectorSuite) ()",
    `%%Title: (${title})`,
    "%%CreationDate: 9/24/2026 12:00 PM",
    "%%Canvassize: 16383",
    `%%BoundingBox: ${bx0} ${by0} ${bx1} ${by1}`,
    `%%HiResBoundingBox: ${bx0} ${by0} ${bx1} ${by1}`,
    "%AI5_FileFormat 14.0",
    "%AI3_ColorUsage: Color",
    `%AI3_Cropmarks: ${artboard.join(" ")}`,
    "%AI5_ArtSize: 14400 14400",
    "%AI5_RulerUnits: 2",
    "%AI24_LargeCanvasScale: 1",
    "%AI9_ColorModel: 1",
    "%AI5_ArtFlags: 0 0 0 1 0 0 1 0 0",
    "%AI5_TargetResolution: 800",
    "%AI5_NumLayers: 1",
    "%%EndComments",
    "",
    "%%BeginProlog",
    "%%EndProlog",
    "%%BeginSetup",
    "%%EndSetup",
    "%AI5_BeginLayer",
    "1 1 1 1 0 0 1 0 79 128 255 0 50 0 Lb",
    "(Layer 1) Ln",
    "0 AE",
    "0 A",
    "0 Xw",
    "4 As",
    "0 O",
    // Illustrator's 7-operand form: a CMYK approximation (naive here), then the RGB.
    `${1 - r} ${1 - g} ${1 - b} 0 ${r} ${g} ${b} Xa`,
    "0 1 0 0 0 Xy",
    "0 J 0 j 1 w 10 M []0 d",
    "0 XR",
    `${bx0} ${by0} m`,
    `${bx0} ${by1} L`,
    `${bx1} ${by1} L`,
    `${bx1} ${by0} L`,
    `${bx0} ${by0} L`,
    "f",
    "LB",
    "%AI5_EndLayer--",
    "%%PageTrailer",
    "gsave annotatepage grestore showpage",
    "%%Trailer",
    "%%EOF",
    "",
  ];
  return Buffer.from(lines.join(CRLF), "latin1");
}

/**
 * Removes the text between `begin` and `end` markers (inclusive) from a
 * latin1 stream, `%%BeginData: N` payloads included.
 */
export function cutSection(stream, begin, end) {
  const text = stream.toString("latin1");
  const s = text.indexOf(begin);
  if (s < 0) return stream;
  const e = text.indexOf(end, s);
  if (e < 0) return stream;
  const lineEnd = text.indexOf("\n", e);
  return Buffer.from(text.slice(0, s) + text.slice(lineEnd + 1), "latin1");
}

/** The text from the `begin` marker line to the `end` marker line (inclusive), or "" if absent. */
export function sectionText(stream, begin, end) {
  const text = stream.toString("latin1");
  const s = text.indexOf(begin);
  if (s < 0) return "";
  const e = text.indexOf(end, s);
  const lineEnd = text.indexOf("\n", e);
  return text.slice(s, lineEnd + 1);
}

/** Inserts `blockText` just before `%%EndSetup`. */
export function insertIntoSetup(stream, blockText) {
  const text = stream.toString("latin1");
  const at = text.indexOf("%%EndSetup");
  if (at < 0) throw new Error("stream has no %%EndSetup");
  return Buffer.from(text.slice(0, at) + blockText + text.slice(at), "latin1");
}

/**
 * A minimal %AI9 document-data block holding only the artboard list, in the
 * serialised-dictionary form Illustrator writes (`value /Type (Key) ,`,
 * `; (Key) ,` closing a container). Artboard corners are relative to the
 * document ruler origin; `rulerOrigin` is the artboard's own, in canvas units.
 *
 * `sections` (default true) writes the two-section shape Illustrator uses:
 * recorded entries, `; /Recorded ,`, then a `/Dictionary : /NotRecorded ,`
 * section. Verified on 30.1 (write spike rounds 2–5): **without the
 * not-recorded section Illustrator ignores the whole block**, artboards
 * included, and places the art itself. `LastArtboardID` is not required.
 */
export function minimalDocumentData({ artboard = [0, 0, 400, 300], rulerOrigin = [7991, 8041], name = "Artboard 1", sections = true } = {}) {
  const [x0, y0, x1, y1] = artboard;
  const lines = [
    "%AI9_BeginDocumentData",
    "%_/Document :",
    "%_/Dictionary :",
    "%_/Array :",
    "%_/Dictionary :",
    `%_${x0} ${y1} /RealPointRelToROrigin`,
    "%_ (PositionPoint1) ,",
    `%_${x1} ${y0} /RealPointRelToROrigin`,
    "%_ (PositionPoint2) ,",
    `%_(${name}) /UnicodeString (Name) ,`,
    "%_1 /Bool (IsArtboardDefaultName) ,",
    "%_0 /Bool (IsArtboardSelected) ,",
    "%_0 /Int (DisplayMark) ,",
    "%_1 /Real (PAR) ,",
    `%_${rulerOrigin[0]} ${rulerOrigin[1]} /RealPoint`,
    "%_ (RulerOrigin) ,",
    "%_0 /Bool (IsArtboardLocked) ,",
    "%_; ,",
    "%_; (ArtboardArray) ,",
    ...(sections ? ["%_; /Recorded ,", "%_/Dictionary : /NotRecorded ,", "%_1 /Int (LastArtboardID) ,"] : []),
    "%_; /NotRecorded ,",
    "%_;",
    "%AI9_EndDocumentData",
    "",
  ];
  return lines.join("\r\n");
}

/**
 * Splits a %AI9 document-data block into its top-level entries.
 *
 * The block is a serialised dictionary on `%_` lines: `/Type :` opens a
 * container, `;` closes one, and `,` ends an entry (after its `(Key)` for a
 * dictionary entry). Strings are `( … )` with backslash escapes and balanced
 * parentheses. Top-level entries are those that end at depth 2, inside
 * `/Document :` and its `/Dictionary :`. The block has two sections: recorded
 * settings, closed by `; /Recorded ,`, then a not-recorded dictionary opened
 * by `/Dictionary : /NotRecorded ,` (closed by the final `; /NotRecorded ,`).
 * The two marker lines come back as entries keyed "<end of recorded>" and
 * "<start of not recorded>" so filters can keep them.
 *
 * @returns {{ head: string, entries: { key: string, text: string }[], tail: string }}
 *   Joining head, every entry's text and tail gives back the block exactly.
 */
export function splitDocumentData(block) {
  const lines = block.split(/(?<=\n)/);
  const first = lines.findIndex((l) => /^%_\/Dictionary :/.test(l));
  const last = lines.findLastIndex((l) => /^%_; \/NotRecorded ,/.test(l));
  if (first < 0 || last < 0) throw new Error("not a document-data block");
  const head = lines.slice(0, first + 1).join("");
  const tail = lines.slice(last).join("");
  const body = lines.slice(first + 1, last);
  const entries = [];
  let depth = 0;
  let current = [];
  let key = "";
  for (const line of body) {
    if (depth === 0 && /^%_; \/Recorded ,/.test(line)) {
      if (current.length) entries.push({ key: "(unterminated)", text: current.join("") });
      entries.push({ key: "<end of recorded>", text: line });
      current = [];
      continue;
    }
    if (depth === 0 && /^%_\/Dictionary : \/NotRecorded ,\s*$/.test(line) && entries.some((e) => e.key === "<end of recorded>") &&
        !entries.some((e) => e.key === "<start of not recorded>")) {
      entries.push({ key: "<start of not recorded>", text: line });
      continue;
    }
    current.push(line);
    const code = line.replace(/^%_/, "");
    for (let i = 0; i < code.length; i++) {
      const ch = code[i];
      if (ch === "(") {
        let d = 1, j = i + 1, str = "";
        for (; j < code.length && d > 0; j++) {
          if (code[j] === "\\") { str += code[j + 1] ?? ""; j++; continue; }
          if (code[j] === "(") d++;
          else if (code[j] === ")") { d--; if (d === 0) break; }
          str += code[j];
        }
        if (depth === 0) key = str;
        i = j;
      } else if (ch === ":" && /\S/.test(code[i - 1] ?? "") === false && depth >= 0) {
        depth++;
      } else if (ch === ";") {
        depth--;
      } else if (ch === "," && depth === 0) {
        entries.push({ key, text: current.join("") });
        current = [];
        key = "";
      }
    }
  }
  if (current.length) entries.push({ key: "(unterminated)", text: current.join("") });
  return { head, entries, tail };
}

/** Rebuilds a document-data block keeping only the entries `keep(entry)` accepts. */
export function filterDocumentData(block, keep) {
  const { head, entries, tail } = splitDocumentData(block);
  return head + entries.filter(keep).map((e) => e.text).join("") + tail;
}

/** Removes every %AI5_Begin_NonPrinting … %AI5_End_NonPrinting-- block inside %%BeginSetup. */
export function cutNonPrinting(stream) {
  let text = stream.toString("latin1");
  for (;;) {
    // Recomputed each pass: every cut moves %%EndSetup.
    const setupEnd = text.indexOf("%%EndSetup");
    const s = text.indexOf("%AI5_Begin_NonPrinting");
    if (s < 0 || s > setupEnd) break;
    const e = text.indexOf("%AI5_End_NonPrinting--", s);
    const lineEnd = text.indexOf("\n", e);
    text = text.slice(0, s) + text.slice(lineEnd + 1);
  }
  return Buffer.from(text, "latin1");
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const arg = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
  const out = arg("--out") ?? path.join(process.cwd(), ".research", "write-spike");
  const from = arg("--from");
  fs.mkdirSync(out, { recursive: true });
  const variants = [];
  const pageContent = "1 0 0 rg\n50 250 200 -150 re\nf";
  const artboard = [0, 0, 400, 300];
  if (from) {
    const { extractAiStream } = await import("../ai-dump.mjs");
    const s0 = extractAiStream(fs.readFileSync(from)).data;
    const s1 = cutNonPrinting(s0);
    const s2 = cutSection(s1, "%AI9_BeginDocumentData", "%AI9_EndDocumentData");
    const s3 = cutSection(s2, "%AI11_BeginTextDocument", "%AI11_EndTextDocument");
    variants.push(
      ["ws-s0-illustrator-stream", s0, "Illustrator's own stream, unchanged, in VectorSuite's container (tests the container alone)"],
      ["ws-s1-no-nonprinting", s1, "S0 minus every %AI5_Begin_NonPrinting block in setup (gradients, brushes, SVG filters, plugin objects, art styles)"],
      ["ws-s2-no-document-data", s2, "S1 minus %AI9_BeginDocumentData (artboards, document settings)"],
      ["ws-s3-no-text-document", s3, "S2 minus %AI11_BeginTextDocument (text engine data)"],
    );
    // Round 2: which parts put the art on the artboard.
    const docData = sectionText(s0, "%AI9_BeginDocumentData", "%AI9_EndDocumentData");
    const textDoc = sectionText(s0, "%AI11_BeginTextDocument", "%AI11_EndTextDocument");
    const scratch = scratchStream();
    // Round 3: which document-data entries matter (section markers are always kept).
    const only = (keys) => (e) => e.key.startsWith("<") || keys.includes(e.key);
    const except = (keys) => (e) => !keys.includes(e.key);
    const round3 = [
      ["ws-r3a-docdata-minus-xml", except(["#document"]), "Illustrator's document data minus the #document XML tree"],
      ["ws-r3b-xml-and-artboards", only(["#document", "ArtboardArray"]), "only #document and ArtboardArray"],
      ["ws-r3c-artboards-and-notrecorded", (e) => e.key.startsWith("<") || e.key === "ArtboardArray" || notRecordedKeys.has(e.key), "only ArtboardArray and the whole not-recorded section"],
      ["ws-r3d-artboards-canvas-lastid", only(["ArtboardArray", "AIDocumentCanvasSize", "LastArtboardID"]), "only ArtboardArray, AIDocumentCanvasSize and LastArtboardID"],
      ["ws-r3e-docdata-minus-artboards", except(["ArtboardArray"]), "control: Illustrator's document data minus ArtboardArray"],
    ];
    const split = splitDocumentData(docData);
    const marker = split.entries.findIndex((e) => e.key === "<end of recorded>");
    const notRecordedKeys = new Set(split.entries.slice(marker + 2).map((e) => e.key));
    for (const [name, keep, description] of round3) {
      variants.push([name, insertIntoSetup(scratch, filterDocumentData(docData, keep)), `Round 3: scratch + ${description}`]);
    }
    variants.push(["ws-r3f-minimal-two-sections", insertIntoSetup(scratch, minimalDocumentData({ sections: true })),
      "Round 3: scratch + VectorSuite's minimal artboard entry in the two-section shape, with LastArtboardID"]);
    variants.push(
      ["ws-s5-scratch-plus-docdata", insertIntoSetup(scratch, docData), "Round 2: scratch + Illustrator's complete %AI9 document data"],
      ["ws-s6-scratch-minimal-docdata", insertIntoSetup(scratch, minimalDocumentData()), "Round 2: scratch + VectorSuite's minimal document data (artboard list only)"],
      ["ws-s7-scratch-minimal-docdata-textdoc", insertIntoSetup(scratch, minimalDocumentData() + textDoc), "Round 2: S6 + Illustrator's %AI11 text document (holds the document ruler origin)"],
    );
  }
  variants.push(["ws-s4-scratch", scratchStream(), "A stream written from scratch: header comments, empty prolog and setup, one layer, one rectangle"]);
  const report = [];
  for (const [name, stream, description] of variants) {
    for (const compression of ["zstd", "none"]) {
      if (compression === "none" && name !== "ws-s4-scratch" && name !== "ws-s0-illustrator-stream") continue;
      if (args.includes("--round2") && !/^ws-s[5-7]/.test(name) && compression !== "none") continue;
      if (args.includes("--round3") && !/^ws-r3/.test(name)) continue;
      const file = `${name}${compression === "none" ? "-uncompressed" : ""}.ai`;
      fs.writeFileSync(path.join(out, file), writeAiFile({ stream, compression, artboard, pageContent, title: name }));
      report.push(`${file}\t${stream.length} B stream\t${description}${compression === "none" ? " (uncompressed)" : ""}`);
    }
  }
  fs.writeFileSync(path.join(out, "README.txt"), "Open each file in Illustrator 30.1 and note: opens? warning text? red rectangle visible? layers/artboard right?\r\n\r\n" + report.join("\r\n") + "\r\n");
  console.log(report.join("\n"));
  console.log(`\nwrote ${report.length} files to ${out}`);
}
