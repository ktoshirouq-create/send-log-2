// Register the Service Worker for Offline PWA support
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW Registration failed:', err));
    });
}

// Hardcoded Master Google Script URL - Pointing to the correct New Deployment
const API_URL = "https://script.google.com/macros/s/AKfycbw-4lwkPSlBubvvgvnBKmDBVzjy9s7kBRekCPOBVnm_6nsgVgNeL8Bdmi5JjJ1KAuVM/exec";

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
    const baseGrade = gradeText.replace(/[⚡👁️🚀🛠️\s]/g, '');
    const idx = GRADES.bouldsIn.indexOf(baseGrade);
    if (idx > -1) return `<span class="boulder-dot" style="background:${GRADES.bouldsInColors[idx]};"></span>`;
    return '';
};

const State = new Proxy({
    view: 'log', discipline: 'Indoor Rope Climbing', activeGrade: { text: '6b', score: 633 },
    activeStyle: 'project', activeDate: getLocalISO(), activeGym: 'OKS', chartMode: 'max',
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
            const cloudIds = new Set(data.map(d => String(d.id)));
            const pendingLocals = State.logs.filter(l => !cloudIds.has(String(l.id)) || l._synced === false);
            
            pendingLocals.forEach(localLog => SyncManager.push(localLog));

            const cleanData = data.map(d => ({ ...d, id: String(d.id), _synced: true }));
            const localOnly = State.logs.filter(l => !cloudIds.has(String(l.id)));
            
            const combined = [...cleanData, ...localOnly];
            const uniqueLogs = Array.from(new Map(combined.map(item => [String(item.id), item])).values());
            
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
            State.logs = State.logs.filter(l => String(l.id) !== String(id)); 
            SyncManager.push({ id: String(id), action: "delete" }); 
            App.toast("Deleted"); 
        } 
    },
    setDate: (type, val = null) => {
        App.haptic();
        document.querySelectorAll('#datePicker .pill').forEach(p => p.classList.remove('active'));
        if (type === 'today') { State.activeDate = getLocalISO(new Date()); document.getElementById('pill-today').classList.add('active'); }
        else if (type === 'yesterday') { let yest = new Date(); yest.setDate(yest.getDate()-1
