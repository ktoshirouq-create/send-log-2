# AI Editing Rules for this repo

## Architecture
- shared.js: AppConfig + helpers used by both pages. Loaded BEFORE app.js and dashboard.js.
- app.js: main app (Log/Journal/Dashboard tabs in index.html)
- dashboard.js: standalone Nerd Dashboard (dashboard.html)
- Both pages read/write the same localStorage keys (crag_climbs_master, crag_sessions_master)

## When making changes
- NEVER regenerate a full file. Use FIND/REPLACE format only.
- NEVER reference line numbers — use unique code snippets to anchor changes.
- Change ONLY what was asked. No "while I'm here" cleanup.
- Bump the ?v= number on script tags after every JS change (cache buster).

## Sacred code — DO NOT TOUCH without asking
- The +12 hour hack in getCleanDate (timezone fix, intentional)
- localStorage key names (crag_climbs_master, etc — renaming = data loss)
- Fallback keys 'climbingLogs', 'climbLogs', 'sessionLogs' in dashboard.js (backward compat)
- Defensive null checks like `if (el)` before getElementById usage
- The merge logic in SyncManager.trigger that preserves Pitches/GearStyle/etc.
- getChartScore — different versions in app.js and dashboard.js, intentional, do not merge yet

## Workflow
- I commit before each AI change.
- After change, smoke test: log climb → edit → switch discipline → journal → dashboard → nerd dashboard.
- If smoke test fails, revert in GitHub history before trying again.
