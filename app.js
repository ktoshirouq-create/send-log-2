if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW Registration failed:', err)));
}

// AppConfig, getBaseGrade, getCleanDate, escapeHTML, formatShortDate, getScaleConfig
// are defined in shared.js (loaded before this file).

const getLocalISO = (d = new Date()) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().substring(0, 10);

const getJournalDateObj = (dStr) => {
    const clean = getCleanDate(dStr);
    const [y, m, d] = clean.split('-');
    const dateObj = new Date(y, parseInt(m, 10)-1, parseInt(d, 10));
    return { main: `${parseInt(d, 10)} ${AppConfig.months[parseInt(m, 10)-1]}`, sub: AppConfig.days[dateObj.getDay()] };
};

const getChartScore = (l) => {
    if (l.Type === 'Outdoor Multipitch') {
        const sConf = AppConfig.grades.ropesOut;
        const idx = sConf.labels.indexOf(getBaseGrade(l.Grade));
        if (idx > -1) return sConf.scores[idx];
    }
    return Number(l.Score) || 0;
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
    activePitches: [{type: 'Lead', grade: initConf.labels[gIdx]}, {type: 'Lead', grade: initConf.labels[gIdx]}], 
    activeGearStyle: '', activePackWeight: '',
    climbs: safeClimbs, sessions: safeSessions, journalLimit: 5
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
            
            if (conf && conf.labels && !conf.labels.some(g => String(g).toLowerCase() === String(target.activeGrade.text).toLowerCase())) {
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
                App.updateDynamicRatingText(0);
            }
            
            if (value === 'Outdoor Multipitch') {
                target.activePitches = [{type: 'Lead', grade: target.activeGrade.text}, {type: 'Lead', grade: target.activeGrade.text}];
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
            
            const unsyncedClimbs = State.climbs.filter(c => c._synced === false);
            const unsyncedSessions = State.sessions.filter(s => s._synced === false);

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
                    current.Partner = existing.Partner; 
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
    editingPitchIdx: null,
    
    init: () => {
        if (window.Chart) { Chart.defaults.color = '#a3a3a3'; Chart.defaults.borderColor = 'rgba(255,255,255,0.05)'; Chart.defaults.font.family = "'Inter', sans-serif"; }
        const inputCrag = document.getElementById('input-crag');
        if (inputCrag) inputCrag.value = localStorage.getItem('lastCrag') || '';
        
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
        if(copy[type] && modal) {
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
        App.setDate('custom', getCleanDate(climb.Date));
        
        if (climb.Type.includes('Outdoor')) {
            const parts = (climb.Name || "").split(' @ ');
            const inName = document.getElementById('input-name');
            const inCrag = document.getElementById('input-crag');
            if (inName) inName.value = parts[0] ? parts[0].trim() : '';
            if (inCrag) inCrag.value = parts[1] ? parts[1].trim() : '';
        } else {
            State.activeGym = climb.Name || 'OKS';
        }
        
        const inPartner = document.getElementById('input-partner');
        if (inPartner) inPartner.value = climb.Partner || '';

        const conf = getScaleConfig(State.discipline);
        const cleanGrade = getBaseGrade(climb.Grade);
        const gIdx = conf.labels.indexOf(cleanGrade);
        State.activeGrade = gIdx > -1 ? { text: conf.labels[gIdx], score: conf.scores[gIdx] } : { text: conf.labels[0], score: conf.scores[0] };

        State.activeStyle = climb.Style || 'quick';
        State.activeBurns = climb.Burns || '-';
        State.activeHighPoint = climb.HighPoint || 50;
        
        State.activeGearStyle = climb.GearStyle || '';
        State.activePackWeight = climb.PackWeight || '';
        
        if (State.discipline === 'Outdoor Multipitch') {
            let parsedPitches = [];
            if (climb.PitchBreakdown) {
                let parts = climb.PitchBreakdown.split(', ');
                parsedPitches = parts.map(p => {
                    let [typeInitial, grade] = p.split(':');
                    return { type: typeInitial === 'F' ? 'Follow' : 'Lead', grade: grade || climb.Grade };
                });
            } else {
                let count = climb.Pitches || 2;
                for(let i=0; i<count; i++) parsedPitches.push({ type: 'Lead', grade: climb.Grade });
            }
            State.activePitches = parsedPitches;
        }

        State.activeRPE = climb.Effort || 'Solid';
        State.activeRating = Number(climb.Rating) || 0;
        State.activeSteepness = climb.Angle ? climb.Angle.split(', ') : [];
        State.activeClimbStyles = climb.ClimStyles ? climb.ClimStyles.split(', ') : [];
        State.activeHolds = climb.Holds ? climb.Holds.split(', ') : [];
        
        const notesInput = document.getElementById('input-notes');
        if (notesInput) notesInput.value = climb.Notes || '';

        const advContent = document.getElementById('advanced-content');
        const advToggle = document.querySelector('.advanced-toggle');
        if (advContent && (climb.Effort || climb.Rating || climb.Angle || climb.ClimStyles || climb.Holds || climb.Notes)) {
            advContent.classList.remove('hidden');
            if (advToggle) advToggle.innerText = '- Hide Details';
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
        if (type === 'today') { 
            State.activeDate = getLocalISO(); 
            const pToday = document.getElementById('pill-today');
            if (pToday) pToday.classList.add('active'); 
        }
        else if (type === 'yesterday') { 
            let yest = new Date(); yest.setDate(yest.getDate()-1); 
            State.activeDate = getLocalISO(yest); 
            const pYest = document.getElementById('pill-yest');
            if (pYest) pYest.classList.add('active'); 
        }
        else if (type === 'custom' && val) { 
            State.activeDate = val; const [, m, d] = val.split('-');
            const customPill = document.getElementById('pill-custom');
            if(customPill) {
                customPill.classList.add('active');
                customPill.innerText = `${AppConfig.months[parseInt(m, 10)-1]} ${parseInt(d, 10)}`;
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

    adjPitchCount: (dir) => { 
        App.haptic(); 
        let pArr = [...State.activePitches];
        if (dir > 0) {
            pArr.push({ type: 'Lead', grade: State.activeGrade.text || AppConfig.grades.ropesOut.labels[5] });
        } else if (dir < 0 && pArr.length > 2) { 
            pArr.pop();
        }
        State.activePitches = pArr;
    },
    updatePitchObj: (index, key, val) => {
        App.haptic();
        let pArr = [...State.activePitches];
        pArr[index][key] = val;
        State.activePitches = pArr;
    },
    openPitchGradeModal: (idx) => {
        App.haptic();
        App.editingPitchIdx = idx;
        const modal = document.getElementById('pitchGradeModal');
        const picker = document.getElementById('pitchGradePicker');
        const labels = AppConfig.grades.ropesOut.labels;
        
        if (picker) {
            picker.innerHTML = labels.map(g => `<div class="pill ${State.activePitches[idx].grade === g ? 'active' : ''}" style="margin-bottom:8px; padding: 12px 18px;" onclick="App.updatePitchObj(${idx}, 'grade', '${g}'); document.getElementById('pitchGradeModal').classList.remove('active');">${g}</div>`).join('');
        }
        if (modal) modal.classList.add('active');
    },

    addPartner: (name) => {
        App.haptic();
        const input = document.getElementById('input-partner');
        if (!input) return;
        
        if (State.discipline === 'Outdoor Multipitch') {
            const current = input.value.trim();
            if (current && !current.includes(name)) {
                input.value = `${current}, ${name}`;
            } else if (!current) {
                input.value = name;
            }
        } else {
            input.value = name;
        }
        App.validateForm();
    },
    
    renderPartnerPills: () => {
        const picker = document.getElementById('partnerPicker');
        if (!picker) return;
        
        let counts = {};
        State.climbs.forEach(c => {
            if (c.Partner) {
                const names = c.Partner.split(',').map(n => n.trim());
                names.forEach(n => { if (n) counts[n] = (counts[n] || 0) + 1; });
            }
        });
        
        const topPartners = Object.keys(counts).sort((a,b) => counts[b] - counts[a]).slice(0, 5);
        
        if (topPartners.length === 0) {
            picker.style.display = 'none';
        } else {
            picker.style.display = 'flex';
            picker.innerHTML = topPartners.map(p => `<div class="pill" onclick="App.addPartner('${p}')">${p}</div>`).join('');
        }
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
            
            const out = document.getElementById('hp-output');
            const fill = document.getElementById('hp-fill');
            const thumb = document.getElementById('hp-thumb');
            if (out) out.innerText = `${val}%`;
            if (fill) fill.style.width = `${val}%`;
            if (thumb) thumb.style.left = `${val}%`;
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
        
        const mSessionId = document.getElementById('modalSessionId');
        if (mSessionId) mSessionId.value = s.SessionID;
        
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
        if (titleEl) {
            titleEl.innerText = titles[mode] || 'Session Editor';
            titleEl.classList.remove('hidden');
        }

        const isNotes = mode === 'notes';
        const notesLabel = document.getElementById('sec-notes-label');
        const notesVal = document.getElementById('modalNotesVal');
        if(notesLabel) notesLabel.classList.toggle('hidden', !isNotes);
        if(notesVal) notesVal.classList.toggle('hidden', !isNotes);

        const mFocus = document.getElementById('modalFocusVal');
        const mFatigue = document.getElementById('modalFatigueVal');
        const mWarmup = document.getElementById('modalWarmUpVal');
        const mApproach = document.getElementById('modalApproachVal');

        if (mFocus) mFocus.value = s.Focus || "";
        if (mFatigue) mFatigue.value = s.Fatigue || "";
        if (mWarmup) mWarmup.value = s.WarmUp || "";
        if (mApproach) mApproach.value = s.Approach || "";
        if (notesVal) notesVal.value = s.Notes || "";

        if (mode === 'focus') {
            const sec = document.getElementById('sec-focus');
            if (sec) sec.classList.remove('hidden');
            App.setModalFocus(s.Focus || "", true);
        } else if (mode === 'fatigue') {
            const sec = document.getElementById('sec-fatigue');
            if (sec) sec.classList.remove('hidden');
            App.setModalFatigue(s.Fatigue || "", true);
        } else if (mode === 'warmup') {
            const sec = document.getElementById('sec-warmup');
            if (sec) sec.classList.remove('hidden');
            App.setModalWarmUp(s.WarmUp || "", true);
        } else if (mode === 'approach') {
            const sec = document.getElementById('sec-approach');
            if (sec) sec.classList.remove('hidden');
            App.setModalApproach(s.Approach || "", true);
        } else if (mode === 'notes') {
            setTimeout(() => { if(notesVal) notesVal.focus(); }, 300);
        }
        
        const sessionModal = document.getElementById('sessionModal');
        if (sessionModal) sessionModal.classList.add('active');
    },
    
    setModalFocus: (val, init = false) => {
        if(!init) App.haptic();
        const mFocus = document.getElementById('modalFocusVal');
        if (!mFocus) return;
        const current = mFocus.value;
        const newVal = (!init && current === val) ? "" : val;
        mFocus.value = newVal;
        App.updateSegmentedHighlight('focus-segmented', newVal);
    },

    setModalApproach: (val, init = false) => {
        if(!init) App.haptic();
        const mApp = document.getElementById('modalApproachVal');
        if (!mApp) return;
        const current = mApp.value;
        const newVal = (!init && current === val) ? "" : val;
        mApp.value = newVal;
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
        const mWarm = document.getElementById('modalWarmUpVal');
        if (!mWarm) return;
        const current = mWarm.value;
        const newVal = (!init && current === val) ? "" : val;
        mWarm.value = newVal;
        App.updateSegmentedHighlight('warmup-segmented', newVal);
    },
    
    saveSessionModal: () => {
        App.haptic();
        const mSessionId = document.getElementById('modalSessionId');
        const mFocus = document.getElementById('modalFocusVal');
        const mFatigue = document.getElementById('modalFatigueVal');
        const mWarmup = document.getElementById('modalWarmUpVal');
        const mApproach = document.getElementById('modalApproachVal');
        const mNotesVal = document.getElementById('modalNotesVal');

        const sessionId = mSessionId ? mSessionId.value : '';
        const focus = mFocus ? mFocus.value : '';
        const fatigue = mFatigue ? mFatigue.value : '';
        const warmup = mWarmup ? mWarmup.value : '';
        const approach = mApproach ? mApproach.value : '';
        const notes = mNotesVal ? mNotesVal.value.trim() : '';
        
        State.sessions = State.sessions.map(s => String(s.SessionID) === String(sessionId) ? {...s, Focus: focus, Fatigue: fatigue, WarmUp: warmup, Approach: approach, Notes: notes, _synced: false} : s);
        SyncManager.pushAll(State.sessions.filter(s => s._synced === false), []);
        
        const sm = document.getElementById('sessionModal');
        if (sm) sm.classList.remove('active');
    },

    validateForm: () => {
        if (App.isSaving) return; 
        const btn = document.getElementById('saveClimbBtn');
        if (!btn) return;
        const isOut = State.discipline.includes('Outdoor');
        
        const inName = document.getElementById('input-name');
        const inCrag = document.getElementById('input-crag');
        
        const n = inName ? inName.value.trim() : '';
        const c = inCrag ? inCrag.value.trim() : '';
        
        if (isOut && (!n || !c)) {
            btn.disabled = true;
            btn.innerText = App.editingClimbId ? 'Missing Route or Crag' : 'Missing Route or Crag';
        } else {
            btn.disabled = false;
            btn.innerText = App.editingClimbId ? 'Update Entry' : 'Save to Cloud';
        }
    },

    renderUI: () => {
        const safeHTML = (id, html) => { const e = document.getElementById(id); if(e) e.innerHTML = html; };
        const safeClass = (id, cls) => { const e = document.getElementById(id); if(e) e.className = cls; };
        const safeText = (id, txt) => { const e = document.getElementById(id); if(e) e.innerText = txt; };

        const dStr = String(State.discipline || "");
        const isOut = dStr.includes('Outdoor'), isRope = dStr.includes('Rope'), isBould = dStr.includes('Boulder');
        const isMulti = dStr === 'Outdoor Multipitch';
        const isIce = dStr === 'Outdoor Ice Climbing';
        const isTrad = dStr === 'Outdoor Trad Climbing';
        const conf = getScaleConfig(dStr);

        const buildPills = (arr, activeVal, clickAction) => arr.map(item => `<div class="pill ${item === activeVal ? 'active' : ''}" data-val="${item}" onclick="${clickAction}='${item}';">${item}</div>`).join('');

        safeHTML('typeSelector', AppConfig.disciplines.map((d, i) => `<div class="pill ${dStr === d ? 'active' : ''}" data-val="${d}" onclick="App.haptic(); State.discipline='${d}'">${AppConfig.discLabels[i]}</div>`).join(''));
        safeHTML('dashSelector', AppConfig.disciplines.map((d, i) => `<div class="pill ${dStr === d ? 'active' : ''}" data-val="${d}" onclick="App.haptic(); State.discipline='${d}'">${AppConfig.discLabels[i]}</div>`).join(''));
        
        safeClass('input-outdoor', isOut ? '' : 'hidden');
        safeClass('input-indoor', isOut ? 'hidden' : '');
        
        const inN = document.getElementById('input-name');
        if(inN) inN.placeholder = isBould ? 'La Marie Rose' : (isMulti ? 'Vestpillaren' : (isIce ? 'Rjukanfossen' : 'Silence'));
        
        const inC = document.getElementById('input-crag');
        if(inC) inC.placeholder = isBould ? 'Sector, Crag 🇬🇷' : (isMulti ? 'Presten, Lofoten' : (isIce ? 'Rjukan' : 'Flatanger'));
        
        safeText('gradeLabel', isMulti ? 'Crux Grade' : 'Grade');

        const currentGyms = (dStr === 'Indoor Rope Climbing') ? AppConfig.gyms.filter(g => g !== 'Løkka' && g !== 'Bryn') : AppConfig.gyms;
        safeHTML('gymPicker', buildPills(currentGyms, State.activeGym, "App.haptic(); State.activeGym"));
        
        if (conf && conf.labels) {
            safeHTML('gradePicker', conf.labels.map((g, i) => {
                const isActive = String(g) === String(State.activeGrade.text);
                const color = (conf.colors && conf.colors[i]) ? conf.colors[i] : null;
                
                let dotHtml = '';
                if (color && dStr === 'Indoor Bouldering') {
                    const borderStr = (color === '#3f3f46' || color === '#121212' || color === '#000000') ? 'border: 1px solid rgba(255,255,255,0.4);' : '';
                    dotHtml = `<span class="boulder-dot" style="display:inline-block; width:10px; height:10px; border-radius:50%; background-color:${color}; margin-right:8px; ${borderStr}"></span>`;
                }

                return `<div class="pill ${isActive ? 'active' : ''}" data-val="${g}" onclick="App.haptic(); State.activeGrade={text:'${g}', score:${conf.scores[i]}};" style="transition: all 0.2s ease; display:flex; align-items:center; justify-content:center;">${dotHtml}${g}</div>`;
            }).join(''));
        }

        let styles = [];
        if (isMulti) {
            styles = [['topped', 'Topped Out'], ['allfree', 'All Free'], ['bailed', 'Bailed']];
        } else if (isRope || isTrad || isIce) {
            if (isOut) styles = [['project', 'Project'], ['quick', 'Send'], ['flash', 'Flash'], ['onsight', 'Onsight'], ['toprope', 'Top Rope'], ['worked', 'Worked']];
            else styles = [['project', 'Project'], ['quick', 'Send'], ['flash', 'Flash'], ['toprope', 'Top Rope'], ['autobelay', 'Auto Belay'], ['worked', 'Worked']];
        } else {
            styles = [['project', 'Project'], ['quick', 'Send'], ['flash', 'Flash'], ['worked', 'Worked']];
        }
        if (!styles.find(s => s[0] === State.activeStyle)) State.activeStyle = isMulti ? 'topped' : 'quick';
        
        safeHTML('styleSelector', styles.map(s => {
            return `<div class="pill ${State.activeStyle === s[0] ? 'active' : ''}" data-val="${s[0]}" onclick="App.haptic(); State.activeStyle='${s[0]}'; 
                if(['flash', 'onsight', 'toprope', 'autobelay'].includes('${s[0]}')){ State.activeBurns = 1; }
                else if('${s[0]}' === 'quick' && (State.activeBurns === 1 || State.activeBurns === '-')){ State.activeBurns = 2; }
                else if(['project', 'worked', 'topped', 'allfree', 'bailed'].includes('${s[0]}')){ State.activeBurns = '-'; }
            ">${s[1]}</div>`;
        }).join(''));

        safeHTML('gearStyleSelector', AppConfig.gearStyles.map(s => `<div class="pill ${State.activeGearStyle === s ? 'active' : ''}" data-val="${s}" onclick="App.haptic(); State.activeGearStyle='${s}';">${s}</div>`).join(''));
        safeHTML('packWeightSelector', AppConfig.packWeights.map(s => `<div class="pill ${State.activePackWeight === s ? 'active' : ''}" data-val="${s}" onclick="App.haptic(); State.activePackWeight='${s}';">${s}</div>`).join(''));
        safeHTML('rpeSelector', buildPills(AppConfig.rpes, State.activeRPE, "App.haptic(); State.activeRPE"));

        const steepLabel = document.querySelector('#steepnessSelector')?.previousElementSibling;
        if (steepLabel && steepLabel.tagName === 'LABEL') steepLabel.innerText = isIce ? 'Ice Features' : 'Steepness / Angle';
        
        const holdsLabel = document.querySelector('#holdsSelector')?.previousElementSibling;
        if (holdsLabel && holdsLabel.tagName === 'LABEL') holdsLabel.innerText = isIce ? 'Ice Conditions' : 'Holds / Grip';

        const steepArr = isIce ? AppConfig.iceFeatures : AppConfig.steepness;
        const holdArr = isIce ? AppConfig.iceConditions : AppConfig.holds;

        safeHTML('steepnessSelector', steepArr.map(s => `<div class="pill ${State.activeSteepness.includes(s) ? 'active' : ''}" data-val="${s}" onclick="App.toggleMulti('steepness', '${s}')">${s}</div>`).join(''));
        safeHTML('climbStyleSelector', AppConfig.climbStyles.map(s => `<div class="pill ${State.activeClimbStyles.includes(s) ? 'active' : ''}" data-val="${s}" onclick="App.toggleMulti('style', '${s}')">${s}</div>`).join(''));
        safeHTML('holdsSelector', holdArr.map(h => `<div class="pill ${State.activeHolds.includes(h) ? 'active' : ''}" data-val="${h}" onclick="App.toggleMulti('hold', '${h}')">${h}</div>`).join(''));

        App.renderPartnerPills();
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
        
        const gConf = getScaleConfig(State.discipline);
        document.querySelectorAll('#gradePicker .pill').forEach(p => {
            const val = p.getAttribute('data-val');
            const isActive = val === String(State.activeGrade.text);
            p.classList.toggle('active', isActive);
            
            const gIdx = gConf.labels ? gConf.labels.indexOf(val) : -1;
            const c = (gIdx > -1 && gConf.colors && gConf.colors[gIdx]) ? gConf.colors[gIdx] : null;
            
            if (c && State.discipline === 'Indoor Bouldering') {
                if (isActive) {
                    p.style.backgroundColor = `${c}15`; 
                    p.style.borderColor = c;
                    p.style.color = '#ffffff'; 
                    p.style.boxShadow = `0 0 12px ${c}40`;
                    p.style.transform = ''; 
                    p.style.fontWeight = '800';
                } else {
                    p.style.backgroundColor = ''; 
                    p.style.borderColor = 'transparent';
                    p.style.color = '#a3a3a3'; 
                    p.style.boxShadow = 'none';
                    p.style.transform = '';
                    p.style.fontWeight = '';
                }
            } else {
                p.style.backgroundColor = '';
                p.style.borderColor = '';
                p.style.color = '';
                p.style.boxShadow = '';
                p.style.transform = '';
                p.style.fontWeight = '';
            }
        });

        syncSingle('#styleSelector', State.activeStyle);
        syncSingle('#gearStyleSelector', State.activeGearStyle);
        syncSingle('#packWeightSelector', State.activePackWeight);
        syncSingle('#rpeSelector', State.activeRPE);
        syncMulti('#steepnessSelector', State.activeSteepness);
        syncMulti('#climbStyleSelector', State.activeClimbStyles);
        syncMulti('#holdsSelector', State.activeHolds);

        const isOut = State.discipline.includes('Outdoor');
        const isMulti = State.discipline === 'Outdoor Multipitch';
        const isTrad = State.discipline === 'Outdoor Trad Climbing';
        const isIce = State.discipline === 'Outdoor Ice Climbing';
        const isBould = State.discipline.includes('Boulder');

        const partnerCont = document.getElementById('partner-container');
        if (partnerCont) partnerCont.style.display = isBould ? 'none' : 'block';

        const ratingSec = document.getElementById('rating-section');
        const starParent = document.getElementById('starRating');
        if (ratingSec) ratingSec.style.display = isOut ? 'block' : 'none';
        else if (starParent && starParent.parentElement) starParent.parentElement.style.display = isOut ? 'block' : 'none';

        const mC = document.getElementById('multipitch-container');
        const bC = document.getElementById('burns-container');
        const hpC = document.getElementById('highPointContainer');
        
        if (isMulti) {
            if(mC) {
                mC.classList.remove('hidden');
                const pg = document.getElementById('pitch-grid');
                if (pg) {
                    pg.innerHTML = State.activePitches.map((p, i) => `
                        <div class="pitch-card">
                            <span class="pitch-lbl">P${i+1}</span>
                            <div class="pitch-toggle">
                                <button class="pitch-toggle-btn ${p.type === 'Lead' ? 'active' : ''}" onclick="App.updatePitchObj(${i}, 'type', 'Lead')">L</button>
                                <button class="pitch-toggle-btn ${p.type === 'Follow' ? 'active' : ''}" onclick="App.updatePitchObj(${i}, 'type', 'Follow')">F</button>
                            </div>
                            <button class="pitch-grade-btn" onclick="App.openPitchGradeModal(${i})">${p.grade} ▾</button>
                        </div>
                    `).join('');
                }
                const pV = document.getElementById('pitches-val');
                if (pV) pV.innerText = State.activePitches.length;
            }
            if(bC) bC.classList.add('hidden');
            if(hpC) hpC.classList.add('hidden');
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

        const showGearPack = (isMulti || isTrad || isIce);
        const gearSel = document.getElementById('gearStyleSelector');
        if (gearSel) {
            gearSel.style.display = showGearPack ? 'flex' : 'none';
            if(gearSel.previousElementSibling && gearSel.previousElementSibling.tagName === 'LABEL') gearSel.previousElementSibling.style.display = showGearPack ? 'block' : 'none';
        }
        const packSel = document.getElementById('packWeightSelector');
        if (packSel) {
            packSel.style.display = showGearPack ? 'flex' : 'none';
            if(packSel.previousElementSibling && packSel.previousElementSibling.tagName === 'LABEL') packSel.previousElementSibling.style.display = showGearPack ? 'block' : 'none';
        }

        const sR = document.getElementById('starRating');
        if (sR) {
            const stars = sR.children;
            for(let i=0; i<stars.length; i++) stars[i].className = i < State.activeRating ? 'active' : '';
        }
        
        App.updateDynamicRatingText(State.activeRating);
        App.validateForm();
    },

    toggleRow: (id, prefix) => {
        App.haptic();
        document.querySelectorAll('.table-row.expanded').forEach(r => {
            if (r.id !== `${prefix}-row-${id}`) {
                r.classList.remove('expanded');
                const d = document.getElementById(r.id.replace('row', 'details'));
                if (d) d.classList.remove('active');
            }
        });
        const row = document.getElementById(`${prefix}-row-${id}`);
        const details = document.getElementById(`${prefix}-details-${id}`);
        if (row && details) {
            row.classList.toggle('expanded');
            details.classList.toggle('active');
        }
    },

    renderJournal: () => {
        const jList = document.getElementById('journalList');
        if (!jList) return;
        if (State.sessions.length === 0) { jList.innerHTML = '<div class="empty-msg">No logs found.</div>'; return; }
        const visibleSessions = [...State.sessions].sort((a,b) => new Date(getCleanDate(b.Date)) - new Date(getCleanDate(a.Date))).slice(0, State.journalLimit);
        const climbsBySession = {};
        State.climbs.forEach(c => { if (!climbsBySession[c.SessionID]) climbsBySession[c.SessionID] = []; climbsBySession[c.SessionID].push(c); });

        const levelUpSessionId = localStorage.getItem('crag_levelup_session');

        let loadMoreBtn = '';
        if (State.sessions.length > State.journalLimit) {
            loadMoreBtn = `<button class="load-more-btn" onclick="App.haptic(); State.journalLimit += 5; App.renderJournal();" style="width: 100%; padding: 16px; margin-top: 16px; background: #1a1a1a; color: #fff; border: 1px solid #262626; border-radius: 12px; font-weight: 700; cursor: pointer; transition: 0.2s;">Load More Sessions ▾</button>`;
        }

        jList.innerHTML = visibleSessions.map(session => {
            const children = climbsBySession[session.SessionID] || [];
            children.sort((a,b) => Number(b.ClimbID) - Number(a.ClimbID));
            if(children.length === 0) return ''; 
            const dateInfo = getJournalDateObj(session.Date);
            
            const typeCounts = {};
            let majorityType = null;
            let maxCount = 0;
            [...children].reverse().forEach(c => {
                const t = c.Type;
                if (!t) return;
                typeCounts[t] = (typeCounts[t] || 0) + 1;
                if (typeCounts[t] > maxCount) {
                    maxCount = typeCounts[t];
                    majorityType = t;
                }
            });
            
            const bgColors = { 'Indoor Rope Climbing': '#10b981', 'Indoor Bouldering': '#3b82f6', 'Outdoor Rope Climbing': '#f97316', 'Outdoor Bouldering': '#a855f7', 'Outdoor Multipitch': '#ef4444', 'Outdoor Trad Climbing': '#d97706', 'Outdoor Ice Climbing': '#0ea5e9' };
            const sessionColor = majorityType ? bgColors[majorityType] : null;
            const cardBgStyle = sessionColor ? `background: linear-gradient(145deg, ${sessionColor}15, #101412);` : '';
            
            let maxSentStr = "-", maxColor = '#fff';
            const sends = children.filter(c => !['worked', 'toprope', 'autobelay', 'project', 'bailed'].includes(String(c.Style).toLowerCase()));
            const projects = children.filter(c => ['worked', 'toprope', 'autobelay', 'project', 'bailed'].includes(String(c.Style).toLowerCase()));
            
            if (sends.length > 0) {
                const maxSend = sends.reduce((max, cur) => Number(cur.Score) > Number(max.Score) ? cur : max);
                maxSentStr = getBaseGrade(maxSend.Grade);
                const sConf = getScaleConfig(maxSend.Type);
                if (maxSend.Type.includes('Bouldering') && sConf && sConf.colors) {
                    const mIdx = sConf.labels.indexOf(maxSentStr);
                    maxColor = sConf.colors[mIdx] || '#fff';
                } else if (maxSend.Type.includes('Rope') || maxSend.Type.includes('Multipitch') || maxSend.Type.includes('Trad')) {
                    maxColor = 'var(--primary)';
                } else if (maxSend.Type.includes('Ice')) {
                    maxColor = '#0ea5e9';
                }
            }

            let childrenHtml = `
            <div class="table-responsive" style="margin-top: 12px;">
                <table class="log-table">
                    <thead>
                        <tr>
                            <th class="col-date">Date</th>
                            <th class="col-route">Route / Gym</th>
                            <th class="col-grade">Grade</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            childrenHtml += children.map(l => {
                const rawGrade = String(l.Grade || "");
                const cleanGrade = getBaseGrade(rawGrade);
                const type = String(l.Type || "");
                const cleanStyleLower = String(l.Style || "").toLowerCase();
                const displayStyle = AppConfig.styles[cleanStyleLower] || (l.Style ? l.Style : 'Unknown'); 
                
                let dotColor = '#737373';
                if (type === 'Indoor Rope Climbing') dotColor = '#10b981';
                else if (type === 'Indoor Bouldering') dotColor = '#3b82f6';
                else if (type === 'Outdoor Rope Climbing') dotColor = '#f97316';
                else if (type === 'Outdoor Bouldering') dotColor = '#a855f7';
                else if (type === 'Outdoor Multipitch') dotColor = '#ef4444';
                else if (type === 'Outdoor Trad Climbing') dotColor = '#d97706';
                else if (type === 'Outdoor Ice Climbing') dotColor = '#0ea5e9';

                let textGradeColor = dotColor;
                if (type === 'Indoor Bouldering') {
                    const bConf = AppConfig.grades.bouldsIn;
                    const bIdx = bConf.labels.indexOf(cleanGrade);
                    if (bIdx > -1 && bConf.colors[bIdx]) {
                        textGradeColor = bConf.colors[bIdx];
                    }
                }
                const gradeStyle = `font-weight:900; color:${textGradeColor}; text-shadow: 0 0 8px ${textGradeColor}40;`;

                const discDot = `<span class="disc-dot" style="background-color: ${dotColor}; box-shadow: 0 0 8px ${dotColor}60;"></span>`;
                const cleanName = escapeHTML(l.Name ? l.Name.split('@')[0].trim() : "Unknown");
                const cleanNotes = escapeHTML(l.Notes);

                return `
                <tr class="table-row" id="journal-row-${l.ClimbID}" onclick="App.toggleRow('${l.ClimbID}', 'journal')" style="border-left: 3px solid ${dotColor};">
                    <td class="col-date" style="color:#a3a3a3; font-weight: 500;">${formatShortDate(l.cleanDate || l.Date)}</td>
                    <td class="col-route" style="font-weight:600; color:#e5e5e5; word-break: break-word;">${discDot}${cleanName}</td>
                    <td class="col-grade" style="${gradeStyle}">${cleanGrade}</td>
                </tr>
                <tr class="details-row" id="journal-details-${l.ClimbID}">
                    <td colspan="3" style="padding:0;">
                        <div class="details-content">
                            <div class="details-grid">
                                <div><div class="d-lbl">Style</div><div class="d-val">${displayStyle}</div></div>
                                ${type !== 'Outdoor Multipitch' ? `<div><div class="d-lbl">Burns</div><div class="d-val">${l.Burns || 1}</div></div>` : ''}
                                <div><div class="d-lbl">Rating</div><div class="d-val" style="color:#eab308;">${'★'.repeat(Number(l.Rating) || 0) || '-'}</div></div>
                                <div><div class="d-lbl">${type.includes('Ice') ? 'Ice Feature' : 'Angle'}</div><div class="d-val">${l.Angle || '-'}</div></div>
                                <div><div class="d-lbl">${type.includes('Ice') ? 'Ice Cond.' : 'Holds'}</div><div class="d-val">${l.Holds || '-'}</div></div>
                                <div><div class="d-lbl">Effort</div><div class="d-val">${l.Effort || '-'}</div></div>
                                ${l.Partner ? `<div><div class="d-lbl">Partner(s)</div><div class="d-val">${l.Partner}</div></div>` : ''}
                                ${l.Pitches ? `<div><div class="d-lbl">Pitches</div><div class="d-val">${l.Pitches}</div></div>` : ''}
                                ${l.GearStyle ? `<div><div class="d-lbl">Gear Style</div><div class="d-val">${l.GearStyle}</div></div>` : ''}
                                ${l.PackWeight ? `<div><div class="d-lbl">Pack Weight</div><div class="d-val">${l.PackWeight}</div></div>` : ''}
                                ${l.PitchBreakdown ? `<div class="d-notes" style="grid-column: 1 / -1;">Pitches: ${l.PitchBreakdown}</div>` : ''}
                            </div>
                            ${cleanNotes ? `<div class="d-notes">"${cleanNotes}"</div>` : ''}
                            <div class="log-actions">
                                <button class="log-edit-btn" onclick="App.editClimb('${l.ClimbID}')">Edit Entry</button>
                                <button class="log-del-btn" onclick="App.deleteClimb('${l.ClimbID}')">Delete</button>
                            </div>
                        </div>
                    </td>
                </tr>`;
            }).join('');

            childrenHtml += `</tbody></table></div>`;

            const isIndoorGym = AppConfig.gyms.includes(session.Location);
            
            let ribbonHtml = '';
            if (session.SessionID === levelUpSessionId) {
                ribbonHtml = `
                <div style="position: absolute; top: -5px; right: -5px; width: 60px; height: 60px; overflow: hidden; border-radius: 0 12px 0 0; z-index: 10;">
                    <div style="position: absolute; top: 13px; right: -25px; width: 90px; background: linear-gradient(135deg, #f59e0b, #fbbf24, #fcd34d); color: #451a03; font-size: 8px; font-weight: 900; text-align: center; padding: 4px 0; transform: rotate(45deg); box-shadow: 0 2px 10px rgba(245,158,11,0.4); text-transform: uppercase; letter-spacing: 0.5px;">Level Up</div>
                </div>`;
            }

            return `
            <div class="session-card" style="position: relative; ${cardBgStyle}">
                ${ribbonHtml}
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
        }).join('') + loadMoreBtn;
    },
    
    renderDashboard: () => { 
        App.renderDashboardCharts(); 
        App.renderDashboardLogs(); 
        
        // Header Gamification Icon Inject
        const mainTitles = document.querySelectorAll('h1, h2, .header-title, .page-title');
        mainTitles.forEach(t => {
            if (t.innerText.trim().includes('Dashboard') && !t.querySelector('.dash-icon')) {
                const originalText = t.innerText.trim();
                t.innerHTML = `${originalText} <svg class="dash-icon" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--primary, #10b981)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: text-bottom; margin-left: 8px;"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>`;
            }
        });
    },

    renderDashboardCharts: () => {
        const dStr = String(State.discipline || "");
        const conf = getScaleConfig(dStr);
        const viewLogs = State.climbs.filter(l => l && l.Type === dStr && !['worked', 'toprope', 'project', 'autobelay', 'bailed'].includes(String(l.Style).toLowerCase()));
        
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
            const cleanD = getCleanDate(l.Date);
            if (!cleanD) return;
            
            const d = new Date(cleanD);
            if (isNaN(d.getTime())) return;
            
            const monthKey = new Date(d.getFullYear(), d.getMonth(), 1).getTime();

            if (!grouped[monthKey]) grouped[monthKey] = [];
            grouped[monthKey].push(getChartScore(l));
        });

        const sortedMonths = Object.keys(grouped).sort((a,b) => Number(a) - Number(b)).slice(-12);
        
        const chartLabels = sortedMonths.map(ts => {
            const d = new Date(Number(ts));
            return `${AppConfig.months[d.getMonth()]} '${d.getFullYear().toString().slice(-2)}`; 
        });
        
        const chartData = sortedMonths.map(ts => {
            if (State.chartMode === 'max') return Math.max(...grouped[ts]);
            const sum = grouped[ts].reduce((a,b) => a+b, 0);
            return Math.round(sum / grouped[ts].length);
        });

        if (window.mainChart) window.mainChart.destroy();
        if (ctxCanvas) {
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
                        pointRadius: 5,
                        pointBorderColor: '#0a0a0a',
                        pointBorderWidth: 2,
                        fill: true,
                        tension: 0.35
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { 
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: 'rgba(10,10,10,0.9)',
                            titleColor: '#888',
                            bodyColor: '#fff',
                            bodyFont: { weight: 'bold', size: 14 },
                            padding: 12,
                            borderColor: '#262626',
                            borderWidth: 1,
                            callbacks: {
                                label: function(context) {
                                    if(!conf || !conf.scores) return ` ${context.raw} XP`;
                                    const closest = conf.scores.reduce((prev, curr) => Math.abs(curr - context.raw) < Math.abs(prev - context.raw) ? curr : prev);
                                    const idx = conf.scores.indexOf(closest);
                                    return ` ${conf.labels[idx]}`;
                                }
                            }
                        }
                    },
                    scales: {
                        x: { grid: { display: false, drawBorder: false }, ticks: { color: '#737373', font: { size: 10, weight: '600' } } },
                        y: { 
                            grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false }, 
                            beginAtZero: false,
                            ticks: { 
                                color: '#737373', 
                                font: { size: 10, weight: '700' },
                                maxTicksLimit: 6,
                                callback: function(value) {
                                    if(!conf || !conf.scores) return value;
                                    const closest = conf.scores.reduce((prev, curr) => Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev);
                                    const idx = conf.scores.indexOf(closest);
                                    return conf.labels[idx] || '';
                                }
                            } 
                        }
                    }
                }
            });
        }
    },

    renderDashboardLogs: () => {
        const dStr = String(State.discipline || ""), conf = getScaleConfig(dStr);
        const viewLogs = State.climbs.filter(l => l && l.Type === dStr && !['worked', 'toprope', 'project', 'autobelay', 'bailed'].includes(String(l.Style).toLowerCase())).map(l => ({ ...l, cleanDate: getCleanDate(l.Date) }));
        
        const lTT = document.getElementById('listToggleTop'); 
        if(lTT) lTT.className = `log-toggle-btn ${State.listMode === 'top10' ? 'active' : ''}`;
        
        const lTR = document.getElementById('listToggleRecent'); 
        if(lTR) lTR.className = `log-toggle-btn ${State.listMode === 'recent' ? 'active' : ''}`;
        
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
            }).sort((a,b) => getChartScore(b) - getChartScore(a)).slice(0, 10);
        } else {
            if(titleEl) titleEl.innerText = 'Recent Logs';
            displayLogs = viewLogs.sort((a,b) => Number(b.ClimbID) - Number(a.ClimbID)).slice(0, 10);
        }
        
        const xpCont = document.getElementById('xpContainer');
        if(xpCont) xpCont.classList.toggle('hidden', State.listMode !== 'top10' || displayLogs.length === 0);
        
        if (State.listMode === 'top10' && displayLogs.length > 0 && conf) {
            const avgS = Math.round(displayLogs.reduce((s, l) => s + getChartScore(l), 0) / displayLogs.length);
            const curIdx = conf.scores.indexOf(conf.scores.slice().reverse().find(s => s <= avgS) || conf.scores[0]);
            const nextIdx = Math.min(curIdx + 1, conf.scores.length - 1);
            const pct = Math.min(100, Math.max(0, ((avgS - conf.scores[curIdx]) / (conf.scores[nextIdx] - conf.scores[curIdx])) * 100)) || 0;

            const storedMaxIdx = parseInt(localStorage.getItem(`crag_max_idx_${dStr}`) || '-1');
            if (curIdx > storedMaxIdx) {
                localStorage.setItem(`crag_max_idx_${dStr}`, curIdx);
                const latestLog = displayLogs.sort((a,b) => new Date(b.cleanDate) - new Date(a.cleanDate))[0];
                if (latestLog) {
                    // localStorage.setItem('crag_levelup_session', latestLog.SessionID);
                }
            }

            const levelUpSessionId = localStorage.getItem('crag_levelup_session');
            let isLevelUpToday = false;
            if (levelUpSessionId) {
                const todayStr = getLocalISO();
                if (levelUpSessionId.includes(todayStr)) isLevelUpToday = true;
            }

            const topStatsGrid = document.getElementById('standard-stats-grid') || document.querySelector('.dashboard-grid');
            if (topStatsGrid && isLevelUpToday && !document.getElementById('dash-gold-ribbon')) {
                topStatsGrid.style.position = 'relative';
                topStatsGrid.insertAdjacentHTML('beforeend', `
                    <div id="dash-gold-ribbon" style="position: absolute; top: -15px; right: -15px; width: 80px; height: 80px; overflow: hidden; border-radius: 0 12px 0 0; z-index: 100; pointer-events: none;">
                        <div style="position: absolute; top: 18px; right: -28px; width: 120px; background: linear-gradient(135deg, #f59e0b, #fbbf24, #fcd34d); color: #451a03; font-size: 10px; font-weight: 900; text-align: center; padding: 5px 0; transform: rotate(45deg); box-shadow: 0 2px 15px rgba(245,158,11,0.5); text-transform: uppercase; letter-spacing: 1px;">Level Up</div>
                    </div>
                `);
            }
            
            let colorBase = 'var(--primary)';
            let colorNext = 'var(--primary)';
            if (dStr.includes('Bouldering') && conf.colors) {
                if (conf.colors[curIdx]) colorBase = conf.colors[curIdx];
                if (conf.colors[nextIdx]) colorNext = conf.colors[nextIdx];
            }

            const xpBG = document.getElementById('xpBaseGrade'); 
            if(xpBG) {
                xpBG.innerText = conf.labels[curIdx];
                xpBG.style.color = colorBase;
            }
            
            const xpNG = document.getElementById('xpNextGrade'); 
            if(xpNG) {
                xpNG.innerText = conf.labels[nextIdx];
                xpNG.style.color = colorNext;
            }

            const xpP = document.getElementById('xpPercent'); 
            if(xpP) xpP.innerText = `${Math.round(pct)}%`;
            
            const xpBF = document.getElementById('xpBarFill'); 
            if(xpBF) {
                xpBF.style.width = `${pct}%`;
                xpBF.style.background = `linear-gradient(90deg, ${colorBase}, ${colorNext})`;
                xpBF.style.boxShadow = `0 0 15px ${colorNext}60`; 
            }
        }

        const lList = document.getElementById('logList');
        if (!lList) return;
        if (displayLogs.length === 0) {
            lList.innerHTML = '<div class="empty-msg">No logs.</div>';
            return;
        }

        let tableHtml = `
        <div class="table-responsive">
            <table class="log-table">
                <thead>
                    <tr>
                        <th class="col-date">Date</th>
                        <th class="col-route">Route / Gym</th>
                        <th class="col-grade">Grade</th>
                    </tr>
                </thead>
                <tbody>
        `;

        tableHtml += displayLogs.map(l => {
            const cleanGrade = getBaseGrade(String(l.Grade || ""));
            const type = String(l.Type || "");
            const cleanStyleLower = String(l.Style || "").toLowerCase();
            const displayStyle = AppConfig.styles[cleanStyleLower] || (l.Style ? l.Style : 'Unknown'); 
            
            let dotColor = '#737373';
            if (type === 'Indoor Rope Climbing') dotColor = '#10b981';
            else if (type === 'Indoor Bouldering') dotColor = '#3b82f6';
            else if (type === 'Outdoor Rope Climbing') dotColor = '#f97316';
            else if (type === 'Outdoor Bouldering') dotColor = '#a855f7';
            else if (type === 'Outdoor Multipitch') dotColor = '#ef4444';
            else if (type === 'Outdoor Trad Climbing') dotColor = '#d97706';
            else if (type === 'Outdoor Ice Climbing') dotColor = '#0ea5e9';

            let textGradeColor = dotColor;
            if (type === 'Indoor Bouldering') {
                const bConf = AppConfig.grades.bouldsIn;
                const bIdx = bConf.labels.indexOf(cleanGrade);
                if (bIdx > -1 && bConf.colors[bIdx]) {
                    textGradeColor = bConf.colors[bIdx];
                }
            }
            const gradeStyle = `font-weight:900; color:${textGradeColor}; text-shadow: 0 0 8px ${textGradeColor}40;`;

            const discDot = `<span class="disc-dot" style="background-color: ${dotColor}; box-shadow: 0 0 8px ${dotColor}60;"></span>`;
            const cleanName = escapeHTML(l.Name ? l.Name.split('@')[0].trim() : "Unknown");
            const cleanNotes = escapeHTML(l.Notes);

            return `
            <tr class="table-row" id="dash-row-${l.ClimbID}" onclick="App.toggleRow('${l.ClimbID}', 'dash')"style="border-left: 3px solid ${dotColor};">
                <td class="col-date" style="color:#a3a3a3; font-weight: 500;">${formatShortDate(l.cleanDate)}</td>
                <td class="col-route" style="font-weight:600; color:#e5e5e5; word-break: break-word;">${discDot}${cleanName}</td>
                <td class="col-grade" style="${gradeStyle}">${cleanGrade}</td>
            </tr>
            <tr class="details-row" id="dash-details-${l.ClimbID}">
                <td colspan="3" style="padding:0;">
                    <div class="details-content">
                        <div class="details-grid">
                            <div><div class="d-lbl">Style</div><div class="d-val">${displayStyle}</div></div>
                            ${type !== 'Outdoor Multipitch' ? `<div><div class="d-lbl">Burns</div><div class="d-val">${l.Burns || 1}</div></div>` : ''}
                            <div><div class="d-lbl">Rating</div><div class="d-val" style="color:#eab308;">${'★'.repeat(Number(l.Rating) || 0) || '-'}</div></div>
                            <div><div class="d-lbl">${type.includes('Ice') ? 'Ice Feature' : 'Angle'}</div><div class="d-val">${l.Angle || '-'}</div></div>
                            <div><div class="d-lbl">${type.includes('Ice') ? 'Ice Cond.' : 'Holds'}</div><div class="d-val">${l.Holds || '-'}</div></div>
                            <div><div class="d-lbl">Effort</div><div class="d-val">${l.Effort || '-'}</div></div>
                            ${l.Partner ? `<div><div class="d-lbl">Partner(s)</div><div class="d-val">${l.Partner}</div></div>` : ''}
                            ${l.Pitches ? `<div><div class="d-lbl">Pitches</div><div class="d-val">${l.Pitches}</div></div>` : ''}
                            ${l.GearStyle ? `<div><div class="d-lbl">Gear Style</div><div class="d-val">${l.GearStyle}</div></div>` : ''}
                            ${l.PackWeight ? `<div><div class="d-lbl">Pack Weight</div><div class="d-val">${l.PackWeight}</div></div>` : ''}
                            ${l.PitchBreakdown ? `<div class="d-notes" style="grid-column: 1 / -1;">Pitches: ${l.PitchBreakdown}</div>` : ''}
                        </div>
                        ${cleanNotes ? `<div class="d-notes">"${cleanNotes}"</div>` : ''}
                        <div class="log-actions">
                            <button class="log-edit-btn" onclick="App.editClimb('${l.ClimbID}')">Edit Entry</button>
                            <button class="log-del-btn" onclick="App.deleteClimb('${l.ClimbID}')">Delete</button>
                        </div>
                    </div>
                </td>
            </tr>`;
        }).join('');

        tableHtml += `</tbody></table></div>`;
        lList.innerHTML = tableHtml;
    },
    
    logClimb: () => {
        App.haptic(); 
        const isOut = State.discipline.includes('Outdoor');
        const isBould = State.discipline.includes('Boulder');
        
        const inName = document.getElementById('input-name');
        const inCrag = document.getElementById('input-crag');
        
        const outN = inName ? inName.value.trim() : '';
        const outC = inCrag ? inCrag.value.trim() : '';
        if (isOut && (!outN || !outC)) return;
        
        App.isSaving = true; 
        if (isOut) localStorage.setItem('lastCrag', outC);

        const n = isOut ? `${outN} @ ${outC}` : State.activeGym;
        const climbDateStr = State.activeDate;
        let s = State.activeGrade.score;
        const g = State.activeGrade.text; 
        const isMulti = State.discipline === 'Outdoor Multipitch';
        
        if(['flash', 'allfree'].includes(State.activeStyle)) { s += State.discipline.includes('Rope') || isMulti || State.discipline.includes('Trad') || State.discipline.includes('Ice') ? 10 : 17; } 
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
        if (btn) {
            btn.disabled = true; 
            btn.innerText = 'Saving...';
        }
        
        const climb = { 
            ClimbID: App.editingClimbId ? App.editingClimbId : String(Date.now()), 
            SessionID: sessionID, Date: climbDateStr, Type: State.discipline, Name: n, Grade: g, Score: s, Style: State.activeStyle, 
            Burns: State.activeBurns === '-' ? '' : State.activeBurns, Angle: State.activeSteepness.join(', '), Effort: State.activeRPE,
            Rating: State.activeRating || "", Holds: State.activeHolds.join(', '), ClimStyles: State.activeClimbStyles.join(', '),
            Partner: isBould ? '' : (document.getElementById('input-partner') ? document.getElementById('input-partner').value.trim() : ''),
            Notes: document.getElementById('input-notes') ? document.getElementById('input-notes').value.trim() : '', _synced: false 
        };

        if (isMulti) {
            let totalScore = 0;
            State.activePitches.forEach(p => {
                let sConf = AppConfig.grades.ropesOut;
                let sIdx = sConf.labels.indexOf(p.grade);
                let pScore = sIdx > -1 ? sConf.scores[sIdx] : sConf.scores[0];
                if (p.type === 'Follow') pScore = Math.round(pScore * 0.8);
                totalScore += pScore;
            });
            climb.Score = totalScore;
            climb.Pitches = State.activePitches.length;
            climb.PitchBreakdown = State.activePitches.map(p => `${p.type === 'Lead' ? 'L' : 'F'}:${p.grade}`).join(', ');
            
            climb.GearStyle = State.activeGearStyle;
            climb.PackWeight = State.activePackWeight;
        } else {
            if (['worked', 'toprope', 'project'].includes(State.activeStyle)) {
                climb.HighPoint = State.activeHighPoint;
            }
            if (State.discipline.includes('Trad') || State.discipline.includes('Ice')) {
                climb.GearStyle = State.activeGearStyle;
                climb.PackWeight = State.activePackWeight;
            }
        }
        
        const inNotes = document.getElementById('input-notes');
        if (inNotes) inNotes.value = '';
        if (isOut && inName) inName.value = '';
        
        const inPart = document.getElementById('input-partner');
        if (inPart) inPart.value = '';
        
        if (App.editingClimbId) {
            State.climbs = State.climbs.map(c => String(c.ClimbID) === String(App.editingClimbId) ? climb : c);
        } else {
            State.climbs = [climb, ...State.climbs]; 
        }

        SyncManager.pushAll(State.sessions.filter(ses => !ses._synced), [climb]); 
        
        State.activeRating = 0; State.activeClimbStyles = []; State.activeHolds = []; State.activeSteepness = []; 
        State.activeBurns = ['flash', 'onsight', 'toprope', 'autobelay', 'allfree'].includes(State.activeStyle) ? 1 : (['quick', 'topped'].includes(State.activeStyle) ? 2 : '-');
        State.activeHighPoint = 50;
        State.activeGearStyle = '';
        State.activePackWeight = '';
        State.activePitches = [{type: 'Lead', grade: State.activeGrade.text}, {type: 'Lead', grade: State.activeGrade.text}];
        
        setTimeout(() => {
            if (btn) {
                btn.innerHTML = App.editingClimbId ? '✓ Updated!' : '✓ Saved!';
                if (App.editingClimbId) {
                    App.editingClimbId = null;
                    btn.style.background = 'var(--primary)';
                    btn.style.color = '#000';
                }
            }
            if (navigator.vibrate) navigator.vibrate([30, 50, 30]); 
            
            setTimeout(() => { 
                App.isSaving = false; 
                App.validateForm(); 
                App.renderPartnerPills(); 
            }, 2000);
        }, 400); 
    }
};
App.init();
