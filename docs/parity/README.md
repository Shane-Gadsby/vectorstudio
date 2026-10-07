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

The matrix currently reports `done 0/1826`, because it was written against an empty prototype while
this codebase already implements a large part of Illustrator. Re-baselining — walking the matrix
area by area, confirming what the engine already does, and recording `status` and `impl_ref` — is
the **next substantial task**, and it is what converts upstream's self-assessment into a row-level
audit. Do it by reading and running the code, never by assuming a feature is complete because a
menu item exists.

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
