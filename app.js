if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW Registration failed:', err)));
}

const AppConfig = {
    api: "https://script.google.com/macros/s/AKfycbwMh-T7DB7S06_8DB2GC4dniByVHrRSqbODdLRhjciDOXSDL-V4_vzQtRXee2Wmqp9L/exec",
    gyms: ["OKS", "Torshov", "Løkka", "Bryn", "Gneiss", "Other"],
    months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    days: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    disciplines: ['Indoor Rope Climbing', 'Indoor Bouldering', 'Outdoor Rope Climbing', 'Outdoor Bouldering'],
    discLabels: ['In Rope', 'In Boulder', 'Out Rope', 'Out Boulder'],
    styles: { 'project': 'Project', 'quick': 'Send', 'flash': 'Flash', 'onsight': 'Onsight', 'toprope': 'Top Rope', 'autobelay': 'Auto Belay', 'worked': 'Worked' },
    steepness: ['Slab', 'Vertical', 'Overhang', 'Roof'],
    climbStyles: ['Endurance', 'Cruxy', 'Technical', 'Athletic'],
    holds: ['Crimps', 'Slopers', 'Pockets', 'Pinches', 'Tufas', 'Jugs'],
    rpes: ['Breezy', 'Solid', 'Limit'],
    grades: {
        ropes: { labels: ["5a","5a+","5b","5b+","5c","5c+","6a","6a+","6b","6b+","6c","6c+","7a","7a+","7b","7b+"], scores: [500,517,533,550,567,583,600,617,633,650,667,683,700,717,733,750], colors: [] },
        bouldsIn: { labels: ["4","5","6A","6B","6C","7A","7B"], scores: [400,500,600,633,667,700,733], colors: ["#ffffff", "#22c55e", "#3b82f6", "#eab308", "#ef4444", "#3f3f46", "#a855f7"] },
        bouldsOut: { labels: ["3","4","5","5+","6A","6A+","6B","6B+","6C","6C+","7A","7A+","7B","7B+","7C"], scores: [300,400,500,550,600,617,633,650,667,683,700,717,733,750,767], colors: [] }
    }
};

const getBaseGrade = (g) => String(g || "").replace(/[⚡💎🚀🛠️❌🪢🔄\s]/g, '');
const getLocalISO = (d = new Date()) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().substring(0, 10);
const getCleanDate = (dStr) => dStr ? String(dStr).substring(0, 10) : getLocalISO();

const getJournalDateObj = (dStr) => {
    const clean = getCleanDate(dStr);
    const [y, m, d] = clean.split('-');
    const dateObj = new Date(y, parseInt(m)-1, d);
    return { main: `${d} ${AppConfig.months[parseInt(m)-1]}`, sub: AppConfig.days[dateObj.getDay()] };
};

const formatShortDate = (dStr) => {
    const clean = getCleanDate(dStr);
    const [y, m, d] = clean.split('-');
    return `${d} ${AppConfig.months[parseInt(m)-1]}`;
};

const getScaleConfig = (disc) => {
    if (disc === 'Indoor Bouldering') return AppConfig.grades.bouldsIn;
    if (disc === 'Outdoor Bouldering') return AppConfig.grades.bouldsOut;
    return AppConfig.grades.ropes;
};

// TYPOGRAPHIC BADGES TO REPLACE EMOJIS
const getStyleBadge = (style) => {
    const map = {
        'onsight': { text: 'OS', cls: 'badge-fl' },
        'flash': { text: 'FL', cls: 'badge-fl' },
        'quick': { text: 'RP', cls: 'badge-rp' },
        'project': { text: 'PR', cls: 'badge-ghost' },
        'worked': { text: 'WK', cls: 'badge-ghost' },
        'toprope': { text: 'TR', cls: 'badge-ghost' },
        'autobelay': { text: 'AB', cls: 'badge-ghost' }
    };
    const b = map[style] || { text: 'RP', cls: 'badge-rp' };
    return `<span class="micro-badge ${b.cls}">${b.text}</span>`;
};

let deletedClimbs = JSON.parse(localStorage.getItem('crag_deleted_climbs') || '[]');
let deletedSessions = JSON.parse(localStorage.getItem('crag_deleted_sessions') || '[]');
let safeClimbs = JSON.parse(localStorage.getItem('crag_climbs_master') || '[]');
let safeSessions = JSON.parse(localStorage.getItem('crag_sessions_master') || '[]');

let initDisc = localStorage.getItem('lastDiscipline') || 'Indoor Rope Climbing';
let initStyle = localStorage.getItem('lastStyle') || 'quick';
let initGym = localStorage.getItem('lastGym') || 'OKS';
let initConf = getScaleConfig(initDisc);

let savedGrade = localStorage.getItem('lastGradeText');
let gIdx = savedGrade ? initConf.labels.indexOf(savedGrade) : -1;
if (gIdx === -1) gIdx = initConf.labels.length > 8 ? 8 : 0;

const State = new Proxy({
    view: 'log', discipline: initDisc, 
    activeGrade: { text: initConf.labels[gIdx], score: initConf.scores[gIdx] },
    activeStyle: initStyle, activeBurns: '-', activeHighPoint: 50, activeDate: getLocalISO(), activeGym: initGym, chartMode: 'max', listMode: 'top10',
    activeRPE: 'Solid', activeGradeFeel: '', activeRating: 0, activeSteepness: [], activeClimbStyles: [], activeHolds: [],
    activeTimeBucket: '', climbs: safeClimbs, sessions: safeSessions, journalLimit: 15
}, {
    set(target, prop, value) {
        let oldVal = target[prop];
        target[prop] = value;
        
        if (prop === 'discipline') localStorage.setItem('lastDiscipline', value);
        if (prop === 'activeGym') localStorage.setItem('lastGym', value);
        if (prop === 'activeStyle') localStorage.setItem('lastStyle', value);
        if (prop === 'activeGrade') localStorage.setItem('lastGradeText', value.text);
        
        if (prop === 'discipline' && oldVal !== value) {
            const conf = getScaleConfig(value);
            if (!conf.labels.some(g => String(g).toLowerCase() === String(target.activeGrade.text).toLowerCase())) {
                target.activeGrade = { text: conf.labels[0], score: conf.scores[0] };
            }
            if (value === 'Indoor Rope Climbing' && (target.activeGym === 'Løkka' || target.activeGym === 'Bryn')) {
                target.activeGym = 'OKS';
            }
            App.renderUI();
        } else if (prop === 'view') {
            ['log', 'journal', 'dash'].forEach(v => {
                document.getElementById(`view-${v}`).classList.toggle('active', target.view === v);
                document.getElementById(`nav-${v}`).classList.toggle('active', target.view === v);
            });
            if(target.view === 'journal') App.renderJournal();
            if(target.view === 'dash') App.renderDashboard();
            setTimeout(() => App.centerActivePills(), 50); 
        } else {
            const softPaintTriggers = [
                'activeGym', 'activeStyle', 'activeBurns', 'chartMode', 
                'activeRPE', 'activeGradeFeel', 'activeRating', 'activeSteepness', 
                'activeClimbStyles', 'activeHolds', 'activeTimeBucket', 'activeGrade'
            ];
            if (softPaintTriggers.includes(prop)) {
                App.updateUISelections(); 
                if (prop === 'chartMode' && target.view === 'dash') App.renderDashboardCharts();
            }
        }

        if (prop === 'listMode' && target.view === 'dash') App.renderDashboardLogs();
        
        if (prop === 'climbs' || prop === 'sessions' || prop === 'journalLimit') {
            if (prop !== 'journalLimit') {
                localStorage.setItem('crag_climbs_master', JSON.stringify(target.climbs));
                localStorage.setItem('crag_sessions_master', JSON.stringify(target.sessions)); 
            }
            if (target.view === 'dash') App.renderDashboard();
            if (target.view === 'journal') App.renderJournal();
        }
        return true;
    }
});

const SyncManager = {
    trigger: () => {
        const b = document.querySelectorAll('.sync-badge');
        b.forEach(i => i.classList.add('syncing'));
        if (!navigator.onLine) return setTimeout(() => b.forEach(i => i.classList.remove('syncing')), 1000);
        
        fetch(AppConfig.api).then(res => res.json()).then(data => {
            const cloudClimbs = data.climbs || [];
            const cloudSessions = data.sessions || [];
            const serverClimbIds = new Set(cloudClimbs.map(c => String(c.ClimbID)));
            const unsyncedClimbs = State.climbs.filter(c => !serverClimbIds.has(String(c.ClimbID)) || c._synced === false);
            const serverSessionIds = new Set(cloudSessions.map(s => String(s.SessionID)));
            const unsyncedSessions = State.sessions.filter(s => !serverSessionIds.has(String(s.SessionID)) || s._synced === false);

            if (unsyncedClimbs.length > 0 || unsyncedSessions.length > 0 || deletedClimbs.length > 0) {
                SyncManager.pushAll(unsyncedSessions, unsyncedClimbs);
            }

            State.climbs = [...cloudClimbs, ...unsyncedClimbs].reduce((acc, current) => {
                if (!acc.find(item => String(item.ClimbID) === String(current.ClimbID))) return acc.concat([current]);
                return acc;
            }, []).filter(c => !deletedClimbs.includes(String(c.ClimbID)));

            State.sessions = [...cloudSessions, ...unsyncedSessions].reduce((acc, current) => {
                if (!acc.find(item => String(item.SessionID) === String(current.SessionID))) return acc.concat([current]);
                return acc;
            }, []).filter(s => !deletedSessions.includes(String(s.SessionID)));

            b.forEach(i => i.classList.remove('syncing'));
        }).catch(() => b.forEach(i => i.classList.remove('syncing')));
    },
    pushAll: async (sessions, climbs) => { 
        if (!navigator.onLine) return;
        const payload = { action: "sync_all", sessions, climbs, deletedClimbs, deletedSessions };
        try {
            const res = await fetch(AppConfig.api, { method: 'POST', body: JSON.stringify(payload) });
            const result = await res.json();
            if (result.status === 'success') {
                State.climbs = State.climbs.map(c => ({...c, _synced: true}));
                State.sessions = State.sessions.map(s => ({...s, _synced: true}));
                deletedClimbs = []; localStorage.setItem('crag_deleted_climbs', '[]');
                deletedSessions = []; localStorage.setItem('crag_deleted_sessions', '[]');
            }
        } catch (error) {}
    }
};

const App = {
    chart: null,
    isSaving: false,
    isDraggingHP: false,
    isDraggingFatigue: false,
    
    init: () => {
        if (window.Chart) { Chart.defaults.color = '#a3a3a3'; Chart.defaults.borderColor = 'rgba(255,255,255,0.05)'; Chart.defaults.font.family = "'Inter', sans-serif"; }
        document.getElementById('input-crag').value = localStorage.getItem('lastCrag') || '';
        
        App.initScrubber();
        App.renderUI();
        SyncManager.trigger(); 
        window.addEventListener('online', SyncManager.trigger);
    },
    haptic: () => { if (navigator.vibrate) navigator.vibrate(40); },
    toast: (msg) => {
        const t = document.getElementById('toast');
        if(t) { t.innerText = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2500); }
    },
    deleteClimb: (id) => { 
        App.haptic(); 
        if(confirm('Delete this log permanently?')) { 
            deletedClimbs.push(String(id));
            localStorage.setItem('crag_deleted_climbs', JSON.stringify(deletedClimbs));
            State.climbs = State.climbs.filter(l => String(l.ClimbID) !== String(id)); 
            SyncManager.pushAll([], []); 
            App.toast("Deleted"); 
        } 
    },
    setDate: (type, val = null) => {
        App.haptic();
        document.querySelectorAll('#datePicker .pill').forEach(p => p.classList.remove('active'));
        if (type === 'today') { State.activeDate = getLocalISO(); document.getElementById('pill-today').classList.add('active'); }
        else if (type === 'yesterday') { let yest = new Date(); yest.setDate(yest.getDate()-1); State.activeDate = getLocalISO(yest); document.getElementById('pill-yest').classList.add('active'); }
        else if (type === 'custom' && val) { 
            State.activeDate = val; const [, m, d] = val.split('-');
            const customPill = document.getElementById('pill-custom');
            customPill.classList.add('active');
            customPill.innerText = `${AppConfig.months[parseInt(m)-1]} ${parseInt(d)}`;
        }
    },
    setTimeBucket: (val) => { App.haptic(); State.activeTimeBucket = State.activeTimeBucket === val ? '' : val; },
    centerActivePills: () => {
        document.querySelectorAll('.pill-row').forEach(row => {
            const active = row.querySelector('.pill.active');
            if (active) {
                const scrollPos = active.offsetLeft - (row.offsetWidth / 2) + (active.offsetWidth / 2);
                row.scrollTo({ left: Math.max(0, scrollPos), behavior: 'smooth' });
            }
        });
    },
    setRating: (num) => { App.haptic(); State.activeRating = State.activeRating === num ? 0 : num; },
    toggleGradeFeel: (feel) => { App.haptic(); State.activeGradeFeel = State.activeGradeFeel === feel ? '' : feel; },
    toggleMulti: (category, val) => {
        App.haptic();
        if (category === 'style') State.activeClimbStyles = State.activeClimbStyles.includes(val) ? State.activeClimbStyles.filter(x => x !== val) : [...State.activeClimbStyles, val];
        else if (category === 'hold') State.activeHolds = State.activeHolds.includes(val) ? State.activeHolds.filter(x => x !== val) : [...State.activeHolds, val];
        else if (category === 'steepness') State.activeSteepness = State.activeSteepness.includes(val) ? State.activeSteepness.filter(x => x !== val) : [...State.activeSteepness, val];
    },
    adjBurns: (dir) => { 
        App.haptic(); 
        if (State.activeBurns === '-') {
            State.activeBurns = dir > 0 ? 1 : '-';
        } else {
            let newVal = State.activeBurns + dir;
            State.activeBurns = newVal < 1 ? '-' : newVal;
        }
    },

    // CONTINUOUS SCRUBBER LOGIC (High Point + Fatigue)
    handleHPSlide: (e) => {
        if (!App.isDraggingHP && e.type !== 'click' && e.type !== 'touchstart') return;
        const track = document.getElementById('hp-track');
        const rect = track.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        let percent = (clientX - rect.left) / rect.width;
        percent = Math.max(0, Math.min(1, percent));
        let val = Math.round(percent * 100);
        if (val === 100) val = 99; // 99% cap for incomplete routes
        
        if (Math.abs(val - State.activeHighPoint) >= 5 || val === 0 || val === 99) {
            if(Math.abs(val - State.activeHighPoint) >= 10) App.haptic(); 
            State.activeHighPoint = val;
            document.getElementById('hp-output').innerText = `${val}%`;
            document.getElementById('hp-fill').style.width = `${val}%`;
            document.getElementById('hp-thumb').style.left = `${val}%`;
        }
    },
    handleFatigueSlide: (e) => {
        if (!App.isDraggingFatigue && e.type !== 'click' && e.type !== 'touchstart') return;
        const track = document.getElementById('fatigue-track');
        const rect = track.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        let percent = (clientX - rect.left) / rect.width;
        percent = Math.max(0, Math.min(1, percent));
        let val = Math.round(percent * 9) + 1; 
        App.setModalFatigue(val);
    },
    initScrubber: () => {
        // High Point
        const hpCont = document.getElementById('hp-track-container');
        if(hpCont) {
            const startHP = (e) => { App.isDraggingHP = true; App.handleHPSlide(e); };
            const endHP = () => { App.isDraggingHP = false; };
            hpCont.addEventListener('mousedown', startHP);
            document.addEventListener('mousemove', (e) => { if(App.isDraggingHP) App.handleHPSlide(e); });
            document.addEventListener('mouseup', endHP);
            hpCont.addEventListener('touchstart', startHP, {passive: true});
            document.addEventListener('touchmove', (e) => { if(App.isDraggingHP) App.handleHPSlide(e); }, {passive: true});
            document.addEventListener('touchend', endHP);
        }
        
        // Fatigue
        const fatCont = document.getElementById('fatigue-track-container');
        if(fatCont) {
            const startFat = (e) => { App.isDraggingFatigue = true; App.handleFatigueSlide(e); };
            const endFat = () => { App.isDraggingFatigue = false; };
            fatCont.addEventListener('mousedown', startFat);
            document.addEventListener('mousemove', (e) => { if(App.isDraggingFatigue) App.handleFatigueSlide(e); });
            document.addEventListener('mouseup', endFat);
            fatCont.addEventListener('touchstart', startFat, {passive: true});
            document.addEventListener('touchmove', (e) => { if(App.isDraggingFatigue) App.handleFatigueSlide(e); }, {passive: true});
            document.addEventListener('touchend', endFat);
        }
    },

    updateSegmentedHighlight: (containerId, val) => {
        setTimeout(() => {
            const container = document.getElementById(containerId);
            if (!container) return;
            const items = Array.from(container.querySelectorAll('.seg-item'));
            const highlight = container.querySelector('.seg-highlight');
            let found = false;
            
            items.forEach(item => {
                const isActive = item.getAttribute('data-val') === val;
                item.classList.toggle('active', isActive);
                if (isActive) {
                    highlight.style.width = `${item.offsetWidth}px`;
                    highlight.style.transform = `translateX(${item.offsetLeft}px)`;
                    highlight.style.opacity = 1;
                    found = true;
                }
            });
            if(!found) highlight.style.opacity = 0;
        }, 10);
    },

    openSessionModal: (sessionId, mode) => {
        App.haptic();
        const s = State.sessions.find(x => String(x.SessionID) === String(sessionId));
        if(!s) return;
        document.getElementById('modalSessionId').value = s.SessionID;
        ['sec-focus', 'sec-fatigue', 'sec-warmup'].forEach(id => document.getElementById(id).classList.add('hidden'));
        document.getElementById('modalFocusVal').value = s.Focus || "";
        document.getElementById('modalFatigueVal').value = s.Fatigue || "";
        document.getElementById('modalWarmUpVal').value = s.WarmUp || "";
        document.getElementById('modalNotesVal').value = s.Notes || "";

        if (mode === 'focus') {
            document.getElementById('sec-focus').classList.remove('hidden');
            App.setModalFocus(s.Focus || "", true);
        } else if (mode === 'fatigue') {
            document.getElementById('sec-fatigue').classList.remove('hidden');
            App.setModalFatigue(s.Fatigue || "", true);
        } else if (mode === 'warmup') {
            document.getElementById('sec-warmup').classList.remove('hidden');
            App.setModalWarmUp(s.WarmUp || "", true);
        } else if (mode === 'notes') {
            setTimeout(() => document.getElementById('modalNotesVal').focus(), 300);
        }
        document.getElementById('sessionModal').classList.add('active');
    },
    closeSessionModal: () => {
        App.haptic();
        document.getElementById('sessionModal').classList.remove('active');
    },
    
    setModalFocus: (val, init = false) => {
        if(!init) App.haptic();
        const current = document.getElementById('modalFocusVal').value;
        const newVal = (!init && current === val) ? "" : val;
        document.getElementById('modalFocusVal').value = newVal;
        App.updateSegmentedHighlight('focus-segmented', newVal);
    },
    
    setModalFatigue: (val, init = false) => {
        const current = String(document.getElementById('modalFatigueVal').value);
        const strVal = String(val);
        const newVal = (!init && current === strVal) ? "" : strVal;
        
        // Apply haptic tick if crossing a whole number
        if (!init && current !== newVal && newVal !== "") App.haptic();
        
        document.getElementById('modalFatigueVal').value = newVal;
        
        const out = document.getElementById('fatigue-output');
        const fill = document.getElementById('fatigue-fill');
        const thumb = document.getElementById('fatigue-thumb');
        
        if (newVal === "") {
            out.innerText = "- / 10";
            out.style.color = "#737373";
            fill.style.width = "0%";
            thumb.style.display = "none";
        } else {
            out.innerText = `${newVal} / 10`;
            out.style.color = "var(--primary)";
            const pct = ((Number(newVal) - 1) / 9) * 100;
            fill.style.width = `${pct}%`;
            thumb.style.left = `${pct}%`;
            thumb.style.display = "block";
        }
    },

    setModalWarmUp: (val, init = false) => {
        if(!init) App.haptic();
        const current = document.getElementById('modalWarmUpVal').value;
        const newVal = (!init && current === val) ? "" : val;
        document.getElementById('modalWarmUpVal').value = newVal;
        App.updateSegmentedHighlight('warmup-segmented', newVal);
    },
    
    saveSessionModal: () => {
        App.haptic();
        const sessionId = document.getElementById('modalSessionId').value;
        const focus = document.getElementById('modalFocusVal').value;
        const fatigue = document.getElementById('modalFatigueVal').value;
        const warmup = document.getElementById('modalWarmUpVal').value;
        const notes = document.getElementById('modalNotesVal').value.trim();
        
        State.sessions = State.sessions.map(s => String(s.SessionID) === String(sessionId) ? {...s, Focus: focus, Fatigue: fatigue, WarmUp: warmup, Notes: notes, _synced: false} : s);
        SyncManager.pushAll(State.sessions.filter(s => s._synced === false), []);
        App.closeSessionModal();
    },

    validateForm: () => {
        if (App.isSaving) return; 
        
        const btn = document.getElementById('saveClimbBtn');
        if (!btn) return;
        const isOut = State.discipline.includes('Outdoor');
        const n = document.getElementById('input-name').value.trim();
        const c = document.getElementById('input-crag').value.trim();
        if (isOut && (!n || !c)) {
            btn.disabled = true;
            btn.innerText = 'Missing Route or Crag';
        } else {
            btn.disabled = false;
            btn.innerText = 'Save to Cloud';
        }
    },

    renderUI: () => {
        const dStr = String(State.discipline || "");
        const isOut = dStr.includes('Outdoor'), isRope = dStr.includes('Rope'), isBould = dStr.includes('Boulder');
        const conf = getScaleConfig(dStr);

        const buildPills = (arr, activeVal, clickAction) => arr.map(item => `<div class="pill ${item === activeVal ? 'active' : ''}" data-val="${item}" onclick="${clickAction}='${item}';">${item}</div>`).join('');

        document.getElementById('typeSelector').innerHTML = AppConfig.disciplines.map((d, i) => `<div class="pill ${dStr === d ? 'active' : ''}" data-val="${d}" onclick="App.haptic(); State.discipline='${d}'">${AppConfig.discLabels[i]}</div>`).join('');
        document.getElementById('dashSelector').innerHTML = AppConfig.disciplines.map((d, i) => `<div class="pill ${dStr === d ? 'active' : ''}" data-val="${d}" onclick="App.haptic(); State.discipline='${d}'">${AppConfig.discLabels[i]}</div>`).join('');
        
        document.getElementById('input-outdoor').className = isOut ? '' : 'hidden';
        document.getElementById('input-indoor').className = isOut ? 'hidden' : '';
        document.getElementById('input-name').placeholder = isBould ? 'La Marie Rose' : 'Silence';
        document.getElementById('input-crag').placeholder = isBould ? 'Sector, Crag 🇬🇷' : 'Flatanger';

        const currentGyms = (dStr === 'Indoor Rope Climbing') ? AppConfig.gyms.filter(g => g !== 'Løkka' && g !== 'Bryn') : AppConfig.gyms;
        document.getElementById('gymPicker').innerHTML = buildPills(currentGyms, State.activeGym, "App.haptic(); State.activeGym");
        
        document.getElementById('gradePicker').innerHTML = conf.labels.map((g, i) => {
            const dot = conf.colors[i] ? `<span class="boulder-dot" style="background:${conf.colors[i]};"></span>` : '';
            return `<div class="pill ${String(g) === String(State.activeGrade.text) ? 'active' : ''}" data-val="${g}" onclick="App.haptic(); State.activeGrade={text:'${g}', score:${conf.scores[i]}};">${dot}${g}</div>`;
        }).join('');

        let styles = [];
        if (isRope) {
            if (isOut) styles = [['project', 'Project'], ['quick', 'Send'], ['flash', 'Flash'], ['onsight', 'Onsight'], ['toprope', 'Top Rope'], ['worked', 'Worked']];
            else styles = [['project', 'Project'], ['quick', 'Send'], ['flash', 'Flash'], ['toprope', 'Top Rope'], ['autobelay', 'Auto Belay'], ['worked', 'Worked']];
        } else {
            styles = [['project', 'Project'], ['quick', 'Send'], ['flash', 'Flash'], ['worked', 'Worked']];
        }
        if (!styles.find(s => s[0] === State.activeStyle)) State.activeStyle = 'quick';
        
        document.getElementById('styleSelector').innerHTML = styles.map(s => {
            return `<div class="pill ${State.activeStyle === s[0] ? 'active' : ''}" data-val="${s[0]}" onclick="App.haptic(); State.activeStyle='${s[0]}'; 
                if(['flash', 'onsight', 'toprope', 'autobelay'].includes('${s[0]}')){ State.activeBurns = 1; }
                else if('${s[0]}' === 'quick' && (State.activeBurns === 1 || State.activeBurns === '-')){ State.activeBurns = 2; }
                else if(['project', 'worked'].includes('${s[0]}')){ State.activeBurns = '-'; }
            ">${s[1]}</div>`;
        }).join('');

        document.getElementById('rpeSelector').innerHTML = buildPills(AppConfig.rpes, State.activeRPE, "App.haptic(); State.activeRPE");
        document.getElementById('steepnessSelector').innerHTML = AppConfig.steepness.map(s => `<div class="pill ${State.activeSteepness.includes(s) ? 'active' : ''}" data-val="${s}" onclick="App.toggleMulti('steepness', '${s}')">${s}</div>`).join('');
        document.getElementById('climbStyleSelector').innerHTML = AppConfig.climbStyles.map(s => `<div class="pill ${State.activeClimbStyles.includes(s) ? 'active' : ''}" data-val="${s}" onclick="App.toggleMulti('style', '${s}')">${s}</div>`).join('');
        document.getElementById('holdsSelector').innerHTML = AppConfig.holds.map(h => `<div class="pill ${State.activeHolds.includes(h) ? 'active' : ''}" data-val="${h}" onclick="App.toggleMulti('hold', '${h}')">${h}</div>`).join('');
        
        document.getElementById('chartToggle').innerHTML = `<div class="chart-toggle-btn ${State.chartMode === 'max' ? 'active' : ''}" data-val="max" onclick="App.haptic(); State.chartMode='max';">Max Peak</div><div class="chart-toggle-btn ${State.chartMode === 'avg' ? 'active' : ''}" data-val="avg" onclick="App.haptic(); State.chartMode='avg';">Avg (Top 10)</div>`;

        App.updateUISelections(); 
        App.validateForm();
        if (State.view === 'dash') App.renderDashboard();
        if (State.view === 'journal') App.renderJournal();
        setTimeout(() => App.centerActivePills(), 10);
    },

    updateUISelections: () => {
        const syncSingle = (selector, val) => {
            document.querySelectorAll(`${selector} .pill, ${selector} .chart-toggle-btn`).forEach(p => {
                p.classList.toggle('active', p.getAttribute('data-val') === String(val));
            });
        };
        const syncMulti = (selector, valArr) => {
            document.querySelectorAll(`${selector} .pill`).forEach(p => {
                p.classList.toggle('active', valArr.includes(p.getAttribute('data-val')));
            });
        };
        syncSingle('#typeSelector', State.discipline);
        syncSingle('#dashSelector', State.discipline);
        syncSingle('#gymPicker', State.activeGym);
        syncSingle('#gradePicker', State.activeGrade.text);
        syncSingle('#styleSelector', State.activeStyle);
        syncSingle('#rpeSelector', State.activeRPE);
        syncMulti('#steepnessSelector', State.activeSteepness);
        syncMulti('#climbStyleSelector', State.activeClimbStyles);
        syncMulti('#holdsSelector', State.activeHolds);
        syncSingle('#chartToggle', State.chartMode);

        // CONDITIONAL HIGH POINT UI
        if (['worked', 'toprope'].includes(State.activeStyle)) {
            document.getElementById('highPointContainer').classList.remove('hidden');
        } else {
            document.getElementById('highPointContainer').classList.add('hidden');
        }

        ['morn', 'aft', 'eve'].forEach(id => {
            const el = document.getElementById(`time-${id}`);
            if (el) el.classList.toggle('active', State.activeTimeBucket === el.innerText);
        });
        document.getElementById('feel-soft').classList.toggle('active', State.activeGradeFeel === 'Soft');
        document.getElementById('feel-hard').classList.toggle('active', State.activeGradeFeel === 'Hard');
        const stars = document.getElementById('starRating').children;
        for(let i=0; i<stars.length; i++) stars[i].className = i < State.activeRating ? 'active' : '';
        
        const bCont = document.getElementById('burns-container');
        if (['flash', 'onsight'].includes(State.activeStyle)) bCont.classList.add('hidden');
        else bCont.classList.remove('hidden');
        document.getElementById('burns-val').innerText = State.activeBurns;
        App.validateForm();
    },

    renderJournal: () => {
        const jList = document.getElementById('journalList');
        if (State.sessions.length === 0) { jList.innerHTML = '<div class="empty-msg">No logs found.</div>'; return; }
        const visibleSessions = [...State.sessions].sort((a,b) => new Date(getCleanDate(b.Date)) - new Date(getCleanDate(a.Date))).slice(0, State.journalLimit);
        const climbsBySession = {};
        State.climbs.forEach(c => { if (!climbsBySession[c.SessionID]) climbsBySession[c.SessionID] = []; climbsBySession[c.SessionID].push(c); });

        jList.innerHTML = visibleSessions.map(session => {
            const children = climbsBySession[session.SessionID] || [];
            children.sort((a,b) => Number(b.ClimbID) - Number(a.ClimbID));
            if(children.length === 0) return ''; 
            const dateInfo = getJournalDateObj(session.Date);
            
            let maxSentStr = "-", maxColor = '#fff';
            const sends = children.filter(c => !['worked', 'toprope', 'autobelay', 'project'].includes(c.Style));
            const projects = children.filter(c => ['worked', 'toprope', 'autobelay', 'project'].includes(c.Style));
            
            if (sends.length > 0) {
                const maxSend = sends.reduce((max, cur) => Number(cur.Score) > Number(max.Score) ? cur : max);
                maxSentStr = getBaseGrade(maxSend.Grade);
                const sConf = getScaleConfig(maxSend.Type);
                if (maxSend.Type.includes('Bouldering') && sConf.colors) {
                    const mIdx = sConf.labels.indexOf(maxSentStr);
                    maxColor = sConf.colors[mIdx] || '#fff';
                } else if (maxSend.Type.includes('Rope')) maxColor = 'var(--primary)';
            }
            
            let domDisc = 'bg-mixed', domLabel = 'Mixed';
            const allTypes = [...new Set(children.map(c => c.Type))];
            if (allTypes.length === 1) {
                const typeStr = allTypes[0];
                domDisc = typeStr.includes('Bouldering') ? 'bg-boulder' : 'bg-rope';
                const idx = AppConfig.disciplines.indexOf(typeStr);
                domLabel = idx > -1 ? AppConfig.discLabels[idx] : 'Mixed';
            } else {
                const rC = children.filter(c => c.Type.includes('Rope')).length;
                const bC = children.filter(c => c.Type.includes('Bouldering')).length;
                if (bC > 0 && rC === 0) domDisc = 'bg-boulder';
                else if (rC > 0 && bC === 0) domDisc = 'bg-rope';
                
                const isAllOut = children.every(c => c.Type.includes('Outdoor'));
                if (isAllOut) domLabel = 'Out Mixed';
                else if (children.every(c => c.Type.includes('Indoor'))) domLabel = 'In Mixed';
            }

            // FLATTENED LIST ENGINE WITH GHOST STATE & MICRO-BADGES
            const childrenHtml = children.map(l => {
                const rawGrade = String(l.Grade || "");
                const cleanGrade = getBaseGrade(rawGrade);
                const isGhost = l.Style === 'worked' || l.Style === 'toprope' || l.Style === 'project' || l.Style === 'autobelay';
                const isF = l.Style === 'flash' || l.Style === 'onsight';
                const perfClass = isGhost ? 'ghost' : (isF ? 'fl' : 'rp');
                
                let inlineColor = '';
                if (!isGhost && l.Type === 'Indoor Bouldering') {
                    const idx = AppConfig.grades.bouldsIn.labels.indexOf(cleanGrade);
                    if (idx > -1) inlineColor = `color: ${AppConfig.grades.bouldsIn.colors[idx]} !important;`;
                }

                return `
                <div class="log-entry ${perfClass}">
                    <div class="log-summary" onclick="App.haptic(); const p = this.parentElement; const isExp = p.classList.contains('expanded'); document.querySelectorAll('.session-children .log-entry').forEach(c => c.classList.remove('expanded')); if(!isExp) p.classList.add('expanded');">
                        <div class="log-info">
                            <div class="log-name">${l.Name.split(' @ ')[0]}${l._synced === false ? ' ☁️✕' : ''}</div>
                        </div>
                        ${isGhost && l.HighPoint !== undefined ? `<div class="log-ghost-tag">High Point: ${l.HighPoint}%</div>` : ''}
                        <div class="log-grade ${perfClass}" style="${inlineColor}">${getStyleBadge(l.Style)}${cleanGrade}</div>
                    </div>
                    <div class="log-details">
                        <div class="log-details-grid">
                            <div class="log-meta-item">STYLE<div class="log-meta-val">${AppConfig.styles[l.Style] || l.Style}</div></div>
                            ${l.Burns ? `<div class="log-meta-item">BURNS<div class="log-meta-val">${l.Burns}</div></div>` : ''}
                        </div>
                        ${l.Notes ? `<div class="log-notes-box">"${l.Notes}"</div>` : ''}
                        <button class="log-del-btn" onclick="App.deleteClimb('${l.ClimbID}')">Delete Entry</button>
                    </div>
                </div>`;
            }).join('');

            return `
            <div class="session-card ${domDisc}">
                <div class="session-header">
                    <div class="s-date-block"><div class="s-date-main">${dateInfo.main}</div><div class="s-date-sub">${dateInfo.sub}</div></div>
                    <div class="s-loc">@ ${session.Location} &nbsp;&bull;&nbsp; <span style="color:#a3a3a3;">${domLabel}</span></div>
                </div>
                <div class="s-tags-row">
                    <div class="s-tag ${session.Focus ? 'focus-tag' : 'empty-tag'}" onclick="App.openSessionModal('${session.SessionID}', 'focus')">${session.Focus ? 'Focus: '+session.Focus : '+ Focus'}</div>
                    <div class="s-tag ${session.Fatigue ? 'fatigue-tag' : 'empty-tag'}" onclick="App.openSessionModal('${session.SessionID}', 'fatigue')">${session.Fatigue ? 'Fatigue: '+session.Fatigue : '+ Fatigue'}</div>
                    <div class="s-tag ${session.WarmUp ? 'warmup-tag' : 'empty-tag'}" onclick="App.openSessionModal('${session.SessionID}', 'warmup')">${session.WarmUp ? 'Warm-up: '+session.WarmUp : '+ Warm-up'}</div>
                    <div class="s-tag ${session.Notes ? 'note-tag' : 'empty-tag'}" onclick="App.openSessionModal('${session.SessionID}', 'notes')">${session.Notes ? '📝 Note Added' : '+ Note'}</div>
                </div>
                
                <div class="s-flat-stats">
                    <span>${sends.length} Send${sends.length !== 1 ? 's' : ''}</span>
                    ${projects.length > 0 ? `<span>&bull;</span><span>${projects.length} Project${projects.length > 1 ? 's' : ''}</span>` : ''}
                    <span>&bull;</span>
                    <span>Max: <span style="color:${maxColor};">${maxSentStr}</span></span>
                </div>
                ${session.Notes ? `<div class="s-session-notes">"${session.Notes}"</div>` : ''}
                
                <button class="session-accordion-btn" onclick="App.haptic(); const p = this.parentElement; p.classList.toggle('expanded');">View ${children.length} Climbs ▾</button>
                <div class="session-children">${childrenHtml}</div>
            </div>`;
        }).join('');
    },
    
    renderDashboard: () => { App.renderDashboardCharts(); App.renderDashboardLogs(); },

    renderDashboardCharts: () => {
        const dStr = String(State.discipline || ""), conf = getScaleConfig(dStr);
        const viewLogs = State.climbs.filter(l => l && l.Type === dStr && l.Style !== 'worked' && l.Style !== 'toprope' && l.Style !== 'autobelay').map(l => ({ ...l, cleanDate: getCleanDate(l.Date) }));
        const ctxCanvas = document.getElementById('progressChart');
        if (!window.Chart || viewLogs.length === 0) { ctxCanvas.style.display = 'none'; document.getElementById('noDataMsg').style.display = 'block'; return; }
        ctxCanvas.style.display = 'block'; document.getElementById('noDataMsg').style.display = 'none';

        if(App.chart) App.chart.destroy();
        const ctx = ctxCanvas.getContext('2d');
        const allM = [...new Set(viewLogs.map(l => l.cleanDate.substring(0,7)))].sort();
        const cD = { rp: [], fl: [], rpG: [], flG: [], avg: [], avgG: [], lbl: [] };
        
        const getScoreIndex = (s, isF) => { 
            let b = s - (isF ? (dStr.includes('Rope') ? 10 : 17) : 0); 
            return conf.scores.indexOf(conf.scores.reduce((p, c) => Math.abs(c-b) < Math.abs(p-b) ? c : p)); 
        };
        
        allM.forEach(m => {
            const [y, mo] = m.split('-').map(Number);
            const mL = viewLogs.filter(l => l.cleanDate.substring(0,7) === m);
            if (State.chartMode === 'max') {
                const rpL = mL.filter(l => l.Style !== 'flash' && l.Style !== 'onsight');
                const flL = mL.filter(l => l.Style === 'flash' || l.Style === 'onsight');
                const maxRp = rpL.length ? rpL.reduce((p, c) => Number(c.Score) > Number(p.Score) ? c : p) : null;
                const maxFl = flL.length ? flL.reduce((p, c) => Number(c.Score) > Number(p.Score) ? c : p) : null;
                cD.rp.push(maxRp ? getScoreIndex(Number(maxRp.Score), false) : null);
                cD.fl.push(maxFl ? getScoreIndex(Number(maxFl.Score), true) : null);
                cD.rpG.push(maxRp ? getBaseGrade(maxRp.Grade) : ""); cD.flG.push(maxFl ? getBaseGrade(maxFl.Grade) : "");
            } else {
                const top10 = mL.sort((a,b) => Number(b.Score) - Number(a.Score)).slice(0, 10);
                const avS = Math.round(top10.reduce((s, l) => s + Number(l.Score), 0) / top10.length);
                const avI = conf.scores.indexOf(conf.scores.reduce((p, c) => Math.abs(c-avS) < Math.abs(p-avS) ? c : p));
                cD.avg.push(avI); cD.avgG.push(conf.labels[avI]);
            }
            cD.lbl.push(`${AppConfig.months[mo-1]} '${y.toString().slice(-2)}`);
        });

        let dSet = [], toolC;
        if (State.chartMode === 'max') {
            let g = ctx.createLinearGradient(0, 0, 0, 300); g.addColorStop(0, 'rgba(16, 185, 129, 0.25)'); g.addColorStop(1, 'transparent');
            dSet = [
                { label: 'Max Redpoint', data: cD.rp, borderColor: '#10b981', backgroundColor: g, tension: 0.4, fill: true, pointRadius: 5, pointBackgroundColor: '#121212', pointBorderWidth: 2, spanGaps: true }, 
                { label: 'Flash/Onsight', data: cD.fl, borderColor: '#db2777', borderDash: [5,5], tension: 0.4, fill: false, pointRadius: 5, pointBackgroundColor: '#121212', pointBorderWidth: 2, spanGaps: true }
            ];
            toolC = chartCtx => chartCtx.datasetIndex === 0 ? ` Redpoint: ${cD.rpG[chartCtx.dataIndex]}` : ` Flash: ${cD.flG[chartCtx.dataIndex]}`;
        } else {
            let gA = ctx.createLinearGradient(0, 0, 0, 300); gA.addColorStop(0, 'rgba(59, 130, 246, 0.35)'); gA.addColorStop(1, 'transparent');
            dSet = [{ label: 'Top 10 Average', data: cD.avg, borderColor: '#3b82f6', backgroundColor: gA, tension: 0.4, fill: true, pointRadius: 6, pointBackgroundColor: '#121212', pointBorderWidth: 2, spanGaps: true }];
            toolC = chartCtx => ` Power Avg: ${cD.avgG[chartCtx.dataIndex]}`;
        }
        
        App.chart = new Chart(ctx, { 
            type: 'line', 
            data: { labels: cD.lbl, datasets: dSet },
            options: { 
                responsive: true, maintainAspectRatio: false, 
                plugins: { legend: { display: false }, tooltip: { callbacks: { label: toolC } } }, 
                scales: { 
                    y: { ticks: { callback: v => conf.labels[v] || "", font: { weight: '600' } }, grid: { display: false, drawBorder: false } }, 
                    x: { grid: { display: false }, ticks: { font: { weight: '600' } } } 
                } 
            }
        });
    },

    renderDashboardLogs: () => {
        const dStr = String(State.discipline || ""), conf = getScaleConfig(dStr);
        const viewLogs = State.climbs.filter(l => l && l.Type === dStr && l.Style !== 'worked' && l.Style !== 'toprope' && l.Style !== 'autobelay').map(l => ({ ...l, cleanDate: getCleanDate(l.Date) }));
        
        document.getElementById('listToggleTop').className = `log-toggle-btn ${State.listMode === 'top10' ? 'active' : ''}`;
        document.getElementById('listToggleRecent').className = `log-toggle-btn ${State.listMode === 'recent' ? 'active' : ''}`;
        
        let displayLogs = [];
        const titleEl = document.getElementById('logListTitle');
        
        if (State.listMode === 'top10') {
            titleEl.innerText = 'Last 60 Days';
            const sixtyDaysAgo = new Date();
            sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
            sixtyDaysAgo.setHours(0,0,0,0);
            displayLogs = viewLogs.filter(l => {
                const logDate = new Date(l.cleanDate);
                logDate.setHours(0,0,0,0);
                return logDate >= sixtyDaysAgo;
            }).sort((a,b) => Number(b.Score) - Number(a.Score)).slice(0, 10);
        } else {
            titleEl.innerText = 'Recent Logs';
            displayLogs = viewLogs.sort((a,b) => Number(b.ClimbID) - Number(a.ClimbID)).slice(0, 10);
        }
        
        document.getElementById('xpContainer').classList.toggle('hidden', State.listMode !== 'top10' || displayLogs.length === 0);
        if (State.listMode === 'top10' && displayLogs.length > 0) {
            const avgS = Math.round(displayLogs.reduce((s, l) => s + Number(l.Score), 0) / displayLogs.length);
            const curIdx = conf.scores.indexOf(conf.scores.slice().reverse().find(s => s <= avgS) || conf.scores[0]);
            const nextIdx = Math.min(curIdx + 1, conf.scores.length - 1);
            const pct = Math.min(100, Math.max(0, ((avgS - conf.scores[curIdx]) / (conf.scores[nextIdx] - conf.scores[curIdx])) * 100)) || 0;
            document.getElementById('xpBaseGrade').innerText = conf.labels[curIdx];
            document.getElementById('xpNextGrade').innerText = conf.labels[nextIdx];
            document.getElementById('xpPercent').innerText = `${Math.round(pct)}%`;
            document.getElementById('xpBarFill').style.width = `${pct}%`;
        }

        document.getElementById('logList').innerHTML = displayLogs.length === 0 ? '<div class="empty-msg">No logs.</div>' : `<div class="log-list">` + displayLogs.map(l => {
            const cleanGrade = getBaseGrade(String(l.Grade || ""));
            const isF = l.Style === 'flash' || l.Style === 'onsight';
            const perfClass = isF ? 'fl' : 'rp';
            let inlineColor = '';
            if (l.Type === 'Indoor Bouldering') {
                const idx = AppConfig.grades.bouldsIn.labels.indexOf(cleanGrade);
                if (idx > -1) inlineColor = `color: ${AppConfig.grades.bouldsIn.colors[idx]} !important;`;
            }

            return `
            <div class="log-entry ${perfClass}">
                <div class="log-summary" onclick="App.haptic(); const p = this.parentElement; p.classList.toggle('expanded');">
                    <div class="log-date">${formatShortDate(l.cleanDate)}</div>
                    <div class="log-info"><div class="log-name">${l.Name.split(' @ ')[0]}</div></div>
                    <div class="log-grade ${perfClass}" style="${inlineColor}">${getStyleBadge(l.Style)}${cleanGrade}</div>
                </div>
                <div class="log-details">
                    <div class="log-details-grid">
                        <div class="log-meta-item">STYLE<div class="log-meta-val">${AppConfig.styles[l.Style] || l.Style}</div></div>
                        ${l.Burns ? `<div class="log-meta-item">BURNS<div class="log-meta-val">${l.Burns}</div></div>` : ''}
                    </div>
                    ${l.Notes ? `<div class="log-notes-box">"${l.Notes}"</div>` : ''}
                    <button class="log-del-btn" onclick="App.deleteClimb('${l.ClimbID}')">Delete Entry</button>
                </div>
            </div>`;
        }).join('') + `</div>`;
    },
    
    logClimb: () => {
        App.haptic(); 
        const isOut = State.discipline.includes('Outdoor'), outN = document.getElementById('input-name').value.trim(), outC = document.getElementById('input-crag').value.trim();
        if (isOut && (!outN || !outC)) return;
        
        App.isSaving = true; 
        if (isOut) localStorage.setItem('lastCrag', outC);

        const n = isOut ? `${outN} @ ${outC}` : State.activeGym;
        const climbDateStr = State.activeDate;
        let s = State.activeGrade.score;
        const g = State.activeGrade.text; 
        
        if(State.activeStyle === 'flash') { s += State.discipline.includes('Rope') ? 10 : 17; } 
        else if (State.activeStyle === 'onsight') { s += 10; }
        else if (State.activeStyle === 'worked') { s = 0; }
        else if (State.activeStyle === 'toprope') { s = 0; }
        else if (State.activeStyle === 'autobelay') { s = 0; }
        
        const sessionID = isOut ? `${climbDateStr}_Outdoor` : `${climbDateStr}_${State.activeGym.replace(/[^a-zA-Z0-9\s]/g, '').trim()}`;
        
        let existingSession = State.sessions.find(s => s.SessionID === sessionID);
        if (!existingSession) {
            const newS = { SessionID: sessionID, Date: climbDateStr, Location: isOut ? outC : State.activeGym, Focus: "", Fatigue: "", WarmUp: "", Notes: "", _synced: false };
            State.sessions = [newS, ...State.sessions];
        } else if (isOut) {
            let locs = existingSession.Location.split(' / ');
            if (!locs.includes(outC)) {
                existingSession.Location = [...locs, outC].join(' / ');
                existingSession._synced = false;
                State.sessions = [...State.sessions]; 
            }
        }

        const btn = document.getElementById('saveClimbBtn');
        btn.disabled = true; btn.innerText = 'Saving...';
        
        const climb = { 
            ClimbID: String(Date.now()), SessionID: sessionID, Date: climbDateStr, Type: State.discipline, Name: n, Grade: g, Score: s, Style: State.activeStyle, 
            Burns: State.activeBurns === '-' ? '' : State.activeBurns, Angle: State.activeSteepness.join(', '), Effort: State.activeRPE, GradeFeel: State.activeGradeFeel,
            Rating: State.activeRating || "", Holds: State.activeHolds.join(', '), ClimStyles: State.activeClimbStyles.join(', '),
            Notes: document.getElementById('input-notes').value.trim(), _synced: false 
        };

        if (['worked', 'toprope'].includes(State.activeStyle)) {
            climb.HighPoint = State.activeHighPoint;
        }
        
        document.getElementById('input-notes').value = '';
        if (isOut) document.getElementById('input-name').value = '';
        
        State.climbs = [climb, ...State.climbs]; 
        SyncManager.pushAll(State.sessions.filter(s => !s._synced), [climb]); 
        
        State.activeRating = 0; State.activeGradeFeel = ''; State.activeClimbStyles = []; State.activeHolds = []; State.activeSteepness = []; 
        State.activeBurns = ['flash', 'onsight', 'toprope', 'autobelay'].includes(State.activeStyle) ? 1 : (State.activeStyle === 'quick' ? 2 : '-');
        State.activeHighPoint = 50;
        
        setTimeout(() => {
            btn.innerHTML = '✓ Saved!';
            if (navigator.vibrate) navigator.vibrate([30, 50, 30]); 
            setTimeout(() => { 
                App.isSaving = false; 
                App.validateForm(); 
            }, 2000);
        }, 400); 
    }
};
App.init();
