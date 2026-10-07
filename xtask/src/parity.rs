//! `cargo xtask parity`: validate and report the Illustrator parity matrix.
//!
//! `docs/parity/matrix.csv` is the source of truth for 1:1 Illustrator 30.1 behaviour: one row per
//! observable thing (a dialog field and its default, range and unit; a menu item; a shortcut; a
//! tool modifier). Rows graded `verified` were confirmed against a *licensed* Illustrator 30.1
//! through the research bridge in `research/illustrator/`; the other confidence grades say where
//! the claim came from and how far to trust it. See `docs/parity/README.md`.
//!
//! The gate fails on anything that would quietly rot the matrix:
//!
//! - an unexpected header, a ragged row, or a duplicate `id`;
//! - a value outside the vocabulary of `scope`, `status` or `confidence`;
//! - a row claiming `status: done` or `partial` without an `impl_ref` saying which code satisfies
//!   it, so coverage can never be inflated by editing one column;
//! - a row claiming `confidence: verified` without a `verified_by` and a `verified_date`.
//!
//! It then prints coverage by status, confidence, phase and area. `--strict` additionally fails
//! when a `done` row cites no `test_id`, which is the bar for calling an area finished.

use std::collections::BTreeMap;
use std::path::Path;

/// The columns of `matrix.csv`, in order.
const COLUMNS: &[&str] = &[
    "id",
    "area",
    "element_type",
    "element",
    "field",
    "default",
    "range",
    "unit",
    "behaviour",
    "command_id",
    "since",
    "phase",
    "scope",
    "status",
    "confidence",
    "source",
    "test_id",
    "verified_by",
    "verified_date",
    "impl_ref",
];

/// Is this row in, out of, or postponed past the 1:1 goal?
const SCOPE: &[&str] = &["in", "out", "deferred"];
/// How far the implementation has got. `n/a` is for rows that need no code (a note, a heading).
const STATUS: &[&str] = &["planned", "partial", "done", "n/a"];
/// Where the behaviour claim came from, best first. `verified` means a licensed 30.1 said so.
const CONFIDENCE: &[&str] = &["verified", "doc-30", "plan-2020", "unverified"];

pub struct Row {
    pub cells: Vec<String>,
}

fn column(col: &str) -> usize {
    COLUMNS.iter().position(|c| *c == col).expect("known column")
}

impl Row {
    pub fn get(&self, col: &str) -> &str {
        self.cells.get(column(col)).map_or("", String::as_str)
    }

    pub fn set(&mut self, col: &str, value: &str) {
        let i = column(col);
        if self.cells.len() <= i {
            self.cells.resize(i + 1, String::new());
        }
        self.cells[i] = value.to_owned();
    }
}

/// A row with the required columns filled in, for tests.
#[cfg(test)]
pub fn test_row(overrides: &[(&str, &str)]) -> Row {
    let mut row = Row { cells: vec![String::new(); COLUMNS.len()] };
    for (col, v) in [("id", "X-0001"), ("scope", "in"), ("status", "planned"), ("confidence", "plan-2020")] {
        row.set(col, v);
    }
    for (col, v) in overrides {
        row.set(col, v);
    }
    row
}

/// One CSV field, quoted only when it has to be.
fn quote(field: &str) -> String {
    if field.contains([',', '"', '\n', '\r']) { format!("\"{}\"", field.replace('"', "\"\"")) } else { field.to_owned() }
}

/// `header` and `rows` back as CSV text, in the shape [`parse`] reads.
pub fn write_csv(header: &[String], rows: &[Row]) -> String {
    let mut out = String::new();
    for record in std::iter::once(header).chain(rows.iter().map(|r| r.cells.as_slice())) {
        let line: Vec<String> = record.iter().map(|f| quote(f)).collect();
        out.push_str(&line.join(","));
        out.push('\n');
    }
    out
}

/// Split one CSV line into fields, honouring `"` quoting and `""` escapes.
fn split_line(line: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut cur = String::new();
    let mut quoted = false;
    let mut chars = line.chars().peekable();
    while let Some(c) = chars.next() {
        match c {
            '"' if quoted && chars.peek() == Some(&'"') => {
                cur.push('"');
                chars.next();
            }
            '"' => quoted = !quoted,
            ',' if !quoted => out.push(std::mem::take(&mut cur)),
            _ => cur.push(c),
        }
    }
    out.push(cur);
    out
}

/// Parse `matrix.csv`. A `behaviour` cell may hold newlines inside quotes, so lines are joined
/// until the quotes balance.
pub fn parse(text: &str) -> Result<(Vec<String>, Vec<Row>), String> {
    let mut records: Vec<String> = Vec::new();
    for line in text.lines() {
        let open = records.last().is_some_and(|r: &String| r.chars().filter(|c| *c == '"').count() % 2 == 1);
        if open {
            let last = records.last_mut().expect("checked non-empty");
            last.push('\n');
            last.push_str(line);
        } else if !line.is_empty() {
            records.push(line.to_owned());
        }
    }
    let mut it = records.into_iter();
    let header = split_line(&it.next().ok_or("matrix.csv is empty")?);
    if header != COLUMNS {
        return Err(format!("matrix.csv header is\n  {}\nexpected\n  {}", header.join(","), COLUMNS.join(",")));
    }
    let rows: Vec<Row> = it.map(|r| Row { cells: split_line(&r) }).collect();
    Ok((header, rows))
}

/// Every schema and bookkeeping problem in `rows`, as human-readable lines.
pub fn problems(rows: &[Row], strict: bool) -> Vec<String> {
    let mut bad = Vec::new();
    let mut seen: BTreeMap<&str, usize> = BTreeMap::new();
    for (n, row) in rows.iter().enumerate() {
        // Row 1 is the header, so a data row's line number is its index + 2.
        let at = |what: String| format!("row {} ({}): {what}", n + 2, row.get("id"));
        if row.cells.len() != COLUMNS.len() {
            bad.push(at(format!("has {} fields, expected {}", row.cells.len(), COLUMNS.len())));
            continue;
        }
        let id = row.get("id");
        if id.is_empty() {
            bad.push(at("has no id".into()));
        } else if let Some(first) = seen.insert(id, n + 2) {
            bad.push(at(format!("duplicate id, first seen on row {first}")));
        }
        for (col, allowed) in [("scope", SCOPE), ("status", STATUS), ("confidence", CONFIDENCE)] {
            let v = row.get(col);
            if !allowed.contains(&v) {
                bad.push(at(format!("{col} is `{v}`, expected one of {}", allowed.join(", "))));
            }
        }
        let status = row.get("status");
        if matches!(status, "done" | "partial") && row.get("impl_ref").is_empty() {
            bad.push(at(format!("status is `{status}` but impl_ref is empty: cite the code that satisfies this row")));
        }
        if row.get("confidence") == "verified" && (row.get("verified_by").is_empty() || row.get("verified_date").is_empty()) {
            bad.push(at("confidence is `verified` but verified_by/verified_date is empty".into()));
        }
        if strict && status == "done" && row.get("test_id").is_empty() {
            bad.push(at("status is `done` but test_id is empty (--strict)".into()));
        }
    }
    bad
}

/// Count `key(row)` over the rows it is `Some` for, highest first.
fn tally<'a>(rows: &'a [Row], key: impl Fn(&'a Row) -> Option<&'a str>) -> Vec<(&'a str, usize)> {
    let mut counts: BTreeMap<&str, usize> = BTreeMap::new();
    for r in rows {
        if let Some(k) = key(r) {
            *counts.entry(k).or_default() += 1;
        }
    }
    let mut v: Vec<(&str, usize)> = counts.into_iter().collect();
    v.sort_by(|a, b| b.1.cmp(&a.1).then(a.0.cmp(b.0)));
    v
}

fn line(label: &str, counts: &[(&str, usize)]) {
    let body: Vec<String> = counts.iter().map(|(k, n)| format!("{k} {n}")).collect();
    println!("{label:<14} {}", body.join(", "));
}

pub fn report(rows: &[Row]) {
    let scoped: Vec<&Row> = rows.iter().filter(|r| r.get("scope") == "in").collect();
    let done = scoped.iter().filter(|r| r.get("status") == "done").count();
    let partial = scoped.iter().filter(|r| r.get("status") == "partial").count();
    let verified = scoped.iter().filter(|r| r.get("confidence") == "verified").count();
    let pct = |n: usize| if scoped.is_empty() { 0.0 } else { n as f64 * 100.0 / scoped.len() as f64 };

    println!("parity: {} rows, {} in scope", rows.len(), scoped.len());
    println!(
        "  done {}/{} ({:.1} %), partial {} ({:.1} %), verified {}/{} ({:.1} %)",
        done,
        scoped.len(),
        pct(done),
        partial,
        pct(partial),
        verified,
        scoped.len(),
        pct(verified)
    );
    line("by scope:", &tally(rows, |r| Some(r.get("scope"))));
    line("by status:", &tally(rows, |r| Some(r.get("status"))));
    line("by confidence:", &tally(rows, |r| Some(r.get("confidence"))));

    println!("\nin scope by area (done/total):");
    let areas = tally(rows, |r| (r.get("scope") == "in").then(|| r.get("area")));
    for (area, total) in areas.iter().take(30) {
        let d = scoped.iter().filter(|r| r.get("area") == *area && r.get("status") == "done").count();
        println!("  {area:<28} {d:>4}/{total:<5} {:>5.1} %", if *total == 0 { 0.0 } else { d as f64 * 100.0 / *total as f64 });
    }
    if areas.len() > 30 {
        println!("  … and {} more areas", areas.len() - 30);
    }
}

pub fn run(root: &Path, strict: bool) -> Result<(), String> {
    let path = root.join("docs/parity/matrix.csv");
    let text = std::fs::read_to_string(&path).map_err(|e| format!("{}: {e}", path.display()))?;
    let (_, rows) = parse(&text)?;
    let bad = problems(&rows, strict);
    if !bad.is_empty() {
        return Err(format!("{} problem(s) in docs/parity/matrix.csv:\n  {}", bad.len(), bad.join("\n  ")));
    }
    report(&rows);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    use super::test_row as row;

    #[test]
    fn splits_quoted_fields_with_commas_and_escapes() {
        let f = split_line(r#"a,"b, still b","say ""hi""",d"#);
        assert_eq!(f, vec!["a", "b, still b", r#"say "hi""#, "d"]);
    }

    #[test]
    fn joins_records_across_newlines_inside_quotes() {
        let text = format!("{}\nX-1,\"two\nlines\"{}", COLUMNS.join(","), ",".repeat(COLUMNS.len() - 2));
        let (_, rows) = parse(&text).expect("parses");
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].get("area"), "two\nlines");
    }

    #[test]
    fn rejects_an_unexpected_header() {
        assert!(parse("id,area\nX-1,Shell").is_err());
    }

    #[test]
    fn a_clean_row_has_no_problems() {
        assert_eq!(problems(&[row(&[])], true), Vec::<String>::new());
    }

    #[test]
    fn rejects_values_outside_the_vocabulary() {
        let bad = problems(&[row(&[("status", "shipped")])], false);
        assert_eq!(bad.len(), 1, "{bad:?}");
        assert!(bad[0].contains("status is `shipped`"), "{bad:?}");
    }

    #[test]
    fn rejects_duplicate_ids() {
        let bad = problems(&[row(&[]), row(&[])], false);
        assert!(bad.iter().any(|b| b.contains("duplicate id, first seen on row 2")), "{bad:?}");
    }

    #[test]
    fn done_and_partial_must_cite_an_impl() {
        for status in ["done", "partial"] {
            let bad = problems(&[row(&[("status", status)])], false);
            assert!(bad.iter().any(|b| b.contains("impl_ref is empty")), "{status}: {bad:?}");
        }
        let ok = problems(&[row(&[("status", "done"), ("impl_ref", "crates/tools/src/pen.rs")])], false);
        assert_eq!(ok, Vec::<String>::new());
    }

    #[test]
    fn verified_must_say_who_and_when() {
        let bad = problems(&[row(&[("confidence", "verified")])], false);
        assert!(bad.iter().any(|b| b.contains("verified_by/verified_date")), "{bad:?}");
        let ok = problems(&[row(&[("confidence", "verified"), ("verified_by", "probe-baseline.jsx"), ("verified_date", "2026-09-24")])], false);
        assert_eq!(ok, Vec::<String>::new());
    }

    #[test]
    fn strict_wants_a_test_for_every_done_row() {
        let cited = &[("status", "done"), ("impl_ref", "crates/tools/src/pen.rs")];
        assert_eq!(problems(&[row(cited)], false), Vec::<String>::new());
        let bad = problems(&[row(cited)], true);
        assert!(bad.iter().any(|b| b.contains("test_id is empty")), "{bad:?}");
    }

    #[test]
    fn write_csv_round_trips_quotes_commas_and_newlines() {
        let header: Vec<String> = COLUMNS.iter().map(|c| (*c).to_owned()).collect();
        let r = row(&[("behaviour", "a, b \"quoted\"\nand a second line"), ("element", "plain")]);
        let text = write_csv(&header, std::slice::from_ref(&r));
        let (h, back) = parse(&text).expect("round-trips");
        assert_eq!(h, header);
        assert_eq!(back.len(), 1);
        assert_eq!(back[0].get("behaviour"), "a, b \"quoted\"\nand a second line");
        assert_eq!(back[0].get("element"), "plain");
    }

    #[test]
    fn write_csv_leaves_the_real_matrix_byte_identical() {
        let text = std::fs::read_to_string(crate::root().join("docs/parity/matrix.csv")).expect("readable");
        let (header, rows) = parse(&text).expect("parses");
        assert_eq!(write_csv(&header, &rows), text, "re-writing the matrix unchanged must not reformat it");
    }

    #[test]
    fn the_real_matrix_parses_and_passes_the_gate() {
        let path = crate::root().join("docs/parity/matrix.csv");
        let text = std::fs::read_to_string(&path).expect("docs/parity/matrix.csv is readable");
        let (_, rows) = parse(&text).expect("the matrix parses");
        assert!(rows.len() > 1800, "expected the full matrix, got {} rows", rows.len());
        assert_eq!(problems(&rows, false), Vec::<String>::new());
    }
}
