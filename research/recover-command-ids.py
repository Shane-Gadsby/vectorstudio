"""Fill in `command_id` for matrix shortcut rows that have none, from Illustrator's own set file.

A row without a `command_id` cannot be joined to `keys.kys`, so `read-kys.mjs check` has to skip
it and its shortcut is unverifiable by machine. Almost all of them are tool shortcuts, whose ids
are Illustrator's internal plugin names (`Adobe Select Tool`), nothing a human would guess.

The chord recovers them. A tool shortcut is a unique single key, so matching the row's shortcut
against the set's `/Tools` section identifies the command outright. Menu rows are matched the same
way against `/Menus`.

Where one chord has two candidates it is almost always a **context** pair: `/Context 1` is the
text/type context and `/Context 0` is global, so `Shift+Ctrl+I` is both `~textItalic` (while
editing type) and `Show Perspective Grid` (otherwise), and both are correct. Those are resolved by
name similarity against the row's element, and only an unambiguous winner is written.

Dry run by default; pass --write to apply. Needs `read-kys.mjs fetch` to have run.

    python3 research/recover-command-ids.py . [--write]
"""

import collections
import csv
import difflib
import io
import pathlib
import re
import sys

KYS = pathlib.Path.home() / ".research/kys/keys.kys"
ENTRY = re.compile(r"/((?:[^\s{/\\]|\\ )+)\s*\{\s*((?:/\w+\s+-?\d+\s*)+)\}")
MODIFIER_BITS = ((128, "Alt"), (64, "Ctrl"), (32, "Shift"))
ORDER = ("Alt", "Ctrl", "Shift")


def sections(text):
    """The set's top-level blocks: /Menus, /Tools, /type."""
    out = {}
    for m in re.finditer(r"^/(\w+) \{$", text, re.M):
        out[m.group(1)] = text[m.end() : text.index("\n}", m.end())]
    return out


def bindings(block):
    out = {}
    for m in ENTRY.finditer(block):
        fields = {k: int(v) for k, v in re.findall(r"/(\w+)\s+(-?\d+)", m.group(2))}
        out[m.group(1).replace("\\ ", " ")] = fields
    return out


def key_name(code):
    if not code:
        return None
    if 14 <= code <= 25:
        return f"F{code - 13}"  # F1..F12, not characters
    return chr(code).upper() if 32 <= code < 127 else f"<{code}>"


def chord_of(fields):
    key = key_name(fields.get("Key", 0))
    if not key:
        return None
    mods = [n for bit, n in MODIFIER_BITS if fields.get("Modifiers", 0) & bit]
    return "+".join([m for m in ORDER if m in mods] + [key])


def chord_of_cell(text):
    """The same shape from a matrix cell, folding Cmd/Opt and ignoring modifier order."""
    tokens = text.split("+")
    mods, key = [], ""
    for i, token in enumerate(tokens):
        t = token.strip()
        low, last = t.lower(), i == len(tokens) - 1
        if not last and low in ("ctrl", "cmd", "command"):
            mods.append("Ctrl")
        elif not last and low in ("alt", "opt", "option"):
            mods.append("Alt")
        elif not last and low == "shift":
            mods.append("Shift")
        else:
            key = (t or "+").upper()
    return "+".join([m for m in ORDER if m in mods] + [key]) if key else None


def best_by_name(element, candidates):
    """The candidate whose id reads most like the row's element, if one clearly wins."""
    leaf = re.split(r"[>›]", element)[-1].strip().lower()
    scored = sorted(
        ((difflib.SequenceMatcher(None, leaf, c.lstrip("~").lower()).ratio(), c) for c in candidates),
        reverse=True,
    )
    if len(scored) < 2 or scored[0][0] - scored[1][0] >= 0.15:
        return scored[0][1]
    return None


def main(root, write):
    if not KYS.exists():
        raise SystemExit(f"no shortcut set at {KYS}: run `node research/illustrator/read-kys.mjs fetch` first")
    blocks = sections(KYS.read_text("latin1"))
    by_chord = {}
    for name in ("Tools", "Menus"):
        index = collections.defaultdict(list)
        for cid, fields in bindings(blocks.get(name, "")).items():
            c = chord_of(fields)
            if c:
                index[c].append(cid)
        by_chord[name] = index

    path = root / "docs/parity/matrix.csv"
    rows = list(csv.reader(io.StringIO(path.read_text())))
    header, data = rows[0], rows[1:]
    ix = {c: i for i, c in enumerate(header)}

    filled, ambiguous, unmatched = [], [], []
    for row in data:
        if row[ix["field"]] != "Shortcut" or row[ix["scope"]] != "in":
            continue
        if row[ix["command_id"]].strip() or not row[ix["default"]].strip():
            continue
        chord = chord_of_cell(row[ix["default"]])
        # A TOOL- row is a tool; everything else is a menu or keyboard command.
        section = "Tools" if row[ix["id"]].startswith("TOOL-") else "Menus"
        hits = by_chord[section].get(chord, [])
        if not hits:
            unmatched.append((row[ix["id"]], row[ix["element"]], row[ix["default"]]))
            continue
        pick = hits[0] if len(hits) == 1 else best_by_name(row[ix["element"]], hits)
        if not pick:
            ambiguous.append((row[ix["id"]], row[ix["element"]], row[ix["default"]], hits))
            continue
        row[ix["command_id"]] = pick
        note = (
            f"command_id recovered 2026-10-08 by matching {row[ix['default']]} against the "
            f"/{section} section of keys.kys (licensed 30.1.0)"
        )
        src = row[ix["source"]]
        if "recovered" not in src:
            row[ix["source"]] = f"{src}; {note}" if src else note
        filled.append((row[ix["id"]], row[ix["element"]], row[ix["default"]], pick))

    print(f"{len(filled)} ids recovered, {len(ambiguous)} ambiguous, {len(unmatched)} with no match\n")
    for rid, el, sc, pick in filled:
        print(f"  {rid:10} {el[:38]:40} {sc:16} -> {pick}")
    for rid, el, sc, hits in ambiguous:
        print(f"  AMBIGUOUS {rid} {el[:38]:40} {sc:16} {hits}")
    for rid, el, sc in unmatched:
        print(f"  NO MATCH  {rid} {el[:38]:40} {sc}")

    # A shared command_id is a far better duplicate signal than matching element text, which misses
    # pairs written with different labels ("View > Rulers > Show" / "… > Show Rulers").
    seen = collections.defaultdict(list)
    for row in data:
        cid = row[ix["command_id"]].strip()
        if cid and row[ix["scope"]] == "in" and row[ix["field"]] == "Shortcut":
            seen[cid].append(row[ix["id"]])
    clashes = {c: ids for c, ids in seen.items() if len(ids) > 1}
    if clashes:
        print(f"\n{len(clashes)} command_id(s) now held by more than one in-scope row:")
        for cid, ids in sorted(clashes.items()):
            print(f"  {cid:28} {', '.join(ids)}")

    if write:
        buf = io.StringIO()
        csv.writer(buf, lineterminator="\n", quoting=csv.QUOTE_MINIMAL).writerows([header] + data)
        path.write_text(buf.getvalue())
        print(f"\nwrote {path}")
    else:
        print("\n(dry run: pass --write)")


if __name__ == "__main__":
    main(pathlib.Path(sys.argv[1]), "--write" in sys.argv)
