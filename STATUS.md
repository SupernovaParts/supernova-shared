# MODULE_STATUS - supernova-shared

- Owner: open
- Phase: VERIFY
- Status: ready (Master-Schema + OpenAPI-Types beide gruen)
- Naechster Schritt: Aufgabe 7c — Frontend-Imports auf `@supernova/shared` umstellen (Pi, gpt5.4-mini)
- Blocker: none

## Qualitaetsgate
- Install: done (`npm install` completed; +drizzle-orm, drizzle-zod, zod, @types/node)
- Check/Lint: done (`npm run check` 0 Errors, Exit 0; mit Master-Schema + OpenAPI-Types)
- Build: n/a (library — kein Build-Schritt, Re-Export von .ts)
- Smoke: done (`npm run generate-types` succeeded, `src/types/api.ts` generated; Spot-Check via temp `__spot_check.ts` bestanden)
- CI: pending

## Inhalt
- `openapi.json` — Snapshot der supernova-api OpenAPI-Spec (Stand 2026-05-06, 210 paths, 73 schemas, ~320 KB)
- `package.json` — npm-Paket `@supernova/shared`, private (Runtime-Deps: drizzle-orm, drizzle-zod, zod)
- `tsconfig.json` — TS Library-Config (ES2022, bundler, strict, types: ["node"])
- `src/index.ts` — public entry: re-exportiert `./types/api.js` (OpenAPI) + `./schema.js` (Master-Schema)
- `src/schema.ts` — Master Drizzle/Zod-Schema, 1199 Zeilen, Single Source of Truth fuer Frontends (Aufgabe 7b)
- `src/types/api.ts` — generiert via `npm run generate-types` (Stand 2026-05-07, 345 KB)
- `scripts/fetch-openapi.mjs` — laedt aktuelle Spec von laufender API
- `README.md` — Workflow-Doku
- `.gitignore` — `node_modules`, `dist`, IDE/OS

## Letzte 5 wichtige Aenderungen
1. 2026-05-07 - Aufgabe 7b abgeschlossen: Master-Schema in src/schema.ts; +drizzle-orm/drizzle-zod/zod deps; tsconfig types:["node"]; npm run check gruen
2. 2026-05-07 - Bootstrap abgeschlossen: npm install, generate-types, TypeScript check green
3. 2026-05-06 - Modul-Governance-Dateien initialisiert
4. 2026-05-06 - OpenAPI-Snapshot von supernova-api erzeugt und commitable abgelegt
5. 2026-05-06 - npm-Setup (package.json, tsconfig.json) angelegt mit `openapi-typescript`

## Handoff
- Done: TS-Type-Gen-Pipeline ist bootstrapped, OpenAPI-Snapshot ist drin, **Master-Schema (Drizzle/Zod) zentral gebaut (Aufgabe 7b)**.
- Decisions:
  - `file:`-Link statt npm-Publish (privat). Generierte `src/types/api.ts` bewusst NICHT in git ignoriert.
  - JobStatus harmonisierung: 2 separate TS-Enums (`JobStatus` website-flow, `AdminJobStatus` admin-internal-flow) + `AnyJobStatus`-Union; pgEnum bleibt auf 6 customer-facing Werten (DB-Persistenzstand).
  - 3 admin-portal-Felder (`customerPrice`, `cadFileUrl`, `customerDrawingFileUrl`) als `optional()` in `biddingParts` aufgenommen mit Open-Question-Kommentar (OpenAPI-Bestaetigung steht aus).
  - `RenderJob*` und `TechnicalOrderView` bleiben admin-portal-lokal (verifiziert: 0 Treffer ausserhalb).
  - Import aus `zod/v4` statt `zod` Default — drizzle-zod@0.8.3 verwendet intern v4-Typen.
- Next: Aufgabe 7c (Pi, gpt5.4-mini) — 3 Frontends auf `@supernova/shared` Re-Export umstellen.
- Risks:
  - `customer_price`/`cad_file_url`/`customer_drawing_file_url` sind nicht in OpenAPI als Part-Property. Falls Backend keine Read-Antwort darauf liefert, muss in 7d das Schema angepasst werden.
  - Frontends muessen in 7c ggf. ihre eigenen `import { z } from "zod"`-Aufrufe auf `"zod/v4"` umstellen, falls sie eigene Validation neben dem zentralen Schema haben.
