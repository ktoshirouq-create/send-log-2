// shared.js
// Shared config and helpers used by both app.js and dashboard.js.
// MUST load before app.js and dashboard.js.

const AppConfig = {
    api: "https://script.google.com/macros/s/AKfycbwMh-T7DB7S06_8DB2GC4dniByVHrRSqbODdLRhjciDOXSDL-V4_vzQtRXee2Wmqp9L/exec",
    gyms: ["OKS", "Torshov", "Løkka", "Bryn", "Gneiss", "Other"],
    months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    days: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    disciplines: ['Indoor Rope Climbing', 'Indoor Bouldering', 'Outdoor Rope Climbing', 'Outdoor Bouldering', 'Outdoor Multipitch', 'Outdoor Trad Climbing', 'Outdoor Ice Climbing'],
    discLabels: ['In Rope', 'In Boulder', 'Out Rope', 'Out Boulder', 'Multipitch', 'Trad', 'Ice'],
    styles: { 'project': 'Project', 'quick': 'Send', 'send': 'Send', 'flash': 'Flash', 'onsight': 'Onsight', 'toprope': 'Top Rope', 'autobelay': 'Auto Belay', 'worked': 'Worked', 'topped': 'Topped Out', 'allfree': 'All Free', 'bailed': 'Bailed' },
    steepness: ['Slab', 'Vertical', 'Overhang', 'Roof'],
    climbStyles: ['Endurance', 'Cruxy', 'Technical', 'Athletic', 'Crack'],
    holds: ['Crimps', 'Slopers', 'Pockets', 'Pinches', 'Tufas', 'Jugs', 'Cracks'],
    iceFeatures: ['Pillar', 'Curtain', 'Shield', 'Cauliflower', 'Mixed', 'Alpine'],
    iceConditions: ['Plastic', 'Hero Ice', 'Brittle', 'Wet/Slushy', 'Chandeliers'],
    rpes: ['Breezy', 'Solid', 'Limit'],
    gearStyles: ['Sport', 'Trad', 'Mixed'],
    packWeights: ['Minimal', 'Standard', 'Heavy'],
    ratingTextMap: {
        1: "Trash / Garbage",
        2: "Forgettable / Meh",
        3: "Decent / Solid",
        4: "Excellent / Flowy",
        5: "Masterpiece / Classic"
    },
    grades: {
        ropesIn: { labels: ["5a","5a+","5b","5b+","5c","5c+","6a","6a+","6b","6b+","6c","6c+","7a","7a+","7b","7b+","7c","7c+","8a","8b","8c","9a"], scores: [500,517,533,550,567,583,600,617,633,650,667,683,700,717,733,750,767,783,800,833,867,900], colors: [] },
        ropesOut: { labels: ["3","4a","4b","4c","5a","5a+","5b","5b+","5c","5c+","6a","6a+","6b","6b+","6c","6c+","7a","7a+","7b","7b+","7c","7c+","8a","8b","8c","9a"], scores: [300,400,433,467,500,517,533,550,567,583,600,617,633,650,667,683,700,717,733,750,767,783,800,833,867,900], colors: [] },
        bouldsIn: { labels: ["4","5","6A","6B","6C","7A","7B"], scores: [400,500,600,633,667,700,733], colors: ["#ffffff", "#22c55e", "#3b82f6", "#eab308", "#ef4444", "#3f3f46", "#a855f7"] },
        bouldsOut: { labels: ["3","4","5","5+","6A","6A+","6B","6B+","6C","6C+","7A","7A+","7B","7B+","7C"], scores: [300,400,500,550,600,617,633,650,667,683,700,717,733,750,767], colors: [] },
        ice: { labels: ["WI2","WI3","WI4","WI4+","WI5","WI5+","WI6","WI6+","WI7","M4","M5","M6","M7","M8"], scores: [300,450,600,650,700,750,800,850,900,600,650,700,750,800], colors: [] }
    }
};

// Single source of truth for per-style behaviour. Read by app.js (form UI, scoring, save)
// so the rules live in ONE place instead of being duplicated across the codebase.
//   scored        — does getScoredValue give it points (base + maybe bonus)?
//   bonus         — flash/onsight get the discipline-aware bonus on top of base
//   defaultBurns  — what Burns resets to when this style is picked ('-' = N/A)
//   showHighPoint — show the High Point slider (incomplete attempts only)
//   hideBurns     — hide the Burns counter (flash/onsight are implicitly 1)
// NOTE: multipitch (topped/allfree) is scored by pitch breakdown downstream, not by this value.
const STYLE_DEFS = {
    onsight:   { label: 'Onsight',    scored: true,  bonus: true,  defaultBurns: 1,   showHighPoint: false, hideBurns: true  },
    flash:     { label: 'Flash',      scored: true,  bonus: true,  defaultBurns: 1,   showHighPoint: false, hideBurns: true  },
    send:      { label: 'Send',       scored: true,  bonus: false, defaultBurns: 2,   showHighPoint: false, hideBurns: false },
    quick:     { label: 'Send',       scored: true,  bonus: false, defaultBurns: 2,   showHighPoint: false, hideBurns: false },
    toprope:   { label: 'Top Rope',   scored: false, bonus: false, defaultBurns: 1,   showHighPoint: false, hideBurns: false },
    autobelay: { label: 'Auto Belay', scored: false, bonus: false, defaultBurns: 1,   showHighPoint: false, hideBurns: false },
    project:   { label: 'Project',    scored: false, bonus: false, defaultBurns: '-', showHighPoint: true,  hideBurns: false },
    worked:    { label: 'Worked',     scored: false, bonus: false, defaultBurns: '-', showHighPoint: true,  hideBurns: false },
    topped:    { label: 'Topped Out', scored: true,  bonus: false, defaultBurns: '-', showHighPoint: false, hideBurns: false },
    allfree:   { label: 'All Free',   scored: true,  bonus: false, defaultBurns: '-', showHighPoint: false, hideBurns: false },
    bailed:    { label: 'Bailed',     scored: false, bonus: false, defaultBurns: '-', showHighPoint: false, hideBurns: false }
};

const getBaseGrade = (g) => String(g || "").replace(/[⚡💎🚀🛠️❌🪢🔄\s]/g, '');

const getCleanDate = (dStr) => {
    if (!dStr) {
        // inline equivalent of getLocalISO for default — keeps shared.js dependency-free
        const d = new Date();
        return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().substring(0, 10);
    }
    if (typeof dStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dStr.trim())) return dStr.trim();
    const d = new Date(dStr);
    if (!isNaN(d.getTime())) {
        d.setHours(d.getHours() + 12); // intentional: avoids timezone-related off-by-one date issues
        return d.toISOString().substring(0, 10);
    }
    return String(dStr).substring(0, 10);
};

const escapeHTML = (str) => {
    if (!str) return "";
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
};

const formatShortDate = (dStr) => {
    const clean = getCleanDate(dStr);
    const [y, m, d] = clean.split('-');
    return `${parseInt(d, 10)} ${AppConfig.months[parseInt(m, 10)-1]}`;
};

const getScaleConfig = (disc) => {
    if (disc === 'Indoor Bouldering') return AppConfig.grades.bouldsIn;
    if (disc === 'Outdoor Bouldering') return AppConfig.grades.bouldsOut;
    if (disc === 'Outdoor Ice Climbing') return AppConfig.grades.ice;
    if (disc === 'Outdoor Rope Climbing' || disc === 'Outdoor Multipitch' || disc === 'Outdoor Trad Climbing') return AppConfig.grades.ropesOut;
    return AppConfig.grades.ropesIn;
};

// Single source of truth for a climb's score.
// Sends/flashes/onsights = base + bonus. Non-sends = 0.
// Bonus is discipline-aware: +17 boulder, +10 rope/trad/ice. Send = no bonus.
// NOTE: multipitch is scored separately (per-pitch sum) — do not route it here.
const getScoredValue = (grade, style, discipline) => {
    const styleNorm = String(style || '').toLowerCase();
    if (['worked', 'toprope', 'project', 'autobelay', 'bailed'].includes(styleNorm)) return 0;
    const scale = getScaleConfig(discipline);
    if (!scale || !scale.labels) return 0;
    const idx = scale.labels.indexOf(getBaseGrade(grade));
    if (idx === -1) return 0;
    let bonus = 0;
    if (styleNorm === 'flash' || styleNorm === 'onsight') {
        bonus = String(discipline).includes('Bouldering') ? 17 : 10;
    }
    return scale.scores[idx] + bonus;
};
