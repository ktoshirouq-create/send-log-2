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
