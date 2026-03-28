if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW failed:', err)));
}

const API_URL = "https://script.google.com/macros/s/AKfycby0fW1C830QNXESDs6B1NFB9_gLRqOwOycCly63i4jDxlU7L8_W4Du4w-4hhGE4Pak2/exec";

const GRADES = {
    ropes: ["5c","5c+","6a","6a+","6b","6b+","6c","6c+","7a","7a+","7b","7b+"],
    ropeScores: [567,583,600,617,633,650,667,683,700,717,733,750],
    bouldsIn: ["4","5","6A","6B","6C","7A","7B"],
    bouldsInScores: [400,500,600,633,667,700,733],
    bouldsInColors: ["#ffffff", "#22c55e", "#3b82f6", "#eab308", "#ef4444", "#3f3f46", "#a855f7"]
};

const GYMS = ["OKS", "Torshov", "Løkka", "Bryn", "Gneiss", "Other"];
const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DISCIPLINES = ['Indoor Rope Climbing', 'Indoor Bouldering', 'Outdoor Rope Climbing', 'Outdoor Bouldering'];
const DISC_LABELS = ['In Rope', 'In Boulder', 'Out Rope', 'Out Boulder'];

const STEEPNESS = ['Slab', 'Vertical', 'Overhang', 'Roof'];
const CLIMB_STYLES = ['Endurance', 'Cruxy', 'Technical', 'Athletic'];
const HOLDS = ['Crimps', 'Slopers', 'Pockets', 'Pinches', 'Tufas', 'Jugs'];
const RPES = ['Breezy', 'Solid', 'Limit'];

const getBaseGrade = (g) => String(g || "").replace(/[⚡👁️🚀🛠️\s]/g, '');
const getLocalISO = (d = new Date()) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().substring(0, 10);

const State = new Proxy({
    view: 'log', discipline: 'Indoor Rope Climbing', activeGrade: { text: '6b', score: 633 },
    activeStyle: 'project', activeDate: getLocalISO(), activeGym: 'OKS', chartMode: 'max', listMode: 'top10',
    activeRPE: 'Solid', activeGradefeel: '', activeRating: 0, activeSteepness: [], activeClimbStyles: [], activeHolds: [], 
    activeTimeofday: '', activeFatigue: 3, blacklist: JSON.parse(localStorage.getItem('delBlacklist') || '[]'),
    logs: JSON.parse(localStorage.getItem('climbLogs') || '[]')
}, {
    set(target, prop, value) {
        target[prop] = value;
        if (prop === 'view') {
            document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === `view-${target.view}`));
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.id === `nav-${target.view}`));
        }
        App.renderUI();
        if (prop === 'logs') {
            localStorage.setItem('climbLogs', JSON.stringify(value));
            localStorage.setItem('climbingLogs', JSON.stringify(value));
        }
        if (prop === 'blacklist') localStorage.setItem('delBlacklist', JSON.stringify(value));
        return true;
    }
});

const App = {
    chart: null,
    init: () => { App.renderUI(); SyncManager.trigger(); },
    haptic: () => { if (navigator.vibrate) navigator.vibrate(40); },
    setTimeofday: (b) => { App.haptic(); State.activeTimeofday = State.activeTimeofday === b ? '' : b; },
    setDate: (type, val) => {
        App.haptic();
        if (type === 'today') State.activeDate = getLocalISO();
        else if (type === 'yesterday') { let d = new Date(); d.setDate(d.getDate()-1); State.activeDate = getLocalISO(d); }
        else if (type === 'custom') State.activeDate = val;
    },
    toggleGradeFeel: (f) => { App.haptic(); State.activeGradefeel = State.activeGradefeel === f ? '' : f; },
    toggleMulti: (cat, val) => {
        App.haptic();
        let arr = cat === 'steep' ? [...State.activeSteepness] : cat === 'style' ? [...State.activeClimbStyles] : [...State.activeHolds];
        if (arr.includes(val)) arr = arr.filter(x => x !== val); else arr.push(val);
        if (cat === 'steep') State.activeSteepness = arr; else if (cat === 'style') State.activeClimbStyles = arr; else State.activeHolds = arr;
    },
    setRating: (n) => { App.haptic(); State.activeRating = State.activeRating === n ? 0 : n; },

    renderUI: () => {
        const d = State.discipline;
        const conf = d === 'Indoor Bouldering' ? { labels: GRADES.bouldsIn, scores: GRADES.bouldsInScores } : { labels: GRADES.ropes, scores: GRADES.ropeScores };
        
        document.getElementById('typeSelector').innerHTML = DISCIPLINES.map((dis, i) => `<div class="pill ${d === dis ? 'active' : ''}" onclick="State.discipline='${dis}'">${DISC_LABELS[i]}</div>`).join('');
        document.getElementById('dashSelector').innerHTML = DISCIPLINES.map((dis, i) => `<div class="pill ${d === dis ? 'active' : ''}" onclick="State.discipline='${dis}'">${DISC_LABELS[i]}</div>`).join('');
        
        document.getElementById('input-outdoor').classList.toggle('hidden', !d.includes('Outdoor'));
        document.getElementById('input-indoor').classList.toggle('hidden', d.includes('Outdoor'));
        
        document.getElementById('gymPicker').innerHTML = GYMS.map(g => `<div class="pill ${State.activeGym === g ? 'active' : ''}" onclick="State.activeGym='${g}'">${g}</div>`).join('');
        document.getElementById('gradePicker').innerHTML = conf.labels.map((g, i) => `<div class="pill ${State.activeGrade.text === g ? 'active' : ''}" onclick="State.activeGrade={text:'${g}', score:${conf.scores[i]}}">${g}</div>`).join('');
        
        document.getElementById('styleSelector').innerHTML = ['project', 'quick', 'flash', 'onsight'].map(s => `<div class="pill ${State.activeStyle === s ? 'active' : ''}" onclick="State.activeStyle='${s}'">${s}</div>`).join('');
        
        ['morn', 'aft', 'eve'].forEach(id => {
            const btnText = document.getElementById(`time-${id}`).innerText;
            document.getElementById(`time-${id}`).classList.toggle('active', btnText === State.activeTimeofday);
        });
        
        document.getElementById('rpeSelector').innerHTML = RPES.map(r => `<div class="pill ${State.activeRPE === r ? 'active' : ''}" onclick="State.activeRPE='${r}'">${r}</div>`).join('');
        document.getElementById('steepnessSelector').innerHTML = STEEPNESS.map(s => `<div class="pill ${State.activeSteepness.includes(s) ? 'active' : ''}" onclick="App.toggleMulti('steep', '${s}')">${s}</div>`).join('');
        document.getElementById('climbStyleSelector').innerHTML = CLIMB_STYLES.map(s => `<div class="pill ${State.activeClimbStyles.includes(s) ? 'active' : ''}" onclick="App.toggleMulti('style', '${s}')">${s}</div>`).join('');
        document.getElementById('holdsSelector').innerHTML = HOLDS.map(h => `<div class="pill ${State.activeHolds.includes(h) ? 'active' : ''}" onclick="App.toggleMulti('hold', '${h}')">${h}</div>`).join('');
        
        document.getElementById('feel-soft').classList.toggle('active', State.activeGradefeel === 'Soft');
        document.getElementById('feel-hard').classList.toggle('active', State.activeGradefeel === 'Hard');
        [1,2,3,4,5].forEach(i => document.querySelectorAll('.star-rating span')[i-1].classList.toggle('active', i <= State.activeRating));
        [1,3,5].forEach(i => document.getElementById(`fat-${i}`).classList.toggle('active', State.activeFatigue === i));

        if (State.view === 'dash') App.renderDashboard();
    },

    renderDashboard: () => {
        const d = State.discipline;
        const viewLogs = State.logs.filter(l => l.type === d).slice(0, 10);
        document.getElementById('logList').innerHTML = viewLogs.length ? viewLogs.map(l => `<div class="log-item"><div class="log-info"><b>${l.name}</b><br><small>${l.date}</small></div><div class="log-grade rp">${l.grade}</div><button class="nav-btn" style="color:red; padding:5px" onclick="App.deleteLog('${l.id}')">×</button></div>`).join('') : '<div style="text-align:center; padding:20px; color:gray">No logs.</div>';
        
        if (window.Chart) {
            if (App.chart) App.chart.destroy();
            const ctx = document.getElementById('progressChart').getContext('2d');
            App.chart = new Chart(ctx, {
                type: 'line',
                data: { labels: viewLogs.map(l => l.date).reverse(), datasets: [{ data: viewLogs.map(l => l.score).reverse(), borderColor: '#10b981', tension: 0.4 }] },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
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
        if (State.activeStyle === 'flash') { s += 15; g += " ⚡"; }

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
            fatigue: State.activeFatigue,
            notes: document.getElementById('input-notes').value,
            action: 'add'
        };

        State.logs = [l, ...State.logs];
        SyncManager.push(l);
        document.querySelector('.btn-main').innerText = "Logged! Syncing...";
        setTimeout(() => document.querySelector('.btn-main').innerText = "Save to Cloud", 2000);
    }
};

const SyncManager = {
    trigger: () => {
        const badge = document.querySelector('.sync-badge');
        badge.classList.add('syncing');
        fetch(API_URL).then(r => r.json()).then(data => {
            const clean = data.filter(d => !State.blacklist.includes(String(d.id)));
            State.logs = clean.sort((a,b) => b.id - a.id);
            badge.classList.remove('syncing');
        }).catch(() => badge.classList.remove('syncing'));
    },
    push: (l) => { fetch(API_URL, { method: 'POST', body: JSON.stringify(l) }); }
};

App.init();
