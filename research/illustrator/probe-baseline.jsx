// VectorSuite research probe: capture Illustrator 30.1 baseline facts.
//
// Run in a LICENSED Illustrator 30.1: File > Scripts > Other Script... and pick
// this file. It creates a temporary document, reads presets and defaults
// through the scripting DOM, closes the temporary document WITHOUT saving,
// and writes `vs-probe-baseline.json` next to this script (or to the desktop
// if that folder isn't writable). Nothing else is changed.
//
// ExtendScript is ES3: no let/const, arrow functions, Array.map or JSON.

#target illustrator

(function () {
  var out = { probe: "baseline", version: 1, errors: [] };
  var skip = { reflect: 1, typename: 1, parent: 1, __proto__: 1 };

  function err(where, e) { out.errors.push(where + ": " + (e && e.message ? e.message : String(e))); }

  // Host objects become plain values; nested host objects become their typename.
  function plain(v, depth) {
    if (v === null || v === undefined) return null;
    var t = typeof v;
    if (t === "number") return isFinite(v) ? v : null;
    if (t === "string" || t === "boolean") return v;
    if (v instanceof Array) {
      var a = [];
      for (var i = 0; i < v.length; i++) a.push(plain(v[i], depth + 1));
      return a;
    }
    if (depth > 0) {
      try { return v.typename ? "<" + v.typename + ">" : String(v); } catch (e) { return String(v); }
    }
    return dump(v);
  }

  // Every readable property, found by reflection.
  function dump(obj) {
    var o = {};
    var props;
    try { props = obj.reflect.properties; } catch (e) { return String(obj); }
    for (var i = 0; i < props.length; i++) {
      var name = props[i].name;
      if (skip[name]) continue;
      try { o[name] = plain(obj[name], 1); } catch (e) { o[name] = "<error: " + e.message + ">"; }
    }
    try { o.typename = obj.typename; } catch (e) {}
    return o;
  }

  function names(collection) {
    var a = [];
    try { for (var i = 0; i < collection.length; i++) a.push(collection[i].name); } catch (e) { a.push("<error: " + e.message + ">"); }
    return a;
  }

  function list(getter, where) {
    try { return plain(getter(), 0); } catch (e) { err(where, e); return null; }
  }

  // --- application ---
  try {
    out.app = { version: app.version, buildNumber: app.buildNumber, locale: app.locale, os: $.os,
      scriptingVersion: app.scriptingVersion, userInteractionLevel: String(app.userInteractionLevel) };
  } catch (e) { err("app", e); }

  // --- built-in preset lists ---
  out.presetLists = {
    tracing: list(function () { return app.tracingPresetsList; }, "tracingPresetsList"),
    pdf: list(function () { return app.PDFPresetsList; }, "PDFPresetsList"),
    print: list(function () { return app.printPresetsList; }, "printPresetsList"),
    flattener: list(function () { return app.flattenerPresetsList; }, "flattenerPresetsList"),
    startup: list(function () { return app.startupPresetsList; }, "startupPresetsList"),
    brushLibraries: null
  };

  // --- New Document profiles ---
  out.documentPresets = {};
  var startup = out.presetLists.startup || [];
  for (var s = 0; s < startup.length; s++) {
    try { out.documentPresets[startup[s]] = dump(app.getPresetSettings(startup[s])); } catch (e) { err("getPresetSettings " + startup[s], e); }
  }

  // --- temporary document: default contents, then Image Trace presets ---
  var doc = null;
  var savedInteraction = app.userInteractionLevel;
  app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;
  try {
    doc = app.documents.add(DocumentColorSpace.RGB, 400, 400);
    out.defaultDocument = {
      colorSpace: String(doc.documentColorSpace), rulerUnits: String(doc.rulerUnits),
      rasterEffectSettings: (function () { try { return dump(doc.rasterEffectSettings); } catch (e) { return null; } })(),
      swatches: names(doc.swatches), swatchGroups: names(doc.swatchGroups), brushes: names(doc.brushes),
      symbols: names(doc.symbols), graphicStyles: names(doc.graphicStyles), characterStyles: names(doc.characterStyles),
      paragraphStyles: names(doc.paragraphStyles), gradients: names(doc.gradients), patterns: names(doc.patterns)
    };
  } catch (e) { err("new document", e); }

  if (doc) {
    try {
      // A raster to trace: rasterize a small filled rectangle.
      var rect = doc.pathItems.rectangle(300, 100, 200, 200);
      var ro = new RasterizeOptions();
      ro.resolution = 72;
      var raster = doc.rasterize(rect, rect.geometricBounds, ro);
      var traced = raster.trace();
      var options = traced.tracing.tracingOptions;
      out.tracingOptionProperties = [];
      var props = options.reflect.properties;
      for (var p = 0; p < props.length; p++) if (!skip[props[p].name]) out.tracingOptionProperties.push(props[p].name);
      out.tracingOptionMethods = [];
      var methods = options.reflect.methods;
      for (var m = 0; m < methods.length; m++) out.tracingOptionMethods.push(methods[m].name);
      out.tracingDefaultOnMake = dump(options);
      out.tracingPresets = {};
      var presets = out.presetLists.tracing || [];
      for (var t = 0; t < presets.length; t++) {
        try {
          options.loadFromPreset(presets[t]);
          out.tracingPresets[presets[t]] = dump(options);
        } catch (e) { err("loadFromPreset " + presets[t], e); }
      }
    } catch (e) { err("image trace", e); }
    try { doc.close(SaveOptions.DONOTSAVECHANGES); } catch (e) { err("close temporary document", e); }
  }
  app.userInteractionLevel = savedInteraction;

  // --- serialise (no JSON object in ExtendScript) ---
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

  var text = json(out, 0) + "\n";
  var here = File($.fileName).parent;
  var target = new File(here.fsName + "/vs-probe-baseline.json");
  target.encoding = "UTF-8";
  if (!target.open("w")) {
    target = new File(Folder.desktop.fsName + "/vs-probe-baseline.json");
    target.encoding = "UTF-8";
    target.open("w");
  }
  target.write(text);
  target.close();
  alert("VectorSuite probe done.\n\nWrote: " + target.fsName + "\nErrors: " + out.errors.length);
})();
