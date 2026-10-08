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

## 1. ~~39 duplicated row pairs~~ — resolved 2026-10-08

**35 pairs, not 39.** The other four were never duplicates: they were two different commands
claiming one key, which is item 2. Matching candidates on the leaf label alone had conflated them
(`View > Show Grid` and `View > Perspective Grid > Show Grid` share a leaf), so the rule now
compares the whole element with the two sources' cosmetic differences removed.

The twins were not redundant, which is why this needed care rather than a delete: the row from
`shortcuts-30.1.csv` carried `behaviour` and a readable `element`, the row from
`menu-commands-30.1.csv` carried Illustrator's own `command_id`. Each pair's evidence was merged
into the first and the second set to `scope: out` with a note naming the survivor — **no row was
deleted**, because ids are cited in commit messages.

In-scope rows went from 1,826 to **1,791**, so every coverage figure before this date was about
2 % flattering.

## 2. Four rows where the app and the matrix disagree — **one resolved, three need the VM**

The collision check turned out to explain the mechanism: in each case the row had absorbed a
*neighbouring* row's shortcut, and the neighbour's own row holds the same key.

### Resolved: `MENU-0316 View > Show Grid`

Claimed `Shift+Ctrl+I`. Adobe's published table gives that to **Show/hide perspective grid**,
which is `MENU-0689`'s key, and gives Show grid **`Ctrl + '`** — which is what the app binds. Two
independent sources against one mis-extraction, so the row now reads `Ctrl+'` at `doc-30`
confidence, with `verified_by` cleared: it is documented, no longer verified against the install.
**The app was right.** Re-confirm on the VM to restore `verified`.

### Still open — probe these three

| Row | Claims | Who really owns that key | What the app does |
|---|---|---|---|
| `MENU-0089` `Object > Hide > Selection` | `Ctrl+2` | `MENU-0084` `Object > Lock > Selection` claims it too | binds `Cmd+3` |
| `MENU-0309` `View > Perspective Grid > Show Rulers` | `Ctrl+R` | `MENU-0681` `View > Rulers > Show Rulers`, per the published table | binds nothing |
| `MENU-0310` `View > Perspective Grid > Snap to Grid` | `Shift+Ctrl+'` | `MENU-0317` `View > Snap to Grid`, per the published table | binds nothing |

All three are now `confidence: unverified` with the evidence in their `behaviour`, and they keep
their claimed value **on purpose** so `cargo xtask parity --audit` goes on reporting them until
the VM settles it. For `MENU-0089` the Unlock All / Show All pair (`Alt+Ctrl+2` / `Alt+Ctrl+3`)
suggests `Ctrl+3`; for the other two the real answer is probably *no default shortcut*. Neither is
documented, so neither was written in.

**Do not bind a disputed row.** It would take the key from whatever really owns it and make the
matrix wrong twice.

## 3. ~~`View > Show Grid`~~ — see item 2

## 4. ~~Panel shortcuts the app does not bind~~ — resolved 2026-10-08

The 15 `Window → <panel>` function keys are `done` with tests; seven had been unbound. The two
remaining candidates are the perspective-grid pair above, held behind item 2.

## 5. 175 rows with no menu path

Everything in `area: Menus/(path unknown)` came from a source that gave no path, so the audit
cannot join it to anything and it will stay invisible to every coverage figure. These need their
paths researched (`research/illustrator/probe-menus.ps1` dumps every menu command and its path from
a licensed install) before they can be audited at all.
