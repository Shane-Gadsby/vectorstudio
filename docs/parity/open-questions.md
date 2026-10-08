# Open questions: what the first re-baseline turned up

Raised 2026-10-08 by the first `cargo xtask parity --audit` run. Each item is something the audit
proved is **wrong somewhere** without being able to say which side. Resolve them on the licensed
30.1 VM (`research/illustrator/`), never by inference from another implementation or from memory,
then update the matrix and strike the item.

Ordered by how much damage they do if left alone.

**Resolved since:** items 1, 3 and 4, and one of item 2's four rows. What is left needs the
licensed VM. Shortcut agreement now stands at **96 of 99** matched menu rows.

### A correction to the first run's figures

The first audit reported **17 unbound** panel shortcuts. That was wrong: it read each row's
shortcut from the *command* spec, and every Window menu entry runs the one parameterised command
`window.panel {panel}`, so the eight panels that already had bindings looked unbound. The dump now
resolves each menu item's own key through `menus::item_shortcut`. The figures went 88/2/9 before
the seven were bound, 95/2/2 after, and **96/1/2** once `MENU-0316` was corrected.

The lesson is worth keeping: a parity audit that reads the wrong field invents work. When a number
here looks surprising, check what the audit actually measured before believing it.

## 1. ~~35 duplicated row pairs~~ — resolved 2026-10-08

The matrix merged two sources without de-duplicating, so 35 commands held two rows each. The twins
were not redundant — the row from `shortcuts-30.1.csv` carried `behaviour` and a readable
`element`, the one from `menu-commands-30.1.csv` carried Illustrator's own `command_id` — so each
pair's evidence was folded into the first and the second set to `scope: out` naming the survivor.
No row was deleted; ids are cited in commit messages. In scope: **1,826 → 1,791**.

`research/dedupe-matrix.py` is the script, for the next time two sources are merged.

## 2. ~~Four rows where the app and the matrix disagree~~ — resolved 2026-10-08

Settled against the authority rather than by inference: **Illustrator's own shortcut set file**,
`keys.kys`, read out of the licensed install
([`read-kys.mjs`](../../research/illustrator/read-kys.mjs)). It lists every command with the keys
bound to it, or `/Key 0` when nothing is, so it answers both "what is the shortcut" and "is there
one at all".

| Row | Claimed | 30.1 actually | Why the row was wrong |
|---|---|---|---|
| `MENU-0089` `Object > Hide > Selection` | `Ctrl+2` | **`Ctrl+3`** | `Ctrl+2` is `lock` (`MENU-0084`) — exactly what the collision had shown |
| `MENU-0309` `Perspective Grid > Show Rulers` | `Ctrl+R` | **nothing** (`/Key 0`) | `Ctrl+R` is `ruler` (`MENU-0681`) |
| `MENU-0310` `Perspective Grid > Snap to Grid` | `Shift+Ctrl+'` | **nothing** (`/Key 0`) | `Shift+Ctrl+'` is `snapgrid` (`MENU-0317`) |
| `MENU-0316` `View > Show Grid` | `Shift+Ctrl+I` | **`Ctrl+'`** | `Shift+Ctrl+I` is `Show Perspective Grid` (`MENU-0689`), which really does hold it |

**The app was right every time; our extraction was wrong every time.** All four rows are now
`verified` against `keys.kys`, and the audit reports **97 of 97** matched shortcuts agreeing.

The whole shortcut surface is now machine-checkable: `read-kys.mjs check` compares every row with
a `command_id` against the set — **174 agree, 0 differ**. Run it after any shortcut work.

### Two parser traps, since they cost real time

- **Command names escape their spaces** in `.kys` (`/Live\ Pathfinder\ Outline {`), 501 of them. An
  id pattern of `[^\s]+` misses those entries and reports a *bound* command as absent — which it
  did, and nearly produced the wrong conclusion about the perspective-grid rows.
- **F1–F12 are encoded 14–25**, not as characters, so `/Key 20` is F7 and not a control code.
  Without that, thirteen correct rows look like mismatches.

## 3. ~~`View > Show Grid`~~ — see item 2

## 4. ~~Panel shortcuts the app does not bind~~ — resolved 2026-10-08

The 15 `Window → <panel>` function keys are `done` with tests; seven had been unbound.

## 4b. 75 shortcut rows cannot be checked yet

They carry no `command_id`, so `read-kys.mjs` cannot join them to the set — mostly the
`Keyboard/Other: *` families, whose ids were never recorded. Recovering the ids (from
`menu-commands-30.1.csv`, or by matching chords in the set) would put the rest of the shortcut
surface under machine check too.

## 5. 175 rows with no menu path

Everything in `area: Menus/(path unknown)` came from a source that gave no path, so the audit
cannot join it to anything and it will stay invisible to every coverage figure. These need their
paths researched (`research/illustrator/probe-menus.ps1` dumps every menu command and its path from
a licensed install) before they can be audited at all.
