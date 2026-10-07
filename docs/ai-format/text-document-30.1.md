# `%AI11_BeginTextDocument` in Illustrator 30.1 (task 0.3.3)

Checked against every fixture in `fixtures/ai/30.1/` with
`scripts/research/ai-text-document.mjs`
(`node scripts/research/ai-text-document.mjs fixtures/ai/30.1/*.ai`). Tests:
`tests/scripts/research/ai-text-document.test.js`.

**Result: PhotoSuite's EngineData code reads Illustrator's text document.**
Getting there took two small patches (`patches/photosuite/0001`, `0002`). With
them, all 23 text documents × 2 payloads parse, write back to an equal tree,
and survive the readable-key round trip (expand → collapse). The only byte
difference left is how floats are written.

## Where it sits and how it is wrapped

The block comes after `%AI9_EndDocumentData`, inside the setup
(`%%BeginSetup` … `%%EndSetup`). All 23 saves from CS6 onwards carry it,
**even with no text in the document** (about 85 KB of font, style-sheet and
kinsoku resources). The AI10, AI8 and AI3 saves have no such block.

```
%AI11_BeginTextDocument
/AI11TextDocument : /ASCII85Decode ,
%<ascii85, one % line after another>…~>
7991 8341 /RulerOrigin ,          ← the document ruler origin (canvas coordinates, y down)
;
/AI11UndoFreeTextDocument : /ASCII85Decode ,
%<ascii85>…~>
;
%AI11_EndTextDocument
```

- **Two payloads.** `AI11TextDocument` is the full document. It holds the
  resources plus `_DocumentObjects._TextObjects`, one entry per story.
  `AI11UndoFreeTextDocument` holds the same resources and **no text objects**
  (85–93 KB and 85 KB in the fixtures). Illustrator writes both, so our writer
  must too, until a round trip proves the second one can be dropped.
- **`RulerOrigin`** here is the document ruler origin that the artboard
  positions in the document data are relative to (`document-data-30.1.md`).
  It is the first artboard's bottom-left in canvas space.
- Each payload decodes, after ASCII85, to the **EngineData tree in the same
  syntax PSD uses for its `Txt2`/`TySh` binary trees**. The root dictionary
  has no `<< >>` and every key is a number: ` /98 << /0 13 >> /0 << /1 << …`.
  PhotoSuite's `BinaryTreeParser` parses it. Its value prefixes are `i`
  (integer), `f` (float), `s` (UTF-16 string), `b` (byte string, added by
  patch 0001), and booleans as `true`/`false`.

## How art references it

Each text frame in the art stream is a `/AI11Text :` dictionary that points
into the text document by index. It has no story ID:

```
/AI11Text :
0 /FreeUndo ,
0 /FrameIndex ,
1 /StoryIndex ,                    ← _DocumentObjects._TextObjects[1]
/Art :  X= … path … X+ ; /ConfiningPath ,     ← area and path type only
2 /TextAntialiasing ,
;
%_/ArtDictionary :
%_(a83a…) /UnicodeString (AI24 TextStoryRawDataUUID) ,
%_;
```

The `AI24 TextStoryRawDataUUID` in the art dictionary doesn't appear anywhere
in either payload. What it refers to is still unknown (it may be another
private stream or the PDF side). Keep it verbatim.

`_DocumentResources._TextFrameSet._Resources[i]` holds the frames. A point
frame has `_0` (an origin; `[7991, 8341]`, the ruler origin, in 07-type) and
`_Data._FrameMatrix`. Area and path frames have `_Bezier` and `_Data`.

## What the tree holds (readable names from `EngineDataCodec`)

| Path | Contents |
|------|----------|
| `_98._0` | **Format version: `i13` in 30.1 and 2020, `i7` in CS6 and CC (Legacy).** |
| `_DocumentResources._FontSet._Resources[]._Resource` | `/CoolTypeFont`, `_Identifier._Name` (PostScript name, `sArialMT`), `_Type`, `_MMAxis` (the font's version string), `_97` = font UUID (byte string) |
| `_DocumentResources._StyleSheetSet` / `_ParagraphSheetSet` | Character and paragraph styles (`[Normal Character Style]`, `[Normal Paragraph Style]`), each with a `_97` UUID |
| `_DocumentResources._MojiKumi*`, `_KinsokuSet`, `_ListStyleSet` | CJK composition and list resources, written even in Latin-only documents |
| `_DocumentResources._TextFrameSet` | One frame resource per text frame (above) |
| `_DocumentObjects._DocumentSettings` | Hidden-glyph mapping, normal style defaults, and so on |
| `_DocumentObjects._TextObjects[i]._Model._Text` | **The story text, `s`-prefixed and CR-separated, ending with a CR**: `sFirst paragraph of area type.\rSecond paragraph, justified.\r` |
| `…_Model._StyleRun._RunArray[]` / `_ParagraphRun._RunArray[]` | Runs: `_RunData._StyleSheet` / `_ParagraphSheet` (an inline sheet, or **a bare index `i0`**), `_Length` |
| `…_TextObjects[i]._View` | `_Frames`, `_RenderedData`, `_Strikes` (laid-out glyph runs) |

The wire paths are `_1._1[i]._0._0` for story text and `_0._1._0[i]` for
fonts, if you are reading the raw tree.

### Keys PhotoSuite's PSD map doesn't name

`EngineDataCodec.expandEngineDataWire` names nearly everything. The keys that
stay numeric (33 paths in an empty 30.1 document, 48 in 07-type) are these:

- `_98` (the version above) and `_97` on every resource (its UUID).
- `_DocumentResources._FontSet._1` and `…_Identifier._4`.
- **Style features `_89` to `_96` and paragraph feature `_41`.** Of these,
  `_93`–`_96` and `_41` appear only in 30.1 and 2020 saves, not CS6 or CC
  (Legacy). They are newer features than PSD's EngineData carries.
- `_DocumentObjects._4` (`{_0: i7, _1: i10, _2: i0, _3: sIllustrator}`, which
  looks like a writer version) and `_DocumentObjects._5` (30.1 only: a
  bit-string and version list).
- `_View._4`, `_View._5`, and the `_Strikes[]` keys `_5`, `_6`, `_99`.

These are named in the `.ai` fork of the codec (Phase 5/6), not upstream.
Until then they round-trip untouched, because the mapper keeps unknown keys.

## Differences from PhotoSuite's handling, and the patches

1. **Byte strings (patch 0001, `engine-binary-parsers.js`).** The tree holds
   single-byte strings (font and style UUIDs) as well as UTF-16 ones.
   `BinaryTreeParser` assumed every string starts with the FE FF byte-order
   mark: it skipped the first two bytes (`(2f55afd9-…)` became `55afd9-…`),
   and the serializer wrote every string back as UTF-16 with a byte-order
   mark. So every UUID was corrupted on save. The patch keeps strings that
   start with FE FF as `s`, keeps all others as `b`, and writes `b` strings
   back as bytes. PSD strings always carry the byte-order mark, so PSD is
   unaffected.
2. **Bare sheet indices (patch 0002, `engine-data-codec.js`).** In `.ai`, a
   run's `_ParagraphSheet` or `_StyleSheet` can be a bare index (`i0`)
   instead of an inline sheet. `collapseEngineDataWire` had no leaf guard
   (unlike `expand`), so it split `"i0"` into `{0: "i", 1: "0"}`. The patch
   adds the guard.
3. **Float formatting (not patched).** PhotoSuite writes floats with
   `formatTreeFloat` (`-.25` → `-.25000`), so a rewritten payload differs from
   Illustrator's bytes from about byte 3,600 on. It still parses to an equal
   tree. PhotoSuite's PSD writer uses that formatting, so the fix belongs in the `.ai` fork:
   write floats the way Illustrator does (shortest form, no leading zero).
   Until then, the writer can't reproduce Illustrator's text-document bytes,
   only its content.
4. **PhotoSuite's `.ai` reader** (`document/formats/ai-format.js`,
   `loadTextDocument`) splits the block the same way: it gathers each
   payload's `%` lines, reads `RulerOrigin`, then ASCII85-decodes and parses
   **both** payloads. It uses the first one (collapsed to wire keys
   if it has readable ones) and turns each story into a PSD text layer.
   It is an importer: it never writes a text document, so it never ran into
   bugs 1 and 2. The `.ai` fork must include both fixes.

## For the reader and writer (Phases 5 and 6)

- Parse both payloads, and keep the undo-free payload verbatim unless the
  text changes.
- Story *i* ↔ `/AI11Text` with `/StoryIndex i`. Frame *j* ↔ `/FrameIndex`
  plus `_TextFrameSet`.
- Preserve `_97` UUIDs and all unmapped keys.
- A writer needs Illustrator-style float formatting to produce identical
  bytes; semantic equality is enough to open the file.
