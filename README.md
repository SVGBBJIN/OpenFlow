# OpenFlow

Keyboard-first **Public Forum** flowing and prep. PF only. **No AI of any kind**: every argument,
status and strategic decision is entered by the user.

## Status

| Phase | Scope | State |
|---|---|---|
| 1 | Flow editor, 8-speech PF structure, relationships, shortcuts, statuses, undo/redo, persistence, dashboard | Built (local-first) |
| 2 | Evidence library, block library, slash blocks | Not started |
| 3 | Summary / Final Focus builders, speech documents, DOCX/PDF | Not started |
| 4 | Realtime collaboration (Yjs over Supabase Realtime), permissions | Not started |
| 5 | Round review, RFD, export | Not started |

### What Phase 1 does and does not do
- Flow data lives in the browser (IndexedDB) and works fully offline.
- `supabase/migrations/0001_phase1_core.sql` defines the normalized schema + RLS. RLS is tested against an
  in-process Postgres (`npm run test:rls`), but the app does **not yet sync** rounds to Supabase and the login page
  is untested against a live project.
- Cross-device sync and partner collaboration arrive in Phase 4.

## Develop
```bash
npm install --legacy-peer-deps
npm run dev        # http://localhost:3000
npm test           # layout + relationship unit tests
npm run test:rls   # schema / RLS check
```

## Flow editor keys (all remappable in Settings)
Enter new argument · Shift+Enter response in next speech · Tab / Shift+Tab next/prev · arrows move ·
F2 or just type to edit · Esc exit · `/` command palette · Alt+1–6 status · Alt+C collapse ·
Alt+↑/↓ reorder · Alt+←/→ move speech column · Alt+E extend · Alt+T turn · Del delete (undoable) ·
Ctrl/⌘+B bold · Ctrl/⌘+Shift+X strike · Ctrl/⌘+Z / Shift+Z undo / redo.
While typing in a cell, `/` only opens the palette at the start of the cell or after a space.
