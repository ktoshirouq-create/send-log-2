PROJECT: Climbing training PWA. Vanilla JS. 
Files: shared.js, app.js, dashboard.js, index.html, dashboard.html, sw.js.

CURRENT STATE: App working. Last successful refactor extracted shared 
helpers into shared.js. Both HTML files load shared.js before their 
respective JS.

OPEN BACKLOG (from prior session):
1. 🔧 Level-up ribbon: needs redesign or proper disable. Logic fires on 
   every dashboard render. crag_max_idx_<discipline> keys not reliably 
   written. Global crag_levelup_session gets clobbered across disciplines.
   FAILED ATTEMPT: Tried to disable via 3 FIND/REPLACE blocks in app.js 
   touching renderDashboardLogs and renderJournal. Broke renderUI 
   (pickers went blank). Rolled back successfully. Don't repeat that 
   approach. Try a smaller surgical change next: just neuter the 
   localStorage write inside renderDashboardLogs so ribbons stop 
   appearing naturally, no other touches.

2. 🎨 Polish: Add colored left border to climb rows in journal + 
   dashboard logs to make discipline visually obvious. Border color 
   should match the existing dotColor variable. Three locations: 
   App.renderJournal, App.renderDashboardLogs, Dashboard.renderLogbook.

3. ✨ Feature: Paginate session expansion. Sessions with many climbs 
   (18+) require too much scrolling. Add "Load More" button after 
   N climbs per session.

WORKFLOW RULES (sacred):
- FIND/REPLACE only, never full file regen
- No line numbers, anchor with unique snippets  
- One change at a time, smoke test between
- Bump ?v= cache buster on every JS change
- Commit before each change

- COMPLETED:
- ✅ shared.js extraction (yesterday)
- ✅ Discipline left border on climb rows (today)

OPEN:
1. 🔧 Level-up ribbon redesign or proper disable.
   PREVIOUS FAIL: Tried 3-block FIND/REPLACE in app.js, broke renderUI.
   NEXT TIME: Try smallest possible disable — comment out ONLY the 
   localStorage.setItem('crag_levelup_session', ...) line in 
   renderDashboardLogs. That stops new ribbons being placed; existing 
   garbage value stays harmless. Skip touching renderJournal entirely.
   
2. ✨ Pagination on session expansion. Sessions with many climbs need 
   "Load More" button. State already has journalLimit pattern — copy 
   that approach for per-session climb display.

LESSON FROM TODAY:
- Two FIND/REPLACE blocks targeting similar lines (both <tr class="table-row" 
  id="...-row-...">) caused mix-up. When two changes look almost identical, 
  apply one, sanity-check it landed in the right function, then do the next. 
  Don't trust Ctrl+F to land you on the right one without verification.
