# Live features in the Illustrator 30.1 art stream (task 0.3.5)

Checked against fixtures 07–14 (corpus v2), 16–19 (corpus v3) and 20–22 (by hand) in
`fixtures/ai/30.1/` with
`scripts/research/ai-art-objects.mjs`
(`node scripts/research/ai-art-objects.mjs fixtures/ai/30.1/*.ai [--keys] [--effects] [--json out.json]`).
Tests: `tests/scripts/research/ai-art-objects.test.js`. The dictionary
language itself is described in [`document-data-30.1.md`](document-data-30.1.md).
Interpretations that are not yet confirmed by a controlled variant are marked
*(v)*.

**Results:**

- A live object is stored in one of four ways: a **plugin group** (blend, Live
  Paint, envelope, Image Trace), a **versioned object** in `%AI17` content
  (Repeat), an **art style** on ordinary art (live effects), or an **inline
  dictionary object** (symbol instances, text frames).
- Every one of them carries its parameters in the same dictionary language.
  All 745 dictionaries in the corpus, nested ones included, parse, and
  `writeArtDictionary` writes each one back **byte for byte**. So do all 31
  fixtures' art styles, SVG filters and style lists.
- Each live object also stores its **cached result** as ordinary art: the
  blend steps, the Live Paint faces, the distorted envelope, the traced paths,
  the expanded drop shadow. A reader that doesn't understand the object can
  still draw it. Repeat is the exception: it stores only its source art, plus
  a PDF of the result for older readers.

## Extensions to the dictionary language

Found in the live objects and now handled by `ai-document-data.mjs`:

| Form | Meaning |
|------|---------|
| `%_/Binary : /ASCII85Decode ,` then data lines, then `%_; (Key) ,` | Binary data. The data lines start with a bare `%` (not `%_`) and end at `~>`. A data line can itself begin `%_`, so a reader must switch to data mode after the flag rather than go by the prefix (Live Paint). |
| `/Data ,` then data lines, then `;` | The same data as a flag followed by operands (`/ForeignObject`, Repeat). |
| `X=` … `X+` | **Embedded art**: art-stream operators, with their own `%_` dictionaries and `%%BeginData` rasters, as a value (`%_X+` then `%_ (AIDeformArtKey) ,`) or as the content of an `/Art :` container. Nesting is counted. |
| `/1133903872 /Int (Key) ,` | An `Int` written as a name, possibly negative. Live Paint does this for its gap length (0x43960000, the bit pattern of the float 300.0 *(v)*) and its artwork CRC32; Scribble for its random seed (`/-746421769 /Int (ScribbleFill:RandomSeed)`, in the object's `Adobe_AI9_Execution_Instance_Data`). |
| `/SimpleStyle : <art operators> /Paint ;` | A paint style that ends in `/Paint`, not `/Def` (a `KnownStyle`'s paint in 02-cmyk's `[Default]` style and in 10-live-paint). |
| Layout | The writer's default layout covers the document data. Art styles and inline objects differ in whitespace (`; /Dict ;` on one line, a blank line before `/Execution ;`, `(VS Star)  /SymbolRef ,` with two spaces, ` /RadialRepeatObject :` with a leading one). The parser records each gap that differs from the default, and the writer reproduces it. |

The scanner (`scanArt`) finds a dictionary wherever a line (after an optional
`%_`) is a lone `/Type :`, skips `%%BeginData: n` payloads by byte count, and
reads a plugin object's hex data by the byte count in its `XP` line.

## Plugin groups

Blend, Live Paint, envelope and Image Trace are all written as one pattern.
Here is the envelope from 12-envelope, shortened:

```
%_0 Ae                      ┐
%_u                         │ edit art, hidden from old readers (%_):
%_/Mesh X! … /End X!        │   the envelope mesh (the top object, converted)
%_U                         │
%_/ArtDictionary :          │ the plugin's settings, on the edit group
%_… (AIDeformArtKey) ,      │   (here with the envelope's contents as X= art)
%_;                         │
%_9 () XW                   ┘
0 Ap                        ← separates the edit art from the result
0 Ae                        ┐
u … distorted path … U      │ result art: ordinary, visible art
9 () XW                     ┘
0 Ae
(Adobe Deform Plugin) 1 0 0 XP     ← names the plugin; then 0 bytes of data
9 () XW
```

- `(Name) a b n XP` ends the group. In every fixture `a b` is `1 0` *(v:
  meaning)*, and `n` is the length of the private data that follows as hex on
  `%` lines, 60 digits each. Only the blend has any (92 bytes).
- An `ArtDictionary` after `XP` belongs to the plugin group itself (Live
  Paint's `AI10_ArtUID`).
- The edit art is what the plugin regenerates the result from. Whether a
  reader may drop the result and regenerate it depends on matching
  Illustrator's output exactly, so the reader must keep it.

## Catalogue

### Blend: `Adobe Path Blends` (09-blend)

- **Edit art:** the two end objects, each followed by
  `(ShapeBlendPathID)` (`A`, `B`) and `(ShapeBlendPathType)` `K` *(v: key
  object)*, and the spine, an unpainted open path (`N`) with
  `ShapeBlendPathType` `S`. The default straight spine runs from A's centre
  to B's (`330 70 m 50 230 L`). The IDs follow stacking order: B is the
  first-drawn (back) circle.
- **Result art:** 256 filled paths: the two ends plus 254 steps. The end
  copies repeat their `ShapeBlendPathID`.
- **XP data** (92 bytes, little-endian):

| Offset | Value | Reading |
|-------:|-------|---------|
| 0 | `44 43 42 41` | magic `ABCD` as a u32 |
| 4 | 0 | version *(v)* |
| 8 | f32 4.0 | spacing mode *(v)* |
| 12 | f32 3.4028235e38 (FLT_MAX) | specified distance, unset *(v)* |
| 16 | u32 254 | step count (matches the 254 steps in the result) |
| 20 | 0 | orientation *(v)* |
| 24 | u32 67 (`C`) | the next free path ID *(v: A and B are taken)* |
| 28–40 | 0, 0, 1, 2 | …, record count 2 *(v)* |
| 44, 68 | 2 × 24 bytes | per end: ID (`A`/`B`), 0, f32 position on the spine, −1, −1, then 0 / 254 *(v: steps to the next object)* |

The position is measured in **spine segments**: 0.0 and 1.0 on the default
straight spine, 0.0 and 2.0 after 18-blend-spine replaced it with a
three-anchor arc. That is the only byte that changed; replacing and reversing
the spine is otherwise carried by the spine path itself.

The Blend Options dialog can't be driven by script, so confirming the
spacing and orientation fields needs variants made by hand (see "Fixtures
still needed").

#### Blend Options: the 92-byte record decoded (27-blend-options)

Three blends of the same two circles, given Blend Options by hand, name the
fields of the `Adobe Path Blends` record (32-bit words, little-endian, word 0
being the `ABCD` magic):

| Word | Meaning |
|------|---------|
| 1 | **Spacing**: `0` Smooth Color (the default, as in 09-blend and 18-blend-spine), `1` Specified Steps, `2` Specified Distance |
| 2 | float: the **Specified Distance** in points (`20`). It keeps the dialog's last value (`60`) when the spacing is by steps |
| 4 | the **step count in effect** — `5` for Specified Steps 5, and `17` for Specified Distance 20 pt, which Illustrator resolves against the span. `254` is the Smooth Color default |
| 5 | float, **written only for Orientation: Align to Path** — `11.1416` in this fixture *(v: what the number is; two blends of the same geometry gave the same value, so it looks derived from the spine)*. Zero for Align to Page |
| 22 | word 4 again |
| 3, 6, 9, 10, 11, 14, 15, 17, 19, 20, 21 | the same in every blend seen so far: `FLT_MAX`, `67` (`C`), `1`, `2`, `65` (`A`), `-1`, `-1`, `66` (`B`), `1.0f`, `-1`, `-1`. The `A`, `B`, `C` match the ends' `ShapeBlendPathID`s |

Blend Options is a dialog, but **Object > Blend > Make is not**: the sheet job
blends each pair with `executeMenuCommand("Path Blend Make")`, so only the
three dialogs are done by hand.

### Live Paint: `Adobe Planar Group` (10-live-paint)

- **Edit art:** the original paths, each tagged `(Adobe Planar Child Tag)` 1,
  2, …, then the group's planar map dictionary:

| Key | Value |
|-----|-------|
| `Adobe Planar Map Ruler Origin` | `RealPoint`, the document ruler origin (7991, 8341) |
| `Adobe Planar Map File Version`, `Adobe Planar Map Version` | 2 |
| `Adobe Planar Map Code Version` | 4 |
| `Adobe Planar Last Edit Tag ` (sic, trailing space), `Adobe Planar Last Edit Gap Tag` | 2, −2 |
| `Adobe Planar Map Input 2` | one dictionary per child path: `Adobe Planar Child Type` 0, `Adobe Planar Child Tag`, `Adobe PlanarMap Closed Path`, `Adobe Planar Map Fragment Parameters` (binary), `Adobe PlanarMap RAR Segments` (binary), and per segment `Adobe Planar Map Fragment Stroke Vector`, `… Left Fill Vector`, `… Right Fill Vector`: arrays of `/GObjRef … /ArtStyle` (the paint) or `0 /Int` (none) |
| `Adobe Planar Map Initial Matrix 2`, `Adobe Planar Map Matrix 2` | binary: 6 doubles, [100 0 0 100 0 0] |
| `Adobe Planar Map Gap Length 2` (as a name, see above), `Adobe Planar Map Gap Detect On`, `Adobe Planar Map Gap Area 2` | gap detection settings |
| `Adobe Planar Map Artwork CRC32` | a checksum of the input art *(v: over what)* |

- **Binary payloads** start with the bytes `03 02 01 00` (a byte-order mark:
  the rest is little-endian); matrices add `07 06 05 04` for 8-byte values.
  `RAR Segments` is the child path as anchor triples (in handle, anchor, out
  handle) of int32 in **1/100 pt, in ruler coordinates with y down**:
  `x = v/100 − 7991`, `y = 8341 − v/100`. `Fragment Parameters` (48 bytes) is
  not decoded yet *(v)*.
- **Result art:** the faces as filled paths in a group tagged
  `AI11 AntiAliasingMethod` 2, then the edges as stroked paths. They are
  painted as the `Anon` art styles in the vectors say.

### Envelope: `Adobe Deform Plugin` (12-envelope, 28-envelopes)

- **Edit art:** the envelope as a mesh (`/Mesh X!` … `/End X!`, with `X#`
  operands `/Version`, `/Type`, `/Size`, `/P`, `/R`, `/CS`, `/A` anchors and
  `/N` nodes), then the settings:

| Key | Value in the fixtures |
|-----|-----------------------|
| `AIDeformArtKey` | `X=` art: the envelope's **contents** (the original rectangle) |
| `AIDeformArtWidthKey`, `AIDeformArtHeightKey` | the contents' size: 200 × 120 in 12, 200 × 150 in 28 |
| `AIDeformStyle` | **1 warp, 2 mesh, 3 top object** — one per command on the Envelope Distort menu |
| `AIDeformFidelityKey` | 50 (Envelope Options → Fidelity) |
| `AIDeformOptionsKey` | 131073 = 0x20001, the same for all three *(v: bit field of the Envelope Options check boxes)* |
| `AIDeformEditModeKey` | false *(v: editing the contents vs the envelope)* |

`AIDeformStyle` is the answer to which command made the envelope, and all
three write the same six keys above. The **warp** is the only one that writes
anything more: six further keys, which are exactly the Warp Options dialog
(confirmed against a screenshot of it taken through the bridge, `scripts/README.md`):

| Key | Dialog field | Value in 28-envelopes |
|-----|--------------|-----------------------|
| `DisplayString` | — (what the Layers panel shows) | `Warp: Arc` |
| `DeformStyle` | **Style**, 1-based over the 15 warp styles | 1 (Arc, the first) |
| `Rotate` | **Horizontal / Vertical** | false = Horizontal |
| `DeformValue` | **Bend**, the percentage over 100 | 0.51 (51%; the dialog's default is 50%) |
| `DeformHoriz`, `DeformVert` | **Distortion** Horizontal, Vertical | 0, 0 |

A **mesh** envelope writes none of those: its grid is in the edit art, not in
named keys, so Rows and Columns (4 and 4 by default) are only recoverable by
counting the mesh's nodes. Neither does a top-object envelope.

The plugin object itself carries **no data** in any of the three
(`Adobe Deform Plugin 1 0 +0 B`): the whole state is in the dictionary.

Both dialog commands **clear the object's name**, so a fixture has to rename
the plugin item afterwards if the name is to survive.

- **Result art:** the distorted contents.

### Graph: no plugin object at all (29-graph)

A graph is the exception to the pattern above. It is **not** an `XP` plugin
object and has no settings dictionary: it is ordinary art — paths for the
columns and axes, and six real text frames (`/AI11Text`) for the labels — with
`%_`-hidden operators beside it that let Illustrator rebuild it. A PostScript
interpreter ignores them and simply draws the art.

| Operator | What it is |
|----------|------------|
| `%_<n> () Ga <10 numbers> () 0 0 GA` | the graph's settings, four of them in the fixture (`8`, `1`, `2`, `4`), all `0 14 0 1 0.2 0 …` for a default column graph *(v: what the numbers are)* |
| `%_<a> 0 0 <b> Go` | tags a part of the drawn art; seven in the fixture (`1`, `2`, `4`, `5`, `6` with `0`, and `9` with `1` and `2`) *(v: which part each is)* |
| `%_GS` | closes the graph, immediately before its `/ArtDictionary` |

That dictionary holds only `AI10_ArtUID` — the object's name and nothing else.
So a reader that keeps the art and these hidden lines verbatim round-trips a
graph without understanding it, which is the rule in §4; **editing** one needs
the `Ga`/`GA` operands decoded first.

Drawing a graph also puts Adobe's library resources back into the document (15
symbols, 7 graphic styles, 66 swatches in the fixture), so a graph fixture has
to be purged (R4).

### Image Trace: `Adobe Vectorized Object` (14-image-trace)

- **Edit art:** the source raster (`%_`-hidden, with its `%%BeginData`
  pixels), then `adobe/vectorize/options`, a dictionary with every Image Trace
  panel setting. The wire keys, which map onto §6.2 of the plan:
  `adobe/vectorize/preset` (`[Default]`), `…/mode` (2), `…/ip/typecolor`,
  `…/ip/threshold` (128), `…/ip/grayscale` (50), `…/ip/Limitedcolors` (30),
  `…/ip/AutomaticcolorsFidelity`, `…/ip/FullcolorsFidelity` (100),
  `…/ip/PathFidelity` (50), `…/ip/CornerFidelity` (75), `…/ip/NoiseFidelity`
  (25), `…/ip/GradientFidelity`, `…/ip/enableGradient`,
  `…/ip/OverlappingOrAbutting` (0), `…/ip/LibraryName` (`NoLib`),
  `…/ip/LibraryPath`, `…/ip/ColorGroupName` (`All`), `…/tracing/fills`,
  `…/tracing/strokes`, `…/tracing/maxstrokeweight` (10),
  `…/output/snapcurvestolines`, `…/output/ignorewhite`,
  `…/output/simplifyCurvePrecision` (90), `…/output/shouldSimplify`,
  `…/output/createLiveText`, `…/output/outputtoswatches`,
  `…/output/alphaEnabled`, `…/output/alphaEnabledUI`,
  `…/output/shouldIgnoreColors`, `…/output/ignoreColors` (an array),
  `…/in/autogrouping`, `…/in/fitliveshapes`, `…/visualize` (0).
- **Enums** (from 17-trace-presets, one trace per preset): `mode` 0 colour,
  1 grayscale, 2 black and white; `ip/typecolor` (the palette) 0 automatic,
  1 limited, 2 full tone; `ip/OverlappingOrAbutting` 1 overlapping,
  0 abutting. The values of all 18 presets match the preset rows of the parity
  matrix (TRACE-00xx, from `probe-baseline.jsx`). Set through scripting's
  `loadFromPreset`, every preset has `enableGradient`, `fitliveshapes`,
  `autogrouping`, `alphaEnabled` and `ignorewhite` false; the enhanced
  presets' Gradients, Shapes and Transparency switches need a trace made in
  the panel.
- **Result art:** the traced paths in a group tagged
  `AI11 AntiAliasingMethod` 2, inside a group carrying
  `adobe/vectorize/statistics`, a `/NotRecorded` dictionary with `colorcount`,
  `pathcount`, `anchorcount` and `gradientcount` (the panel's info line).

### Repeat: `%AI17` versioned objects (11-repeat-*)

```
%AI17_Begin_Content_if_version_gt:24 3
 /RadialRepeatObject :        (or GridRepeatObject, SymmetryRepeatObject)
/Art :
X= … the repeat group: source art, and its settings dictionary … X+
; /RadialRepeatObject ;
%AI17_Alternate_Content
… /ForeignObject : … /Data , <ASCII85 PDF> ; + (AI24 ForeignArtRawDataUUID)
%AI17_End_Versioned_Content
```

- Readers newer than version 24 read the object; older ones get the
  alternate, a `/ForeignObject` whose data is a **complete one-page PDF** of
  the result (`%PDF-1.5`, 3.5–4 KB), placed with `/RTransform`, `/Origin` and
  `/Bounds`. The dictionaries inside the object have the `%_` prefix, and the
  object's own lines have none.
- The settings sit on the repeat group inside `X=`:
  - **Radial:** `RadialRepeatNumberOfArts` (8), `RadialRepeatRadius` (15),
    `RadialRepeatRadialCenterX/Y`, `RadialRepeatStartAngle` (3π/2),
    `RadialRepeatEndAngle` (2π), `RadialRepeatRotationAngle`,
    `RadialRepeatClockwiseArc`, `RadialRepeatReverseOverlap`,
    `RadialRepeatMergeState`. Angles are in radians. After the versioned block,
    the item's own dictionary adds `Radial Repeat Step Angle Key` (π/4 =
    2π/8).
  - **Grid:** `GridRepeatNumberOfRows` (4) / `…Columns` (6),
    `…Horizontal/VerticalSpacing` (10), `…Horizontal/VerticalOffset`,
    `…ShiftType`, `…RowFlipType`, `…ColumnFlipType`, `…TopLeftX/Y`,
    `…BottomRightX/Y` (the grid bounds, also the clipping rectangle `q … W n Q`
    around the tiles), `GridRepeatTransformMatrixFactorA`–`Ty`, the
    `…PrimaryOrientation…` row, column, shift and flip values, and
    `GridRepeatMergeState`.
  - **Mirror:** `SymmetryRepeatAxisRotationAngle` (π/2),
    `SymmetryRepeatAxisNormalVectorAngle` (−π), `SymmetryAxisCenterX/Y`,
    `SymmetryRepeatMergeState`. The group's `AI10_ArtUID` is
    `_x3C_Mirror_Repeat_x3E_`, which is `<Mirror Repeat>` in XML-name escaping.
    The source path carries `BBAccumRotation` (`0.000000`, a string).
  - **All:** `RepeatMovePrimaryArtToInstanceMatrixFactorA`–`Tx`,
    `IGNORE_INSTANCE_FOR_AGM` and `AGM_INSTANCED_RENDERING`.
- The repeated instances are **not** stored; they are generated from the
  settings. This makes Repeat the one live feature a reader must be able to
  compute to display (or fall back to the PDF).

### Live effects: art styles (13-live-effect)

- The object is written as its **expanded appearance first** (for the drop
  shadow: a raster, `%AI5_BeginRaster` with `Raster Art Original Scale` and the
  `AI24 Image(Alpha)RawDataUUID` keys, then the filled rectangle), and then
  as the `%_`-hidden **source path**, unpainted (`n`), tagged
  `Adobe_AI9_Observed_Key_Strings` `[AI Auto Rasterize]`. It closes with
  `1 (Anon HMLcNyw5QEU=) XW`, a reference to its art style.
- The art style (`%AI9_BeginArtStyles`) is a `Chain Style Filter` over a
  `Stack Style Filter` of fills and strokes, followed by the effect as a
  `BasicFilter`: `(Adobe Drop Shadow) 1 0 /Filter`, `(Illustrator.exe)
  /PluginFileName`, `(Drop Shadow) /Title`, and a `/NotRecorded` dictionary
  with the parameters under **four-letter keys**. The same keys go in
  `applyEffect`'s XML.
- **Drop Shadow:** `horz` 7, `vert` 7 (offsets, pt), `blur` 5, `opac` 0.75,
  `dark` 50 (%), `blnd` 1 (blend mode index *(v: 1 = Multiply)*), `csrc` 0
  (*(v)* 0 = darkness, 1 = colour), `pdfp` true *(v)*.
- **Stroke Offset** (`Adobe Stroke Offset`, title `Stroke Offset Live
  Effect`), in the startup styles of every file: `StrokeStyle`,
  `DisplayString` (`Inside`), `StrokeOffsetInside`. This is the stroke
  alignment (Align Stroke Inside) as an effect.
- **Effect names** (16-live-effects). `applyEffect` with an unknown name
  doesn't fail: it silently applies **Warp** (`Adobe Deform`). The names that
  exist, with the title the style records:

| Filter | Title (menu) |
|--------|--------------|
| `Adobe Deform` | Warp |
| `Adobe Drop Shadow`, `Adobe Inner Glow`, `Adobe Outer Glow`, `Adobe Round Corners` | as named |
| `Adobe Fuzzy Mask` | Feather |
| `Adobe Scribble Fill` | Scribble |
| `Adobe Offset Path`, `Adobe Outline Stroke` | as named |
| `Adobe Roughen`, `Adobe Transform`, `Adobe Free Distort` | as named |
| `Adobe Twirl` | Twist |
| `Adobe Shape Effects` | Shape (Convert to Shape) |
| `Adobe Pathfinder` | Pathfinder |
| `Adobe Rasterize` | Rasterize |
| `Adobe 3D Effect` | 3D Effect (the classic 3D) |
| `Adobe Geometry3D` | 3D and Materials |
| `Adobe PSL Gaussian Blur` | Gaussian Blur |
| `Adobe Trim Marks` | Crop Marks |
| `Adobe Stroke Offset` | Stroke Offset Live Effect |

  The guesses that got Warp, and their real names from 21-effects-menu (made
  from the Effect menu): Pucker & Bloat is `Adobe Punk and Bloat`, Tweak is
  `Adobe Scribble and Tweak`, Zig Zag is `Adobe Zigzag`, Outline Object is
  `Adobe Outline Type`, and SVG Filters is `Adobe SVG Filter Effect`. The
  Photoshop-style effects are below.
- **Defaults aren't recorded** by `applyEffect` with an empty dictionary: the
  style stores the empty dictionary, and Illustrator fills in the values
  when it renders. Opening the effect from the Appearance panel and pressing
  OK **without changing anything doesn't write them either**; touching a
  value first does. `20-effect-dialogs.ai` is 16-live-effects after that
  second pass. Its values are what each dialog showed for an empty
  dictionary, **not necessarily the Effect menu's defaults** (Round Corners
  came back as 0.01 pt and Twist as 0°), so treat them as key lists, and
  take defaults from the menu dialogs:

| Filter | Keys (value in 20-effect-dialogs) |
|--------|-----------------------------------|
| `Adobe Round Corners` | `radius` (0.01). The scripted form `radi` works too (19-styles-swatches) |
| `Adobe Fuzzy Mask` (Feather) | `Radius` (5) |
| `Adobe Twirl` (Twist) | `angle` (0) |
| `Adobe Inner Glow` | `blnd` (2), `opac` (0.75), `blur` (5), `gtyp` (1 *(v: edge or centre)*), `gclr` (a `FillStyle`: white) |
| `Adobe Outer Glow` | `blnd` (2), `opac` (0.75), `blur` (5), `sclr` (a `FillStyle`: black), `usePSLBlur` (true), `Adobe Effect Expand Before Version` (16) |
| `Adobe Drop Shadow` | `horz` 7, `vert` 7, `blur` 5, `opac` 0.75, `dark` 100, `blnd` 1, `csrc` 0, `sclr` (black), `pair` (true), `usePSLBlur` (true), `Adobe Effect Expand Before Version` (16). The dialog doesn't write the scripted form's `pdfp` |
| `Adobe Transform` | `scaleH_Percent`/`scaleV_Percent` (100) with `scaleH_Factor`/`scaleV_Factor` (1), `moveH_Pts`/`moveV_Pts` (0), `rotate_Degrees` with `rotate_Radians` (0), `reflectX`/`reflectY`, `numCopies` (0), `pinPoint` (4 *(v: the centre of the 3×3 reference grid)*), `randomize`, `transformObjects` (true), `transformPatterns`, `scaleLines` |
| `Adobe Free Distort` | `src0h`…`src3v` and `dst0h`…`dst3v`: the four corners before and after, in document points (here the rectangle's own corners) |
| `Adobe Shape Effects` | `Shape` (0: rectangle), `DisplayString` (`Rectangle`), `Absolute` (0: relative size), `RelWidth`/`RelHeight` (18: extra width and height), `AbsWidth`/`AbsHeight` (36), `CornerRadius` (9) |
| `Adobe Rasterize` | `colr` (4 *(v: RGB)*), `dpi.` (72; the key ends in a dot), `padd` (36: added around, pt), `mask` (false: clipping mask), `alis` (false: anti-aliasing), `optn` (0) |
| `Adobe PSL Gaussian Blur` | `blur` (10), `PrevDocScale` (1), `PrevDres` (300) |
| `Adobe 3D Effect` (classic) | 47 keys: `DisplayString` (`3D Extrude & Bevel (Classic)`), `effectStyle` (0), `3Dversion` (2), `rotX`/`rotY`/`rotZ` (−18, −26, 8: the Off-Axis Front preset, `rotationPresetKey` 9), `mat_00`…`mat_33` (the 4×4 rotation), `cameraPerspective` (0), `extrudeDepth` (50), `extrudeCap`, `bevelHeight` (4), `bevelExtentIn`, `revolveAngle` (360), `revolveCap`, `revolveOffset`, `revolveAxisMode`, `surfaceStyle` (3 *(v: plastic)*), `surfaceAmbient` (50), `surfaceMatte` (40), `surfaceGloss` (10), `blendSteps` (25), `shadeMode` (3), `shadeColor` (a `FillStyle`), `shadeMaps`, `preserveSpots`, `invisibleGeo`, `showHiddenSurfaces`, `numArtMaps` (0), `numLights` (1), `light0` (a dictionary: `lightDirX/Y/Z`, `lightPosX/Y/Z`, `lightIntensity`), `paramsDictionaryInitialized` (true) |

- **Effect menu defaults** (21-effects-menu: each effect applied from the
  Effect menu, a value touched and set back, then OK). Illustrator's dialogs
  remember the last values used, so these are the defaults only if nothing
  had been changed earlier in that session *(v: Twist's 0° and Pucker &
  Bloat's 0 %)*:

| Filter (title) | Keys and default values |
|----------------|--------------------------|
| `Adobe Round Corners` | `radius` 10 (pt) |
| `Adobe Scribble Fill` (Scribble) | `Angle` 30, `StrokeWidth` 3, `Scribbliness` 0.05, `ScribbleVariation` 0.01, `Spacing` 5, `SpacingVariation` 0.5, `EdgeOverlap` 0, `EdgeOverlapVariation` 5 |
| `Adobe Punk and Bloat` (Pucker & Bloat) | `d_factor` 0 |
| `Adobe Roughen` | `size` 5, `absoluteness` 0 (relative), `dtal` 10 (detail per inch), `roundness` 0 (corner points), `asiz` 5 *(v: the absolute size field)* |
| `Adobe Scribble and Tweak` (Tweak) | `horz` 10, `vert` 10, `ahor` 10, `aver` 10 *(v: relative and absolute)*, `absoluteness` 0, `anch`, `in`, `out` (all true: modify anchor, in and out control points) |
| `Adobe Twirl` (Twist) | `angle` 0 |
| `Adobe Zigzag` (Zig Zag) | `amount` 10, `relAmount` 10, `absoluteness` 1 (absolute), `ridges` 4, `roundness` 0 (corner) |
| `Adobe Offset Path` | `ofst` 10 (pt), `jntp` 2 (joins *(v: 2 = miter)*), `mlim` 4 |
| `Adobe Outline Type` (Outline Object) | none |
| `Adobe Deform` (Warp) | `DeformStyle` 1 (Arc), `DeformValue` 0.5 (bend 50 %), `DeformHoriz` 0, `DeformVert` 0, `Rotate` false (horizontal), `DisplayString` `Warp: Arc` |
| `Adobe Pathfinder` | `Command` 0 (Add), `DisplayString` `Add`, `Precision` 10, `RemovePoints` false, `ExtractUnpainted` true, `ConvertCustom` true, `Mix` 0.5, and the Trap options `TrapThickness` 0.25, `TrapAspect` 1, `TrapTint` 0.4, `TrapMaxTint` 1, `TrapTintTolerance` 0.05, `TrapReverse`, `TrapConvertCustom` |
| `Adobe Geometry3D` (3D and Materials) | 39 keys, all `Geometry3Dk…` or `Material…`: `OperationTypeKey` 0 (extrude), `ExtrudeDepthKey` 50, `ExtrudeCapKey` true, `ExtrudeTwistBegin/EndKey` 0, `ExtrudeTaperBegin/EndKey` 100, `RotationX/Y/ZKey` in radians (−0.314159, −0.45378561, −0.1413717, that is −18°, −26°, −8.1°), `FOVKey` 0, the light (`GlobalLightKey` true, `GlobalLightIntensityKey` 50; `SunlightNameKey` `Light 1`, `SunlightIntensityKey` 70, `SunlightElevationKey` 45, `SunlightRotationKey` 145, `SunlightCloudinessKey` 40, `SunlightColorKey` white as a `FillStyle`), shadows (`ShadowSpreadKey` 50, `ShadowGroundDistanceKey` 0, `ShadowProfileKey` 0, `UseDynamicShadowBoundsKey` true), rendering (`QualityProfileKey` 1, `EngineProfileKey` 0, `OutputProfileKey` 0, `ReduceNoiseKey` true, `RenderAsWireframe` false), and the default material (`MaterialRoughness` 40, `MaterialMetallic` 0, `MaterialDensity` 100, `MaterialResolutionKey` 10, `MaterialRotation`/`OffsetX`/`OffsetY` 0, `MaterialFilePathKey` empty, `MaterialOverridenParams` an empty dictionary) |
| `Adobe SVG Filter Effect` | `SVGFilterUIDName` and `SVGFilterHandle` (a `GObjRef` to the filter in `%AI10_BeginSVGFilter`, here `AI_Alpha_1`), `DisplayString` |

  Crop Marks, Outline Stroke and Stroke Offset have no settings in their
  dialogs.
- **Photoshop-style effects** (22-effects-photoshop): the filter is
  `PSAdapter_plugin_<4cc>` (the menu command id without `Live `), with
  `(Standard MultiPlugin.8BF) /PluginFileName`. The settings are not keys
  in the dictionary but one binary blob: `(data)`, a `/Binary :
  /ASCII85Decode` block of `dataSize` bytes, next to `go` (true) and
  `PrevDres` (300). Filter Gallery effects add
  `Photoshop Filter Gallery Effect` (their own filter name again). Gaussian
  Blur is the exception: `Adobe PSL Gaussian Blur` is native, with plain keys
  (`blur` 10, `NeedHighResExecution`, `PrevDocScale`, `PrevDres`).
  - `(data)` is a **flattened Photoshop descriptor**, big-endian: a u32
    version (1), then items to the end, each a four-character key, a u32 form,
    a four-character type and the value. Form 0 is a plain value (`long` i32,
    `doub` f64); form 0x2000 an enum (the type is the enum type, then the
    value as a 4cc); form 0x80000000 a nested descriptor (the type is its
    class, then a u32 byte length and a descriptor). `decodePluginDescriptor`
    in `ai-art-objects.mjs` reads it, and `--effects` prints it decoded.
  - Keys are Photoshop's, so PhotoSuite's descriptor code and Photoshop's
    filter defaults apply. Defaults found: Color Halftone `Rds ` 8,
    `Ang1`–`Ang4` 108, 162, 90, 45; Radial Blur `Amnt` 10, `BlrM` `Spn`
    (spin), `BlrQ` `Gd` (good), `Cntr` a `Pnt` of (0.5, 0.5); Halftone
    Pattern `GEfk` `GEft.HlfS`, `HlSz` 1, `Cntr` 5, `ScrT` `ScrD` (dot);
    Watercolor `BrsD` 9, `ShdI` 1, `Txtr` 1; Grain `Intn` 40, `Cntr` 50,
    `Grnt` `GrnR` (regular), `FlRs` a random seed. Filter Gallery effects
    begin with `GEfk`, the gallery effect.
  - The filter name can end in a space: `PSAdapter_plugin_Grn ` (Grain).
- **Colour parameters** are paint styles (`/FillStyle : … /Def ;`) inside
  the effect's dictionary (`sclr`, `gclr`, `shadeColor`).
- **Named graphic styles** (19-styles-swatches): the `KnownStyle` carries
  `(VS Rounded Shadow) /Name` in place of an `Anon` hash, art refers to it by
  name (`1 (VS Rounded Shadow) XW`), and it is listed in
  `%AI9_BeginArtStyleList`. Round Corners' one parameter is `radi` (pt).

### Patterns: `%AI3_BeginPattern` (23-pattern, 23-pattern-brick*)

A pattern swatch is a section of its own in `%%BeginSetup`, before the
brushes, and is **still written with the AI3 marker** in 30.1:

```
%AI3_BeginPattern: (New Pattern)
(New Pattern) 0 0 40 40          <- name, then the tile box (llx lly urx ury)
%_0 A … %_n                      <- the tile boundary rectangle: an unpainted
%_/ArtDictionary :                  path (`n`) whose dictionary is only
%_1 /Bool (AIPattern_Editor_Backing_Tile_Rect) ,
%_;
%_4 As … %_f                     <- the tile art (here the circle), unchanged
%_/ArtDictionary :                  from the art stream, with its XMLUID
%_/XMLUID : (_x31__pattern_source_0000…) ; (AI10_ArtUID) ,
%_;
%_U                              <- the tile art is a group; `U` closes it and
%_/ArtDictionary :                  its dictionary carries the editor state
%_…AIPattern_Editor_* keys…
%_;
%_9 () XW
E
%AI3_EndPattern
```

- The whole body is **`%_`-prefixed art**, the same language as the art
  stream, so the tile is read with the ordinary art reader. It ends with an
  `XW` (`9 ()`, the unstyled form) and `E`.
- **Line 2** repeats the name and gives a rectangle in the pattern's own
  space. It is the **bounds of the section's art**, not the tile: `0 0 40 40`
  for the 40 pt circle in 23-pattern, but `32.5 20 182.5 200` (150 × 180) in
  23-pattern-brick-spacing, whose tile is 50 × 45 and whose neighbours are
  baked in. The **tile** rectangle is the first path in the body, unpainted
  (`n`) and marked `AIPattern_Editor_Backing_Tile_Rect`.
- **Pattern Options is stored per pattern**, on the tile group's dictionary,
  not in the document data. The fields, confirmed against 23-pattern
  (defaults), 23-pattern-brick (Brick by Row, tile typed by hand) and
  23-pattern-brick-spacing (the same pattern with Size Tile to Art):

  | Key | Field | Notes |
  |-----|-------|-------|
  | `AIPattern_Editor_Tile_Width`, `_Tile_Height` | Width, Height (pt) | The resolved tile size. With Size Tile to Art it is the art bounds **plus** the spacing (50 × 45 for a 40 pt circle at 10 / 5 spacing) |
  | `AIPattern_Editor_AutoGrow` | Size Tile to Art | Written only when on. H and V Spacing are **greyed out while it is off**, so a tile typed by hand has no spacing keys at all |
  | `AIPattern_Editor_AutoSpacing_H`, `_V` | H Spacing, V Spacing (pt) | Only with `AutoGrow` |
  | `AIPattern_Editor_Repetition_Type` | Tile Type | `1` = Brick by Row. Grid is the default and **is not written** *(v: the other four values)* |
  | `AIPattern_Editor_Brick_Offset` | Brick Offset | A fraction: `0.25` for 1/4. Only with a brick type *(v)* |
  | `AIPattern_Editor_Top_in_Front`, `_Left_in_Front` | Overlap | The two overlap buttons, as bools |
  | `AIPattern_Editor_Preview_Rows`, `_Preview_Cols` | Copies | `5` × `5` by default, `3` × `3` in the variants |
  | `AIPattern_Editor_Dim_Copies_Key`, `_Dim_Percent_Key` | Dim Copies to | A bool plus a percentage (30 by default) |
  | `AIPattern_Editor_Editable_Copy_Loc_Key` | (not in the panel) | `4` in all three fixtures |

  Only fields that differ from the defaults are written, as with the effect
  dialogs.
- **A tile whose art doesn't fit bakes its neighbours in.** Each overlapping
  copy is stored as ordinary tile art marked
  `1 /Bool (AIPattern_Is_Repeated_Art)`: none in 23-pattern (a grid tile
  sized to its art), 18 in 23-pattern-brick-spacing. A reader must keep them
  and a writer must reproduce them. They are **not** the panel's Copies
  preview, which is `_Preview_Rows`/`_Cols` *(v: the exact rule for which
  neighbours are written)*.
- **Use:** the art fills with the `p` operator,
  `(New Pattern) 0 0 1 1 0 0 0 0 0 [1 0 0 1 0 0] p` — the name, then the
  tile's transform (shift x/y, scale x/y, rotate, reflect, shear…, all
  defaults here) and a 2 × 3 matrix. The **swatch list** holds the same `p`
  line followed by `(New Pattern) Pc`, inside a
  `%AI17_Begin_Content_if_version_gt:24 15` block with an identical
  alternate.

### Brushes: `%AI8_BeginPluginObject` in the setup (24-brushes)

A brush **definition** is a plugin object in a non-printing setup section,
one per brush, grouped by tool:

```
%AI5_Begin_NonPrinting
Np
%AI8_BeginPluginObject
(Adobe Calligraphic Brush Tool)     <- the tool, which is also the brush type
(VS Calligraphic)                   <- the brush's name
(1 9 9 100 100 0 0 0 0 0 0) .       <- a positional parameter string, wrapped
%AI8_EndPluginObject                   at 64 chars with a trailing `-`, ended
%AI5_End_NonPrinting--                 by `.`
```

- The five tools are the five brush types: `Adobe Calligraphic Brush Tool`,
  `Adobe Scatter Brush Tool`, `Adobe ArtOnPath Brush Tool` (Art),
  `Adobe PatternOnPath Brush Tool` (Pattern) and `Adobe dBrush Brush Tool`
  (Bristle).
- **Art and Pattern brushes name their art**, which lives in
  `%AI8_BeginBrushPattern` tiles (`(Unnamed Brush Pat 2)` and friends), not
  inline. A Pattern brush has five slots — side, outer corner, inner corner,
  start, end — written `/`-separated with the unused ones blank:
  `2 / Unnamed Brush Pat 4/ / Unnamed Brush Pat 9/ / / 0 3/ …`.
- A further plugin object, **`Adobe Brush Manager Order`**, lists the
  Brushes panel's order as `tool/ name/` pairs.
- The positional strings are readable but not self-describing; the same
  values appear with **names** in the art style of anything using the brush
  (below), so read them from there *(v: the positional layout)*.

A **brushed path** is an `XP` plugin group of the same tool, holding the
generated art, with the source path and an `Anon` art style whose
`BasicFilter` is the tool. The style names the brush rather than inlining it
— `/GObjRef : (VS Art) (Adobe ArtOnPath Brush Tool) /PluginObject ; (Brush)`
— and then repeats its settings with readable keys:

| Brush | Keys in the style |
|-------|-------------------|
| Calligraphic | `Diameter`, `Roundness`, `Angle`, each with a `…Variation` and a `…DependsOn`, plus `AngleRelativeTo` |
| Scatter | `MinScaling`/`MaxScaling`, `MinSpacing`/`MaxSpacing`, `MinDispersion`/`MaxDispersion`, `MinRotation`/`MaxRotation`, each with a `…DependsOn`, plus `RotationRelativeTo` and `Colorization` |
| Art | `Scaling`, `MinScaling`/`MaxScaling`, `Proportional`, `Segmented`, `Adjustment`, `FoldAdjustment`, `StartSegmentLength`/`EndSegmentLength`, `UpsideDown`, `Counterclockwise`, `ScaleYDependsOn`, `Spacing`, `Colorization`, and `Adobe Effect Expand Before Version` (15) |
| Pattern | the same set as Art, with `Adobe Effect Expand Before Version` 17 |
| Bristle | `library_id` (`AI_BristleBrushLibary_CS5`, Adobe's spelling), `model_id` (`01_Round_Point`), `brush_size`, `brush_length`, `brush_density`, `brush_thickness`, `brush_stiffness`, `opacity`, `debug_output_kind` |

`DependsOn` is `0` for Fixed; the other values (Random, Pressure, Stylus
Wheel, Tilt, Bearing, Rotation) are *(v)*. The bristle brush is the one type
with **no `XP` group** in the art: only the style *(v: where its rendering
goes)*.

### Gradient mesh: `/Mesh X!` (25-mesh-gradients)

A mesh object is not a path. It is a block in a **language of its own**,
between `/Mesh X!` and `/End X!`, whose lines are `%_`-prefixed and end in
`X#` (`X!` opens and closes the block, `X#` is one statement):

```
/Mesh X!
%_2 /Version X#
%_/Cartesian /Type X#          <- the only type seen so far
%_[4 4] /Size X#               <- rows and columns of patches
%_/Data X#
%_[0 0] /P X#                  <- one patch: its [column row]
%_[0] /R X#                    <- *(v)*: 0, 0.25, 0.5, 0.75 down a column, -1 inside
%_/DeviceRGB /CS X#            <- the colour space, on the first patch only
%_[0 0.470588237047195 1 1 20 230 36.666666666667 230 1 20 242.5 1] /N X#
%_… three more /N …            <- the patch's four corners, anticlockwise
%_/E X#                        <- end of the patch
… 15 more patches …
/End X!
```

- A corner (`/N`) is twelve numbers: **colour** (three for `DeviceRGB`) plus
  an alpha *(v)*, the **point**, and **two control points**, each followed by
  a `1` *(v: what the flag means)*.
- A 4 × 4 mesh writes 16 patches and 64 corners; corners are repeated between
  neighbouring patches rather than shared.
- The object keeps its name (`_x31__gradient_mesh`) and its
  `XMLUID` dictionary after the block, so a mesh is an ordinary art object
  carrying a mesh body.
- **Our reader and writer must keep this block verbatim** until it is
  implemented: it is not the dictionary language and the art-dictionary
  round trip doesn't cover it.

### Freeform gradient: `Adobe Diffusion Coloring Style` (25-mesh-gradients)

A freeform gradient is split in two. The **colour points are in the art
style**, as a `/SmoothShadingStyle` container:

```
(Adobe Diffusion Coloring Style) 1 0 /Filter ,
…
/SmoothShadingStyle : (Adobe Diffusion Coloring Style) 7 /ColorPoints ,
0 O
0.782192707061768 0.540489792823792 0 0 0 0.470588235294118 1 Xa
1 1 0 0.100000004238555 0.89999989827474
/ColorPoint ,
… six more /ColorPoint …
0 /ColorCurves ,
0 /InterpolationType ,
;
```

- Each `/ColorPoint` is the point's **paint operators** (`Xa` and friends,
  exactly as in the art stream) followed by five numbers that end in the
  point's **x and y in the object's 0–1 space** *(v: the first three)*.
- `/InterpolationType` is `0` for Points; Lines is *(v)*. `/ColorCurves` is
  `0` here.
- Four of the seven points are the corners Illustrator makes itself; the
  other three are the ones clicked.

The **rendering** is a `/ForeignObject` beside the art: `/Version 1`, an
`/RTransform`, an `/Origin`, `/Bounds`, and `/Data` — an ASCII85 blob (52 KB
for this one, no recognisable header) — closed by `;`. Its dictionary carries
`AI24 ForeignArtRawDataUUID`, the same pattern as the text and image UUIDs.
The object is wrapped in a clipping group (`q … W n … Q`) whose clip is the
original rectangle, and the rectangle survives as `%_` art in the group after
it. Keep the blob verbatim; it is a cache, and the style is the model.

This fixture needed two additions to the dictionary codec, both layout:
a container whose **first entry sits on the header line**
(`/SmoothShadingStyle : (…) 7 /ColorPoints ,`, recorded as the entry's
`lead`), and a value whose **operands are split over several lines**
(recorded as `gaps`).

### Variable-width strokes: `kAIBeautifulStrokesParamsDictKey` (26-width-live-shapes)

A width profile is **not** on the path: it is in the `Stroke Style Filter` of
the object's `Anon` art style, in a `kAIBeautifulStrokesParamsDictKey`
dictionary:

| Key | Meaning |
|-----|---------|
| `BSVariableWidthTValuesArray` | the positions along the path, `0`…`1` |
| `BSCenteredWidthsArray` | the width at each of those positions, as a fraction of the stroke width |
| `BSWidthSource` | `2` for both a panel profile and a Width-tool drag *(v)* |
| `BSAdvStrokeDictionaryVersion` | `1` |

- **Width Profile 1** from the Stroke panel is `t = [0, 0.515, 1]` with
  widths `[0, 1, 0]` — so the panel's profiles are written out as points, not
  named.
- **One Width-tool drag** in the middle of a four-point path gives
  `t = [0, 0.320, 0.524, 0.680, 1]` and widths
  `[0.204, 0.204, 1, 0.204, 0.204]`: the drag point plus a plateau each side.
- The Width tool also records its handles on the **path's own art
  dictionary**: `kAIBeautifulStrokes_WidthProfileAnchors` (pairs of anchor
  index and position, `[[1, 0.320], [2, 0.680]]`),
  `kAIBeautifulStrokes_WidthProfileRememberedPtCount` (4) and
  `kAIBeautifulStrokes_WidthProfileRememberedPathClosure`.
- The **rendering is expanded**: each width path is a group (`u … U`) holding
  the outline as a filled path, with the original stroked path kept as `%_`
  art inside it — the same model-plus-cache split as a freeform gradient.
  A `1 Ap` follows the group *(v)*.

### Live shapes and live corners: `ai::LiveShape` (26-width-live-shapes)

A live rectangle or ellipse is an ordinary path whose art dictionary carries
an `ai::LiveShape` dictionary:

```
%_/Dictionary :
%_/Dictionary :
%_150 /Real (ai::Rectangle::Width) ,
%_… the rest of the parameters …
%_; (ai::LiveShape::Params) ,
%_(ai::Rectangle) /UnicodeString (ai::LiveShape::HandlerName) ,
%_; (ai::LiveShape) ,
```

- `ai::LiveShape::HandlerName` is `ai::Rectangle` or `ai::Ellipse`; the
  parameter keys are prefixed with the same name. The polygon, star, line and
  grid handlers are *(v)*.
- **Rectangle:** `Width`, `Height`, `CenterX`, `CenterY`, `Angle`,
  `Clockwise`, `InitialQuadrant`, and per corner `0`–`3`
  `CornerRadius::n`, `CornerType::n` (`Normal`, or `Invalid` when the corner
  isn't rounded) and `RoundingType::n` (`Absolute`, or `Invalid`). The other
  corner types (Inverted Round, Chamfer) and `Relative` rounding are *(v)*.
- **Ellipse:** `Width`, `Height`, `CenterX`, `CenterY`, `RotationAngle`,
  `PieStartAngle`, `PieEndAngle`, `Clockwise`, `InitialQuadrant`.
- The centre is in the document's **large-canvas coordinates** (8393, 8082
  here, not artboard coordinates); see `%AI24_LargeCanvasScale`.
- **Behaviour worth matching:** dragging one corner widget with the
  *Selection* tool rounds **all four** corners (all four radii came out
  24.479). Rounding a single corner needs the Direct Selection tool.

### Inline dictionary objects

- **Symbol instances** (08-symbols): `/SymbolInstance :` with
  `(Name)  /SymbolRef ,` and a `/RTransformMatrix`, `1 0 0 -1 tx ty` for an
  unscaled instance. The symbol definition's `ArtDictionary` carries
  `AI13PatternRegistrationType` 5 *(v)*.
- **Text frames** (07-type): `/AI11Text :` with `/FreeUndo`, `/FrameIndex`,
  `/StoryIndex`, `/TextAntialiasing` and, for area and path type,
  `/ConfiningPath` as an `/Art :` container of `X=` art. Each is followed by
  `AI24 TextStoryRawDataUUID` (see `text-document-30.1.md`).
- **Rasters:** `Raster Art Original Scale`, `AI24 ImageRawDataUUID`,
  `AI24 ImageAlphaRawDataUUID`, `CAITagType` 0, and for the startup brushes'
  rasters also an `AI10_ArtUID`.

## Fixtures still needed

**Corpus v3** (`make-fixtures.jsx` set `v3`, run through the agent on
2026-09-25) is in: files 16–19, results above. Swatch groups are written in
the palette (`%AI5_BeginPalette`): `1 (VS Group) 1 Pg`, then each swatch as
`<colour> Xa (Name) Pc`, then `PB` *(v: `Pg`'s numbers)*.

**Made by hand in the VM** (no scripting API, or only through a dialog):
the Photoshop-style effects, the pattern swatch, the brushes and the gradient
mesh and freeform gradient, the variable-width profile and the live shapes
and corners and the blend options are in; the rest are the envelope made with
warp
and with mesh, graph, perspective grid object, 3D and Materials (with
settings, not the empty dictionary), Intertwine, Objects on Path, and a
Dimension annotation. The checklist is `docs/ai-format/manual-fixtures.md`.

## Open questions

- The meaning of `XP`'s `1 0`, of `Ae` and `Ap`, and of `XW`'s leading
  number (1 for styled art, 6 or 9 otherwise).
- The blend record's remaining words (7, 8, 12, 13, 16, 18), and what the
  `11.1416` in word 5 is (27-blend-options).
- Live Paint's `Fragment Parameters` layout and its CRC32 input.
- `AIDeformOptionsKey`'s bits and `AIDeformStyle`'s values.
- What `pdfp` means in Drop Shadow.
- Whether an effect with an empty dictionary is rewritten with its defaults
  once it's edited, or when the file is saved again after a render.
- `BSWidthSource`'s other values, and what `1 Ap` after an expanded stroke
  means.
- The `ai::LiveShape` handlers other than `ai::Rectangle` and `ai::Ellipse`,
  and the other `CornerType`s and `RoundingType`s.
- A mesh patch's `/R` value, the flags in a corner's `/N`, and the mesh
  `/Type`s other than `/Cartesian`.
- The first three numbers of a freeform gradient's `/ColorPoint`, its
  `/ColorCurves`, and what the `/ForeignObject` blob holds.
- The positional layout of a brush definition's parameter string, the
  `DependsOn` values other than `0` (Fixed), and where a bristle brush's
  rendering goes (it has no `XP` group).
- The other `AIPattern_Editor_Repetition_Type` values (Brick by Column, Hex
  by Row and Column, and whatever value Grid would write), and the exact rule
  for which neighbouring copies a tile bakes in as
  `AIPattern_Is_Repeated_Art`.
