// VectorSuite research: build the `.ai` fixture corpus (task 0.3.1), v2 and v3.
//
// v2: each new document is PURGED of the startup profile's resources (swatches,
// symbols, graphic styles, gradients, patterns, and brushes where Illustrator
// allows) before any art is drawn, because v1 showed every file otherwise
// carries ~1 MB of Adobe's library artwork, which can't be redistributed (R4).
// What couldn't be removed is recorded in the manifest. v2 also sets the
// Compatibility option directly (v1's enum reflection failed in 30.1).
//
// Run in a LICENSED Illustrator 30.1: File > Scripts > Other Script... and pick
// this file. It builds small documents from simple artwork of our own (shapes
// and text made by this script, nothing from Adobe's libraries), saves each as
// `.ai` into a `fixtures` folder next to this script, closes it without
// further changes, and writes `fixtures/manifest.json` describing every file
// and any step that failed. ICC profiles are never embedded (they are Adobe's),
// and the type fixtures are saved without PDF compatibility so no font data is
// embedded.
//
// v3 (task 0.3.5) adds the live features v2 lacks, as far as scripting can
// make them without a dialog: every live effect applied with its defaults, an
// Image Trace per tracing preset, a blend on a replaced spine, and a swatch
// group and graphic style. Run it as an agent job (vs-agent.ps1) with
//   node scripts/research/illustrator/run-job.mjs scripts/research/illustrator/make-fixtures.jsx \
//     --args '{"set":"v3","out":"Z:\\temp\\fixtures-v3"}'
// VS_ARGS: set "v2" (the default, as when run from the Scripts menu), "v3" or
// "all"; out, the output folder (default fixtures-<set> next to this script).
// Under the agent no alert is shown; the script returns its summary instead.
//
// ExtendScript is ES3: no let/const, arrow functions, Array.map or JSON.

#target illustrator

(function () {
  var args = typeof VS_ARGS !== "undefined" ? VS_ARGS : null;
  var wanted = (args && args.set) || "v2";
  var here = File($.fileName).parent;
  var outDir = new Folder(args && args.out ? args.out : here.fsName + "/fixtures-" + wanted);
  if (!outDir.exists) outDir.create();

  var manifest = { generator: "make-fixtures.jsx", version: wanted === "v3" ? 3 : 2, set: wanted, app: app.version, build: app.buildNumber,
    os: $.os, fixtures: [] };
  var building = "v2"; // the set the fixtures below belong to; fixture() skips the others

  var savedLevel = app.userInteractionLevel;
  app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;

  // ---------- helpers ----------
  function rgb(r, g, b) { var c = new RGBColor(); c.red = r; c.green = g; c.blue = b; return c; }
  function cmyk(c, m, y, k) { var x = new CMYKColor(); x.cyan = c; x.magenta = m; x.yellow = y; x.black = k; return x; }
  // Removes every startup resource that can be removed; returns what is left.
  function purge(d) {
    var kinds = ["symbols", "graphicStyles", "swatches", "gradients", "patterns", "brushes", "spots", "swatchGroups"];
    var left = {};
    for (var k = 0; k < kinds.length; k++) {
      var coll = d[kinds[k]];
      for (var i = coll.length - 1; i >= 0; i--) {
        try { coll[i].remove(); } catch (e) {}
      }
      var names = [];
      for (var j = 0; j < coll.length; j++) { try { names.push(coll[j].name); } catch (e) { names.push("?"); } }
      if (names.length) left[kinds[k]] = names;
    }
    return left;
  }
  var lastPurge = null;
  function newDoc(space, w, h) {
    var d = app.documents.add(space || DocumentColorSpace.RGB, w || 400, h || 300);
    d.rulerOrigin = [0, 0];
    lastPurge = purge(d);
    return d;
  }
  // rectangle(top, left, width, height) in Illustrator's y-up document coordinates.
  function rect(d, top, left, w, h, fill, stroke) {
    var p = d.pathItems.rectangle(top, left, w, h);
    p.filled = Boolean(fill);
    if (fill) p.fillColor = fill;
    p.stroked = Boolean(stroke);
    if (stroke) { p.strokeColor = stroke; p.strokeWidth = 2; }
    return p;
  }
  function menu(id, d, items) {
    d.selection = null;
    for (var i = 0; i < items.length; i++) items[i].selected = true;
    app.executeMenuCommand(id);
    d.selection = null;
  }

  /**
   * Saves `d` as fixtures/<name>.ai with `opts` applied over the defaults and
   * records the outcome. opts.compatibility is an enum member name.
   */
  function save(d, name, description, opts, entry) {
    opts = opts || {};
    var o = new IllustratorSaveOptions();
    o.embedICCProfile = false;
    o.embedLinkedFiles = false;
    o.saveMultipleArtboards = false;
    o.fontSubsetThreshold = 100;
    o.pdfCompatible = opts.pdfCompatible !== false;
    o.compressed = opts.compressed !== false;
    var record = { file: name + ".ai", description: description,
      options: { pdfCompatible: o.pdfCompatible, compressed: o.compressed, compatibility: opts.compatibility || "(default: current)" },
      steps: entry ? entry.steps : [], leftAfterPurge: lastPurge, ok: false };
    try {
      if (opts.compatibility) {
        var c = Compatibility[opts.compatibility];
        if (c === undefined) throw new Error("Compatibility." + opts.compatibility + " is undefined in this version");
        o.compatibility = c;
      }
      var f = new File(outDir.fsName + "/" + name + ".ai");
      d.saveAs(f, o);
      record.ok = true;
      record.bytes = new File(f.fsName).length;
    } catch (e) { record.error = e.message; }
    manifest.fixtures.push(record);
    return record;
  }

  /** Runs one fixture builder of the wanted set; closes its document whatever happens. */
  function fixture(fn) {
    if (wanted !== "all" && building !== wanted) return;
    var entry = { steps: [] };
    var before = app.documents.length;
    try { fn(entry); } catch (e) { entry.steps.push("FAILED: " + e.message); manifest.fixtures.push({ file: "(build failed)", steps: entry.steps, ok: false }); }
    // Close whatever this fixture opened, even if it failed half-way (the newest document is documents[0]).
    while (app.documents.length > before) {
      try { app.documents[0].close(SaveOptions.DONOTSAVECHANGES); } catch (e) { break; }
    }
  }
  function step(entry, label, fn) {
    try { fn(); entry.steps.push("ok: " + label); } catch (e) { entry.steps.push("FAILED " + label + ": " + e.message); }
  }

  // ---------- 01: the minimal file, under every save-option variant ----------
  var variants = [
    ["01-minimal", {}, "One RGB red rectangle, one layer, one artboard. Default options (current format, PDF compatible, compressed)."],
    ["01-minimal-nopdf", { pdfCompatible: false }, "As 01-minimal, without PDF compatibility (private data only)."],
    ["01-minimal-uncompressed", { compressed: false }, "As 01-minimal, with Use Compression off."],
    ["01-minimal-nopdf-uncompressed", { pdfCompatible: false, compressed: false }, "As 01-minimal, neither PDF compatible nor compressed."],
    ["01-minimal-ai2020", { compatibility: "ILLUSTRATOR24" }, "As 01-minimal, with Compatibility explicitly Illustrator 2020."],
    ["01-minimal-cc-legacy", { compatibility: "ILLUSTRATOR17" }, "As 01-minimal, saved as Illustrator CC (Legacy)."],
    ["01-minimal-cs6", { compatibility: "ILLUSTRATOR16" }, "As 01-minimal, saved as Illustrator CS6."],
    ["01-minimal-ai10", { compatibility: "ILLUSTRATOR10" }, "As 01-minimal, saved as Illustrator 10."],
    ["01-minimal-ai8", { compatibility: "ILLUSTRATOR8" }, "As 01-minimal, saved as Illustrator 8 (EPS-style)."],
    ["01-minimal-ai3", { compatibility: "ILLUSTRATOR3" }, "As 01-minimal, saved as Illustrator 3."]
  ];
  for (var v = 0; v < variants.length; v++) {
    (function (name, opts, description) {
      fixture(function (entry) {
        var d = newDoc(DocumentColorSpace.RGB, 400, 300);
        rect(d, 250, 50, 200, 150, rgb(255, 0, 0), null);
        save(d, name, description, opts, entry);
        return d;
      });
    })(variants[v][0], variants[v][1], variants[v][2]);
  }

  // ---------- 02: CMYK document ----------
  fixture(function (entry) {
    var d = newDoc(DocumentColorSpace.CMYK, 400, 300);
    rect(d, 250, 50, 200, 150, cmyk(0, 100, 100, 0), cmyk(0, 0, 0, 100));
    save(d, "02-cmyk", "CMYK document: one rectangle, CMYK fill and stroke.", {}, entry);
    return d;
  });

  // ---------- 03: layers ----------
  fixture(function (entry) {
    var d = newDoc();
    var base = d.layers[0];
    base.name = "Background";
    rect(d, 300, 0, 400, 300, rgb(230, 230, 230), null);
    var art = d.layers.add(); art.name = "Art";
    rect(d, 250, 50, 100, 100, rgb(0, 128, 255), null).move(art, ElementPlacement.PLACEATBEGINNING);
    var detail = art.layers.add(); detail.name = "Detail";
    rect(d, 200, 100, 40, 40, rgb(255, 200, 0), null).move(detail, ElementPlacement.PLACEATBEGINNING);
    var hidden = d.layers.add(); hidden.name = "Hidden";
    rect(d, 150, 250, 60, 60, rgb(0, 200, 0), null).move(hidden, ElementPlacement.PLACEATBEGINNING);
    hidden.visible = false;
    var locked = d.layers.add(); locked.name = "Locked";
    rect(d, 80, 250, 60, 60, rgb(200, 0, 200), null).move(locked, ElementPlacement.PLACEATBEGINNING);
    locked.locked = true;
    var tmpl = d.layers.add(); tmpl.name = "Nonprinting";
    rect(d, 80, 20, 60, 60, rgb(120, 120, 120), null).move(tmpl, ElementPlacement.PLACEATBEGINNING);
    tmpl.printable = false;
    save(d, "03-layers", "Layers: Background, Art with sublayer Detail, a hidden layer, a locked layer, a non-printing layer.", {}, entry);
    return d;
  });

  // ---------- 04: paths ----------
  fixture(function (entry) {
    var d = newDoc();
    step(entry, "open polyline, dashed, round caps", function () {
      var p = d.pathItems.add();
      p.setEntirePath([[30, 40], [90, 120], [150, 40], [210, 120]]);
      p.closed = false; p.filled = false; p.stroked = true;
      p.strokeColor = rgb(0, 0, 0); p.strokeWidth = 4;
      p.strokeDashes = [12, 6]; p.strokeCap = StrokeCap.ROUNDENDCAP; p.strokeJoin = StrokeJoin.BEVELENDJOIN;
    });
    step(entry, "smooth closed curve with handles", function () {
      var p = d.pathItems.add();
      var pts = [[260, 150, 230, 150, 290, 150], [330, 220, 330, 190, 330, 250], [260, 290, 290, 290, 230, 290], [190, 220, 190, 250, 190, 190]];
      for (var i = 0; i < pts.length; i++) {
        var pp = p.pathPoints.add();
        pp.anchor = [pts[i][0], pts[i][1]];
        pp.leftDirection = [pts[i][2], pts[i][3]];
        pp.rightDirection = [pts[i][4], pts[i][5]];
        pp.pointType = PointType.SMOOTH;
      }
      p.closed = true; p.filled = true; p.fillColor = rgb(255, 128, 0); p.stroked = false;
    });
    step(entry, "corner triangle, miter join, even-odd", function () {
      var p = d.pathItems.add();
      p.setEntirePath([[40, 180], [120, 280], [160, 190]]);
      p.closed = true; p.filled = true; p.fillColor = rgb(0, 160, 120);
      p.stroked = true; p.strokeColor = rgb(0, 0, 0); p.strokeWidth = 3; p.strokeMiterLimit = 8; p.strokeJoin = StrokeJoin.MITERENDJOIN;
      p.evenodd = true;
    });
    save(d, "04-paths", "Paths: dashed open polyline (round caps, bevel join), smooth closed curve with handles, even-odd corner triangle with miter join.", {}, entry);
    return d;
  });

  // ---------- 05: groups, compound path, clipping mask ----------
  fixture(function (entry) {
    var d = newDoc();
    step(entry, "group of two", function () {
      var g = d.groupItems.add(); g.name = "Pair";
      rect(d, 280, 20, 60, 60, rgb(255, 0, 0), null).move(g, ElementPlacement.PLACEATEND);
      rect(d, 260, 50, 60, 60, rgb(0, 0, 255), null).move(g, ElementPlacement.PLACEATEND);
    });
    step(entry, "compound path with a hole", function () {
      var outer = rect(d, 280, 160, 100, 100, rgb(0, 0, 0), null);
      var inner = rect(d, 255, 185, 50, 50, rgb(0, 0, 0), null);
      menu("compoundPath", d, [outer, inner]);
    });
    step(entry, "clipping group", function () {
      var art = rect(d, 140, 20, 160, 100, rgb(0, 200, 100), null);
      var clip = d.pathItems.ellipse(130, 40, 120, 80);
      menu("makeMask", d, [art, clip]);
    });
    save(d, "05-structure", "Structure: a named group of two rectangles, a compound path with a hole, a clipping group (ellipse clipping a rectangle).", {}, entry);
    return d;
  });

  // ---------- 06: paint ----------
  fixture(function (entry) {
    var d = newDoc();
    step(entry, "spot colour swatch at 50% tint", function () {
      var spot = d.spots.add(); spot.name = "VS Spot Teal"; spot.color = rgb(0, 128, 128); spot.colorType = ColorModel.SPOT;
      var sc = new SpotColor(); sc.spot = spot; sc.tint = 50;
      rect(d, 280, 20, 80, 80, sc, null);
    });
    step(entry, "global process swatch", function () {
      var g = d.spots.add(); g.name = "VS Global Orange"; g.color = rgb(255, 140, 0); g.colorType = ColorModel.PROCESS;
      var sc = new SpotColor(); sc.spot = g; sc.tint = 100;
      rect(d, 280, 120, 80, 80, sc, null);
    });
    step(entry, "linear gradient, three stops", function () {
      var gr = d.gradients.add(); gr.name = "VS Linear"; gr.type = GradientType.LINEAR;
      gr.gradientStops[0].color = rgb(255, 0, 0); gr.gradientStops[1].color = rgb(0, 0, 255);
      var mid = gr.gradientStops.add(); mid.rampPoint = 50; mid.color = rgb(0, 255, 0);
      var gc = new GradientColor(); gc.gradient = gr;
      rect(d, 170, 20, 160, 80, gc, null);
    });
    step(entry, "radial gradient", function () {
      var gr = d.gradients.add(); gr.name = "VS Radial"; gr.type = GradientType.RADIAL;
      gr.gradientStops[0].color = rgb(255, 255, 255); gr.gradientStops[1].color = rgb(40, 40, 120);
      var gc = new GradientColor(); gc.gradient = gr;
      var e = d.pathItems.ellipse(170, 220, 120, 80); e.fillColor = gc; e.stroked = false;
    });
    step(entry, "50% opacity, Multiply", function () {
      var p = rect(d, 70, 240, 100, 50, rgb(255, 0, 255), null);
      p.opacity = 50; p.blendingMode = BlendModes.MULTIPLY;
    });
    save(d, "06-paint", "Paint: 50% tint of a spot swatch, a global process swatch, a three-stop linear gradient, a radial gradient, an object at 50% opacity in Multiply.", {}, entry);
    return d;
  });

  // ---------- 07: type (no PDF compatibility, so no font data is embedded) ----------
  fixture(function (entry) {
    var d = newDoc();
    var font = null;
    try { font = app.textFonts.getByName("ArialMT"); } catch (e) { font = app.textFonts[0]; }
    entry.steps.push("font: " + font.name);
    step(entry, "point text", function () {
      var t = d.textFrames.add(); t.contents = "VectorSuite"; t.position = [20, 280];
      t.textRange.characterAttributes.size = 24; t.textRange.characterAttributes.textFont = font;
    });
    step(entry, "area text, two paragraphs", function () {
      var box = d.pathItems.rectangle(220, 20, 180, 100);
      var t = d.textFrames.areaText(box);
      t.contents = "First paragraph of area type.\rSecond paragraph, justified.";
      t.textRange.characterAttributes.textFont = font; t.textRange.characterAttributes.size = 12;
      t.paragraphs[1].paragraphAttributes.justification = Justification.FULLJUSTIFY;
    });
    step(entry, "type on a path", function () {
      var arc = d.pathItems.add();
      arc.setEntirePath([[220, 60], [300, 140], [380, 60]]);
      var t = d.textFrames.pathText(arc);
      t.contents = "Text on a path"; t.textRange.characterAttributes.textFont = font; t.textRange.characterAttributes.size = 14;
    });
    save(d, "07-type", "Type: point text, two-paragraph area text (second justified), type on a path. Font ArialMT (or the first installed font). Saved without PDF compatibility.", { pdfCompatible: false }, entry);
    return d;
  });

  // ---------- 08: symbols ----------
  fixture(function (entry) {
    var d = newDoc();
    step(entry, "symbol from a star, three instances", function () {
      var star = d.pathItems.star(150, 200, 40, 16, 5);
      star.fillColor = rgb(255, 200, 0); star.stroked = false;
      var sym = d.symbols.add(star); sym.name = "VS Star";
      star.remove();
      for (var i = 0; i < 3; i++) {
        var inst = d.symbolItems.add(sym);
        inst.position = [40 + i * 110, 200];
        if (i === 1) inst.resize(150, 150);
        if (i === 2) inst.rotate(30);
      }
    });
    save(d, "08-symbols", "Symbols: one symbol (a star) with three instances: plain, scaled 150%, rotated 30°.", {}, entry);
    return d;
  });

  // ---------- 09-12: live objects made with menu commands ----------
  fixture(function (entry) {
    var d = newDoc();
    step(entry, "blend of two circles", function () {
      var a = d.pathItems.ellipse(250, 30, 40, 40); a.fillColor = rgb(255, 0, 0); a.stroked = false;
      var b = d.pathItems.ellipse(100, 300, 60, 60); b.fillColor = rgb(0, 0, 255); b.stroked = false;
      menu("Path Blend Make", d, [a, b]);
    });
    save(d, "09-blend", "Blend: Object > Blend > Make between two circles (default options).", {}, entry);
    return d;
  });
  fixture(function (entry) {
    var d = newDoc();
    step(entry, "live paint group", function () {
      var a = rect(d, 250, 50, 150, 120, rgb(255, 0, 0), rgb(0, 0, 0));
      var b = rect(d, 200, 120, 150, 120, rgb(0, 0, 255), rgb(0, 0, 0));
      menu("Make Planet X", d, [a, b]);
    });
    save(d, "10-live-paint", "Live Paint: Object > Live Paint > Make on two overlapping rectangles.", {}, entry);
    return d;
  });
  var repeats = [["Make Radial Repeat", "11-repeat-radial", "Repeat: Object > Repeat > Radial on a small rectangle."],
    ["Make Grid Repeat", "11-repeat-grid", "Repeat: Object > Repeat > Grid on a small rectangle."],
    ["Make Symmetry Repeat", "11-repeat-mirror", "Repeat: Object > Repeat > Mirror on a small rectangle."]];
  for (var ri = 0; ri < repeats.length; ri++) {
    (function (id, name, description) {
      fixture(function (entry) {
        var d = newDoc();
        step(entry, id, function () { menu(id, d, [rect(d, 200, 150, 40, 20, rgb(0, 120, 255), null)]); });
        save(d, name, description, {}, entry);
        return d;
      });
    })(repeats[ri][0], repeats[ri][1], repeats[ri][2]);
  }
  fixture(function (entry) {
    var d = newDoc();
    step(entry, "envelope with top object", function () {
      var art = rect(d, 250, 50, 200, 120, rgb(0, 180, 90), null);
      var top = d.pathItems.ellipse(260, 40, 220, 140);
      menu("Make Envelope", d, [art, top]);
    });
    save(d, "12-envelope", "Envelope: Object > Envelope Distort > Make with Top Object (an ellipse over a rectangle).", {}, entry);
    return d;
  });

  // ---------- 13: live effect ----------
  fixture(function (entry) {
    var d = newDoc();
    step(entry, "drop shadow live effect", function () {
      var p = rect(d, 250, 80, 160, 100, rgb(255, 220, 0), null);
      p.applyEffect('<LiveEffect name="Adobe Drop Shadow"><Dict data="R horz 7 R vert 7 R blur 5 R opac 0.75 R dark 50 I blnd 1 I csrc 0 B pdfp 1"/></LiveEffect>');
    });
    save(d, "13-live-effect", "Live effect: Effect > Stylize > Drop Shadow applied through applyEffect.", {}, entry);
    return d;
  });

  // ---------- 14: image trace ----------
  fixture(function (entry) {
    var d = newDoc();
    step(entry, "rasterize and trace (live tracing object)", function () {
      var a = rect(d, 250, 50, 120, 120, rgb(255, 0, 0), null);
      var b = d.pathItems.ellipse(230, 150, 120, 120); b.fillColor = rgb(0, 0, 255); b.stroked = false;
      var g = d.groupItems.add(); a.move(g, ElementPlacement.PLACEATEND); b.move(g, ElementPlacement.PLACEATEND);
      var ro = new RasterizeOptions(); ro.resolution = 72;
      var raster = d.rasterize(g, g.geometricBounds, ro);
      var traced = raster.trace();
      traced.tracing.tracingOptions.loadFromPreset("[Default]");
      app.redraw();
    });
    save(d, "14-image-trace", "Image Trace: a rasterized square and circle traced with [Default], left live (not expanded).", {}, entry);
    return d;
  });

  // ---------- 15: artboards ----------
  fixture(function (entry) {
    var d = newDoc(DocumentColorSpace.RGB, 400, 300);
    step(entry, "three named artboards", function () {
      d.artboards[0].name = "Main";
      var a2 = d.artboards.add([450, 300, 650, 100]); a2.name = "Square";
      var a3 = d.artboards.add([0, -50, 612, -842]); a3.name = "Letter";
      rect(d, 250, 50, 100, 100, rgb(255, 0, 0), null);
      rect(d, 280, 470, 160, 160, rgb(0, 0, 255), null);
      rect(d, -100, 50, 400, 300, rgb(0, 160, 0), null);
    });
    save(d, "15-artboards", "Artboards: three named artboards (400×300 Main, 200×200 Square, 612×792 Letter), one rectangle on each.", {}, entry);
    return d;
  });

  // ---------- v3 (task 0.3.5): live features v2 lacks ----------
  building = "v3";

  // 16: every live effect, applied with an empty parameter dictionary so the
  // file records its defaults. The names are candidates (the internal names
  // aren't documented); one that isn't an effect leaves its rectangle plain.
  var effects = ["Adobe Round Corners", "Adobe Inner Glow", "Adobe Outer Glow", "Adobe Fuzzy Mask", "Adobe Feather",
    "Adobe Scribble Fill", "Adobe Offset Path", "Adobe Outline Object", "Adobe Outline Stroke", "Adobe Pucker & Bloat",
    "Adobe Roughen", "Adobe Transform", "Adobe Tweak", "Adobe Twirl", "Adobe Twist", "Adobe Zig Zag", "Adobe Free Distort",
    "Adobe Deform", "Adobe Shape Effects", "Adobe Pathfinder", "Adobe Rasterize", "Adobe 3D Effect", "Adobe Geometry3D Extrude",
    "Adobe Geometry3D", "Adobe PSL Gaussian Blur", "Adobe Trim Marks", "Adobe Corner Annotator", "Adobe SVG Filter",
    "Adobe Stroke Offset", "Adobe Drop Shadow"];
  fixture(function (entry) {
    var d = newDoc(DocumentColorSpace.RGB, 600, 400);
    for (var i = 0; i < effects.length; i++) {
      (function (name, i) {
        step(entry, "applyEffect " + name, function () {
          var p = rect(d, 380 - Math.floor(i / 6) * 75, 20 + (i % 6) * 95, 70, 45, rgb(0, 120, 255), rgb(0, 0, 0));
          p.name = name;
          p.applyEffect('<LiveEffect name="' + name.replace(/&/g, "&amp;") + '"><Dict data=""/></LiveEffect>');
        });
      })(effects[i], i);
    }
    save(d, "16-live-effects", "Live effects: one stroked rectangle per candidate effect name (named after it), each applied through applyEffect with an empty dictionary, so the art styles record each effect's defaults. Order: left to right, top to bottom.", {}, entry);
    return d;
  });

  // 17: one live trace per tracing preset.
  fixture(function (entry) {
    var d = newDoc(DocumentColorSpace.RGB, 600, 400);
    var presets = app.tracingPresetsList;
    entry.steps.push("presets: " + presets.join(" | "));
    for (var i = 0; i < presets.length; i++) {
      (function (preset, i) {
        step(entry, "trace " + preset, function () {
          var x = 20 + (i % 6) * 95, top = 380 - Math.floor(i / 6) * 95;
          var a = rect(d, top, x, 40, 40, rgb(255, 0, 0), null);
          var b = d.pathItems.ellipse(top - 20, x + 25, 40, 40); b.fillColor = rgb(0, 0, 255); b.stroked = false;
          var g = d.groupItems.add(); a.move(g, ElementPlacement.PLACEATEND); b.move(g, ElementPlacement.PLACEATEND);
          var ro = new RasterizeOptions(); ro.resolution = 72;
          var traced = d.rasterize(g, g.geometricBounds, ro).trace();
          traced.tracing.tracingOptions.loadFromPreset(preset);
          traced.name = preset;
        });
      })(presets[i], i);
    }
    app.redraw();
    save(d, "17-trace-presets", "Image Trace: the same square-and-circle raster traced once per tracing preset (named after it), left live. Order: left to right, top to bottom, in app.tracingPresetsList order.", {}, entry);
    return d;
  });

  // 18: a blend whose spine was replaced by a curve, then reversed.
  fixture(function (entry) {
    var d = newDoc();
    var blend = null;
    step(entry, "blend of two circles", function () {
      var a = d.pathItems.ellipse(250, 30, 40, 40); a.fillColor = rgb(255, 0, 0); a.stroked = false;
      var b = d.pathItems.ellipse(100, 300, 60, 60); b.fillColor = rgb(0, 0, 255); b.stroked = false;
      menu("Path Blend Make", d, [a, b]);
      blend = d.pageItems[0];
    });
    step(entry, "replace spine with an arc", function () {
      var spine = d.pathItems.add();
      var pts = [[50, 150, 50, 150, 50, 230], [200, 280, 120, 280, 280, 280], [350, 150, 350, 230, 350, 150]];
      for (var i = 0; i < pts.length; i++) {
        var pp = spine.pathPoints.add();
        pp.anchor = [pts[i][0], pts[i][1]]; pp.leftDirection = [pts[i][2], pts[i][3]]; pp.rightDirection = [pts[i][4], pts[i][5]];
      }
      spine.filled = false; spine.stroked = true; spine.strokeColor = rgb(0, 0, 0);
      menu("Path Blend Replace Spine", d, [blend, spine]);
    });
    step(entry, "reverse spine", function () { menu("Path Blend Reverse Spine", d, [d.pageItems[0]]); });
    save(d, "18-blend-spine", "Blend: two circles blended (default options), the spine replaced by a three-point arc, then reversed.", {}, entry);
    return d;
  });

  // 19: a swatch group, and a graphic style made from a styled object (last:
  // the New Graphic Style command is the one step that might show a dialog).
  fixture(function (entry) {
    var d = newDoc();
    step(entry, "swatch group with two swatches", function () {
      var sg = d.swatchGroups.add(); sg.name = "VS Group";
      var s1 = d.swatches.add(); s1.name = "VS Red"; s1.color = rgb(200, 30, 30); sg.addSwatch(s1);
      var s2 = d.swatches.add(); s2.name = "VS Teal"; s2.color = rgb(0, 128, 128); sg.addSwatch(s2);
      rect(d, 280, 20, 60, 60, s1.color, null);
    });
    step(entry, "graphic style from a rectangle with round corners and a drop shadow", function () {
      var p = rect(d, 280, 150, 120, 80, rgb(255, 200, 0), rgb(0, 0, 0));
      p.applyEffect('<LiveEffect name="Adobe Round Corners"><Dict data="R radi 12"/></LiveEffect>');
      p.applyEffect('<LiveEffect name="Adobe Drop Shadow"><Dict data="R horz 7 R vert 7 R blur 5 R opac 0.75 R dark 50 I blnd 1 I csrc 0 B pdfp 1"/></LiveEffect>');
      d.selection = null; p.selected = true;
      app.executeMenuCommand("Adobe New Style Shortcut");
      d.selection = null;
      var names = [];
      for (var i = 0; i < d.graphicStyles.length; i++) names.push(d.graphicStyles[i].name);
      entry.steps.push("graphic styles: " + names.join(" | "));
      if (d.graphicStyles.length > 1) {
        var style = d.graphicStyles[d.graphicStyles.length - 1];
        style.name = "VS Rounded Shadow";
        style.applyTo(rect(d, 150, 150, 120, 80, rgb(0, 160, 255), null));
      }
    });
    save(d, "19-styles-swatches", "Resources: a swatch group (VS Group: VS Red, VS Teal), and a graphic style (VS Rounded Shadow: round corners 12 pt and a drop shadow) made with New Graphic Style from one rectangle and applied to a second.", {}, entry);
    return d;
  });

  app.userInteractionLevel = savedLevel;

  // ---------- manifest (no JSON object in ExtendScript) ----------
  function q(s) {
    return '"' + String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r/g, "\\r").replace(/\n/g, "\\n").replace(/\t/g, "\\t") + '"';
  }
  function json(v, ind) {
    var pad = "", i;
    for (i = 0; i < ind; i++) pad += "  ";
    if (v === null || v === undefined) return "null";
    if (typeof v === "number" || typeof v === "boolean") return String(v);
    if (typeof v === "string") return q(v);
    var parts = [];
    if (v instanceof Array) {
      if (!v.length) return "[]";
      for (i = 0; i < v.length; i++) parts.push(pad + "  " + json(v[i], ind + 1));
      return "[\n" + parts.join(",\n") + "\n" + pad + "]";
    }
    for (var k in v) if (v.hasOwnProperty(k)) parts.push(pad + "  " + q(k) + ": " + json(v[k], ind + 1));
    return parts.length ? "{\n" + parts.join(",\n") + "\n" + pad + "}" : "{}";
  }
  var mf = new File(outDir.fsName + "/manifest.json");
  mf.encoding = "UTF-8";
  mf.open("w");
  mf.write(json(manifest, 0) + "\n");
  mf.close();
  var ok = 0;
  for (var m = 0; m < manifest.fixtures.length; m++) if (manifest.fixtures[m].ok) ok++;
  var summary = "VectorSuite fixtures (" + wanted + "): " + ok + " of " + manifest.fixtures.length + " saved to " + outDir.fsName;
  if (!args) alert(summary);
  return summary;
})();
