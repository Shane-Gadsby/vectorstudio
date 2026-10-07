// VectorSuite research: the starting sheet for fixture 24-brushes.ai (task 0.3.5).
//
// Makes a document with a small star (the art the four brushes are defined
// from) and four open paths, one per brush, all named so
// ai-art-objects.mjs --named can map them. Like make-effect-sheet.jsx it
// first removes the startup library resources (symbols, graphic styles,
// swatches, brushes, …), which can't go into a fixture (R4), so the only
// brushes in the saved file are the ones the person makes.
//
//   node scripts/research/illustrator/run-job.mjs scripts/research/illustrator/make-brush-sheet.jsx \
//     --args '{"out":"Z:\\temp\\fixtures-manual\\24-brushes.ai"}'
//
// The person then defines an Art, Scatter, Pattern and Calligraphic brush
// (Brushes panel > New Brush, defaults each; the first three from the star),
// strokes one path with each, and saves over the file.
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

  var star = d.pathItems.star(80, 340, 30, 15, 5);
  star.filled = true; star.fillColor = rgb(0, 120, 255);
  star.stroked = false;
  star.name = "1 brush source star";

  // One open S-curve per brush, stacked down the artboard.
  var names = ["2 art brush", "3 scatter brush", "4 pattern brush", "5 calligraphic brush"];
  for (var i = 0; i < names.length; i++) {
    var y = 260 - i * 55;
    var p = d.pathItems.add();
    p.setEntirePath([[180, y], [280, y + 30], [380, y - 30], [480, y]]);
    p.closed = false;
    p.filled = false;
    p.stroked = true; p.strokeColor = rgb(0, 0, 0); p.strokeWidth = 2;
    p.name = names[i];
  }

  var o = new IllustratorSaveOptions();
  o.embedICCProfile = false;
  o.pdfCompatible = true;
  o.compressed = true;
  d.saveAs(new File(args.out), o);
  app.userInteractionLevel = saved;
  return "saved star + " + names.length + " open paths to " + args.out;
})();
