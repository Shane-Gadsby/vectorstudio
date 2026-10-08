# Merging upstream

VectorCraft is active, so this happens often. Do it early and often: the cost is roughly linear in
the number of commits, and the conflicts are nearly all the same handful of files.

```sh
git fetch upstream
git rev-list --count HEAD..upstream/main      # how far behind
git checkout -b merge/upstream-<n> main
git merge upstream/main
```

## What conflicts, and how to resolve it

Only files we have edited conflict, and we have edited few. Every conflict so far has fallen into
one of four shapes:

| Shape | Resolution |
|---|---|
| **Our rebranded display string on a line upstream also changed** (`packaging/macos/Info.plist.in`, `xtask/src/bundle.rs`, `apps/vectorcraft-web/src/web.rs`) | Take **theirs** — they usually changed the substance — then re-apply the rebrand. Never hand-merge: upstream's side often carries a real improvement you would drop. |
| **A translation catalogue** (`crates/ui-egui/src/i18n/*.tsv`) | Take **theirs** for the whole file, then re-run the catalogue script (below). The files are sorted, so hand-merging hunks silently duplicates or drops entries. |
| **A test of ours sitting next to a new test of theirs** (`crates/ui-egui/src/shortcuts.rs`) | Keep both. **Count the braces** — deleting the `=======` line also deletes whatever shared that line, which has already cost one unclosed-delimiter build break. |
| **`README.md`, `ROADMAP.md`** | Keep our structure, fold in the facts upstream added (new languages, new features), and treat any **count** on either side as stale — see below. |

### Counts are stale on both sides

`ROADMAP.md` carries figures like "N menu entries still stubbed". Ours was measured; theirs moved
because they implemented things. **Neither side is right after a merge.** Put a placeholder in,
finish the merge, then re-measure:

```sh
cargo run -q -p vectorcraft-ui-egui --example dump-surface | \
  python3 -c "import json,sys,collections; v=json.load(sys.stdin); \
    print(collections.Counter(m['kind'] for m in v['menu']))"
```

Upstream's own stub count has been lower than the measured one twice (13 and 15 against 32), so
prefer the measurement and say in the ROADMAP that it is measured.

## Re-applying the rebrand

Only what a user reads is rebranded; see `AGENTS.md`. After a merge, upstream's new display strings
need the same treatment. **Do not run a blanket find-and-replace** — one of those corrupted
`docs/HANDOFF.md`, this file's sibling decision record and a vendored third-party patch in a single
pass, because all three legitimately name VectorCraft.

Find the candidates, then judge each one:

```sh
grep -rn "VectorCraft" --include=*.rs --include=*.md --include=*.toml --include=*.in . \
  | grep -v "^./target\|^./vendor/\|^./docs/parity/\|^./docs/ai-format/\|^./research/\|^./docs/HANDOFF.md\|^./docs/decisions/"
```

**Rename** user-facing prose and labels: error and warning messages, dialog and menu text, MCP tool
descriptions, `Cargo.toml` descriptions, packaging display names, `%%Creator` and producer metadata,
and our own documentation about the product.

**Leave alone** — these are not branding:

- **Format and protocol identifiers:** `%VectorCraft_BeginData`/`_EndData`, `"VectorCraft editing
  data"` (the PDF `PieceInfo` description that finds our own embedded document), the `.vectorcraft`
  and `.drawcraft` extensions, `"format": "vectorcraft"`, every lowercase `vectorcraft` crate name
  and module path, and `VECTORCRAFT_*` environment variables.
- **Names looked up by name in stored data:** `"VectorCraft Default"` (a PDF preset),
  `"VectorCraft Generic CMYK (SWOP-like)"` (a colour profile tagged into documents), and the
  `("VectorCraft", "vectorcraft")` entry in the preferences migration chain.
- **User data locations:** `~/Documents/VectorCraft Templates`.
- **Attribution and upstream references:** `NOTICE`, the copyright lines, the "Based on VectorCraft"
  credit (in code, menus and all four catalogues), `ASSETS.md`'s author column — upstream's
  contributors really did author those files — `assets/app-icon/README.md`, which documents their
  artwork's provenance, and anything under `vendor/`.
- **Our own fork documentation:** `docs/HANDOFF.md`, `docs/decisions/`, `docs/parity/`,
  `docs/ai-format/` and `research/`, which name both projects deliberately.

### The catalogues

`crates/ui-egui/src/i18n/*.tsv` get a deterministic, idempotent transformation rather than a hand
merge: drop entries for strings our UI no longer shows (the ArtCraft website and app-page links, the
Discord button), rename the product, then insert the "Based on VectorCraft" credit — in that order,
so the rename cannot touch the credit. The catalogues that declare `complete_menus` (`ja`, `es`,
`zh-hant` at the time of writing) **must** carry the credit or the i18n tests fail; a partial
catalogue may omit it but must never hold a string the UI does not show.

Upstream adds languages, so check `LANGUAGES` in `crates/ui-egui/src/i18n/mod.rs` for new ones and
write their credit from the meaning of the English label, as those files' own clean-room note
requires.

## Finishing

```sh
cargo build --workspace                # catches a mis-resolved brace before the tests do
cargo test --workspace --no-fail-fast  # NOT a plain `cargo test`: see below
cargo xtask ci                         # fmt, clippy -D warnings, tests, assets, brands, parity, layers, wasm
cargo xtask parity --audit             # upstream adds menu entries, so coverage can move
```

**Use `--no-fail-fast`.** A plain `cargo test --workspace` stops at the first failing target, and
one target fails on this machine for environmental reasons, so the run never reaches the crates
after it. During the first merge that hid three i18n failures behind an expected one.

Then commit the merge with what you resolved and why, and note anything upstream changed that
affects the parity programme.

## What to also check

- **Upstream's marketing is not ours.** It has added a star-history chart pointing at its own
  repository, badges and Discord links; those do not belong in the fork.
- **New brand assets.** If `docs/brand/` ever comes back in a merge, delete it again — upstream's
  brand licence requires a fork to remove the ArtCraft Marks.
- **`cargo xtask brands`** passes on the merge result. It also guards against Adobe's names reaching
  anything a user or agent reads, which upstream's new features can reintroduce.
