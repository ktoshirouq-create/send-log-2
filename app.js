if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW Registration failed:', err)));
}

const AppConfig = {
    api: "https://script.google.com/macros/s/AKfycbwMh-T7DB7S06_8DB2GC4dniByVHrRSqbODdLRhjciDOXSDL-V4_vzQtRXee2Wmqp9L/exec",
    gyms: ["OKS", "Torshov", "Løkka", "Bryn", "Gneiss", "Other"],
    months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    days: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    disciplines: ['Indoor Rope Climbing', 'Indoor Bouldering', 'Outdoor Rope Climbing', 'Outdoor Bouldering', 'Outdoor Multipitch'],
    discLabels: ['In Rope', 'In Boulder', 'Out Rope', 'Out Boulder', 'Multipitch'],
    styles: { 'project': 'Project', 'quick': 'Send', 'flash': 'Flash', 'onsight': 'Onsight', 'toprope': 'Top Rope', 'autobelay': 'Auto Belay', 'worked': 'Worked', 'topped': 'Topped Out', 'allfree': 'All Free', 'bailed': 'Bailed' },
    steepness: ['Slab', 'Vertical', 'Overhang', 'Roof'],
    climbStyles: ['Endurance', 'Cruxy', 'Technical', 'Athletic'],
    holds: ['Crimps', 'Slopers', 'Pockets', 'Pinches', 'Tufas', 'Jugs'],
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
        ropesOut: { labels: ["3","4-","4","4+","5-","5a","5a+","5b","5b+","5c","5c+","6a","6a+","6b","6b+","6c","6c+","7a","7a+","7b","7b+","7c","7c+","8a","8b","8c","9a"], scores: [100,200,250,300,400,500,517,533,550,567,583,600,617,633,650,667,683,700,717,733,750,767,783,800,833,867,900], colors: [] },
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
    if (disc === 'Outdoor Rope Climbing' || disc === 'Outdoor Multipitch') return AppConfig.grades.ropesOut;
    return AppConfig.grades.ropesIn;
};

// TYPOGRAPHIC BADGES
const getStyleBadge = (style) => {
    const map = {
        'onsight': { text: 'OS', cls: 'badge-fl' },
        'flash': { text: 'FL', cls: 'badge-fl' },
        'quick': { text: 'RP', cls: 'badge-rp' },
        'project': { text: 'PR', cls: 'badge-ghost' },
        'worked': { text: 'WK', cls: 'badge-ghost' },
        'toprope': { text: 'TR', cls: 'badge-ghost' },
        'autobelay': { text: 'AB', cls: 'badge-ghost' },
        'topped': { text: 'TOP', cls: 'badge-rp' },
        'allfree': { text: 'AF', cls: 'badge-fl' },
        'bailed': { text: 'XX', cls: 'badge-ghost' }
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
    activeRPE: 'Solid', activeRating: 0, activeSteepness: [], activeClimbStyles: [], activeHolds: [],
    activePitches: 2, activeGearStyle: '', activePackWeight: '',
    climbs: safeClimbs, sessions: safeSessions, journalLimit: 15
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
            const isOutdoor = value.includes('Outdoor') || value.includes('Multipitch');
            
            if (!conf.labels.some(g => String(g).toLowerCase() === String(target.activeGrade.text).toLowerCase())) {
                target.activeGrade = { text: conf.labels[0], score: conf.scores[0] };
            }

            if (value === 'Indoor Rope Climbing' && (target.activeGym === 'Løkka' || target.activeGym === 'Bryn')) {
                target.activeGym = 'OKS';
            }

            if (!isOutdoor) {
                target.activeRating = 0;
                target.activeApproach = null;
                target.activePackWeight = '';
                target.activeGearStyle = '';
                target.activePitches = 2;
                App.updateDynamicRatingText(0);
            }

            App.renderUI();
        } else if (prop === 'view') {
            ['log', 'journal', 'dash'].forEach(v => {
                const elV = document.getElementById(`view-${v}`);
                const elN = document.getElementById(`nav-${v}`);
                if(elV) elV.classList.toggle('active', target.view === v);
                if(elN) elN.classList.toggle('active', target.view === v);
            });
            if(target.view === 'journal') App.renderJournal();
            if(target.view === 'dash') App.renderDashboard();
            setTimeout(() => App.centerActivePills(), 50); 
        } else {
            const softPaintTriggers = [
                'activeGym', 'activeStyle', 'activeBurns', 'chartMode', 
                'activeRPE', 'activeRating', 'activeSteepness', 
                'activeClimbStyles', 'activeHolds', 'activeGrade',
                'activePitches', 'activeGearStyle', 'activePackWeight'
            ];
            if (softPaintTriggers.includes(prop)) {
                App.updateUISelections(); 
                if (prop === 'chartMode' && target.view === 'dash') App.renderDashboardHUD();
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
                const existingIdx = acc.findIndex(item => String(item.ClimbID) === String(current.ClimbID));
                if (existingIdx === -1) return acc.concat([current]);

                const existing = acc[existingIdx];
                if (!current.Pitches && existing.Pitches) {
                    current.Pitches = existing.Pitches;
                    current.GearStyle = existing.GearStyle;
                    current.PackWeight = existing.PackWeight;
                    current.PitchBreakdown = existing.PitchBreakdown;
                }
                
                acc[existingIdx] = (current._synced === false) ? current : { ...existing, ...current, _synced: existing._synced };
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
    isSaving: false,
    isDraggingHP: false,
    isDraggingFatigue: false,
    editingClimbId: null,
    
    init: () => {
        if (window.Chart) { Chart.defaults.color = '#a3a3a3'; Chart.defaults.borderColor = 'rgba(255,255,255,0.05)'; Chart.defaults.font.family = "'Inter', sans-serif"; }
        document.getElementById('input-crag').value = localStorage.getItem('lastCrag') || '';
        
        App.initScrubber();
        App.renderUI();
        SyncManager.trigger(); 
        window.addEventListener('online', SyncManager.trigger);

        const pendingEditId = localStorage.getItem('crag_edit_climb_id');
        if (pendingEditId) {
            localStorage.removeItem('crag_edit_climb_id');
            setTimeout(() => App.editClimb(pendingEditId), 300);
        }
    },
    haptic: () => { if (navigator.vibrate) navigator.vibrate(40); },
    toast: (msg) => {
        const t = document.getElementById('toast');
        if(t) { t.innerText = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2500); }
    },
    showInsight: (type) => {
        App.haptic();
        const copy = {
            'capacity': { title: 'Working Capacity', desc: 'Your reliable baseline power. This is calculated by averaging the scores of your Top 10 hardest sends over the last 60 days. It filters out one-off lucky flashes to show the grade you can consistently crush.' },
            'profile': { title: 'Climber Profile', desc: 'A dynamic breakdown of your climbing style. The shape morphs based on the steepness, hold types, and effort levels of your sends. It compares your current training phase against your all-time baseline to highlight weaknesses.' }
        };
        const modal = document.getElementById('insightModal');
        if(copy[type]) {
            document.getElementById('insightTitle').innerText = copy[type].title;
            document.getElementById('insightDesc').style.whiteSpace = 'pre-wrap';
            document.getElementById('insightDesc').innerText = copy[type].desc;
            modal.classList.add('active');
        }
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
    editClimb: (id) => {
        App.haptic();
        const climb = State.climbs.find(c => String(c.ClimbID) === String(id));
        if (!climb) return;

        State.view = 'log';
        App.editingClimbId = id;
        
        State.discipline = climb.Type || 'Indoor Rope Climbing';
        App.setDate('custom', climb.Date);
        
        if (climb.Type.includes('Outdoor')) {
            const parts = (climb.Name || "").split(' @ ');
            document.getElementById('input-name').value = parts[0] ? parts[0].trim() : '';
            document.getElementById('input-crag').value = parts[1] ? parts[1].trim() : '';
        } else {
            State.activeGym = climb.Name || 'OKS';
        }

        const conf = getScaleConfig(State.discipline);
        const cleanGrade = getBaseGrade(climb.Grade);
        const gIdx = conf.labels.indexOf(cleanGrade);
        State.activeGrade = gIdx > -1 ? { text: conf.labels[gIdx], score: conf.scores[gIdx] } : { text: conf.labels[0], score: conf.scores[0] };

        State.activeStyle = climb.Style || 'quick';
        State.activeBurns = climb.Burns || '-';
        State.activeHighPoint = climb.HighPoint || 50;
        
        State.activePitches = climb.Pitches || 2;
        State.activeGearStyle = climb.GearStyle || '';
        State.activePackWeight = climb.PackWeight || '';
        document.getElementById('input-pitch-breakdown').value = climb.PitchBreakdown || '';

        State.activeRPE = climb.Effort || 'Solid';
        State.activeRating = Number(climb.Rating) || 0;
        State.activeSteepness = climb.Angle ? climb.Angle.split(', ') : [];
        State.activeClimbStyles = climb.ClimStyles ? climb.ClimStyles.split(', ') : [];
        State.activeHolds = climb.Holds ? climb.Holds.split(', ') : [];
        
        document.getElementById('input-notes').value = climb.Notes || '';

        const advContent = document.getElementById('advanced-content');
        if (advContent && (climb.Effort || climb.Rating || climb.Angle || climb.ClimStyles || climb.Holds || climb.Notes)) {
            advContent.classList.remove('hidden');
            const tog = document.querySelector('.advanced-toggle');
            if(tog) tog.innerText = '- Hide Details';
        }

        const btn = document.getElementById('saveClimbBtn');
        if(btn) {
            btn.innerText = 'Update Entry';
            btn.style.background = '#3b82f6';
            btn.style.color = '#fff';
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    setDate: (type, val = null) => {
        App.haptic();
        document.querySelectorAll('#datePicker .pill').forEach(p => p.classList.remove('active'));
        if (type === 'today') { State.activeDate = getLocalISO(); document.getElementById('pill-today')?.classList.add('active'); }
        else if (type === 'yesterday') { let yest = new Date(); yest.setDate(yest.getDate()-1); State.activeDate = getLocalISO(yest); document.getElementById('pill-yest')?.classList.add('active'); }
        else if (type === 'custom' && val) { 
            State.activeDate = val; const [, m, d] = val.split('-');
            const customPill = document.getElementById('pill-custom');
            if(customPill) {
                customPill.classList.add('active');
                customPill.innerText = `${AppConfig.months[parseInt(m)-1]} ${parseInt(d)}`;
            }
        }
    },
    centerActivePills: () => {
        document.querySelectorAll('.pill-row').forEach(row => {
            const active = row.querySelector('.pill.active');
            if (active) {
                const scrollPos = active.offsetLeft - (row.offsetWidth / 2) + (active.offsetWidth / 2);
                row.scrollTo({ left: Math.max(0, scrollPos), behavior: 'smooth' });
            }
        });
    },
    setRating: (num) => { 
        App.haptic(); 
        State.activeRating = State.activeRating === num ? 0 : num; 
        App.updateDynamicRatingText(State.activeRating);
    },
    updateDynamicRatingText: (starCount) => {
        const textContainer = document.getElementById('dynamic-rating-text');
        if (!textContainer) return;
        if (starCount === 0) {
            textContainer.style.opacity = '0';
            textContainer.innerText = "";
        } else {
            textContainer.innerText = AppConfig.ratingTextMap[starCount] || "";
            textContainer.style.opacity = '1';
        }
    },
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
    adjPitches: (dir) => { 
        App.haptic(); 
        let newVal = State.activePitches + dir;
        State.activePitches = newVal < 1 ? 1 : newVal;
    },

    handleHPSlide: (e) => {
        if (!App.isDraggingHP && e.type !== 'mousedown' && e.type !== 'touchstart') return;
        const track = document.getElementById('hp-track');
        if (!track) return;
        const rect = track.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        let percent = (clientX - rect.left) / rect.width;
        percent = Math.max(0, Math.min(1, percent));
        let val = Math.round(percent * 100);
        if (val === 100) val = 99; 
        
        if (Math.abs(val - State.activeHighPoint) >= 5 || val === 0 || val === 99) {
            if(Math.abs(val - State.activeHighPoint) >= 10) App.haptic(); 
            State.activeHighPoint = val;
            document.getElementById('hp-output').innerText = `${val}%`;
            document.getElementById('hp-fill').style.width = `${val}%`;
            document.getElementById('hp-thumb').style.left = `${val}%`;
        }
    },
    handleFatigueSlide: (e) => {
        if (!App.isDraggingFatigue && e.type !== 'mousedown' && e.type !== 'touchstart') return;
        const track = document.getElementById('fatigue-track');
        if (!track) return;
        const rect = track.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        let percent = (clientX - rect.left) / rect.width;
        percent = Math.max(0, Math.min(1, percent));
        let val = Math.round(percent * 9) + 1; 
        App.setModalFatigue(val);
    },
    initScrubber: () => {
        const hpCont = document.getElementById('hp-track-container');
        if(hpCont) {
            hpCont.addEventListener('mousedown', (e) => { App.isDraggingHP = true; App.handleHPSlide(e); });
            hpCont.addEventListener('touchstart', (e) => { App.isDraggingHP = true; App.handleHPSlide(e); }, {passive: true});
        }
        
        const fatCont = document.getElementById('fatigue-track-container');
        if(fatCont) {
            fatCont.addEventListener('mousedown', (e) => { App.isDraggingFatigue = true; App.handleFatigueSlide(e); });
            fatCont.addEventListener('touchstart', (e) => { App.isDraggingFatigue = true; App.handleFatigueSlide(e); }, {passive: true});
        }

        document.addEventListener('mousemove', (e) => { 
            if(App.isDraggingHP) App.handleHPSlide(e); 
            if(App.isDraggingFatigue) App.handleFatigueSlide(e);
        });
        document.addEventListener('touchmove', (e) => { 
            if(App.isDraggingHP) App.handleHPSlide(e); 
            if(App.isDraggingFatigue) App.handleFatigueSlide(e);
        }, {passive: true});

        document.addEventListener('mouseup', () => { App.isDraggingHP = false; App.isDraggingFatigue = false; });
        document.addEventListener('touchend', () => { App.isDraggingHP = false; App.isDraggingFatigue = false; });
    },

    updateSegmentedHighlight: (containerId, val) => {
        setTimeout(() => {
            const container = document.getElementById(containerId);
            if (!container) return;
            const items = Array.from(container.querySelectorAll('.seg-item'));
            const highlight = container.querySelector('.seg-highlight');
            if(!highlight) return;
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
        
        ['sec-focus', 'sec-fatigue', 'sec-warmup', 'sec-approach'].forEach(id => {
            const el = document.getElementById(id);
            if(el) el.classList.add('hidden');
        });
        
        const titles = {
            'focus': 'Session Focus',
            'fatigue': 'Session Fatigue',
            'warmup': 'Warm-up',
            'approach': 'Approach',
            'notes': 'Session Notes'
        };
        
        const titleEl = document.getElementById('modalTitle');
        titleEl.innerText = titles[mode] || 'Session Editor';
        titleEl.classList.remove('hidden');

        const isNotes = mode === 'notes';
        const notesLabel = document.getElementById('sec-notes-label');
        const notesVal = document.getElementById('modalNotesVal');
        if(notesLabel) notesLabel.classList.toggle('hidden', !isNotes);
        if(notesVal) notesVal.classList.toggle('hidden', !isNotes);

        document.getElementById('modalFocusVal').value = s.Focus || "";
        document.getElementById('modalFatigueVal').value = s.Fatigue || "";
        document.getElementById('modalWarmUpVal').value = s.WarmUp || "";
        document.getElementById('modalApproachVal').value = s.Approach || "";
        if(notesVal) notesVal.value = s.Notes || "";

        if (mode === 'focus') {
            document.getElementById('sec-focus').classList.remove('hidden');
            App.setModalFocus(s.Focus || "", true);
        } else if (mode === 'fatigue') {
            document.getElementById('sec-fatigue').classList.remove('hidden');
            App.setModalFatigue(s.Fatigue || "", true);
        } else if (mode === 'warmup') {
            document.getElementById('sec-warmup').classList.remove('hidden');
            App.setModalWarmUp(s.WarmUp || "", true);
        } else if (mode === 'approach') {
            document.getElementById('sec-approach').classList.remove('hidden');
            App.setModalApproach(s.Approach || "", true);
        } else if (mode === 'notes') {
            setTimeout(() => { if(notesVal) notesVal.focus(); }, 300);
        }
        
        document.getElementById('sessionModal').classList.add('active');
    },
    
    setModalFocus: (val, init = false) => {
        if(!init) App.haptic();
        const current = document.getElementById('modalFocusVal').value;
        const newVal = (!init && current === val) ? "" : val;
        document.getElementById('modalFocusVal').value = newVal;
        App.updateSegmentedHighlight('focus-segmented', newVal);
    },

    setModalApproach: (val, init = false) => {
        if(!init) App.haptic();
        const current = document.getElementById('modalApproachVal').value;
        const newVal = (!init && current === val) ? "" : val;
        document.getElementById('modalApproachVal').value = newVal;
        App.updateSegmentedHighlight('approach-segmented', newVal);
    },
    
    setModalFatigue: (val, init = false) => {
        const strVal = String(val);
        const newVal = strVal; 
        
        if (!init && newVal !== "") App.haptic();
        
        const mFV = document.getElementById('modalFatigueVal');
        if(mFV) mFV.value = newVal;
        
        const out = document.getElementById('fatigue-output');
        const fill = document.getElementById('fatigue-fill');
        const thumb = document.getElementById('fatigue-thumb');
        if(!out || !fill || !thumb) return;
        
        if (newVal === "" || newVal === "0") {
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
        const approach = document.getElementById('modalApproachVal').value;
        const notes = document.getElementById('modalNotesVal').value.trim();
        
        State.sessions = State.sessions.map(s => String(s.SessionID) === String(sessionId) ? {...s, Focus: focus, Fatigue: fatigue, WarmUp: warmup, Approach: approach, Notes: notes, _synced: false} : s);
        SyncManager.pushAll(State.sessions.filter(s => s._synced === false), []);
        document.getElementById('sessionModal').classList.remove('active');
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
            btn.innerText = App.editingClimbId ? 'Missing Route or Crag' : 'Missing Route or Crag';
        } else {
            btn.disabled = false;
            btn.innerText = App.editingClimbId ? 'Update Entry' : 'Save to Cloud';
        }
    },

    renderUI: () => {
        const dStr = String(State.discipline || "");
        const isOut = dStr.includes('Outdoor'), isRope = dStr.includes('Rope'), isBould = dStr.includes('Boulder');
        const isMulti = dStr === 'Outdoor Multipitch';
        const conf = getScaleConfig(dStr);

        const buildPills = (arr, activeVal, clickAction) => arr.map(item => `<div class="pill ${item === activeVal ? 'active' : ''}" data-val="${item}" onclick="${clickAction}='${item}';">${item}</div>`).join('');

        const ts = document.getElementById('typeSelector');
        if(ts) ts.innerHTML = AppConfig.disciplines.map((d, i) => `<div class="pill ${dStr === d ? 'active' : ''}" data-val="${d}" onclick="App.haptic(); State.discipline='${d}'">${AppConfig.discLabels[i]}</div>`).join('');
        const ds = document.getElementById('dashSelector');
        if(ds) ds.innerHTML = AppConfig.disciplines.map((d, i) => `<div class="pill ${dStr === d ? 'active' : ''}" data-val="${d}" onclick="App.haptic(); State.discipline='${d}'">${AppConfig.discLabels[i]}</div>`).join('');
        
        const inO = document.getElementById('input-outdoor'); if(inO) inO.className = isOut ? '' : 'hidden';
        const inI = document.getElementById('input-indoor');  if(inI) inI.className = isOut ? 'hidden' : '';
        
        const inN = document.getElementById('input-name');
        if(inN) inN.placeholder = isBould ? 'La Marie Rose' : (isMulti ? 'Vestpillaren' : 'Silence');
        const inC = document.getElementById('input-crag');
        if(inC) inC.placeholder = isBould ? 'Sector, Crag 🇬🇷' : (isMulti ? 'Presten, Lofoten' : 'Flatanger');
        
        const gL = document.getElementById('gradeLabel');
        if(gL) gL.innerText = isMulti ? 'Crux Grade' : 'Grade';

        const currentGyms = (dStr === 'Indoor Rope Climbing') ? AppConfig.gyms.filter(g => g !== 'Løkka' && g !== 'Bryn') : AppConfig.gyms;
        const gP = document.getElementById('gymPicker');
        if(gP) gP.innerHTML = buildPills(currentGyms, State.activeGym, "App.haptic(); State.activeGym");
        
        const grP = document.getElementById('gradePicker');
        if(grP) {
            grP.innerHTML = conf.labels.map((g, i) => {
                const dot = conf.colors && conf.colors[i] ? `<span class="boulder-dot" style="background:${conf.colors[i]};"></span>` : '';
                return `<div class="pill ${String(g) === String(State.activeGrade.text) ? 'active' : ''}" data-val="${g}" onclick="App.haptic(); State.activeGrade={text:'${g}', score:${conf.scores[i]}};">${dot}${g}</div>`;
            }).join('');
        }

        let styles = [];
        if (isMulti) {
            styles = [['topped', 'Topped Out'], ['allfree', 'All Free'], ['bailed', 'Bailed']];
        } else if (isRope) {
            if (isOut) styles = [['project', 'Project'], ['quick', 'Send'], ['flash', 'Flash'], ['onsight', 'Onsight'], ['toprope', 'Top Rope'], ['worked', 'Worked']];
            else styles = [['project', 'Project'], ['quick', 'Send'], ['flash', 'Flash'], ['toprope', 'Top Rope'], ['autobelay', 'Auto Belay'], ['worked', 'Worked']];
        } else {
            styles = [['project', 'Project'], ['quick', 'Send'], ['flash', 'Flash'], ['worked', 'Worked']];
        }
        if (!styles.find(s => s[0] === State.activeStyle)) State.activeStyle = isMulti ? 'topped' : 'quick';
        
        const sS = document.getElementById('styleSelector');
        if(sS) {
            sS.innerHTML = styles.map(s => {
                return `<div class="pill ${State.activeStyle === s[0] ? 'active' : ''}" data-val="${s[0]}" onclick="App.haptic(); State.activeStyle='${s[0]}'; 
                    if(['flash', 'onsight', 'toprope', 'autobelay'].includes('${s[0]}')){ State.activeBurns = 1; }
                    else if('${s[0]}' === 'quick' && (State.activeBurns === 1 || State.activeBurns === '-')){ State.activeBurns = 2; }
                    else if(['project', 'worked', 'topped', 'allfree', 'bailed'].includes('${s[0]}')){ State.activeBurns = '-'; }
                ">${s[1]}</div>`;
            }).join('');
        }

        const gSS = document.getElementById('gearStyleSelector');
        if(gSS) gSS.innerHTML = AppConfig.gearStyles.map(s => `<div class="pill ${State.activeGearStyle === s ? 'active' : ''}" data-val="${s}" onclick="App.haptic(); State.activeGearStyle='${s}';">${s}</div>`).join('');
        
        const pWS = document.getElementById('packWeightSelector');
        if(pWS) pWS.innerHTML = AppConfig.packWeights.map(s => `<div class="pill ${State.activePackWeight === s ? 'active' : ''}" data-val="${s}" onclick="App.haptic(); State.activePackWeight='${s}';">${s}</div>`).join('');

        const rpS = document.getElementById('rpeSelector'); if(rpS) rpS.innerHTML = buildPills(AppConfig.rpes, State.activeRPE, "App.haptic(); State.activeRPE");
        const stS = document.getElementById('steepnessSelector'); if(stS) stS.innerHTML = AppConfig.steepness.map(s => `<div class="pill ${State.activeSteepness.includes(s) ? 'active' : ''}" data-val="${s}" onclick="App.toggleMulti('steepness', '${s}')">${s}</div>`).join('');
        const cSS = document.getElementById('climbStyleSelector'); if(cSS) cSS.innerHTML = AppConfig.climbStyles.map(s => `<div class="pill ${State.activeClimbStyles.includes(s) ? 'active' : ''}" data-val="${s}" onclick="App.toggleMulti('style', '${s}')">${s}</div>`).join('');
        const hS = document.getElementById('holdsSelector'); if(hS) hS.innerHTML = AppConfig.holds.map(h => `<div class="pill ${State.activeHolds.includes(h) ? 'active' : ''}" data-val="${h}" onclick="App.toggleMulti('hold', '${h}')">${h}</div>`).join('');
        
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
        syncSingle('#gearStyleSelector', State.activeGearStyle);
        syncSingle('#packWeightSelector', State.activePackWeight);
        syncSingle('#rpeSelector', State.activeRPE);
        syncMulti('#steepnessSelector', State.activeSteepness);
        syncMulti('#climbStyleSelector', State.activeClimbStyles);
        syncMulti('#holdsSelector', State.activeHolds);

        const isOut = State.discipline.includes('Outdoor');
        const isMulti = State.discipline === 'Outdoor Multipitch';

        const ratingSec = document.getElementById('rating-section') || document.getElementById('starRating')?.parentElement;
        if (ratingSec) ratingSec.style.display = isOut ? 'block' : 'none';

        const mC = document.getElementById('multipitch-container');
        const bC = document.getElementById('burns-container');
        const hpC = document.getElementById('highPointContainer');
        
        if (isMulti) {
            if(mC) mC.classList.remove('hidden');
            if(bC) bC.classList.add('hidden');
            if(hpC) hpC.classList.add('hidden');
            const pV = document.getElementById('pitches-val');
            if(pV) pV.innerText = State.activePitches;
        } else {
            if(mC) mC.classList.add('hidden');
            if (['worked', 'toprope', 'project'].includes(State.activeStyle)) {
                if(hpC) hpC.classList.remove('hidden');
            } else {
                if(hpC) hpC.classList.add('hidden');
            }
            if (['flash', 'onsight'].includes(State.activeStyle)) {
                if(bC) bC.classList.add('hidden');
            } else {
                if(bC) bC.classList.remove('hidden');
            }
            const bV = document.getElementById('burns-val');
            if(bV) bV.innerText = State.activeBurns;
        }

        const sR = document.getElementById('starRating');
        if (sR) {
            const stars = sR.children;
            for(let i=0; i<stars.length; i++) stars[i].className = i < State.activeRating ? 'active' : '';
        }
        
        App.updateDynamicRatingText(State.activeRating);
        App.validateForm();
    },

    renderJournal: () => {
        const jList = document.getElementById('journalList');
        if (!jList) return;
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
            const sends = children.filter(c => !['worked', 'toprope', 'autobelay', 'project', 'bailed'].includes(c.Style));
            const projects = children.filter(c => ['worked', 'toprope', 'autobelay', 'project', 'bailed'].includes(c.Style));
            
            if (sends.length > 0) {
                const maxSend = sends.reduce((max, cur) => Number(cur.Score) > Number(max.Score) ? cur : max);
                maxSentStr = getBaseGrade(maxSend.Grade);
                const sConf = getScaleConfig(maxSend.Type);
                if (maxSend.Type.includes('Bouldering') && sConf.colors) {
                    const mIdx = sConf.labels.indexOf(maxSentStr);
                    maxColor = sConf.colors[mIdx] || '#fff';
                } else if (maxSend.Type.includes('Rope') || maxSend.Type.includes('Multipitch')) maxColor = 'var(--primary)';
            }

            const childrenHtml = children.map(l => {
                const rawGrade = String(l.Grade || "");
                const cleanGrade = getBaseGrade(rawGrade);
                const isGhost = ['worked', 'toprope', 'project', 'autobelay', 'bailed'].includes(l.Style);
                const isF = ['flash', 'onsight', 'allfree'].includes(l.Style);
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
                            ${l.Pitches ? `<div class="log-meta-item">PITCHES<div class="log-meta-val">${l.Pitches}</div></div>` : ''}
                            ${l.GearStyle ? `<div class="log-meta-item">GEAR<div class="log-meta-val">${l.GearStyle}</div></div>` : ''}
                            ${l.PackWeight ? `<div class="log-meta-item">PACK<div class="log-meta-val">${l.PackWeight}</div></div>` : ''}
                            ${l.PitchBreakdown ? `<div class="log-meta-item">BREAKDOWN<div class="log-meta-val" style="text-transform:none;">${l.PitchBreakdown}</div></div>` : ''}
                        </div>
                        ${l.Notes ? `<div class="log-notes-box">"${l.Notes}"</div>` : ''}
                        <div class="log-actions">
                            <button class="log-edit-btn" onclick="App.editClimb('${l.ClimbID}')">Edit Entry</button>
                            <button class="log-del-btn" onclick="App.deleteClimb('${l.ClimbID}')">Delete</button>
                        </div>
                    </div>
                </div>`;
            }).join('');

            const isIndoorGym = AppConfig.gyms.includes(session.Location);

            return `
            <div class="session-card">
                <div class="session-header">
                    <div class="s-date-block"><div class="s-date-main">${dateInfo.main}</div><div class="s-date-sub">${dateInfo.sub}</div></div>
                    <div class="s-loc">@ ${session.Location}</div>
                </div>
                <div class="s-tags-row">
                    <div class="s-tag ${session.Focus ? 'focus-tag' : 'empty-tag'}" onclick="App.openSessionModal('${session.SessionID}', 'focus')">${session.Focus ? 'Focus: '+session.Focus : '+ Focus'}</div>
                    <div class="s-tag ${session.Fatigue ? 'fatigue-tag' : 'empty-tag'}" onclick="App.openSessionModal('${session.SessionID}', 'fatigue')">${session.Fatigue ? 'Fatigue: '+session.Fatigue : '+ Fatigue'}</div>
                    <div class="s-tag ${session.WarmUp ? 'warmup-tag' : 'empty-tag'}" onclick="App.openSessionModal('${session.SessionID}', 'warmup')">${session.WarmUp ? 'Warm-up: '+session.WarmUp : '+ Warm-up'}</div>
                    ${isIndoorGym ? '' : `<div class="s-tag ${session.Approach ? 'approach-tag' : 'empty-tag'}" onclick="App.openSessionModal('${session.SessionID}', 'approach')">${session.Approach ? 'Approach: '+session.Approach : '+ Approach'}</div>`}
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
    
    renderDashboard: () => { 
        App.renderDashboardHUD();
        App.renderDashboardLogs(); 
    },

    renderDashboardHUD: () => {
        const dStr = String(State.discipline || "");
        const conf = getScaleConfig(dStr);
        const viewLogs = State.climbs.filter(l => l.Type === dStr && !['worked', 'toprope', 'project', 'autobelay', 'bailed'].includes(l.Style));
        
        const chartTog = document.getElementById('chartToggle');
        if (chartTog) {
            chartTog.style.display = 'flex';
            chartTog.innerHTML = `
                <div class="chart-toggle-btn ${State.chartMode === 'max' ? 'active' : ''}" data-val="max" onclick="App.haptic(); State.chartMode='max'">Max Grade</div>
                <div class="chart-toggle-btn ${State.chartMode === 'avg' ? 'active' : ''}" data-val="avg" onclick="App.haptic(); State.chartMode='avg'">Volume (Avg)</div>
            `;
        }

        const ctxCanvas = document.getElementById('progressChart');
        const noDataMsg = document.getElementById('noDataMsg');
        
        if (viewLogs.length === 0) {
            if(ctxCanvas) ctxCanvas.style.display = 'none';
            if(noDataMsg) noDataMsg.style.display = 'block';
            return;
        } else {
            if(ctxCanvas) ctxCanvas.style.display = 'block';
            if(noDataMsg) noDataMsg.style.display = 'none';
        }

        const grouped = {};
        viewLogs.forEach(l => {
            const d = getCleanDate(l.Date);
            if (!grouped[d]) grouped[d] = [];
            grouped[d].push(Number(l.Score));
        });

        const sortedDates = Object.keys(grouped).sort((a,b) => new Date(a) - new Date(b)).slice(-15); 
        const chartLabels = sortedDates.map(d => formatShortDate(d));
        const chartData = sortedDates.map(d => {
            if (State.chartMode === 'max') return Math.max(...grouped[d]);
            const sum = grouped[d].reduce((a,b) => a+b, 0);
            return Math.round(sum / grouped[d].length);
        });

        if (window.mainChart) window.mainChart.destroy();
        const ctx = ctxCanvas.getContext('2d');
        window.mainChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: chartLabels,
                datasets: [{
                    data: chartData,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 3,
                    pointBackgroundColor: '#10b981',
                    pointRadius: 4,
                    fill: true,
                    tension: 0.3
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { 
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const closest = conf.scores.reduce((prev, curr) => Math.abs(curr - context.raw) < Math.abs(prev - context.raw) ? curr : prev);
                                const idx = conf.scores.indexOf(closest);
                                return ` ${conf.labels[idx]} (${context.raw} XP)`;
                            }
                        }
                    }
                },
                scales: {
                    x: { grid: { display: false, drawBorder: false }, ticks: { color: '#737373', font: { size: 10 } } },
                    y: { 
                        grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false }, 
                        ticks: { 
                            color: '#737373', 
                            font: { size: 10 },
                            callback: function(value) {
                                const closest = conf.scores.reduce((prev, curr) => Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev);
                                const idx = conf.scores.indexOf(closest);
                                return conf.labels[idx] || '';
                            }
                        } 
                    }
                }
            }
        });
    },

    renderDashboardLogs: () => {
        const dStr = String(State.discipline || ""), conf = getScaleConfig(dStr);
        const viewLogs = State.climbs.filter(l => l && l.Type === dStr && !['worked', 'toprope', 'project', 'autobelay', 'bailed'].includes(l.Style)).map(l => ({ ...l, cleanDate: getCleanDate(l.Date) }));
        
        const lTT = document.getElementById('listToggleTop'); if(lTT) lTT.className = `log-toggle-btn ${State.listMode === 'top10' ? 'active' : ''}`;
        const lTR = document.getElementById('listToggleRecent'); if(lTR) lTR.className = `log-toggle-btn ${State.listMode === 'recent' ? 'active' : ''}`;
        
        let displayLogs = [];
        const titleEl = document.getElementById('logListTitle');
        
        if (State.listMode === 'top10') {
            if(titleEl) titleEl.innerText = 'Last 60 Days';
            const sixtyDaysAgo = new Date();
            sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
            sixtyDaysAgo.setHours(0,0,0,0);
            displayLogs = viewLogs.filter(l => {
                const logDate = new Date(l.cleanDate);
                logDate.setHours(0,0,0,0);
                return logDate >= sixtyDaysAgo;
            }).sort((a,b) => Number(b.Score) - Number(a.Score)).slice(0, 10);
        } else {
            if(titleEl) titleEl.innerText = 'Recent Logs';
            displayLogs = viewLogs.sort((a,b) => Number(b.ClimbID) - Number(a.ClimbID)).slice(0, 10);
        }
        
        const xpCont = document.getElementById('xpContainer');
        if(xpCont) xpCont.classList.toggle('hidden', State.listMode !== 'top10' || displayLogs.length === 0);
        
        if (State.listMode === 'top10' && displayLogs.length > 0) {
            const avgS = Math.round(displayLogs.reduce((s, l) => s + Number(l.Score), 0) / displayLogs.length);
            const curIdx = conf.scores.indexOf(conf.scores.slice().reverse().find(s => s <= avgS) || conf.scores[0]);
            const nextIdx = Math.min(curIdx + 1, conf.scores.length - 1);
            const pct = Math.min(100, Math.max(0, ((avgS - conf.scores[curIdx]) / (conf.scores[nextIdx] - conf.scores[curIdx])) * 100)) || 0;
            const xBG = document.getElementById('xpBaseGrade'); if(xBG) xBG.innerText = conf.labels[curIdx];
            const xNG = document.getElementById('xpNextGrade'); if(xNG) xNG.innerText = conf.labels[nextIdx];
            const xP = document.getElementById('xpPercent'); if(xP) xP.innerText = `${Math.round(pct)}%`;
            const xBF = document.getElementById('xpBarFill'); if(xBF) xBF.style.width = `${pct}%`;
        }

        const lList = document.getElementById('logList');
        if(!lList) return;
        lList.innerHTML = displayLogs.length === 0 ? '<div class="empty-msg">No logs.</div>' : `<div class="log-list">` + displayLogs.map(l => {
            const cleanGrade = getBaseGrade(String(l.Grade || ""));
            const isF = ['flash', 'onsight', 'allfree'].includes(l.Style);
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
                        ${l.Pitches ? `<div class="log-meta-item">PITCHES<div class="log-meta-val">${l.Pitches}</div></div>` : ''}
                        ${l.GearStyle ? `<div class="log-meta-item">GEAR<div class="log-meta-val">${l.GearStyle}</div></div>` : ''}
                    </div>
                    ${l.Notes ? `<div class="log-notes-box">"${l.Notes}"</div>` : ''}
                    <div class="log-actions">
                        <button class="log-edit-btn" onclick="App.editClimb('${l.ClimbID}')">Edit Entry</button>
                        <button class="log-del-btn" onclick="App.deleteClimb('${l.ClimbID}')">Delete</button>
                    </div>
                </div>
            </div>`;
        }).join('') + `</div>`;
    },
    
    logClimb: () => {
        App.haptic(); 
        const isOut = State.discipline.includes('Outdoor');
        const outN = document.getElementById('input-name').value.trim();
        const outC = document.getElementById('input-crag').value.trim();
        if (isOut && (!outN || !outC)) return;
        
        App.isSaving = true; 
        if (isOut) localStorage.setItem('lastCrag', outC);

        const n = isOut ? `${outN} @ ${outC}` : State.activeGym;
        const climbDateStr = State.activeDate;
        let s = State.activeGrade.score;
        const g = State.activeGrade.text; 
        const isMulti = State.discipline === 'Outdoor Multipitch';
        
        if(['flash', 'allfree'].includes(State.activeStyle)) { s += State.discipline.includes('Rope') || isMulti ? 10 : 17; } 
        else if (State.activeStyle === 'onsight') { s += 10; }
        else if (['worked', 'toprope', 'project', 'autobelay', 'bailed'].includes(State.activeStyle)) { s = 0; }
        
        const sessionID = isOut ? `${climbDateStr}_Outdoor` : `${climbDateStr}_${State.activeGym.replace(/[^a-zA-Z0-9\s]/g, '').trim()}`;
        
        let existingSession = State.sessions.find(ses => ses.SessionID === sessionID);
        if (!existingSession) {
            const newS = { SessionID: sessionID, Date: climbDateStr, Location: isOut ? outC : State.activeGym, Focus: "", Fatigue: "", WarmUp: "", Approach: "", Notes: "", _synced: false };
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
            ClimbID: App.editingClimbId ? App.editingClimbId : String(Date.now()), 
            SessionID: sessionID, Date: climbDateStr, Type: State.discipline, Name: n, Grade: g, Score: s, Style: State.activeStyle, 
            Burns: State.activeBurns === '-' ? '' : State.activeBurns, Angle: State.activeSteepness.join(', '), Effort: State.activeRPE,
            Rating: State.activeRating || "", Holds: State.activeHolds.join(', '), ClimStyles: State.activeClimbStyles.join(', '),
            Notes: document.getElementById('input-notes').value.trim(), _synced: false 
        };

        if (isMulti) {
            climb.Pitches = State.activePitches;
            climb.GearStyle = State.activeGearStyle;
            climb.PackWeight = State.activePackWeight;
            climb.PitchBreakdown = document.getElementById('input-pitch-breakdown').value.trim();
        } else if (['worked', 'toprope', 'project'].includes(State.activeStyle)) {
            climb.HighPoint = State.activeHighPoint;
        }
        
        document.getElementById('input-notes').value = '';
        if (isOut) document.getElementById('input-name').value = '';
        const iPB = document.getElementById('input-pitch-breakdown'); if(iPB) iPB.value = '';
        
        if (App.editingClimbId) {
            State.climbs = State.climbs.map(c => String(c.ClimbID) === String(App.editingClimbId) ? climb : c);
        } else {
            State.climbs = [climb, ...State.climbs]; 
        }

        SyncManager.pushAll(State.sessions.filter(ses => !ses._synced), [climb]); 
        
        State.activeRating = 0; State.activeClimbStyles = []; State.activeHolds = []; State.activeSteepness = []; 
        State.activeBurns = ['flash', 'onsight', 'toprope', 'autobelay', 'allfree'].includes(State.activeStyle) ? 1 : (['quick', 'topped'].includes(State.activeStyle) ? 2 : '-');
        State.activeHighPoint = 50;
        State.activePitches = 2;
        State.activeGearStyle = '';
        State.activePackWeight = '';
        
        setTimeout(() => {
            btn.innerHTML = App.editingClimbId ? '✓ Updated!' : '✓ Saved!';
            if (navigator.vibrate) navigator.vibrate([30, 50, 30]); 
            
            if (App.editingClimbId) {
                App.editingClimbId = null;
                btn.style.background = 'var(--primary)';
                btn.style.color = '#000';
            }

            setTimeout(() => { 
                App.isSaving = false; 
                App.validateForm(); 
            }, 2000);
        }, 400); 
    }
};
App.init();
