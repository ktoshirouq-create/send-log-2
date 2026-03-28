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
const DISCIPLINES = ['Indoor Rope Climbing', 'Indoor Bouldering', 'Outdoor Rope Climbing', 'Outdoor Bouldering'];
const DISC_LABELS = ['In Rope', 'In Boulder', 'Out Rope', 'Out Boulder'];
const STYLE_MAP = { 'project': 'Project', 'quick': 'Quick Send', 'flash': 'Flash', 'onsight': 'Onsight' };

const STEEPNESS = ['Slab', 'Vertical', 'Overhang', 'Roof'];
const CLIMB_STYLES = ['Endurance', 'Cruxy', 'Technical', 'Athletic'];
const HOLDS = ['Crimps', 'Slopers', 'Pockets', 'Pinches', 'Tufas', 'Jugs'];
const RPES = ['Breezy', 'Solid', 'Limit'];

const getBaseGrade = (g) => String(g || "").replace(/[⚡👁️🚀🛠️\s]/g, '');
const getLocalISO = (d = new Date()) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().substring(0, 10);

const getScaleConfig = (disc) => {
    if (disc === 'Indoor Bouldering') return { labels: GRADES.bouldsIn, scores: GRADES.bouldsInScores, colors: GRADES.bouldsInColors };
    if (disc === 'Outdoor Bouldering') return { labels: GRADES.bouldsOut, scores: GRADES.bouldsOutScores, colors: [] };
    return { labels: GRADES.ropes, scores: GRADES.ropeScores, colors: [] };
};

const State = new Proxy({
    view: 'log', discipline: 'Indoor Rope Climbing', activeGrade: { text: '6b', score: 633 },
    activeStyle: 'project', activeDate: getLocalISO(), activeGym: 'OKS', chartMode: 'max', listMode: 'top10',
    activeRPE: 'Solid', activeGradefeel: '', activeRating: 0, activeSteepness: [], activeClimbStyles: [], activeHolds: [], 
    activeTimeofday: '', blacklist: JSON.parse(localStorage.getItem('delBlacklist') || '[]'),
    logs: JSON.parse(localStorage.getItem('climbLogs') || '[]')
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
            document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === `view-${target.view}`));
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.id === `nav-${target.view}`));
            setTimeout(() => App.centerActivePills(), 50);
        }
        
        if (['discipline', 'view', 'activeGym', 'activeStyle', 'chartMode', 'listMode', 'activeGrade', 'activeRPE', 'activeGradefeel', 'activeRating', 'activeSteepness', 'activeClimbStyles', 'activeHolds'].includes(prop)) {
            App.renderUI();
        }

        if (prop === 'logs') {
            localStorage.setItem('climbLogs', JSON.stringify(value));
            localStorage.setItem('climbingLogs', JSON.stringify(value));
            if (target.view === 'dash') App.renderDashboard();
        }
        if (prop === 'blacklist') localStorage.setItem('delBlacklist', JSON.stringify(value));
        return true;
    }
});

const App = {
    chart: null,
    init: () => { 
        if (window.Chart) { Chart.defaults.color = '#737373'; Chart.defaults.borderColor = '#262626'; }
        App.renderUI(); 
        SyncManager.trigger(); 
    },
    haptic: () => { if (navigator.vibrate) navigator.vibrate(40); },
    toggleAdvanced: () => {
        const c = document.getElementById('advanced-content');
        const t = document.getElementById('adv-toggle');
        c.classList.toggle('hidden');
        t.innerText = c.classList.contains('hidden') ? '+ Add Details' : '- Hide Details';
        App.haptic();
    },
    setTimeofday: (b) => { App.haptic(); State.activeTimeofday = State.activeTimeofday === b ? '' : b; },
    setDate: (type, val) => {
        App.haptic();
        document.querySelectorAll('#datePicker .pill').forEach(p => p.classList.remove('active'));
        if (type === 'today') { State.activeDate = getLocalISO(); document.getElementById('pill-today').classList.add('active'); }
        else if (type === 'yesterday') { let d = new Date(); d.setDate(d.getDate()-1); State.activeDate = getLocalISO(d); document.getElementById('pill-yest').classList.add('active'); }
        else if (type === 'custom') { 
            State.activeDate = val; 
            const cp = document.getElementById('pill-custom');
            cp.classList.add('active'); 
            const [,m,d] = val.split('-');
            cp.innerText = `${monthNames[parseInt(m)-1]} ${parseInt(d)}`;
        }
    },
    toggleGradeFeel: (f) => { App.haptic(); State.activeGradefeel = State.activeGradefeel === f ? '' : f; },
    toggleMulti: (cat, val) => {
        App.haptic();
        let arr = cat === 'steep' ? [...State.activeSteepness] : cat === 'style' ? [...State.activeClimbStyles] : [...State.activeHolds];
        if (arr.includes(val)) arr = arr.filter(x => x !== val); else arr.push(val);
        if (cat === 'steep') State.activeSteepness = arr; else if (cat === 'style') State.activeClimbStyles = arr; else State.activeHolds = arr;
    },
    setRating: (n) => { App.haptic(); State.activeRating = State.activeRating === n ? 0 : n; },
    centerActivePills: () => {
        document.querySelectorAll('.pill-row').forEach(row => {
            const active = row.querySelector('.pill.active');
            if (active) {
                const scrollPos = active.offsetLeft - (row.offsetWidth / 2) + (active.offsetWidth / 2);
                row.scrollTo({ left: Math.max(0, scrollPos), behavior: 'smooth' });
            }
        });
    },

    renderUI: () => {
        const d = State.discipline;
        const isOut = d.includes('Outdoor');
        const isRope = d.includes('Rope');
        const conf = getScaleConfig(d);
        
        const renderRow = (id, html) => { const el = document.getElementById(id); if(el) el.innerHTML = html; };

        renderRow('typeSelector', DISCIPLINES.map((dis, i) => `<div class="pill ${d === dis ? 'active' : ''}" onclick="State.discipline='${dis}'">${DISC_LABELS[i]}</div>`).join(''));
        renderRow('dashSelector', DISCIPLINES.map((dis, i) => `<div class="pill ${d === dis ? 'active' : ''}" onclick="State.discipline='${dis}'">${DISC_LABELS[i]}</div>`).join(''));
        
        const outBox = document.getElementById('input-outdoor');
        const inBox = document.getElementById('input-indoor');
        if(outBox) { outBox.classList.toggle('hidden', !isOut); document.getElementById('outdoor-name-lbl').innerText = d.includes('Boulder') ? 'Boulder Name' : 'Route Name'; }
        if(inBox) inBox.classList.toggle('hidden', isOut);
        
        const currentGyms = (d === 'Indoor Rope Climbing') ? GYMS.filter(g => g !== 'Løkka' && g !== 'Bryn') : GYMS;
        renderRow('gymPicker', currentGyms.map(g => `<div class="pill ${State.activeGym === g ? 'active' : ''}" onclick="State.activeGym='${g}'">${g}</div>`).join(''));
        
        renderRow('gradePicker', conf.labels.map((g, i) => {
            return `<div class="pill ${State.activeGrade.text === g ? 'active' : ''}" onclick="State.activeGrade={text:'${g}', score:${conf.scores[i]}}">${g}</div>`;
        }).join(''));
        
        const styles = (isOut && isRope) ? [['project', 'Project'], ['quick', 'Quick Send'], ['flash', 'Flash'], ['onsight', 'Onsight']] : [['project', 'Project'], ['quick', 'Quick Send'], ['flash', 'Flash']];
        if (!styles.find(s => s[0] === State.activeStyle)) State.activeStyle = styles[0][0];
        renderRow('styleSelector', styles.map(s => `<div class="pill ${State.activeStyle === s[0] ? 'active' : ''}" onclick="State.activeStyle='${s[0]}'">${s[1]}</div>`).join(''));
        
        ['morn', 'aft', 'eve'].forEach(id => {
            const el = document.getElementById(`time-${id}`);
            if(el) el.classList.toggle('active', el.innerText === State.activeTimeofday);
        });
        
        renderRow('rpeSelector', RPES.map(r => `<div class="pill ${State.activeRPE === r ? 'active' : ''}" onclick="State.activeRPE='${r}'">${r}</div>`).join(''));
        renderRow('steepnessSelector', STEEPNESS.map(s => `<div class="pill ${State.activeSteepness.includes(s) ? 'active' : ''}" onclick="App.toggleMulti('steep', '${s}')">${s}</div>`).join(''));
        renderRow('climbStyleSelector', CLIMB_STYLES.map(s => `<div class="pill ${State.activeClimbStyles.includes(s) ? 'active' : ''}" onclick="App.toggleMulti('style', '${s}')">${s}</div>`).join(''));
        renderRow('holdsSelector', HOLDS.map(h => `<div class="pill ${State.activeHolds.includes(h) ? 'active' : ''}" onclick="App.toggleMulti('hold', '${h}')">${h}</div>`).join(''));
        
        const fSoft = document.getElementById('feel-soft');
        const fHard = document.getElementById('feel-hard');
        if(fSoft) fSoft.classList.toggle('active', State.activeGradefeel === 'Soft');
        if(fHard) fHard.classList.toggle('active', State.activeGradefeel === 'Hard');
        
        const stars = document.querySelectorAll('.star-rating span');
        stars.forEach((s, i) => s.classList.toggle('active', i < State.activeRating));

        const tMax = document.getElementById('chart-max'); const tAvg = document.getElementById('chart-avg');
        if(tMax && tAvg) { tMax.classList.toggle('active', State.chartMode==='max'); tAvg.classList.toggle('active', State.chartMode==='avg'); }
        const lTop = document.getElementById('list-toggle-top'); const lRec = document.getElementById('list-toggle-recent');
        if(lTop && lRec) { lTop.classList.toggle('active', State.listMode==='top10'); lRec.classList.toggle('active', State.listMode==='recent'); }

        if (State.view === 'dash') App.renderDashboard();
    },

    renderDashboard: () => {
        const d = State.discipline;
        const isRope = d.includes('Rope');
        const conf = getScaleConfig(d);
        const sixtyDaysAgo = new Date(); sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
        
        const viewLogs = State.logs.filter(l => l && l.type === d).map(l => ({ ...l, cleanDate: (l.date ? String(l.date).substring(0,10) : getLocalISO()) }));
        
        let displayLogs = (State.listMode === 'top10') 
            ? [...viewLogs].filter(l => new Date(l.cleanDate) >= sixtyDaysAgo).sort((a,b) => (b.score - a.score) || (Number(b.id) - Number(a.id))).slice(0, 10)
            : [...viewLogs].sort((a,b) => Number(b.id) - Number(a.id)).slice(0, 10);
        
        const list = document.getElementById('logList');
        if(!list) return;

        list.innerHTML = displayLogs.length === 0 ? '<div style="text-align:center; padding:20px; color:var(--text-muted);">No logs found.</div>' : displayLogs.map(l => {
            
            // Format Date: 24 Mar
            const parts = l.cleanDate.split('-'); 
            const formattedDate = `${parseInt(parts[2], 10)} ${monthNames[parseInt(parts[1], 10) - 1]}`;
            
            let rawGrade = String(l.grade || "");
            
            let logName = l.name || "Log";
            if (logName.includes(' @ ')) {
                const p = logName.split(' @ ');
                logName = p[0] + ` <span style="font-size:0.75rem; color:#a3a3a3; font-weight:normal;">@ ${p[1]}</span>`;
            }

            // Restore Sub-details (VERT • FLASH)
            const subItems = [];
            if (l.angle) subItems.push(String(l.angle));
            if (l.style && STYLE_MAP[l.style.toLowerCase()]) subItems.push(STYLE_MAP[l.style.toLowerCase()]);
            const subText = subItems.filter(Boolean).join(' • ').toUpperCase();
            
            const subHtml = subText ? `<br><small style="color:var(--text-muted); font-size:0.65rem; letter-spacing:0.5px;">${formattedDate} • ${subText}</small>` : `<br><small style="color:var(--text-muted); font-size:0.65rem; letter-spacing:0.5px;">${formattedDate}</small>`;
            const delBtn = State.listMode === 'recent' ? `<button style="background:none; border:none; color:var(--danger); font-size:1.5rem; margin-left:10px; cursor:pointer; opacity:0.8;" onclick="App.deleteLog('${l.id}')">×</button>` : '';

            // Current Layout + Re-injected Emoji and SubHtml
            return `<div class="log-item"><div class="log-info"><div class="log-name" style="font-weight:600;">${logName}</div>${subHtml}</div><div class="log-grade rp" style="font-weight:700;">${rawGrade}</div>${delBtn}</div>`;
        }).join('');

        if (window.Chart) {
            if (App.chart) App.chart.destroy();
            const canvas = document.getElementById('progressChart');
            if(!canvas) return;
            const ctx = canvas.getContext('2d');
            
            if (viewLogs.length === 0) return;

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
                dSet = [{ label: 'Max Redpoint', data: cD.rp, borderColor: '#10b981', backgroundColor: g, tension: 0.4, fill: true, pointRadius: 5, pointBackgroundColor: '#10b981', spanGaps: true }, { label: 'Flash/Onsight', data: cD.fl, borderColor: '#db2777', backgroundColor: '#db2777', borderDash: [5,5], tension: 0.4, fill: false, pointRadius: 5, pointBackgroundColor: '#db2777', spanGaps: true }];
                toolC = ctx => ctx.datasetIndex === 0 ? ` Redpoint: ${cD.rpG[ctx.dataIndex]}` : ` Flash: ${cD.flG[ctx.dataIndex]}`;
            } else {
                let gA = ctx.createLinearGradient(0, 0, 0, 300); gA.addColorStop(0, 'rgba(59, 130, 246, 0.35)'); gA.addColorStop(1, 'transparent');
                dSet = [{ label: 'Top 10 Average', data: cD.avg, borderColor: '#3b82f6', backgroundColor: gA, tension: 0.4, fill: true, pointRadius: 6, pointBackgroundColor: '#3b82f6', spanGaps: true }];
                toolC = ctx => ` Power Avg: ${cD.avgG[ctx.dataIndex]}`;
            }
            const aI = [...cD.rp.filter(x=>x!==null), ...cD.fl.filter(x=>x!==null), ...cD.avg.filter(x=>x!==null)];
            
            App.chart = new Chart(ctx, { 
                type: 'line', 
                data: { labels: cD.lbl, datasets: dSet }, 
                options: { 
                    responsive: true, maintainAspectRatio: false, 
                    plugins: { legend: { display: false }, tooltip: { backgroundColor: 'rgba(0,0,0,0.8)', padding: 10, callbacks: { label: toolC } } }, 
                    scales: { y: { min: Math.max(0, Math.min(...aI)-1), max: Math.min(conf.labels.length-1, Math.max(...aI)+1), ticks: { stepSize: 1, callback: v => conf.labels[v] } }, x: { grid: { display: false } } } 
                } 
            });
        }
    },

    deleteLog: (id) => {
        App.haptic();
        if(confirm("Delete Log?")) {
            State.logs = State.logs.filter(l => String(l.id) !== String(id));
            State.blacklist = [...State.blacklist, String(id)];
            SyncManager.push({ id: String(id), action: 'delete' });
        }
    },

    logClimb: () => {
        App.haptic();
        const now = new Date();
        const h = now.getHours();
        const autoTime = h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening';
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        let s = State.activeGrade.score, g = State.activeGrade.text;
        if (State.activeStyle === 'flash') { s += (State.discipline.includes('Rope') ? 10 : 17); g += " ⚡"; }
        else if (State.activeStyle === 'onsight') { s += 10; g += " 👁️"; }
        else if (State.activeStyle === 'quick') { g += " 🚀"; }
        else if (State.activeStyle === 'project') { g += " 🛠️"; }

        const l = {
            id: String(Date.now()),
            date: State.activeDate,
            day: dayNames[new Date(State.activeDate).getDay()],
            timeofday: State.activeTimeofday || autoTime,
            type: State.discipline,
            name: State.discipline.includes('Outdoor') ? `${document.getElementById('input-name').value} @ ${document.getElementById('input-crag').value}` : State.activeGym,
            grade: g,
            score: s,
            angle: State.activeSteepness.join(', '),
            style: State.activeStyle,
            effort: State.activeRPE,
            gradefeel: State.activeGradefeel,
            rating: State.activeRating,
            holds: State.activeHolds.join(', '),
            climstyles: State.activeClimbStyles.join(', '),
            notes: document.getElementById('input-notes').value,
            action: 'add'
        };

        State.logs = [l, ...State.logs];
        SyncManager.push(l);
        
        if (State.discipline.includes('Outdoor')) document.getElementById('input-name').value = '';
        document.getElementById('input-notes').value = '';
        State.activeRating = 0; State.activeGradefeel = ''; State.activeClimbStyles = []; State.activeHolds = []; State.activeSteepness = [];
        
        const btn = document.querySelector('.btn-main');
        if(btn) {
            btn.innerText = "Logged! Syncing...";
            setTimeout(() => btn.innerText = "Save to Cloud", 2000);
        }
    }
};

const SyncManager = {
    trigger: () => {
        const badge = document.querySelector('.sync-badge');
        if(badge) badge.classList.add('syncing');
        fetch(API_URL).then(r => r.json()).then(data => {
            const clean = data.filter(d => d && d.id && !State.blacklist.includes(String(d.id)));
            State.logs = clean.sort((a,b) => b.id - a.id);
            if(badge) badge.classList.remove('syncing');
        }).catch(() => { if(badge) badge.classList.remove('syncing'); });
    },
    push: (l) => { fetch(API_URL, { method: 'POST', body: JSON.stringify(l) }); }
};

document.addEventListener('DOMContentLoaded', () => App.init());
