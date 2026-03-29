if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW Registration failed:', err)));
}

const API_URL = "https://script.google.com/macros/s/AKfycbwMh-T7DB7S06_8DB2GC4dniByVHrRSqbODdLRhjciDOXSDL-V4_vzQtRXee2Wmqp9L/exec";

// ==========================================
// 1. CONSTANTS
// ==========================================
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
const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DISCIPLINES = ['Indoor Rope Climbing', 'Indoor Bouldering', 'Outdoor Rope Climbing', 'Outdoor Bouldering'];
const DISC_LABELS = ['In Rope', 'In Boulder', 'Out Rope', 'Out Boulder'];
const STYLE_MAP = { 'project': 'Project', 'quick': 'Quick Send', 'flash': 'Flash', 'onsight': 'Onsight' };

const STEEPNESS = ['Slab', 'Vertical', 'Overhang', 'Roof'];
const CLIMB_STYLES = ['Endurance', 'Cruxy', 'Technical', 'Athletic'];
const HOLDS = ['Crimps', 'Slopers', 'Pockets', 'Pinches', 'Tufas', 'Jugs'];
const RPES = ['Breezy', 'Solid', 'Limit'];

// ==========================================
// 2. THE BRAIN (Math & Logic Only - NO HTML)
// ==========================================
const Brain = {
    getLocalISO: (d = new Date()) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().substring(0, 10),
    
    cleanGrade: (g) => String(g || "").replace(/[⚡💎🚀🛠️\s]/g, ''),
    
    getScaleConfig: (disc) => {
        if (disc === 'Indoor Bouldering') return { labels: GRADES.bouldsIn, scores: GRADES.bouldsInScores, colors: GRADES.bouldsInColors, isRope: false };
        if (disc === 'Outdoor Bouldering') return { labels: GRADES.bouldsOut, scores: GRADES.bouldsOutScores, colors: [], isRope: false };
        return { labels: GRADES.ropes, scores: GRADES.ropeScores, colors: [], isRope: true };
    },

    formatDisplayGrade: (rawGrade, isRope) => {
        const clean = Brain.cleanGrade(rawGrade);
        if (!isRope) return clean; 
        let final = clean;
        if (rawGrade.includes('⚡')) final += ' ⚡';
        if (rawGrade.includes('💎') || rawGrade.includes('👁️')) final += ' 💎';
        if (rawGrade.includes('🚀')) final += ' 🚀';
        if (rawGrade.includes('🛠️')) final += ' 🛠️';
        return final;
    },

    calcWorkingCapacity: (logs, conf) => {
        if (!logs || logs.length === 0) return null;
        const avgScore = Math.round(logs.reduce((sum, l) => sum + l.score, 0) / logs.length);
        const currentIdx = conf.scores.indexOf(conf.scores.slice().reverse().find(s => s <= avgScore) || conf.scores[0]);
        const nextIdx = Math.min(currentIdx + 1, conf.scores.length - 1);
        const currentBaseScore = conf.scores[currentIdx];
        const nextScore = conf.scores[nextIdx];
        
        let percent = 0;
        if (nextScore > currentBaseScore) {
            percent = Math.min(100, Math.max(0, ((avgScore - currentBaseScore) / (nextScore - currentBaseScore)) * 100));
        } else if (avgScore >= conf.scores[conf.scores.length - 1]) {
            percent = 100;
        }
        
        return {
            baseGrade: conf.labels[currentIdx],
            nextGrade: conf.labels[nextIdx],
            percent: Math.round(percent)
        };
    },

    generateChartData: (logs, chartMode, conf, isRope) => {
        const cD = { rp: [], fl: [], rpG: [], flG: [], avg: [], avgG: [], lbl: [] };
        const getScoreIndex = (s, isF) => { 
            let b = s - (isF ? (isRope ? 10 : 17) : 0); 
            return conf.scores.indexOf(conf.scores.reduce((p, c) => Math.abs(c-b) < Math.abs(p-b) ? c : p)); 
        };
        
        const logsByMonth = {};
        logs.forEach(l => {
            if (!l.score) return;
            const m = l.cleanDate.substring(0,7);
            if (!logsByMonth[m]) logsByMonth[m] = [];
            logsByMonth[m].push(l);
        });

        const allM = Object.keys(logsByMonth).sort();
        
        allM.forEach(m => {
            const [y, mo] = m.split('-').map(Number);
            const monthLogs = logsByMonth[m] || [];

            if (chartMode === 'max') {
                const rpL = monthLogs.filter(l => !String(l.grade||"").includes('⚡') && !String(l.grade||"").includes('💎') && !String(l.grade||"").includes('👁️'));
                const flL = monthLogs.filter(l => String(l.grade||"").includes('⚡') || String(l.grade||"").includes('💎') || String(l.grade||"").includes('👁️'));
                
                let maxRp = rpL.length ? rpL.reduce((max, cur) => cur.score > max.score ? cur : max) : null;
                let maxFl = flL.length ? flL.reduce((max, cur) => cur.score > max.score ? cur : max) : null;

                cD.rp.push(maxRp ? getScoreIndex(maxRp.score, false) : null);
                cD.rpG.push(maxRp ? maxRp.grade : "None");
                cD.fl.push(maxFl ? getScoreIndex(maxFl.score, true) : null);
                cD.flG.push(maxFl ? maxFl.grade : "None");
            } else {
                let pM = mo-1, pY = y; if (pM === 0) { pM = 12; pY = y-1; }
                const pMS = `${pY}-${pM.toString().padStart(2, '0')}`;
                
                const prevMonthLogs = logsByMonth[pMS] || [];
                const combinedLogs = [...monthLogs, ...prevMonthLogs].sort((a,b) => b.score - a.score).slice(0, 10);
                
                if (combinedLogs.length > 0) { 
                    const avS = Math.round(combinedLogs.reduce((s, l) => s + l.score, 0) / combinedLogs.length);
                    const avI = conf.scores.indexOf(conf.scores.reduce((p, c) => Math.abs(c-avS) < Math.abs(p-avS) ? c : p)); 
                    cD.avg.push(avI); cD.avgG.push(conf.labels[avI]); 
                } else { 
                    cD.avg.push(null); cD.avgG.push("None"); 
                }
            }
            cD.lbl.push(`${monthNames[mo-1]} '${y.toString().slice(-2)}`);
        });

        const aI = [...cD.rp.filter(x=>x!==null), ...cD.fl.filter(x=>x!==null), ...cD.avg.filter(x=>x!==null)];
        const yMin = Math.max(0, Math.min(...aI)-1);
        const yMax = Math.min(conf.labels.length-1, Math.max(...aI)+1);

        return { data: cD, yMin, yMax };
    }
};

// ==========================================
// 3. THE PAINTBRUSH (DOM Rendering Only)
// ==========================================
const Paintbrush = {
    chartInstance: null,

    buildPills: (arr, activeVal, clickAction) => arr.map(item => `<div class="pill ${item === activeVal ? 'active' : ''}" onclick="${clickAction}='${item}';">${item}</div>`).join(''),

    drawForm: (state) => {
        const dStr = String(state.discipline || "");
        const isOut = dStr.includes('Outdoor'), isRope = dStr.includes('Rope'), isBould = dStr.includes('Boulder');
        const conf = Brain.getScaleConfig(dStr);

        document.getElementById('typeSelector').innerHTML = DISCIPLINES.map((d, i) => `<div class="pill ${dStr === d ? 'active' : ''}" onclick="App.haptic(); State.discipline='${d}'">${DISC_LABELS[i]}</div>`).join('');
        document.getElementById('dashSelector').innerHTML = DISCIPLINES.map((d, i) => `<div class="pill ${dStr === d ? 'active' : ''}" onclick="App.haptic(); State.discipline='${d}'">${DISC_LABELS[i]}</div>`).join('');
        
        document.getElementById('input-outdoor').className = isOut ? '' : 'hidden';
        document.getElementById('input-indoor').className = isOut ? 'hidden' : '';
        document.getElementById('input-name').placeholder = isBould ? 'La Marie Rose' : 'Silence';
        document.getElementById('input-crag').placeholder = isBould ? 'Sector, Crag 🇬🇷' : 'Flatanger';

        const currentGyms = (dStr === 'Indoor Rope Climbing') ? GYMS.filter(g => g !== 'Løkka' && g !== 'Bryn') : GYMS;
        document.getElementById('gymPicker').innerHTML = Paintbrush.buildPills(currentGyms, state.activeGym, "App.haptic(); State.activeGym");
        
        document.getElementById('gradePicker').innerHTML = conf.labels.map((g, i) => {
            const dot = conf.colors[i] ? `<span class="boulder-dot" style="background:${conf.colors[i]};"></span>` : '';
            const isActive = String(g).toLowerCase() === String(state.activeGrade.text).toLowerCase();
            return `<div class="pill ${isActive ? 'active' : ''}" onclick="App.haptic(); State.activeGrade={text:'${g}', score:${conf.scores[i]}};">${dot}${g}</div>`;
        }).join('');

        const styles = (isOut && isRope) ? [['project', 'Project'], ['quick', 'Quick Send'], ['flash', 'Flash'], ['onsight', 'Onsight']] : [['project', 'Project'], ['quick', 'Quick Send'], ['flash', 'Flash']];
        document.getElementById('styleSelector').innerHTML = styles.map(s => `<div class="pill ${state.activeStyle === s[0] ? 'active' : ''}" onclick="App.haptic(); State.activeStyle='${s[0]}';">${s[1]}</div>`).join('');
        
        ['morn', 'aft', 'eve'].forEach(id => {
            const val = document.getElementById(`time-${id}`).innerText;
            document.getElementById(`time-${id}`).className = `pill ${state.activeTimeBucket === val ? 'active' : ''}`;
        });

        document.getElementById('rpeSelector').innerHTML = Paintbrush.buildPills(RPES, state.activeRPE, "App.haptic(); State.activeRPE");
        document.getElementById('steepnessSelector').innerHTML = STEEPNESS.map(s => `<div class="pill ${state.activeSteepness.includes(s) ? 'active' : ''}" onclick="App.toggleMulti('steepness', '${s}')">${s}</div>`).join('');
        document.getElementById('climbStyleSelector').innerHTML = CLIMB_STYLES.map(s => `<div class="pill ${state.activeClimbStyles.includes(s) ? 'active' : ''}" onclick="App.toggleMulti('style', '${s}')">${s}</div>`).join('');
        document.getElementById('holdsSelector').innerHTML = HOLDS.map(h => `<div class="pill ${state.activeHolds.includes(h) ? 'active' : ''}" onclick="App.toggleMulti('hold', '${h}')">${h}</div>`).join('');
        
        document.getElementById('feel-soft').className = `pill ${state.activeGradeFeel === 'Soft' ? 'active' : ''}`;
        document.getElementById('feel-hard').className = `pill ${state.activeGradeFeel === 'Hard' ? 'active' : ''}`;
        
        const stars = document.getElementById('starRating').children;
        for(let i=0; i<stars.length; i++) stars[i].className = i < state.activeRating ? 'active' : '';

        document.getElementById('chartToggle').innerHTML = `<div class="chart-toggle-btn ${state.chartMode === 'max' ? 'active' : ''}" onclick="App.haptic(); State.chartMode='max';">Max Peak</div><div class="chart-toggle-btn ${state.chartMode === 'avg' ? 'active' : ''}" onclick="App.haptic(); State.chartMode='avg';">Avg (Top 10)</div>`;
        
        setTimeout(() => App.centerActivePills(), 10);
    },

    drawDashboard: (state) => {
        const conf = Brain.getScaleConfig(state.discipline);
        const viewLogs = state.logs.filter(l => l && l.type === state.discipline).map(l => ({ ...l, cleanDate: (l.date ? String(l.date).substring(0,10) : Brain.getLocalISO()) }));
        
        document.getElementById('listToggleTop').className = `log-toggle-btn ${state.listMode === 'top10' ? 'active' : ''}`;
        document.getElementById('listToggleRecent').className = `log-toggle-btn ${state.listMode === 'recent' ? 'active' : ''}`;

        // Dynamic Header Magic
        const headerEl = document.getElementById('logHeader');
        if (headerEl) {
            headerEl.innerText = state.listMode === 'top10' ? 'Last 60 Days' : 'Recent Logs';
        }

        let displayLogs = [];
        const xpC = document.getElementById('xpContainer');
        
        if (state.listMode === 'top10') {
            const sixtyDaysAgo = new Date(new Date().getTime() - (60 * 24 * 60 * 60 * 1000));
            const recent60 = viewLogs.filter(l => new Date(l.date) >= sixtyDaysAgo);
            displayLogs = recent60.sort((a,b) => b.score - a.score).slice(0, 10);
            
            const xpData = Brain.calcWorkingCapacity(displayLogs, conf);
            if (xpData) {
                xpC.classList.remove('hidden');
                document.getElementById('xpBaseGrade').innerText = xpData.baseGrade;
                document.getElementById('xpNextGrade').innerText = xpData.nextGrade;
                document.getElementById('xpPercent').innerText = `${xpData.percent}%`;
                setTimeout(() => { document.getElementById('xpBarFill').style.width = `${xpData.percent}%`; }, 100);
            } else {
                xpC.classList.add('hidden');
            }
        } else {
            displayLogs = [...viewLogs].sort((a,b) => Number(b.id) - Number(a.id)).slice(0, 10);
            xpC.classList.add('hidden');
        }
        
        document.getElementById('logList').innerHTML = displayLogs.length === 0 ? '<div style="text-align:center; padding:20px; color:var(--text-muted);">No logs found.</div>' : displayLogs.map(l => {
            const d = l.cleanDate.split('-'); 
            const formattedDate = `${d[2]} ${monthNames[parseInt(d[1], 10) - 1]}`;
            const rawGrade = String(l.grade || "");
            const finalDisplayGrade = Brain.formatDisplayGrade(rawGrade, conf.isRope);
            
            let badge = '';
            let inlineColor = '';
            if (!conf.isRope) {
                const idx = GRADES.bouldsIn.indexOf(Brain.cleanGrade(rawGrade));
                if (idx > -1) {
                    badge = `<span class="boulder-dot" style="background:${GRADES.bouldsInColors[idx]};"></span>`;
                    inlineColor = `color: ${GRADES.bouldsInColors[idx]} !important;`;
                }
            }

            const syncWarning = l._synced === false ? `<span style="color: #ef4444; font-size: 0.7rem; margin-left: 6px;">☁️✕</span>` : '';
            const delBtn = `<button class="log-del" onclick="App.deleteLog('${l.id}')">×</button>`;
            
            let logName = l.name || "Log";
            let cragHTML = '';
            if (logName.includes(' @ ')) {
                const parts = logName.split(' @ ');
                logName = parts[0];
                cragHTML = `<div class="log-crag">📍 ${parts[1]}</div>`;
            }
            
            const subItems = [];
            if (l.angle) subItems.push(String(l.angle));
            if (l.style && STYLE_MAP[l.style]) subItems.push(STYLE_MAP[l.style]);
            const discSpan = subItems.length ? `<div class="log-disc">${subItems.join(' • ').toUpperCase()}</div>` : '';
            
            return `<div class="log-item"><div class="log-date">${formattedDate}</div><div class="log-info"><div class="log-name">${logName}${syncWarning}</div>${cragHTML}${discSpan}</div><div class="log-grade ${(rawGrade.includes('⚡')||rawGrade.includes('💎')) ? 'fl' : 'rp'}" style="${inlineColor}">${badge}${finalDisplayGrade}</div>${delBtn}</div>`;
        }).join('');
        
        const noD = document.getElementById('noDataMsg');
        const ctxCanvas = document.getElementById('progressChart');
        if (!window.Chart) { ctxCanvas.style.display = 'none'; noD.style.display = 'block'; noD.innerText = "Charts unavailable without connection."; return; }

        if(Paintbrush.chartInstance) Paintbrush.chartInstance.destroy();
        const ctx = ctxCanvas.getContext('2d');
        if (viewLogs.length === 0) { ctxCanvas.style.display = 'none'; noD.style.display = 'block'; noD.innerText = "Log climbs to view progression"; return; }
        ctxCanvas.style.display = 'block'; noD.style.display = 'none';

        const chartInfo = Brain.generateChartData(viewLogs, state.chartMode, conf, conf.isRope);
        let dSet = [], toolC;
        
        if (state.chartMode === 'max') {
            let g = ctx.createLinearGradient(0, 0, 0, 300); g.addColorStop(0, 'rgba(16, 185, 129, 0.25)'); g.addColorStop(1, 'transparent');
            dSet = [
                { label: 'Max Redpoint', data: chartInfo.data.rp, borderColor: '#10b981', backgroundColor: g, tension: 0.4, fill: true, pointRadius: 5, pointBackgroundColor: '#10b981', spanGaps: true }, 
                { label: 'Flash/Onsight', data: chartInfo.data.fl, borderColor: '#db2777', borderDash: [5,5], tension: 0.4, fill: false, pointRadius: 5, pointBackgroundColor: '#db2777', spanGaps: true }
            ];
            toolC = c => c.datasetIndex === 0 ? ` Redpoint: ${chartInfo.data.rpG[c.dataIndex]}` : ` Flash: ${chartInfo.data.flG[c.dataIndex]}`;
        } else {
            let gA = ctx.createLinearGradient(0, 0, 0, 300); gA.addColorStop(0, 'rgba(59, 130, 246, 0.35)'); gA.addColorStop(1, 'transparent');
            dSet = [{ label: 'Top 10 Average', data: chartInfo.data.avg, borderColor: '#3b82f6', backgroundColor: gA, tension: 0.4, fill: true, pointRadius: 6, pointBackgroundColor: '#3b82f6', spanGaps: true }];
            toolC = c => ` Power Avg: ${chartInfo.data.avgG[c.dataIndex]}`;
        }

        Paintbrush.chartInstance = new Chart(ctx, { 
            type: 'line', 
            data: { labels: chartInfo.data.lbl, datasets: dSet }, 
            options: { 
                responsive: true, maintainAspectRatio: false, 
                plugins: { legend: { display: false }, tooltip: { callbacks: { label: toolC } } }, 
                scales: { 
                    y: { min: chartInfo.yMin, max: chartInfo.yMax, ticks: { stepSize: 1, callback: v => conf.labels[v] } }, 
                    x: { grid: { display: false } } 
                } 
            } 
        });
    }
};

// ==========================================
// 4. DATA & SYNC MANAGERS
// ==========================================
let deletedLogs = JSON.parse(localStorage.getItem('deletedLogs') || '[]');
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
    activeStyle: 'project', activeDate: Brain.getLocalISO(), activeGym: 'OKS', chartMode: 'max', listMode: 'top10',
    activeRPE: 'Solid', activeGradeFeel: '', activeRating: 0, activeSteepness: [], activeClimbStyles: [], activeHolds: [],
    activeTimeBucket: '', logs: safeLogs
}, {
    set(target, prop, value) {
        if (prop === 'discipline' && target.discipline !== value) {
            target.discipline = value;
            const conf = Brain.getScaleConfig(value);
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
            ['log', 'dash'].forEach(v => {
                const isActive = target.view === v;
                document.getElementById(`view-${v}`).classList.toggle('active', isActive);
                document.getElementById(`nav-${v}`).classList.toggle('active', isActive);
            });
            setTimeout(() => App.centerActivePills(), 50); 
        }
        
        if (['discipline', 'view', 'activeGym', 'activeStyle', 'activeGrade', 'activeRPE', 'activeGradeFeel', 'activeRating', 'activeSteepness', 'activeClimbStyles', 'activeHolds', 'activeTimeBucket'].includes(prop)) {
            Paintbrush.drawForm(target);
        }
        if (['discipline', 'view', 'chartMode', 'listMode'].includes(prop)) {
            if (target.view === 'dash') Paintbrush.drawDashboard(target);
        }
        
        if (prop === 'logs') {
            localStorage.setItem('climbLogs', JSON.stringify(value));
            if (target.view === 'dash') Paintbrush.drawDashboard(target);
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
            const cloudIds = new Set(data.map(d => String(d.id)));
            const pendingLocals = State.logs.filter(l => l && (!cloudIds.has(String(l.id)) || l._synced === false));
            
            pendingLocals.forEach(localLog => SyncManager.push(localLog));

            const cleanData = data.filter(d => !deletedLogs.includes(String(d.id))).map(d => ({ ...d, id: String(d.id), _synced: true }));
            const localOnly = State.logs.filter(l => l && !cloudIds.has(String(l.id)));
            
            const uniqueLogs = Array.from(new Map([...cleanData, ...localOnly].map(item => [String(item.id), item])).values());
            State.logs = uniqueLogs.sort((a,b) => Number(b.id) - Number(a.id));
            b.forEach(i => i.classList.remove('syncing'));
        }).catch(() => b.forEach(i => i.classList.remove('syncing')));
    },
    push: async (payload) => { 
        if (!navigator.onLine) return;
        try {
            const response = await fetch(API_URL, { method: 'POST', body: JSON.stringify(payload) });
            const result = await response.json();
            
            if (result.status === 'success' || result.status === 'deleted') {
                State.logs = State.logs.map(l => String(l.id) === String(payload.id) ? { ...l, _synced: true } : l);
            }
        } catch (error) {}
    }
};

const App = {
    init: () => {
        if (window.Chart) { Chart.defaults.color = '#737373'; Chart.defaults.borderColor = '#262626'; }
        try { Paintbrush.drawForm(State); } catch (e) { console.error("Render failed", e); }
        SyncManager.trigger(); 
        window.addEventListener('online', SyncManager.trigger);
    },
    haptic: () => { if (navigator.vibrate) navigator.vibrate(40); },
    toast: (msg) => {
        const t = document.getElementById('toast');
        if(t) { t.innerText = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2500); }
    },
    deleteLog: (id) => { 
        App.haptic(); 
        if(confirm('Delete this log?')) { 
            deletedLogs.push(String(id));
            localStorage.setItem('deletedLogs', JSON.stringify(deletedLogs));
            State.logs = State.logs.filter(l => String(l.id) !== String(id)); 
            SyncManager.push({ id: String(id), action: "delete" }); 
            App.toast("Deleted"); 
        } 
    },
    setDate: (type, val = null) => {
        App.haptic();
        document.querySelectorAll('#datePicker .pill').forEach(p => p.classList.remove('active'));
        if (type === 'today') { State.activeDate = Brain.getLocalISO(); document.getElementById('pill-today').classList.add('active'); }
        else if (type === 'yesterday') { let yest = new Date(); yest.setDate(yest.getDate()-1); State.activeDate = Brain.getLocalISO(yest); document.getElementById('pill-yest').classList.add('active'); }
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
    logClimb: () => {
        App.haptic(); 
        
        const now = new Date();
        const hours = now.getHours();
        const autoTime = hours < 12 ? 'Morning' : hours < 17 ? 'Afternoon' : 'Evening';
        const finalTime = State.activeTimeBucket || autoTime;
        
        const climbDateObj = new Date(State.activeDate);
        const finalDay = dayNames[climbDateObj.getDay()];

        let s = State.activeGrade.score, g = State.activeGrade.text;
        if(State.activeStyle === 'flash') { s += State.discipline.includes('Rope') ? 10 : 17; g += " ⚡"; } 
        else if (State.activeStyle === 'onsight') { s += 10; g += " 💎"; }
        else if (State.activeStyle === 'quick') { g += " 🚀"; }
        else if (State.activeStyle === 'project') { g += " 🛠️"; }
        
        const outName = document.getElementById('input-name').value.trim();
        const outCrag = document.getElementById('input-crag').value.trim();
        
        if (State.discipline.includes('Outdoor') && outCrag) localStorage.setItem('lastCrag', outCrag);
        const n = State.discipline.includes('Outdoor') ? `${outName} @ ${outCrag}` : State.activeGym;
        if (State.discipline.includes('Outdoor') && (!outName || !outCrag)) { App.toast("Fill info"); return; }
        
        const btn = document.querySelector('.btn-main');
        btn.disabled = true;
        btn.innerText = 'Saving...';
        
        const l = { 
            id: String(Date.now()), 
            date: State.activeDate, 
            day: finalDay,
            timeofday: finalTime,
            type: State.discipline, 
            name: n,
            grade: g, 
            score: s, 
            angle: State.activeSteepness.join(', '), 
            style: State.activeStyle, 
            effort: State.activeRPE,
            gradefeel: State.activeGradeFeel,
            rating: State.activeRating > 0 ? State.activeRating : "",
            holds: State.activeHolds.join(', '),
            climstyles: State.activeClimbStyles.join(', '),
            notes: document.getElementById('input-notes').value.trim(),
            action: 'add', 
            _synced: false 
        };
        
        State.logs = [l, ...State.logs]; 
        SyncManager.push(l); 
        
        if (State.discipline.includes('Outdoor')) document.getElementById('input-name').value = ''; 
        document.getElementById('input-notes').value = '';
        State.activeRating = 0; State.activeGradeFeel = ''; State.activeClimbStyles = []; State.activeHolds = []; State.activeSteepness = []; State.activeTimeBucket = '';
        
        setTimeout(() => {
            btn.innerHTML = '✓ Saved!';
            if (navigator.vibrate) navigator.vibrate([30, 50, 30]); 
            setTimeout(() => { btn.innerHTML = 'Save to Cloud'; btn.disabled = false; }, 2000);
        }, 400); 
    }
};

App.init();
