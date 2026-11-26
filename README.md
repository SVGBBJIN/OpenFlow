# OpenFlow

Keyboard-first **Public Forum** flowing, evidence and speech prep. PF only. **No AI of any kind** — every argument,
status, weighing decision and strategic call is entered by the user. Automated helpers are deterministic
(parsing, counting, consistency checks) and never recommend or decide anything.

## What exists

| Area | State |
|---|---|
| **Flow editor** — 8-speech PF grid, Pro/Con flows, explicit argument tree (responses, subpoints, extensions, turns, cross-links, move-under), manual statuses, priority, tags, notes, impact comparison, collapse, undo/redo, remappable shortcuts, command palette | Built, browser-tested |
| **Evidence library** — cards, folders/files, topics, tags, collections, search, bulk move/delete/export, paste / URL / DOCX import (deterministic), DOCX export, highlighting + citations preserved | Built, browser-tested (DOCX round-trip unit-tested) |
| **Block library** — typed blocks, `/name` slash insertion with preview, per-entry edit/remove, links back to library originals | Built, browser-tested |
| **Summary / Final Focus builders** built on live flow data; deterministic consistency checks; round-wide tracker | Built, unit + browser-tested |
| **Speech documents** — entries (heading/text/argument/card), drag reorder, templates, explicit preview-before-sync with conflict resolution, DOCX export, print/PDF layout | Built, unit + browser-tested |
| **Collaboration** — Yjs CRDT over the normalised model, per-cell collaborative text with live carets, presence, owner/editor/viewer, personal undo | Built; **tested between browser tabs** (BroadcastChannel transport) and over an in-memory bus |
| **Cloud (Supabase)** — schema + RLS, invites, member roles, Realtime transport, row sync | Schema/RLS/invites **tested on an in-process Postgres**; client code **not verified against a live project** |
| **Round review** — RFD / judge feedback / opponent strategy / observations, per-argument notes, dropped & extension tracking, contention × speech matrix, version history + restore, reusable block from a response, JSON & DOCX export, JSON import | Built, browser-tested |
| **Speech import** — paste / DOCX / manual → editable entries → correction UI → flow | Built, browser-tested. **SpeechDrop import is NOT implemented** (upload the downloaded document instead) |

## Known limitations (read before relying on it)
- **Local-first.** Rounds, evidence, blocks, documents and versions live in the browser (IndexedDB). Only *rounds* have cloud sync code; shared evidence libraries / blocks / documents have schema + RLS (`0002`) but **no app sync yet**.
- Without Supabase env vars the app runs in local mode; cross-device collaboration is unavailable. The “same-browser test session” exists to try live editing between tabs.
- Plans (Summary/Final Focus) and review notes merge last-writer-wins as a whole inside a live session.
- Version history is local; the `round_versions` table is unused so far.
- PDF export uses the browser print dialog (“Save as PDF”), which preserves highlighting.
- No list virtualisation; very large flows are untested. Mobile is view-first.
- URL import resolves DNS then fetches; a DNS-rebinding race is theoretically possible.

## Develop
```bash
npm install --legacy-peer-deps
npm run dev          # http://localhost:3000
npm test             # unit tests (layout, ops, parsers, sync, CRDT, docx round-trip, export/import)
npm run test:rls     # applies supabase/migrations to PGlite and checks roles / invites / RLS
npm run build
```
Optional cloud: copy `.env.example` → `.env.local`, apply `supabase/migrations/*.sql` to your project
(0003 enables private Realtime channels — set `NEXT_PUBLIC_REALTIME_PRIVATE=false` to skip it for a quick trial, but anyone with a round id could then listen).

## Flow editor keys (all remappable in Settings)
Enter new argument · Shift+Enter response · Tab / Shift+Tab next/prev · arrows move · F2 or just type to edit · Esc exit ·
`/` command palette (blocks, cards, statuses, tags, link…) · Alt+1–6 status · Alt+C collapse · Alt+↑/↓ reorder ·
Alt+←/→ speech column · Alt+E extend · Alt+T turn · Del delete (undoable) · Ctrl/⌘+B bold · Ctrl/⌘+Shift+X strike ·
Ctrl/⌘+Shift+H highlight · Ctrl/⌘+Z / Shift+Z undo / redo. In a cell, `/` only opens the palette at the start or after a space.
