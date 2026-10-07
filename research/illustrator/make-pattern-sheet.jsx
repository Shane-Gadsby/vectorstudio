// VectorSuite research: the starting sheet for fixture 23-pattern.ai (task 0.3.5).
//
// Makes a document with a small circle (the pattern's source art) and a
// larger rectangle to fill with the resulting swatch, both named so
// ai-art-objects.mjs --named can map them. Like make-effect-sheet.jsx it
// first removes the startup library resources (symbols, graphic styles,
// swatches, …), which can't go into a fixture (R4), so the only pattern in
// the saved file is the one the person makes.
//
//   node scripts/research/illustrator/run-job.mjs scripts/research/illustrator/make-pattern-sheet.jsx \
//     --args '{"out":"Z:\\temp\\fixtures-manual\\23-pattern.ai"}'
//
// The person then selects the circle, runs Object > Pattern > Make with the
// dialog's defaults, presses Done, selects the rectangle and clicks the new
// swatch, and saves over the file.
//
// The document stays open for the person to work in. ExtendScript is ES3.

#target illustrator

(function () {
  var args = typeof VS_ARGS !== "undefined" ? VS_ARGS : {};
  var saved = app.userInteractionLevel;
  app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;
  var d = app.documents.add(DocumentColorSpace.RGB, 600, 400);
  d.rulerOrigin = [0, 0];
  var kinds = ["symbols", "graphicStyles", "swatches", "gradients", "patterns", "brushes", "spots", "swatchGroups"];
  for (var k = 0; k < kinds.length; k++) {
    for (var r = d[kinds[k]].length - 1; r >= 0; r--) { try { d[kinds[k]][r].remove(); } catch (e) {} }
  }
  function rgb(r, g, b) { var c = new RGBColor(); c.red = r; c.green = g; c.blue = b; return c; }

  var circle = d.pathItems.ellipse(360, 40, 40, 40);
  circle.filled = true; circle.fillColor = rgb(0, 120, 255);
  circle.stroked = false;
  circle.name = "1 pattern source";

  var rect = d.pathItems.rectangle(300, 160, 240, 160);
  rect.filled = true; rect.fillColor = rgb(200, 200, 200);
  rect.stroked = true; rect.strokeColor = rgb(0, 0, 0); rect.strokeWidth = 2;
  rect.name = "2 pattern fill";

  var o = new IllustratorSaveOptions();
  o.embedICCProfile = false;
  o.pdfCompatible = true;
  o.compressed = true;
  d.saveAs(new File(args.out), o);
  app.userInteractionLevel = saved;
  return "saved circle + rectangle to " + args.out;
})();
