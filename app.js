if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW Registration failed:', err)));
}

const API_URL = "https://script.google.com/macros/s/AKfycbwMh-T7DB7S06_8DB2GC4dniByVHrRSqbODdLRhjciDOXSDL-V4_vzQtRXee2Wmqp9L/exec";

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
const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DISCIPLINES = ['Indoor Rope Climbing', 'Indoor Bouldering', 'Outdoor Rope Climbing', 'Outdoor Bouldering'];
const DISC_LABELS = ['In Rope', 'In Boulder', 'Out Rope', 'Out Boulder'];

const STYLE_MAP = { 'project': 'Project', 'quick': 'Send', 'flash': 'Flash', 'onsight': 'Onsight', 'worked': 'Worked' };

const STEEPNESS = ['Slab', 'Vertical', 'Overhang', 'Roof'];
const CLIMB_STYLES = ['Endurance', 'Cruxy', 'Technical', 'Athletic'];
const HOLDS = ['Crimps', 'Slopers', 'Pockets', 'Pinches', 'Tufas', 'Jugs'];
const RPES = ['Breezy', 'Solid', 'Limit'];

const getBaseGrade = (g) => String(g || "").replace(/[⚡💎🚀🛠️❌\s]/g, '');
const getLocalISO = (d = new Date()) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().substring(0, 10);

const getCleanDate = (dStr) => dStr ? String(dStr).substring(0, 10) : getLocalISO();

const getJournalDateObj = (dStr) => {
    const clean = getCleanDate(dStr);
    const [y, m, d] = clean.split('-');
    const dateObj = new Date(y, parseInt(m)-1, d);
    return {
        main: `${d} ${monthNames[parseInt(m)-1]}`,
        sub: dayNames[dateObj.getDay()]
    };
};

const formatShortDate = (dStr) => {
    const clean = getCleanDate(dStr);
    const [y, m, d] = clean.split('-');
    return `${d} ${monthNames[parseInt(m)-1]}`;
};

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

// CLEANED: Look only at the permanent master keys now. Bridge burned.
let deletedClimbs = JSON.parse(localStorage.getItem('crag_deleted_climbs') || '[]');
let deletedSessions = JSON.parse(localStorage.getItem('crag_deleted_sessions') || '[]');

let safeClimbs = JSON.parse(localStorage.getItem('crag_climbs_master') || '[]');
let safeSessions = JSON.parse(localStorage.getItem('crag_sessions_master') || '[]');

let initDisc = localStorage.getItem('lastDiscipline') || 'Indoor Rope Climbing';
let initStyle = localStorage.getItem('lastStyle') || 'quick';
let initConf = getScaleConfig(initDisc);

const State = new Proxy({
    view: 'log', discipline: initDisc, activeGrade: { text: initConf.labels[4] || initConf.labels[0], score: initConf.scores[4] || initConf.scores[0] },
    activeStyle: initStyle, activeBurns: 1, activeDate: getLocalISO(), activeGym: 'OKS', chartMode: 'max', listMode: 'top10',
    activeRPE: 'Solid', activeGradeFeel: '', activeRating: 0, activeSteepness: [], activeClimbStyles: [], activeHolds: [],
    activeTimeBucket: '', climbs: safeClimbs, sessions: safeSessions, journalLimit: 15
}, {
    set(target, prop, value) {
        if (prop === 'discipline' && target.discipline !== value) {
            target.discipline = value;
            const conf = getScaleConfig(value);
            if (!conf.labels.some(g => String(g).toLowerCase() === String(target.activeGrade.text).toLowerCase())) {
                target.activeGrade = { text: conf.labels[0], score: conf.scores[0] };
            }
            if (value === 'Indoor Rope Climbing' && (target.activeGym === 'Løkka' || target.activeGym === 'Bryn')) {
                target.activeGym = 'OKS';
            }
        } else {
            target[prop] = value;
        }
        
        if (prop === 'view') {
            ['log', 'journal', 'dash'].forEach(v => {
                const isActive = target.view === v;
                document.getElementById(`view-${v}`).classList.toggle('active', isActive);
                document.getElementById(`nav-${v}`).classList.toggle('active', isActive);
            });
            if(target.view === 'journal') App.renderJournal();
            if(target.view === 'dash') App.renderDashboard();
            setTimeout(() => App.centerActivePills(), 50); 
        }
        
        const triggersUI = [
            'discipline', 'activeGym', 'activeStyle', 'activeBurns', 'chartMode', 
            'activeRPE', 'activeGradeFeel', 'activeRating', 'activeSteepness', 
            'activeClimbStyles', 'activeHolds', 'activeTimeBucket', 'activeGrade'
        ];
        
        if (triggersUI.includes(prop)) {
            App.renderUI();
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
        
        fetch(API_URL).then(res => res.json()).then(data => {
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
                const x = acc.find(item => String(item.ClimbID) === String(current.ClimbID));
                if (!x) return acc.concat([current]);
                return acc;
            }, []).filter(c => !deletedClimbs.includes(String(c.ClimbID)));

            State.sessions = [...cloudSessions, ...unsyncedSessions].reduce((acc, current) => {
                const x = acc.find(item => String(item.SessionID) === String(current.SessionID));
                if (!x) return acc.concat([current]);
                return acc;
            }, []).filter(s => !deletedSessions.includes(String(s.SessionID)));

            b.forEach(i => i.classList.remove('syncing'));
        }).catch(() => b.forEach(i => i.classList.remove('syncing')));
    },
    pushAll: async (sessions, climbs) => { 
        if (!navigator.onLine) return;
        const payload = { action: "sync_all", sessions: sessions, climbs: climbs, deletedClimbs: deletedClimbs, deletedSessions: deletedSessions };
        try {
            const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify(payload) });
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
    init: () => {
        if (window.Chart) { Chart.defaults.color = '#737373'; Chart.defaults.borderColor = '#262626'; }
        try { App.renderUI(); } catch (e) { console.error("Render failed", e); }
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
            customPill.innerText = `${monthNames[parseInt(m)-1]} ${parseInt(d)}`;
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
    adjBurns: (dir) => { App.haptic(); State.activeBurns = Math.max(1, State.activeBurns + dir); },
    
    openSessionModal: (sessionId, mode) => {
        App.haptic();
        const s = State.sessions.find(x => String(x.SessionID) === String(sessionId));
        if(!s) return;
        document.getElementById('modalSessionId').value = s.SessionID;
        
        ['sec-focus', 'sec-fatigue', 'sec-warmup'].forEach(id => {
            document.getElementById(id).classList.add('hidden');
        });
        
        document.getElementById('modalFocusVal').value = s.Focus || "";
        document.getElementById('modalFatigueVal').value = s.Fatigue || "";
        document.getElementById('modalWarmUpVal').value = s.WarmUp || "";

        if (mode === 'focus') {
            document.getElementById('sec-focus').classList.remove('hidden');
            document.getElementById('modalTitle').innerText = 'Session Focus';
            App.setModalFocus(s.Focus || "", true);
        } else if (mode === 'fatigue') {
            document.getElementById('sec-fatigue').classList.remove('hidden');
            document.getElementById('modalTitle').innerText = 'Session Fatigue';
            App.setModalFatigue(s.Fatigue || "", true);
        } else if (mode === 'warmup') {
            document.getElementById('sec-warmup').classList.remove('hidden');
            document.getElementById('modalTitle').innerText = 'Warm-Up';
            App.setModalWarmUp(s.WarmUp || "", true);
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
        
        document.querySelectorAll('#sec-focus .pill').forEach(p => {
            p.classList.toggle('active', newVal !== "" && p.innerText === newVal);
        });
    },
    setModalFatigue: (val, init = false) => {
        if(!init) App.haptic();
        const current = String(document.getElementById('modalFatigueVal').value);
        const strVal = String(val);
        const newVal = (!init && current === strVal) ? "" : strVal;
        document.getElementById('modalFatigueVal').value = newVal;
        
        document.querySelectorAll('#sec-fatigue .pill').forEach(p => {
            p.classList.toggle('active', newVal !== "" && p.innerText === newVal);
        });
    },
    setModalWarmUp: (val, init = false) => {
        if(!init) App.haptic();
        const current = document.getElementById('modalWarmUpVal').value;
        const newVal = (!init && current === val) ? "" : val;
        document.getElementById('modalWarmUpVal').value = newVal;
        
        document.querySelectorAll('#sec-warmup .pill').forEach(p => {
            p.classList.toggle('active', newVal !== "" && p.innerText === newVal);
        });
    },
    
    saveSessionModal: () => {
        App.haptic();
        const sessionId = document.getElementById('modalSessionId').value;
        const focus = document.getElementById('modalFocusVal').value;
        const fatigue = document.getElementById('modalFatigueVal').value;
        const warmup = document.getElementById('modalWarmUpVal').value;
        
        State.sessions = State.sessions.map(s => String(s.SessionID) === String(sessionId) ? {...s, Focus: focus, Fatigue: fatigue, WarmUp: warmup, _synced: false} : s);
        SyncManager.pushAll(State.sessions.filter(s => s._synced === false), []);
        
        App.closeSessionModal();
    },

    renderUI: () => {
        const dStr = String(State.discipline || "");
        const isOut = dStr.includes('Outdoor'), isRope = dStr.includes('Rope'), isBould = dStr.includes('Boulder');
        const conf = getScaleConfig(dStr);

        const buildPills = (arr, activeVal, clickAction) => arr.map(item => `<div class="pill ${item === activeVal ? 'active' : ''}" onclick="${clickAction}='${item}';">${item}</div>`).join('');

        document.getElementById('typeSelector').innerHTML = DISCIPLINES.map((d, i) => `<div class="pill ${dStr === d ? 'active' : ''}" onclick="App.haptic(); State.discipline='${d}'">${DISC_LABELS[i]}</div>`).join('');
        document.getElementById('dashSelector').innerHTML = DISCIPLINES.map((d, i) => `<div class="pill ${dStr === d ? 'active' : ''}" onclick="App.haptic(); State.discipline='${d}'">${DISC_LABELS[i]}</div>`).join('');
        
        document.getElementById('input-outdoor').className = isOut ? '' : 'hidden';
        document.getElementById('input-indoor').className = isOut ? 'hidden' : '';
        document.getElementById('input-name').placeholder = isBould ? 'La Marie Rose' : 'Silence';
        document.getElementById('input-crag').placeholder = isBould ? 'Sector, Crag 🇬🇷' : 'Flatanger';

        const cragInput = document.getElementById('input-crag');
        if (!cragInput.value && localStorage.getItem('lastCrag')) cragInput.value = localStorage.getItem('lastCrag');

        const currentGyms = (dStr === 'Indoor Rope Climbing') ? GYMS.filter(g => g !== 'Løkka' && g !== 'Bryn') : GYMS;
        document.getElementById('gymPicker').innerHTML = buildPills(currentGyms, State.activeGym, "App.haptic(); State.activeGym");
        
        document.getElementById('gradePicker').innerHTML = conf.labels.map((g, i) => {
            const dot = conf.colors[i] ? `<span class="boulder-dot" style="background:${conf.colors[i]};"></span>` : '';
            const isActive = String(g).toLowerCase() === String(State.activeGrade.text).toLowerCase();
            return `<div class="pill ${isActive ? 'active' : ''}" onclick="App.haptic(); State.activeGrade={text:'${g}', score:${conf.scores[i]}};">${dot}${g}</div>`;
        }).join('');

        const styles = (isOut && isRope) ? [['project', 'Project'], ['quick', 'Send'], ['flash', 'Flash'], ['onsight', 'Onsight'], ['worked', 'Worked']] : [['project', 'Project'], ['quick', 'Send'], ['flash', 'Flash'], ['worked', 'Worked']];
        if (!styles.find(s => s[0] === State.activeStyle)) State.activeStyle = 'quick';
        
        document.getElementById('styleSelector').innerHTML = styles.map(s => {
            return `<div class="pill ${State.activeStyle === s[0] ? 'active' : ''}" onclick="App.haptic(); State.activeStyle='${s[0]}'; 
                if(['flash', 'onsight'].includes('${s[0]}')){ State.activeBurns = 1; }
                else if('${s[0]}' === 'quick' && State.activeBurns === 1){ State.activeBurns = 2; }
                else if(['project', 'worked'].includes('${s[0]}') && State.activeBurns < 3){ State.activeBurns = 3; }
            ">${s[1]}</div>`;
        }).join('');
        
        const bCont = document.getElementById('burns-container');
        if (['flash', 'onsight'].includes(State.activeStyle)) { bCont.classList.add('hidden'); } else { bCont.classList.remove('hidden'); }
        document.getElementById('burns-val').innerText = State.activeBurns;
        
        ['morn', 'aft', 'eve'].forEach(id => {
            const val = document.getElementById(`time-${id}`).innerText;
            document.getElementById(`time-${id}`).className = `pill ${State.activeTimeBucket === val ? 'active' : ''}`;
        });

        document.getElementById('rpeSelector').innerHTML = buildPills(RPES, State.activeRPE, "App.haptic(); State.activeRPE");
        document.getElementById('steepnessSelector').innerHTML = STEEPNESS.map(s => `<div class="pill ${State.activeSteepness.includes(s) ? 'active' : ''}" onclick="App.toggleMulti('steepness', '${s}')">${s}</div>`).join('');
        document.getElementById('climbStyleSelector').innerHTML = CLIMB_STYLES.map(s => `<div class="pill ${State.activeClimbStyles.includes(s) ? 'active' : ''}" onclick="App.toggleMulti('style', '${s}')">${s}</div>`).join('');
        document.getElementById('holdsSelector').innerHTML = HOLDS.map(h => `<div class="pill ${State.activeHolds.includes(h) ? 'active' : ''}" onclick="App.toggleMulti('hold', '${h}')">${h}</div>`).join('');
        
        document.getElementById('feel-soft').className = `pill ${State.activeGradeFeel === 'Soft' ? 'active' : ''}`;
        document.getElementById('feel-hard').className = `pill ${State.activeGradeFeel === 'Hard' ? 'active' : ''}`;
        
        const stars = document.getElementById('starRating').children;
        for(let i=0; i<stars.length; i++) stars[i].className = i < State.activeRating ? 'active' : '';

        document.getElementById('chartToggle').innerHTML = `<div class="chart-toggle-btn ${State.chartMode === 'max' ? 'active' : ''}" onclick="App.haptic(); State.chartMode='max';">Max Peak</div><div class="chart-toggle-btn ${State.chartMode === 'avg' ? 'active' : ''}" onclick="App.haptic(); State.chartMode='avg';">Avg (Top 10)</div>`;

        if (State.view === 'dash') App.renderDashboard();
        if (State.view === 'journal') App.renderJournal();

        setTimeout(() => App.centerActivePills(), 10);
    },

    renderJournal: () => {
        const jList = document.getElementById('journalList');
        if (State.sessions.length === 0) { jList.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);">No sessions found. Log a climb to start your journal.</div>'; return; }

        const sortedSessions = [...State.sessions].sort((a,b) => new Date(getCleanDate(b.Date)) - new Date(getCleanDate(a.Date)));
        const visibleSessions = sortedSessions.slice(0, State.journalLimit);

        const climbsBySession = {};
        State.climbs.forEach(c => {
            if (!climbsBySession[c.SessionID]) climbsBySession[c.SessionID] = [];
            climbsBySession[c.SessionID].push(c);
        });

        let htmlOut = visibleSessions.map(session => {
            const children = climbsBySession[session.SessionID] || [];
            children.sort((a,b) => Number(b.ClimbID) - Number(a.ClimbID));
            if(children.length === 0) return ''; 

            const dateInfo = getJournalDateObj(session.Date);
            const totalBurns = children.reduce((sum, c) => sum + (Number(c.Burns) || 1), 0);
            
            let maxSentStr = "-";
            let maxColor = '#fff';
            
            const sends = children.filter(c => c.Style !== 'worked');
            if (sends.length > 0) {
                const maxSend = sends.reduce((max, cur) => Number(cur.Score) > Number(max.Score) ? cur : max);
                maxSentStr = getBaseGrade(maxSend.Grade);
                
                const sessionType = sends[0].Type;
                const sConf = getScaleConfig(sessionType);
                if (sessionType.includes('Bouldering') && sConf.colors.length > 0) {
                    const mIdx = sConf.labels.indexOf(maxSentStr);
                    if (mIdx > -1) maxColor = sConf.colors[mIdx] || '#fff';
                } else if (sessionType.includes('Rope')) {
                    maxColor = 'var(--primary)';
                }
            }
            
            let bouldCount = 0; let ropeCount = 0;
            children.forEach(c => {
                if(c.Type.includes('Bouldering')) bouldCount++;
                if(c.Type.includes('Rope')) ropeCount++;
            });
            
            let domDisc = 'mixed';
            let domLabel = 'Mixed';
            if (bouldCount > 0 && ropeCount === 0) { domDisc = 'boulder'; domLabel = 'In Boulder'; } 
            else if (ropeCount > 0 && bouldCount === 0) { domDisc = 'rope'; domLabel = 'In Rope'; }
            
            if (domDisc !== 'mixed') {
                if(children[0] && children[0].Type) {
                    const idx = DISCIPLINES.indexOf(children[0].Type);
                    if(idx > -1) domLabel = DISC_LABELS[idx];
                }
            }

            let bgClass = 'bg-mixed'; 
            if (domDisc === 'boulder') bgClass = 'bg-boulder';
            else if (domDisc === 'rope') bgClass = 'bg-rope';

            const focusTagHtml = session.Focus ? `<div class="s-tag focus-tag" onclick="App.openSessionModal('${session.SessionID}', 'focus')">${session.Focus}</div>` : `<div class="s-tag empty-tag" onclick="App.openSessionModal('${session.SessionID}', 'focus')">+ Focus</div>`;
            const fatigueTagHtml = session.Fatigue ? `<div class="s-tag fatigue-tag" onclick="App.openSessionModal('${session.SessionID}', 'fatigue')">Fatigue: ${session.Fatigue}/10</div>` : `<div class="s-tag empty-tag" onclick="App.openSessionModal('${session.SessionID}', 'fatigue')">+ Fatigue</div>`;
            const warmupTagHtml = session.WarmUp ? `<div class="s-tag warmup-tag" onclick="App.openSessionModal('${session.SessionID}', 'warmup')">Warm-up: ${session.WarmUp}</div>` : `<div class="s-tag empty-tag" onclick="App.openSessionModal('${session.SessionID}', 'warmup')">+ Warm-up</div>`;
            
            let fatigueClass = '';
            if (session.Fatigue) {
                const fScore = Number(session.Fatigue);
                if (fScore <= 2) fatigueClass = 'f-tier-1'; 
                else if (fScore <= 4) fatigueClass = 'f-tier-2'; 
                else if (fScore <= 6) fatigueClass = 'f-tier-3'; 
                else if (fScore <= 8) fatigueClass = 'f-tier-4'; 
                else if (fScore <= 10) fatigueClass = 'f-tier-5'; 
            }

            const childrenHtml = children.map(l => {
                let rawGrade = String(l.Grade || "");
                const cleanDisplayGrade = getBaseGrade(rawGrade); 
                const isF = rawGrade.includes('⚡') || rawGrade.includes('💎');
                const isFail = l.Style === 'worked';
                let finalDisplayGrade = cleanDisplayGrade;
                
                if (rawGrade.includes('⚡')) finalDisplayGrade += ' ⚡';
                if (rawGrade.includes('💎') || rawGrade.includes('👁️')) finalDisplayGrade += ' 💎';
                if (rawGrade.includes('🚀')) finalDisplayGrade += ' 🚀';
                if (rawGrade.includes('🛠️')) finalDisplayGrade += ' 🛠️';
                if (isFail) finalDisplayGrade += ' ❌';

                const badge = getBadge(l.Type, rawGrade);
                const syncWarning = l._synced === false ? `<span style="color: #ef4444; font-size: 0.7rem; margin-left: 6px;">☁️✕</span>` : '';
                
                let fullLocationString = l.Name || "Log";
                let displayRoute = fullLocationString.includes(' @ ') ? fullLocationString.split(' @ ')[0] : fullLocationString;

                let inlineColor = '';
                if (l.Type === 'Indoor Bouldering') {
                    const idx = GRADES.bouldsIn.indexOf(getBaseGrade(rawGrade));
                    if (idx > -1 && GRADES.bouldsInColors[idx]) inlineColor = `color: ${GRADES.bouldsInColors[idx]} !important;`;
                }

                let metaHtml = `<div class="log-details-grid">`;
                if (l.Type && l.Type.includes('Outdoor')) {
                    metaHtml += `<div class="log-meta-item" style="grid-column: 1 / -1;">ROUTE<div class="log-meta-val" style="text-transform: none;">${displayRoute}</div></div>`;
                }
                if (l.Style && STYLE_MAP[l.Style]) metaHtml += `<div class="log-meta-item">STYLE<div class="log-meta-val">${STYLE_MAP[l.Style]}</div></div>`;
                metaHtml += `<div class="log-meta-item">BURNS<div class="log-meta-val">${l.Burns || 1}</div></div>`;
                if (l.Rating) metaHtml += `<div class="log-meta-item">RATING<div class="log-meta-val" style="color:#eab308; letter-spacing:2px;">${'★'.repeat(l.Rating)}</div></div>`;
                metaHtml += `</div>`;
                let notesHtml = l.Notes ? `<div class="log-notes-box">"${l.Notes}"</div>` : '';

                return `
                <div class="log-card" style="border-color: rgba(255,255,255,0.05); background: rgba(0,0,0,0.2);">
                    <div class="log-summary" onclick="App.haptic(); const p = this.parentElement; const isExp = p.classList.contains('expanded'); document.querySelectorAll('.session-children .log-card').forEach(c => c.classList.remove('expanded')); if(!isExp) p.classList.add('expanded');">
                        <div class="log-info" style="padding-left:0;">
                            <div class="log-name">${displayRoute}${syncWarning}</div>
                        </div>
                        <div class="log-grade ${isF ? 'fl' : (isFail ? 'fail' : 'rp')}" style="${inlineColor}">${badge}${finalDisplayGrade}</div>
                    </div>
                    <div class="log-details">
                        ${metaHtml}
                        ${notesHtml}
                        <button class="log-del-btn" onclick="App.deleteClimb('${l.ClimbID}')">Delete Entry</button>
                    </div>
                </div>`;
            }).join('');

            return `
            <div class="session-card ${bgClass} ${fatigueClass}">
                <div class="session-header">
                    <div class="s-date-block">
                        <div class="s-date-main">${dateInfo.main}</div>
                        <div class="s-date-sub">${dateInfo.sub}</div>
                    </div>
                    <div class="s-loc">@ ${session.Location} &nbsp;&bull;&nbsp; <span style="color:#a3a3a3;">${domLabel}</span></div>
                </div>
                <div class="s-tags-row">
                    ${focusTagHtml}
                    ${fatigueTagHtml}
                    ${warmupTagHtml}
                </div>
                <div class="session-stats-grid">
                    <div class="s-stat-box"><div class="s-stat-lbl">Volume</div><div class="s-stat-val">${totalBurns}</div></div>
                    <div class="s-stat-box"><div class="s-stat-lbl">Max Sent</div><div class="s-stat-val" style="color:${maxColor};">${maxSentStr}</div></div>
                    <div class="s-stat-box"><div class="s-stat-lbl">Routes</div><div class="s-stat-val">${children.length}</div></div>
                </div>
                <button class="session-accordion-btn" onclick="App.haptic(); const p = this.parentElement; const isExp = p.classList.contains('expanded'); document.querySelectorAll('.session-card').forEach(c => c.classList.remove('expanded')); if(!isExp) p.classList.add('expanded');">View ${children.length} Climbs ▾</button>
                <div class="session-children">
                    ${childrenHtml}
                </div>
            </div>`;
        }).join('');
        
        if (sortedSessions.length > State.journalLimit) {
            htmlOut += `<button class="load-more-btn" onclick="App.haptic(); State.journalLimit += 15;">Load Older Sessions ▾</button>`;
        }
        
        jList.innerHTML = htmlOut;
    },
    
    renderDashboard: () => {
        App.renderDashboardCharts();
        App.renderDashboardLogs();
    },

    renderDashboardCharts: () => {
        const dStr = String(State.discipline || "");
        const isRope = dStr.includes('Rope');
        const conf = getScaleConfig(dStr);
        const viewLogs = State.climbs.filter(l => l && l.Type === dStr && l.Style !== 'worked').map(l => ({ ...l, cleanDate: getCleanDate(l.Date) }));

        const noD = document.getElementById('noDataMsg');
        const ctxCanvas = document.getElementById('progressChart');
        if (!window.Chart) { ctxCanvas.style.display = 'none'; noD.style.display = 'block'; return; }

        if(App.chart) App.chart.destroy();
        const ctx = ctxCanvas.getContext('2d');
        if (viewLogs.length === 0) { ctxCanvas.style.display = 'none'; noD.style.display = 'block'; return; }
        ctxCanvas.style.display = 'block'; noD.style.display = 'none';

        const allM = [...new Set(viewLogs.map(l => l.cleanDate.substring(0,7)))].sort();
        const cD = { rp: [], fl: [], rpG: [], flG: [], avg: [], avgG: [], lbl: [] };
        
        const getScoreIndex = (s, isF) => { 
            let b = s - (isF ? (isRope ? 10 : 17) : 0); 
            return conf.scores.indexOf(conf.scores.reduce((p, c) => Math.abs(c-b) < Math.abs(p-b) ? c : p)); 
        };
        
        allM.forEach(m => {
            const [y, mo] = m.split('-').map(Number);
            if (State.chartMode === 'max') {
                const mL = viewLogs.filter(l => l.cleanDate.substring(0,7) === m && Number(l.Score));
                const rpL = mL.filter(l => !String(l.Grade||"").includes('⚡') && !String(l.Grade||"").includes('💎'));
                const flL = mL.filter(l => String(l.Grade||"").includes('⚡') || String(l.Grade||"").includes('💎'));
                
                let maxRp = rpL.length ? rpL.reduce((max, cur) => Number(cur.Score) > Number(max.Score) ? cur : max) : null;
                let maxFl = flL.length ? flL.reduce((max, cur) => Number(cur.Score) > Number(max.Score) ? cur : max) : null;

                cD.rp.push(maxRp ? getScoreIndex(Number(maxRp.Score), false) : null);
                cD.rpG.push(maxRp ? maxRp.Grade : "None");
                cD.fl.push(maxFl ? getScoreIndex(Number(maxFl.Score), true) : null);
                cD.flG.push(maxFl ? maxFl.Grade : "None");
            } else {
                let pM = mo-1, pY = y; if (pM === 0) { pM = 12; pY = y-1; }
                const pMS = `${pY}-${pM.toString().padStart(2, '0')}`;
                const wL = viewLogs.filter(l => (l.cleanDate.substring(0,7) === m || l.cleanDate.substring(0,7) === pMS) && Number(l.Score)).sort((a,b) => Number(b.Score) - Number(a.Score)).slice(0, 10);
                
                if (wL.length > 0) { 
                    const avS = Math.round(wL.reduce((s, l) => s + Number(l.Score), 0) / wL.length);
                    const avI = conf.scores.indexOf(conf.scores.reduce((p, c) => Math.abs(c-avS) < Math.abs(p-avS) ? c : p)); 
                    cD.avg.push(avI); cD.avgG.push(conf.labels[avI]); 
                } else { 
                    cD.avg.push(null); cD.avgG.push("None"); 
                }
            }
            cD.lbl.push(`${monthNames[mo-1]} '${y.toString().slice(-2)}`);
        });

        let dSet = [], toolC;
        if (State.chartMode === 'max') {
            let g = ctx.createLinearGradient(0, 0, 0, 300); g.addColorStop(0, 'rgba(16, 185, 129, 0.25)'); g.addColorStop(1, 'transparent');
            dSet = [{ label: 'Max Redpoint', data: cD.rp, borderColor: '#10b981', backgroundColor: g, tension: 0.4, fill: true, pointRadius: 5, pointBackgroundColor: '#10b981', spanGaps: true }, { label: 'Flash/Onsight', data: cD.fl, borderColor: '#db2777', borderDash: [5,5], tension: 0.4, fill: false, pointRadius: 5, pointBackgroundColor: '#db2777', spanGaps: true }];
            toolC = ctx => ctx.datasetIndex === 0 ? ` Redpoint: ${cD.rpG[ctx.dataIndex]}` : ` Flash: ${cD.flG[ctx.dataIndex]}`;
        } else {
            let gA = ctx.createLinearGradient(0, 0, 0, 300); gA.addColorStop(0, 'rgba(59, 130, 246, 0.35)'); gA.addColorStop(1, 'transparent');
            dSet = [{ label: 'Top 10 Average', data: cD.avg, borderColor: '#3b82f6', backgroundColor: gA, tension: 0.4, fill: true, pointRadius: 6, pointBackgroundColor: '#3b82f6', spanGaps: true }];
            toolC = ctx => ` Power Avg: ${cD.avgG[ctx.dataIndex]}`;
        }
        const aI = [...cD.rp.filter(x=>x!==null), ...cD.fl.filter(x=>x!==null), ...cD.avg.filter(x=>x!==null)];
        App.chart = new Chart(ctx, { type: 'line', data: { labels: cD.lbl, datasets: dSet }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: toolC } } }, scales: { y: { min: Math.max(0, Math.min(...aI)-1), max: Math.min(conf.labels.length-1, Math.max(...aI)+1), ticks: { stepSize: 1, callback: v => conf.labels[v] } }, x: { grid: { display: false } } } } });
    },

    renderDashboardLogs: () => {
        const dStr = String(State.discipline || "");
        const conf = getScaleConfig(dStr);
        
        document.getElementById('listToggleTop').className = `log-toggle-btn ${State.listMode === 'top10' ? 'active' : ''}`;
        document.getElementById('listToggleRecent').className = `log-toggle-btn ${State.listMode === 'recent' ? 'active' : ''}`;

        const titleEl = document.getElementById('logListTitle');
        const xpC = document.getElementById('xpContainer');

        const viewLogs = State.climbs.filter(l => l && l.Type === dStr && l.Style !== 'worked').map(l => ({ ...l, cleanDate: getCleanDate(l.Date) }));
        let displayLogs = [];

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

            if (displayLogs.length > 0) {
                xpC.classList.remove('hidden');
                const avgScore = Math.round(displayLogs.reduce((sum, l) => sum + Number(l.Score), 0) / displayLogs.length);
                const currentIdx = conf.scores.indexOf(conf.scores.slice().reverse().find(s => s <= avgScore) || conf.scores[0]);
                const nextIdx = Math.min(currentIdx + 1, conf.scores.length - 1);
                const nextScore = conf.scores[nextIdx];
                const currentBaseScore = conf.scores[currentIdx];
                
                let percent = 0;
                if (nextScore > currentBaseScore) {
                    percent = Math.min(100, Math.max(0, ((avgScore - currentBaseScore) / (nextScore - currentBaseScore)) * 100));
                } else if (avgScore >= conf.scores[conf.scores.length - 1]) {
                    percent = 100;
                }
                
                document.getElementById('xpBaseGrade').innerText = conf.labels[currentIdx];
                document.getElementById('xpNextGrade').innerText = conf.labels[nextIdx];
                
                let baseColor = (conf.colors && conf.colors[currentIdx]) ? conf.colors[currentIdx] : 'var(--primary)';
                let nextColor = (conf.colors && conf.colors[nextIdx]) ? conf.colors[nextIdx] : 'var(--primary)';

                document.getElementById('xpBaseGrade').style.color = baseColor;
                document.getElementById('xpNextGrade').style.color = nextColor;
                document.getElementById('xpPercent').style.color = nextColor;
                document.getElementById('xpPercent').innerText = `${Math.round(percent)}%`;
                
                if (conf.colors && conf.colors.length > 0) {
                    document.getElementById('xpBarFill').style.background = `linear-gradient(90deg, ${baseColor}, ${nextColor})`;
                    document.getElementById('xpBarFill').style.boxShadow = `0 0 10px ${nextColor}80`;
                } else {
                    document.getElementById('xpBarFill').style.background = 'var(--primary)';
                    document.getElementById('xpBarFill').style.boxShadow = '0 0 10px rgba(16,185,129,0.5)';
                }

                setTimeout(() => { document.getElementById('xpBarFill').style.width = `${percent}%`; }, 10);
            } else {
                xpC.classList.add('hidden');
            }

        } else {
            titleEl.innerText = 'Recent Logs';
            displayLogs = [...viewLogs].sort((a,b) => Number(b.ClimbID) - Number(a.ClimbID)).slice(0, 10);
            xpC.classList.add('hidden');
        }
        
        document.getElementById('logList').innerHTML = displayLogs.length === 0 ? '<div style="text-align:center; padding:20px; color:var(--text-muted);">No logs found.</div>' : displayLogs.map(l => {
            const formattedDate = formatShortDate(l.cleanDate);
            let rawGrade = String(l.Grade || "");
            const cleanDisplayGrade = getBaseGrade(rawGrade); 
            const isF = rawGrade.includes('⚡') || rawGrade.includes('💎');
            let finalDisplayGrade = cleanDisplayGrade;
            
            if (rawGrade.includes('⚡')) finalDisplayGrade += ' ⚡';
            if (rawGrade.includes('💎')) finalDisplayGrade += ' 💎';
            if (rawGrade.includes('🚀')) finalDisplayGrade += ' 🚀';
            if (rawGrade.includes('🛠️')) finalDisplayGrade += ' 🛠️';

            const badge = getBadge(l.Type, rawGrade);
            
            let displayRoute = l.Name.includes(' @ ') ? l.Name.split(' @ ')[0] : l.Name;
            let inlineColor = '';
            if (l.Type === 'Indoor Bouldering') {
                const idx = GRADES.bouldsIn.indexOf(getBaseGrade(rawGrade));
                if (idx > -1 && GRADES.bouldsInColors[idx]) inlineColor = `color: ${GRADES.bouldsInColors[idx]} !important;`;
            }

            return `
            <div class="log-card" style="pointer-events:none;">
                <div class="log-summary">
                    <div class="log-date">${formattedDate}</div>
                    <div class="log-info"><div class="log-name">${displayRoute}</div></div>
                    <div class="log-grade ${isF ? 'fl' : 'rp'}" style="${inlineColor}">${badge}${finalDisplayGrade}</div>
                </div>
            </div>`;
        }).join('');
    },
    
    logClimb: () => {
        App.haptic(); 
        
        localStorage.setItem('lastDiscipline', State.discipline);
        localStorage.setItem('lastStyle', State.activeStyle);

        const climbDateStr = State.activeDate;
        
        let s = State.activeGrade.score, g = State.activeGrade.text;
        if(State.activeStyle === 'flash') { s += State.discipline.includes('Rope') ? 10 : 17; g += " ⚡"; } 
        else if (State.activeStyle === 'onsight') { s += 10; g += " 💎"; }
        else if (State.activeStyle === 'quick') { g += " 🚀"; }
        else if (State.activeStyle === 'project') { g += " 🛠️"; }
        else if (State.activeStyle === 'worked') { g += " ❌"; s = 0; }
        
        const outName = document.getElementById('input-name').value.trim();
        const outCrag = document.getElementById('input-crag').value.trim();
        
        if (State.discipline.includes('Outdoor') && outCrag) localStorage.setItem('lastCrag', outCrag);
        const n = State.discipline.includes('Outdoor') ? `${outName} @ ${outCrag}` : State.activeGym;
        if (State.discipline.includes('Outdoor') && (!outName || !outCrag)) { App.toast("Fill info"); return; }
        
        let cleanLoc = n.includes(' @ ') ? n.split(' @ ')[1] : n;
        cleanLoc = cleanLoc.replace(/[^a-zA-Z0-9\s]/g, '').trim(); 
        const sessionID = `${climbDateStr}_${cleanLoc}`;

        if (!State.sessions.find(s => s.SessionID === sessionID)) {
            const newSession = {
                SessionID: sessionID,
                Date: climbDateStr,
                Location: n.includes(' @ ') ? n.split(' @ ')[1] : n,
                Focus: "",
                Fatigue: "",
                WarmUp: "",
                Notes: "",
                _synced: false
            };
            State.sessions = [newSession, ...State.sessions];
        }

        const btn = document.getElementById('saveClimbBtn');
        btn.disabled = true;
        btn.innerText = 'Saving...';
        
        const climb = { 
            ClimbID: String(Date.now()), 
            SessionID: sessionID,
            Date: climbDateStr, 
            Type: State.discipline, 
            Name: n,
            Grade: g, 
            Score: s, 
            Style: State.activeStyle, 
            Burns: State.activeBurns,
            Angle: State.activeSteepness.join(', '), 
            Effort: State.activeRPE,
            GradeFeel: State.activeGradeFeel,
            Rating: State.activeRating > 0 ? State.activeRating : "",
            Holds: State.activeHolds.join(', '),
            ClimStyles: State.activeClimbStyles.join(', '),
            Notes: document.getElementById('input-notes').value.trim(),
            _synced: false 
        };
        
        State.climbs = [climb, ...State.climbs]; 
        SyncManager.pushAll(State.sessions.filter(s => s._synced === false), [climb]); 
        
        if (State.discipline.includes('Outdoor')) document.getElementById('input-name').value = ''; 
        document.getElementById('input-notes').value = '';
        State.activeRating = 0; State.activeGradeFeel = ''; State.activeClimbStyles = []; State.activeHolds = []; State.activeSteepness = []; 
        
        State.activeBurns = ['flash', 'onsight'].includes(State.activeStyle) ? 1 : (State.activeStyle === 'quick' ? 2 : 3);
        
        setTimeout(() => {
            btn.innerHTML = '✓ Saved!';
            if (navigator.vibrate) navigator.vibrate([30, 50, 30]); 
            setTimeout(() => { btn.innerHTML = 'Save to Cloud'; btn.disabled = false; }, 2000);
        }, 400); 
    }
};
App.init();
