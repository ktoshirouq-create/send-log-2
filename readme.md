# Send Log & Nerd Dashboard - Master Ledger (v65)

## 🏗️ Architecture & Pipeline
This is a Progressive Web App (PWA) designed for fast, chalky-hand data entry, syncing a relational dataset (Sessions + Climbs) to a Google Sheet via Google Apps Script.
* **Database:** Google Sheets (Relational: Sessions & Climbs)
* **Active Cloud Script URL:** `https://script.google.com/macros/s/AKfycbwMh-T7DB7S06_8DB2GC4dniByVHrRSqbODdLRhjciDOXSDL-V4_vzQtRXee2Wmqp9L/exec`
* **Offline Handling:** Service Worker (`sw.js`) intercepts fetch requests. The app uses an intelligent queue to store offline logs and pushes them as a `sync_all` payload when the network returns.
* **The "Zombie Vaccine":** Deleted logs and sessions are saved locally to a blacklist (`deletedLogs` / `deletedSessions`). The sync manager permanently drops any blacklisted IDs during a cloud pull so they never ghost back into the UI.

## 🗄️ Database Schema (Google Sheets)
The database is split into two relational tables linked by `SessionID`. All headers must remain exactly as mapped in the script payload.

### 1. Sessions Table
* `SessionID` (e.g., `YYYY-MM-DD_GymName`)
* `Date` (YYYY-MM-DD)
* `Location` (Gym or Crag Name)
* `Focus` (Limit, Endurance, Volume, Fun, Mix)
* `Fatigue` (1-10 Intensity Level)
* `WarmUp` (Full, Rushed, None)
* `Notes`

### 2. Climbs Table
* `ClimbID` (Timestamp)
* `SessionID` (Foreign Key)
* `Date` (YYYY-MM-DD)
* `Type` (Discipline)
* `Name` (Gym Name or Route @ Crag)
* `Grade` (Display grade + Emojis)
* `Score` (Numeric value for chart math)
* `Style` (Ascent style e.g., flash, toprope, worked)
* `Burns` (Number of attempts)
* `Angle` (Steepness)
* `Effort` (My Effort: Breezy, Solid, Limit)
* `GradeFeel` (Soft, Hard)
* `Rating` (1-5 stars)
* `Holds` 
* `ClimStyles` (Climbing Style: Endurance, Cruxy, Technical, Athletic)
* `Notes` 

## 🧠 Core Application Logic
### 1. The Relational Session Engine
Logs are grouped by session (`Date` + `Location`). The Journal view automatically aggregates climbs under their parent session, calculating total volume (burns) and extracting the max grade sent for that specific day.

### 2. The Discipline & Grade Rules
The app maintains strict separation between disciplines to ensure chart math is accurate.
* **Performance Emojis:** ⚡ (Flash), 💎 (Onsight), 🚀 (Quick Send), 🛠️ (Project), ❌ (Worked), 🪢 (Top Rope), 🔄 (Auto Belay). 
* **Bouldering Badges:** Bouldering lists display a color-coded dot (e.g., 🔵) dynamically mapped to the grade array alongside the clean grade text.

## 📱 UI Layout & UX Principles
### The "Smart Hybrid" Input Approach
The UI is split into two distinct UX patterns to balance premium aesthetics with the reality of pumped forearms and chalky fingers.

**1. Main Logging App (Bulletproof Pills):**
Built for speed and poor fine-motor control during a session. Uses large, scrollable tap-to-select pills.
* *Zone 1 (Core):* Discipline, Date, Gym/Crag, Grade, Style, Burns Counter.
* *Zone 2 (Advanced Details):* Time of Day, Effort, Grade Feel, Star Rating, Steepness, Climb Style, Holds.

**2. Session Editor Modal (Premium Segmented UI):**
A sleek, modern overlay for logging post-session metrics. 
* *Segmented Controls:* Used for **Focus** and **Warm-up**. Features a continuous dark track with a sliding green highlight for zero vertical bloat.
* *Tap-to-Jump Slider:* A custom, minimalist 4px track for **Fatigue** (1-10). The thumb snaps instantly to the tapped location, providing the elegance of a slider with the lazy accuracy of a button.

## 📊 The Nerd Dashboard
Designed to track progressive overload and energy systems specifically for balancing marathon mileage with strict climbing goals (e.g., WI5 Ice, 7a sport, One-Arm Hangs).

### Dashboard Controls
* **Discipline Filters:** In Rope, In Boulder, Out Rope, Out Boulder.
* **Log List Toggle:** Switches the main log view between "Recent" and "Top 10 (60d)".

### Analytical Modules
1. **Working Capacity (XP Bar):** Only appears when the log list is toggled to "Top 10 (60d)". Averages the top 10 climbs of the last 60 days, maps that average to the grade scoring system, and displays a visual progress bar showing proximity to the next base grade.
2. **Progress Chart (Line Graph):** * *Max Peak Mode:* Tracks the absolute highest Redpoint (solid green) and Flash/Onsight (dashed pink) per month.
    * *Avg (Top 10) Mode:* Tracks the rolling average of the top 10 hardest sends per month to monitor power-endurance and base building.
3. **Flat-List Log Engine:** A highly condensed, color-coded recent activity feed that uses a subtle left-border highlight to indicate ascent style (Green = Redpoint, Pink = Flash, Orange = Fail).
