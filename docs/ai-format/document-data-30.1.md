# Document data and resource dictionaries in Illustrator 30.1 (task 0.3.4)

Checked against every fixture in `fixtures/ai/30.1/` with
`scripts/research/ai-document-data.mjs`
(`node scripts/research/ai-document-data.mjs fixtures/ai/30.1/*.ai [--keys] [--json out.json]`).
Tests: `tests/scripts/research/ai-document-data.test.js`.

**Results:**

- `%AI9_BeginDocumentData` is a serialised dictionary. The parser and writer
  in `ai-document-data.mjs` reproduce **all 41 fixtures' blocks byte for
  byte**, from AI10 to 30.1.
- The block holds **document settings, not resources.** Swatches, gradients,
  patterns, symbols, brushes and graphic styles each have their own setup
  section; the table below says where. Artboards are the one listed resource
  that lives in the document data.
- The same dictionary language is used by the `%_` art dictionaries in the art
  stream, by inline art objects (`/SymbolInstance :`, `/AI11Text :`), and,
  without the `%_` prefix, by the art styles and SVG filters.

## The dictionary language

It is postfix, and in the document data every line starts with `%_`. Lines
end in CRLF. A lone CR can occur inside a paint style's operators
(`[]0 d\r%_0 XR`); it belongs to that line and must be kept.

| Form | Meaning |
|------|---------|
| `/Type :` | Open a container: `Document`, `Dictionary`, `Array`, `XMLNode`, `ArtDictionary`, `XMLUID`, `KnownStyle`, `ActiveStyle`, `CompoundFilter`, `BasicFilter`, `SVGFilter`, `SymbolInstance`, `GObjRef`, `Binary`, … |
| `;` | Close it. The container becomes the pending value. |
| `<v> /Int (Key) ,` | A typed value: `Int`, `Real`, `Bool` (`0`/`1`), `String`, `UnicodeString`. **An empty string is written with no operand**: `%_ /String (Key) ,`. AI10 splits long strings into 50-byte literals, one per line; they concatenate. |
| `x y /RealPoint` then `%_ (Key) ,` | A point, on two lines. `RealPointRelToROrigin` is relative to the document ruler origin; `RealPoint` is in canvas coordinates. |
| `/FillStyle : <art operators> /Def ;` then `%_ (Key) ,` | A paint style written as raw art-stream operators (`Xy`, `XR`, `Xd`, `Xa`, `XA`, …). Also `StrokeStyle` and `BlendStyle`. |
| `(Key) ,` / `/Name ,` / `,` | Store the pending value under a string key, a name key, or none (array elements). |
| `/Dictionary : /NotRecorded ,` | A keyed `,` with no pending value is a **flag** on the open container. |
| `v1 v2 /Key ,` | Operands stored with no type (art styles: `1 /Visible ,`, `(Chain Style Filter) 0 0 /Filter ,`). |
| `/XMLUID : (Layer_1) ; (AI10_ArtUID) ,` | A one-line container. Its operands, or a typed inner value (`/GObjRef : (Anon …) /ArtStyle ;`), become its content. |
| `… ; /Dict ;`, `/Execution ;`, ` /Def ;` | A name right after a closed container **tags** it; `;` then closes the enclosing container with the tagged value as its content (art styles). |

The whole block is one `/Document` holding two dictionaries, **both of which
are required** (a one-section block is ignored without a warning; see
`container-30.1.md`, rounds 2–5):

```
%AI9_BeginDocumentData
%_/Document :
%_/Dictionary :
%_ … recorded entries …
%_; /Recorded ,
%_/Dictionary : /NotRecorded ,
%_ … not-recorded entries …
%_; /NotRecorded ,
%_;
%AI9_EndDocumentData
```

"Recorded" presumably means the settings that go through undo and actions;
the print, EPS and PDF presets are not recorded. This is unverified *(v)*.

## What the document data holds (30.1, 01-minimal: 90 recorded, 32 not recorded)

Recorded:

- **`ArtboardArray`**: one dictionary per artboard, as listed below.
- **`#document`**: an `XMLNode` tree holding the Variables panel data
  (`metadata/variableSets/variableSet`, …). It is 4.4 KB even when empty.
- Canvas and view: `AIDocumentCanvasSize` (16383), `CropAreaActive`, the
  snapping switches `SnapWhile*` (absent in the CMYK fixture), and
  `AI9 artboard color 1/2 red|green|blue` with `AI9 transparency grid size`
  and `AI9 paper simulation`.
- Bleed: `BleedTop|Bottom|Left|RightValue`.
- Flattener and rasterising: `AI9 Flattening Quality Level`,
  `AI10 flattener *`, `AI16 flattener anti alias`,
  `AI11 Document Setup Flattener Preset Name` (`[Medium Resolution]`),
  `AI9 Output|Mesh Rasterization Resolution`, `AI Auto Rasterize`,
  `AI11 document knockout group|isolate blending`.
- Save options as last used: `kAIParametersPDFCompatibility`,
  `kAIParametersCompression`, `kAIParametersEmbedProfileKey`,
  `kAIParametersFontEmbeedingKey` (the typo is on the wire),
  `kAIParametersSubsetFontsRatioKey`, `kAIParametersWhichProfileKey`, and
  `kAIFullDocumentVersionStr` (`(14.0.0)` even in 30.1).
- `AI12_SpotColorMode`, `AI17 Suppress White Overprint`,
  `AI11 Preserve Text Editability`, `GlobalRepulsion`, `SelHatDocTableDict`,
  `DocumentDict/ExportableAssetsKey` (Asset Export panel).
- **Perspective grid**: 36 `PerspectiveGrid_*` entries (type, unit, scale,
  vanishing points, plane extents and colours, visibility states).
- `Constraint Data` (an empty array; absent in CS6 saves), and
  `GenAIRecorded` (`MigratedArtList`, `GenAIVariationsDictionary`; only in
  01-minimal, and why is not known).

Not recorded: `LastArtboardID`, `AISaveMultipleArtboards`,
`AIDocumentArtboardsSpacingDictKey`, `AI15|AI20 Document PixelPerfect`,
`PerspectiveGrid_ShowHide|Snap|ActivePlane`, the EPS and AI flattening
settings (`AI11 EPS *`, `AI12 AI *`, `AI16 * Anti Aliasing`),
`AI11 Print JobInfo Dict`, `AI11 Print Attribute Dict` (4 KB of print
settings), `AI11 Ink List Dict`, and `PDFPresetCollection`
(`[Illustrator Default]` with its `/attributes/AI11PDF_*` keys).

Across versions: CS6 and CC (Legacy) lack `Constraint Data`. AI10 lacks
`ArtboardArray`, the whole perspective grid, `LastArtboardID` and
`Constraint Data`; before CS4 an AI10 document had one artboard, given by
`%AI3_Cropmarks`/`%%BoundingBox`.

### Artboards

`15-artboards.ai`, three artboards (`ArtboardArray`, simplified with `plain()`):

| Name | PositionPoint1 | PositionPoint2 | RulerOrigin |
|------|----------------|----------------|-------------|
| Main (400×300) | (0, 300) | (400, 0) | (7991, 8041) |
| Square (200×200) | (450, 300) | (650, 100) | (8441, 8041) |
| Letter (612×792) | (0, −50) | (612, −842) | (7991, 8391) |

- `PositionPoint1`/`2` are the top-left and bottom-right corners, y up,
  relative to the document ruler origin (`7991 8341 /RulerOrigin` in the
  `%AI11` text-document block). That origin is the first artboard's
  bottom-left.
- Each artboard's own `RulerOrigin` is its top-left, in canvas coordinates
  with y down: 8341 − 300 = 8041 for Main.
- Other keys: `Name` (`UnicodeString`), `PAR` (pixel aspect ratio, 1),
  `IsArtboardDefaultName`, `IsArtboardSelected`, `IsArtboardLocked`,
  `DisplayMark`, `ArtboardUUID`, and `EachArtboardColor` (a `/FillStyle`).
- The minimum Illustrator needs is established in `container-30.1.md`.

## Where the resources live

All of these sit in the setup, most wrapped in
`%AI5_Begin_NonPrinting` / `Np` … `%AI5_End_NonPrinting--`. They are listed
in stream order, from 06-paint and 08-symbols.

| Resource | Section | Format |
|----------|---------|--------|
| Plugin inventory | `%AI8_PluginGroupInfo` lines in the first non-printing block | `(Group) (Name) (File.aip)` triples naming the plug-ins the document needs |
| **Gradients** | `%AI5_BeginGradient: (Name)` … `%AI5_EndGradient`. Named swatches are at the top level; unnamed gradients in use are in a non-printing block | `(Name) type nstops … Bd`, a hex ramp `[ <…> ]`, `4 %_Br`, then each stop **twice**: `… %_BS` followed by `%_… Bs` (art operators, one form hidden behind the `%_` comment prefix; **not** dictionary lines), then `BD` |
| **Brush and pattern art** | `%AI8_BeginBrushPattern` … `%AI8_EndBrushPattern` (non-printing), with raster tiles in `%AI5_BeginRaster` | `(Unnamed 7)` and then ordinary art operators; the tiles of art, scatter and pattern brushes |
| **Brushes** | `%AI8_BeginPluginObject` blocks (non-printing): `(Adobe Calligraphic Brush Tool)`, `(Adobe ArtOnPath Brush Tool)`, `(Adobe PatternOnPath Brush Tool)`, `(Adobe dBrush Brush Tool)` (bristle), plus `(Adobe Brush Manager Order)` | `(plugin) (brush name) (parameter string) .`, where long strings continue with ` -`. Art and pattern brushes name their tiles in the brush-pattern section |
| **SVG filters** | `%AI10_BeginSVGFilter` (one block holding many `/SVGFilter :`) | The dictionary language without `%_`: an `XMLNode` tree for each filter, tagged `/Def` |
| **Graphic styles** | `%AI9_BeginArtStyles` (non-printing) | The dictionary language without `%_`. `/KnownStyle :` holds `(Anon …)` or `([Default]) /Name ,` and an `ActiveStyle`, a filter tree: Chain → Stack → `BasicFilter`s (`Adobe Stroke Offset`, `Conduit Filter`, `Fill Style Filter`, `Blend Style Filter`), each with a `/Dict` of `FillStyle`/`StrokeStyle`/`BlendStyle`, tagged `/Execution` and `/Def`. Art refers to styles by name (`/GObjRef : (Anon …) /ArtStyle ;`) |
| **Swatches** | `%AI5_BeginPalette` … `%AI5_EndPalette`, with a `%AI17_Begin_Content_if_version_gt:24 15` versioned copy | `0 0 Pb`, then one entry per swatch: `c m y k r g b (Name) tint type Xx` (spot, 06: `(VS Spot Teal) 0 1 Xx`) or `… Xk` (global process), then `(Name)` and `Pc`. Gradient swatches: `Bb … (Name) … Bg`, `0 BB`, `(Name)`, `Pc`. Closed by `PB` |
| **Graphic styles panel list** | `%AI9_BeginArtStyleList` | One `(Name)` per line: the styles listed in the Graphic Styles panel |
| **Symbols** | `%AI14_BeginSymbol` / `(Name)` then art … **`%AI10_EndSymbol`** (the begin and end versions differ; the name line ends with a lone CR), and `%AI24_BeginSymbolList` (`%AI10_BeginSymbolList` in AI10), which lists the names in panel order | Instances in the art are `/SymbolInstance : (Name)  /SymbolRef , a b c d tx ty /RTransformMatrix ;`. The matrix has a y flip (`1 0 0 -1 …`) |
| **Document settings and artboards** | `%AI9_BeginDocumentData` | Above |
| **Text resources** | `%AI11_BeginTextDocument` | `text-document-30.1.md` |

**Patterns:** a pattern swatch is a **`%AI3_BeginPattern`** section (still
the AI3 marker in 30.1), one per pattern, inside `%%BeginSetup`; the swatch
list names it like any other swatch. See `live-features-30.1.md`,
"Patterns". **Brushes:** a brush is a plugin object in a non-printing setup section and
its art (for Art and Pattern brushes) is an `%AI8_BeginBrushPattern` tile.
See `live-features-30.1.md`, "Brushes".
Swatch groups and a named graphic style came with corpus v3
(19-styles-swatches; see `live-features-30.1.md`).

## Status of the parser on the other sections

`parseDictionary` / `writeDictionary(tree, prefix)` from `ai-document-data.mjs`:

| Section | Parses | Writes back byte for byte |
|---------|:------:|:--------------------------:|
| `%AI9_BeginDocumentData` (41 fixtures) | yes | **yes** |
| Art dictionaries and inline objects (745, found by `ai-art-objects.mjs`; task 0.3.5) | yes, with `/Binary` data and `X=` art cut out as blobs | **yes** |
| `%AI9_BeginArtStyleList`, `%AI24_BeginSymbolList` | yes | yes |
| `%AI9_BeginArtStyles`, `%AI10_BeginSVGFilter` (41 each) | yes | **yes** (`parseSectionLines`, which also cuts out the Photoshop-style effects' ASCII85 `(data)`): the parser records the whitespace that differs from the default layout (`; /Dict ;`, the blank line before `/Execution ;`), and `/SimpleStyle : … /Paint ;` is a paint style |

## For the reader and writer (Phases 5 and 6)

- Fork the parser into `src/document/formats/ai/` as the generic dictionary
  codec. Every section above except the palette, gradients, brush art and
  plugin objects uses it.
- Keep every document-data key we don't model verbatim: the tree
  round-trips exactly, so a document can carry it untouched.
- Styles, like everything else in the language, now write back byte for
  byte. The recorded gaps are layout only; a style built from scratch uses the
  default layout, which Illustrator's own styles don't always follow, so
  check a written style in 30.1 before relying on it.
