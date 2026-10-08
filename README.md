<h1 align="center">VectorStudio</h1>

<p align="center">
  <b>A clean-room, open-source reimplementation of Adobe Illustrator in pure Rust — aiming at 1:1.</b>
</p>

<p align="center">
  Runs natively on macOS, Windows, Linux and FreeBSD, and in the browser via WebAssembly.
</p>

<p align="center">
  <img alt="Status: in active development" src="https://img.shields.io/badge/status-in%20active%20development-e8573f">
  <img alt="Written in pure Rust" src="https://img.shields.io/badge/pure-Rust-b83a24?logo=rust&logoColor=white">
  <img alt="MCP server for agents" src="https://img.shields.io/badge/agents-MCP%20server-555555">
  <img alt="License: MIT OR Apache-2.0" src="https://img.shields.io/badge/license-MIT%20OR%20Apache--2.0-555555">
</p>

<p align="center">
  <img src="docs/images/shot-1-neon.png" alt="Editing the Neon Drive poster: the title is selected, the Appearance panel shows the settings of its live Outer Glow, and the Properties panel shows its character settings" width="100%">
  <br><sub><b>Neon Drive</b>: a Pathfinder-cut sun, live Outer Glow on the type and grid, and clipping masks · <code>examples/neon-drive.vectorcraft</code></sub>
</p>

> **VectorStudio is a fork of [VectorCraft](https://github.com/storytold/vectorcraft)** by the
> ArtCraft team and community, used under its MIT OR Apache-2.0 licence. It is not an ArtCraft
> product and is not affiliated with, sponsored by or endorsed by them. What this fork adds is a
> stricter goal and the research to pursue it — see
> [`docs/decisions/0001-fork-from-vectorcraft.md`](docs/decisions/0001-fork-from-vectorcraft.md).

## What makes this different

Upstream aims at Illustrator parity "and beyond". **VectorStudio aims at 1:1** — the same defaults,
ranges, units, shortcuts and modifier keys, so a power user cannot tell the difference. Two things
back that up:

**A parity matrix as the source of truth.** [`docs/parity/matrix.csv`](docs/parity/matrix.csv) holds
1,826 in-scope rows — one per observable behaviour, down to each dialog field's default, range and
unit — of which **1,016 were verified against a licensed Illustrator 30.1**, not inferred from
documentation. `cargo xtask parity` validates it and refuses to let a row count as done unless it
cites the code that satisfies it, so coverage cannot be inflated. See
[`docs/parity/README.md`](docs/parity/README.md).

**Native `.ai` as a goal, not an exclusion.** Upstream reads and writes the PDF-compatible half of
`.ai` and declares the native `AIPrivateData` art-operator stream out of scope by design. This fork
treats real, round-trippable `.ai` as a target; the format research is in
[`docs/ai-format/`](docs/ai-format).

## A look around

<table>
<tr>
<td width="50%" valign="top">
  <img src="docs/images/shot-2-ribbons.png" alt="Three live blend ribbons clipped to the artboard, one selected with its key paths showing; the Layers panel lists the clip group, the blends and the selected blend's two key paths" width="100%">
  <p align="center"><sub><b>Live Blends and Layers</b>: editable key paths, smooth colour, every object a row</sub></p>
</td>
<td width="50%" valign="top">
  <img src="docs/images/shot-4-bezier.png" alt="Direct Selection tool showing anchor points and Bézier handles on a crescent built with Pathfinder, with the contextual task bar below it" width="100%">
  <p align="center"><sub><b>Pen and Direct Selection</b>: real Bézier anchors and handles, plus a contextual task bar</sub></p>
</td>
</tr>
<tr>
<td width="50%" valign="top">
  <img src="docs/images/shot-5-perspective.png" alt="Two lit building facades drawn on the left and right planes of a two-point perspective grid at sunset, with the Perspective Selection tool and the Plane Switching Widget" width="100%">
  <p align="center"><sub><b>Perspective Grid</b>: art attached to its planes stays editable in perspective</sub></p>
</td>
<td width="50%" valign="top">
  <img src="docs/images/shot-3-sheet.png" alt="Four artboards in the light UI theme: Pathfinder, Gradient Mesh, radial Repeat and Envelope Distort" width="100%">
  <p align="center"><sub><b>Multiple artboards, light theme</b>: Pathfinder · Gradient Mesh · live radial Repeat · Envelope Distort</sub></p>
</td>
</tr>
</table>

Every image above was produced through the command API — the same one the MCP server exposes to
agents — and exported by the project's own renderer. The source files are in [`examples/`](examples).

## Quick start

```sh
cargo run --release -p vectorcraft                          # desktop app
cargo run --release -p vectorcraft -- examples/dusk-poster.vectorcraft
cargo run --release -p vectorcraft -- --control 7979        # + JSON control channel
cargo run --release -p vectorcraft-cli -- mcp               # MCP server (stdio)
cargo run --release -p vectorcraft-cli -- run --in examples/ribbons.vectorcraft --export out.pdf   # headless batch
cargo run --release -p vectorcraft-cli -- bench examples/neon-drive.vectorcraft                    # render timing
cargo xtask bundle                                          # dist/VectorStudio.app (macOS)
cd apps/vectorcraft-web && trunk build --release             # web build → dist/web
cargo xtask ci                                              # fmt, clippy, tests, assets, brands, parity, layers, wasm
```

Crate and package names keep their upstream `vectorcraft` spelling on purpose, so that
`git merge upstream/main` stays cheap. Only what a user reads is rebranded.

Japanese, Simplified Chinese and Arabic fonts come from
[storytold/craft-fonts](https://github.com/storytold/craft-fonts), an optional build input: `CRAFT_FONTS_DIR="$PWD/../craft-fonts" cargo run --release -p vectorcraft`
(an absolute path). Without it, those scripts use the installed system fonts. See
[`docs/development.md`](docs/development.md#fonts-craft-fonts-optional-build-input).

On laptops with two graphics processors, the power-saving (integrated) one is used by default. For
the discrete one, choose **Preferences › Performance › Graphics Processor › High Performance** and
restart, or start with `WGPU_POWER_PREF=high`
(see [`docs/development.md`](docs/development.md#desktop-graphics-processor)).

### Use it from Claude Code and other agents

```sh
claude mcp add vectorstudio -- /path/to/vectorcraft-cli mcp
```

Every command, gesture and dialog is drivable over MCP, the CLI and the control channel. Details in
[`docs/mcp.md`](docs/mcp.md) and [`docs/control-protocol.md`](docs/control-protocol.md).

For the experimental, unsupported 64-bit Windows 7 build, see [Windows 7 instructions](docs/windows7.md).

## Status

[**ROADMAP.md**](ROADMAP.md) covers what ships today, the milestones and time-to-parity estimates;
the [honest assessment](ROADMAP.md#honest-assessment-2026-10-05) explains how far to trust the
numbers. Inherited from upstream as of the fork: roughly **69–75% of Illustrator's feature
surface**, and about **40–55%** on "a power user can't tell the difference" — both self-assessed
upper bounds.

Everyday vector illustration works: drawing and path tools, Pathfinder and Shape Builder, paint,
gradients, appearance and transparency, type with styles, threading and Hebrew/Arabic bidirectional
layout, and files (SVG, PDF and PDF-compatible `.ai` with PDF/X, EPS, DXF, EMF/WMF, raster formats,
PSD, Print, Package). The interface speaks English, Japanese, Traditional and Simplified Chinese and
Spanish, with Czech and Brazilian Portuguese in the menus.

**Missing:** 3D and Materials; the Photoshop-style raster effects; CJK composition for vertical
type; Variables and scripting; an interaction-fidelity pass covering every tool's modifiers; and
Windows and Linux packaging.

**This fork's order of work:**

1. **Re-baseline the parity matrix against the existing engine.** It reports `done 0/1826` because
   it was written against a different prototype. This replaces the self-assessment above with a
   row-level audit, and it gates every honest claim made after it.
2. **Native `.ai` private data** — the `AIPrivateData` reader and writer, in its own crate.
3. **The interaction-fidelity pass**, driven row by row from the verified matrix and the shortcut
   baselines. Upstream's own top-priority gap, and what a power user notices first.

**Workspace:** `crates/{geom, color, doc, pathops, text, effects, trace, brush, render, svg, pdf,
eps, cad, metafile, format, tools, engine, ui-egui, mcp, testkit}` and
`apps/{vectorcraft, vectorcraft-cli, vectorcraft-web}`. The egui frontend is its own crate, so the
UI can be swapped without touching the engine.

Contributor and agent rules — clean-room, the asset policy, no panics in shipped code, the parity
discipline, quality gates — are in [`AGENTS.md`](AGENTS.md).
[`docs/development.md`](docs/development.md) explains how crashes are avoided and
[`docs/releasing.md`](docs/releasing.md) how releases are built. Every bundled asset is listed with
its licence in [`ASSETS.md`](ASSETS.md).

## License and credits

VectorStudio is dual-licensed under [MIT](LICENSE-MIT) or [Apache-2.0](LICENSE-APACHE), at your
option. Required notices are in [NOTICE](NOTICE).

Copyright (c) 2026 ArtCraft Team and the VectorCraft contributors, and (c) 2026 the VectorStudio
contributors. This fork is based on [VectorCraft](https://github.com/storytold/vectorcraft); the
ArtCraft name, wordmark and logos are ArtCraft trademarks and were removed when the fork was taken,
as that project's brand licence requires.

Bundled fonts, icons, images and other assets keep their own open licences; each is listed with its
author, source and licence in [ASSETS.md](ASSETS.md). Release builds also embed the fonts of
[craft-fonts](https://github.com/storytold/craft-fonts/blob/main/ATTRIBUTION.md) (Japanese,
Simplified Chinese and Arabic faces; SIL Open Font License 1.1).

<sub>Adobe, Photoshop, Illustrator, Acrobat and InDesign are trademarks or registered trademarks of
Adobe Inc. in the United States and/or other countries. VectorStudio is an independent, open-source
project and is not affiliated with, sponsored by or endorsed by Adobe Inc.; these names are used
only to describe the workflows it is compatible with and the behaviour it reproduces.</sub>
