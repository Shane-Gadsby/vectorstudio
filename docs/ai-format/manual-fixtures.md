# Hand-made fixtures for task 0.3.5

These are the live features that scripting can't make, or can make only
through a dialog, which would block the VM agent. Make them in the **licensed**
Illustrator 30.1 in the VM. Keep each file small: one object, drawn from
simple shapes of your own, nothing from Adobe's libraries. Save each one to
`Z:\temp\fixtures-manual\` (`~/Downloads/temp/fixtures-manual` on the dev
machine) as `.ai` with the default options (current format, PDF compatible,
compressed, **Embed ICC Profiles off**). Where a step says "defaults", keep the
dialog's values, but change one value and change it back before pressing
OK: an untouched dialog doesn't write its values (found with 20-effect-dialogs).

Start each file from a new RGB document (File > New, any web preset).

| File | Steps | Answers |
|------|-------|---------|
| `20-effect-dialogs.ai` | **Done** (2026-09-25): 16-live-effects with each effect re-confirmed from the Appearance panel. 14 effects gained their keys | Parameter keys (not reliable defaults) |
| `21-effects-menu.ai` | **Done** (2026-09-25). **Starting file provided** (made by `make-effect-sheet.jsx`, already open in Illustrator): 13 rectangles named `1 Stylize - Round Corners` … `13 SVG Filters - first filter` in the Layers panel. Select each and apply its effect **from the Effect menu** with the dialog's defaults: Stylize > Round Corners, Scribble; Distort & Transform > Pucker & Bloat, Roughen, Tweak, Twist, Zig Zag; Path > Offset Path, Outline Object; Warp > Arc; Pathfinder > Add; 3D and Materials > Extrude & Bevel; SVG Filters > the first filter. If a dialog opens with a value already set, change one value and back so it's written | The menu defaults, and the internal names `applyEffect` missed |
| `22-effects-photoshop.ai` | **Done** (2026-09-25). **Starting file provided** (purged): 6 rectangles named `1 Blur - Gaussian Blur`, `2 Blur - Radial Blur`, `3 Pixelate - Color Halftone`, `4 Sketch - Halftone Pattern`, `5 Artistic - Watercolor`, `6 Texture - Grain`. Apply each from the Effect menu with its defaults (the last three open the Filter Gallery) | The Photoshop-style (`PSAdapter`) effect storage, standalone and Filter Gallery |
| `23-pattern.ai` | **Done** (2026-09-25). **Starting file provided** (made by `make-pattern-sheet.jsx`, purged): a circle named `1 pattern source` and a rectangle named `2 pattern fill`. Pattern > Make on the circle with the defaults, Done, then fill the rectangle with the new swatch | `%AI3_BeginPattern` holds the tile as `%_` art; Pattern Options lives on the tile group's dictionary (`AIPattern_Editor_*`); the fill and the swatch list use `p`. Two extra variants (`-brick`, `-brick-spacing`) pin the non-default fields and the baked-in neighbours |
| `24-brushes.ai` | **Done** (2026-09-25). **Starting file provided** (made by `make-brush-sheet.jsx`, purged): a star named `1 brush source star` and four open paths. Define the brushes by hand (a Bristle brush came too); **applying** them is scriptable, so `apply-brushes.jsx` strokes each path | Brushes are plugin objects in a non-printing setup section, named by tool; Art and Pattern brushes point at `%AI8_BeginBrushPattern` tiles; a brushed path is an `XP` group whose `Anon` style repeats the settings with readable keys |
| `25-mesh-gradients.ai` | **Done** (2026-09-25). **Starting file provided** (`make-effect-sheet.jsx` with `width`/`height`/`stroked`): two 200 × 150 pt unstroked rectangles, `1 gradient mesh` and `2 freeform gradient` | A mesh is a `/Mesh X!` … `/End X!` block in a language of its own; a freeform gradient's points are a `/SmoothShadingStyle` in the art style, with the rendering in a `/ForeignObject` blob |
| `26-width-live-shapes.ai` | **Done** (2026-09-25). **Starting file provided** (`make-path-sheet.jsx`): two 10 pt open paths, `1 width profile 1` and `2 width tool drag`. The shapes must be drawn with the tools — a scripted rectangle is not a live shape | Width profiles are `kAIBeautifulStrokesParamsDictKey` in the style (t values plus widths), with the Width tool's handles on the path; live shapes are an `ai::LiveShape` dictionary in large-canvas coordinates |
| `27-blend-options.ai` | **Done** (2026-09-25). **Starting file provided** (`make-blend-sheet.jsx`): the three blends are already made (Blend > Make opens no dialog), named `1 specified steps 5`, `2 specified distance 20`, `3 steps 5 align to path`. Only the three Blend Options dialogs are by hand | Word 1 is the spacing type, word 2 the distance, word 4 (and 22) the step count in effect, word 5 the Align to Path field |
| `28-envelopes.ai` | **Done** (2026-09-29). **Starting file provided** (`make-effect-sheet.jsx` with `width`/`height`/`stroked`): two 200 x 150 pt unstroked rectangles, `1 warp envelope arc` and `2 mesh envelope`. Driven over the live bridge (`scripts/README.md`), which selected each rectangle, opened the dialog and saved; only the two dialogs' values were by hand | `AIDeformStyle` is 1 warp, 2 mesh, 3 top object. A warp also writes the Warp Options fields (`DeformStyle`, `Rotate`, `DeformValue`, `DeformHoriz`, `DeformVert`, `DisplayString`); a mesh writes none of them |
| `29-graph.ai` | **Done** (2026-09-29). **Starting file provided**: an empty purged document (`make-effect-sheet.jsx` with no names), opened by the bridge. The graph itself is a tool drag, so it is entirely by hand; the bridge then renamed it, saved it and purged it | A graph is **not** a plugin object: it is ordinary art (including six real text frames for the labels) plus `%_`-hidden `Ga`/`GA` settings, `Go` part tags and a closing `GS`. Its dictionary holds only the name. Drawing one puts Adobe's library resources back, so it must be purged |
| `30-perspective.ai` | **Done** (2026-09-29). The bridge made an empty purged document and ran `Show Perspective Grid` (no dialog); the rectangle is a tool drag, so by hand | The grid is **document data**: 41 `PerspectiveGrid_*` entries (geometry in large-canvas coordinates, colours as 16-bit components), plus `PerspectiveGrid_ShowHide` and `_Snap` in NotRecorded. An object on it carries only `ArtGridPlane` and `ArtGridPlaneOffset`, on both the path and its group |
| `31-3d-materials.ai` | Rectangle A: Effect > 3D and Materials > Extrude & Bevel (defaults, then close the panel). Rectangle B: Inflate (defaults) | 3D and Materials settings |
| `32-intertwine-path.ai` | Two overlapping circles: Object > Intertwine > Make, click one overlap. Then a row of three small squares and a curve: Object > Objects on Path > Attach | Intertwine and Objects on Path |
| `33-dimension.ai` | A rectangle, then the Dimension tool: one linear dimension along its top edge | Dimension annotations |

Save these to `Z:\temp\fixtures-manual\` (create the folder).

A new document starts with Adobe's library resources (symbols, graphic
styles, swatches), which can't go into a fixture (R4). Before a file is
added, it goes through `purge-resources.jsx` (by the agent), which removes
them and keeps the art and its effects.

Afterwards, on the dev machine:

```sh
node scripts/research/ai-art-objects.mjs ~/Downloads/temp/fixtures-manual/*.ai --keys --effects
```

Then copy the files into `fixtures/ai/30.1/`, add them to `manifest.json`
with `"corpus": "manual"` and a description, and write the findings into
`live-features-30.1.md`.
