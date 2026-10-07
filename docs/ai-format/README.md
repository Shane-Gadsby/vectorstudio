# `.ai` format research

This folder holds the findings of the Phase 0.3 format spikes (vectorsuite.md
§4 and §7). Write one file per topic, and record the fixtures each claim was
checked against.

| Topic | Task | File |
|-------|------|------|
| Private-data container, compression, operator histogram | 0.3.2 | [`container-30.1.md`](container-30.1.md) (tool: `npm run ai:dump`) |
| `%AI11_BeginTextDocument` vs PhotoSuite's EngineData parser | 0.3.3 | Done: [`text-document-30.1.md`](text-document-30.1.md) (tool: `scripts/research/ai-text-document.mjs`) |
| `%AI9_BeginDocumentData` and the resource dictionaries | 0.3.4 | Done: [`document-data-30.1.md`](document-data-30.1.md) (tool: `scripts/research/ai-document-data.mjs`) |
| Art dictionaries and plugin groups for each live feature | 0.3.5 | In progress: [`live-features-30.1.md`](live-features-30.1.md) (tool: `scripts/research/ai-art-objects.mjs`); hand-made fixtures pending: [`manual-fixtures.md`](manual-fixtures.md) |
| Minimal current-format (as written by 30.1) write spike | 0.3.6 | Done: [`container-30.1.md`](container-30.1.md), "Writing" (tool: `scripts/research/ai-write-spike.mjs`) |

Starting point: PhotoSuite's reader `document/formats/ai-format.js` (at the
pinned upstream commit). It already finds `/AIMetaData`, joins the
`AIPrivateData<n>` streams, and handles both `%AI12_CompressedData` (deflate)
and `%AI24_ZStandard_Data` (zstd). Its import closure is 120 files and reaches
into `ui/` and `assets/`. VectorSuite should fork the reader into
`src/document/formats/ai/` with a provenance header, not pull it through the
manifest.
