// VectorSuite research: the starting sheet for fixture 27-blend-options.ai
// (task 0.3.5).
//
// Makes VS_ARGS.names.length rows, each two circles of different colours, and
// blends each pair with Object > Blend > Make ("Path Blend Make", which opens
// no dialog), naming the resulting blend after its entry. Blend Options is a
// dialog, so the person sets that by hand, one blend per row. Like
// make-effect-sheet.jsx it first removes the startup library resources, which
// can't go into a fixture (R4).
//
//   node scripts/research/illustrator/run-job.mjs scripts/research/illustrator/make-blend-sheet.jsx \
//     --args '{"out":"Z:\\temp\\fixtures-manual\\27-blend-options.ai","names":["1 …","2 …","3 …"]}'
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
  function circle(top, left, colour) {
    var p = d.pathItems.ellipse(top, left, 40, 40);
    p.filled = true; p.fillColor = colour;
    p.stroked = false;
    return p;
  }

  var made = [];
  for (var i = 0; i < names.length; i++) {
    var top = 370 - i * 120;
    var a = circle(top, 40, rgb(0, 120, 255));
    var b = circle(top, 400, rgb(255, 80, 0));
    d.selection = [a, b];
    app.executeMenuCommand("Path Blend Make");
    // The blend replaces the pair; it is the frontmost item, and the DOM may
    // not list it until a redraw, so take it from the selection.
    var blend = d.selection.length ? d.selection[0] : d.pageItems[0];
    blend.name = names[i];
    made.push(names[i]);
  }
  d.selection = null;

  var o = new IllustratorSaveOptions();
  o.embedICCProfile = false;
  o.pdfCompatible = true;
  o.compressed = true;
  d.saveAs(new File(args.out), o);
  app.userInteractionLevel = saved;
  return "blended " + made.join(", ") + " into " + args.out;
})();
