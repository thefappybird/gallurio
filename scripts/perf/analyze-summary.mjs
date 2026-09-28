// Per-route client JS totals from `next experimental-analyze -o` output.
//
// Usage:
//   pnpm analyze -- -o
//   node scripts/perf/analyze-summary.mjs "[locale]/portfolio" "w/[orgSlug]"
//
// Each route's `.next/diagnostics/analyze/data/<route>/analyze.data` is a
// sequence of big-endian length-prefixed records; the first is JSON with
// `output_files` (names) and `chunk_parts` (sizes keyed by output file). The
// total below is every client chunk reachable from the route's chunk graph,
// gzip-compressed — lazy chunks included — so it is a route ceiling, not a
// first-paint number. Compare before/after under the same definition.
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = ".next/diagnostics/analyze/data";
const routes = process.argv.slice(2);
if (routes.length === 0) {
  console.error('usage: node scripts/perf/analyze-summary.mjs "<route>" ["<route>" ...]');
  process.exit(1);
}

function firstRecord(buf) {
  const len = buf.readUInt32BE(0);
  return JSON.parse(buf.subarray(4, 4 + len).toString("utf8"));
}

const kb = (n) => (n / 1024).toFixed(1);
const CLIENT_JS = /^\[client-fs\]\/_next\/static\/chunks\/.*\.js$/;
const CLIENT_CSS = /^\[client-fs\]\/_next\/static\/.*\.css$/;

for (const route of routes) {
  const rec = firstRecord(readFileSync(join(root, ...route.split("/"), "analyze.data")));
  const totals = new Map();
  for (const part of rec.chunk_parts) {
    const t = totals.get(part.output_file_index) ?? { size: 0, compressed: 0 };
    t.size += part.size ?? 0;
    t.compressed += part.compressed_size ?? 0;
    totals.set(part.output_file_index, t);
  }
  const rows = [...totals].map(([i, t]) => ({ name: rec.output_files[i]?.filename ?? `#${i}`, ...t }));
  const js = rows.filter((r) => CLIENT_JS.test(r.name));
  const css = rows.filter((r) => CLIENT_CSS.test(r.name));
  const sum = (arr, key) => arr.reduce((acc, r) => acc + r[key], 0);
  console.log(`== ${route}`);
  console.log(`  client JS: ${js.length} chunks, raw ${kb(sum(js, "size"))} KB, gzip ${kb(sum(js, "compressed"))} KB`);
  console.log(`  client CSS: ${css.length} files, gzip ${kb(sum(css, "compressed"))} KB`);
  for (const chunk of [...js].sort((a, b) => b.compressed - a.compressed).slice(0, 5)) {
    console.log(`   - ${chunk.name.replace("[client-fs]/_next/static/chunks/", "")}: ${kb(chunk.compressed)} KB gzip`);
  }
}
