# supernova-shared

Auto-Onboarding fuer Claude Code (und kompatible Agents). Lies in dieser Reihenfolge:

1. **STATUS.md** â€” was laeuft gerade, was ist offen, wer arbeitet dran
2. **ARCHITECTURE.md** â€” was tut dieses Modul, wie ist es gebaut
3. **CHANGELOG.md** â€” letzte Aenderungen (chronologisch, append-only)
4. *(falls vorhanden)* **../\_governance/CONTROL\_TOWER.md** â€” globale Mono-Repo-Uebersicht. Nur falls dieses Modul Teil des supernova-migration Mono-Repos ist; in einem standalone-Repo nicht erforderlich.

Dann Smoke-Test:
```
npm run generate-types && npm run check
```

Bei Unklarheit: erst STATUS.md + CHANGELOG.md anschauen, dann fragen, dann erst Code aendern.

## Hartes Verbot
- Kein commit / push **ohne explizite User-Freigabe**
- Keine destruktiven Operationen (`rm -rf`, `git reset --hard`, force-push) ohne User-OK
- Schreibe NUR in Files dieses Moduls â€” keine Cross-Module-Edits ohne explizites OK

## Reporting (am Ende der Session)
- `STATUS.md` updaten (was geaendert, neuer Stand)
- `CHANGELOG.md` Eintrag (Datum, was, warum)
- Multi-Modul-Tasks: zusaetzlich `../_governance/reports/<timestamp>_<agent>_<task>.md` (im Mono-Repo) oder lokales `reports/`-Subfolder (standalone)
