// Register the Service Worker for Offline PWA support
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW Registration failed:', err)));
}

// Hardcoded Master Google Script URL - BRAND NEW DEPLOYMENT
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

// --- HELPER FUNCTIONS ---
const getBaseGrade = (g) => String(g || "").replace(/[⚡👁️🚀🛠️\s]/g, '');
const getLocalISO = (d = new Date()) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().substring(0, 10);

const getScaleConfig = (disc) => {
    const isRope = String(disc || "").includes('Rope');
    const angles = isRope ? ['Slab', 'Vert', 'Overhang', 'Tech', 'Endurance'] : ['Slab', 'Vert', 'Overhang', 'Roof', 'Dynamic'];
    if (disc === 'Indoor Bouldering') return { labels: GRADES.bouldsIn, scores: GRADES.bouldsInScores, colors: GRADES.bouldsInColors, angles };
    if (disc === 'Outdoor Bouldering') return { labels: GRADES.bouldsOut, scores: GRADES.bouldsOutScores, colors: [], angles };
    return { labels: GRADES.ropes, scores: GRADES.ropeScores, colors: [], angles };
};

const getBadge = (type, gradeText) => {
    if (type !== 'Indoor Bouldering') return '';
    const idx = GRADES.bouldsIn.indexOf(getBaseGrade(gradeText));
    return idx > -1 ? `<span class="boulder-dot" style="background:${GRADES.bouldsInColors[idx]};"></span>` : '';
};

// --- SELF-HEALING MEMORY ---
let safeLogs = [];
try {
    const rawLogs = localStorage.getItem('climbLogs');
    if (rawLogs) safeLogs = JSON.parse(rawLogs);
    if (!Array.isArray(safeLogs)) safeLogs = [];
} catch (e) {
    console.error("Corrupted local logs detected. Wiping clean.", e);
    safeLogs = [];
    localStorage.removeItem('climbLogs');
}

const State = new Proxy({
    view: 'log', discipline: 'Indoor Rope Climbing', activeGrade: { text: '6b', score: 633 },
    activeStyle: 'project', activeDate: getLocalISO(), activeGym: 'OKS', chartMode: 'max',
    activeAngle: 'Vert', listMode: 'top10',
    logs: safeLogs
}, {
    set(target, prop, value) {
        if (prop === 'discipline' && target.discipline !== value) {
            target.discipline = value;
            const conf = getScaleConfig(value);
            if (!conf.labels.some(g => String(g).toLowerCase() === String(target.activeGrade.text).toLowerCase())) {
                target.activeGrade = { text: conf.labels[0], score: conf.scores[0] };
            }
            if (!conf.angles.includes(target.activeAngle)) target.activeAngle = 'Vert';
            
            // Failsafe: Prevent bouldering gyms from staying active on Rope tab
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
        }
        
        if (['discipline', 'view', 'activeGym', 'activeStyle', 'chartMode', 'activeAngle', 'activeGrade', 'listMode'].includes(prop)) {
            App.renderUI();
        }
        
        if (prop === 'logs') {
            localStorage.setItem('climbLogs', JSON.stringify(value));
            if (target.view === 'dash') App.renderDashboard();
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

            const cleanData = data.map(d => ({ ...d, id: String(d.id), _synced: true }));
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
        } catch (error) { console.log("Sync delay:", error); }
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
    deleteLog: (id) => { 
        App.haptic(); 
        if(confirm('Delete this log?')) { 
            State.logs = State.logs.filter(l => String(l.id) !== String(id)); 
            SyncManager.push({ id: String(id), action: "delete" }); 
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
    renderUI: () => {
        const dStr = String(State.discipline || "");
        const isOut = dStr.includes('Outdoor'), isRope = dStr.includes('Rope'), isBould = dStr.includes('Boulder');
        const conf = getScaleConfig(dStr);

        const buildPills = (arr, activeVal, clickAction) => arr.map(item => `<div class="pill ${item === activeVal ? 'active' : ''}" onclick="App.haptic(); ${clickAction}='${item}';">${item}</div>`).join('');

        document.getElementById('typeSelector').innerHTML = DISCIPLINES.map((d, i) => `<div class="pill ${dStr === d ? 'active' : ''}" onclick="App.haptic(); State.discipline='${d}'">${DISC_LABELS[i]}</div>`).join('');
        document.getElementById('dashSelector').innerHTML = DISCIPLINES.map((d, i) => `<div class="pill ${dStr === d ? 'active' : ''}" onclick="App.haptic(); State.discipline='${d}'">${DISC_LABELS[i]}</div>`).join('');
        
        document.getElementById('input-outdoor').className = isOut ? '' : 'hidden';
        document.getElementById('input-indoor').className = isOut ? 'hidden' : '';
        
        document.getElementById('outdoor-name-lbl').innerText = isBould ? 'Boulder Name' : 'Route Name';
        document.getElementById('input-name').placeholder = isBould ? 'La Marie Rose' : 'Silence';
        document.getElementById('input-crag').placeholder = isBould ? 'Sector, Crag 🇬🇷' : 'Flatanger';

        const currentGyms = (dStr === 'Indoor Rope Climbing') ? GYMS.filter(g => g !== 'Løkka' && g !== 'Bryn') : GYMS;
        document.getElementById('gymPicker').innerHTML = buildPills(currentGyms, State.activeGym, "State.activeGym");
        
        document.getElementById('gradePicker').innerHTML = conf.labels.map((g, i) => {
            const dot = conf.colors[i] ? `<span class="boulder-dot" style="background:${conf.colors[i]};"></span>` : '';
            const isActive = String(g).toLowerCase() === String(State.activeGrade.text).toLowerCase();
            return `<div class="pill ${isActive ? 'active' : ''}" onclick="App.haptic(); State.activeGrade={text:'${g}', score:${conf.scores[i]}};">${dot}${g}</div>`;
        }).join('');
        
        document.getElementById('angleSelector').innerHTML = buildPills(conf.angles, State.activeAngle, "State.activeAngle");

        const styles = (isOut && isRope) ? [['project', 'Project'], ['quick', 'Quick Send'], ['flash', 'Flash'], ['onsight', 'Onsight']] : [['project', 'Project'], ['quick', 'Quick Send'], ['flash', 'Flash']];
        if (!styles.find(s => s[0] === State.activeStyle)) State.activeStyle = styles[0][0];
        document.getElementById('styleSelector').innerHTML = styles.map(s => `<div class="pill ${State.activeStyle === s[0] ? 'active' : ''}" onclick="App.haptic(); State.activeStyle='${s[0]}';">${s[1]}</div>`).join('');
        
        document.getElementById('chartToggle').innerHTML = `<div class="chart-toggle-btn ${State.chartMode === 'max' ? 'active' : ''}" onclick="App.haptic(); State.chartMode='max';">Max Peak</div><div class="chart-toggle-btn ${State.chartMode === 'avg' ? 'active' : ''}" onclick="App.haptic(); State.chartMode='avg';">Avg (Top 10)</div>`;
        
        document.getElementById('list-toggle-top').className = `chart-toggle-btn ${State.listMode === 'top10' ? 'active' : ''}`;
        document.getElementById('list-toggle-recent').className = `chart-toggle-btn ${State.listMode === 'recent' ? 'active' : ''}`;

        if (State.view === 'dash') App.renderDashboard();
    },
    renderDashboard: () => {
        const dStr = String(State.discipline || "");
        const isRope = dStr.includes('Rope');
        const conf = getScaleConfig(dStr);
        const sixtyDaysAgo = new Date(); sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
        
        const viewLogs = State.logs.filter(l => l && l.type === dStr).map(l => ({ ...l, cleanDate: (l.date ? String(l.date).substring(0,10) : getLocalISO()) }));
        
        let displayLogs = (State.listMode === 'top10') 
            ? [...viewLogs].filter(l => new Date(l.cleanDate) >= sixtyDaysAgo).sort((a,b) => (b.score - a.score) || (Number(b.id) - Number(a.id))).slice(0, 10)
            : [...viewLogs].sort((a,b) => Number(b.id) - Number(a.id)).slice(0, 10);
        
        let listHTML = displayLogs.length === 0 ? '<div style="text-align:center; padding:20px; color:var(--text-muted);">No logs found.</div>' : displayLogs.map(l => {
            const d = l.cleanDate.split('-'); 
            let dGrade = String(l.grade || "");
            const isF = dGrade.includes('⚡') || dGrade.includes('👁️');
            
            if (l.style === 'quick' && !dGrade.includes('🚀')) dGrade += ' 🚀';
            if (l.style === 'project' && !dGrade.includes('🛠️')) dGrade += ' 🛠️';

            const badge = getBadge(l.type, dGrade);
            const syncWarning = l._synced === false ? `<span style="color: #ef4444; font-size: 0.7rem; margin-left: 6px;">☁️✕</span>` : '';
            const delBtn = State.listMode === 'recent' ? `<button class="log-del" onclick="App.deleteLog('${l.id}')">×</button>` : '';
            
            const subItems = [];
            if (l.angle) subItems.push(String(l.angle));
            if (l.style && STYLE_MAP[l.style]) subItems.push(STYLE_MAP[l.style]);
            
            const subText = subItems.join(' • ').toUpperCase();
            const discSpan = subText ? `<div class="log-disc">${subText}</div>` : '';
            
            let inlineColor = '';
            if (l.type === 'Indoor Bouldering') {
                const idx = GRADES.bouldsIn.indexOf(getBaseGrade(dGrade));
                if (idx > -1 && GRADES.bouldsInColors[idx]) inlineColor = `color: ${GRADES.bouldsInColors[idx]} !important;`;
            }
            
            return `<div class="log-item"><div class="log-date">${d[1]}/${d[2]}</div><div class="log-info"><div class="log-name">${l.name||"Log"}${syncWarning}</div>${discSpan}</div><div class="log-grade ${isF ? 'fl' : 'rp'}" style="${inlineColor}">${badge}${dGrade}</div>${delBtn}</div>`;
        }).join('');
        
        if (State.listMode === 'top10' && displayLogs.length > 0) {
            let avgS = Math.round(displayLogs.reduce((s, l) => s + Number(l.score||0), 0) / displayLogs.length);
            avgS = Math.max(conf.scores[0], avgS);
            let currIdx = conf.scores.findIndex(s => s > avgS) - 1;
            if (currIdx < 0) currIdx = conf.scores.length - 1;
            if (avgS >= conf.scores[conf.scores.length-1]) currIdx = conf.scores.length - 1;

            let pct = 100, nextGrade = "MAX", nextColor = "var(--text-muted)";
            if (currIdx < conf.scores.length - 1) {
                const baseS = conf.scores[currIdx], nextS = conf.scores[currIdx + 1];
                pct = Math.round(((avgS - baseS) / (nextS - baseS)) * 100);
                nextGrade = conf.labels[currIdx + 1];
                nextColor = conf.colors[currIdx + 1] || 'var(--primary)';
            }
            
            let barColor = conf.colors[currIdx] || 'var(--primary)';
            
            listHTML += `
            <div class="xp-wrapper">
                <div class="xp-header">
                    <span class="xp-title">Working Capacity</span>
                    <span class="xp-pct" style="color: ${barColor};">${pct}%</span>
                </div>
                <div class="xp-bar-cont">
                    <span class="xp-grade" style="color: ${barColor};">${conf.labels[currIdx]}</span>
                    <div class="xp-track">
                        <div class="xp-fill" style="width: ${pct}%; background: ${barColor}; box-shadow: 0 0 12px ${barColor};"></div>
                    </div>
                    <span class="xp-grade next" style="color: ${nextColor}; text-shadow: 0 0 10px ${nextColor}40;">${nextGrade}</span>
                </div>
            </div>`;
        }
        document.getElementById('logList').innerHTML = listHTML;

        const noD = document.getElementById('noDataMsg');
        const ctxCanvas = document.getElementById('progressChart');
        if (!window.Chart) { ctxCanvas.style.display = 'none'; noD.style.display = 'block'; noD.innerText = "Charts unavailable without connection."; return; }

        if(App.chart) App.chart.destroy();
        const ctx = ctxCanvas.getContext('2d');
        if (viewLogs.length === 0) { ctxCanvas.style.display = 'none'; noD.style.display = 'block'; noD.innerText = "Log climbs to view progression"; document.getElementById('pyramidCont').innerHTML = ''; return; }
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
                const mL = viewLogs.filter(l => l.cleanDate.substring(0,7) === m && l.score);
                const rpL = mL.filter(l => !String(l.grade||"").includes('⚡') && !String(l.grade||"").includes('👁️'));
                const flL = mL.filter(l => String(l.grade||"").includes('⚡') || String(l.grade||"").includes('👁️'));
                
                let maxRp = rpL.length ? rpL.reduce((max, cur) => cur.score > max.score ? cur : max) : null;
                let maxFl = flL.length ? flL.reduce((max, cur) => cur.score > max.score ? cur : max) : null;

                cD.rp.push(maxRp ? getScoreIndex(maxRp.score, false) : null);
                cD.rpG.push(maxRp ? maxRp.grade : "None");
                cD.fl.push(maxFl ? getScoreIndex(maxFl.score, true) : null);
                cD.flG.push(maxFl ? maxFl.grade : "None");
            } else {
                let pM = mo-1, pY = y; if (pM === 0) { pM = 12; pY = y-1; }
                const pMS = `${pY}-${pM.toString().padStart(2, '0')}`;
                const wL = viewLogs.filter(l => (l.cleanDate.substring(0,7) === m || l.cleanDate.substring(0,7) === pMS) && l.score).sort((a,b) => b.score - a.score).slice(0, 10);
                
                if (wL.length > 0) { 
                    const avS = Math.round(wL.reduce((s, l) => s + l.score, 0) / wL.length);
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
            dSet = [{ label: 'Max Redpoint', data: cD.rp, borderColor: '#10b981', backgroundColor: g, tension: 0.4, fill: true, pointRadius: 5, pointBackgroundColor: '#10b981', pointBorderColor: '#000', pointBorderWidth: 2, spanGaps: true }, { label: 'Flash/Onsight', data: cD.fl, borderColor: '#db2777', backgroundColor: '#db2777', borderDash: [5,5], tension: 0.4, fill: false, pointRadius: 5, pointBackgroundColor: '#db2777', pointBorderColor: '#000', pointBorderWidth: 2, spanGaps: true }];
            toolC = ctx => ctx.datasetIndex === 0 ? ` Redpoint: ${cD.rpG[ctx.dataIndex]}` : ` Flash: ${cD.flG[ctx.dataIndex]}`;
        } else {
            let gA = ctx.createLinearGradient(0, 0, 0, 300); gA.addColorStop(0, 'rgba(59, 130, 246, 0.35)'); gA.addColorStop(1, 'transparent');
            dSet = [{ label: 'Top 10 Average', data: cD.avg, borderColor: '#3b82f6', backgroundColor: gA, tension: 0.4, fill: true, pointRadius: 6, pointBackgroundColor: '#3b82f6', pointBorderColor: '#000', pointBorderWidth: 2, spanGaps: true }];
            toolC = ctx => ` Power Avg: ${cD.avgG[ctx.dataIndex]}`;
        }
        const aI = [...cD.rp.filter(x=>x!==null), ...cD.fl.filter(x=>x!==null), ...cD.avg.filter(x=>x!==null)];
        App.chart = new Chart(ctx, { type: 'line', data: { labels: cD.lbl, datasets: dSet }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { backgroundColor: 'rgba(0,0,0,0.8)', padding: 10, callbacks: { label: toolC } } }, scales: { y: { min: Math.max(0, Math.min(...aI)-1), max: Math.min(conf.labels.length-1, Math.max(...aI)+1), ticks: { stepSize: 1, callback: v => conf.labels[v] } }, x: { grid: { display: false } } } } });
        
        const gG = {}; let mT = 0;
        const last60 = viewLogs.filter(l => new Date(l.cleanDate) >= sixtyDaysAgo);
        last60.forEach(l => {
            const bG = getBaseGrade(l.grade); 
            const isF = String(l.grade||"").includes('⚡') || String(l.grade||"").includes('👁️');
            if (!gG[bG]) gG[bG] = { rp: 0, fl: 0 };
            if (isF) gG[bG].fl++; else gG[bG].rp++;
            const t = gG[bG].rp + gG[bG].fl; if (t > mT) mT = t;
        });
        
        document.getElementById('pyramidCont').innerHTML = Object.keys(gG).sort((a,b) => conf.labels.indexOf(b) - conf.labels.indexOf(a)).map(b => {
            const g = gG[b]; const fP = (g.fl/mT)*100, rP = (g.rp/mT)*100;
            const badge = getBadge(dStr, b);
            let seg = ''; if (g.fl > 0) seg += `<div class="pyramid-seg fl" style="width: ${fP}%;">⚡ ${g.fl}</div>`; if (g.rp > 0) seg += `<div class="pyramid-seg rp" style="width: ${rP}%;">${g.rp}</div>`;
            return `<div class="pyramid-row"><div class="pyramid-grade">${badge}${b}</div><div class="pyramid-track">${seg}</div></div>`;
        }).join('') || '<div style="color:var(--text-muted); text-align:center; padding:10px;">No sends in the last 60 days.</div>';
    },
    
    // UI Upgrade: Stateful "Save to Cloud" CTA with specific haptic success triggers.
    logClimb: () => {
        App.haptic(); 
        let s = State.activeGrade.score, g = State.activeGrade.text;
        
        if(State.activeStyle === 'flash') { s += State.discipline.includes('Rope') ? 10 : 17; g += " ⚡"; } 
        else if (State.activeStyle === 'onsight') { s += 10; g += " 👁️"; }
        else if (State.activeStyle === 'quick') { g += " 🚀"; }
        else if (State.activeStyle === 'project') { g += " 🛠️"; }
        
        const outName = document.getElementById('input-name').value.trim();
        const outCrag = document.getElementById('input-crag').value.trim();
        const n = State.discipline.includes('Outdoor') ? `${outName} @ ${outCrag}` : State.activeGym;
        if (State.discipline.includes('Outdoor') && (!outName || !outCrag)) { App.toast("Fill info"); return; }
        
        const btn = document.querySelector('.btn-main');
        btn.disabled = true;
        btn.classList.add('loading');
        btn.innerText = 'Saving...';
        
        const l = { id: String(Date.now()), date: State.activeDate, type: State.discipline, grade: g, score: s, name: n, angle: State.activeAngle, style: State.activeStyle, action: 'add', _synced: false };
        State.logs = [...State.logs, l]; 
        SyncManager.push(l); 
        
        if (State.discipline.includes('Outdoor')) { document.getElementById('input-name').value = ''; document.getElementById('input-crag').value = ''; }
        
        // Artificial delay for perceived effort, resolving to success UI
        setTimeout(() => {
            btn.classList.remove('loading');
            btn.classList.add('success');
            btn.innerText = '✅ Saved!';
            if (navigator.vibrate) navigator.vibrate([30, 50, 30]); // Unique success haptic
            
            setTimeout(() => {
                btn.classList.remove('success');
                btn.innerText = 'Save to Cloud';
                btn.disabled = false;
            }, 2000);
        }, 400); 
    }
};
App.init();
