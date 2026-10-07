//! `cargo run -p vectorcraft-ui-egui --example dump-surface` prints the app's menu surface as
//! JSON, for `cargo xtask parity --audit` to join against `docs/parity/matrix.csv`.
//!
//! The menu tree is the honest ground truth for "does this exist": it carries the real menu paths
//! and labels, and `Item::Todo` marks the entries that are placed but not implemented. The engine
//! registry alone is not enough, because commands the UI owns (`file.open`, which needs a file
//! picker) carry no menu path of their own.
//!
//! Each row is `{path, label, kind, id?, shortcut?, params?}`, where `kind` is one of:
//! * `command` — wired to a command id, so something runs. Its `shortcut` comes from
//!   `menus::item_shortcut`, which resolves the *item's* key: the Window menu's entries all run
//!   `window.panel`, and each panel has its own binding, so the command's own shortcut is wrong
//!   for them;
//! * `todo` — in the menu, not implemented (upstream's own stub marker);
//! * `header` — a disabled section label, nothing to implement.

use serde_json::{Value, json};
use vectorcraft_ui_egui::menus::{Item, UI_COMMANDS, item_shortcut, menu_tree};

fn walk(prefix: &str, items: &[Item], out: &mut Vec<Value>) {
    for item in items {
        match item {
            // The item's own shortcut, not its command's: `window.panel` is one command behind
            // every Window menu entry, and each panel binds its own key.
            Item::Cmd(label, id, params) => out.push(json!({
                "path": format!("{prefix} > {label}"),
                "label": label,
                "kind": "command",
                "id": id,
                "shortcut": item_shortcut(id, params),
                "params": if params.is_null() { Value::Null } else { params.clone() },
            })),
            Item::Todo(label, shortcut) => out.push(json!({
                "path": format!("{prefix} > {label}"),
                "label": label,
                "kind": "todo",
                "shortcut": if shortcut.is_empty() { Value::Null } else { json!(shortcut) },
            })),
            Item::Header(label) => out.push(json!({
                "path": format!("{prefix} > {label}"),
                "label": label,
                "kind": "header",
            })),
            Item::Sub(label, children) => walk(&format!("{prefix} > {label}"), children, out),
            Item::Sep => {}
        }
    }
}

fn main() {
    let mut menu = Vec::new();
    for (top, items) in menu_tree() {
        walk(top, &items, &mut menu);
    }
    let ui: Vec<Value> = UI_COMMANDS.iter().map(|(id, label, shortcut, _)| json!({ "id": id, "label": label, "shortcut": shortcut })).collect();
    let engine: Vec<Value> = vectorcraft_engine::cmd::command_specs()
        .iter()
        .map(|c| json!({ "id": c.id, "label": c.label, "menu": c.menu, "shortcut": c.shortcut }))
        .collect();
    let out = json!({ "menu": menu, "ui_commands": ui, "engine_commands": engine });
    match serde_json::to_string_pretty(&out) {
        Ok(text) => println!("{text}"),
        Err(e) => {
            eprintln!("error: could not serialise the surface: {e}");
            std::process::exit(1);
        }
    }
}
