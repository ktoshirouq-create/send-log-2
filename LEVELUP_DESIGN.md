# Level-Up System — Design Spec

Last updated: April 2026
Status: Designed, not yet implemented.

---

## Why this exists

The original level-up ribbon was broken: it fired on every dashboard
render, used a single global session key that got clobbered across
disciplines, and surfaced wrong sessions as "level ups." It was disabled
on April 28, 2026 by commenting out the write to `crag_levelup_session`
in `App.renderDashboardLogs`.

This document specifies the redesigned system that replaces it.

---

## Core definition: what counts as a level-up

**A level-up happens when working capacity index increases for a
discipline.**

Working capacity = top-10 average score of real sends in the last 60
days, mapped to a grade index on that discipline's grade scale.

### Why this definition (not "peak grade")

A new peak grade is a noisy signal. You might flash a soft 7a once and
never repeat. That's a moment, not a milestone.

Working capacity requires *consistency*. To shift your working capacity
from "averaging 6a territory" to "averaging 6a+ territory," you have to
genuinely send 6a+ multiple times across multiple sessions. It can't be
gamed by one lucky route.

This makes the level-up the kind of moment worth celebrating: weeks of
real work paying off, not a single fortunate climb.

---

## Per-discipline tracking

Level-ups are tracked **separately per discipline** (Indoor Rope, Indoor
Bouldering, Outdoor Rope, Outdoor Bouldering, Outdoor Multipitch,
Outdoor Trad, Outdoor Ice).

Indoor 6a and outdoor 6a represent very different physical achievements.
They get separate level-up tracks.

---

## Down-track handling

Working capacity can drop (e.g., during a slump or recovery period).
When it drops, the stored capacity index drops with it. **The user is
not notified** of the down-track — only level-ups are celebrated.

This means: if you reach 6a+, drop back to 6a during a slump, then
later climb back up to 6a+ again — that triggers a *new* level-up.

This is intentional. Recovering a lost tier is a comeback moment and
deserves recognition.

---

## What "real sends" includes / excludes

Level-up calculation only counts climbs with these styles:
- `quick` (Send)
- `flash`
- `onsight`
- `topped` (multipitch)
- `allfree` (multipitch)

Excludes:
- `worked`
- `project`
- `toprope`
- `autobelay`
- `bailed`

---

## State storage

### New localStorage keys

**Per-discipline capacity tracker:**
```
crag_capacity_idx_${discipline}  // current capacity index, integer
```

7 keys total (one per discipline).

**Events log:**
```
crag_levelup_events  // array of level-up events
```

Each event:
```javascript
{
  discipline: "Indoor Bouldering",
  oldGrade: "6C",            // grade label before level-up
  newGrade: "7A",            // grade label after level-up
  date: "2026-04-28",        // when the triggering climb happened
  sessionId: "2026-04-28_OKS",
  climbId: "1777...",
  dismissed: false           // user dismissed the celebration banner
}
```

### Old keys to remove (after redesign ships)

- `crag_max_idx_${discipline}` — old broken peak-tier tracker
- `crag_levelup_session` — old broken global session key

---

## Three UI surfaces

### Surface 1: Dashboard celebration banner

**When:** Any event in `crag_levelup_events` from the last 7 days where
`dismissed: false`.

**Where:** Top of the in-app Dashboard view, above the existing stats
grid.

**What:** Full-width celebratory card. Gold gradient background.
Dismissible (X in corner sets `dismissed: true`).

**Multiple level-ups:** Stacked banners, one per event.

**Look and feel:** Premium, celebratory. Not garish. Should feel like
an achievement screen in a well-designed game, not a notification.

### Surface 2: Journal session marker

**When:** Permanent. Any session that triggered a level-up gets a marker.

**Where:** Subtle gold pin/badge on the session card in the journal.

**What:** Less obtrusive than the original broken ribbon. A small
visual indicator that this session was a milestone. Tap could show
"Leveled up Indoor Bouldering: 6C → 7A."

**Why permanent:** This is part of your climbing history. Scrolling
back through old sessions and seeing the level-up moments tells your
progress story.

### Surface 3: Monthly recap integration

**Modify the existing "Peak Grade" wrap-up card:**
- If the peak shown was first reached this month, add "🎉 NEW PEAK"
  badge.

**New card type — only appears if any level-ups happened that month:**
- Title: "Level-Up Moments"
- Content: list of each level-up that month with discipline and new grade.
- Example: "3 Level-Ups This Month: Outdoor Rope 6c, Indoor Boulder 7A,
  Outdoor Multipitch 5c"

---

## Detection trigger

**Where:** Inside `App.logClimb`, after the climb is saved to State and
pushed to sync.

**Logic:**
```
1. Is this climb a real send (style in the allowed list above)?
   If no, skip.
2. Recompute working capacity for this climb's discipline:
   - Filter all climbs to this discipline
   - Filter to real sends only
   - Filter to last 60 days
   - Take top 10 by score
   - Average their scores
   - Map the average score to a grade index on this discipline's scale
3. Compare new index to stored crag_capacity_idx_${discipline}
4. If new index > stored:
   - Push a new event to crag_levelup_events
   - Update stored index to new value
5. If new index < stored:
   - Update stored index to new value (silent)
6. If new index === stored:
   - Do nothing
```

**Important:** detection runs ONLY in `App.logClimb`. Not on render. Not
on sync. Render code reads from `crag_levelup_events`, never computes.

---

## Historical backfill

Existing climbs (113+ as of April 28) need to be replayed through the
detection logic to populate `crag_levelup_events` with historical
level-ups.

**Approach:** A one-off function (callable from dev tools) that:
1. Wipes any existing `crag_levelup_events`
2. Resets all `crag_capacity_idx_${discipline}` to `-1`
3. Walks all climbs in chronological order (oldest first)
4. For each, runs the same detection logic as live
5. Builds the events array as it goes

This means your journal will retroactively show gold pins on every
historical level-up moment. That's the desired outcome.

---

## What's intentionally NOT in this design

- **No "peak send" detection.** Peak grades are a noisy signal. Working
  capacity is the only thing being tracked.
- **No level-down notifications.** Down-tracks happen silently.
- **No animation specs.** Implementation can decide later if a static
  celebration is enough or if motion adds value.
- **No sounds.** This is a PWA in a browser, audio gets weird on mobile.
- **No social sharing.** Out of scope.

---

## Sacred constraints (do not break)

- Detection MUST run only in `App.logClimb`, not on render.
- Capacity calculation MUST exclude non-sends.
- Each discipline MUST have its own state.
- Down-tracks MUST be silent.
- The current dark aesthetic of the app MUST be preserved — gold tones
  should feel like accents, not theme overrides.
