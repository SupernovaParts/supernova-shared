# CHANGELOG — supernova-shared

Append-only Liste der wichtigen Änderungen. Neuester Eintrag oben.

Format pro Eintrag:
```
## YYYY-MM-DD - Kurze Überschrift
- Was geändert (1-3 Bullets)
- Wer (agent oder mensch)
- Warum (1 Zeile, optional)
```

---

## 2026-05-07 - Aufgabe 7b: Master-Schema gebaut
- `src/schema.ts` neu: 1199 Zeilen Drizzle/Zod Master-Schema (Basis: supernova-website schema)
- Neue Felder in `biddingParts`: `customerPrice`, `cadFileUrl`, `customerDrawingFileUrl` (alle optional, Open-Question-Kommentar)
- JobStatus harmonisiert: separate `JobStatus`/`AdminJobStatus`/`AnyJobStatus` (Begruendung im Code)
- `src/index.ts` re-exportiert ./schema zusaetzlich zu OpenAPI-Types
- `package.json` +deps: drizzle-orm@^0.45.1, drizzle-zod@^0.8.3, zod@^3.25.76, @types/node (dev)
- `tsconfig.json` +`"types": ["node"]` (sonst inferiert drizzle-orm `varchar` als `Buffer`)
- claude (Implementer)
- Single Source of Truth fuer 3 Frontends; Aufgabe 7c kann starten

## 2026-05-07 - Bootstrap abgeschlossen
- `npm install` ausgeführt (33 packages)
- `npm run generate-types` → `src/types/api.ts` generiert (345 KB, 73 Schemas)
- `npm run check` grün (keine TS-Fehler)
- Pi (Implementer)
- Vorbereitung für Master-Schema (Aufgabe 7b)

## 2026-05-06 - Modul-Standardisierung
- Module-Files auf neuen Standard gebracht (CLAUDE.md, AGENTS.md, STATUS.md, ARCHITECTURE.md, CHANGELOG.md)
- claude (in Setup-Task)
- Vorbereitung auf standalone-GitHub-Repos
