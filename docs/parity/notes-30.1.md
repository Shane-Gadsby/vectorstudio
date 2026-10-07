# Illustrator 30.1 facts from Adobe's public docs

These are facts, paraphrased, taken from Adobe's help pages (fetched into the
gitignored `.research/` on 2026-09-24) to seed the parity matrix (task 0.4.1).
Each section names its source page, under `helpx.adobe.com/illustrator/desktop/`,
and the page's "last updated" date. A page updated after 30.1 (December 2025)
may describe later behaviour; that is flagged where it matters. Nothing here
counts as verified: a licensed 30.1 confirms each fact when its matrix row
is written.

## Contextual Task Bar
`get-started/learn-the-basics/contextual-task-bar-overview.html` (27 Oct 2025)

- A floating on-canvas bar showing next actions for the current selection or
  tool. It can be moved, reset to its default position, pinned or hidden
  (More options). Window → Contextual Task Bar shows it again.
- Actions by context. Generative entries (Generate Vectors, Gen Shape Fill,
  Retype, Create Mockup) are out of scope (§1.2) and left out:
  - blank canvas: Draw (Pencil), Place Image;
  - path (Selection tool): Fill and Stroke. An open path adds Join Path and
    Edit Path (switches to Direct Selection). A closed shape adds Edit Path and
    Lock Object; a live basic shape shows its shape properties instead of Lock
    Object;
  - several paths: Group and Align, plus Recolor when the colours differ;
  - a group: Ungroup, Isolate group, Recolor object;
  - compound path: Edit Path, Fill, Stroke, Release;
  - basic shape tools (Rectangle, Rounded Rectangle, Ellipse, Polygon, Star):
    Edit Path, Fill, Stroke and the shape properties;
  - Direct Selection on a path: Simplify, Smooth, Remove selected anchor
    points, Connect selected end points, Cut path at selected anchor points,
    Convert to corner, Convert to smooth;
  - type tools: font family, font style, font size, Fill. With the Selection
    tool, point text offers Area type, area text offers Point type, text on a
    path offers Type On Path, and every kind offers Outline (create outlines).
    The bar hides while the Touch Type tool is active;
  - image: Image Trace (with the Default preset), Crop Image. A linked image
    adds Embed Image, Relink and Edit in Photoshop; an embedded one adds
    Relink;
  - image plus vector: Clip Mask, Align, Group;
  - clipping mask: Edit Mask (isolation), Release;
  - Artboard, Smooth, Free Transform, Dimension and Objects on Path tools: the
    tool's own options.

## Rotate View
`add-and-import-files/start-a-new-file/rotate-canvas-view.html` (28 Oct 2025)

- The Rotate View tool sits under the Hand tool; its shortcut is **Shift+H**.
  Holding **Space+Shift** while dragging switches to it temporarily. Dragging
  rotates the view, and an on-canvas widget moves between angles.
- Preset angles are in a status-bar dropdown and View → Rotate View. View →
  Rotate View to Selection aligns the view to the selected object or text.
- View → New View saves the rotation as a named view.
- Trackpad: a two-finger rotate gesture pivots about the cursor.
- Reset: View → Reset Rotate View (**Shift+Ctrl+1** / **Shift+Cmd+1**), or
  press Esc twice.

## Large canvas
`add-and-import-files/start-a-new-file/create-files-on-large-canvases.html` (27 Oct 2025)

- The large canvas is 100× the normal one, **2270 × 2270 in**. It is created
  automatically when any artboard exceeds **227 in**, or when the artboards
  don't fit on the default canvas. New Document shows a warning sign.
- Zoom range on a large canvas: **0.313 % to 6,400 %**. Slices and Save for Web
  may be unavailable. Large documents export only to PDF, PNG, JPEG, PS, TIFF
  and SVG.
- vectorsuite.md §1.2 (from 2020 sources) said 2275″. The 2270″ figure above
  replaces it *(v)*.

## New Document
`add-and-import-files/start-a-new-file/*.html` (Oct 2025 – Apr 2026)

- The category tabs are Recent, Saved, Mobile, Web, Print, Branding, Social,
  Art & Illustration, Film & Video and Free Templates. "View more" shows
  further presets, and a Preset Details pane edits them before Create.
  (Branding, Social and Art & Illustration are new since 2020 *(v)*. Stock
  templates are out of scope.)

## Smooth and Simplify
`draw-shapes-and-paths/modify-paths/*.html` (27 Oct 2025)

- Object → Path → **Smooth**: a slider from minimum to maximum smoothing, plus
  an Auto-Smooth button.
- Simplify's advanced options: Corner Point Angle Threshold (left is smoother,
  right is sharper; an auto-calculated default leaves corners unchanged),
  Compare Original and New (anchor counts), Show Original Path, Preview,
  Convert to Straight Lines, and "Retain my latest settings and directly open
  this dialog".

## Star
`draw-shapes-and-paths/draw-shapes/draw-stars.html` (30 Oct 2025)

- Clicking with the Star tool opens a dialog with Radius 1 (inner points),
  Radius 2 (outer points) and Points. Live-star editing (sides, inner and outer
  radius) has its own pages under `modify-live-shapes/`.

## Intertwine
`manage-objects/reshape-transform-objects/create-intertwined-objects.html` (30 Oct 2025)

- Object → Intertwine → **Make / Edit / Release**. It works on shapes, text,
  and 2D and 3D objects, without changing them (non-destructive).
- Make creates an Intertwine group in the Layers panel, and objects can be
  dragged into it later. A zone is chosen by clicking a highlighted overlap or
  by drawing a closed path around one (Shift-drag draws a rectangle).
- Where three or more objects overlap, draw around the area, hover to
  highlight the nearest object's path, and right-click to Bring to Front,
  Bring Forward, Send Backward or Send to Back within the zone.
- Not supported: Live Paint, Repeat, graphs, nested intertwines, or reusing
  intertwined objects. Release restores the originals.

## Dimension tool
`measure-and-align/plot-and-measure/*.html` (30 Oct 2025)

- It isn't in the default toolbar: Edit Toolbar → Modify section. Selecting it
  shows a taskbar with **Linear**, **Angular** and **Radial** types and Tool
  Options.
- Linear: aligned, vertical or horizontal, between two points (click, click,
  then click again for aligned or move the mouse for vertical or horizontal),
  or along the side of a basic shape (hover until a pink guide appears, then
  drag). Alt/Option-hover on a path plots the object's vertical or horizontal
  dimension.
- Angular: interior (drag inward) or exterior (drag outward) at a vertex, or
  between two intersecting lines.
- Radial: radius (drag outward) or diameter (drag inward), for circles and
  perfect arcs.
- A dimension object has a dimension line, extension lines and dimension text.
  The parts to model are extension-line offset and extension, and text offset.
- Tool Options: Units, Precision, Scale (for example 1:1, 1:10), Hide Units,
  Arrow Style, Arrow Scale, Line Weight, Line Type (solid or dashed), Offset,
  Extension, Hide Extension Lines, Font Family, Font Style, Font Size, Position
  (away from the line and object, between the line and object, or align left,
  centre or right), and Reset.
- Existing dimensions are edited in the Properties panel, which offers Apply to
  all and Set as default.
- Association: dimensions update when the measured object is **transformed**
  (for example, a width change), but **not when it is distorted**, according
  to two pages that seem to disagree *(v: exact rule)*. With a stroke,
  snapping uses preview bounds when Use Preview Bounds is on.
- The Measure tool's **area** measurement (pages dated 18 Aug 2026) comes after
  30.1 and is not a target. The distance mode from 2020 stays.

## Snapping and Smart Guides
`measure-and-align/**` (27–30 Oct 2025)

- **Snap to tangent** (30.0): a line's endpoint snaps tangent to a curve,
  circle or arc, and a tooltip and highlight appear. Endpoints only.
- **Snap to perpendicular** (30.0): a line's endpoint snaps at 90° to a
  **straight** path. It doesn't work on curves, and only at endpoints.
- Both work with the Line and Pen tools, are **on by default**, and are
  controlled by Preferences → Smart Guides → **Geometric Guides**.
- Smart Guides preferences: Object Guides, Glyphs Guides, Alignment Guides,
  Anchor/Path Labels, Object Highlighting, Measurement Labels, Transform
  Tools, Spacing Guides, Invoke Distance Guides, Snap to Last Location,
  Construction Guides (up to six angles) and Snapping Tolerance (points).
  Geometric Guides and the 29.8 additions aren't in that table yet *(v)*.
- Smart Guides are on by default. They can't be used together with Snap to
  Grid or Pixel Preview. Pixel Preview switches Snap to Grid to Snap to Pixel.
  Snap to Grid engages within two pixels of a grid line.
- Distance Guides: with an object selected, Alt/Option-hover over another
  object or empty artboard shows the distances.
- Grid preferences: Color, Style (Lines or Dots), Gridline every, Subdivisions.

## Rulers
`measure-and-align/grids-and-guides/*.html` (27 Oct 2025)

- Global rulers have their origin at the upper-left of the first artboard;
  artboard rulers at the upper-left of the active artboard. Each artboard can
  have its own origin. Double-clicking the ruler corner resets the origin.
  Changing the global origin affects pattern tiling; changing an artboard
  origin doesn't.
- The y axis increases **downwards** in the UI, but scripting keeps the legacy
  coordinate system, so scripted y values can differ.
- The default unit is points. Unit overrides typed into fields: in, mm, Q, cm,
  pt, pc, px.

## Supported file formats (partial)
`get-started/learn-the-basics/supported-file-formats.html` (27 Oct 2025)

- The page's lists are cut off at "E" in the fetched markup. It still confirms
  **CorelDRAW 5–10 (cdr)** open and place, **AVIF** open, CGM, and **WebP** in
  Export for Screens (alongside PDF, JPEG, PNG and SVG). Save for Web (Legacy)
  lists GIF, JPEG and PNG. Re-fetch this page to get the complete lists.

## Save: Illustrator Options and legacy versions
`/illustrator/using/saving-artwork.html` (12 Feb 2025) and
`troubleshoot/application-crash-issues/auto-backup-and-recovery-settings.html` (27 Oct 2025)

- The native save formats are AI, PDF, EPS, FXG and SVG. PDF and SVG keep
  all Illustrator data only with Preserve Illustrator Editing Capabilities.
  EPS and FXG can write each artboard as a separate file. SVG writes only the
  active artboard.
- The **Illustrator Options** dialog has: Version; Subset Embedded Fonts When
  Percent Of Characters Used Is Less Than; **Embed permitted fonts for file
  preview** (new since 2020); Create PDF Compatible File; Include Linked
  Files; Embed ICC Profiles; Use Compression; Save Each Artboard To A Separate
  File (which also writes a master file); and, for versions before 9.0,
  Transparency: Preserve Paths or Preserve Appearance And Overprints.
- **The newest version is still labelled "Illustrator 2020".** Adobe's 30.0
  recovery page tells users to save "with compatibility set to Illustrator
  2020", so 30.x writes the v24 format (§4.2).
- **Save in Background** (Preferences → File Handling) is on by default and
  applies only to `.ai`. It doesn't run when Create PDF Compatible File is off
  or the file contains third-party plugin groups or live effects. Progress is
  shown in the menu bar, and each save can be cancelled.
- The 30.0 recovery settings, under File Handling: Automatically Save
  Recovery Data Every (**off by default in 30.0**, because Save in Background
  now also handles backups), a folder chooser, Turn off Data Recovery for
  complex documents, and Save in Background.
  - The new quick save and backup needs compatibility set to Illustrator 2020,
    no third-party plugins, and no Live Paint, Shape Builder or Freeform
    Gradient content.
- EPS Options: Version, preview Format (None, black-and-white, or colour,
  including TIFF 8-bit Color with a background option), and more. Use
  Artboards writes one file per artboard plus a combined file.
- SVG Options: profiles (SVG 1.0, 1.1, Basic 1.1, Tiny 1.1, Tiny 1.1+). Mesh
  is rasterised; images become JPEG without alpha and PNG with it.
- File → Save for Microsoft Office writes a PNG.

## Export
`/illustrator/using/exporting-artwork.html` (23 Jul 2024),
`/illustrator/using/collect-assets-export-for-screens.html` (24 Apr 2025)

- **Export As** formats: DWG and DXF, BMP, EMF, JPEG, PSD, PNG, Targa, TXT,
  SVG, TIFF, WMF, **WebP** and PDF. **SWF and PICT are not listed**; one
  stale line about multi-artboard export still mentions SWF. Use Artboards:
  All or Range.
- DWG/DXF options include Raster File Format (PNG or JPEG) and Always Export
  Group as Block Reference. By default, white exports as black and black as
  white.
- JPEG: Compression Method (Baseline (Standard), Baseline Optimized,
  Progressive) and Imagemap (Client-side .html or Server-side .map).
- SVG export: Styling (Internal CSS, Inline Style, Presentation Attributes),
  Decimal, and more.
- **Export in Background** (Preferences → File Handling & Clipboard) is on by
  default for Export for Screens, for PNG and JPG only. A mix with SVG or PDF
  exports in the foreground.
- Export for Screens: Scale, Suffix, Format, Add Scale, iOS and Android
  presets, Export to (folder), Open Location after Export. Multiple scales
  create 1x/2x/3x subfolders. Format Settings covers each format. TIFF (30.2)
  and the cloud target (30.x) come after the baseline.

## 3D and Materials
`special-effects-styles/create-3d-graphics/*.html` (Oct 2025; the render page is May 2026)

- Window → 3D and Materials. The classic effects moved to Effect → 3D and
  Materials → **3D (Classic)** → Extrude & Bevel (Classic), Revolve
  (Classic), Rotate (Classic).
- Object tab:
  - 3D Type: Plane, Extrude, Revolve or Inflate;
  - **Depth 0–2000**, **Twist up to 360°**, **Taper 100 %–1 %**, Cap (solid
    or hollow);
  - Bevel: Bevel Shape, Width, Height, Repeat, Space, Bevel Inside, Bevel
    both sides, Reset;
  - Rotation: presets (by direction, axis and isometric), **X, Y and Z from
    −180° to 180°**, **Perspective 0°–160°**.
- Materials tab: Base Materials, graphics mapped onto the object (Add
  Materials and Graphics → Add as Single Graphic, or drag in; a blue widget
  positions the graphic on a surface), and Properties (**roughness and
  metallic, 0–1**). The Adobe Substance libraries and online assets are
  licensed content and out of scope (R4); ship original materials.
- Lighting tab:
  - presets (Standard, Diffuse, Top Left, Right), a light widget, several
    lights (add, delete, list, move behind or in front of the object);
  - per light: Color, **Intensity 0–100 %**, **Rotation −180°–180°**,
    **Height 0°–90°**, **Softness 0–100 %**;
  - **Ambient Light 0–200 %**;
  - Shadows: Position (Behind Object or Below Object), **Distance from Object
    0–100 %**, **Shadow Bounds 10–400 %**.
- Render Settings: Ray Tracing (with Raster Settings for resolution, colour
  and background, and a Quality setting such as High) or Wireframe. Quick
  Actions → Expand as wireframes.
- Export 3D object: **GLTF, USDA, USDZ, OBJ** through the Asset Export
  panel; **USDA is the default**. Each object stays separately editable.

## Repeat
`paint-and-fill/create-and-edit-patterns/*repeat*.html` (27 Oct 2025)

- Object → Repeat → Radial, Grid, Mirror, and Options. Instances update when
  the original is edited, and Object → Expand turns the result into a group.
- Radial options: Number of instances (**default 8**), Radius, Reverse
  Overlap. The on-canvas controls set the count and the rotation.
- Grid options: vertical and horizontal spacing, Grid Type (rows or
  columns), Flip Rows, Flip Column, Preview. On canvas: drag down for rows,
  sideways for columns, the corner to resize, and the sliders between items
  for spacing.
- Mirror options: Angle of mirror axis. On canvas: handles to rotate and
  transform the mirrored half, and dragging the axis sets angle and spacing.
  Double-click to edit and double-click away to finish.

## Objects on Path
`/illustrator/using/objects-on-path.html` (9 May 2025)

- The tool is not in the default toolbar (Edit Toolbar → Modify). It is also
  reachable through Object → Objects on Path → Attach and Expand, and the
  right-click menu with two or more objects selected. Select the objects,
  then click a supported path (it highlights). The path can be open or
  closed, curved or straight, and can be one of the selected objects. Most
  object types work except graphs. The path stays visible.
- Default arrangement:
  - order: selected objects are taken column by column from left to right,
    top to bottom within each column, and placed from the path's origin
    (basic shapes have a predetermined origin);
  - the centre of each object attaches to the outline, ignoring stroke
    weight;
  - the first object sits at the origin; on an open path the last sits at
    the endpoint; objects are spaced equally;
  - each object is set upright or level to the path, rounding off its
    rotation, so the net rotation shown is 0.
- Tool Options (double-click the tool): Pivot (nine points), Rotate, Reset,
  Save. These apply to future attachments only.
- Widgets: Space (the first object stays anchored; with Alt/Option, both
  ends move symmetrically, and the value is shown), Move All (on an open
  path, only when the objects span less than the path), Rotate All (Shift
  gives 15° steps; rotation is measured from the path normal), and
  Select/Move to shuffle an object's position. Properties → Objects on Path
  Options has Pivot, Rotate and Detach. Changes apply to all objects, not one.
- Detach: one object at a time with the widget, or several by dragging them
  out of the group in the Layers panel. The rest re-flow: default spacing
  keeps the distribution, and custom spacing keeps the spacing.
- Attaching more: drag objects into the group in the Layers panel, or paste
  or create them in isolation mode; they attach at the end. Alt-dragging a
  copy attaches it at the end.
- Edit compatibility:
  - Eraser, Path Eraser, Scissors and Knife turn the group into a regular
    group;
  - Shape Builder, Blend and Live Paint Bucket work only in isolation mode;
  - the perspective tools don't work;
  - editing the path re-flows the objects.

## History panel
`/illustrator/using/recovery-undo-automation.html` (17 Jul 2024)

- Window → History. Clicking a state reverts to it. The panel menu has Step
  Backward, Step Forward, Set History Limit and Clear History, and there is a
  button to make a new document from a state.
- **100 states by default**, set by Preferences → Performance → History
  States. The oldest states drop off beyond the limit. Changes to the
  application (panels, colour settings, actions, preferences) are not states.
- Clear History at a state removes the later states and keeps the earlier
  changes in the document. Editing after picking a state removes the later
  states. Closing the document clears the history. File → Revert goes back
  to the last save.

## Preferences categories
`get-started/preferences-and-settings/set-app-preferences.html` (5 Aug 2026; the categories match the 29.7-era searchable dialog *(v)*)

- General, Selection & Anchor Display, Type, Units, Guides & Grid, Smart
  Guides, Slices, Hyphenation, Plug-ins & Scratch Disks, User Interface,
  Performance, File Handling, Clipboard Handling, Appearance of Black,
  Devices.
- Ctrl/Cmd+K opens the dialog with the **Search Preferences** field focused,
  and Ctrl/Cmd+F returns to it. Enter or "See all results" lists matches.
  General → Reset Preferences resets everything.
