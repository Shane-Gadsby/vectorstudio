# Open questions: what the first re-baseline turned up

Raised 2026-10-08 by the first `cargo xtask parity --audit` run. Each item is something the audit
proved is **wrong somewhere** without being able to say which side. Resolve them on the licensed
30.1 VM (`research/illustrator/`), never by inference from another implementation or from memory,
then update the matrix and strike the item.

Ordered by how much damage they do if left alone.

## 1. 39 duplicated row pairs (78 rows)

The matrix merged two sources without de-duplicating, so 39 commands have two rows each — the same
leaf label and the same shortcut under two different `area` spellings:

| | |
|---|---|
| `MENU-0646` | `Keyboard/Other: Misc` · `Other Misc > Cut (Secondary)` · `F2` |
| `MENU-0707` | `Keyboard/Other: Misc` · `Other: Misc > … > Cut (Secondary)` · `F2` |

By area: Other: Text 36 rows, Other: Misc 24, Other: Object 8, Menus/View 6, Menus/Object 2,
Other: Select 2.

**Why it matters:** the in-scope denominator is overstated by ~39 rows (2 %), so every coverage
percentage the gate prints is slightly flattering, and whoever implements one of a pair will leave
its twin looking unfinished for ever.

**To resolve:** keep the row whose `element` carries the full menu path, fold any extra `source`
and `verified_by` evidence into it, and set the twin to `scope: out` with a note pointing at the
survivor — do not delete rows, because ids are cited in commit messages. `cargo xtask parity
--audit` lists every pair under "claimed by more than one row".

## 2. `Object > Hide > Selection` — the matrix says `Ctrl+2`, the app binds `Cmd+3`

`MENU-0089` claims `Ctrl+2`, but `MENU-0084` (`Object > Lock > Selection`) claims `Ctrl+2` too, and
one binding cannot run two commands. The surrounding rows pair up as
`Lock > Selection` ↔ `Unlock All` = `Alt+Ctrl+2` (`MENU-0087`) and
`Hide > Selection` ↔ `Show All` = `Alt+Ctrl+3` (`MENU-0092`), which points at `MENU-0089` being the
mis-extracted one and the app being right.

That is reasoning, not evidence. **Re-probe both rows on the VM**, because `MENU-0089` is currently
graded `verified`, and a wrong `verified` row is worse than an unverified one.

## 3. `View > Show Grid` — the matrix says `Shift+Ctrl+I`, the app binds `Cmd+'`

`MENU-0316` claims `Shift+Ctrl+I`. Adobe's published default-shortcut table
(`shortcuts-default.csv`, "View artwork" section) gives `Ctrl + Shift + I` for **Show/hide
perspective grid**, a different command — so the extraction looks to have attached one row's key to
its neighbour. Again the app looks right and the row looks wrong, and again that needs confirming
rather than assuming.

**Check at the same time** whether other rows in the same stretch of `Menus/View` are shifted by
one, since a single off-by-one in the source would explain both this and item 2.

## 4. 17 panel shortcuts the reference app has and the app does not bind

Genuine missing work rather than a data question, listed here so it is not lost. All are
`Window → <panel>` function keys, every row `verified`:

`Align` Shift+F7 · `Appearance` Shift+F6 · `Attributes` Ctrl+F11 · `Brushes` F5 · `Color` F6 ·
`Color Guide` Shift+F3 · `Gradient` Ctrl+F9 · `Graphic Styles` Shift+F5 · `Info` Ctrl+F8 ·
`Layers` F7 · `Pathfinder` Shift+Ctrl+F9 · `Stroke` Ctrl+F10 · `Symbols` Shift+Ctrl+F11 ·
`Transform` Shift+F8 · `Transparency` Shift+Ctrl+F10

Plus `View > Perspective Grid > Show Rulers` (`Ctrl+R`) and
`View > Perspective Grid > Snap to Grid` (`Shift+Ctrl+'`).

A power user reaches for these constantly, the panels all exist already, and the fix is a shortcut
on each `window.panel` command — so this is the cheapest fidelity win currently visible.

## 5. 175 rows with no menu path

Everything in `area: Menus/(path unknown)` came from a source that gave no path, so the audit
cannot join it to anything and it will stay invisible to every coverage figure. These need their
paths researched (`research/illustrator/probe-menus.ps1` dumps every menu command and its path from
a licensed install) before they can be audited at all.
