#!/usr/bin/env node
// Holt die aktuelle OpenAPI-Spec von der laufenden supernova-api und speichert
// sie als ./openapi.json. Voraussetzung: API läuft (Default: http://localhost:8000).
//
//   node scripts/fetch-openapi.mjs
//   API_URL=https://api.supernovaparts.com node scripts/fetch-openapi.mjs

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "openapi.json");

const API_URL = process.env.API_URL || "http://localhost:8000";
const TARGET = `${API_URL.replace(/\/+$/, "")}/openapi.json`;

console.log(`[fetch-openapi] GET ${TARGET}`);

try {
  const res = await fetch(TARGET);
  if (!res.ok) {
    console.error(`[fetch-openapi] HTTP ${res.status} ${res.statusText}`);
    process.exit(1);
  }
  const spec = await res.json();
  const json = JSON.stringify(spec, null, 2);
  await fs.writeFile(OUT, json, "utf-8");
  const sizeKb = (json.length / 1024).toFixed(1);
  console.log(`[fetch-openapi] Saved ${sizeKb} KB → ${path.relative(ROOT, OUT)}`);
  console.log(`[fetch-openapi] Title: ${spec?.info?.title ?? "?"}`);
  console.log(`[fetch-openapi] Version: ${spec?.info?.version ?? "?"}`);
  console.log(`[fetch-openapi] Paths: ${Object.keys(spec?.paths ?? {}).length}`);
  console.log(`[fetch-openapi] Schemas: ${Object.keys(spec?.components?.schemas ?? {}).length}`);
} catch (err) {
  console.error(`[fetch-openapi] Failed: ${err.message}`);
  console.error("Ist die API gestartet? Siehe supernova-api/CLAUDE.md → Setup & Run.");
  process.exit(1);
}
