<!-- Migrated from the VectorSuite plan (vectorsuite.md §4), the archived
     Tauri/JS prototype this fork replaces. See docs/decisions/0001-fork-from-vectorcraft.md.
     Values marked *(v)* are unverified against a licensed Illustrator 30.1. -->

## 4. File formats and `.ai` compatibility

### 4.1 Anatomy of a modern `.ai` file

These facts come from PhotoSuite's working reader (`document/formats/ai-format.js`).
Each one needs a fixture test:

1. **Container.** When "Create PDF Compatible File" is on (the default since
   Illustrator 9), the file *is* a PDF: `%PDF-` magic, possibly after leading
   bytes. **Each artboard is a PDF page**, drawn with normal PDF content
   streams. Any PDF viewer shows this rendition.
2. **Private data.** A dictionary containing `/AIMetaData` (reached through the
   Illustrator `PieceInfo` / `Private` dictionary) lists
   `/AIPrivateData1 … /AIPrivateDataN` (and `/AIPDFPrivateData…`) object
   references. Concatenated in order, their streams form Illustrator's native
   content. The first block may be a `%%BoundingBox` or `%AI7_Thumbnail`
   header block, which is skipped.
3. **Compression header** on the first block, 20 bytes long:
   - `%AI12_CompressedData` → zlib/deflate (CS2 through CC 2019).
   - `%AI24_ZStandard_Data` → **Zstandard (introduced in v24; still the format
     30.x writes: Adobe's 30.0 recovery docs tell users to save "with
     compatibility set to Illustrator 2020")**. New features since 2020 add art
     dictionaries and plugin groups inside the same container, not a new
     container.
   - Otherwise the data is uncompressed.
4. **Legacy / EPS form** (no PDF): PostScript text that either contains art
   directly (`%AI5_BeginLayer`, `%AI5_NumLayers`), or an ASCII85-encoded
   `%AI9_DataStream` / `%AI24_DataStream` section ending at
   `%AI9_PrivateDataEnd`. Deflated data starts with `78 9C`; otherwise it is zstd.
5. **The native stream** is Adobe's AI art language, PostScript-like, from
   AI3 onward (this is Adobe's published *Illustrator File Format
   Specification*, which covers AI3 and later AI5/AI7 extensions). It contains:
   - Document setup and prolog comments (`%%`, `%AI…_` keys).
   - `%AI9_BeginDocumentData … %AI9_EndDocumentData`: a binary or dictionary
     block holding document-level resources (swatches, gradients, patterns,
     symbols, brushes, graphic styles, artboards, preferences).
   - `%AI11_BeginTextDocument … %AI11_EndTextDocument`: the text engine
     document (stories, style sheets). It is expected to share its syntax with
     PSD EngineData, so PhotoSuite's `engine-binary-parsers.js` and
     `engine-data-codec.js` should apply. **This needs a spike to confirm.**
   - `%AI17_Begin_Content_if_version_gt … %AI17_Alternate_Content …
     %AI17_End_Versioned_Content`: version-gated alternates. PhotoSuite
     currently flattens them. VectorSuite must keep both branches and write
     them back.
   - `%AI5_Begin_NonPrinting` sections, layer blocks (`Lb … LB`, name `Ln`),
     and art operators.
6. **Operators PhotoSuite already handles.** Meanings follow the AI spec;
   confirm each against fixtures:

   | Group | Operators |
   |-------|-----------|
   | Path construction | `m` moveto; `l` / `L` lineto; `c` / `C`, `v` / `V`, `y` / `Y` curveto variants. Uppercase marks a corner point and lowercase a smooth point. `h` / `H` close. |
   | Graphics state | `w` width, `j` join, `J` cap, `M` miter limit, `d` dash, `XR` fill rule |
   | Grouping | `u` / `U` group, `*u` / `*U` compound path, `q` / `Q` clip group, `W` clip |
   | Layers | `Lb` / `LB` layer begin and end, `Ln` layer name |
   | Colour and paint | `Xa`, `Xk`, `Xx`, `Xy` and relatives (RGB, CMYK, custom colours), `p` pattern |
   | Gradients | `Bb`, `BB`, `Bg`, `Bm`, `Bh` (gradient instance begin/end, geometry, matrix, highlight) |
   | Raster | `XI` (image data), `XN`, `Xh`, `Xm`, `Xw`, `Xd` (image and matrix params) |
   | Other | `AE` / `Ae`, `,` `;` (separators), `*`, `p` |

7. **Live objects.** Plugin groups (blends, envelopes, Live Paint, image trace,
   symbols, live effects) are stored as art dictionaries or plugin-object
   records carrying their parameters **plus an expanded rendition** that older
   readers display. The reverse-engineering programme in Phase 6 documents
   these one by one in `docs/ai-format/`.

### 4.2 `.ai` read and write strategy

- **Read.**
  1. Detect `%PDF` versus `%!PS-Adobe`.
  2. Gather the private data.
  3. Decompress (deflate or zstd, reusing PhotoSuite's zstd WASM).
  4. Tokenise into an AI syntax tree that keeps source order and comments.
  5. Map that tree to the DOM, keeping unrecognised operators, dictionary keys
     and sections as `unknown` nodes attached to their parent.
  6. If there is no private data (PDF compatibility was the only thing saved,
     or it is a third-party "AI"), fall back to PDF import. This matches
     Illustrator's own fallback.
- **Write** (Save / Save As → the current format, as written by Illustrator 30.1):
  1. Serialise the DOM plus `unknown` nodes back to the AI stream.
  2. Compress with zstd and write the `%AI24_ZStandard_Data` header.
  3. Split into `AIPrivateData<n>` streams of exactly 65,536 bytes, the last
     shorter (measured on 30.1, `docs/ai-format/container-30.1.md`). Set
     `/RoundtripStreamType 2` for zstd and omit it when uncompressed.
  3a. Write the `%AI9_BeginDocumentData` block in its two-section shape (the
     recorded settings, then the not-recorded dictionary), with an
     `ArtboardArray` entry per artboard. Illustrator 30.1 silently ignores a
     one-section block and places the art itself.
  4. Build the PDF rendition. Each artboard becomes a page, with PDFI `ToPDF`,
     embedded or subset fonts, ICC and optional content (layers as OCGs).
  5. Write the XMP packet (with thumbnails) and the `PieceInfo` / `AIMetaData`
     dictionaries.
- **Save As options** (Illustrator Options dialog):
  - **Version:** the list 30.1 shows. Its newest entry still reads
    "Illustrator 2020" (zstd), as Adobe's 30.0 docs confirm; the full list
    and its order are still *(v)*. Then CC (Legacy) (deflate), CS6, CS5, CS4, CS3, CS, 10, 9, 8,
    and 3 (Japanese). Down-save rules: legacy versions flatten or expand
    features they don't support, and show the same warnings as Illustrator.
    Post-2020 live objects (Repeat, 3D and Materials, Intertwine, Objects on
    Path, Dimension) need their own down-save behaviour, captured from 30.1.
  - **Fonts:** subset when the percentage of characters used is below N%
    (the default is 100%).
  - **Options:** Embed permitted fonts for file preview (new since 2020),
    Create PDF Compatible File, Include Linked Files, Embed ICC Profiles, Use
    Compression, Save Each Artboard to a Separate File (with range; it also
    writes a master file).
  - **Save in Background** (default on, `.ai` only; not when PDF
    compatibility is off or third-party plugin content is present). In 30.0
    it also takes over recovery backups, so "Automatically Save Recovery Data
    Every" is off by default. See `docs/parity/notes-30.1.md`.
  - **Transparency** (legacy versions): Preserve Paths (discard
    transparency), or Preserve Appearance and Overprints (with a flattener
    preset).
- **Acceptance.** A curated fixture corpus (§8.2) round-trips
  VectorSuite → Illustrator 30.1 → VectorSuite with no loss. This is checked
  at three levels: the DOM diff is empty, the raster rendition matches, and
  unknown content survives byte-identically.

### 4.3 Other formats (Illustrator 30.1 parity)

| Direction | Formats |
|-----------|---------|
| **Open / Place** | AI (all versions), AIT (template), PDF (with page choice), EPS / EPSF / PS, SVG / SVGZ, DXF / DWG (AutoCAD R13–2018), CGM, EMF / WMF, PSD (with layer comps, and "convert layers to objects" versus flatten; reuses PhotoSuite PSD), TIFF, JPEG / JPEG 2000, PNG, GIF, BMP, Targa, PCX, PICT, PXR, FXG. Text: TXT, RTF, DOC / DOCX (Place into area type). HEIF/HEIC and WebP (native since 26.0) and AVIF (26.3) come from PhotoSuite codecs. |
| **Save As** | AI, PDF (Adobe PDF presets: \[Illustrator Default], \[High Quality Print], \[PDF/X-1a:2001], \[PDF/X-3:2002], \[PDF/X-4:2008], \[Press Quality], \[Smallest File Size] …, with the full PDF options dialog: General, Compression, Marks and Bleeds, Output, Advanced, Security, Summary), EPS (with preview options), AIT, SVG and SVGZ (with the SVG options dialog: profile, fonts, image location, CSS properties, decimal places, encoding, responsive). |
| **Export → Export As** | DWG, DXF, BMP, EMF, JPEG, PSD (layers, editable text, max editability), PNG, SVG, Targa, TXT, TIFF, WebP (27.6), WMF and PDF, per Adobe's 2024 export page. **SWF and PICT are no longer listed**, so they are dropped (D2). CSS extraction is separate (§5.14). 3D objects export as GLTF, USDA (default), USDZ or OBJ from the 3D and Materials panel (§5.16, Phase 7.7). Export in Background (default on) covers PNG and JPG from Export for Screens. |
| **Export → Export for Screens** | Artboards and Assets tabs (plus 30.0 selective artboard export and reusable export settings, 27.3), formats PNG, PNG-8, JPG (quality presets), SVG, PDF, scale presets (0.5x–4x, width or height, resolution), suffixes, subfolders, iOS/Android presets, prefix, "open location after export". |
| **Export → Save for Web (Legacy)** | GIF, JPEG, PNG-8, PNG-24, WBMP, with presets, dithering, transparency, matte, image size, optimise and preview. |
| **Export Selection** | Opens Export for Screens with the selected assets. |
| **Asset Export panel** | Drag art in, choose multiple export scales and formats. |
| **Package** | Copies links and fonts (excluding CJK and Typekit), writes a report, and collects links in a folder. |

Presets and resources that load and save: swatches (`.ase`, `.aco`,
Illustrator swatch libraries as `.ai`), brushes (as `.ai` libraries), symbols,
graphic styles (as `.ai` libraries), tracing presets, PDF presets (`.joboptions`),
print presets, flattener presets, perspective grid presets, keyboard shortcuts
(`.kys`), workspaces, actions (`.aia`) and colour settings (`.csf`).

---

