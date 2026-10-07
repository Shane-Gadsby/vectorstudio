// VectorSuite research: strip a document's library resources before it
// becomes a fixture (R4: Adobe's startup symbols, graphic styles, swatches,
// gradients, patterns and brushes can't be redistributed).
//
// Opens VS_ARGS.in, removes every symbol, named graphic style, swatch,
// gradient, pattern, brush, spot and swatch group that Illustrator lets go
// (anything in use stays), saves to VS_ARGS.out and closes. Returns what was
// left, as make-fixtures.jsx records it. Art styles on objects are unnamed
// (Anon) and aren't in d.graphicStyles, so the art keeps its effects.
//
//   node scripts/research/illustrator/run-job.mjs scripts/research/illustrator/purge-resources.jsx \
//     --args '{"in":"Z:\\temp\\x.ai","out":"Z:\\temp\\x-purged.ai"}'
//
// ExtendScript is ES3.

#target illustrator

(function () {
  var args = typeof VS_ARGS !== "undefined" ? VS_ARGS : {};
  var saved = app.userInteractionLevel;
  app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;
  var d = app.open(new File(args["in"]));
  var kinds = ["symbols", "graphicStyles", "swatches", "gradients", "patterns", "brushes", "spots", "swatchGroups"];
  var left = [];
  for (var pass = 0; pass < 2; pass++) { // symbols can hold styles and swatches, so go round twice
    for (var k = 0; k < kinds.length; k++) {
      var coll = d[kinds[k]];
      for (var i = coll.length - 1; i >= 0; i--) { try { coll[i].remove(); } catch (e) {} }
    }
  }
  for (k = 0; k < kinds.length; k++) {
    var names = [];
    for (var j = 0; j < d[kinds[k]].length; j++) { try { names.push(d[kinds[k]][j].name); } catch (e) { names.push("?"); } }
    if (names.length) left.push(kinds[k] + ": " + names.join(" | "));
  }
  var o = new IllustratorSaveOptions();
  o.embedICCProfile = false;
  o.pdfCompatible = true;
  o.compressed = true;
  d.saveAs(new File(args.out), o);
  d.close(SaveOptions.DONOTSAVECHANGES);
  app.userInteractionLevel = saved;
  return "left: " + left.join("; ");
})();
