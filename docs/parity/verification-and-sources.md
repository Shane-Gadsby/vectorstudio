<!-- Migrated from the VectorSuite plan (vectorsuite.md §8-§10), the archived
     Tauri/JS prototype this fork replaces. See docs/decisions/0001-fork-from-vectorcraft.md.
     Values marked *(v)* are unverified against a licensed Illustrator 30.1. -->

## 8. Verification strategy

### 8.1 Parity matrix

- `docs/parity/matrix.csv`, seeded on 2026-09-24 (task 0.4.1) and maintained
  by hand. Its columns are id, area, element_type, element, field, default,
  range, unit, behaviour, since, phase, scope, status, confidence, source,
  test_id, verified_by and verified_date. `docs/parity/README.md` defines
  them and the rules (stable ids; `confidence` records whether a row rests on
  30.x docs, 2020-era text, or verification on a licensed 30.1).
- `npm run verify:parity` checks the schema in CI. `npm run parity:report`
  prints coverage by phase, area, status and confidence.
- Every PR that implements a feature links the matrix rows it satisfies.

### 8.2 Fixture corpora

| Corpus | Contents | Use |
|--------|----------|-----|
| `fixtures/ai/` | `.ai` files by version (3 → 30.1) and feature family, including files made by a licensed Illustrator 30.1 with every live feature (2020-era and §5.16) | Read, round-trip, down-save |
| `fixtures/geom/` | Boolean, offset and outline edge cases, plus a fuzz seed set | Geometry kernel |
| `fixtures/type/` | Scripts, OpenType features, composers, CJK | Text layout |
| `fixtures/trace/` | §6.8 | Image Trace |
| `fixtures/scripts/` | ExtendScript samples | Scripting DOM |

Every fixture must be created by the team or licensed for redistribution.
Illustrator-generated references are produced by the team from its own
artwork.

### 8.3 Test layers

1. **Unit / behavioural** (`node --test`): the PhotoSuite rules apply. Assert
   values, bytes and events, and drive the real implementation.
2. **Rust tests** for `geom` and `trace` (`cargo test`, `proptest`).
3. **Golden render tests:** the reference rasteriser output compared with
   Illustrator's PDF/PNG exports (per-pixel ΔE and SSIM thresholds).
4. **Round-trip tests:** `.ai` read → write → read gives an equal DOM. Write
   → open in Illustrator (manual or scripted on a licensed machine) → save →
   read gives an equal DOM.
5. **UI parity checks:** screenshot comparison of dialogs against reference
   captures (layout, not pixels), plus a matrix field audit.
6. **Performance benchmarks** in CI on reference runners, failing on
   regressions above 10 %.

### 8.4 Reference hardware

- macOS: Apple M1 with 8 GB.
- Windows: 4-core x64 with integrated GPU and 8 GB.
- Linux: the same as Windows (Ubuntu LTS, WebKitGTK).

---

## 9. Risks and open decisions

| # | Risk / decision | Impact | Mitigation / proposal |
|---|-----------------|--------|-----------------------|
| R0 | **PhotoSuite has no licence.** `eolix/photosuite` is public with no LICENSE file, so by default all rights are reserved. VectorSuite pulls PhotoSuite code in at build time (§2.4). | **Blocks public distribution** of any build that contains PhotoSuite code. | Ask the owner for a licence or written permission (task 0.1.7). Until then, use builds locally and privately only. Take third-party vendor code from its own upstreams. As a fallback, replace each pulled module with a clean-room VectorSuite implementation. The manifest is the list of what would need replacing. |
| R1 | **`.ai` private data is undocumented** past the published AI3/AI7 specification (live effects, plugin groups, document data). | Blocks full round-trip. | Phase 0 spikes. Build the corpus from our own artwork. Preserve unknown content verbatim. Start with PhotoSuite's reader, which already decodes the container. |
| R2 | **A licensed Illustrator 30.1 install** is needed for calibration and reference outputs. The copy currently on the development machine is an unlicensed repack and **must not** be used for any of this: fixtures, presets, shortcuts, screenshots or reference traces derived from it would taint the matrix and the corpus. | Parity cannot be verified without it. | Use a Creative Cloud subscription, which offers 30.1 as an installable version. Pin that install (disable auto-update to 30.2 or later). Keep reference outputs internal. **Update 2026-09-24:** a licensed Illustrator 30.1 now runs in a Windows 10 VM (WinBoat). Research probes (`scripts/research/illustrator/*.jsx`) run there, exchange files through `~/Downloads/temp` on the dev machine (the VM's `Z:\temp`), and their raw output goes to the gitignored `.research/`. Rows confirmed this way become `confidence: verified`. |
| R3 | **Trademarks and trade dress.** | Legal. | Never use Adobe names or icons in the product UI. Draw original icons (PhotoSuite uses Tabler icons). Keep the disclaimer. Match behaviour and layout, not artwork. |
| R4 | **Licensed content**: PANTONE and other Color Books, Adobe stock libraries (brushes, symbols, styles, swatches), Adobe PDF presets named after standards, and the arrowhead and profile libraries. Note that PhotoSuite already ships `pantone.aco`, which needs a licence review too. | Legal. | Ship original equivalents. Allow the user to import their own libraries. Standards-based PDF/X presets are fine to reproduce by their technical settings. |
| R5 | **GPL code:** Potrace is GPL-2.0, and this repository is MIT. | Licence violation if Potrace code is copied. | Implement a clean-room version from the published paper. VTracer (MIT) may be used or studied, with attribution. |
| R6 | **Boolean robustness** on curves. | Wrong geometry, crashes. | Rust kernel, exact predicates where feasible, a fuzz corpus, and benchmarking against Paper.js. |
| R7 | **Webview limits**: WebGL2 availability on older macOS WebKit, no `SharedArrayBuffer`, and slow JavaScriptCore integer loops. | Performance. | WASM for hot paths, worker pools with transferable buffers (the PhotoSuite pattern), and a Canvas2D fallback. |
| R8 | **Text engine differences** between Illustrator and PhotoSuite's layout. | Visible reflow when opening `.ai` files. | Phase 5 golden tests against Illustrator PDFs. Keep the stored glyph positions from `.ai` for display until the text is edited. |
| R9 | **Scope size**, since full parity is several person-years of work. | Schedule. | Phases produce usable increments. The parity matrix makes progress measurable. Image Trace runs in parallel. |
| D1 | Code sharing with PhotoSuite. | Maintenance. | **Decided:** standalone repo, with PhotoSuite pulled in at build time from a pinned submodule and no upstream commits (§2.4). |
| D2 | SWF export (listed in Illustrator 2020 Export As). | Low value. | **Resolved by the re-baseline:** 30.x's Export As no longer lists SWF or PICT, so neither is a target. |
| D3 | Rendering backend beyond Canvas2D (WebGPU when webviews support it). | Performance ceiling. | Revisit after Phase 3. |
| D4 | A shared plugin API between PhotoSuite and VectorSuite. | Ecosystem. | Design in Phase 11 on top of PhotoSuite `docs/PLUGINS.md`. |
| D5 | **Retype** (identify fonts in images and outlines) and **Mockup** (place art on photographed objects). Both depend on Adobe ML services *(v: whether they run on-device)*. | Scope. | Exclude by default, like the generative features (§1.2). Revisit if a local model gives acceptable results. Retype's outline-to-live-text half may be possible with local font matching. |
| D6 | **Baseline pinned to v30.1** while Illustrator keeps shipping (30.2 in Feb 2026, and later). | Target drift. | Keep 30.1 fixed until parity. Changes after 30.1 are logged as candidates, not requirements. |

---

## 10. Sources

Adobe's help pages (helpx.adobe.com) refused automated retrieval while this
draft was written. Items marked *(v)* must be confirmed against a licensed
Illustrator 30.1 install (Phase 0.4 and 9.1).

- PhotoSuite source analysis: `document/formats/ai-format.js` (the `.ai`
  container, compression headers, operator set), `docs/ARCHITECTURE.md`,
  `docs/EVENTS-AND-HISTORY.md`, and the folder charters (September 2026).
- Adobe, *Image Trace panel options in Illustrator*:
  https://helpx.adobe.com/illustrator/desktop/manage-objects/traces-mockups-symbols/image-trace-panel-options.html
- Adobe, *Image tracing presets*: https://helpx.adobe.com/illustrator/using/image-trace-presets.html
- Adobe, *Optimize results using Image Trace*: https://helpx.adobe.com/illustrator/using/image-trace-results-optimization.html
- Adobe, *What's new in Illustrator (release notes)*: https://helpx.adobe.com/illustrator/desktop/new-features/release-notes.html
- Wikipedia, *Adobe Illustrator* (release history table, v25–v30): https://en.wikipedia.org/wiki/Adobe_Illustrator
- Adobe Community, *Illustrator 2026 v30.0: Font Browser, Color, Snapping & Artboards Enhancements, Turntable and more*: https://community.adobe.com/t5/illustrator-discussions/illustrator-2026-v30-0-font-browser-color-snapping-amp-artboards-enhancements-turntable-and-more/td-p/15566269
- Adobe Community, *Illustrator MAX 2025 (v29.0): Align object to path, Image Trace, Text to Vector Graphic and more*: https://community.adobe.com/questions-652/illustrator-max-2025-v29-0-align-object-to-path-image-trace-text-to-vector-graphic-and-more-812615
- Adobe Community, *Beta Build 30.1.65 Release Notes*: https://community.adobe.com/t5/illustrator-beta-discussions/beta-build-30-1-65-release-notes/td-p/15548828
- Adobe, *New and enhanced features, 2020 (24.3)*: https://helpx.adobe.com/sea/illustrator/using/whats-new/2020-3.html
- Signs101, *Adobe Illustrator 24.2 (CC 2020) Update*: https://www.signs101.com/threads/adobe-illustrator-24-2-cc-2020-update.159306/
- Signs101, *Adobe Illustrator 24.3 (CC 2020) Update*: https://www.signs101.com/threads/adobe-illustrator-24-3-cc-2020-update.160404/
- Astute Graphics, *Support for Adobe Illustrator 2020 (v24.x)*: https://docs.astutegraphics.com/support/important-information-about-support-for-adobe-illustrator-2020-v24x
- Illustrator How, *Image Trace*: https://illustratorhow.com/image-trace/
- Solopress, *How to use the Image Trace tool*: https://www.solopress.com/blog/tutorials/how-to-use-the-image-trace-tool-in-illustrator/
- Sticker Mule, *How to use Image Trace in Adobe Illustrator*: https://www.stickermule.com/blog/how-to-use-image-trace-in-adobe-illustrator
- Datalogics, *Adobe Illustrator and PDF Compatibility*: https://www.datalogics.com/adobe-illustrator-and-pdf-compatibility
- DEV Community, *Parsing Adobe Illustrator .ai files in the browser with pdf.js*: https://dev.to/kyungju_leebenjie_519b/parsing-adobe-illustrator-ai-files-in-the-browser-with-pdfjs-four-things-the-docs-dont-tell-you-17nk
- File Formats Wiki, *Adobe Illustrator document*: https://fileformats.fandom.com/wiki/Adobe_Illustrator_document
- VisionCortex, *VTracer* (MIT): https://github.com/visioncortex/vtracer · https://www.visioncortex.org/vtracer/
- P. Selinger, *Potrace: a polygon-based tracing algorithm* (2003). This is the algorithm reference only; the code is GPL, see R5.
- P. J. Schneider, *An Algorithm for Automatically Fitting Digitized Curves*, Graphics Gems (1990).
- T. Y. Zhang, C. Y. Suen, *A fast parallel algorithm for thinning digital patterns*, CACM (1984).
- Adobe, *Adobe Illustrator File Format Specification* (AI3/AI7 operator reference, 1998) and the *Illustrator Scripting Reference: JavaScript* (the DOM naming reference for §3.3 and §5.12).
