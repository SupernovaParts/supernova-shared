# Agents-Onboarding fuer supernova-shared

Universal-Onboarding fuer alle Code-Agents (Claude Code, Cursor, Pi). Spiegelt CLAUDE.md.

## Lesereihenfolge
1. **STATUS.md** â€” aktueller Stand
2. **ARCHITECTURE.md** â€” Modul-Aufbau
3. **CHANGELOG.md** â€” letzte Aenderungen
4. *(optional)* **../\_governance/CONTROL\_TOWER.md** falls Mono-Repo

## Smoke-Test
```
npm run generate-types && npm run check
```

## Verbote
- Kein commit/push ohne User-Freigabe
- Keine destruktiven Operationen ohne User-Freigabe
- Keine Cross-Module-Edits ohne explizites OK

## Reporting
- `STATUS.md` updaten am Ende
- `CHANGELOG.md` Eintrag (1-2 Zeilen)
- Multi-Modul-Tasks: zusaetzlich `../_governance/reports/...`
