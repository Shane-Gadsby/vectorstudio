//! `cargo xtask parity --audit [--write]`: re-baseline `docs/parity/matrix.csv` against the app.
//!
//! The matrix was written against a different prototype, so every row starts `planned` even though
//! this codebase implements a large part of the reference app. This joins the matrix to the real
//! menu surface — dumped by `cargo run -p vectorcraft-ui-egui --example dump-surface` — and
//! reports, per row, what the evidence says.
//!
//! The menu tree is the honest source for "does this exist", because it carries the real paths and
//! labels and marks unimplemented entries `Item::Todo`. The engine registry alone is not enough:
//! commands the UI owns (`file.open`) carry no menu path.
//!
//! `--write` applies only the conclusions that need no judgement:
//!
//! | Evidence | Becomes |
//! |---|---|
//! | the row's menu path is a wired command | `partial`, `impl_ref` = the command id and its file |
//! | the row's menu path is an `Item::Todo` | left `planned` (placed, not implemented) |
//! | the row names a submenu that real items sit under, and specifies no field | `n/a` |
//! | no match | left alone |
//!
//! Nothing here can produce `done`. A row only becomes `done` when someone verifies its field
//! against the reference app and cites a test — see `docs/parity/README.md`.

use std::collections::{BTreeMap, BTreeSet};
use std::path::Path;
use std::process::Command;

use serde_json::Value;

use crate::parity::{self, Row};

/// What the app's menu surface says about one matrix row.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Evidence {
    /// A wired menu command sits at this path.
    Command,
    /// The path is in the menus but marked `Item::Todo`.
    Todo,
    /// A disabled section label; nothing to implement.
    Header,
    /// Real menu items sit below this path, so the row describes the submenu itself.
    Submenu,
    /// Nothing in the menus matches.
    Absent,
}

/// One menu entry from the dump.
pub struct Entry {
    pub kind: String,
    pub id: Option<String>,
}

/// Compare menu paths the way a reader would: ignore case, ellipses, the `>`/`›` separators and
/// runs of whitespace, and drop empty segments (the matrix writes `Effect > … > Blur` where the
/// elided part is the Illustrator/Photoshop split).
pub fn norm(path: &str) -> String {
    let cleaned = path.replace('\u{2026}', " ").replace("...", " ");
    cleaned
        .split(['>', '\u{203a}'])
        .map(|seg| seg.split_whitespace().collect::<Vec<_>>().join(" ").to_lowercase())
        .filter(|seg| !seg.is_empty())
        .collect::<Vec<_>>()
        .join(" > ")
}

/// Index the dumped menu by normalised path.
pub fn index(surface: &Value) -> BTreeMap<String, Entry> {
    let mut out = BTreeMap::new();
    for m in surface.get("menu").and_then(Value::as_array).into_iter().flatten() {
        let Some(path) = m.get("path").and_then(Value::as_str) else { continue };
        let key = norm(path);
        if key.is_empty() {
            continue;
        }
        let entry = Entry {
            kind: m.get("kind").and_then(Value::as_str).unwrap_or("command").to_owned(),
            id: m.get("id").and_then(Value::as_str).map(str::to_owned),
        };
        // A path that is both a command and a submenu parent counts as the command.
        out.entry(key).or_insert(entry);
    }
    out
}

/// What the surface says about `row`. `prefixes` holds every path that has children.
pub fn classify(row: &Row, menu: &BTreeMap<String, Entry>, prefixes: &BTreeSet<String>) -> Evidence {
    let key = norm(row.get("element"));
    if key.is_empty() {
        return Evidence::Absent;
    }
    match menu.get(&key).map(|e| e.kind.as_str()) {
        Some("todo") => return Evidence::Todo,
        Some("header") => return Evidence::Header,
        Some(_) => return Evidence::Command,
        None => {}
    }
    // A row with no field and no default that other items sit under describes the submenu.
    if prefixes.contains(&key) && row.get("field").is_empty() && row.get("default").is_empty() {
        return Evidence::Submenu;
    }
    Evidence::Absent
}

/// Every normalised path that has at least one item below it.
pub fn prefixes(menu: &BTreeMap<String, Entry>) -> BTreeSet<String> {
    let mut out = BTreeSet::new();
    for path in menu.keys() {
        let segs: Vec<&str> = path.split(" > ").collect();
        for n in 1..segs.len() {
            out.insert(segs[..n].join(" > "));
        }
    }
    out
}

/// Where each command is *defined*, as `path:line`.
///
/// A command id is mentioned in many files — the menu wiring in `menus.rs`, dialogs, tests — so a
/// plain first-match search finds the wrong one. The definitions live in `crates/engine/src/cmd/`,
/// one module per area, where rustfmt leaves the id as a lone literal in its `cmd!` invocation.
/// So: the first occurrence under `crates/engine/src/cmd/` wins, and `crates/ui-egui/src/` is the
/// fallback for commands only the UI has (`UI_COMMANDS`, dialogs that own their own state).
pub fn definitions(root: &Path, files: &[String], ids: &BTreeSet<String>) -> BTreeMap<String, String> {
    /// Where to look, best first: the engine modules that declare commands, then `UI_COMMANDS`,
    /// then the rest of the frontend (dialogs that own their own command).
    const TIERS: [&str; 3] = ["crates/engine/src/cmd/", "crates/ui-egui/src/menus.rs", "crates/ui-egui/src/"];
    let mut out: BTreeMap<String, String> = BTreeMap::new();
    for tier in TIERS {
        for rel in files {
            if !rel.starts_with(tier) || !rel.ends_with(".rs") || rel.contains("/tests") || rel.contains("tests_") || rel.ends_with("/tests.rs") {
                continue;
            }
            let Ok(text) = std::fs::read_to_string(root.join(rel)) else { continue };
            for (n, line) in text.lines().enumerate() {
                for id in ids {
                    if !out.contains_key(id) && line.contains(&format!("\"{id}\"")) {
                        out.insert(id.clone(), format!("{rel}:{}", n + 1));
                    }
                }
            }
        }
    }
    out
}

/// Every command id the app defines.
pub fn command_ids(surface: &Value) -> BTreeSet<String> {
    let mut out = BTreeSet::new();
    for key in ["engine_commands", "ui_commands"] {
        for c in surface.get(key).and_then(Value::as_array).into_iter().flatten() {
            if let Some(id) = c.get("id").and_then(Value::as_str) {
                out.insert(id.to_owned());
            }
        }
    }
    out
}

/// Run the dump example and parse it.
fn surface(root: &Path) -> Result<Value, String> {
    let out = Command::new(std::env::var("CARGO").unwrap_or_else(|_| "cargo".into()))
        .current_dir(root)
        .args(["run", "-q", "-p", "vectorcraft-ui-egui", "--example", "dump-surface"])
        .output()
        .map_err(|e| format!("dump-surface: {e}"))?;
    if !out.status.success() {
        return Err(format!("dump-surface failed:\n{}", String::from_utf8_lossy(&out.stderr).trim()));
    }
    serde_json::from_slice(&out.stdout).map_err(|e| format!("dump-surface produced invalid JSON: {e}"))
}

/// A shortcut as (sorted modifiers, key), so `Shift+Ctrl+N` and `Cmd+Shift+N` compare equal.
///
/// The matrix records what a licensed 30.1 reports on Windows (`Shift+Ctrl+N`); the app records the
/// Mac spelling (`Cmd+Shift+N`) and the UI maps it per platform. So `Cmd` folds to `Ctrl` and `Opt`
/// to `Alt`, and the modifier order is ignored.
pub fn shortcut(text: &str) -> Option<(Vec<String>, String)> {
    let text = text.trim();
    if text.is_empty() {
        return None;
    }
    let mut mods: Vec<String> = Vec::new();
    let mut key = String::new();
    // `Ctrl++` and `Cmd+-` exist, so a trailing empty part is the `+` key itself.
    let parts: Vec<&str> = text.split('+').collect();
    for (i, part) in parts.iter().enumerate() {
        let p = part.trim();
        let folded = match p.to_ascii_lowercase().as_str() {
            "cmd" | "command" | "ctrl" | "control" => Some("Ctrl"),
            "opt" | "option" | "alt" => Some("Alt"),
            "shift" => Some("Shift"),
            _ => None,
        };
        match folded {
            Some(m) if i + 1 < parts.len() => mods.push(m.to_owned()),
            _ => {
                key = if p.is_empty() { "+".to_owned() } else { p.to_ascii_uppercase() };
            }
        }
    }
    mods.sort();
    mods.dedup();
    (!key.is_empty()).then_some((mods, key))
}

/// Comparing one row's shortcut with the app's.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Shortcut {
    /// The app binds the same keys the reference app does.
    Same,
    /// The app binds different keys: a 1:1 defect.
    Differs,
    /// The reference app has a shortcut here and the app has none.
    Unbound,
}

pub fn compare_shortcut(want: &str, got: Option<&str>) -> Option<Shortcut> {
    let want = shortcut(want)?;
    match got.and_then(shortcut) {
        None => Some(Shortcut::Unbound),
        Some(got) if got == want => Some(Shortcut::Same),
        Some(_) => Some(Shortcut::Differs),
    }
}

/// Command id → the shortcut the app binds to it.
pub fn shortcuts(surface: &Value) -> BTreeMap<String, String> {
    let mut out = BTreeMap::new();
    for key in ["engine_commands", "ui_commands"] {
        for c in surface.get(key).and_then(Value::as_array).into_iter().flatten() {
            let (Some(id), Some(sc)) = (c.get("id").and_then(Value::as_str), c.get("shortcut").and_then(Value::as_str)) else { continue };
            if !sc.is_empty() {
                out.entry(id.to_owned()).or_insert_with(|| sc.to_owned());
            }
        }
    }
    out
}

pub fn run(root: &Path, write: bool) -> Result<(), String> {
    let path = root.join("docs/parity/matrix.csv");
    let text = std::fs::read_to_string(&path).map_err(|e| format!("{}: {e}", path.display()))?;
    let (header, mut rows) = parity::parse(&text)?;

    eprintln!("building the menu surface…");
    let surface = surface(root)?;
    let menu = index(&surface);
    let pre = prefixes(&menu);
    let ids = command_ids(&surface);
    let impls = definitions(root, &crate::repo_files(root)?, &ids);
    println!("menu surface: {} paths ({} with children)", menu.len(), pre.len());
    println!("commands: {} defined, {} located in the source", ids.len(), impls.len());

    let mut counts: BTreeMap<&str, usize> = BTreeMap::new();
    let mut changed = 0usize;
    for row in &mut rows {
        if row.get("scope") != "in" || row.get("element_type") != "menu" {
            continue;
        }
        let ev = classify(row, &menu, &pre);
        *counts.entry(label(ev)).or_default() += 1;
        if !write || row.get("status") != "planned" {
            continue;
        }
        match ev {
            Evidence::Command => {
                let key = norm(row.get("element"));
                let id = menu.get(&key).and_then(|e| e.id.clone()).unwrap_or_default();
                row.set("status", "partial");
                row.set(
                    "impl_ref",
                    &match impls.get(&id) {
                        Some(at) => format!("{id} @ {at}"),
                        None if id.is_empty() => "crates/ui-egui/src/menus.rs".into(),
                        None => format!("{id} (definition not located)"),
                    },
                );
                changed += 1;
            }
            Evidence::Submenu | Evidence::Header => {
                row.set("status", "n/a");
                changed += 1;
            }
            Evidence::Todo | Evidence::Absent => {}
        }
    }

    // Every shortcut row was verified against a licensed 30.1, so a disagreement is worth chasing —
    // but it does not say which side is wrong. The app may bind the wrong keys, or the row may have
    // been mis-extracted. Resolve it on the licensed VM, not by inference.
    let bound = shortcuts(&surface);
    let mut sc_counts: BTreeMap<&str, usize> = BTreeMap::new();
    let mut disagreements: Vec<String> = Vec::new();
    for row in &rows {
        if row.get("scope") != "in" || row.get("field") != "Shortcut" {
            continue;
        }
        let key = norm(row.get("element"));
        let Some(id) = menu.get(&key).and_then(|e| e.id.as_deref()) else { continue };
        let Some(verdict) = compare_shortcut(row.get("default"), bound.get(id).map(String::as_str)) else { continue };
        *sc_counts
            .entry(match verdict {
                Shortcut::Same => "same",
                Shortcut::Differs => "differs",
                Shortcut::Unbound => "unbound",
            })
            .or_default() += 1;
        if verdict != Shortcut::Same {
            let got = bound.get(id).map(String::as_str).unwrap_or("(none)");
            disagreements.push(format!("{:<10} {:<42} reference {:<18} app {got}", row.get("id"), row.get("element"), row.get("default")));
        }
    }

    let total: usize = counts.values().sum();
    println!("\nin-scope menu rows: {total}");
    for (k, n) in &counts {
        println!("  {k:<9} {n:>4}  ({:.0} %)", if total == 0 { 0.0 } else { *n as f64 * 100.0 / total as f64 });
    }
    // Matrix-internal, so no inference is needed: two commands cannot share one binding, which
    // makes a collision proof that at least one of the two rows was mis-extracted.
    let mut claimed: BTreeMap<(Vec<String>, String), Vec<String>> = BTreeMap::new();
    for row in &rows {
        if row.get("scope") != "in" || row.get("field") != "Shortcut" {
            continue;
        }
        if let Some(keys) = shortcut(row.get("default")) {
            claimed.entry(keys).or_default().push(format!("{} {}", row.get("id"), row.get("element")));
        }
    }
    let collisions: Vec<_> = claimed.iter().filter(|(_, rs)| rs.len() > 1).collect();
    if !collisions.is_empty() {
        println!("\n{} shortcut(s) claimed by more than one row — at least one row is wrong:", collisions.len());
        for ((mods, key), rs) in collisions.iter().take(20) {
            let keys = if mods.is_empty() { (*key).clone() } else { format!("{}+{key}", mods.join("+")) };
            println!("  {keys:<22} {}", rs.join("  |  "));
        }
        if collisions.len() > 20 {
            println!("  … and {} more", collisions.len() - 20);
        }
    }

    let sc_total: usize = sc_counts.values().sum();
    if sc_total > 0 {
        println!("\nshortcuts on matched menu rows ({sc_total}, every one verified against a licensed 30.1):");
        for (k, n) in &sc_counts {
            println!("  {k:<8} {n:>4}");
        }
        if !disagreements.is_empty() {
            println!("\n{} disagreement(s) — re-probe on the licensed VM before changing either side:", disagreements.len());
            for d in disagreements.iter().take(40) {
                println!("  {d}");
            }
            if disagreements.len() > 40 {
                println!("  … and {} more", disagreements.len() - 40);
            }
        }
    }

    if write {
        std::fs::write(&path, parity::write_csv(&header, &rows)).map_err(|e| format!("write {}: {e}", path.display()))?;
        println!("\nwrote {changed} row(s) to docs/parity/matrix.csv");
    } else {
        println!("\n(dry run: pass --write to apply `partial` and `n/a`)");
    }
    Ok(())
}

fn label(e: Evidence) -> &'static str {
    match e {
        Evidence::Command => "command",
        Evidence::Todo => "todo",
        Evidence::Header => "header",
        Evidence::Submenu => "submenu",
        Evidence::Absent => "absent",
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn menu_of(entries: &[(&str, &str, &str)]) -> BTreeMap<String, Entry> {
        index(&json!({ "menu": entries.iter().map(|(p, k, id)| json!({"path": p, "kind": k, "id": id})).collect::<Vec<_>>() }))
    }

    #[test]
    fn norm_ignores_case_ellipses_separators_and_spacing() {
        assert_eq!(norm("Object  >  Transform › Move…"), "object > transform > move");
        assert_eq!(norm("Effect > … > Blur"), "effect > blur");
        assert_eq!(norm("File > Save As..."), "file > save as");
        assert_eq!(norm(""), "");
    }

    #[test]
    fn a_wired_command_is_evidence_of_an_implementation() {
        let menu = menu_of(&[("Object > Group", "command", "object.group")]);
        let pre = prefixes(&menu);
        let row = parity::test_row(&[("element", "Object > Group"), ("element_type", "menu")]);
        assert_eq!(classify(&row, &menu, &pre), Evidence::Command);
    }

    #[test]
    fn a_stub_is_not_evidence_of_an_implementation() {
        let menu = menu_of(&[("File > Scripts", "todo", "")]);
        let pre = prefixes(&menu);
        let row = parity::test_row(&[("element", "File > Scripts"), ("element_type", "menu")]);
        assert_eq!(classify(&row, &menu, &pre), Evidence::Todo);
    }

    #[test]
    fn a_submenu_parent_row_needs_no_code_of_its_own() {
        let menu = menu_of(&[("Object > Transform > Move", "command", "object.transform.move")]);
        let pre = prefixes(&menu);
        let row = parity::test_row(&[("element", "Object > Transform"), ("element_type", "menu")]);
        assert_eq!(classify(&row, &menu, &pre), Evidence::Submenu);
    }

    #[test]
    fn a_submenu_row_that_specifies_a_field_is_still_real_work() {
        let menu = menu_of(&[("Object > Transform > Move", "command", "object.transform.move")]);
        let pre = prefixes(&menu);
        let row = parity::test_row(&[("element", "Object > Transform"), ("element_type", "menu"), ("field", "Shortcut"), ("default", "Ctrl+T")]);
        assert_eq!(classify(&row, &menu, &pre), Evidence::Absent);
    }

    #[test]
    fn an_unknown_path_is_absent() {
        let menu = menu_of(&[("Object > Group", "command", "object.group")]);
        let pre = prefixes(&menu);
        let row = parity::test_row(&[("element", "Effect > 3D > Revolve"), ("element_type", "menu")]);
        assert_eq!(classify(&row, &menu, &pre), Evidence::Absent);
    }

    #[test]
    fn shortcuts_compare_across_platform_spellings_and_modifier_order() {
        assert_eq!(shortcut("Shift+Ctrl+N"), shortcut("Cmd+Shift+N"));
        assert_eq!(shortcut("Alt+Ctrl+S"), shortcut("Cmd+Opt+S"));
        assert_eq!(shortcut("ctrl+n"), Some((vec!["Ctrl".into()], "N".into())));
        assert_eq!(shortcut("F1"), Some((vec![], "F1".into())));
        assert_eq!(shortcut("Ctrl++"), Some((vec!["Ctrl".into()], "+".into())));
        assert_eq!(shortcut(""), None);
        assert_ne!(shortcut("Ctrl+N"), shortcut("Ctrl+Shift+N"));
    }

    #[test]
    fn compare_shortcut_separates_agreement_from_defects() {
        assert_eq!(compare_shortcut("Shift+Ctrl+S", Some("Cmd+Shift+S")), Some(Shortcut::Same));
        assert_eq!(compare_shortcut("Ctrl+S", Some("Cmd+Shift+S")), Some(Shortcut::Differs));
        assert_eq!(compare_shortcut("Ctrl+S", None), Some(Shortcut::Unbound));
        assert_eq!(compare_shortcut("Ctrl+S", Some("")), Some(Shortcut::Unbound));
        // A row that specifies no shortcut is not a comparison at all.
        assert_eq!(compare_shortcut("", Some("Cmd+S")), None);
    }

    #[test]
    fn definitions_find_the_engine_module_not_the_menu_wiring() {
        let root = crate::root();
        let ids: BTreeSet<String> =
            ["file.saveAs", "imageTrace.make", "type.changeCase", "file.print", "object.group"].iter().map(|s| (*s).to_owned()).collect();
        let found = definitions(&root, &crate::repo_files(&root).expect("git ls-files"), &ids);
        for (id, want) in [
            ("file.saveAs", "crates/engine/src/cmd/fileio/save.rs"),
            ("imageTrace.make", "crates/engine/src/cmd/buildcmds.rs"),
            ("type.changeCase", "crates/engine/src/cmd/typemenu.rs"),
            ("file.print", "crates/engine/src/cmd/print.rs"),
        ] {
            let at = found.get(id).unwrap_or_else(|| panic!("{id} was not located"));
            assert!(at.starts_with(want), "{id}: expected {want}, got {at}");
        }
        assert_eq!(found.len(), ids.len(), "every id should be located: {found:?}");
    }

    #[test]
    fn a_path_that_is_both_a_command_and_a_parent_counts_as_the_command() {
        let menu = menu_of(&[("View > Rulers", "command", "view.rulers"), ("View > Rulers > Show", "command", "view.rulers.show")]);
        let pre = prefixes(&menu);
        let row = parity::test_row(&[("element", "View > Rulers"), ("element_type", "menu")]);
        assert_eq!(classify(&row, &menu, &pre), Evidence::Command);
    }
}
