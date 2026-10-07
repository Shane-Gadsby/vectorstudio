//! Help → project links (this fork's repository and the upstream project it is based on). The
//! commands return the URL; the frontend opens it.

use serde_json::{Value, json};

use super::*;

/// The app's id in its repository and packaging.
pub const APP_ID: &str = "vectorstudio";
/// This app's source repository.
pub const REPO_URL: &str = "https://github.com/Shane-Gadsby/vectorstudio";
/// The project this one is based on. Credited in plain text; see NOTICE.
pub const UPSTREAM_URL: &str = "https://github.com/storytold/vectorcraft";

pub fn specs() -> Vec<CommandSpec> {
    vec![
        cmd!(query "help.github", "VectorStudio on GitHub", ["Help"], None, "{} → {url} source code, issues and releases", always, |_, _| url(REPO_URL.into())),
        cmd!(query "help.upstream", "Based on VectorCraft", ["Help"], None, "{} → {url} the upstream project this one is based on", always, |_, _| url(UPSTREAM_URL.into())),
        cmd!(query "help.links", "Links", [], None, "{} → {github, upstream}", always, |_, _| Ok(json!({ "github": REPO_URL, "upstream": UPSTREAM_URL }))),
    ]
}

fn url(u: String) -> Result<Value> {
    Ok(json!({ "url": u }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn links() {
        let mut s = Session::new();
        assert_eq!(s.execute("help.github", &json!({})).unwrap()["url"], "https://github.com/Shane-Gadsby/vectorstudio");
        assert_eq!(s.execute("help.upstream", &json!({})).unwrap()["url"], "https://github.com/storytold/vectorcraft");
        let l = s.execute("help.links", &json!({})).unwrap();
        assert_eq!(l["github"], "https://github.com/Shane-Gadsby/vectorstudio");
        assert_eq!(l["upstream"], "https://github.com/storytold/vectorcraft");
    }
}
