"""Resolve docs/parity/open-questions.md item 1: the duplicated row pairs.

The matrix was built from two sources without de-duplicating them, so one command can hold two
rows. The twins are not redundant: the row from `shortcuts-30.1.csv` carries `behaviour` and a
readable `element`, and the row from `menu-commands-30.1.csv` carries Illustrator's own
`command_id`. So this merges the evidence into the first and retires the second as `scope: out`,
pointing at the survivor. No row is deleted -- ids are cited in commit messages.

Dry run by default; pass --write to apply.
"""

import collections
import csv
import io
import pathlib
import re
import sys

SEPARATORS = "[>›]"


def same_command(element):
    """An element with the two sources' cosmetic differences removed.

    `Other Text > Clear Tracking` and `Other: Text > ... > Clear Tracking` are one command written
    two ways. Matching on the leaf label alone is not enough: `View > Show Grid` and
    `View > Perspective Grid > Show Grid` share a leaf and are different commands.
    """
    cleaned = element.replace("…", "").replace("...", "").replace(":", "")
    parts = [re.sub(r"\s+", " ", p).strip().lower() for p in re.split(SEPARATORS, cleaned)]
    return " > ".join(p for p in parts if p)


def better_element(a, b):
    """Which of two elements describes the command better.

    A bare command id (`~emSpace`) is not a description, so any menu path beats one. A row written
    with an elision (`Other: Text > ... > Clear Tracking`) says less than the plain path. Between
    two plain paths the longer leaf is the real menu label (`View > Rulers > Show Rulers` rather
    than `View > Rulers > Show`).
    """
    def elided(e):
        return "\u2026" in e or "..." in e

    # A bare command id is not a description at all, so any path beats one.
    for x, y in ((a, b), (b, a)):
        if ">" in x and ">" not in y:
            return x
    for x, y in ((a, b), (b, a)):
        if elided(y) and not elided(x):
            return x
    return a if len(a) >= len(b) else b


def by_command_id(data, ix):
    """Pairs that share a `command_id`: the same command, two rows.

    A better signal than matching element text, which misses a pair written with different labels.
    Only `Shortcut` rows are considered, because that is where both sources overlap.
    """
    groups = collections.defaultdict(list)
    for r in data:
        cid = r[ix["command_id"]].strip()
        if cid and r[ix["scope"]] == "in" and r[ix["field"]] == "Shortcut":
            groups[cid].append(r)
    merged = []
    for cid, pair in sorted(groups.items()):
        if len(pair) != 2:
            continue
        keep_el = better_element(pair[0][ix["element"]], pair[1][ix["element"]])
        keep = next(r for r in pair if r[ix["element"]] == keep_el)
        drop = next(r for r in pair if r is not keep)
        for col in ("behaviour", "source", "verified_by", "command_id"):
            a, b = keep[ix[col]], drop[ix[col]]
            if b and b not in a:
                keep[ix[col]] = f"{a}; {b}" if a else b
        drop[ix["scope"]] = "out"
        drop[ix["status"]] = "n/a"
        drop[ix["behaviour"]] = (
            f"Duplicate of {keep[ix['id']]} ({keep[ix['element']]}): both rows carry command_id "
            f"`{cid}`, so they are one command entered twice. Its evidence moved to "
            f"{keep[ix['id']]}; kept out of scope rather than deleted because ids are cited in "
            f"commits. {drop[ix['behaviour']]}"
        ).strip()
        merged.append((keep[ix["id"]], drop[ix["id"]], cid, keep[ix["element"]]))
    return merged


def main(root, write):
    path = root / "docs/parity/matrix.csv"
    rows = list(csv.reader(io.StringIO(path.read_text())))
    header, data = rows[0], rows[1:]
    ix = {c: i for i, c in enumerate(header)}

    groups = collections.defaultdict(list)
    for r in data:
        if r[ix["scope"]] != "in" or r[ix["field"]] != "Shortcut" or not r[ix["default"]].strip():
            continue
        groups[(same_command(r[ix["element"]]), r[ix["default"]].strip())].append(r)

    shortcuts, menucmds = "docs/parity/shortcuts-30.1.csv", "docs/parity/menu-commands-30.1.csv"
    merged, collisions = [], []
    for key, pair in sorted(groups.items()):
        if len(pair) == 1:
            continue
        keep = [r for r in pair if shortcuts in r[ix["source"]]]
        drop = [r for r in pair if menucmds in r[ix["source"]]]
        if len(pair) != 2 or len(keep) != 1 or len(drop) != 1:
            collisions.append((key, [r[ix["id"]] for r in pair]))
            continue
        keep, drop = keep[0], drop[0]
        assert keep[ix["area"]] == drop[ix["area"]], (keep[ix["id"]], drop[ix["id"]])
        if not keep[ix["command_id"]]:
            keep[ix["command_id"]] = drop[ix["command_id"]]
        for col in ("source", "verified_by"):
            a, b = keep[ix[col]], drop[ix[col]]
            if b and b not in a:
                keep[ix[col]] = f"{a}; {b}" if a else b
        drop[ix["scope"]] = "out"
        drop[ix["status"]] = "n/a"
        note = (
            f"Duplicate of {keep[ix['id']]} ({keep[ix['element']]}): the same command, entered twice when "
            f"shortcuts-30.1.csv and menu-commands-30.1.csv were merged into the matrix. Its evidence moved "
            f"to {keep[ix['id']]}; kept out of scope rather than deleted because ids are cited in commits."
        )
        drop[ix["behaviour"]] = f"{note} {drop[ix['behaviour']]}".strip()
        merged.append((keep[ix["id"]], drop[ix["id"]], keep[ix["element"]]))

    # Second pass, on the stronger signal now that command_ids have been recovered.
    by_id = by_command_id(data, ix)

    print(f"{len(merged)} duplicate pairs merged by element, {len(by_id)} by command_id, "
          f"{len(collisions)} genuine collisions left\n")
    for k, d, cid, el in by_id:
        print(f"  keep {k}  retire {d}   [{cid}] {el}")
    for k, d, el in merged:
        print(f"  keep {k}  retire {d}   {el}")
    print()
    for key, ids in collisions:
        print(f"  collision: {' and '.join(ids)} both claim {key[1]}")

    if write:
        buf = io.StringIO()
        csv.writer(buf, lineterminator="\n", quoting=csv.QUOTE_MINIMAL).writerows([header] + data)
        path.write_text(buf.getvalue())
        print(f"\nwrote {path}")
    else:
        print("\n(dry run: pass --write)")


if __name__ == "__main__":
    main(pathlib.Path(sys.argv[1]), "--write" in sys.argv)
