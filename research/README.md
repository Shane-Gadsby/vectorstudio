# Research tooling

How behaviour claims in [`../docs/parity/`](../docs/parity) and [`../docs/ai-format/`](../docs/ai-format)
get verified. **None of this is shipped code** — it is Node and ExtendScript, it is excluded from
`cargo xtask brands`, and it names the reference app freely because recording that app's behaviour
is its whole purpose.

Needs Node 25+ (`WebAssembly.compile` is missing in 22).

## The licensed VM bridge — `illustrator/`

The only legitimate source of `confidence: verified` rows. A **licensed** Illustrator 30.1 runs in
a Windows VM; jobs reach it as ExtendScript through a shared folder (`~/Downloads/temp` here,
`Z:\temp` in the VM).

```sh
# in the VM, once per session
powershell -File research/illustrator/vs-bridge.ps1

# from here
node research/illustrator/run-job.mjs <script.jsx> --args '<json>'
```

| Script | What it probes |
|---|---|
| `probe-baseline.jsx` | Application defaults, document profiles, preferences, units |
| `probe-menus.ps1` | Every menu command and its path → `docs/parity/menu-commands-30.1.csv` |
| `check-ai-files.jsx` | Opens `.ai` files and reports artboard and path geometry |
| `make-fixtures.jsx` | Generates reference documents from synthetic art |
| `make-{path,blend,effect,brush,pattern}-sheet.jsx` | Feature sheets for a specific subsystem |
| `apply-brushes.jsx` | Brush application behaviour |
| `purge-resources.jsx` | Strips bundled Adobe content from a fixture before it is kept |
| `bridge.mjs`, `run-job.mjs`, `vs-agent.ps1`, `vs-bridge.ps1` | The transport |

**Rule:** verification happens on the licensed VM only. The Illustrator install at
`../illustrator/` on the development machine is an unlicensed repack — never read its presets,
shortcuts, resources, binaries or outputs, and never use it to make fixtures or reference outputs.

## `.ai` format probes

Run against the reference fixtures in `fixtures/ai/` (gitignored — see
[`../docs/parity/README.md`](../docs/parity/README.md#reference-fixtures)).

| Script | What it extracts |
|---|---|
| `ai-document-data.mjs` | The document-data block: artboards, swatches, settings |
| `ai-art-objects.mjs` | Art objects from the `AIPrivateData` operator stream |
| `ai-text-document.mjs` | The text document and its story/engine structures |
| `ai-write-spike.mjs` | Writer spike: re-emits a parsed stream and diffs it |

Findings are written up in `docs/ai-format/`, never left only in a script's output.

## Public documentation

`fetch-illustrator-docs.console.js` is pasted into a browser DevTools console on helpx.adobe.com;
it saves JSON into the gitignored `.research/`. `extract-shortcuts.mjs`, `extract-kys-text.mjs` and
`build-menu-commands.mjs` turn that into the CSV baselines.

**Extract facts, never prose.** A `doc-30` row records what the documentation says a feature does;
it never reuses Adobe's wording beyond a bare feature name.
