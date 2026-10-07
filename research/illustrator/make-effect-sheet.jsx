// VectorSuite research: a starting sheet for a hand-made fixture (task 0.3.5).
//
// Makes a document with one stroked, filled rectangle per entry in
// VS_ARGS.names, named after it (the Layers panel shows the names, in order
// from the bottom), and saves it to VS_ARGS.out. VS_ARGS.width, .height and
// .stroked (default 90, 60, true) change the rectangles: a gradient mesh or a
// freeform gradient wants a bigger one with no stroke. Like make-fixtures.jsx it
// first removes the startup library resources (symbols, graphic styles,
// swatches, …), which can't go into a fixture (R4). A person then
// applies each named effect from the Effect menu and saves over it. No text
// is drawn, so no font data ends up in the fixture.
//
//   node scripts/research/illustrator/run-job.mjs scripts/research/illustrator/make-effect-sheet.jsx \
//     --args '{"out":"Z:\\temp\\fixtures-manual\\21-effects-menu.ai","names":["Round Corners", …]}'
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
  var w = args.width || 90;
  var h = args.height || 60;
  var stroked = args.stroked === undefined ? true : args.stroked;
  for (var i = 0; i < names.length; i++) {
    var p = d.pathItems.rectangle(380 - Math.floor(i / 5) * (h + 30), 20 + (i % 5) * (w + 25), w, h);
    p.filled = true; p.fillColor = rgb(0, 120, 255);
    if (stroked) { p.stroked = true; p.strokeColor = rgb(0, 0, 0); p.strokeWidth = 2; }
    else { p.stroked = false; }
    p.name = names[i];
  }
  var o = new IllustratorSaveOptions();
  o.embedICCProfile = false;
  o.pdfCompatible = true;
  o.compressed = true;
  d.saveAs(new File(args.out), o);
  app.userInteractionLevel = saved;
  return "saved " + names.length + " rectangles to " + args.out;
})();
