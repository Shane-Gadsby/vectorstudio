// Research helper: collect Adobe's public Illustrator documentation for the
// v30.1 baseline (vectorsuite.md §1.2, §5.16, §6, task 0.4).
//
// HOW TO RUN: open https://helpx.adobe.com/illustrator/user-guide.html in a
// browser, open DevTools → Console, paste this whole file, press Enter. It
// crawls the desktop user guide (same-origin, so no CORS) and downloads
// `illustrator-docs.json`. Put that file in `.research/` at the repo root
// (gitignored: it is Adobe's copyrighted text and must not be committed; we
// extract facts from it, not prose).
//
// RESUMABLE: every page is kept in this browser's IndexedDB as soon as it is
// fetched. If Adobe's CDN starts refusing requests, the script backs off, and
// if it stays blocked it stops and downloads what it has. Paste it again later
// (the same tab or a new one on helpx.adobe.com) and it continues where it
// stopped; each download contains everything fetched so far. Set RESET = true
// to start over.
//
// Output: { fetchedAt, origin, pageCount, complete, toc: [{ path, text }], failed: [{ path, status }],
//           pages: { [path]: { status, url, title, lastUpdated, markdown } } }

(async () => {
  const RESET = false;
  const SEEDS = [
    "/illustrator/user-guide.html",
    "/illustrator/desktop/new-features/release-notes.html",
    "/illustrator/desktop/new-features/whats-new.html",
    "/illustrator/using/default-keyboard-shortcuts.html",
  ];
  // Desktop docs only. Skipped: generative AI and cloud features (out of scope,
  // vectorsuite.md §1.2) and the iPad app.
  const IN_SCOPE = /^\/illustrator\/(desktop\/|using\/)/;
  const OUT_OF_SCOPE = /\/(use-generative-ai|generative-ai|ipad|cloud-documents?|share-|projects?-)|firefly|express/i;
  const MAX_PAGES = 1200;
  const DELAY_MS = 900; // between requests; the CDN cut off a 300 ms crawl after ~200 pages
  const BACKOFF_MS = [15000, 45000, 90000, 180000]; // waits before each retry of a failing page

  const origin = location.origin;
  if (!/helpx\.adobe\.com$/.test(location.hostname)) {
    console.warn("Run this on a helpx.adobe.com page, or the fetches will be blocked by CORS.");
  }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const normalise = (href) => {
    try {
      const u = new URL(href, origin);
      if (u.origin !== origin || !u.pathname.endsWith(".html")) return null;
      return u.pathname;
    } catch {
      return null;
    }
  };

  // --- IndexedDB store: pages by path, plus a meta record ---
  const db = await new Promise((resolve, reject) => {
    const req = indexedDB.open("vs-illustrator-docs", 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore("pages");
      req.result.createObjectStore("meta");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  const tx = (store, mode, fn) => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const out = fn(t.objectStore(store));
    t.oncomplete = () => resolve(out && "result" in out ? out.result : out);
    t.onerror = () => reject(t.error);
  });
  if (RESET) {
    await tx("pages", "readwrite", (s) => s.clear());
    await tx("meta", "readwrite", (s) => s.clear());
  }
  const stored = new Map();
  await new Promise((resolve) => {
    const req = db.transaction("pages").objectStore("pages").openCursor();
    req.onsuccess = () => {
      const c = req.result;
      if (!c) return resolve();
      stored.set(c.key, c.value);
      c.continue();
    };
  });
  let toc = (await tx("meta", "readonly", (s) => s.get("toc"))) || [];

  // Main content → lightweight markdown that keeps headings, lists and tables.
  function toMarkdown(root) {
    const out = [];
    const walk = (node) => {
      if (node.nodeType !== 1) return;
      const tag = node.tagName.toLowerCase();
      if (["script", "style", "noscript", "button", "form", "svg", "nav", "header", "footer", "aside"].includes(tag)) return;
      if (/^h[1-6]$/.test(tag)) { out.push("\n" + "#".repeat(+tag[1]) + " " + node.textContent.replace(/\s+/g, " ").trim()); return; }
      if (tag === "table") {
        for (const tr of node.querySelectorAll("tr")) {
          out.push("| " + [...tr.children].map((c) => c.textContent.replace(/\s+/g, " ").trim()).join(" | ") + " |");
        }
        out.push("");
        return;
      }
      if (tag === "li") { out.push("- " + node.textContent.replace(/\s+/g, " ").trim()); return; }
      if (["p", "dt", "dd", "pre", "figcaption"].includes(tag)) {
        const t = node.textContent.replace(/\s+/g, " ").trim();
        if (t) out.push(t);
        return;
      }
      for (const child of node.children) walk(child);
    };
    walk(root);
    let md = out.join("\n");
    // The site TOC precedes the article: keep from the page's own "# " heading.
    const start = md.search(/^# /m);
    if (start > 0) md = md.slice(start);
    // Drop the shared footer (Previous/Next links and the Learn/Community/Adobe Home tiles).
    const end = md.search(/^(Design with precision in Illustrator|Previous$|### Learn$)/m);
    if (end > 0) md = md.slice(0, end);
    return md.replace(/\n{3,}/g, "\n\n").trim();
  }

  // Frontier: seeds, the TOC, and the links of every page already stored.
  const queue = [];
  const seen = new Set();
  const enqueue = (p) => {
    if (p && !seen.has(p) && IN_SCOPE.test(p) && !OUT_OF_SCOPE.test(p)) {
      seen.add(p);
      queue.push(p);
    }
  };
  SEEDS.forEach((p) => { seen.add(p); queue.push(p); });
  toc.forEach((l) => enqueue(l.path));
  for (const rec of stored.values()) (rec.links || []).forEach(enqueue);

  const failed = [];
  let blocked = false;
  let fetchedNow = 0;
  console.log(`Resuming with ${stored.size} pages already stored.`);

  for (let i = 0; i < queue.length && stored.size < MAX_PAGES; i++) {
    const path = queue[i];
    if (stored.has(path)) continue;
    let rec = null;
    for (let attempt = 0; attempt <= BACKOFF_MS.length; attempt++) {
      try {
        const res = await fetch(origin + path, { credentials: "include" });
        if (res.status === 404 || res.status === 410) {
          rec = { status: res.status, links: [] };
          break;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const doc = new DOMParser().parseFromString(await res.text(), "text/html");
        const links = [...doc.querySelectorAll("a[href]")]
          .map((a) => ({ path: normalise(a.getAttribute("href")), text: a.textContent.replace(/\s+/g, " ").trim() }))
          .filter((l) => l.path && IN_SCOPE.test(l.path));
        if (path === "/illustrator/user-guide.html") {
          toc = links;
          await tx("meta", "readwrite", (s) => s.put(toc, "toc"));
        }
        const main = doc.querySelector("main, [role=main], article") || doc.body;
        rec = {
          status: res.status,
          url: res.url,
          title: doc.title,
          lastUpdated: (doc.body.textContent.match(/Last updated on\s+([A-Z][a-z]+ \d{1,2}, \d{4})/) || [])[1] || null,
          markdown: toMarkdown(main),
          links: [...new Set(links.map((l) => l.path))],
        };
        break;
      } catch (error) {
        if (attempt === BACKOFF_MS.length) {
          failed.push({ path, status: String(error) });
          blocked = true;
          break;
        }
        console.log(`… ${path}: ${error}; retrying in ${BACKOFF_MS[attempt] / 1000}s`);
        await sleep(BACKOFF_MS[attempt]);
      }
    }
    if (blocked) {
      console.warn("Still blocked after all retries: stopping. Paste the script again later to resume.");
      break;
    }
    await tx("pages", "readwrite", (s) => s.put(rec, path));
    stored.set(path, rec);
    fetchedNow++;
    (rec.links || []).forEach(enqueue);
    console.log(`${rec.markdown ? "✓" : "✗ " + rec.status} ${stored.size} stored, ${queue.length - i - 1} queued: ${path}`);
    await sleep(DELAY_MS);
  }

  const pages = {};
  for (const [p, rec] of stored) {
    if (rec.markdown) {
      const { links, ...page } = rec;
      pages[p] = page;
    } else {
      failed.push({ path: p, status: rec.status });
    }
  }
  const remaining = queue.filter((p) => !stored.has(p)).length;
  const payload = {
    fetchedAt: new Date().toISOString(),
    origin,
    pageCount: Object.keys(pages).length,
    complete: !blocked && remaining === 0,
    remaining,
    toc,
    failed,
    pages,
  };
  const blob = new Blob([JSON.stringify(payload, null, 1)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "illustrator-docs.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  console.log(
    `Done this run: ${fetchedNow} new, ${payload.pageCount} pages in total, ${remaining} still to fetch` +
      (payload.complete ? " (complete)." : ". Paste again later to resume.") +
      " Put illustrator-docs.json in <repo>/.research/",
  );
  if (failed.length) console.table(failed);
})();
