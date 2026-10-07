<!-- Migrated from the VectorSuite plan (vectorsuite.md §6), the archived
     Tauri/JS prototype this fork replaces. See docs/decisions/0001-fork-from-vectorcraft.md.
     Values marked *(v)* are unverified against a licensed Illustrator 30.1. -->

## 6. Image Trace — full specification

Image Trace converts a placed raster image into vector paths. In Illustrator
30.1 it is a **live** object: the trace can be re-run with new settings until it
is expanded. VectorSuite reproduces the panel, the live-object behaviour, the
presets and the output characteristics (abutting versus overlapping shapes,
fills versus strokes), and aims to match the quality of Illustrator's output
on a benchmark corpus (§6.8).

### 6.1 Entry points

| Entry | Behaviour |
|-------|-----------|
| Select a raster → Properties/Control panel **Image Trace** button, or preset dropdown | Traces with the chosen preset (the default preset if the button is used). |
| Object → Image Trace → **Make** | Creates a tracing object with the last-used or default settings. |
| Contextual Task Bar → **Image Trace** (28.3+) | Traces immediately with the Default preset. |
| Object → Image Trace → **Make and Expand** | Traces and immediately expands to paths. |
| Object → Image Trace → **Release** | Discards the trace and returns the original image. |
| Object → Image Trace → **Expand** | Converts the live trace into a group of editable paths. The source image is removed. |
| Object → Live Paint → **Make** on a tracing object | Expands, then converts the result to a Live Paint group (Illustrator allows this). |
| Window → **Image Trace** panel | Full options (§6.2). The panel tracks the selected tracing object. |
| Edit → **Tracing Presets…** | Manage user presets: new, edit, delete, import, export. |
| Scripting | `PlacedItem.trace()` / `RasterItem.trace()` → `PluginItem.tracing` (`TracingObject` with `tracingOptions`, `expandTracing()`, `releaseTracing()`, and read-only statistics `anchorCount`, `pathCount`, `usedColorCount`, `imageResolution`). |
| Actions | Recording captures make, expand and release with the full option set. |

### 6.2 Image Trace panel

Top row: preset icon buttons **Auto-Color, High Color, Low Color, Grayscale,
Black and White, Outline**, and the preset menu (manage presets).

This follows Adobe's *Image Trace panel options* page, last updated 26 Feb
2026 (the 30.x panel), fetched into `.research/`. Numeric ranges and defaults
are not documented there, so they stay *(v)* until task 9.1.

| Control | Values | Notes |
|---------|--------|-------|
| **Preset** | Two sets, **Enhanced Presets** and **Legacy Presets** (a switch in the Preset dropdown). Each set holds \[Default], High Fidelity Photo, Low Fidelity Photo, 3 Colors, 6 Colors, 16 Colors, Shades of Gray, Black and White Logo, Sketched Art, Silhouettes, Line Art and Technical Drawing *(v: whether both sets have the same names)*, plus user presets. \[Custom] appears when edited. | Manage Presets: Save as New Preset, Delete, Rename. Built-in presets are shown in square brackets and can't be edited or deleted. Enhanced presets switch on Gradients, Shapes, Transparency and Auto Grouping per preset (see those rows). Legacy presets leave them off. |
| **View** | Tracing Result; Tracing Result with Outlines; Outlines; Outlines with Source Image; Source Image | Display only; it does not change the result. **Press & hold to view source image** (next to View) compares the result with the source. |
| **Mode** | Color; Grayscale; Black and White | |
| **Palette** (Color mode) | Automatic; Limited; Full Tone; Document Library | **Automatic** switches between Limited and Full Tone depending on the image. **Document Library** uses a colour group from the Swatches panel (the Colors control becomes a dropdown), and output colours map to those swatches (global swatches stay linked *(v)*). |
| **Colors** (Color mode) | Limited: the number of colours, from 2 to about 30 *(v: exact max)*. Automatic: 0 (simplicity) to 100 (accuracy). Full Tone: 0–100 %, the pixel variability within a fill region (100 % gives more, smaller regions; 0 % gives fewer, larger ones). | |
| **Grays** (Grayscale) | 1–100 % | Maps to the number of grey levels. |
| **Threshold** (B&W) | 1–255, default 128 | Pixels darker than the threshold become black. |
| **Advanced ▸ Paths** | 0–100 %, default 50 % *(v)* | Fitting tightness. Lower gives looser fitting and fewer anchors; higher gives a tighter fit and more anchors. |
| **Advanced ▸ Corners** | 0–100 %, default 75 % *(v)* | Higher gives more corners (sharper); lower gives rounder curves. |
| **Advanced ▸ Noise** | 1–100 px, default 25 px *(v)* | Regions smaller than this area (in pixels) are ignored or merged. Higher gives cleaner output. |
| **Method** | Abutting (cut-out paths) · Overlapping (stacked paths) | See §6.4, step T5. |
| **Create** | Fills · Strokes (Strokes only in Black and White mode *(v)*) · **Gradients** (29.0) | Gradients detects linear gradients and traces them as gradient fills. It needs Mode Color or Grayscale with Palette Automatic or Full Tone, or the enhanced High and Low Fidelity Photo presets. It has a **Smooth** slider: higher gives smoother gradients *(v: range, default)*. |
| **Stroke** | Maximum stroke width in px (default 10 px *(v)*), enabled with Strokes | Thin features up to this width become stroked paths. |
| **Options ▸ Snap Curves To Lines** | on / off | Curves that are nearly straight, near 0° or 90°, snap to lines and right angles. |
| **Options ▸ Transparency** (29.0) | on / off | Transparent backgrounds are not traced as white (this replaces the alpha rule in T0 when on). It needs Mode Color, and with Palette Limited at least four colours. It is built into the enhanced High and Low Fidelity Photo, 6 Colors and 16 Colors presets. |
| **Options ▸ Ignore Color** | on / off, plus a colour picker | 2020's Ignore White is now **Ignore Color**: any picked colour is ignored. Not available with Grayscale and Overlapping. Scripting still exposes `ignoreWhite` (a 30.x fix note mentions it). The UI default colour is white *(v)*. |
| **Shapes** (29.0) | on / off | Detects isolated circles, squares and rectangles and emits them as live shapes (§5.5). Slightly rotated rectangles are less accurate. Built into every enhanced preset except High Fidelity Photo. |
| **Auto Grouping** (29.0) | on / off | Organises result paths into logical groups, which appear in the Layers panel after Expand *(v: grouping rule)*. Built into every enhanced preset. |
| **Info** | Paths, Anchors, Colors | Updated after every trace. 2020 also showed Areas and Image PPI *(v: whether 30.1 still does)*. |
| **Expand** button | | Converts the result to paths, as Object → Image Trace → Expand does. |
| **Preview** checkbox + **Trace** button | With Preview on, every change re-traces (debounced). Otherwise nothing happens until Trace is pressed. | A progress bar with a cancel button appears for long traces. |

### 6.3 Built-in presets (captured from a licensed 30.1)

The values below were read from Illustrator 30.1.0 (build 136R) through the
scripting DOM (`scripts/research/illustrator/probe-baseline.jsx`,
2026-09-24; raw output in `.research/illustrator-30.1/`). They replace the
earlier estimates. The matrix rows are `TRACE-0022` to `TRACE-0040`.

| Preset | Mode | Colours / fidelity, or threshold, or grays | Paths | Corners | Noise | Method | Create | Snap curves |
|--------|------|------------------------------------------|-------|---------|-------|--------|--------|-------------|
| \[Default\] | B&W | Threshold 128 | 50 | 75 | 25 | Abutting | Fills | on |
| \[High Color\] | Color | 30 colours, fidelity 85 | 50 | 50 | 5 | Overlapping | Fills | off |
| \[Low Color\] | Color | 16 colours, fidelity 100 | 50 | 50 | 15 | Abutting | Fills | off |
| \[Grayscale\] | Grayscale | Grays 50 | 50 | 50 | 15 | Overlapping | Fills | off |
| \[Black & White\] | B&W | Threshold 128 | 50 | 75 | 25 | Abutting | Fills | on |
| \[Outline\] | B&W | Threshold 128 | 50 | 75 | 20 | Abutting | Strokes (max 50) | off |
| \[Auto-Color\] | Color | 30 colours, fidelity 100 | 50 | 75 | 15 | Abutting | Fills | off |
| High Fidelity Photo | Color | 30 colours, fidelity 85 | 50 | 50 | 5 | Overlapping | Fills | off |
| Low Fidelity Photo | Color | 30 colours, fidelity 20 | 50 | 50 | 10 | Overlapping | Fills | off |
| 3 Colors | Color | 3 colours, fidelity 100 | 50 | 50 | 15 | Abutting | Fills | off |
| 6 Colors | Color | 6 colours, fidelity 100 | 50 | 50 | 15 | Abutting | Fills | off |
| 16 Colors | Color | 16 colours, fidelity 100 | 50 | 50 | 15 | Abutting | Fills | off |
| Shades of Gray | Grayscale | Grays 50 | 50 | 50 | 15 | Overlapping | Fills | off |
| Black and White Logo | B&W | Threshold 128 | 50 | 75 | 25 | Abutting | Fills | on |
| Sketched Art | B&W | Threshold 128 | 50 | 50 | 20 | Abutting | Fills | off |
| Silhouettes | B&W | Threshold 230 | 50 | 50 | 90 | Abutting | Fills | off |
| Line Art | B&W | Threshold 128 | 50 | 75 | 20 | Abutting | Strokes (max 50) | off |
| Technical Drawing | B&W | Threshold 128 | 50 | 100 | 1 | Abutting | Strokes (max 10) | on |

The six icon presets and \[Default\] are bracketed built-ins listed first. The
scripting list order is: \[High Color\], \[Low Color\], \[Grayscale\],
\[Black & White\], \[Outline\], \[Auto-Color\], \[Default\], then the eleven
named presets. Several presets share values (for example \[High Color\] and
High Fidelity Photo).

What scripting cannot show, still to capture from the panel (task 9.1):

- **Ignore White/Ignore Color.** 30.1's scripting reads `ignoreWhite` as
  false for every preset, a bug fixed in 30.3, so Sketched Art's expected
  "ignore white" is unconfirmed.
- **Palette type** (Automatic, Limited, Full Tone, Document Library). It is
  unreadable through scripting.
- **The enhanced versus legacy sets.** Scripting reports `autoGrouping` false
  everywhere, so it appears to load the legacy versions. The enhanced
  presets' Gradients, Shapes, Transparency and Auto Grouping settings aren't
  exposed at all.
- **Slider ranges.**

### 6.4 Tracing pipeline (engine: `src/wasm/trace`, Rust)

Everything runs in a worker. The engine is a pure function
`trace(image, options) → TraceResult`, and its output is **deterministic**:
the same input and options give identical bytes on every platform.

| Step | Name | Detail |
|------|------|--------|
| T0 | **Ingest** | Take the placed image's pixels (any colour mode → RGBA8 or RGBA16) and its effective PPI (Info shows it). Apply a working-resolution cap (a preference, default about 4 MP *(tune)*) by downscaling with area averaging. Record the scale so the output maps back to the placement matrix. Alpha: pixels below 50 % alpha are treated as "no data". They count as white for Ignore White and never produce paths *(v: Illustrator composites on white)*. |
| T1 | **Colour space** | Convert to CIE Lab (D65) for perceptual distance. Grayscale and B&W use L*. |
| T2 | **Pre-filter** | Edge-preserving smoothing whose strength depends on Noise and the mode: a small median plus a bilateral pass. This removes JPEG ringing and scanner noise without moving edges. |
| T3 | **Quantise** | **B&W:** threshold on luminance (0–255). **Grayscale:** uniform L* levels, with the count taken from Grays. **Color / Limited:** k-means++ in Lab with k = Colors, seeded by median cut (PhotoSuite `engine/compositing` quantisers are the starting point), iterated to convergence with a fixed RNG seed. **Full Tone / Automatic:** hierarchical region merging (colour-distance + area agglomerative clustering, as in VTracer). The slider sets the merge distance. Automatic picks a stopping point from the colour histogram entropy. **Document Library:** nearest swatch in Lab (ΔE2000) from the chosen library or group. The output keeps swatch references. |
| T4 | **Segment** | Label connected components per quantised colour (8-connectivity for foreground, 4-connectivity for background, which avoids diagonal leaks). **Noise:** components with area below Noise px² are merged into the neighbour sharing the longest border (ties go to the nearest colour), so no holes are left. |
| T5 | **Boundary topology** | **Abutting:** build a planar map of crack edges (pixel-corner lattice). The boundary between two regions is **one shared edge chain** used by both faces, so neighbouring shapes can't gap or overlap. Each face becomes a compound path (outer ring plus holes). **Overlapping:** order regions by a stacking key (area descending, then luminance). Each shape is its region **united with every region stacked above it** that it surrounds, with holes filled. This gives stacked shapes without holes (as in VTracer), which hide anti-aliasing seams. |
| T6 | **Polygonise** | Convert staircase crack chains into polygons. Use an optimal-polygon step based on the published Potrace method (Selinger 2003). **This is a clean-room implementation from the paper, not the GPL Potrace code.** Then corner-aware straight-segment detection. **Paths** maps to the fit tolerance: 0 % gives about 3.0 px and 100 % about 0.25 px *(calibrate)*. |
| T7 | **Corners** | Corner detection by the turning-angle and alpha test (Potrace α). **Corners** maps to the corner threshold: 0 % gives few corners (α about 1.3) and 100 % gives every vertex that turns more than about 60° *(calibrate)*. |
| T8 | **Curve fitting** | Fit cubic Béziers between corners with Schneider's algorithm (least squares plus Newton reparameterisation). The tolerance comes from Paths. Smooth joins are G1-continuous, and corners keep independent handles. |
| T9 | **Shared-edge fitting** (Abutting) | Fit each **shared** edge chain once, then assemble each face's rings from the fitted edges (reversing where needed). This keeps neighbouring shapes bit-identical along their common boundary. |
| T10 | **Snap Curves To Lines** | Replace segments whose control points are within the tolerance of the chord with lines. Then snap line directions within about 3° *(calibrate)* of 0° or 90° to exact horizontal or vertical, adjusting neighbours so anchors stay shared. |
| T11 | **Strokes (centreline)** | For B&W with Create Strokes: compute a distance transform of the foreground. Features whose width is at most the Stroke value go through skeletonisation (Zhang–Suen thinning cleaned by the medial axis), then a skeleton graph (junctions and endpoints), spur pruning (spurs shorter than about 1.5 × local width), curve fitting as in T6–T8 per branch, and a stroke weight of 2 × the median distance along the branch. Wider regions become fills if Fills is on and are dropped otherwise. Junctions keep the stroke paths separate (Illustrator doesn't merge branches) *(v)*. |
| T12 | **Ignore Color** | Drop output faces whose colour matches the ignored colour (default white: L* ≥ 99.5 and chroma ≤ 1 *(calibrate)*; for other colours, a ΔE tolerance *(calibrate)*). In Abutting mode their shared edges are dropped too, and neighbours keep their outlines. |
| T13 | **Emit** | Map to document coordinates with the placement matrix. Group the result by colour *(v: Illustrator's expanded structure is groups of paths)*. Each colour becomes a swatch-linked fill when Document Library is used. Compute the Info statistics: paths, anchors, colours, areas, PPI. |

### 6.5 Live tracing object

- `PluginItem { kind: "tracing", source: RasterItem|PlacedItem (hidden), options, result (cached geometry), stats }`.
- It renders according to View (§6.2). The outline views draw result paths as
  1-px outlines above or without the source.
- Changing options with Preview on re-traces in the worker, debounced (about
  300 ms). The previous result stays visible until the new one arrives. A
  stale job is cancelled when a newer one starts.
- **Expand** replaces the object with the result group (a normal art tree).
  **Release** restores the source image. Undo works for both.
- Transforming the object transforms the source and the cached result without
  re-tracing. Re-tracing happens in source pixel space.
- **Persistence in `.ai`:** write it as Illustrator's tracing plugin group:
  source image, options dictionary and expanded art as the fallback. Reading an
  Illustrator-made tracing object restores it as a live object. **Stretch
  goal:** Illustrator reopens a VectorSuite trace as live. **Guaranteed:** it
  shows the expanded result.

### 6.6 Tracing presets storage

User presets are JSON in `{app_data_dir}/presets/tracing/*.json`, with the
same keys as `TracingOptions` in the scripting DOM (`tracingMode`,
`tracingColorTypeValue`, `colorFidelity`, `tracingColors`, `grayLevels`,
`threshold`, `pathFidelity`, `cornerFidelity`, `noiseFidelity`,
`tracingMethod`, `fills`, `strokes`, `maxStrokeWeight`,
`snapCurvesToLines`, `ignoreWhite`, `viewMode`, `preprocessBlur`,
`paletteName`). Importing Illustrator's own tracing-preset file needs format
research *(v)*.

### 6.7 Performance targets (reference machine, §8.4)

| Input | Settings | Target |
|-------|----------|--------|
| 1 MP logo | B&W default | ≤ 250 ms |
| 1 MP illustration | 16 Colors | ≤ 1 s |
| 4 MP photo | High Fidelity Photo | ≤ 6 s, cancellable, progress reported every 100 ms |
| 12 MP scan | Line Art (strokes) | ≤ 4 s |

The worker receives transferable buffers (no `SharedArrayBuffer`, because the
webview is not cross-origin isolated; the same constraint as PhotoSuite's
`FilterBandRunner`). Parallelism comes from splitting k-means and
connected-component labelling into bands across a worker pool. The results
must be the same as a single-threaded run.

### 6.8 Quality evaluation

- **Corpus** (`fixtures/trace/`): 60+ images in six classes: logos (flat
  colour), line art and technical drawings, pencil sketches and scans,
  illustrations with gradients, photos, and pixel art / low resolution. All
  are licensed for redistribution.
- **Reference outputs:** traced in a licensed Illustrator 30.1 with each built-in preset
  and exported as SVG together with the Info statistics. This needs a licensed
  install (§9).
- **Metrics per case:**
  - Raster fidelity: re-rasterise the result at source resolution, then
    compare SSIM and ΔE-mean against the source, and against Illustrator's
    result.
  - Compactness: paths and anchors compared with Illustrator (target: within
    ±15 %).
  - Topology: no gaps or slivers in Abutting mode (union of faces = image rect,
    pairwise overlap area = 0).
  - Stroke accuracy for Line Art (Hausdorff distance to hand-labelled
    centrelines).
- **Gate:** a CI job traces the corpus. A regression greater than 1 % in SSIM
  or 5 % in anchor count fails the job. A visual diff page is published for
  review.

---

