# The `.ai` container as written by Illustrator 30.1

Measured on 2026-09-24 with `npm run ai:dump` against fixtures that a
**licensed** Illustrator 30.1.0 (build 136R, Windows 10) saved from
`scripts/research/illustrator/make-fixtures.jsx`. The fixtures themselves are
in the gitignored `.research/fixtures-30.1/`, for the reasons in "What a new
document carries" below.

## The PDF wrapper

- Every file is **PDF 1.6**, including one saved with *Create PDF Compatible
  File* off. That option changes the page content, not the container.
- The page's private dictionary (the one holding `/AIMetaData`) reads:

  ```
  <</AIMetaData 14 0 R /AIPrivateData1 15 0 R … /AIPrivateDataN …
    /ContainerVersion 12 /CreatorVersion 30 /NumBlock N
    /RoundtripStreamType 2 /RoundtripVersion 24>>
  ```

  `/RoundtripVersion 24` confirms that 30.1 writes the Illustrator 2020
  (version 24) format. `/CreatorVersion` is the application's major version.
- `/AIPrivateDataN` streams carry **no PDF filter**. Each holds exactly
  **65,536 bytes** except the last (§4.2 said "measure it": this is the
  answer).

## The art stream

- **Compressed** (*Use Compression* on, the default): block 1 starts with the
  20-byte header `%AI24_ZStandard_Data`, and blocks 1…N joined (minus the
  header) form **one zstd frame**. A minimal RGB document is 3 blocks.
- **Uncompressed** (*Use Compression* off): no header. The blocks are the plain
  stream: 16 blocks, byte-identical content.
- The decompressed stream is PostScript-like text **with raw binary inside**:
  `%%BeginData: N` is followed by exactly N bytes of binary (embedded raster
  pixels), then `%%EndData`. A reader must skip N bytes, not scan for a line
  ending. `ai-dump` does this in `withoutBinaryData`.
- Header comments (minimal file):

  ```
  %!PS-Adobe-3.0
  %%Creator: Adobe Illustrator(R) 24.0      ← format version, not app version
  %%AI8_CreatorVersion: 30.1.0              ← app version
  %%For: (<Windows user name>) ()
  %%Title: (Untitled-1)
  %%CreationDate: 9/24/2026 4:42 AM
  %%Canvassize: 16383
  %%BoundingBox: 50 100 250 250
  %AI5_FileFormat 14.0
  %AI12_BuildNumber: 136
  %AI3_Cropmarks: 0 0 400 300               ← first artboard
  %AI5_ArtSize: 14400 14400
  %AI24_LargeCanvasScale: 1
  %AI5_NumLayers: 1
  %AI17_Begin_Content_if_version_gt:24 4    ← versioned content, kept verbatim (§4.2)
  …
  %%EndComments
  ```

- One red rectangle on one layer is 18 lines:

  ```
  %AI5_BeginLayer
  1 1 1 1 0 0 1 0 79 128 255 0 50 0 Lb      ← layer flags and colour (79,128,255)
  (Layer 1) Ln
  0 AE
  %_/ArtDictionary :                        ← dictionaries travel as %_ comment lines
  %_/XMLUID : (Layer_1) ; (AI10_ArtUID) ,
  %_;
  %_
  0 A                                       ← not locked
  0 Xw
  4 As
  0 O                                       ← no overprint
  0 0.993347048759461 1 0 1 0 0 Xa          ← fill: CMYK approximation, then RGB 1 0 0
  0 1 0 0 0 Xy
  0 J 0 j 1 w 10 M []0 d                    ← cap, join, width, miter, dash
  0 XR                                      ← non-zero winding
  50 100 m
  50 250 L
  250 250 L
  250 100 L
  50 100 L
  f
  LB
  %AI5_EndLayer--
  ```

## What a new document carries

A document with one rectangle decompresses to **~993 KB** (215 KB on disk).
Almost all of it is the **startup profile's resources**, written into every
file: 18 gradients, 15 symbols, 4 brush patterns, 2 patterns, graphic styles,
an SVG filter set, and 5 embedded rasters (7 `%%BeginData` blocks, 210 KB of
binary). A CMYK document carries a different, larger set (1.66 MB).

Consequences:

- These files contain Adobe's library artwork, so **they can't be committed
  or redistributed** (R4). Corpus v2 deletes every startup resource scripting
  can delete (stream 993 → 678 KB). **Brushes can't be deleted by script**, and
  the startup art brushes bring 4 brush patterns and 5 rasters (208 KB of
  Adobe artwork). A clean committed corpus needs a brush-free New Document
  profile. The `%AI11_BeginTextDocument` block (220 KB) is the text engine's
  default settings (CJK rule sets, composite fonts): data rather than artwork.
- The writer must not assume a document is small, and the reader must stream.
- `%%For:` records the OS user name and `%%CreationDate:` the save time.
  VectorSuite's writer should let the user control both (privacy).

## What each feature adds (compared with the minimal file)

| Fixture | New or increased in the stream |
|---------|--------------------------------|
| 03 layers | `%AI5_BeginLayer`/`EndLayer` per layer (sublayers nest). `Lb`/`Ln`/`LB`/`AE` per layer. The flags in `Lb` carry visible, locked and printable. |
| 04 paths | `c` (curveto), `S` (stroke), `b` (close+fill+stroke), `M` (miter), `R`/`XA`. Dashes appear in `d`. |
| 05 structure | `q`/`Q` (clip group), `W`/`h`, `u`/`U` (group), `*u`/`*U` (compound path), `D` (even-odd flag). |
| 06 paint | `%%DocumentCustomColors`, `%%RGBCustomColor` (spot). `Xk`, `Xx` (custom colour fill, tint). `Bb`/`Bg`/`BB`/`Bm`/`Bh`/`Bc` (gradient instance). `Pc` (paint colours). |
| 07 type | `%%DocumentFonts`, `%%DocumentNeededFonts`, `%AI3_BeginEncoding`. `TE`/`TZ`, `Xd`. The text itself is in the `%AI11_BeginTextDocument` block (EngineData, task 0.3.3). |
| 08 symbols | One more `%AI14_BeginSymbol` definition, instances via `XW`/`Np`. |
| 09 blend, 10 Live Paint, 12 envelope, 14 Image Trace | One `XP` (plugin/live object) each, plus the cached expansion: the blend's intermediate paths (`c` 36→1060), the trace's paths. |
| 11 Repeat (radial, grid, mirror) | An extra `%AI17_Begin_Content_if_version_gt` block (content older versions see instead) and ASCII85-encoded plugin data on `%%`-prefixed lines. |
| 13 live effect (drop shadow) | Stream 1 MB → **2.7 MB**: the effect's rendered result is cached as a new embedded raster (`%AI5_BeginRaster` + `%%BeginData`). |
| 15 artboards | No new sections: artboards live in the document data (`%AI9_BeginDocumentData`, task 0.3.4), not the art stream. |
| 02 CMYK | `%%CMYKProcessColor` in place of `%%RGBProcessColor`. `k`/`K` fills. A different startup profile. |

Operator meanings above are working hypotheses from the diffs. Confirm each
against the AI7 specification and the fixtures before the reader relies on it
(task 0.3.5).

## Save As versions (corpus v2, same one-rectangle document)

| Save As version | Container | Private dictionary | Art stream |
|-----------------|-----------|--------------------|------------|
| Illustrator 2020 (the default; `ILLUSTRATOR24` gives identical output) | PDF 1.6 | `/ContainerVersion 12 /RoundtripStreamType 2 /RoundtripVersion 24` | 64 KiB blocks; `%AI24_ZStandard_Data` at the start of block 1; zstd. `%%Creator: … 24.0` |
| CC (Legacy) (`ILLUSTRATOR17`) | PDF 1.5 | `/ContainerVersion 11 /RoundtripStreamType 1 /RoundtripVersion 17` | Block 1 is a **2,067-byte preamble** (bounding box and so on) outside the compressed data; `%AI12_CompressedData` starts block 2; deflate. `%%Creator: … 17.0` |
| CS6 (`ILLUSTRATOR16`) | PDF 1.5 | As CC (Legacy), `/RoundtripVersion 16` | As CC (Legacy). `%%Creator: … 16.0` |
| Illustrator 10 (`ILLUSTRATOR10`) | PDF 1.4 | `/ContainerVersion 9` | Preamble block, then **uncompressed** blocks. `%%Creator: … 10.0` |
| Illustrator 8 (`ILLUSTRATOR8`) | PostScript (EPS-style) | none | The file is the art stream. `%%Creator: … 8.0`; `procset` resources; 6 `%%BeginData` blocks |
| Illustrator 3 (`ILLUSTRATOR3`) | PostScript | none | 1.7 KB: no resources survive. `%%Creator: Adobe Illustrator(TM) 3.2`; AI3 procsets (`Adobe_Illustrator_AI3` and others) |

Every version records the writing application as `%%AI8_CreatorVersion:
30.1.0`, so a reader can tell a down-save from a file made by the old
application. The down-save writer (task 6.4) must reproduce each row, the
preamble block included.

## Writing: what Illustrator 30.1 accepts (write spike, task 0.3.6)

`scripts/research/ai-write-spike.mjs` writes `.ai` files with VectorSuite's own
container code. Round 1 (2026-09-24), opened in a licensed 30.1:

| File | Result |
|------|--------|
| S0: Illustrator's stream in our container, zstd | Opens. Rectangle on the artboard, layer and artboard correct. **The container is accepted.** |
| S1: minus every setup non-printing block | Opens, correct. |
| S2: minus `%AI9_BeginDocumentData` | Opens, but the **rectangle is off the artboard**. |
| S3: minus `%AI11_BeginTextDocument` too | Same as S2. |
| **S4: a stream written from scratch (845 bytes), zstd** | **Opens without warnings**, with Layer 1 and Artboard 1, but the rectangle is off the artboard (no document data). |
| S0 and S4 uncompressed | "Only partial read": Illustrator fell back to importing the PDF page (untitled document). Cause below. |

Findings:

- **`/RoundtripStreamType` names the compression**: `2` is zstd, `1` is
  deflate (CC Legacy, CS6), and **the key is absent for an uncompressed
  stream**. Declaring `2` over plain text makes Illustrator fail the private
  data and import the PDF page instead. The writer now omits the key when
  uncompressed.
- **Artboards come from document data, not `%AI3_Cropmarks`.** The
  `ArtboardArray` in `%AI9_BeginDocumentData` holds, per artboard,
  `PositionPoint1`/`PositionPoint2` (`/RealPointRelToROrigin`, relative to
  the document ruler origin), a canvas-space `RulerOrigin`, `Name`, `PAR`,
  `IsArtboardLocked`, `ArtboardUUID`, `EachArtboardColor` and `DisplayMark`.
  The document ruler origin (`7991 8341 /RulerOrigin`, canvas coordinates
  with y down) sits in the `%AI11` text-document block, and it is the first
  artboard's bottom-left. Art-stream coordinates are y-up offsets from it.
  Without document data, Illustrator invents a top-left origin (its re-save
  of S4 writes `%AI3_Cropmarks: 0 -300 400 0`, `%%PageOrigin:50 -25`) and the
  art lands outside the artboard.
- The document-data block is a serialised dictionary: `%_` lines,
  `/Dictionary :` or `/Array :` opening a container, entries written
  `value /Type (Key) ,`, `; (Key) ,` closing and naming a container, and
  `; /NotRecorded ,` then `;` ending the block.

Rounds 2–5 (from round 3 on, run and checked automatically through
`scripts/research/illustrator/vs-agent.ps1` and `check-ai-files.jsx`, which
open each file in the licensed 30.1 and report artboard and path geometry;
the checker reproduced every manual observation from rounds 1–2):

| Variant (all on the scratch stream) | Art on the artboard? |
|--------------------------------------|----------------------|
| + Illustrator's complete document data | yes |
| + VectorSuite's minimal artboard list, **one section** | **no**: block ignored |
| + the same and Illustrator's `%AI11` text document | no |
| + subsets of Illustrator's document data that keep `ArtboardArray` (minus the `#document` XML tree; only XML + artboards; only artboards + the not-recorded section; only artboards, `AIDocumentCanvasSize`, `LastArtboardID`) | yes |
| + Illustrator's document data minus `ArtboardArray` | no (control) |
| + VectorSuite's minimal artboard list, **two sections**, with or without `LastArtboardID` | **yes** |
| + VectorSuite's minimal artboard list, one section, with `LastArtboardID` | no |
| The uncompressed files, without `/RoundtripStreamType` | yes: open as `.ai`, with their names |

Conclusions for the writer (task 6.3):

- **The document-data block must have both sections**: the recorded
  dictionary closed by `; /Recorded ,`, then `/Dictionary : /NotRecorded ,`
  … `; /NotRecorded ,`. With only one, Illustrator ignores the block without
  a warning, including the artboard list, and places the art itself.
- **An `ArtboardArray` entry per artboard is the minimum** for correct
  placement: `PositionPoint1`/`PositionPoint2`, `RulerOrigin`, `Name`, `PAR`,
  `IsArtboardDefaultName`, `IsArtboardSelected`, `DisplayMark`,
  `IsArtboardLocked`. Nothing else in the document data, the `%AI11` text
  document or the setup resources is required.
- **Task 0.3.6 is done**: a file whose container, art stream and document data
  are all VectorSuite's (`ws-r3f`, 1.5 KB stream) opens in 30.1 with no
  warning, and the rectangle, layer and artboard are all correct.

## Follow-ups
- `%AI9_BeginDocumentData` and where each resource lives: `document-data-30.1.md` (task 0.3.4).
- `%AI11_BeginTextDocument` against PhotoSuite's EngineData parser: `text-document-30.1.md` (task 0.3.3).
