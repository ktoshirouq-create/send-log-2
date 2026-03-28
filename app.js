if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW Registration failed:', err)));
}

const API_URL = "https://script.google.com/macros/s/AKfycby0fW1C830QNXESDs6B1NFB9_gLRqOwOycCly63i4jDxlU7L8_W4Du4w-4hhGE4Pak2/exec";

const GRADES = {
    ropes: ["5c","5c+","6a","6a+","6b","6b+","6c","6c+","7a","7a+","7b","7b+"],
    ropeScores: [567,583,600,617,633,650,667,683,700,717,733,750],
    bouldsIn: ["4","5","6A","6B","6C","7A","7B"],
    bouldsInScores: [400,500,600,633,667,700,733],
    bouldsInColors: ["#ffffff", "#22c55e", "#3b82f6", "#eab308", "#ef4444", "#3f3f46", "#a855f7"],
    bouldsOut: ["3","4","5","5+","6A","6A+","6B","6B+","6C","6C+","7A","7A+","7B","7B+","7C"],
    bouldsOutScores: [300,400,500,550,600,617,633,650,667,683,700,717,733,750,767]
};

const GYMS = ["OKS", "Torshov", "Løkka", "Bryn", "Gneiss", "Other"];
const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DISCIPLINES = ['Indoor Rope Climbing', 'Indoor Bouldering', 'Outdoor Rope Climbing', 'Outdoor Bouldering'];
const DISC_LABELS = ['In Rope', 'In Boulder', 'Out Rope', 'Out Boulder'];
const STYLE_MAP = { 'project': 'Project', 'quick': 'Quick Send', 'flash': 'Flash', 'onsight': 'Onsight' };

const STEEPNESS = ['Slab', 'Vertical', 'Overhang', 'Roof'];
const CLIMB_STYLES = ['Endurance', 'Cruxy', 'Technical', 'Athletic'];
const HOLDS = ['Crimps', 'Slopers', 'Pockets', 'Pinches', 'Tufas', 'Jugs'];
const RPES = ['Breezy', 'Solid', 'Limit'];
const TIMES_OF_DAY = ['Morning', 'Afternoon', 'Evening'];

const getBaseGrade = (g) => String(g || "").replace(/[⚡👁️🚀🛠️\s]/g, '');
const getLocalISO = (d = new Date()) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().substring(0, 10);

const getScaleConfig = (disc) => {
    if (disc === 'Indoor Bouldering') return { labels: GRADES.bouldsIn, scores: GRADES.bouldsInScores, colors: GRADES.bouldsInColors };
    if (disc === 'Outdoor Bouldering') return { labels: GRADES.bouldsOut, scores: GRADES.bouldsOutScores, colors: [] };
    return { labels: GRADES.ropes, scores: GRADES.ropeScores, colors: [] };
};

const getBadge = (type, gradeText) => {
    if (type !== 'Indoor Bouldering') return '';
    const idx = GRADES.bouldsIn.indexOf(getBaseGrade(gradeText));
    return idx > -1 ? `<span class="boulder-dot" style="background:${GRADES.bouldsInColors[idx]};"></span>` : '';
};

let safeLogs = [];
try {
    const rawLogs = localStorage.getItem('climbLogs');
    if (rawLogs) safeLogs = JSON.parse(rawLogs);
    if (!Array.isArray(safeLogs)) safeLogs = [];
} catch (e) {
    safeLogs = [];
    localStorage.removeItem('climbLogs');
}

const State = new Proxy({
    view: 'log', discipline: 'Indoor Rope Climbing', activeGrade: { text: '6b', score: 633 },
    activeStyle: 'project', activeDate: getLocalISO(), activeGym: 'OKS', chartMode: 'max', listMode: 'top10',
    activeRPE: 'Solid', activeGradeFeel: '', activeRating: 0, activeSteepness: [], activeClimbStyles: [], activeHolds: [], 
    activeTimeOfDay: '', logs: safeLogs
}, {
    set(target, prop, value) {
        target[prop] = value;
        if (prop === 'view') {
            ['log', 'dash'].forEach(v => {
                const isActive = target.view === v;
                document.getElementById(`view-${v}`).classList.toggle('active', isActive);
                document.getElementById(`nav-${v}`).classList.toggle('active', isActive);
            });
        }
        App.renderUI();
        if (prop === 'logs') {
            localStorage.setItem('climbLogs', JSON.stringify(value));
            localStorage.setItem('climbingLogs', JSON.stringify(value)); 
        }
        return true;
    }
});

const SyncManager = {
    trigger: () => {
        const b = document.querySelectorAll('.sync-badge');
        b.forEach(i => i.classList.add('syncing'));
        fetch(API_URL).then(res => res.json()).then(data => {
            const cloudIds = new Set(data.map(d => String(d.id)));
            const pendingLocals = State.logs.filter(l => l && (!cloudIds.has(String(l.id)) || l._synced === false));
            pendingLocals.forEach(localLog => SyncManager.push(localLog));
            const uniqueLogs = Array.from(new Map([...data.map(d => ({...d, _synced:true})), ...State.logs.filter(l => !cloudIds.has(String(l.id)))].map(item => [String(item.id), item])).values());
            State.logs = uniqueLogs.sort((a,b) => Number(b.id) - Number(a.id));
            b.forEach(i => i.classList.remove('syncing'));
        }).catch(() => b.forEach(i => i.classList.remove('syncing')));
    },
    push: async (payload) => { 
        if (!navigator.onLine) return;
        await fetch(API_URL, { method: 'POST', body: JSON.stringify(payload) });
    }
};

const App = {
    init: () => { App.renderUI(); SyncManager.trigger(); },
    haptic: () => { if (navigator.vibrate) navigator.vibrate(40); },
    setDate: (type, val = null) => {
        if (type === 'today') State.activeDate = getLocalISO();
        else if (type === 'yesterday') { let yest = new Date(); yest.setDate(yest.getDate()-1); State.activeDate = getLocalISO(yest); }
        else if (type === 'custom' && val) State.activeDate = val;
    },
    setRating: (num) => { State.activeRating = State.activeRating === num ? 0 : num; },
    toggleGradeFeel: (feel) => { State.activeGradeFeel = State.activeGradeFeel === feel ? '' : feel; },
    toggleMulti: (category, val) => {
        if (category === 'style') State.activeClimbStyles = State.activeClimbStyles.includes(val) ? State.activeClimbStyles.filter(x => x !== val) : [...State.activeClimbStyles, val];
        else if (category === 'hold') State.activeHolds = State.activeHolds.includes(val) ? State.activeHolds.filter(x => x !== val) : [...State.activeHolds, val];
        else if (category === 'steepness') State.activeSteepness = State.activeSteepness.includes(val) ? State.activeSteepness.filter(x => x !== val) : [...State.activeSteepness, val];
    },
    renderUI: () => {
        const dStr = State.discipline;
        const conf = getScaleConfig(dStr);
        const buildPills = (arr, activeVal, clickAction) => arr.map(item => `<div class="pill ${item === activeVal ? 'active' : ''}" onclick="App.haptic(); ${clickAction}='${item}';">${item}</div>`).join('');

        document.getElementById('typeSelector').innerHTML = DISCIPLINES.map((d, i) => `<div class="pill ${dStr === d ? 'active' : ''}" onclick="App.haptic(); State.discipline='${d}'">${DISC_LABELS[i]}</div>`).join('');
        document.getElementById('gradePicker').innerHTML = conf.labels.map((g, i) => `<div class="pill ${String(g).toLowerCase() === String(State.activeGrade.text).toLowerCase() ? 'active' : ''}" onclick="App.haptic(); State.activeGrade={text:'${g}', score:${conf.scores[i]}};">${g}</div>`).join('');
        
        document.getElementById('rpeSelector').innerHTML = buildPills(RPES, State.activeRPE, "State.activeRPE");
        document.getElementById('steepnessSelector').innerHTML = STEEPNESS.map(s => `<div class="pill ${State.activeSteepness.includes(s) ? 'active' : ''}" onclick="App.haptic(); App.toggleMulti('steepness', '${s}')">${s}</div>`).join('');
        document.getElementById('climbStyleSelector').innerHTML = CLIMB_STYLES.map(s => `<div class="pill ${State.activeClimbStyles.includes(s) ? 'active' : ''}" onclick="App.haptic(); App.toggleMulti('style', '${s}')">${s}</div>`).join('');
        document.getElementById('holdsSelector').innerHTML = HOLDS.map(h => `<div class="pill ${State.activeHolds.includes(h) ? 'active' : ''}" onclick="App.haptic(); App.toggleMulti('hold', '${h}')">${h}</div>`).join('');
        document.getElementById('timeOfDaySelector').innerHTML = buildPills(TIMES_OF_DAY, State.activeTimeOfDay, "State.activeTimeOfDay");

        const stars = document.getElementById('starRating').children;
        for(let i=0; i<stars.length; i++) stars[i].className = i < State.activeRating ? 'active' : '';
    },
    logClimb: () => {
        App.haptic();
        let s = State.activeGrade.score, g = State.activeGrade.text;
        if(State.activeStyle === 'flash') s += 15;
        
        // AUTO TIME ENGINE
        let timeOfSession = State.activeTimeOfDay;
        if (!timeOfSession) {
            const hr = new Date().getHours();
            if (hr >= 5 && hr < 12) timeOfSession = 'Morning';
            else if (hr >= 12 && hr < 17) timeOfSession = 'Afternoon';
            else timeOfSession = 'Evening';
        }

        const tagsArr = [...State.activeSteepness, State.activeStyle, State.activeRPE, State.activeGradeFeel, State.activeRating > 0 ? `${State.activeRating} Star` : '', ...State.activeClimbStyles, ...State.activeHolds, timeOfSession].filter(Boolean);
        const l = { 
            id: String(Date.now()), date: State.activeDate, type: State.discipline, grade: g, score: s, 
            name: State.discipline.includes('Outdoor') ? document.getElementById('input-name').value : State.activeGym, 
            angle: State.activeSteepness.join(', '), tags: tagsArr.join(', '), notes: document.getElementById('input-notes').value, 
            _synced: false 
        };
        State.logs = [...State.logs, l]; SyncManager.push(l);
        State.activeRating = 0; State.activeTimeOfDay = ''; // Reset
    }
};
App.init();
