// VectorSuite research: a starting sheet of named open paths (task 0.3.5).
//
// Makes a document with one open S-curve per entry in VS_ARGS.names, stroked
// at VS_ARGS.strokeWidth (default 2 pt) and named after it, stacked down the
// left of the artboard so there is room to draw by hand beside them. Like
// make-effect-sheet.jsx it first removes the startup library resources
// (symbols, graphic styles, swatches, …), which can't go into a fixture (R4).
//
//   node scripts/research/illustrator/run-job.mjs scripts/research/illustrator/make-path-sheet.jsx \
//     --args '{"out":"Z:\\temp\\fixtures-manual\\26-width-live-shapes.ai","names":["1 …","2 …"],"strokeWidth":10}'
//
// The document stays open for the person to work in. ExtendScript is ES3.

#target illustrator

(function () {
  var args = typeof VS_ARGS !== "undefined" ? VS_ARGS : {};
  var names = args.names || [];
  var saved = app.userInteractionLevel;
  app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;
  var d = app.documents.add(DocumentColorSpace.RGB, 600, 400);
  d.rulerOrigin = [0, 0];
  var kinds = ["symbols", "graphicStyles", "swatches", "gradients", "patterns", "brushes", "spots", "swatchGroups"];
  for (var k = 0; k < kinds.length; k++) {
    for (var r = d[kinds[k]].length - 1; r >= 0; r--) { try { d[kinds[k]][r].remove(); } catch (e) {} }
  }
  function rgb(r, g, b) { var c = new RGBColor(); c.red = r; c.green = g; c.blue = b; return c; }
  var width = args.strokeWidth || 2;
  for (var i = 0; i < names.length; i++) {
    var y = 360 - i * 60;
    var p = d.pathItems.add();
    p.setEntirePath([[30, y], [110, y + 25], [190, y - 25], [270, y]]);
    p.closed = false;
    p.filled = false;
    p.stroked = true; p.strokeColor = rgb(0, 0, 0); p.strokeWidth = width;
    p.name = names[i];
  }
  var o = new IllustratorSaveOptions();
  o.embedICCProfile = false;
  o.pdfCompatible = true;
  o.compressed = true;
  d.saveAs(new File(args.out), o);
  app.userInteractionLevel = saved;
  return "saved " + names.length + " open paths at " + width + " pt to " + args.out;
})();
