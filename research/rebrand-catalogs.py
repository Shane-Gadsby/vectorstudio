"""Re-apply VectorStudio's catalogue deltas on top of upstream's files.

Run from the repo root after an upstream merge: `python3 research/rebrand-catalogs.py .`
See docs/upstream-merge.md.

Deterministic and idempotent, so it can be re-run after every upstream merge:
  1. drop entries for strings our UI no longer shows (the ArtCraft links, the Discord button);
  2. drop any existing upstream-credit entry, so step 3 cannot rename it;
  3. rename the product in sources and translations;
  4. insert the upstream credit, which must keep VectorCraft's name.

Only the catalogues that claim `complete_menus` must carry the credit; a partial catalogue may
omit a string, but must never hold one the UI does not show.
"""
import pathlib, sys

STALE = {
    "Join Our Discord", "Join our Discord",
    "Join the ArtCraft community on Discord (discord.gg/artcraft)",
    "ArtCraft Website", "ArtCraft website",
    "VectorCraft on getartcraft.com", "VectorStudio on getartcraft.com",
}
SRC = "Based on VectorCraft"
# Written from the meaning of the English label, as the catalogues' own clean-room note requires.
# Every catalogue gets it: the complete ones must have it, the menu-label test covers the ones in
# KEEPS_MENU_NAMES, and a partial catalogue may hold a string the UI does show — which this is.
CREDIT = {
    "ja": "VectorCraft をベースにしています",
    "es": "Basado en VectorCraft",
    "zh-hant": "基於 VectorCraft",
    "zh-hans": "基于 VectorCraft",
    "cs": "Založeno na VectorCraft",
    "pt-br": "Baseado no VectorCraft",
}

root = pathlib.Path(sys.argv[1]) / "crates/ui-egui/src/i18n"
for p in sorted(root.glob("*.tsv")):
    lines = p.read_text().split("\n")
    out, dropped = [], 0
    for l in lines:
        parts = l.split("\t")
        if len(parts) >= 3 and (parts[1] in STALE or parts[1].startswith("Based on Vector")):
            dropped += 1
            continue
        out.append(l)
    renamed = sum(1 for l in out if "VectorCraft" in l)
    out = [l.replace("VectorCraft", "VectorStudio") for l in out]
    tr = CREDIT.get(p.stem)
    if tr is None:
        raise SystemExit(f"no credit translation for `{p.stem}`: upstream added a language, so add "
                         f"one to CREDIT (see docs/upstream-merge.md)")
    if tr:
        idx = next((i for i, l in enumerate(out)
                    if len(pp := l.split("\t")) >= 3 and pp[0] == "" and pp[1] > SRC), None)
        out.insert(idx if idx is not None else len(out) - 1, f"\t{SRC}\t{tr}")
    print(f"{p.stem}: -{dropped} stale, {renamed} renamed, credit {'added' if tr else 'n/a'}")
    p.write_text("\n".join(out))
