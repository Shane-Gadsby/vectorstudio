# Handoff: where VectorStudio is up to (2026-10-08)

Read this first when you pick the work up in a new session. Then `AGENTS.md` (the rules),
[`docs/decisions/0001-fork-from-vectorcraft.md`](decisions/0001-fork-from-vectorcraft.md) (why this
repo exists) and [`docs/parity/README.md`](parity/README.md) (how 1:1 is measured).

## 1. Where we are

- **Repo:** `Shane-Gadsby/vectorstudio`, a fork of `storytold/vectorcraft` taken 2026-10-08.
  Default branch `main`, remote `upstream` points at VectorCraft with its **push URL disabled**.
- **Branch:** `main`, clean, at `160c7e3`, pushed. Four commits sit on top of the fork point
  (`4f159b9`, upstream's PR #376). No PRs open.
- **Goal:** a **100% 1:1 reimplementation of Illustrator 30.1** — same defaults, ranges, units,
  shortcuts and modifier keys. Not "the same feature list".
- **Checks at handoff:** `cargo clippy --workspace --all-targets -- -D warnings` clean;
  `assets`, `brands`, `layers` and `parity --strict` gates all pass; workspace tests pass except
  one **pre-existing** failure (below).

### The one failing test is not ours

`crates/pdf/tests/system_fonts.rs :: a_fresh_session_resolves_pdf_fonts_to_installed_families`
fails on this machine. It resolves PDF base fonts against whatever fonts are installed, so it is
environment-dependent. **Confirmed failing identically on the untouched upstream tree** (stash and
run it if you doubt this). Don't chase it; don't count it as a regression.

### Parity, as measured

`cargo xtask parity` is the source of truth. At handoff:

```
1857 rows, 1826 in scope
done 15 (0.8 %), partial 319 (17.5 %), n/a 90, planned 1433
confidence: verified 1016, plan-2020 564, doc-30 200, unverified 77
```

**Prefer this to every number in `ROADMAP.md`'s tables.** Those are upstream's self-assessment
(~69–75 % of the feature surface, 40–55 % on "a power user can't tell the difference"), graded by
the agents that wrote the features, and the whole point of the matrix is to replace them.

- `done` = implemented, matching 30.1, with a test. Only the 15 Window panel function keys so far.
- `partial` = the command exists and is wired to the right menu path. **Nothing more** — it says
  nothing about fields, defaults, ranges or units.
- 1,016 rows were verified against a **licensed** Illustrator 30.1. Those are the valuable ones.

## 2. What exists that did not before the fork

| | |
|---|---|
| `docs/parity/` | the matrix, shortcut and menu baselines, feature inventory, Image Trace spec, `open-questions.md` |
| `docs/ai-format/` | container, art-operator, text-document and live-feature notes for native `.ai` |
| `research/` | the licensed-30.1 ExtendScript bridge and the `.ai` format probes (Node 25+) |
| `fixtures/ai/` | 45 reference `.ai` files — **gitignored, must stay so** (see §5) |
| `cargo xtask parity` | validates the matrix; a `done`/`partial` row must cite `impl_ref` |
| `cargo xtask parity --audit [--write]` | joins the matrix to the app's real menu surface |
| `crates/ui-egui/examples/dump-surface.rs` | dumps that surface as JSON |

Everything else is upstream's, and most of it is very good: 268k lines of Rust, ~2,250 tests, a
working app on macOS and the web, SVG/PDF/EPS/DXF/EMF/PSD interop, an MCP automation surface.

## 3. Next tasks, in order

The full programme with rationale is in `ROADMAP.md` → "The parity programme (VectorStudio)". In
short:

### 1. Resolve the matrix's own errors — **blocks every coverage figure**

`docs/parity/open-questions.md` items 1–4. **Needs the licensed VM.** Nothing else here is
blocked on it, but every percentage above carries known errors until it lands.

- **39 duplicated row pairs (78 rows).** Two sources merged without de-duplication, so the
  in-scope denominator is overstated ~2 %. `cargo xtask parity --audit` lists them under "claimed
  by more than one row". Resolve by keeping the row with the full menu path and setting its twin
  to `scope: out` with a pointer — **never delete a row**, ids are cited in commit messages.
- **Four `verified` rows the app contradicts**, all looking like mis-extraction rather than app
  defects: `MENU-0089` (Hide > Selection claims `Ctrl+2`, which `MENU-0084` Lock > Selection also
  claims), `MENU-0316` (Show Grid claims `Shift+Ctrl+I`, which Adobe's table gives to perspective
  grid), and `MENU-0309`/`MENU-0310` (the perspective-grid pair). Check whether a single off-by-one
  in the source explains several of them.

### 2. Bind shortcuts the audit finds missing — *done for the panels*

The 15 `Window → <panel>` function keys landed 2026-10-08; seven were unbound. The only two
candidates left are `MENU-0309`/`MENU-0310`, **held deliberately** behind item 1: implementing a
mis-extracted row is worse than leaving it unbound, because it takes the key from whatever really
owns it and makes the matrix wrong twice.

### 3. Extend the audit past the menus — **the biggest measurable win, needs nothing**

918 in-scope rows are not `element_type: menu` and no join covers them, so they are invisible to
every figure: panels 372, features 174, tools 136, effects 117, dialogs 61, preferences 39,
presets 29, formats 21. Each needs its own ground truth — `state::all_panels`,
`vectorcraft_tools::catalog`, the effect registry, `prefs.list`. **Do panels and tools first**:
they are the largest blocks and both have a real registry to join against.

### 4. Research the 175 path-less rows

`area: Menus/(path unknown)` came from a source with no menu path, so they cannot be joined at all
and can never move off `planned`. `research/illustrator/probe-menus.ps1` dumps every menu command
and its path from a licensed install. Needs the VM.

### Then

The interaction-fidelity pass proper (modifiers, cursors, per-context Properties panel, isolation
mode), driven row by row. And the native `.ai` `AIPrivateData` reader/writer, which upstream
declares out of scope and which is this fork's other reason to exist — reader and writer change
together, unknown operators are preserved verbatim, every change needs a round-trip test.

## 4. Merging upstream

Upstream is active and **already 49 commits ahead** (it is at PR #395; we forked at #376). The
whole surface-only rebrand decision exists to keep this cheap, and **it holds** — a dry run of the
first merge produced only **6 conflicts**, all mechanical:

| File | Why |
|---|---|
| `README.md`, `ROADMAP.md` | we rewrote them |
| `crates/ui-egui/src/i18n/ja.tsv` | our renamed strings vs their new Japanese entries |
| `crates/ui-egui/src/shortcuts.rs` | our new test sits next to one of theirs |
| `packaging/macos/Info.plist.in`, `xtask/src/bundle.rs` | rebranded display strings on lines they also touched |

**The first real merge has not been done.** Do it early rather than letting 49 become 200. After
merging, re-run `cargo xtask parity --audit`: upstream adds menu entries, so coverage moves.

Keep merges cheap by holding the line in `AGENTS.md`: crate names, module paths, format ids and
every on-disk/on-the-wire identifier stay at their upstream `vectorcraft` spelling. Only what a
user reads is rebranded.

## 5. Rules that bind every session

- **Never push to `upstream`.** Its push URL is disabled; keep it that way. Contributing back is a
  separate, deliberate decision (currently: keep `docs/parity/` in this fork for now).
- **Verified behaviour comes from the licensed 30.1 VM only.** The install at `../illustrator/` is
  an **unlicensed repack** — never read its presets, shortcuts, resources, binaries or outputs, and
  never make fixtures or reference outputs from it.
- **`fixtures/ai/` and `.research/` stay gitignored.** Those files carry Adobe's bundled startup
  content and the author's user name; this is a public repo. `cargo xtask assets` lists `.ai` as an
  asset extension, so an accidental commit fails the build.
- **Never reintroduce the ArtCraft marks.** Upstream's brand licence requires a fork to remove
  them; `docs/brand/` is gone and `NOTICE`/`README.md` carry the plain-text "based on VectorCraft"
  credit it permits instead.
- **A wrong `verified` row is worse than an unverified one**, because it gets implemented
  faithfully. Resolve disagreements on the VM, never by inference from another implementation or
  from memory.
- Clean-room throughout: behaviour from observation and public docs, never Adobe assets, wording
  beyond feature names, or GPL/AGPL code. The tracer is clean-room from Selinger's paper.

## 6. How the audit works, and how it can lie to you

`cargo xtask parity --audit` joins the matrix to the menu tree from
`cargo run -p vectorcraft-ui-egui --example dump-surface`. The menu tree is the honest source for
"does this exist" — it has the real paths and labels and marks stubs `Item::Todo`. The engine
registry alone is **not** enough: commands the UI owns (`file.open`, which needs a file picker)
carry no menu path, and a registry-only join matched nothing at all.

It also compares every `field: Shortcut` row with the key the app binds (folding `Cmd`→`Ctrl`,
`Opt`→`Alt`, ignoring modifier order). Currently **95 agree, 2 disagree, 2 unbound**.

**It has already lied once.** The first run reported 17 unbound panel shortcuts. It was reading
each row's shortcut from the *command* spec, but every Window entry runs the one parameterised
`window.panel {panel}` command, so the eight panels that already had bindings looked unbound — it
invented seven rows of work that did not exist. It now resolves each item's own key through
`menus::item_shortcut`. **When a number looks surprising, check what the audit measured before
believing it.**

Two things it deliberately cannot do:

- **It can never produce `done`.** `partial` is the ceiling, because agreement on existence says
  nothing about fields and defaults. Promotion to `done` is hand work: verify the field, write a
  test, cite both. `cargo xtask parity --strict` enforces the test.
- **It cannot say which side of a disagreement is wrong.** The first run's two disagreements were
  both our data, not the app.

## 7. Useful commands

```sh
cargo xtask parity                 # the gate and the coverage report
cargo xtask parity --strict        # also: a `done` row must cite a test
cargo xtask parity --audit         # what the app's surface says about each row (read-only)
cargo xtask parity --audit --write # apply the conclusions that need no judgement
cargo xtask ci                     # fmt, clippy, tests, assets, brands, parity, layers, wasm
cargo run --release -p vectorcraft # the app
cargo run -q -p vectorcraft-ui-egui --example dump-surface   # the menu surface as JSON

# research (Node 25+; the VM must be running vs-bridge.ps1)
node research/illustrator/run-job.mjs <script.jsx> --args '<json>'
```

Jobs reach the VM through `~/Downloads/temp/jobs` (`Z:\temp\jobs` inside it). Check the agent is
alive before planning any VM work.

## 8. History

| | |
|---|---|
| `7a86588` | Foundations: the parity research, the `parity` gate, the rules merged into `AGENTS.md` |
| `501d126` | Rebrand to VectorStudio; ArtCraft marks removed (a licence obligation, not cosmetics) |
| `f3e09e6` | Re-baseline the menu rows; the audit, and the matrix's own errors found |
| `160c7e3` | The Window panel function keys bound; the audit's blind spot fixed |

The archived VectorSuite prototype is at `../vectorsuite`. **Its `CLAUDE.md` and `vectorsuite.md`
are stale** — they describe the abandoned Tauri + ES-module + PhotoSuite architecture. Nothing
there is needed; its research was migrated in `7a86588`.
