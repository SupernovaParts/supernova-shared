# @supernova/shared

Shared TypeScript-Types und kleine Utilities für alle supernova-Frontends. Quelle der Wahrheit ist die OpenAPI-Spec von `supernova-api`.

---

## Was ist hier drin?

```
supernova-shared/
├── openapi.json              ← Snapshot der API-Spec (commitable, ~320 KB)
├── src/
│   ├── index.ts              ← public entry — `import { Job, Part } from "@supernova/shared"`
│   └── types/
│       └── api.ts            ← generiert aus openapi.json (NICHT manuell editieren)
├── scripts/
│   └── fetch-openapi.mjs     ← lädt aktuelle Spec von laufender API
├── package.json
├── tsconfig.json
└── README.md
```

---

## Setup (einmalig)

```powershell
cd supernova-shared
npm install
npm run generate-types
```

Erzeugt `src/types/api.ts` aus `openapi.json`.

---

## Workflow

### Frontend will neue API-Types?

```powershell
# 1. supernova-api lokal starten (siehe supernova-api/CLAUDE.md)
# 2. In supernova-shared:
npm run update
# (= fetch-openapi + generate-types)
# 3. Frontends bekommen neue Types via "@supernova/shared" Import
```

### Wenn die API nicht läuft

Dann reicht der existierende `openapi.json`-Snapshot:

```powershell
npm run generate-types
```

---

## Verwendung im Frontend

In jedem Portal (`supernova-website`, `supernova-dashboard`, `supernova-admin-portal`):

**1. `package.json` Dependency hinzufügen** (file-Link, kein npm-Publish nötig):
```json
{
  "dependencies": {
    "@supernova/shared": "file:../supernova-shared"
  }
}
```

**2. Importieren:**
```typescript
import type { Schemas } from "@supernova/shared";
type Job = Schemas["Job"];
type Part = Schemas["Part"];

// oder direkt aus dem types-Submodul:
import type { paths } from "@supernova/shared/types";
type GetCustomerJobs = paths["/customer/jobs"]["get"]["responses"]["200"]["content"]["application/json"];
```

---

## Konventionen

- **`openapi.json` ist der einzige Source-of-Truth** — wird in git eingecheckt, damit auch ohne laufende API gearbeitet werden kann.
- **`src/types/api.ts` ist generiert** — niemals manuell editieren. Wird von `openapi-typescript` aus der Spec gebaut.
- **Custom Types** (UI-spezifische Helper-Typen, die nicht aus der API kommen) gehören in eigene Files unter `src/`, NICHT in `src/types/api.ts`.
- **Veröffentlichung:** keine. Das Paket ist `private: true`, wird per `file:`-Link in Frontends eingebunden. Falls später echtes npm-Package nötig: privates Registry oder GitHub Packages.

---

## Re-Generation nach API-Änderungen

Wenn `supernova-api` neue Endpoints / Schemas bekommt:

1. API-Agent committet die Änderung in `supernova-api`
2. In `supernova-shared`: `npm run update` (holt frische Spec, regeneriert Types)
3. Optional: `npm run check` — prüft, ob die Frontends mit den neuen Types noch kompilieren
4. Commit mit Message wie `chore(shared): regen types from api v3.x.x`

Frontends bekommen die neuen Types automatisch beim nächsten `npm install` oder direkt durch den file-Link (kein zusätzlicher Schritt nötig).
