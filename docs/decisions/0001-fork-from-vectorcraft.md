# 0001 — VectorStudio forks VectorCraft; the VectorSuite prototype is archived

- **Date:** 2026-10-08
- **Status:** accepted
- **Decided by:** the project owner

## Context

Two independent clean-room Illustrator reimplementations existed side by side.

**VectorSuite** (`Shane-Gadsby/vectorsuite`, archived) was a Tauri v2 shell with a raw ES-module
frontend, reusing the sister product PhotoSuite's shell, codecs and text engine, with Rust in WASM
for the hot paths. Its distinguishing goals were **100% 1:1 parity with Illustrator 30.1** and
**native, round-trippable `.ai` files** — reading and writing the real `AIPrivateData` art-operator
language, not just the PDF-compatible half.

After roughly a phase of work it had: a Tauri host with an empty window, static-analysis gates, a
PhotoSuite submodule and sync, and — the part that mattered — **research**: a 1,857-row parity
matrix with 1,016 rows verified against a licensed Illustrator 30.1, shortcut and menu baselines
probed from that install, `.ai` container and art-operator format notes, 45 reference fixtures, and
a working ExtendScript research bridge to the licensed VM. No application code of consequence:
~6,900 lines of JavaScript, almost all of it gates and scripts.

**VectorCraft** (`storytold/vectorcraft`, MIT OR Apache-2.0) was, on the same date, a 268,000-line
pure-Rust workspace with 3,579 tests, a working app on macOS and the web, ~70% of Illustrator's
feature surface, daily commits and outside contributors. Its architecture matched what VectorSuite
wanted structurally — engine/UI split, clean-room discipline, an Image Trace built from the
Selinger paper rather than Potrace's GPL code, unknown-data preservation in the native format —
and its licence permitted adoption.

It differed in exactly two ways that mattered:

1. **Native `.ai` private data is out of scope by design** (`ROADMAP.md`). Its `.ai` writer emits a
   PDF plus its own JSON payload, so files round-trip with VectorCraft, not with Illustrator.
2. **Its parity bar is looser and its research is not public.** It targets "a power user can't tell
   the difference" and self-grades that at 40–55%, with interaction fidelity at 30–40% and no
   side-by-side session against the reference app yet. The behaviour docs those grades were
   measured against live in a gitignored `plan/` directory.

Both of those gaps are precisely what VectorSuite's research filled.

## Decision

**Fork VectorCraft as VectorStudio and carry the VectorSuite ideals into it.** The VectorSuite
repository is archived; no code moves across, because none was worth moving. The research does.

Three sub-decisions settled at the same time:

### Track upstream; rebrand the surface only

Crate names (`vectorcraft_geom`), module paths, the `.vectorcraft`/`.drawcraft` format ids, the
`"ai"` save-format id and every on-disk and on-the-wire identifier **stay as they are**. Only
display strings change: the app name, bundle identifiers, homepage URLs, packaging metadata and the
MCP server title.

The reason is arithmetic. Upstream is committing daily toward the same goal; a full rename would
conflict across hundreds of files on every pull and would, in practice, end our ability to take
their work. A surface rebrand keeps `git pull upstream main` close to trivial, so upstream's
progress keeps arriving for free while our additions sit on top.

This also follows the existing wire-format rule: **format identifiers are not branding.**
`%VectorCraft_BeginData` in the EPS writer, the `.vectorcraft` extension and the recovery-store
layout are compatibility surfaces. Renaming them would strand files and recovery copies that
VectorCraft wrote. They keep their names; only `%%Creator` and the like change.

### Keep the parity data in this fork, for now

`docs/parity/` is not upstreamed yet. It costs nothing to hold, and it is the one asset upstream
most lacks. Revisit once it has demonstrably driven fidelity fixes; contributing the derived
behaviour fixes upstream, while keeping the matrix as our source of truth, is the likely
middle path.

### Foundations first

Migrate the research, encode the discipline as an enforced gate, and merge the project rules —
before writing features — so that every later parity claim is auditable.

## Consequences

**Gained immediately:** a working application with ~70% of Illustrator's feature surface, 3,579
tests, SVG/PDF/EPS/DXF/EMF/PSD interop, an MCP automation surface, native builds for four platforms
and a web build. Also an end to the licence blocker that made VectorSuite unpublishable: no
unlicensed PhotoSuite code is pulled into the build, so releases become possible.

**Given up:** the Tauri + ES-module architecture, the PhotoSuite lineage (its shell, codecs and
text engine are no longer reused), and the VectorSuite scaffolding and static gates. This is only
the wrong trade if reusing PhotoSuite's engine was itself a requirement rather than a means; it was
a means.

**Carried across:**

| From VectorSuite | To here |
|---|---|
| Parity matrix, shortcut and menu baselines, feature inventory, Image Trace spec | `docs/parity/` |
| `.ai` container, art-operator, text-document and live-feature notes | `docs/ai-format/` |
| Licensed-30.1 research bridge and probes | `research/` |
| Reference `.ai` fixtures (Adobe-contaminated) | `fixtures/ai/`, **gitignored, never published** |
| The parity gate and the verification vocabulary | `cargo xtask parity`, in `cargo xtask ci` |
| Wire-key, preserve-unknown, R2 and asset rules | `AGENTS.md` |

**Still owed**, in order:

1. **Re-baseline the matrix against this codebase.** It reports `done 0/1826` because it was
   written against an empty prototype. This is the task that turns upstream's self-assessment into
   a row-level audit, and it gates every honest claim we make afterwards.
2. **Native `.ai` private data** — the `AIPrivateData` art-operator reader and writer upstream
   declared out of scope, as its own crate behind the existing `.ai` save path. Every reader change
   needs a writer change and a round-trip test; unknown operators and dictionary keys are preserved
   verbatim, never dropped.
3. **The interaction-fidelity pass**, driven row by row from the verified matrix and the shortcut
   baselines. It is upstream's own top-priority gap and the thing a power user notices first.
4. **Finish the identity split.** The display-name rebrand and the ArtCraft mark removal are done;
   what remains is the *identity*: `CFBundleIdentifier`, the Linux desktop/metainfo file names and
   the Windows install GUIDs still read `ai.storyteller.vectorcraft`, so a VectorStudio build would
   collide with an installed VectorCraft on the same machine. Also owed: our own app icon (the
   engraved dragon is upstream's original artwork — MIT-licensed and attributed, so usable, but it
   is their product's face), and a signing identity.

### The brand licence

Upstream's `docs/brand/LICENSE-brand.txt` required forks to remove the ArtCraft marks. That was
done when the fork was taken: `docs/brand/` is deleted, the ArtCraft website, app-page and Discord
links are gone from the Help menu, the About box and the app bar, `NOTICE` and `README.md` carry
the plain-text "based on VectorCraft" credit that the licence permits instead, and `ASSETS.md` no
longer claims a trademark exception. The app icon under `assets/app-icon/` is separate: it is
MIT OR Apache-2.0 original artwork, kept with its attribution.

The display-name rename follows the same rule set:

- **Changed:** window title and app-bar label, About box, Welcome screen, menu labels, dialog and
  error prose, MCP server title and tool descriptions, EPS `%%Creator`, PDF/TIFF/EMF producer
  metadata, packaging display names, the macOS bundle layout, and the three translation catalogs.
- **Left alone, deliberately:** `%VectorCraft_BeginData`/`_EndData` (EPS private-data markers),
  `"VectorCraft editing data"` (the PDF `PieceInfo` description that finds our own embedded
  document), `"VectorCraft Default"` (a stored PDF preset name), `"VectorCraft Generic CMYK"` (a
  profile name stored in documents), `~/Documents/VectorCraft Templates` (user data), and every
  lowercase `vectorcraft` crate name, module path and format id.
- **Migrated rather than broken:** preferences are now read from `VectorStudio`, then `VectorCraft`,
  then `DrawCraft`, and `LEGACY_PRESETS` maps the old shortcut-set names forward, so no setting is
  orphaned by the rename.
