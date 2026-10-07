<!-- Migrated from the VectorSuite plan (vectorsuite.md §5), the archived
     Tauri/JS prototype this fork replaces. See docs/decisions/0001-fork-from-vectorcraft.md.
     Values marked *(v)* are unverified against a licensed Illustrator 30.1. -->

## 5. Illustrator feature inventory (2020 base + v25–v30.1)

This section is the parity checklist. Every row becomes at least one entry in
the parity matrix (§8.1). §5.1–§5.15 were written against Illustrator 2020.
§5.16 adds the v25–v30.1 changes. Where 30.1 differs from a row below, 30.1 is
the target, and the row is corrected when the matrix is built (task 0.4.1). A
row is marked *(v)* when it needs verification against a **licensed**
Illustrator 30.1 install because public documentation was ambiguous or
unavailable.

### 5.1 Workspace and application shell

| Area | Requirements |
|------|--------------|
| Home screen | Recent files grid and list, New File, Open, presets row. It shows when no document is open (PhotoSuite `splash-screen.js` pattern). |
| New Document dialog | Category tabs Recent, Saved, Mobile, Web, Print, Film & Video, Art & Illustration, each with blank presets. The details pane has name, width/height, units, orientation, artboards count, bleed (T/B/L/R, linked), and Advanced Options: colour mode (RGB/CMYK), raster effects (Screen 72 / Medium 150 / High 300 ppi), preview mode (Default / Pixel / Overprint). Also *More Settings*: the legacy dialog with artboard layout (grid by row/column, arrange by row/column, left-to-right/right-to-left), spacing, columns, and templates. |
| Document profiles | 30.1 has Art & Illustration, Branding, Film & Video, Mobile, Print, Social and Web (verified by probe; there are no Basic RGB or Basic CMYK profiles). Sizes, colour modes and raster settings are in matrix rows `SHELL-0069` onwards. Each is a startup file with its own swatches, brushes, symbols and graphic styles. |
| Workspaces | Essentials, Essentials Classic, Automation, Layout, Painting, Printing and Proofing, Tracing, Typography, Web, Touch. Also New / Reset / Manage Workspace, with saved panel layouts. |
| Docking | Panel groups, collapse to icons, floating panels, tabbed documents or floating windows, Arrange Documents layouts (Tile, 2-up, 3-up …, Consolidate), and the application frame (Mac). |
| Toolbars | Basic and Advanced toolbars. Edit Toolbar ("…" drawer) with drag-to-add or remove, New Toolbar (custom floating toolbars), one or two columns. |
| Properties panel | Context-sensitive: Transform, Appearance, Character, Paragraph, Align, Quick Actions (for example Expand Shape, Recolor, Image Trace, Crop Image, Arrange, Outline), Document (units, artboard, grids, preferences). |
| Control panel | The classic context bar along the top, with the same contextual items. |
| Screen modes (F) | Normal, Full Screen with Menu Bar, Full Screen. Presentation Mode (Shift+F) shows artboards as slides. Trim View. |
| Status bar | Zoom, artboard navigator, and a status field (current tool / date and time / undo count / document colour profile / Version Cue legacy). |
| Keyboard Shortcuts | Editor for tools and menu commands, sets, and exports a text summary (`.kys` import and export). |
| Preferences | General; Selection & Anchor Display (including 24.3 "Select and Unlock Objects on Canvas"); Type; Units; Guides & Grid; Smart Guides; Slices; Hyphenation; Plug-ins & Scratch Disks; User Interface (brightness, canvas colour, scaling, large tabs); Performance (GPU performance, animated zoom, real-time drawing and editing, undo count); File Handling & Clipboard (data recovery interval, links, clipboard as PDF/AICB); Appearance of Black; Devices (touch). Every field must match (§8.1). |
| Undo | Unlimited undo up to the preference limit (Performance → Undo Counts). |
| Data recovery | Automatically save recovery data every N minutes. Turn it off for complex documents. |
| Document tabs | Tabs show the name, zoom, colour mode and preview mode. |

### 5.2 Tools (Advanced toolbar; 2020 base, add §5.16 tools)

The shortcuts are Illustrator defaults. **Every tool option dialog opens on
double-click or Enter.**

| Group | Tool | Key | Behaviour / options to match |
|-------|------|-----|------------------------------|
| Selection | Selection | V | Bounding box transform, Alt-drag duplicate, Shift constrain, isolation on double-click, lock/unlock icons (24.3). |
| | Direct Selection | A | Anchor and segment select, handle editing, live-corner widgets, Alt to select a whole path. |
| | Group Selection | — | Each click adds the next group up. |
| | Magic Wand | Y | Magic Wand panel: Fill Colour, Stroke Colour, Stroke Weight, Opacity, Blending Mode, each with a tolerance. |
| | Lasso | Q | Freeform selection of anchors and segments. |
| Drawing | Pen | P | Click for corner, drag for smooth, Alt to break the handle, Shift for 45°, Space to reposition while drawing, rubber band preview, auto add/delete. |
| | Add Anchor Point | = | The 30.1 default is `=` (verified); Adobe's help page says `+`. |
| | Delete Anchor Point | − | |
| | Anchor Point | Shift+C | Converts smooth ↔ corner and breaks handles. |
| | Curvature | Shift+~ | Point-based curves; double-click toggles a corner. |
| | Line Segment | \ | Options: length, angle, fill line. |
| | Arc | — | Length X/Y, type open/closed, base along X/Y, slope concave–convex, fill arc. |
| | Spiral | — | Radius, decay, segments, style. |
| | Rectangular Grid | — | Size, dividers with skew, outer rectangle as frame, fill grid. |
| | Polar Grid | — | Concentric and radial dividers with skew, create compound path from ellipses, fill. |
| Shapes | Rectangle | M | Live shape with corner widgets. Arrow keys change corner radius while drawing. |
| | Rounded Rectangle | — | Up/down arrows change the radius while drawing. |
| | Ellipse | L | Live pie widget (start and end angles). |
| | Polygon | — | Radius, sides. Arrow keys change sides while drawing. Live sides widget. |
| | Star | — | Radius 1 and 2, points. Ctrl holds the inner radius, Alt makes it straight. |
| | Flare | — | Centre, halo, rays, rings, direction. |
| | Shaper | Shift+N | Recognises gestures (rectangle, ellipse, triangle, polygon, line) and scribble-to-combine (Shaper Group with face selection). |
| Freeform | Pencil | N | Fidelity (Accurate ↔ Smooth), fill new strokes, keep selected, Alt toggles the Smooth tool, close paths when ends are within N px, edit selected paths within N px. |
| | Smooth | — | Fidelity. |
| | Path Eraser | — | |
| | Join | — | Scrub over gaps or overlaps to join. |
| Paint | Paintbrush | B | Fidelity, fill new brush strokes, keep selected, edit selected paths within N px. |
| | Blob Brush | Shift+B | Keep selected, merge only with selection, fidelity, size, angle, roundness (with pressure and tilt variation). |
| Type | Type | T | Click for point type, drag for area type, click inside a closed path for area type. |
| | Area Type, Type on a Path, Vertical Type, Vertical Area Type, Vertical Type on a Path | — | |
| | Touch Type | Shift+T | Per-glyph move, scale, rotate, keeping the text live. |
| Painting and colour | Mesh | U | Add mesh points and lines, Alt to delete, colour per node. |
| | Gradient | G | Gradient annotator: stops, midpoints, angle, radial aspect, freeform points and lines modes. |
| | Eyedropper | I | Options for what to pick up and apply (appearance, character and paragraph), Shift to sample colour only, Alt to apply. |
| | Measure | — | Info panel distance and angle. |
| | Live Paint Bucket | K | Paint fills and/or strokes, cursor swatch preview, highlight colour and width. |
| | Live Paint Selection | Shift+L | Select faces and edges. |
| | Blend | W | Click objects in sequence, options dialog. |
| Reshape / transform | Rotate | R | Alt-click sets the origin and opens the dialog (angle, transform objects and patterns, copy). |
| | Reflect | O | Horizontal, vertical or angle. |
| | Scale | S | Uniform or non-uniform, scale corners, scale strokes and effects, transform objects and patterns. |
| | Shear | — | Angle, axis. |
| | Reshape | — | |
| | Free Transform | E | Widget: constrain, free transform, perspective distort, free distort. The v24.x touch widget is included. |
| | Puppet Warp | — | Auto-pins, add/remove/rotate pins, expand mesh, show mesh, density. |
| | Width | Shift+W | Add and adjust width points, Alt for one side, a width-point edit dialog, save width profiles. |
| Liquify | Warp | Shift+R | Global brush dimensions (width, height, angle, intensity, pressure pen); detail and simplify. Shift-drag resizes. |
| | Twirl, Pucker, Bloat, Scallop, Crystallize, Wrinkle | — | Each has its own options (twirl rate; complexity; brush affects anchors / in/out tangents; horizontal/vertical %). |
| Shape Builder | Shape Builder | Shift+M | Alt to delete regions, gap detection (small/medium/large/custom), consider open filled paths as closed, merge in merge mode, click stroke to split path, pick colour from swatches or artwork, cursor swatch preview, fill and highlight. |
| Perspective | Perspective Grid | Shift+P | Plane widget, handles for vanishing points, horizon, ground level, grid extent, cell size. |
| | Perspective Selection | Shift+V | Drag objects onto planes. Keys 1/2/3/4 choose the plane. Alt to duplicate. |
| Symbolism | Symbol Sprayer | Shift+S | Diameter, intensity (fixed / pressure), density, method (average / user-defined / random) for Scrunch, Size, Spin, Screen, Stain, Style. Show brush size and intensity. |
| | Shifter, Scruncher, Sizer, Spinner, Stainer, Screener, Styler | — | |
| Graphs | Column Graph | J | Click for size dialog, graph data window. |
| | Stacked Column, Bar, Stacked Bar, Line, Area, Scatter, Pie, Radar | — | |
| Artboard | Artboard | Shift+O | Presets, orientation, move/copy artwork with the artboard, show centre mark / cross hairs / video safe areas, video ruler pixel aspect ratio, fade region outside the artboard, update while dragging, delete, new, name. Alt-drag duplicates. |
| Slicing / cutting | Slice | Shift+K | |
| | Slice Selection | — | |
| | Eraser | Shift+E | Angle, roundness and size with variation. Alt draws a marquee. |
| | Scissors | C | |
| | Knife | — | Alt for straight cuts. |
| Navigation | Hand | H | Space for a temporary Hand. |
| | Print Tiling | — | |
| | Zoom | Z | Scrubby zoom, animated zoom, Alt to zoom out. |
| Toolbar controls | Fill / Stroke | X | Swap Shift+X, default D, Colour `,`, Gradient `.`, None `/`. |
| | Drawing modes | Shift+D | Draw Normal, Draw Behind, Draw Inside. |
| | Change Screen Mode | F | |

Tool modifier behaviours (Shift, Alt/Option, Ctrl/Cmd, Space, and the arrow
keys while drawing) are specified per tool in `docs/parity/tools/*.md` (Phase 0
deliverable).

### 5.3 Panels (the Window menu)

| Panel | Contents to match |
|-------|-------------------|
| Actions | Sets and actions, record, play, stop, insert menu item, insert stop, insert selected path, select object, dialog toggles, batch, load/save `.aia`, button mode. |
| Align | Align objects (left/centre/right/top/middle/bottom), distribute objects, distribute spacing (auto / value), align to selection / key object / artboard, Use Preview Bounds, align glyph bounds for text (24.3, point and area text). |
| Appearance | The appearance stack: add new fill/stroke, add effect, clear appearance, reduce to basic appearance, duplicate/remove item, visibility toggles, inline stroke and fill controls, redefine graphic style, "new art has basic appearance". |
| Artboards | List, reorder, rename, options, rearrange all, convert to artboards, delete, duplicate. |
| Asset Export | Collect assets, export settings, iOS/Android presets. |
| Attributes | Overprint fill and stroke, show/hide centre, path direction reverse, fill rule (non-zero / even-odd), image map (none / rectangle / polygon + URL), note. |
| Brushes | Brush libraries, view modes, remove brush stroke, options of selected object, new brush, duplicate, delete, show/hide by type. |
| Character | Font family, style, size, leading, kerning (metrics / optical / auto / value), tracking, vertical/horizontal scale, baseline shift, character rotation, All Caps, Small Caps, Superscript, Subscript, Underline, Strikethrough, language, anti-aliasing (none/sharp/crisp/strong), snap to glyph, Touch Type button, font height variations (24.3), OpenType variable font axis sliders. |
| Character Styles / Paragraph Styles | New, edit (all attributes), clear overrides, redefine, load from document, basic style defaults. |
| Color | Grayscale, RGB, HSB, CMYK, Web Safe RGB. Spectrum ramp, None, black/white, out-of-gamut and out-of-web warnings, invert, complement, create new swatch. |
| Color Guide | Harmony rules (Complementary 1 and 2, Split Complementary, Left Complement, Right Complement, Analogous 1 and 2, Monochromatic, Shades, Triad 1–3, Tetrad 1–3, Compound 1 and 2, High Contrast 1–3, Pentagram), tints/shades, warm/cool, vivid/muted variations, limit to swatch library, Edit Colours button. |
| CSS Properties | CSS for the selection or all, export options (units, include vendor prefixes, include absolute position, dimensions, generate CSS for unnamed objects, rasterize unsupported art), copy and export `.css`. |
| Document Info | Document, objects, styles, brushes, spot colour objects, pattern objects, gradient objects, fonts, linked images, embedded images, font details. Selection only. Save as text. |
| Flattener Preview | Highlight (rasterized complex regions, transparent objects, outlined strokes/text, …), overprint handling, preset, refresh. |
| Glyphs | Show entire font or alternates by feature, font and style, zoom, recently used, insert. |
| Gradient | Type (linear / radial / freeform with points / lines), edit, angle, aspect ratio, reverse, stops (colour, opacity, location), midpoints, stroke gradient modes (within / along / across), spread. |
| Graphic Styles | Libraries, break link, new, duplicate, delete, merge styles, override character colour, use square/text for preview, add to or replace existing styles on click. |
| Image Trace | See §6. |
| Info | X/Y, W/H, colour values of fill and stroke, distance/angle (Measure), transform values. |
| Layers | Tree with visibility, lock, template, target circle (appearance), selection squares, layer colour, locate object, make/release clipping mask, sublayer, collect in new layer, release to layers (sequence / build), reverse order, template layers, hide/lock others, merge selected, flatten artwork, paste remembers layers, options (name, colour, template, show, preview, lock, print, dim images to %), panel options (row size, thumbnails, show layers only). |
| Libraries | Local only (§1.2): colours, character and paragraph styles, graphics, brushes. |
| Links | Relink, go to link, update link, edit original, embed/unembed, link information, show missing/modified/embedded. |
| Magic Wand | Tolerances, as above. |
| Navigator | Proxy view, zoom slider, draw dashed lines as solid, view artboard contents only. |
| OpenType | Standard/contextual/discretionary ligatures, swash, stylistic alternates, titling alternates, ordinals, fractions, stylistic sets, figures (tabular/proportional lining/oldstyle), position (superior/inferior/numerator/denominator). |
| Paragraph | Alignment (7), indents, first-line indent, space before and after, hyphenate, hyphenation settings, justification settings (word/letter/glyph spacing, auto leading, single word justification), composer (Adobe Every-line / Single-line and the Japanese composers), roman hanging punctuation, CJK options (kinsoku, mojikumi, burasagari), bullets and numbering *(v: only in later versions)*. |
| Pathfinder | Shape modes (Unite, Minus Front, Intersect, Exclude, with Alt making a compound shape) and Expand. Pathfinders (Divide, Trim, Merge, Crop, Outline, Minus Back). Options: precision (0.028 pt), remove redundant points, divide and outline will remove unpainted artwork. Repeat, make and release compound shapes. |
| Pattern Options | Name, tile type (Grid, Brick by Row, Brick by Column, Hex by Column, Hex by Row), brick offset, width/height, size tile to art, move tile with art, H/V spacing, overlap order, copies (1×1 … 9×9 …), dim copies to %, show tile edge, show swatch bounds. |
| Properties | See §5.1. |
| Separations Preview | Overprint preview, show used spot colours only, per-plate toggles. |
| Stroke | Weight, cap, corner, limit, align stroke (centre / inside / outside), dashed line (3 dash/gap pairs, preserve exact lengths / align to corners and path ends), arrowheads (start and end from the built-in library of about 39, scale, align tip at / beyond end), width profile (preset and custom, flip). |
| SVG Interactivity | Events (onfocusin, onclick, onmouseover, …) with JavaScript, JavaScript files. |
| Swatches | Show kinds (colour, gradient, pattern, colour groups), libraries, new swatch (name, type process/spot, global, mode), new colour group, swatch options, open colour group in Recolor, add used colours, sort by name/kind, select all unused, merge, persistent swatches, list/thumbnail views. |
| Symbols | Libraries, place instance, replace, break link, reset transform, new symbol (options dialog: name, export type movie clip / graphic, symbol type dynamic / static, registration, enable 9-slice scaling guides, align to pixel grid), edit symbol (isolation). |
| Transform | X/Y/W/H with a reference point, link proportions, rotate, shear, shape properties (live rectangle, ellipse, polygon, line), scale corners, scale strokes and effects, align to pixel grid, flip. |
| Transparency | Blend mode (the 16 modes), opacity, thumbnails, make mask / release, clip, invert mask, isolate blending, knockout group, opacity and mask define knockout shape, new opacity masks are clipping/inverted, page isolated blending/knockout. |
| Variables | New variable (text, linked file, graph data, visibility), bind/unbind, data sets (capture, next/previous, rename, delete), import and export XML variable library. |
| Type → Tabs | Tab ruler: left, centre, right and decimal tabs, leader, align on, snap to unit, repeat tab. |
| Workspace / Extensions / Toolbars | Menus, as in §5.1. |
| Libraries of libraries | Swatch, Brush, Graphic Style and Symbol library windows, including the stock libraries shipped with the app (content needs its own licensing review, §9). |

### 5.4 Menus

| Menu | Items |
|------|-------|
| **File** | New, New from Template, Open, Open Recent, Close, Save, Save As, Save a Copy, Save as Template, Save Selected Slices, Revert, Place, Package, Export (Export for Screens, Export As, Save for Web (Legacy)), Export Selection, Scripts (list plus Other Script…), Document Setup (units, bleed, show images in outline, highlight substituted fonts/glyphs, transparency grid, simulate coloured paper, flattener settings, type options: language, quotes, superscript/subscript/small-caps sizes and positions, export: preserve text editability / appearance), Document Color Mode, File Info (XMP), Print, Exit. |
| **Edit** | Undo, Redo, Cut, Copy, Paste, Paste in Front, Paste in Back, Paste in Place, Paste on All Artboards, Paste without Formatting, Clear, Find and Replace, Find Next, Spelling (Check Spelling, Edit Custom Dictionary, **Auto Spell Check** (24.0)), Edit Colors (Recolor Artwork, Adjust Color Balance, Blend Front to Back / Horizontally / Vertically, Convert to CMYK / Grayscale / RGB, Invert Colors, Overprint Black, Saturate), Edit Original, Transparency Flattener Presets, Tracing Presets, Print Presets, Adobe PDF Presets, Perspective Grid Presets, Color Settings, Assign Profile, Keyboard Shortcuts, Preferences. |
| **Object** | Transform (Transform Again, Move, Rotate, Reflect, Scale, Shear, Transform Each (scale, move, rotate, reflect X/Y, random, reference point, copy), Reset Bounding Box), Arrange (Bring to Front, Bring Forward, Send Backward, Send to Back, Send to Current Layer), Align, Group, Ungroup, Lock (Selection, All Artwork Above, Other Layers), Unlock All, Hide (Selection, All Artwork Above, Other Layers), Show All, Expand, Expand Appearance, Crop Image, Rasterize, Create Gradient Mesh, Create Object Mosaic, Create Trim Marks, Flatten Transparency, Make Pixel Perfect, Slice (Make, Release, Create from Guides, Create from Selection, Duplicate Slice, Combine Slices, Divide Slices, Delete All, Slice Options, Clip to Artboard), Path (Join, Average, Outline Stroke, Offset Path, Reverse Path Direction *(v)*, Simplify (24.0), Add Anchor Points, Remove Anchor Points, Divide Objects Below, Split Into Grid, Clean Up), Shape (Convert to Shapes, Expand Shape), Pattern (Make, Edit Pattern, Tile Edge Color), Blend (Make, Release, Blend Options, Expand, Replace Spine, Reverse Spine, Reverse Front to Back), Envelope Distort (Make with Warp, Make with Mesh, Make with Top Object, Release, Envelope Options, Expand, Edit Contents), Perspective (Attach to Active Plane, Release with Perspective, Move Plane to Match Object, Edit Text), Live Paint (Make, Merge, Release, Gap Options, Expand), Image Trace (Make, Make and Expand, Release, Expand), Text Wrap (Make, Release, Text Wrap Options), Clipping Mask (Make, Release, Edit Contents), Compound Path (Make, Release), Artboards (Convert to Artboards, Rearrange All Artboards, Fit to Artwork Bounds, Fit to Selected Art), Graph (Type, Data, Design, Column, Marker). |
| **Type** | Font, Recent Fonts, Size, Glyphs, Convert to Point/Area Type, Area Type Options (width/height, rows and columns with number, span, gutter, fixed, inset spacing, first baseline (Ascent, Cap Height, Leading, x Height, Em Box Height, Fixed, Legacy) with min, text flow, auto-size), Type on a Path (Rainbow, Skew, 3D Ribbon, Stair Step, Gravity, Type on a Path Options (effect, flip, align to path: ascender/descender/centre/baseline, spacing), Update Legacy Type on a Path), Threaded Text (Create, Release Selection, Remove Threading), Fit Headline, Resolve Missing Fonts, Find Font, Change Case (UPPERCASE, lowercase, Title Case, Sentence case), Smart Punctuation, Create Outlines, Optical Margin Alignment, Insert Special Character / White Space / Break, Fill with Placeholder Text, Show Hidden Characters, Type Orientation, Legacy Text (Update All, Show/Hide Copies, Delete Copies, Select Copies). |
| **Select** | All, All on Active Artboard, Deselect, Reselect, Inverse, Next Object Above, Next Object Below, Same (Appearance, Appearance Attribute, Blending Mode, Fill & Stroke, Fill Color, Opacity, Stroke Color, Stroke Weight, Graphic Style, Shape, Symbol Instance, Link Block Series, Text: Font Family / Font Family & Style / Font Family, Style & Size / Font Size / Text Fill Color / Text Stroke Color / Text Fill & Stroke Color), Object (All on Same Layers, Direction Handles, Bristle Brush Strokes, Brush Strokes, Clipping Masks, Stray Points, All Text Objects, Point Type Objects, Area Type Objects), Start Global Edit, Save Selection, Edit Selection. |
| **Effect** | Apply Last Effect, Last Effect, Document Raster Effects Settings, plus the Illustrator Effects and Photoshop Effects in §5.8. |
| **View** | Outline / GPU Preview / Preview on CPU, Overprint Preview, Pixel Preview, Proof Setup (Working CMYK, legacy Mac/Win RGB, Monitor RGB, colour blindness Protanopia/Deuteranopia, Customize), Proof Colors, Zoom In, Zoom Out, Fit Artboard in Window, Fit All in Window, Actual Size, Hide Edges, Hide Artboards, Show Print Tiling, Show Slices, Lock Slices, Hide Template, Rulers (Show, Change to Global/Artboard Rulers, Show Video Rulers), Hide Bounding Box, Show Transparency Grid, Hide Text Threads, Hide Gradient Annotator, Show Live Paint Gaps, Guides (Hide, Lock, Make, Release, Clear), Smart Guides, Perspective Grid (Show, Show Rulers, Snap to Grid, Lock Grid, Lock Station Point, Define Grid, One/Two/Three Point Perspective, Save Grid as Preset), Show Grid, Snap to Grid, Snap to Pixel, Snap to Point, Snap to Glyph, Trim View, Presentation Mode, New View, Edit Views. |
| **Window** | New Window, Arrange, Workspace, Extensions (local plugins), all panels in §5.3, Control, Toolbars, and the library windows. |
| **Help** | About, System Info, keyboard shortcut summary, local help. Online-only items are removed. |

### 5.5 Paths and shapes

- **Anchors.** Smooth and corner points, independent handles, and handle
  retraction. Convert-point widgets in the Control and Properties panels:
  convert to corner or smooth, show/hide handles, remove anchors, cut path at
  anchors, connect endpoints, isolate selected object. Anchor, handle and
  highlight display sizes follow the preferences.
- **Live shapes.** Rectangle, rounded rectangle, ellipse (pie angles), polygon
  (sides), star (a live shape since 28.3) and line. Transform-panel shape
  properties. Expand Shape. Convert to Shapes.
- **Live corners** on any path: the corner widget, the Corners dialog (Round,
  Inverted Round, Chamfer; radius; rounding Relative or Absolute), the corner
  limit indicator, and Alt-click to cycle corner types.
- **Path commands:** Join (with corner/smooth options), Average (horizontal,
  vertical, both), Outline Stroke, Offset Path (offset, joins, miter limit),
  Simplify (24.0: an on-canvas slider for curve precision; the more-options
  dialog with Curve Precision %, Corner Point Angle Threshold, Convert to
  Straight Lines, Show Original, Keep Selected (legacy); Auto-Simplify and
  Minimum/Maximum points buttons), Add/Remove Anchor Points, Divide Objects
  Below, Split Into Grid (rows and columns with height, gutter, total; add
  guides), and Clean Up (stray points, unpainted objects, empty text paths).
- **Reverse path direction** through the Attributes panel.
- **Width profiles:** variable width stroke points, the built-in profile
  library, saving profiles, and profile flip. They apply to brush strokes.

### 5.6 Colour, paint and transparency

- **Colour models:** Grayscale, RGB, HSB, CMYK, Web Safe RGB, Lab (used by
  spot definitions). Spot colours with tint %, global process colours with tint,
  registration, none, and colour groups.
- **Swatch libraries** shipped with the app: Art History, Color Books, Color
  Properties, Corporate, Default, Earthtone, Foods, Gradients, Kids Stuff,
  Metal, Nature, Neutral, Patterns (Basic Graphics and Decorative), Scientific,
  Skintones, System (Mac/Windows), Textiles, VisiBone2, Web, User Defined.
  **Color Books (PANTONE and similar) are licensed content** (§9).
- **Recolor Artwork dialog:** Edit and Assign tabs; colour groups; harmony
  rules; smooth, segmented and bars colour wheels; brightness; link/unlink
  harmony colours; the Assign table (current → new, merge, separate, exclude,
  new row, randomise order and saturation/brightness); the colour reduction
  options (preset, colours, limit to library, sort, colorize method: exact /
  preserve tints / scale tints / tints and shades / hue shift; combine tints;
  preserve white, black, grays); recolor art checkbox; save changes to group;
  and "Get colors from selected art".
- **Gradients.** Linear and radial (with aspect ratio and highlight). **Freeform**
  (23.0) with Points mode (colour stops with spread) and Lines mode
  (colour along curves). Opacity stops, midpoints, and gradients on strokes
  (within, along, across). The Gradient tool's on-art annotator. Gradient
  swatches.
- **Patterns:** the Pattern Options panel (§5.3), pattern editing mode with
  live tile preview, and transforming patterns independently (the Transform
  Objects / Patterns checkboxes and the `~` drag).
- **Gradient mesh:** Create Gradient Mesh (rows, columns, appearance flat / to
  centre / to edge, highlight %), the Mesh tool, per-node colour and opacity,
  and converting a gradient to a mesh on Expand.
- **Live Paint:** make and merge groups, gap options (stop at small / medium /
  large gaps or a custom size, gap preview colour, close gaps with paths),
  faces and edges painted independently, expand, and release.
- **Transparency:** 16 blend modes (Normal, Darken, Multiply, Color Burn,
  Lighten, Screen, Color Dodge, Overlay, Soft Light, Hard Light, Difference,
  Exclusion, Hue, Saturation, Color, Luminosity), opacity per fill, stroke,
  object, group and layer, opacity masks, knockout groups, isolated blending,
  and flattening (flattener presets High/Medium/Low Resolution plus custom:
  raster/vector balance, line art and text resolution, gradient and mesh
  resolution, convert all text to outlines, convert all strokes to outlines,
  clip complex regions, anti-alias rasters, preserve alpha transparency,
  preserve overprints and spot colours).
- **Appearance and Graphic Styles:** see §3.3 and the panels in §5.3.
- **Eyedropper and Paint Bucket** attribute pickers.
- **Overprint:** fill and stroke overprint attributes, Overprint Black,
  Overprint Preview, Separations Preview.

### 5.7 Brushes

| Type | Options |
|------|---------|
| Calligraphic | Name, angle, roundness and size, each with variation Fixed / Random / Pressure / Stylus Wheel / Tilt / Bearing / Rotation. |
| Scatter | Size, spacing, scatter, rotation (each Fixed / Random / Pressure / … with ranges), rotation relative to Page or Path, colorization (None, Tints, Tints and Shades, Hue Shift, with key colour and tips). |
| Art | Width (with pressure), brush scale options (scale proportionately, stretch to fit, stretch between guides), direction, flip along and across, colorization, overlap (adjust corners and folds). |
| Bristle | Shape (Round Point, Round Blunt, Round Curve, Round Angle, Flat Point, Flat Blunt, Flat Curve, Flat Angle, Fan), size, bristle length, bristle density, bristle thickness, paint opacity, stiffness. Warns about too many strokes when printing (rasterisation). |
| Pattern | Tiles (side, outer corner, inner corner, start, end; auto-generated corners: centered, between, slice, overlap), scale with variation, spacing, flip, fit (stretch, add space, approximate path), colorization. |
| Blob Brush | Tool that produces filled merged paths (§5.2). |

Brush libraries: Arrows, Artistic, Borders, Bristle Brush, Decorative, Image
Brush (Image Brush Library), Vector Packs, Wacom 6D Brushes, User Defined.
Brushes on paths remain live. The strokes panel profile applies to Art and
Pattern brushes. Expand Appearance converts brush strokes to paths.

### 5.8 Effects (Effect menu)

**Illustrator Effects** (vector, live):

| Submenu | Effects and parameters |
|---------|------------------------|
| 3D (classic) | **Extrude & Bevel** (position presets such as Off-Axis Front … Isometric, X/Y/Z rotation, perspective, extrude depth, cap on/off, bevel from a library of about 10 profiles with height, bevel extent in/out, surface Wireframe / No Shading / Diffuse Shading / Plastic Shading, lighting sphere with multiple lights, intensity, ambient, highlight intensity and size, blend steps, shading colour, preserve spot colours, draw hidden faces, **Map Art** of symbols onto surfaces). **Revolve** (angle, offset, from left/right edge, cap). **Rotate**. |
| Convert to Shape | Rectangle, Rounded Rectangle, Ellipse (absolute or relative size, extra width and height, corner radius). |
| Crop Marks | |
| Distort & Transform | Free Distort, Pucker & Bloat, Roughen (size, relative/absolute, detail, smooth/corner points), Transform (like Transform Each, with copies), Tweak, Twist, Zig Zag (size, ridges per segment, smooth/corner). |
| Path | Offset Path, Outline Object, Outline Stroke. |
| Pathfinder | Add, Intersect, Exclude, Subtract, Minus Back, Divide, Trim, Merge, Crop, Outline, Hard Mix, Soft Mix (mixing rate), Trap (height/width, tint reduction, traps with process colour, reverse traps). |
| Rasterize | Colour model, resolution (use document raster effects resolution), background, anti-aliasing (none / optimise art / optimise type), create clipping mask, add space around object. |
| Stylize | Drop Shadow (mode, opacity, X/Y offset, blur, colour or darkness), Feather, Inner Glow (mode, colour, opacity, blur, centre/edge), Outer Glow, Round Corners, Scribble (settings presets, angle, path overlap, variation, stroke width, curviness, spacing, each with variation). |
| SVG Filters | Apply SVG Filter, Import SVG Filter, the built-in library (AI_Alpha_1…, AI_Shadow, AI_Turbulence …). |
| Warp | Arc, Arc Lower, Arc Upper, Arch, Bulge, Shell Lower, Shell Upper, Flag, Wave, Fish, Rise, Fisheye, Inflate, Squeeze, Twist. Each has horizontal/vertical orientation, bend % and horizontal/vertical distortion %. The same 15 styles are used by Envelope Make with Warp. |

**Photoshop Effects** (raster, rendered at the document raster-effects
resolution). **These can be reused from PhotoSuite:**
Effect Gallery; Artistic (Colored Pencil, Cutout, Dry Brush, Film Grain,
Fresco, Neon Glow, Paint Daubs, Palette Knife, Plastic Wrap, Poster Edges,
Rough Pastels, Smudge Stick, Sponge, Underpainting, Watercolor); Blur (Gaussian
Blur, Radial Blur, Smart Blur); Brush Strokes (Accented Edges, Angled Strokes,
Crosshatch, Dark Strokes, Ink Outlines, Spatter, Sprayed Strokes, Sumi-e);
Distort (Diffuse Glow, Glass, Ocean Ripple); Pixelate (Color Halftone,
Crystallize, Mezzotint, Pointillize); Sketch (Bas Relief, Chalk & Charcoal,
Charcoal, Chrome, Conté Crayon, Graphic Pen, Halftone Pattern, Note Paper,
Photocopy, Plaster, Reticulation, Stamp, Torn Edges, Water Paper); Stylize
(Glowing Edges); Texture (Craquelure, Grain, Mosaic Tiles, Patchwork, Stained
Glass, Texturizer); Video (De-Interlace, NTSC Colors).

**Document Raster Effects Settings:** colour model, resolution (72/150/300/other),
background (white/transparent), anti-alias, type-optimized, create clipping
mask, add N around object, preserve spot colours.

### 5.9 Type

- **Kinds:** point, area (any closed path), on a path (open or closed), their
  vertical variants, threading (in and out ports, overflow indicator), and
  Fill with Placeholder Text.
- **Engine:** single-line and every-line composers, Japanese composers,
  hyphenation (per-language dictionaries, words longer than N, after first N,
  before last N, limit, zone, capitalised words), justification, optical
  margin alignment, roman hanging punctuation, and optical kerning.
- **Fonts:** OpenType (all GSUB and GPOS features exposed in the OpenType
  panel and the in-context alternates widget), variable fonts (axis sliders),
  OpenType-SVG and emoji fonts, a font preview on hover in the menus, font
  filters (classification, favourites, recently added, similar), Find Font
  (replace across the document), Resolve Missing Fonts (local only), and
  substitution highlighting.
- **Glyph features:** Glyphs panel, Touch Type, Snap to Glyph (baseline,
  x-height, glyph bounds, proximity guides, angular guides, anchor point) and
  glyph-bounds alignment (24.3).
- **Text utilities:** Find and Replace (with options), Check Spelling plus
  **Auto Spell Check** (24.0) with local dictionaries (for example Hunspell,
  MPL/LGPL, §9), Change Case, Smart Punctuation, Show Hidden Characters, Create
  Outlines (text becomes compound paths grouped per character), Text Wrap
  (offset, invert), and Legacy Text updates.
- **Styles:** character and paragraph styles with every attribute, style
  overrides and "Clear Overrides".
- **CJK:** tate-chu-yoko, warichu, mojikumi sets, kinsoku sets, burasagari,
  and aki settings, for parity with the East Asian feature set.

### 5.10 Objects, structure and transformation

- **Transform:** Transform panel and dialogs, Transform Again (Ctrl+D),
  Transform Each, Reset Bounding Box, reference-point widget, "scale strokes
  and effects", "transform patterns", the Free Transform widget, and Puppet
  Warp.
- **Align and Distribute:** see §5.3. Key object via a click, and
  distribute-spacing values.
- **Arrange, group, isolation mode:** double-click to isolate, a breadcrumb
  bar, isolating symbols, groups, clip contents and patterns, and "Paste
  Remembers Layers".
- **Pathfinder and Shape Builder:** see §5.3 and §5.2.
- **Blends:** smooth colour / specified steps / specified distance,
  orientation (align to page / path), replace spine, reverse spine and
  front-to-back, expand, and blending between gradients, symbols and groups.
- **Envelope distort:** with Warp (the 15 styles), with Mesh (rows and
  columns), with Top Object. Envelope options: anti-alias, preserve shape
  using clipping mask or transparency, fidelity, distort appearance, distort
  linear gradient fills, distort pattern fills. Edit contents and expand.
- **Perspective:** one-, two- and three-point grids, grid presets, define grid
  (units, scale, gridline every, viewing angle and distance, horizon height,
  third vanishing point, grid colours and opacity), the plane-switching widget
  (with position), drawing in perspective, attaching and releasing, moving a
  plane to match an object, text and symbols in perspective (editable),
  dragging objects along a plane, and snapping.
- **Clipping masks, compound paths, opacity masks** (§5.6).
- **Images:** Crop Image (with crop widget, PPI and optional content-aware
  suggestion *(v)*), Rasterize, Create Object Mosaic (tile size and number,
  gap, result colour/gray, resize by %, delete raster, use ratio), embed and
  unembed, and Image Trace (§6).
- **Global Edit** (23.0): select similar objects (same shape, appearance, size,
  on this artboard or all artboards) and edit them together.
- **Slices, Trim Marks, Make Pixel Perfect, Flatten Transparency.**
- **Artboards:** up to 1000 per document, a maximum size of 227″ × 227″
  normally, and a "large canvas" of 2270″ × 2270″ (100× the area, created
  automatically above 227″; Adobe's 2025 docs; the 2020 sources said 2275″)
  with zoom limited to 0.313–6400 % (24.2), move/copy
  artwork with an artboard, rearrange, convert to artboards, fit to artwork,
  and cut/copy/paste artboards between documents (24.x).
- **Guides, grids and rulers:** ruler guides, guides converted from paths,
  locking, smart guides (alignment, anchor/path labels, object highlighting,
  measurement labels, transform tools, construction guides at angle sets,
  snapping tolerance), grid (gridline every N, subdivisions, grids in back,
  show pixel grid above 600% zoom), and global versus artboard rulers.
- **Lock and hide:** with on-canvas unlock (24.3).

### 5.11 Graphs and data

- Nine graph types (Column, Stacked Column, Bar, Stacked Bar, Line, Area,
  Scatter, Pie, Radar).
- **Graph Type dialog:** value axis position, style (add drop shadow, first
  row in front, first column in front, add legend across top), options (column
  width %, cluster width %, mark data points, connect points, edge-to-edge
  lines, draw filled lines with width), pie options (legend, sort, position),
  value axis (override tick values, min/max/divisions, tick marks, prefix,
  suffix), and category axis.
- **Graph data window:** import data (tab-delimited), transpose, switch x/y,
  cell style, revert, apply.
- **Graph designs:** Column and Marker designs using artwork, with vertically
  scaled, uniformly scaled, repeating or sliding designs.
- Graphs stay live (plugin group) until ungrouped.

### 5.12 Automation

- **Actions:** the panel (§5.3) and `.aia` read and write. `.aia` is a text
  format with nested `/action-N` records and parameter dictionaries. Build a
  new codec, but the replay design comes from PhotoSuite. Also batch
  (source/destination folders, override commands, errors to log).
- **Scripting:** run `.jsx` / `.js` files through the PhotoSuite AST
  interpreter with an **Illustrator ExtendScript DOM**: `app`, `Application`,
  `Document`, `Documents`, `Layer`, `PageItem` (and its subclasses `PathItem`,
  `CompoundPathItem`, `GroupItem`, `TextFrameItem`, `PlacedItem`, `RasterItem`,
  `SymbolItem`, `MeshItem`, `PluginItem`, `GraphItem`, `LegacyTextItem`),
  `PathPoint`, `Artboard`, `Swatch`, `Spot`, `Gradient`, `GradientStop`,
  `Pattern`, `Symbol`, `Brush`, `GraphicStyle`, `CharacterStyle`,
  `ParagraphStyle`, `TextRange`, `Story`, `Characters`, `Words`, `Lines`,
  `Paragraphs`, `InsertionPoint`, `Variable`, `DataSet`, `View`, `Preferences`,
  color classes (`RGBColor`, `CMYKColor`, `GrayColor`, `LabColor`, `SpotColor`,
  `GradientColor`, `PatternColor`, `NoColor`), save and export options classes
  (`IllustratorSaveOptions`, `PDFSaveOptions`, `EPSSaveOptions`,
  `ExportOptionsPNG24`, `ExportOptionsSVG`, …), `ImageCaptureOptions`,
  `TracingOptions` / `TracingObject` (**Image Trace scripting**), `Matrix`
  helpers, `app.executeMenuCommand(id)` with Illustrator's menu command
  strings, `app.doScript` (actions), `ScriptUI` dialogs (a subset), and `File`
  / `Folder` (sandboxed through the host). AppleScript and VBScript are out of
  scope.
- **Variables and data-driven graphics:** see the Variables panel in §5.3.
  Batch export through actions.

### 5.13 Output and colour management

- **Print dialog:** General (copies, collate, reverse, artboards all/range,
  ignore artboards, skip blank artboards, media size, orientation, print
  layers (visible and printable / visible / all), placement, scaling (do not
  scale / fit to page / custom / tile full pages / tile imageable areas)),
  Marks and Bleed (trim, registration, colour bars, page information, printer
  mark type Roman/Japanese, trim mark weight, offset, bleeds), Output (mode:
  composite; separations are host-based *(v: only on PostScript printers)*;
  emulsion, image, printer resolution, convert all spot colours to process,
  overprint black, document ink options), Graphics (paths flatness, fonts
  download, PostScript level, data format, compatible gradient and mesh
  printing), Color Management (profiles, rendering intent, preserve RGB/CMYK
  numbers), Advanced (print as bitmap, overprint and transparency flattener
  options), and Summary. Print presets. Print tiling. The PhotoSuite PDF-based
  print path is the transport.
- **Color Settings:** working spaces, colour management policies, conversion
  options (engine, intent, black point compensation), and the standard presets
  (North America General Purpose 2, …). Implemented with lcms2 (§3.1).
- **Proofing:** Proof Setup and Proof Colors, Overprint Preview, Separations
  Preview, Flattener Preview.

### 5.14 Web and screen

Pixel Preview, align to pixel grid (per object and as a document default),
Snap to Pixel, Make Pixel Perfect, slices and Save Selected Slices, the CSS
Properties panel, the SVG Interactivity panel, Export for Screens and the Asset
Export panel, Save for Web (Legacy), and image maps (Attributes panel).

### 5.15 Recent additions to double-check (CC 2017 → 2020)

| Version | Features |
|---------|----------|
| CC 2017 (21.x) | Pixel-perfect drawing (align to pixel grid, Make Pixel Perfect), Export for Screens / Asset Export, Place Image in Shape *(v)*, Snap to Glyph *(v: listed as 23.0 elsewhere)*, Font Filter / Similar Fonts, Placeholder Text, SVG color fonts, OpenType emoji, Touch Type enhancements. |
| CC 2018 (22.x) | Properties panel, Puppet Warp, variable fonts, multiple artboard enhancements (up to 1000, select and move multiple), Import Multi-page PDF, Stylistic alternates on canvas. |
| CC 2019 (23.x) | Freeform Gradients, Global Edit, customizable toolbar, Presentation Mode, Trim View, Snap to Glyph, content-aware Crop Image, zoom to selection, Visual font browsing. |
| 2020 (24.0) | Simplify path, Auto Spell Check, cloud documents (out of scope), GPU-accelerated rendering improvements, Export Selection improvements. |
| 2020 (24.1–24.2) | Real-time drawing and editing (GPU), enhanced Free Transform, cut/copy/paste artboards between documents, large canvas (2275″), bleed up to 24″. |
| 2020 (24.3) | Glyph-bounds alignment for point and area text, font height variations (Em Box, Cap Height, x-Height, ICF Box), select and unlock objects on canvas. |

Version attribution *(v)* only affects the order of work, not scope. Every
feature listed is in scope.

### 5.16 Additions from v25.0 to v30.1 (2021–2026)

These are in scope unless marked **out** (cloud or generative, §1.2) or
**D5** (an open decision). The version is the release that introduced the
feature; later refinements are listed after it. Compiled on 2026-09-24. The
rows from 29.8 to 30.1 come from Adobe's release notes (fetched into
`.research/` on 2026-09-24 with
`scripts/research/fetch-illustrator-docs.console.js`). The page only goes back
to about 29.8, so rows 25.0–29.7 come from the Wikipedia release table and
Adobe community posts (§10). Every row stays *(v)* until the parity matrix
confirms it against a licensed 30.1.

Releases after 30.1 are **not** targets (D6). They are listed here only so
nobody mistakes them for baseline: 30.2–30.8 (Feb–Aug 2026) add a Blend panel
with easing and colour acceleration (30.7), Align and Distribute shortcuts
and action recording, relinking every instance at once, Absolute and Relative
scaling options, TIFF from Export for Screens, and more generative features.

| Version | Feature | Lands in |
|---------|---------|----------|
| 25.0 (Oct 2020) | Recolor Artwork improvements (the non-generative colour-theme suggestions *(v)*) | §5.6, Phase 3 |
| 25.1 (Jan 2021) | **Repeat** objects: Radial, Grid, Mirror (live, with on-canvas widgets; Object → Repeat) | §5.10, Phase 8 |
| 25.2 (Feb 2021) | Snap to Japanese glyph. Cloud document sharing (**out**) | §5.9 |
| 25.3 (Jun 2021) | **Rotate View** (tool plus View menu), Paste without source formatting (text), Delete Hidden Layers | §5.1, §5.4, Phase 1.5 |
| 26.0 (Oct 2021) | **3D and Materials** (panel, extrude, revolve, inflate, rotate, lighting, materials, ray-traced render; Effect → 3D (Classic) kept), simplified variable-width strokes, text attributes in Select → Same, HEIF/WebP open. Share for commenting and auto font activation (**out**) | §5.8, Phase 7 |
| 26.1–26.3 (2022) | 3D: graphics mapped on 3D objects (26.2), perspective camera, drag graphics to the 3D panel (26.3). AVIF open, **automatic file backup** (26.3) | Phase 7, §5.13 |
| 26.4 (Jul 2022) | **History panel**, bullets and numbering (paragraph formatting) | §5.3, §5.9, Phase 1.3 / Phase 5 |
| 26.5 (Aug 2022) | Warnings for PANTONE colours and Type 1 fonts | §5.6, §5.9 |
| 27.0 (Oct 2022) | **Intertwine** (Object → Intertwine; live, with zone editing), **Quick Actions** (Properties panel), reorganised Actions panel, 3D object export formats. Share for Review (**out**) | Phase 8, Phase 11 |
| 27.1 (Dec 2022) | 3D taper and twist, Image Trace enhancements, real-time colour and opacity preview, bullets and numbering to editable text | Phase 7, Phase 9 |
| 27.3 (Feb 2023) | Easier Intertwine selection areas, Image Trace improvements, reusable asset export settings, end of Type 1 font support | Phase 5, Phase 9, Phase 10 |
| 27.5–27.7 (2023) | Faster Smart Guides and live editing, Image Trace improvements, **search and filter in the Layers panel**, WebP export, hyperlinks kept in exported PDFs. Generative Recolor and Retype (**out** / **D5**) | §5.3, §4.3 |
| 28.0 (Oct 2023) | **Smooth** slider (path smoothing, next to Simplify). Text to Vector Graphic (**out**). Mockup and Retype (**D5**) | §5.5, Phase 4 |
| 28.1 (Dec 2023) | **Dimension tool** (measure and annotate; styles set in the tool options), unembed several images at once, Delete button in the Links panel | §5.2, Phase 8 |
| 28.3 (Feb 2024) | **Live Star** shape, **pinnable Contextual Task Bar**, **enclosing mode** for marquee selection, text-formatting shortcuts (bold, italic, underline), Dimension tool enhancements | §5.1, §5.2, §5.5, Phase 1.5 / Phase 2 |
| 28.4–28.5 (2024) | Improved pan and zoom, automatic relinking of missing files, sort Links by size | §5.3, Phase 1.4 |
| 29.0 (Oct 2024) | **Objects on Path** (tool plus live attachment: spacing, rotation, attachment point, shuffle), **Image Trace: Gradients, Shapes (live circles and rectangles), Transparency, Auto Grouping, fewer anchors**, Reflow Viewer (East Asian text), scale artwork when resizing artboards, gradients created from Swatches or colour groups, Knife tool with Smart Guides, Contextual Task Bar actions (Simplify, Smooth). Text to Pattern, Generative Shape Fill and Project Neo (**out**); Mockup GA (**D5**) | Phase 8, **§6 / Phase 9**, Phase 5, §5.10 |
| 29.7 (Aug 2025) | Improved artboard management, a **Recent Colors** palette, easier gradient use, a **searchable Preferences** dialog, accessibility (screen-reader) improvements | §5.1, §5.6 |
| 29.8 (2025) *(v: version)* | **Snapping overhaul:** Smart Guides snap to an object's endpoint, midpoint and centre. Snap to Grid lets objects sit freely inside grid cells while still snapping to lines and intersections. Snap to Pixel removes half-pixel shifts. The **Snapping Quick Access** panel in the Control bar toggles Snap to Grid, Snap to Pixel, Snap to Point and Smart Guides, and links to snapping preferences (Alignment Guides, Snap to Glyph). Smart Guides detect rotation angles. Snapping can be limited to the active artboard, with snapping to isolated objects. Advanced Smart Guide settings. Also: copy colour values from the Color panel, Color Picker, New Swatch and Swatch Options | §5.1, §5.10, Phase 2 |
| 30.0 (Oct 2025) | Enhanced **font browser** (local-font parts only), enhanced **Color Picker**, **gradient dithering**, **perceptual interpolation** in gradients, gradient presets. Lines snap **tangentially** to arcs and circles, and paths snap **perpendicular** to lines and curves. Both apply at line endpoints only, are controlled by Preferences → Smart Guides → Geometric Guides, and perpendicular works only between straight paths. **Artboard right-click context menu** (Duplicate, Rename, Lock, Export, and so on). Export selected artboards from the canvas. **Lock all objects on an artboard.** **Artboard background colours.** On-canvas artboard labels with in-place rename. Clearer active-artboard border. Enhanced **Save in Background** (faster saves, crash recovery). Lag-free real-time move, scale, rotate and duplicate. A distinct **Hide Grid** widget for the perspective grid. Turntable, Projects, Firefly generation history, Express templates and the generative toolbar and Object → Generative menu (**out**) | §5.1, §5.6, §5.10, Phase 1.5, Phase 3, Phase 10 |
| 30.1 (Dec 2025) | **Convert a solid fill to a gradient** with contextual, colour-aware gradient presets in a dropdown. Fixes that define the baseline: stroke widths no longer change when scaling with Scale Strokes & Effects off; format options in Export for Screens → Export Selection; perceptual gradients no longer exported to PDF at 72 dpi. Partner models in Text to Vector (**out**). Image Trace curve-fitting improvements appeared in the 30.1 beta notes *(v: whether they shipped in 30.1)* | §5.6, §6.4, Phase 3, Phase 9 |

Facts gathered from Adobe's current help pages (Contextual Task Bar contents,
Rotate View, large canvas, Intertwine, Dimension tool, snapping, rulers) are
in `docs/parity/notes-30.1.md`. They seed the parity matrix.

Consequences for the rest of the plan:
- **Image Trace (§6)** now targets the 29.0–30.1 engine and panel, not the
  2020 one. §6.2 gains the Gradients, Shapes, Transparency and Auto Grouping
  options, and the quality bar (§6.8) is 30.1's output, whose curve fitting
  improved in 30.1.
- **3D and Materials** is the largest new item: a ray-traced renderer and a
  materials system. Adobe Substance materials are licensed content (R4), so
  ship original materials.
- **New live objects** stored in `.ai` as plugin groups or art dictionaries:
  Repeat (radial, grid, mirror), Intertwine, Objects on Path, 3D and
  Materials, and Dimension annotations. Add each to the 0.3.5 catalogue.

---

