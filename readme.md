# Send Log & Nerd Dashboard - Master Ledger (v27)

## 🏗️ Architecture & Pipeline
This is a Progressive Web App (PWA) that syncs to a Google Sheet database via Google Apps Script.
* **Database:** Google Sheets
* **Active Cloud Script URL:** `https://script.google.com/macros/s/AKfycbwMh-T7DB7S06_8DB2GC4dniByVHrRSqbODdLRhjciDOXSDL-V4_vzQtRXee2Wmqp9L/exec`
* **Offline Handling:** Service Worker (`sw.js`) intercepts fetch requests and uses `ignoreSearch: true` to bypass version tags when offline.
* **The "Zombie Vaccine":** Deleted logs are saved locally to `deletedLogs`. The sync manager compares incoming cloud data against this blacklist and permanently drops any IDs marked as deleted so they never ghost back into the UI.

## 🗄️ Database Schema (Google Sheet Headers)
All headers must remain lowercase with no spaces.
* `id` (Timestamp)
* `date` (YYYY-MM-DD)
* `day` (e.g., Mon, Tue)
* `timeofday` (Morning, Afternoon, Evening)
* `type` (Discipline)
* `name` (Gym or Route @ Crag)
* `grade` (Display grade)
* `score` (Numeric value for chart math)
* `angle` (Steepness)
* `style` (Ascent style)
* `notes` (Text field)
* `effort` (My Effort)
* `gradefeel` (The Grade)
* `rating` (1-5 stars)
* `holds` 
* `climstyles` (Climbing Style)

## 🧠 Core Application Logic
### 1. Smart-Manual Time Engine
Built to accommodate late-night bartender shifts, the app auto-detects the time bucket upon logging, but allows manual override in the Advanced Details section.
* **Morning:** 05:00 – 11:59
* **Afternoon:** 12:00 – 16:59
* **Evening:** 17:00 – 04:59

### 2. The Discipline & Grade Rules
The app maintains strict separation between disciplines to ensure chart math is accurate.
* **Emojis (Ropes Only):** ⚡ (Flash), 💎 (Onsight), 🚀 (Quick Send), 🛠️ (Project). 
* **Bouldering UI Override:** To prevent UI clutter on mobile, bouldering lists hide the ascent emojis. They strictly display the color-coded dot (e.g., 🔵) and the clean grade text.

## 📱 UI Layout (Main Logging App)
### Advanced Details Hierarchy
Grouped into distinct "Zones" separated by faint horizontal dividers (`<hr class="zone-divider">`).
* **Zone 1 (The Vibe):** Time of Day, My Effort (Breezy/Solid/Limit), The Grade (Soft/Hard), Route Rating (1-5 Stars).
* **Zone 2 (The Route):** Steepness (Slab/Vert/Overhang/Roof), Climbing Style (Endurance/Cruxy/Technical/Athletic), Hold Types (Crimps/Slopers/Pockets/Pinches/Tufas/Jugs).
* **Zone 3 (The Journal):** Notes text box.
* *(Note: "Pre-Climb Fatigue" and "Override" labels were permanently removed to streamline the UI).*

## 📊 The Nerd Dashboard
Designed to track progressive overload and energy systems specifically for balancing marathon mileage with strict climbing goals (e.g., WI5 Ice, 7a sport, One-Arm Hangs).

### Dashboard Controls
* **Double Sticky Filters:** Sticks to the top of the viewport on scroll.
  * *Discipline:* All, In Rope, Out Rope, In Boulder, Out Boulder.
  * *Timeframe:* 30 Days, 90 Days, YTD, All Time.
* **Log List Toggle:** Switches the main log view between "Recent" and "Top 10 (60d)".

### Analytical Modules
1. **Quick Stats:** Total Sends, Outdoor Days, Peak Grade.
2. **Habits Card:** Calculates "Favorite Day" and "Prime Time Window" based on the selected timeframe.
3. **Send Pyramid (Bar Chart):** Visualizes sub-maximal volume and base building.
4. **CNS Peak Output (Line Chart):** Tracks the highest score per week (or Average Top 10) to monitor central nervous system load. Leaves blank spaces for weeks with zero climbing.
5. **Energy Systems (Pie Chart):** Aero (Endurance), AnCap (Athletic), Power (Cruxy).
6. **Grip Matrix (Radar Chart):** Tracks volume on specific holds to ensure grip-strength goals are being targeted.

### Leaderboards (Text Lists)
1. **The Hall of Fame:** Top-rated routes (4+ stars), sorted by score.
2. **The "Limit" Log:** Routes specifically tagged as "Limit" (Effort) or "Hard" (Grade Feel) to track max-effort frequency.
3. **Peak by Steepness:** Displays the highest grade achieved across Slab, Vertical, Overhang, and Roof.
4. **Top Frequented Locations:** Tally of the most visited gyms and crags.

### Working Capacity (XP Bar)
* **Visibility Rule:** Only appears when the log list is toggled to "Top 10 (60d)".
* **Function:** Averages the top 10 climbs of the last 60 days, maps that average to the grade scoring system, and displays a visual progress bar showing how close the user is to solidifying their current base grade or breaking into the next one.
