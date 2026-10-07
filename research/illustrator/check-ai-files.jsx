// VectorSuite research: open .ai files in Illustrator and report what it made
// of them, objectively (artboards, layers, path bounds, whether the art sits
// on the first artboard). Used to judge write-spike rounds without eyeballing.
//
// Run as an agent job (vs-agent.ps1) with a VS_ARGS header prepended by
// scripts/research/illustrator/run-job.mjs:
//   var VS_ARGS = { folder: "Z:\\temp\\write-spike-3", out: "Z:\\temp\\jobs\\done\\x.json",
//                   pattern: "*.ai", resaveTo: "" };
// resaveTo, when set, saves Illustrator's own copy of each file there.
// Alerts are suppressed while files open; a file Illustrator could not read
// as .ai shows up as a PDF import (see docName/warnings below).
//
// ExtendScript is ES3: no let/const, arrow functions, Array.map or JSON.

#target illustrator

(function () {
  var args = typeof VS_ARGS !== "undefined" ? VS_ARGS : {};
  var folder = new Folder(args.folder);
  var files = folder.getFiles(args.pattern || "*.ai");
  var report = { checker: "check-ai-files.jsx", app: app.version, folder: folder.fsName, files: [] };
  var saved = app.userInteractionLevel;
  app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;

  function r2(v) { return Math.round(v * 100) / 100; }
  function rect(a) { return [r2(a[0]), r2(a[1]), r2(a[2]), r2(a[3])]; }
  // [left, top, right, bottom], document coordinates (y up).
  function inside(b, ab) { return b[0] >= ab[0] - 0.01 && b[2] <= ab[2] + 0.01 && b[1] <= ab[1] + 0.01 && b[3] >= ab[3] - 0.01; }

  files.sort(function (a, b) { return a.name < b.name ? -1 : 1; });
  for (var i = 0; i < files.length; i++) {
    var f = files[i];
    var entry = { file: f.name, bytes: f.length };
    var before = app.documents.length;
    try {
      var d = app.open(f);
      entry.opened = true;
      entry.docName = d.name;
      entry.openedAsFile = d.fullName ? d.fullName.fsName === f.fsName : false;
      entry.colorSpace = String(d.documentColorSpace);
      entry.artboards = [];
      for (var a = 0; a < d.artboards.length; a++) entry.artboards.push({ name: d.artboards[a].name, rect: rect(d.artboards[a].artboardRect) });
      entry.layers = [];
      for (var l = 0; l < d.layers.length; l++) entry.layers.push(d.layers[l].name);
      entry.pathCount = d.pathItems.length;
      entry.paths = [];
      var ab0 = d.artboards.length ? d.artboards[0].artboardRect : null;
      var allInside = d.pathItems.length > 0;
      for (var p = 0; p < d.pathItems.length && p < 10; p++) {
        var b = d.pathItems[p].geometricBounds;
        var fill = null;
        try { var c = d.pathItems[p].fillColor; if (c.typename === "RGBColor") fill = [r2(c.red), r2(c.green), r2(c.blue)]; else fill = c.typename; } catch (e) {}
        var on = ab0 ? inside(b, ab0) : false;
        if (!on) allInside = false;
        entry.paths.push({ bounds: rect(b), onFirstArtboard: on, fill: fill });
      }
      entry.allPathsOnFirstArtboard = allInside;
      if (args.resaveTo) {
        var target = new File(args.resaveTo + "/" + f.name.replace(/\.ai$/i, "") + "-illustrator.ai");
        var o = new IllustratorSaveOptions();
        o.embedICCProfile = false;
        d.saveAs(target, o);
        entry.resaved = target.fsName;
      }
    } catch (e) {
      entry.opened = entry.opened || false;
      entry.error = e.message;
    }
    while (app.documents.length > before) {
      try { app.documents[0].close(SaveOptions.DONOTSAVECHANGES); } catch (e2) { break; }
    }
    report.files.push(entry);
  }
  app.userInteractionLevel = saved;

  function q(s) { return '"' + String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r/g, "\\r").replace(/\n/g, "\\n") + '"'; }
  function json(v) {
    if (v === null || v === undefined) return "null";
    if (typeof v === "number" || typeof v === "boolean") return String(v);
    if (typeof v === "string") return q(v);
    var parts = [], k;
    if (v instanceof Array) { for (k = 0; k < v.length; k++) parts.push(json(v[k])); return "[" + parts.join(",") + "]"; }
    for (k in v) if (v.hasOwnProperty(k)) parts.push(q(k) + ":" + json(v[k]));
    return "{" + parts.join(",") + "}";
  }
  var text = json(report);
  if (args.out) {
    var out = new File(args.out);
    out.encoding = "UTF-8";
    out.open("w"); out.write(text); out.close();
  }
  return "checked " + report.files.length + " file(s)";
})();
