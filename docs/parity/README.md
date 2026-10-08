# Parity: the 1:1 reference

VectorStudio's goal is a **100% 1:1 reimplementation of Adobe Illustrator 30.1** — not "a vector
editor with the same features", but the same defaults, the same ranges, the same units, the same
shortcuts and the same modifier behaviour, so that a power user cannot tell the difference.

This directory is the source of truth for what that means. It came from the archived VectorSuite
prototype (see [`../decisions/0001-fork-from-vectorcraft.md`](../decisions/0001-fork-from-vectorcraft.md)),
whose one real asset was this research: **1,016 of 1,826 in-scope rows were confirmed against a
licensed Illustrator 30.1**, not inferred from documentation or memory.

## What's here

| File | What it is |
|---|---|
| [`matrix.csv`](matrix.csv) | **The matrix.** One row per observable behaviour: 1,857 rows, 1,826 in scope. Validated and reported by `cargo xtask parity`. |
| [`illustrator-inventory.md`](illustrator-inventory.md) | The narrative feature inventory the matrix was built from (2020 base plus v25–v30.1 deltas). |
| [`image-trace-spec.md`](image-trace-spec.md) | Full Image Trace specification, steps T0–T13, with the clean-room constraint. |
| [`shortcuts-30.1.csv`](shortcuts-30.1.csv) | Keyboard shortcuts read out of a licensed 30.1 install. |
| [`shortcuts-default.csv`](shortcuts-default.csv) | The published default-shortcut table, for cross-checking the above. |
| [`menu-commands-30.1.csv`](menu-commands-30.1.csv) | Every menu command and its path, probed from a licensed 30.1. |
| [`notes-30.1.md`](notes-30.1.md) | Observations that don't fit a row yet. |
| [`open-questions.md`](open-questions.md) | What the re-baseline proved is wrong somewhere, awaiting a licensed-VM probe. |
| [`verification-and-sources.md`](verification-and-sources.md) | How claims get verified, the open risks, and the source list. |

## The matrix

One row per thing a user can observe. A dialog with eight fields is eight rows, because 1:1 means
each field's default, range and unit is right — not just that the dialog exists.

Columns, in order:

`id`, `area`, `element_type`, `element`, `field`, `default`, `range`, `unit`, `behaviour`,
`command_id`, `since`, `phase`, `scope`, `status`, `confidence`, `source`, `test_id`,
`verified_by`, `verified_date`, `impl_ref`

Three of them carry the discipline:

**`scope`** — `in` (counts toward 1:1) · `out` (excluded by decision, e.g. generative-AI and cloud
features) · `deferred` (in scope, postponed).

**`status`** — `planned` · `partial` · `done` · `n/a` (needs no code: a note or a heading).

**`confidence`** — how far to trust the behaviour claim:

| Grade | Means |
|---|---|
| `verified` | Confirmed against a **licensed** Illustrator 30.1 via [`../../research/illustrator/`](../../research/illustrator). Must cite `verified_by` and `verified_date`. |
| `doc-30` | From Adobe's public 30.x documentation. Trustworthy for what exists, weak on defaults and ranges. |
| `plan-2020` | Written against Illustrator 2020 and not yet re-checked against 30.1. **Assume it may be stale.** |
| `unverified` | A claim we have not substantiated. Marked `*(v)*` in the prose docs. Never rely on one. |

A `plan-2020` or `unverified` row is a **research task**, not a specification. Promote it to
`doc-30` or `verified` before building against it.

## The gate

```sh
cargo xtask parity            # validate + report (runs as part of `cargo xtask ci`)
cargo xtask parity --strict   # additionally: every `done` row must cite a test
```

It fails on anything that would quietly rot the matrix: an unexpected header, a ragged row, a
duplicate `id`, a value outside the vocabularies above, a `verified` row with no `verified_by` or
`verified_date`, and — the important one — **a `done` or `partial` row with an empty `impl_ref`**.

That last rule is why the matrix can be trusted as a progress measure. Coverage cannot be raised
by editing a column; a row only counts once it names the code that satisfies it. Upstream
VectorCraft grades itself at "69–75% of the feature surface, 40–55% on *a power user can't tell
the difference*", honestly labelling those self-assessed upper bounds graded by the agents that
wrote the features. The matrix is how we replace that with something auditable.

## Working against it

1. **Pick rows, not features.** A task is "satisfy `TOOL-0112`–`TOOL-0119`", not "do the Pen tool".
2. **Check the confidence grade first.** If the rows are `plan-2020`, re-verify them against a
   licensed 30.1 before writing code — otherwise you implement Illustrator 2020.
3. **Build it, test it, cite it.** Set `impl_ref` to the code and `test_id` to the test. A row with
   neither is not done, whatever the UI looks like.
4. **Cite the rows in the commit message**, so a reviewer can check the claim.

### Re-baselining against existing code

The matrix was written against an empty prototype, while this codebase already implements a large
part of Illustrator, so every row started `planned`. Re-baselining replaces that with evidence.

```sh
cargo xtask parity --audit            # report what the app's real surface says about each row
cargo xtask parity --audit --write    # apply the conclusions that need no judgement
```

The audit joins the matrix to the app's **menu tree**, dumped by
`cargo run -p vectorcraft-ui-egui --example dump-surface`. The menu tree is the honest source for
"does this exist": it carries the real paths and labels, and marks placed-but-unimplemented entries
`Item::Todo`. The engine registry alone is not enough — commands the UI owns, like `file.open`,
which needs a file picker, carry no menu path of their own.

| Evidence | Conclusion |
|---|---|
| the row's menu path is a wired command | `partial`, with `impl_ref` = the command id and where it is defined |
| the row's menu path is an `Item::Todo` | stays `planned` — it is in the menu but does nothing |
| the row names a submenu that real items sit under, and specifies no field of its own | `n/a` |
| nothing matches the path | left alone |

`impl_ref` points at the definition, not a mention. A command id appears in many files — the menu
wiring, dialogs, the control channel — so the audit looks in `crates/engine/src/cmd/` first (where
rustfmt leaves the id as a lone literal in its `cmd!` invocation), then `UI_COMMANDS` in
`menus.rs`, then the rest of the frontend.

**The audit can never produce `done`, by design.** `partial` means *the command exists and is wired
into the right menu path* — nothing more. It says nothing about whether the dialog's fields,
defaults, ranges and units match 30.1, which is what 1:1 actually requires. Promoting a row to
`done` is hand work: verify the field against the reference app, write a test, cite both.

As of 2026-10-08: of 855 in-scope menu rows, **15 are `done`** (the `Window → <panel>` function
keys — implemented, matching 30.1, with a test), **319 are `partial`**, 90 are `n/a`, 20 are in the
menus as stubs, and 495 found no match. The 495 are the honest backlog, and
they are concentrated where upstream says they are — Effect (86), View (49), Type (50) — plus 175
rows in `Menus/(path unknown)` whose source gave no menu path, which need their paths researched
before they can be joined at all.

### Tools

Tools are a separate surface — not menu entries, and carrying their own single-key shortcuts — so
they get their own join, against `vectorcraft_tools::catalog`. **42 of 42 agree** with the keys
30.1 binds, pinned by `catalog::parity::tool_shortcuts_match_the_reference_app`, and those rows are
`done`.

One apparent difference was not one: the catalogue writes `+` for Add Anchor Point where the
install records `=`. They are the same physical key, and the app's own parser folds them
(`"=" | "+" => Key::Equals`), so the audit folds them too. A comparator stricter than the app's
own key handling reports working code as broken.

The other 59 `TOOL-` rows are not tools: they are toolbar controls and paint buttons (`Default`,
`Swap Fill/Stroke`, `Increase Diameter`), which need their own surface.

### Still unaudited

Panels (372 rows), features (174), effects (117), dialogs (61), preferences (39), presets (29) and
formats (21) have no join yet. Each needs its own ground truth: `state::all_panels`, the effect
registry, `prefs.list`.

### What the audit also checks

Every row with `field: Shortcut` was verified against a licensed 30.1, so the audit compares it
with the keys the app actually binds, folding `Cmd`→`Ctrl` and `Opt`→`Alt` and ignoring modifier
order. Currently: **97 agree, 0 disagree** — every disagreement found so far turned out to be our
data, and all four were settled against Illustrator's own shortcut set file (below).

**The authority for a shortcut is `keys.kys`, the install's own set file.**
`research/illustrator/read-kys.mjs check` reads it out of the licensed VM and compares every row
with a `command_id` — **229 agree, 0 differ**, only 2 unjoinable (`Tab` and `Shift+Tab`, which
30.1 does not keep in the set). It records unbound commands explicitly (`/Key 0`), so it
also settles whether a command has a default shortcut at all. Prefer it to Adobe's published table
and to a hand-made export; run it after any shortcut work.

The audit compares each menu *item's* key, via `menus::item_shortcut`, not its command's — the Window menu
runs one parameterised `window.panel {panel}` behind every entry, and each panel binds its own key,
so reading the command's shortcut makes bound panels look unbound. The first run did exactly that
and over-reported the gap; see [`open-questions.md`](open-questions.md#a-correction-to-the-first-runs-figures).

**A shared chord is usually fine.** Illustrator binds per context, so `Shift+Ctrl+I` is
`~textItalic` while editing type and `Show Perspective Grid` otherwise. `read-kys.mjs check`
adjudicates every shared chord from the set's `/Context` field — currently **7 shared, 7 explained,
0 unexplained**. And `+` and `=` are *different* key codes in the set (43 and 61), so `Ctrl+=` and
`Ctrl++` are two chords: `View > Zoom In` and its `(Secondary)` binding, not a clash. The audit
therefore folds `+`/`=` when comparing a row against the app (whose parser accepts either) but
keeps them apart when grouping collisions. Asking "does the app match?" and "do two rows clash?"
need different normalisations.

A disagreement does **not** mean the app is wrong. It means one of the two is — and so far it has
been *our data* every time. The audit also checks the matrix against itself, since two rows cannot
claim one binding; that found 53 duplicated row pairs (merged 2026-10-08, which cut the in-scope
denominator from 1,826 to 1,773) and, in the four remaining collisions, showed that each disputed
row had absorbed a neighbouring row's shortcut.

Everything the first run raised is written up in [`open-questions.md`](open-questions.md), with
what to probe on the VM. **Resolve those on the licensed install, never by inference from another
implementation.** A wrong `verified` row is worse than an unverified one, because it will be
implemented faithfully.

## Reference fixtures

`fixtures/ai/` holds `.ai` files saved by a licensed Illustrator 30.1. It is **gitignored and must
stay that way**: those files still carry Adobe's bundled startup brushes and the author's user
name, so they are private research material only and must never reach this public repository. The
same applies to `.research/`, the raw documentation dumps.

Fixtures that *are* committed must be our own work or licensed for redistribution, and every one
needs an `ASSETS.md` entry — `cargo xtask assets` enforces it, and `.ai` is on its extension list,
so an accidentally-committed reference fixture fails the build.

## Two hard rules

- **Never read the unlicensed repack.** There is an Illustrator install at `../illustrator/` on the
  development machine that is not licensed. Never read its presets, shortcuts, resources, binaries
  or outputs, and never use it to make fixtures or reference outputs. Verification happens on the
  licensed 30.1 VM only.
- **Behaviour, never assets or wording.** Observe what the reference app *does*; never copy its
  icons, artwork, presets, libraries, ICC profiles, or its prose beyond bare feature names. This is
  the existing project rule in [`../../AGENTS.md`](../../AGENTS.md) and it is not relaxed here.
  `cargo xtask brands` keeps the reference app's name out of everything a user or agent reads; this
  directory and `research/` are exempt, because recording its behaviour by name is their whole job.
