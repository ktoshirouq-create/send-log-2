// Register the Service Worker for Offline PWA support
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW Registration failed:', err));
    });
}

// ⚠️ PASTE YOUR GOOGLE WEB APP URL HERE BETWEEN THE QUOTES ⚠️
const API_URL = "https://script.google.com/macros/s/AKfycbz_-LZvWtypEz4JnNWCOCJuheXSM5gkeIm4o_MxCvrlH_CbLoO_juFuZ1QOGj2OKgk0/exec";

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

const getScaleConfig = (disc) => {
    const isRope = disc.includes('Rope');
    const angles = isRope ? ['Slab', 'Vert', 'Overhang', 'Tech', 'Endurance'] : ['Slab', 'Vert', 'Overhang', 'Roof', 'Dynamic'];
    if (disc === 'Indoor Bouldering') return { labels: GRADES.bouldsIn, scores: GRADES.bouldsInScores, colors: GRADES.bouldsInColors, angles };
    if (disc === 'Outdoor Bouldering') return { labels: GRADES.bouldsOut, scores: GRADES.bouldsOutScores, colors: [], angles };
    return { labels: GRADES.ropes, scores: GRADES.ropeScores, colors: [], angles };
};

const getLocalISO = (d = new Date()) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().substring(0, 10);

const getBadge = (type, gradeText) => {
    if (type !== 'Indoor Bouldering') return '';
    const baseGrade = gradeText.replace(/[⚡👁️\s]/g, '');
    const idx = GRADES.bouldsIn.indexOf(baseGrade);
    if (idx > -1) return `<span class="boulder-dot" style="background:${GRADES.bouldsInColors[idx]};"></span>`;
    return '';
};

const State = new Proxy({
    view: 'log', discipline: 'Indoor Rope Climbing', activeGrade: { text: '6b', score: 633 },
    activeStyle: 'redpoint', activeDate: getLocalISO(), activeGym: 'OKS', chartMode: 'max',
    activeAngle: 'Vert', listMode: 'top10',
    logs: JSON.parse(localStorage.getItem('climbLogs') || '[]')
}, {
    set(target, prop, value) {
        if (prop === 'discipline' && target.discipline !== value) {
            target.discipline = value;
            const conf = getScaleConfig(value);
            if (!conf.labels.some(g => g.toLowerCase() === target.activeGrade.text.toLowerCase())) {
                target.activeGrade = { text: conf.labels[0], score: conf.scores[0] };
            }
            if (!conf.angles.includes(target.activeAngle)) {
                target.activeAngle = 'Vert';
            }
        } else {
            target[prop] = value;
        }
        
        if (prop === 'view') {
            document.getElementById('view-log').classList.toggle('active', target.view === 'log');
            document.getElementById('view-dash').classList.toggle('active', target.view === 'dash');
            document.getElementById('nav-log').classList.toggle('active', target.view === 'log');
            document.getElementById('nav-dash').classList.toggle('active', target.view === 'dash');
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
            const cloudIds = new Set(data.map(d => d.id));
            const pendingLocals = State.logs.filter(l => !cloudIds.has(l.id) || l._synced === false);
            
            pendingLocals.forEach(localLog => SyncManager.push(localLog));

            const cleanData = data.map(d => ({ ...d, _synced: true }));
            const localOnly = State.logs.filter(l => !cloudIds.has(l.id));
            
            State.logs = [...cleanData, ...localOnly].sort((a,b) => b.id - a.id);
            b.forEach(i => i.classList.remove('syncing'));
        }).catch(() => b.forEach(i => i.classList.remove('syncing')));
    },
    push: async (payload) => { 
        if (!navigator.onLine) return;
        try {
            const response = await fetch(API_URL, { method: 'POST', body: JSON.stringify(payload) });
            const result = await response.json();
            
            if (result.status === 'success' || result.status === 'deleted') {
                State.logs = State.logs.map(l => l.id === payload.id ? { ...l, _synced: true } : l);
            }
        } catch (error) { console.log("Sync delay:", error); }
    }
};

const App = {
    chart: null,
    init: () => {
        Chart.defaults.color = '#737373'; Chart.defaults.borderColor = '#262626';
        App.renderUI(); SyncManager.trigger(); window.addEventListener('online', SyncManager.trigger);
    },
    haptic: () => { if (navigator.vibrate) navigator.vibrate(40); },
    toast: (msg) => {
        const t = document.getElementById('toast');
        t.innerText = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2500);
    },
    deleteLog: (id) => { 
        App.haptic(); 
        if(confirm('Delete this log?')) { 
            State.logs = State.logs.filter(l => l.id !== id); 
            SyncManager.push({ id, action: "delete" }); 
            App.toast("Deleted"); 
        } 
    },
    setDate: (type, val = null) => {
        App.haptic();
        document.querySelectorAll('#datePicker .pill').forEach(p => p.classList.remove('active'));
        if (type === 'today') { State.activeDate = getLocalISO(new Date()); document.getElementById('pill-today').classList.add('active'); }
        else if (type === 'yesterday') { let yest = new Date(); yest.setDate(yest.getDate()-1); State.activeDate = getLocalISO(yest); document.getElementById('pill-yest').classList.add('active'); }
        else if (type === 'custom' && val) { 
            State.activeDate = val; const [y, m, d] = val.split('-');
            document.getElementById('pill-custom').classList.add('active');
            document.getElementById('pill-custom').innerText = `${monthNames[parseInt(m)-1]} ${parseInt(d)}`;
        }
    },
    renderUI: () => {
        const isOut = State.discipline.includes('Outdoor'), isRope = State.discipline.includes('Rope'), isBould = State.discipline.includes('Boulder');
        const conf = getScaleConfig(State.discipline);

        document.getElementById('typeSelector').innerHTML = DISCIPLINES.map((d, i) => `<div class="pill ${State.discipline === d ? 'active' : ''}" onclick="App.haptic(); State.discipline='${d}'">${DISC_LABELS[i]}</div>`).join('');
        document.getElementById('dashSelector').innerHTML = DISCIPLINES.map((d, i) => `<div class="pill ${State.discipline === d ? 'active' : ''}" onclick="App.haptic(); State.discipline='${d}'">${DISC_LABELS[i]}</div>`).join('');
        
        document.getElementById('input-outdoor').className = isOut ? '' : 'hidden';
        document.getElementById('input-indoor').className = isOut ? 'hidden' : '';
        
        document.getElementById('outdoor-name-lbl').innerText = isBould ? 'Boulder Name' : 'Route Name';
        document.getElementById('input-name').placeholder = isBould ? 'La Marie Rose' : 'Silence';
        document.getElementById('input-crag').placeholder = isBould ? 'Fontainebleau' : 'Flatanger';

        document.getElementById('gymPicker').innerHTML = GYMS.map(gym => `<div class="pill ${gym === State.activeGym ? 'active' : ''}" onclick="App.haptic(); State.activeGym='${gym}';">${gym}</div>`).join('');
        
        document.getElementById('gradePicker').innerHTML = conf.labels.map((g, i) => {
            const dot = conf.colors[i] ? `<span class="boulder-dot" style="background:${conf.colors[i]};"></span>` : '';
            const isActive = g.toLowerCase() === State.activeGrade.text.toLowerCase();
            return `<div class="pill ${isActive ? 'active' : ''}" onclick="App.haptic(); State.activeGrade={text:'${g}', score:${conf.scores[i]}};">${dot}${g}</div>`;
        }).join('');
        
        document.getElementById('angleSelector').innerHTML = conf.angles.map(a => `<div class="pill ${State.activeAngle === a ? 'active' : ''}" onclick="App.haptic(); State.activeAngle='${a}';">${a}</div>`).join('');

        const styles = isRope ? [['redpoint', 'Redpoint'], ['flash', isOut ? 'Flash' : 'Flash/Onsight'], ...(isOut ? [['onsight', 'Onsight']] : [])] : [['send', 'Send'], ['flash', 'Flash']];
        if (!styles.find(s => s[0] === State.activeStyle)) State.activeStyle = styles[0][0];
        document.getElementById('styleSelector').innerHTML = styles.map(s => `<div class="pill ${State.activeStyle === s[0] ? 'active' : ''}" onclick="App.haptic(); State.activeStyle='${s[0]}';">${s[1]}</div>`).join('');
        
        document.getElementById('chartToggle').innerHTML = `<div class="chart-toggle-btn ${State.chartMode === 'max' ? 'active' : ''}" onclick="App.haptic(); State.chartMode='max';">Max Peak</div><div class="chart-toggle-btn ${State.chartMode === 'avg' ? 'active' : ''}" onclick="App.haptic(); State.chartMode='avg';">Avg (Top 10)</div>`;
        
        document.getElementById('list-toggle-top').className = `chart-toggle-btn ${State.listMode === 'top10' ? 'active' : ''}`;
        document.getElementById('list-toggle-recent').className = `chart-toggle-btn ${State.listMode === 'recent' ? 'active' : ''}`;

        if (State.view === 'dash') App.renderDashboard();
    },
    renderDashboard: () => {
        const isRope = State.discipline.includes('Rope');
        const conf = getScaleConfig(State.discipline);
        const sixtyDaysAgo = new Date(); sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
        const viewLogs = State.logs.filter(l => l.type === State.discipline).map(l => ({...l, cleanDate: l.date.substring(0,10) }));
        
        let displayLogs = [];
        if (State.listMode === 'top10') {
            const last60 = viewLogs.filter(l => new Date(l.cleanDate) >= sixtyDaysAgo);
            displayLogs = [...last60].sort((a,b) => (b.score - a.score) || (b.id - a.id)).slice(0, 10);
        } else {
            displayLogs = [...viewLogs].sort((a,b) => b.id - a.id).slice(0, 15);
        }
        
        let listHTML = displayLogs.length === 0 ? '<div style="text-align:center; padding:20px; color:var(--text-muted);">No logs found.</div>' : displayLogs.map(l => {
            const d = l.cleanDate.split('-'); const isF = l.grade.includes('⚡') || l.grade.includes('👁️');
            const badge = getBadge(l.type, l.grade);
            const angleText = l.angle ? ` • ${l.angle.toUpperCase()}` : '';
            const syncWarning = l._synced === false ? `<span style="color: #ef4444; font-size: 0.7rem; margin-left: 6px;">☁️✕</span>` : '';
            const delBtn = State.listMode === 'recent' ? `<button class="log-del" onclick="App.deleteLog(${l.id})">×</button>` : '';
            
            return `<div class="log-item"><div class="log-date">${d[1]}/${d[2]}</div><div class="log-info"><span class="log-name">${l.name}${syncWarning}</span><span class="log-disc">${l.type.replace(/Indoor |Outdoor | Climbing/g, '')}${angleText}</span></div><div class="log-grade ${isF ? 'fl' : 'rp'}">${badge}${l.grade}</div>${delBtn}</div>`;
        }).join('');
        
        if (State.listMode === 'top10' && displayLogs.length > 0) {
            let avgS = Math.round(displayLogs.reduce((s, l) => s + l.score, 0) / displayLogs.length);
            avgS = Math.max(conf.scores[0], avgS);
            let currIdx = 0;
            for(let i = 0; i < conf.scores.length; i++) { if (avgS >= conf.scores[i]) currIdx = i; else break; }
            
            let pct = 0, nextGrade = "MAX";
            if (currIdx < conf.scores.length - 1) {
                const baseS = conf.scores[currIdx], nextS = conf.scores[currIdx + 1];
                pct = Math.round(((avgS - baseS) / (nextS - baseS)) * 100);
                nextGrade = conf.labels[currIdx + 1];
            } else { pct = 100; }
            
            let barColor = conf.colors[currIdx] ? conf.colors[currIdx] : 'var(--primary)';
            
            let pctToNext = 100 - pct;
            let subtitleText = pct === 100 ? "Max baseline achieved" : `${pctToNext}% to establishing ${nextGrade}`;

            listHTML += `
            <div class="xp-wrapper">
                <div class="xp-header">
                    <div class="xp-title-cont">
                        <span class="xp-title">Working Capacity</span>
                        <span class="xp-subtitle">${subtitleText}</span>
                    </div>
                    <span class="xp-pct" style="color: ${barColor};">${pct}%</span>
                </div>
                <div class="xp-bar-cont">
                    <div class="xp-grade" style="color: ${barColor};">${conf.labels[currIdx]}</div>
                    <div class="xp-track">
                        <div class="xp-fill" style="width: ${pct}%; background: linear-gradient(90deg, ${barColor}20 0%, ${barColor} 100%); box-shadow: inset 0 1px 1px rgba(255,255,255,0.4), 0 0 15px ${barColor}50;">
                            <div class="xp-fill-glow"></div>
                        </div>
                    </div>
                    <div class="xp-grade next">${nextGrade}</div>
                </div>
            </div>`;
        }
        document.getElementById('logList').innerHTML = listHTML;

        if(App.chart) App.chart.destroy();
        const ctx = document.getElementById('progressChart').getContext('2d'), noD = document.getElementById('noDataMsg');
        if (viewLogs.length === 0) { document.getElementById('progressChart').style.display = 'none'; noD.style.display = 'block'; document.getElementById('pyramidCont').innerHTML = ''; return; }
        document.getElementById('progressChart').style.display = 'block'; noD.style.display = 'none';

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
                const rpL = mL.filter(l => !l.grade.includes('⚡') && !l.grade.includes('👁️'));
                const flL = mL.filter(l => l.grade.includes('⚡') || l.grade.includes('👁️'));
                
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
            const bG = l.grade.replace(/[⚡👁️\s]/g, ''); const isF = l.grade.includes('⚡') || l.grade.includes('👁️');
            if (!gG[bG]) gG[bG] = { rp: 0, fl: 0 };
            if (isF) gG[bG].fl++; else gG[bG].rp++;
            const t = gG[bG].rp + gG[bG].fl; if (t > mT) mT = t;
        });
        
        document.getElementById('pyramidCont').innerHTML = Object.keys(gG).sort((a,b) => conf.labels.indexOf(b) - conf.labels.indexOf(a)).map(b => {
            const g = gG[b]; const fP = (g.fl/mT)*100, rP = (g.rp/mT)*100;
            const badge = getBadge(State.discipline, b);
            let seg = ''; if (g.fl > 0) seg += `<div class="pyramid-seg fl" style="width: ${fP}%;">⚡ ${g.fl}</div>`; if (g.rp > 0) seg += `<div class="pyramid-seg rp" style="width: ${rP}%;">${g.rp}</div>`;
            return `<div class="pyramid-row"><div class="pyramid-grade">${badge}${b}</div><div class="pyramid-track">${seg}</div></div>`;
        }).join('') || '<div style="color:var(--text-muted); text-align:center; padding:10px;">No sends in the last 60 days.</div>';
    },
    logClimb: () => {
        App.haptic(); let s = State.activeGrade.score, g = State.activeGrade.text;
        if(State.activeStyle === 'flash') { s += State.discipline.includes('Rope') ? 10 : 17; g += " ⚡"; } else if (State.activeStyle === 'onsight') { s += 10; g += " 👁️"; }
        
        const outName = document.getElementById('input-name').value.trim();
        const outCrag = document.getElementById('input-crag').value.trim();
        const n = State.discipline.includes('Outdoor') ? `${outName} @ ${outCrag}` : State.activeGym;
        if (State.discipline.includes('Outdoor') && (!outName || !outCrag)) { App.toast("Fill info"); return; }
        
        const l = { id: Date.now(), date: State.activeDate, type: State.discipline, grade: g, score: s, name: n, angle: State.activeAngle, action: 'add', _synced: false };
        State.logs = [...State.logs, l]; SyncManager.push(l); App.toast("Logged");
        if (State.discipline.includes('Outdoor')) { document.getElementById('input-name').value = ''; document.getElementById('input-crag').value = ''; }
    }
};
App.init();
