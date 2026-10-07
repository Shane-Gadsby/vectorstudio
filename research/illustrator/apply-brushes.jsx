// VectorSuite research: stroke named paths with named brushes (task 0.3.5,
// fixture 24-brushes.ai).
//
// Brushes can only be *defined* by hand (the New Brush dialogs), but applying
// one is scriptable: Brush.applyTo(art). This job takes pairs of
// [path name, brush name], applies each brush to that path, saves the
// document and leaves it open. VS_ARGS.add makes an extra open S-curve
// first ({"name": …, "y": …}), for a brush the sheet has no path for.
//
//   node scripts/research/illustrator/run-job.mjs scripts/research/illustrator/apply-brushes.jsx \
//     --args '{"in":"Z:\\temp\\fixtures-manual\\24-brushes.ai","pairs":[["2 art brush","VS Art"], …]}'
//
// It opens VS_ARGS.in if that document isn't already the active one. It does
// not purge anything: brush definitions can't be removed through the DOM
// (Brush has no remove method), which is why the Adobe defaults survive in
// this fixture. ExtendScript is ES3.

#target illustrator

(function () {
  var args = typeof VS_ARGS !== "undefined" ? VS_ARGS : {};
  var saved = app.userInteractionLevel;
  app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;
  var file = new File(args["in"]);
  var d = null;
  for (var i = 0; i < app.documents.length; i++) {
    if (app.documents[i].fullName.fsName === file.fsName) { d = app.documents[i]; break; }
  }
  if (d === null) d = app.open(file);
  d.activate();

  // Paths this run made: Illustrator's collections don't always show a new
  // item until a redraw, so they are kept here as well.
  var made = {};
  function itemNamed(name) {
    if (made[name]) return made[name];
    for (var i = 0; i < d.pathItems.length; i++) if (d.pathItems[i].name === name) return d.pathItems[i];
    return null;
  }
  function brushNamed(name) {
    for (var i = 0; i < d.brushes.length; i++) if (d.brushes[i].name === name) return d.brushes[i];
    return null;
  }

  function rgb(r, g, b) { var c = new RGBColor(); c.red = r; c.green = g; c.blue = b; return c; }
  var add = args.add || [];
  for (var a = 0; a < add.length; a++) {
    var np = d.pathItems.add();
    np.setEntirePath([[180, add[a].y], [280, add[a].y + 30], [380, add[a].y - 30], [480, add[a].y]]);
    np.closed = false;
    np.filled = false;
    np.stroked = true; np.strokeColor = rgb(0, 0, 0); np.strokeWidth = 2;
    np.name = add[a].name;
    made[add[a].name] = np;
  }

  var pairs = args.pairs || [];
  var done = [];
  for (var p = 0; p < pairs.length; p++) {
    var item = itemNamed(pairs[p][0]);
    var brush = brushNamed(pairs[p][1]);
    if (item === null) { done.push("no path " + pairs[p][0]); continue; }
    if (brush === null) { done.push("no brush " + pairs[p][1]); continue; }
    brush.applyTo(item);
    done.push(pairs[p][0] + " <- " + pairs[p][1]);
  }

  var o = new IllustratorSaveOptions();
  o.embedICCProfile = false;
  o.pdfCompatible = true;
  o.compressed = true;
  d.saveAs(file, o);
  app.userInteractionLevel = saved;
  return done.join("; ");
})();
