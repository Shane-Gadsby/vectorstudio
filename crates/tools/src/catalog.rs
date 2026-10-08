//! The tool catalogue: ids, labels, shortcuts and toolbar groups (Illustrator's Advanced toolbar order).

use serde::Serialize;

#[derive(Clone, Copy, Debug, Serialize)]
pub struct ToolInfo {
    pub id: &'static str,
    pub label: &'static str,
    /// Single-key shortcut (Shift+key shown as "Shift+X").
    pub shortcut: Option<&'static str>,
    /// Icon name in the UI icon set.
    pub icon: &'static str,
}

const fn t(id: &'static str, label: &'static str, shortcut: Option<&'static str>, icon: &'static str) -> ToolInfo {
    ToolInfo { id, label, shortcut, icon }
}

/// Toolbar groups in order; the first tool of each group is the default visible one.
pub const TOOL_GROUPS: &[&[ToolInfo]] = &[
    &[t("selection", "Selection Tool", Some("V"), "tool-selection")],
    &[
        t("directSelection", "Direct Selection Tool", Some("A"), "tool-direct"),
        t("groupSelection", "Group Selection Tool", None, "tool-group-select"),
    ],
    &[t("magicWand", "Magic Wand Tool", Some("Y"), "tool-magic-wand")],
    &[t("lasso", "Lasso Tool", Some("Q"), "tool-lasso")],
    &[
        t("pen", "Pen Tool", Some("P"), "tool-pen"),
        t("addAnchor", "Add Anchor Point Tool", Some("+"), "tool-pen-add"),
        t("deleteAnchor", "Delete Anchor Point Tool", Some("-"), "tool-pen-delete"),
        t("anchorPoint", "Anchor Point Tool", Some("Shift+C"), "tool-anchor"),
    ],
    &[t("curvature", "Curvature Tool", Some("Shift+~"), "tool-curvature")],
    &[
        t("type", "Type Tool", Some("T"), "tool-type"),
        t("areaType", "Area Type Tool", None, "tool-type-area"),
        t("typeOnPath", "Type on a Path Tool", None, "tool-type-path"),
        t("verticalType", "Vertical Type Tool", None, "tool-type-vertical"),
        t("verticalAreaType", "Vertical Area Type Tool", None, "tool-type-vertical"),
        t("verticalTypeOnPath", "Vertical Type on a Path Tool", None, "tool-type-path"),
        t("touchType", "Touch Type Tool", Some("Shift+T"), "tool-touch-type"),
    ],
    &[
        t("lineSegment", "Line Segment Tool", Some("\\"), "tool-line"),
        t("arc", "Arc Tool", None, "tool-arc"),
        t("spiral", "Spiral Tool", None, "tool-spiral"),
        t("rectangularGrid", "Rectangular Grid Tool", None, "tool-rect-grid"),
        t("polarGrid", "Polar Grid Tool", None, "tool-polar-grid"),
    ],
    &[
        t("rectangle", "Rectangle Tool", Some("M"), "tool-rect"),
        t("roundedRectangle", "Rounded Rectangle Tool", None, "tool-rounded-rect"),
        t("ellipse", "Ellipse Tool", Some("L"), "tool-ellipse"),
        t("polygon", "Polygon Tool", None, "tool-polygon"),
        t("star", "Star Tool", None, "tool-star"),
        t("flare", "Flare Tool", None, "tool-flare"),
    ],
    &[t("paintbrush", "Paintbrush Tool", Some("B"), "tool-brush"), t("blobBrush", "Blob Brush Tool", Some("Shift+B"), "tool-blob-brush")],
    &[
        t("shaper", "Shaper Tool", Some("Shift+N"), "tool-shaper"),
        t("pencil", "Pencil Tool", Some("N"), "tool-pencil"),
        t("smooth", "Smooth Tool", None, "tool-smooth"),
        t("pathEraser", "Path Eraser Tool", None, "tool-path-eraser"),
        t("join", "Join Tool", None, "tool-join"),
    ],
    &[
        t("eraser", "Eraser Tool", Some("Shift+E"), "tool-eraser"),
        t("scissors", "Scissors Tool", Some("C"), "tool-scissors"),
        t("knife", "Knife", None, "tool-knife"),
        t("mirrorCut", "Mirror & Cut Tool", None, "tool-mirror-cut"),
        t("lineCut", "Line Cut Tool", None, "tool-line-cut"),
        t("rectCut", "Rectangle Cut Tool", None, "tool-rect-cut"),
    ],
    &[t("rotate", "Rotate Tool", Some("R"), "tool-rotate"), t("reflect", "Reflect Tool", Some("O"), "tool-reflect")],
    &[
        t("scale", "Scale Tool", Some("S"), "tool-scale"),
        t("shear", "Shear Tool", None, "tool-shear"),
        t("reshape", "Reshape Tool", None, "tool-reshape"),
    ],
    &[
        t("width", "Width Tool", Some("Shift+W"), "tool-width"),
        t("warp", "Warp Tool", Some("Shift+R"), "tool-warp"),
        t("twirl", "Twirl Tool", None, "tool-twirl"),
        t("pucker", "Pucker Tool", None, "tool-pucker"),
        t("bloat", "Bloat Tool", None, "tool-bloat"),
        t("scallop", "Scallop Tool", None, "tool-scallop"),
        t("crystallize", "Crystallize Tool", None, "tool-crystallize"),
        t("wrinkle", "Wrinkle Tool", None, "tool-wrinkle"),
    ],
    &[t("freeTransform", "Free Transform Tool", Some("E"), "tool-free-transform"), t("puppetWarp", "Puppet Warp Tool", None, "tool-puppet")],
    &[
        t("shapeBuilder", "Shape Builder Tool", Some("Shift+M"), "tool-shape-builder"),
        t("livePaintBucket", "Live Paint Bucket", Some("K"), "tool-bucket"),
        t("livePaintSelection", "Live Paint Selection Tool", Some("Shift+L"), "tool-live-select"),
    ],
    &[
        t("perspectiveGrid", "Perspective Grid Tool", Some("Shift+P"), "tool-perspective"),
        t("perspectiveSelection", "Perspective Selection Tool", Some("Shift+V"), "tool-perspective-select"),
    ],
    &[t("mesh", "Mesh Tool", Some("U"), "tool-mesh")],
    &[t("gradient", "Gradient Tool", Some("G"), "tool-gradient")],
    &[t("eyedropper", "Eyedropper Tool", Some("I"), "tool-eyedropper"), t("measure", "Measure Tool", None, "tool-measure")],
    &[t("blend", "Blend Tool", Some("W"), "tool-blend")],
    &[
        t("symbolSprayer", "Symbol Sprayer Tool", Some("Shift+S"), "tool-symbol"),
        t("symbolShifter", "Symbol Shifter Tool", None, "tool-symbol"),
        t("symbolScruncher", "Symbol Scruncher Tool", None, "tool-symbol"),
        t("symbolSizer", "Symbol Sizer Tool", None, "tool-symbol"),
        t("symbolSpinner", "Symbol Spinner Tool", None, "tool-symbol"),
        t("symbolStainer", "Symbol Stainer Tool", None, "tool-symbol"),
        t("symbolScreener", "Symbol Screener Tool", None, "tool-symbol"),
        t("symbolStyler", "Symbol Styler Tool", None, "tool-symbol"),
    ],
    &[
        t("columnGraph", "Column Graph Tool", Some("J"), "tool-graph"),
        t("stackedColumnGraph", "Stacked Column Graph Tool", None, "tool-graph"),
        t("barGraph", "Bar Graph Tool", None, "tool-graph"),
        t("stackedBarGraph", "Stacked Bar Graph Tool", None, "tool-graph"),
        t("lineGraph", "Line Graph Tool", None, "tool-graph"),
        t("areaGraph", "Area Graph Tool", None, "tool-graph"),
        t("scatterGraph", "Scatter Graph Tool", None, "tool-graph"),
        t("pieGraph", "Pie Graph Tool", None, "tool-graph"),
        t("radarGraph", "Radar Graph Tool", None, "tool-graph"),
    ],
    &[
        t("artboard", "Artboard Tool", Some("Shift+O"), "tool-artboard"),
        t("slice", "Slice Tool", Some("Shift+K"), "tool-slice"),
        t("sliceSelection", "Slice Selection Tool", None, "tool-slice"),
    ],
    &[
        t("hand", "Hand Tool", Some("H"), "tool-hand"),
        t("rotateView", "Rotate View Tool", Some("Shift+H"), "tool-rotate-view"),
        t("printTiling", "Print Tiling Tool", None, "tool-print-tiling"),
    ],
    &[t("zoom", "Zoom Tool", Some("Z"), "tool-zoom")],
];

pub fn all_tools() -> impl Iterator<Item = &'static ToolInfo> {
    TOOL_GROUPS.iter().flat_map(|g| g.iter())
}

pub fn tool_info(id: &str) -> Option<&'static ToolInfo> {
    all_tools().find(|t| t.id == id)
}

/// Tool for a single-key shortcut such as "V" or "Shift+M".
pub fn tool_for_shortcut(s: &str) -> Option<&'static ToolInfo> {
    all_tools().find(|t| t.shortcut == Some(s))
}

/// Index of the group containing `id`.
pub fn group_of(id: &str) -> Option<usize> {
    TOOL_GROUPS.iter().position(|g| g.iter().any(|t| t.id == id))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn unique_ids_and_shortcuts() {
        let mut ids: Vec<&str> = all_tools().map(|t| t.id).collect();
        let n = ids.len();
        ids.sort();
        ids.dedup();
        assert_eq!(ids.len(), n, "duplicate tool ids");
        let mut sc: Vec<&str> = all_tools().filter_map(|t| t.shortcut).collect();
        let n = sc.len();
        sc.sort();
        sc.dedup();
        assert_eq!(sc.len(), n, "duplicate shortcuts");
        assert!(n > 40);
    }

    #[test]
    fn lookups() {
        assert_eq!(tool_for_shortcut("V").unwrap().id, "selection");
        assert_eq!(tool_for_shortcut("Shift+M").unwrap().id, "shapeBuilder");
        assert_eq!(group_of("star"), group_of("rectangle"));
    }
}

#[cfg(test)]
mod parity {
    use super::*;

    /// Parity: every tool's shortcut, as Illustrator 30.1 binds it.
    ///
    /// (tool id, the key the reference app uses, matrix row). The values come from `keys.kys`, the
    /// licensed install's own shortcut set, cross-checked by
    /// `research/illustrator/read-kys.mjs`. `=` and `+` are one key -- `+` is Shift+`=` on most
    /// layouts and the UI's parser folds them -- so either spelling passes.
    const TOOL_PARITY: &[(&str, &str, &str)] = &[
        ("addAnchor", "=", "TOOL-0007"),
        ("anchorPoint", "Shift+C", "TOOL-0009"),
        ("artboard", "Shift+O", "TOOL-0078"),
        ("blend", "W", "TOOL-0042"),
        ("blobBrush", "Shift+B", "TOOL-0028"),
        ("columnGraph", "J", "TOOL-0069"),
        ("curvature", "Shift+~", "TOOL-0010"),
        ("deleteAnchor", "-", "TOOL-0008"),
        ("directSelection", "A", "TOOL-0002"),
        ("ellipse", "L", "TOOL-0018"),
        ("eraser", "Shift+E", "TOOL-0081"),
        ("eyedropper", "I", "TOOL-0038"),
        ("freeTransform", "E", "TOOL-0048"),
        ("gradient", "G", "TOOL-0037"),
        ("hand", "H", "TOOL-0084"),
        ("lasso", "Q", "TOOL-0005"),
        ("lineSegment", "\\", "TOOL-0011"),
        ("livePaintBucket", "K", "TOOL-0040"),
        ("livePaintSelection", "Shift+L", "TOOL-0041"),
        ("magicWand", "Y", "TOOL-0004"),
        ("mesh", "U", "TOOL-0036"),
        ("paintbrush", "B", "TOOL-0027"),
        ("pen", "P", "TOOL-0006"),
        ("pencil", "N", "TOOL-0023"),
        ("perspectiveGrid", "Shift+P", "TOOL-0059"),
        ("perspectiveSelection", "Shift+V", "TOOL-0060"),
        ("rectangle", "M", "TOOL-0016"),
        ("reflect", "O", "TOOL-0044"),
        ("rotate", "R", "TOOL-0043"),
        ("rotateView", "Shift+H", "TOOL-0090"),
        ("scale", "S", "TOOL-0045"),
        ("scissors", "C", "TOOL-0082"),
        ("selection", "V", "TOOL-0001"),
        ("shapeBuilder", "Shift+M", "TOOL-0058"),
        ("shaper", "Shift+N", "TOOL-0022"),
        ("slice", "Shift+K", "TOOL-0079"),
        ("symbolSprayer", "Shift+S", "TOOL-0061"),
        ("touchType", "Shift+T", "TOOL-0035"),
        ("type", "T", "TOOL-0029"),
        ("warp", "Shift+R", "TOOL-0051"),
        ("width", "Shift+W", "TOOL-0050"),
        ("zoom", "Z", "TOOL-0086"),
    ];

    /// Do two shortcut spellings name the same chord?
    fn same_key(a: &str, b: &str) -> bool {
        let split = |s: &str| {
            let mut parts: Vec<String> = s.split('+').map(str::to_ascii_uppercase).collect();
            let last = parts.pop().unwrap_or_default();
            // A bare "+" splits to ["", ""], which would leave an empty modifier behind.
            parts.retain(|p| !p.is_empty());
            parts.sort();
            (parts, if last.is_empty() || last == "+" { "=".to_owned() } else { last })
        };
        split(a) == split(b)
    }

    #[test]
    fn tool_shortcuts_match_the_reference_app() {
        for (id, want, row) in TOOL_PARITY {
            let tool = tool_info(id).unwrap_or_else(|| panic!("{row}: no tool {id}"));
            let got = tool.shortcut.unwrap_or_else(|| panic!("{row}: {id} has no shortcut"));
            assert!(same_key(got, want), "{row}: {id} binds {got}, the reference app uses {want}");
        }
        assert_eq!(TOOL_PARITY.len(), 42, "every tool row the audit matches should be pinned here");
    }

    #[test]
    fn no_two_tools_claim_the_same_key() {
        let mut seen: std::collections::HashMap<String, &str> = std::collections::HashMap::new();
        for t in all_tools() {
            if let Some(sc) = t.shortcut
                && let Some(other) = seen.insert(sc.to_ascii_uppercase(), t.id)
            {
                panic!("{} and {other} both claim {sc}", t.id);
            }
        }
    }
}
