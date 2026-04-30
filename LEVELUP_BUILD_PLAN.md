# Level-Up System — Build Plan

Based on `LEVELUP_DESIGN.md`. Four sessions, each with a clean stopping
point that doesn't break anything if you stop mid-feature.

Total estimated time: ~2.5 hours active work, spread across 4 sittings.

---

## Before you start any session

Open `LEVELUP_DESIGN.md` first. Re-read the "Core definition" and "State
storage" sections. You'll forget the precise rules if you don't refresh.

Each session starts with: pull latest from GitHub, open relevant file,
verify cache version number you're at.

Each session ends with: commit, bump cache version, smoke test, push.

---

## SESSION 1 — Detection logic + storage (~30 min)

### Goal
Wire up live level-up detection. No UI yet. Verify it works by checking
localStorage in dev tools after logging a climb.

### Files touched
- `app.js` — one new helper function + one addition to `App.logClimb`

### What to build

**A new helper function** (somewhere near `getChartScore`):

```
App.detectLevelUp(discipline)
  - takes a discipline string
  - filters State.climbs to: this discipline + real sends + last 60 days
  - takes top 10 by score
  - if fewer than 10 climbs, uses what's available (no minimum)
  - averages their scores
  - looks up the discipline's grade scale via getScaleConfig()
  - finds the highest grade index whose score is <= the average
  - reads stored capacity index from localStorage
  - compares
  - if new > stored: pushes event to crag_levelup_events, updates stored
  - if new < stored: updates stored only (silent)
  - if equal: does nothing
  - returns true if level-up fired, false otherwise
```

**Hook into `App.logClimb`:**

After the climb is added to State.climbs and SyncManager.pushAll is
called, add:

```
const isRealSend = ['quick', 'flash', 'onsight', 'topped', 'allfree']
                     .includes(State.activeStyle);
if (isRealSend && !App.editingClimbId) {
  App.detectLevelUp(State.discipline);
}
```

Note: `!App.editingClimbId` prevents level-up from firing when editing
an existing climb (we only want it on new logs).

### How to verify
1. Open dev tools console on laptop
2. Log a real send via the app
3. Check `localStorage.getItem('crag_levelup_events')` — should be
   a JSON array
4. Check `localStorage.getItem('crag_capacity_idx_Indoor Bouldering')`
   (or whichever discipline) — should be an integer

### Stopping point
Detection works silently. App is otherwise unchanged. Safe to ship.

### Commit message
`feat: level-up detection logic (no UI yet)`

---

## SESSION 2 — Historical backfill (~30 min)

### Goal
Run a one-off function in dev tools that replays all existing climbs
through the detection logic. This populates `crag_levelup_events` with
all historical level-ups, so the journal markers in Session 3 have
real data to render.

### Files touched
- `app.js` — one new function `App.backfillLevelUps()`

### What to build

```
App.backfillLevelUps()
  - clears crag_levelup_events
  - clears all crag_capacity_idx_* keys
  - sorts State.climbs by date ascending (oldest first)
  - for each climb:
      if it's a real send:
        runs detectLevelUp logic
        but with State.climbs limited to climbs at or before this date
  - logs how many events were created
  - returns the events array
```

This is intentionally NOT auto-run. User triggers it manually once via
dev tools console: `App.backfillLevelUps()`.

### How to verify
1. Run `App.backfillLevelUps()` in dev tools console
2. Console should log something like: "Created 8 historical level-up
   events"
3. Check `localStorage.getItem('crag_levelup_events')` — should now
   contain those events with `dismissed: true` (since they're
   historical, the celebration banner has already "passed")

**Important:** Historical events should be marked `dismissed: true` so
they don't trigger a flood of celebration banners on the dashboard.
Only NEW level-ups (Session 1's live detection) get `dismissed: false`.

Adjust the backfill function to set `dismissed: true` on every event it
creates.

### Stopping point
You have a populated events array. Still no UI. Safe to ship.

### Commit message
`feat: level-up historical backfill function`

---

## SESSION 3 — Journal session markers (~30 min)

### Goal
Render a subtle gold marker on session cards in the journal where any
level-up occurred. Permanent, never auto-dismisses.

### Files touched
- `app.js` — modify `App.renderJournal` to read events and render markers

### What to build

In `App.renderJournal`, before mapping over sessions:
```
const levelUpEvents = JSON.parse(
  localStorage.getItem('crag_levelup_events') || '[]'
);
const sessionsWithLevelUp = new Set(
  levelUpEvents.map(e => e.sessionId)
);
```

In the session card template, where the existing (broken) ribbon HTML
currently lives — replace it with a new marker:

```
let levelUpMarkerHtml = '';
if (sessionsWithLevelUp.has(session.SessionID)) {
  const eventsForSession = levelUpEvents.filter(
    e => e.sessionId === session.SessionID
  );
  // Render a subtle gold pin/badge.
  // Suggestion: small absolute-positioned element in top-right corner
  // of the session card. Different from the old garish ribbon.
  // Tooltip on tap could show the discipline + grade.
}
```

**Visual direction:** Smaller than the old ribbon. Could be:
- A small gold dot or star
- A "↑" arrow with a subtle gold glow
- A tiny pill with the new grade

Aesthetic iteration is part of this session — try a few options, pick
what feels right against your dark theme.

### How to verify
1. Run `App.backfillLevelUps()` if you haven't already (Session 2)
2. Open Journal view
3. Sessions where you historically leveled up should show the marker
4. Tap a marker — should give some indication of what leveled up

### Stopping point
Markers visible in journal. Dashboard banner still missing — that's
Session 4. Safe to ship.

### Commit message
`feat: level-up markers on journal session cards`

---

## SESSION 4 — Dashboard banner + monthly recap (~45 min)

### Goal
Add the celebratory dashboard banner for recent unread level-ups. Add
the level-up integration to monthly recap cards.

### Files touched
- `app.js` — modify `App.renderDashboard` and the wrap-up card logic
- Possibly minor styling additions

### What to build

**Dashboard banner:**

In `App.renderDashboard` (or `App.renderDashboardCharts`, wherever
makes sense), before existing content:

```
const levelUpEvents = JSON.parse(
  localStorage.getItem('crag_levelup_events') || '[]'
);
const sevenDaysAgo = new Date();
sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

const activeLevelUps = levelUpEvents.filter(e => {
  const eventDate = new Date(e.date);
  return !e.dismissed && eventDate >= sevenDaysAgo;
});

// For each active level-up, render a banner card at the top of dash.
// Stacked if multiple.
// Each has a dismiss X that:
//   1. sets dismissed: true on that event in localStorage
//   2. re-renders dashboard
```

**Visual direction:** Premium gold gradient. Big, celebratory text.
"LEVEL UP" header, then "Indoor Bouldering: 6C → 7A". Date subtle
underneath. Dismiss X in top-right corner of each banner.

**Monthly recap integration:**

Find where wrap-up cards are generated. (You may need to look for it —
likely in `dashboard.js` since it's a Nerd Dashboard feature.)

For each month being summarized:
1. Filter `crag_levelup_events` to events in that month
2. If any exist, add a "Level-Up Moments" card listing them
3. Modify the existing "Peak Grade" card: if the peak displayed was
   first hit in this month, add "🎉 NEW PEAK" badge

### How to verify
1. Manually edit `crag_levelup_events` in dev tools to add a recent
   event with `dismissed: false` and date within last 7 days
2. Refresh dashboard — banner should appear
3. Tap dismiss — banner should disappear, event should be
   `dismissed: true` in storage
4. Refresh — banner should NOT reappear

For monthly recap: scroll through months, level-ups should appear
where expected.

### Stopping point
Feature complete. Old broken code removed.

### Cleanup
After Session 4 verifies good:
- Remove the commented-out line `// localStorage.setItem('crag_levelup_session', ...)`
  since it's now obsolete
- Remove the old `crag_max_idx_${dStr}` write in `renderDashboardLogs`
- Remove the old reading of `crag_levelup_session` in `renderJournal`
  (the section that renders the original ribbon HTML)

### Commit message
`feat: level-up dashboard banner + monthly recap`

Followed by:

`chore: remove old broken level-up code`

---

## After all 4 sessions

Update `BACKLOG.md`:
- Move "Level-Up detection rebuild" and "Level-Up ribbon visual redesign"
  to a "Completed" section.
- Both items shipped together as part of this redesign.

---

## If you get stuck or tired mid-session

Each session is designed so its incomplete state doesn't break anything:
- Session 1 incomplete: detection logic exists but isn't called → no harm
- Session 2 incomplete: backfill function exists but you haven't run it → no harm
- Session 3 incomplete: events exist but markers aren't rendered → no harm
- Session 4 incomplete: markers visible, banner missing → still better than before

Stop anywhere. Pick up next time.
