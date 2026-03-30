const AppConfig = {
    api: "https://script.google.com/macros/s/AKfycbwMh-T7DB7S06_8DB2GC4dniByVHrRSqbODdLRhjciDOXSDL-V4_vzQtRXee2Wmqp9L/exec",
    gyms: ["OKS", "Torshov", "Løkka", "Bryn", "Gneiss", "Other"],
    months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    days: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    disciplines: ['Indoor Rope Climbing', 'Indoor Bouldering', 'Outdoor Rope Climbing', 'Outdoor Bouldering'],
    styles: { 'project': 'Project', 'quick': 'Send', 'flash': 'Flash', 'onsight': 'Onsight', 'worked': 'Worked' },
    steepness: ['Slab', 'Vertical', 'Overhang', 'Roof'],
    grades: {
        ropes: { labels: ["5c","5c+","6a","6a+","6b","6b+","6c","6c+","7a","7a+","7b","7b+"], scores: [567,583,600,617,633,650,667,683,700,717,733,750], colors: [] },
        bouldsIn: { labels: ["4","5","6A","6B","6C","7A","7B"], scores: [400,500,600,633,667,700,733], colors: ["#ffffff", "#22c55e", "#3b82f6", "#eab308", "#ef4444", "#3f3f46", "#a855f7"] },
        bouldsOut: { labels: ["3","4","5","5+","6A","6A+","6B","6B+","6C","6C+","7A","7A+","7B","7B+","7C"], scores: [300,400,500,550,600,617,633,650,667,683,700,717,733,750,767], colors: [] }
    }
};

let currentFilteredLogs = [];
let allSessionsMaster = [];

const getV = (obj, prop) => obj[prop] !== undefined ? obj[prop] : obj[prop.toLowerCase()];
const getBaseGrade = (g) => String(g || "").replace(/[⚡💎🚀🛠️❌\s]/g, '');
const formatShortDate = (dStr) => {
    const clean = dStr ? String(dStr).substring(0, 10) : "";
    if(!clean) return "";
    const [y, m, d] = clean.split('-');
    return `${d} ${AppConfig.months[parseInt(m)-1]}`;
};

const Dashboard = {
    sortCol: 'Date',
    sortAsc: false,
    
    sortLogbook: (col) => {
        if (Dashboard.sortCol === col) Dashboard.sortAsc = !Dashboard.sortAsc; 
        else { Dashboard.sortCol = col; Dashboard.sortAsc = false; }
        Dashboard.renderLogbook();
    },

    toggleRow: (id) => {
        const row = document.getElementById(`row-${id}`);
        const details = document.getElementById(`details-${id}`);
        if(row && details) { row.classList.toggle('expanded'); details.classList.toggle('active'); }
    },

    renderLogbook: () => {
        const tbody = document.getElementById('masterLogbookBody');
        const q = document.getElementById('logSearch').value.toLowerCase();
        
        let displayData = currentFilteredLogs.filter(l => {
            if (!q) return true;
            const searchString = `${getV(l, 'Name')} ${getV(l, 'Notes')} ${getV(l, 'Grade')} ${getV(l, 'Holds')} ${AppConfig.styles[getV(l, 'Style')]||""}`.toLowerCase();
            return searchString.includes(q);
        });

        document.getElementById('logCount').innerText = `${displayData.length} Logs`;

        displayData.sort((a, b) => {
            let valA, valB;
            if (Dashboard.sortCol === 'Date') { valA = new Date(getV(a, 'Date')).getTime() || 0; valB = new Date(getV(b, 'Date')).getTime() || 0; }
            else if (Dashboard.sortCol === 'Name') { valA = String(getV(a, 'Name')||"").toLowerCase(); valB = String(getV(b, 'Name')||"").toLowerCase(); }
            else if (Dashboard.sortCol === 'Grade') { valA = Number(getV(a, 'Score')) || 0; valB = Number(getV(b, 'Score')) || 0; }
            else if (Dashboard.sortCol === 'Style') { valA = String(getV(a, 'Style')||"").toLowerCase(); valB = String(getV(b, 'Style')||"").toLowerCase(); }
            else if (Dashboard.sortCol === 'Burns') { valA = Number(getV(a, 'Burns')) || 0; valB = Number(getV(b, 'Burns')) || 0; }
            
            if (valA < valB) return Dashboard.sortAsc ? -1 : 1;
            if (valA > valB) return Dashboard.sortAsc ? 1 : -1;
            return 0;
        });

        if (displayData.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="empty-msg">No logs match your search.</td></tr>`;
            return;
        }

        tbody.innerHTML = displayData.map(l => {
            const id = getV(l, 'ClimbID');
            const name = String(getV(l, 'Name') || "");
            const cleanName = name ? name.split('@')[0].trim() : "Unknown";
            const grade = String(getV(l, 'Grade') || "");
            const isF = grade.includes('⚡') || grade.includes('💎');
            const isFail = getV(l, 'Style') === 'worked';
            let gradeColor = isF ? 'color: var(--flash);' : (isFail ? 'color: #f59e0b;' : 'color: var(--primary);');
            
            const sessionID = getV(l, 'SessionID');
            const session = allSessionsMaster.find(s => getV(s, 'SessionID') === sessionID);
            const fatigue = session && getV(session, 'Fatigue') ? `${getV(session, 'Fatigue')}/10` : '-';
            const focus = session && getV(session, 'Focus') ? getV(session, 'Focus') : '-';

            return `
            <tr class="table-row" id="row-${id}" onclick="Dashboard.toggleRow('${id}')">
                <td style="color:#a3a3a3;">${formatShortDate(getV(l, 'Date'))}</td>
                <td style="font-weight:bold; color:#fff;">${cleanName}</td>
                <td style="font-weight:bold; ${gradeColor}">${grade}</td>
                <td style="color:#a3a3a3;">${AppConfig.styles[getV(l, 'Style')] || getV(l, 'Style')}</td>
                <td>${getV(l, 'Burns') || 1}</td>
            </tr>
            <tr class="details-row" id="details-${id}">
                <td colspan="5" style="padding:0;">
                    <div class="details-content">
                        <div class="details-grid">
                            <div><div class="d-lbl">Rating</div><div class="d-val" style="color:#eab308;">${'★'.repeat(Number(getV(l, 'Rating')) || 0) || '-'}</div></div>
                            <div><div class="d-lbl">Angle</div><div class="d-val">${getV(l, 'Angle') || '-'}</div></div>
                            <div><div class="d-lbl">Holds</div><div class="d-val">${getV(l, 'Holds') || '-'}</div></div>
                            <div><div class="d-lbl">RPE (Effort)</div><div class="d-val">${getV(l, 'Effort') || '-'}</div></div>
                            <div><div class="d-lbl">Session Fatigue</div><div class="d-val" style="color:#fb923c;">${fatigue}</div></div>
                            <div><div class="d-lbl">Session Focus</div><div class="d-val" style="color:#60a5fa;">${focus}</div></div>
                        </div>
                        ${getV(l, 'Notes') ? `<div class="d-notes">"${getV(l, 'Notes')}"</div>` : ''}
                    </div>
                </td>
            </tr>`;
        }).join('');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    let allLogs = JSON.parse(localStorage.getItem('crag_climbs_master') || '[]');
    let allSessions = JSON.parse(localStorage.getItem('crag_sessions_master') || '[]');
    allSessionsMaster = allSessions; 
    
    let activeDisc = 'All';
    let activeTime = '90'; 
    let charts = { pie: null, radar: null, line: null, pyr: null };
    
    const getScaleConfig = (disc) => {
        if (disc === 'Indoor Bouldering') return AppConfig.grades.bouldsIn;
        if (disc === 'Outdoor Bouldering') return AppConfig.grades.bouldsOut;
        return AppConfig.grades.ropes;
    };

    document.getElementById('logSearch').addEventListener('input', Dashboard.renderLogbook);

    // V35 FIX: Loading State Indicator
    const syncText = document.getElementById('syncStatus');
    syncText.innerText = "(Syncing cloud data...)";

    fetch(AppConfig.api)
        .then(res => res.json())
        .then(data => {
            if (data.status === 'success') {
                allLogs = data.climbs || [];
                allSessions = data.sessions || [];
                allSessionsMaster = allSessions;
                localStorage.setItem('crag_climbs_master', JSON.stringify(allLogs));
                localStorage.setItem('crag_sessions_master', JSON.stringify(allSessions));
                syncText.innerText = "(Synced)";
                setTimeout(() => syncText.innerText = "", 2000);
                renderDashboard(); 
            }
        }).catch(err => {
            console.log("Dashboard background sync failed", err);
            syncText.innerText = "(Offline Mode)";
        });

    const attachFilters = (id, propName, className) => {
        document.querySelectorAll(`#${id} .${className}`).forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll(`#${id} .${className}`).forEach(p => p.classList.remove('active'));
                e.target.classList.add('active');
                if (propName === 'disc') activeDisc = e.target.getAttribute('data-filter');
                if (propName === 'time') activeTime = e.target.getAttribute('data-time');
                renderDashboard();
            });
        });
    };
    attachFilters('disc-filter', 'disc', 'filter-pill');
    attachFilters('time-filter', 'time', 'time-tab');

    function renderDashboard() {
        const now = new Date();
        currentFilteredLogs = allLogs.filter(l => {
            const type = getV(l, 'Type');
            if (activeDisc !== 'All' && type !== activeDisc) return false;
            if (activeTime === 'All') return true;
            
            const logDate = new Date(getV(l, 'Date'));
            const diffDays = (now - logDate) / (1000 * 60 * 60 * 24);
            return diffDays <= parseInt(activeTime);
        });

        document.getElementById('stat-sends').innerText = currentFilteredLogs.length;
        const outDays = new Set(currentFilteredLogs.filter(l => String(getV(l, 'Type')).includes('Outdoor')).map(l => getV(l, 'Date'))).size;
        document.getElementById('stat-outdoor').innerText = activeDisc.includes('Indoor') ? 'N/A' : outDays;
        
        let maxScore = 0, peakG = '-';
        currentFilteredLogs.forEach(l => { 
            const s = Number(getV(l, 'Score'));
            if (s && s > maxScore && getV(l, 'Style') !== 'worked') { 
                maxScore = s; 
                peakG = getV(l, 'Grade'); 
            } 
        });
        document.getElementById('stat-peak').innerText = (currentFilteredLogs.length === 0) ? '-' : (activeDisc === 'All' ? 'Mix' : getBaseGrade(peakG));

        let dayC = {}, timeC = {}, indoorCount = 0;
        currentFilteredLogs.forEach(l => { 
            const dateStr = getV(l, 'Date');
            if (dateStr) {
                const d = new Date(dateStr).getDay();
                const dayName = AppConfig.days[d];
                dayC[dayName] = (dayC[dayName] || 0) + 1; 
            }
            if (String(getV(l, 'Type')).includes('Indoor')) indoorCount++;
        });
        
        const topDay = Object.keys(dayC).length ? Object.keys(dayC).reduce((a, b) => dayC[a] > dayC[b] ? a : b) : '-';
        
        let envLabel = '-';
        if (currentFilteredLogs.length > 0) {
            const inRatio = indoorCount / currentFilteredLogs.length;
            if (inRatio >= 0.8) envLabel = 'Gym Rat 🐀';
            else if (inRatio <= 0.4) envLabel = 'Crag Hound 🐺';
            else envLabel = 'Weekend Warrior 🏕️';
        }

        document.getElementById('id-day').innerText = topDay;
        document.getElementById('id-env').innerText = envLabel;
        document.getElementById('id-arch').innerText = 'Data Miner 🔒'; 

        Object.values(charts).forEach(c => { if(c) c.destroy(); });

        const pyrCanvas = document.getElementById('pyramidChart');
        const pyrOverlay = document.getElementById('pyramidOverlay');

        if (activeDisc === 'All' || currentFilteredLogs.length === 0) {
            pyrCanvas.style.display = 'none';
            pyrOverlay.style.display = 'flex';
        } else {
            pyrCanvas.style.display = 'block';
            pyrOverlay.style.display = 'none';
            
            const grades = {};
            const conf = getScaleConfig(activeDisc);
            
            currentFilteredLogs.forEach(l => {
                if (getV(l, 'Score') && getV(l, 'Style') !== 'worked') {
                    const clean = getBaseGrade(getV(l, 'Grade'));
                    grades[clean] = (grades[clean] || 0) + 1;
                }
            });
            
            const sortedGrades = Object.keys(grades).sort((a,b) => conf.labels.indexOf(a) - conf.labels.indexOf(b));
            const pyrData = sortedGrades.map(g => grades[g]);
            const pyrColors = sortedGrades.map(g => {
                const idx = conf.labels.indexOf(g);
                return (conf.colors && conf.colors[idx]) ? conf.colors[idx] : '#10b981';
            });

            charts.pyr = new Chart(pyrCanvas, {
                type: 'bar',
                data: { labels: sortedGrades, datasets: [{ data: pyrData, backgroundColor: pyrColors, borderRadius: 4 }] },
                options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { display: false } } }
            });
        }

        const sortedCNS = [...currentFilteredLogs].filter(l => getV(l, 'Score') && getV(l, 'Style') !== 'worked').sort((a,b) => new Date(getV(a, 'Date')) - new Date(getV(b, 'Date')));
        const cnsData = { labels: ['W4', 'W3', 'W2', 'W1'], peak: [null, null, null, null], grades: ['-','-','-','-'], fatigue: [0,0,0,0] };
        const weekBins = [[],[],[],[]]; 
        const sessionBins = [[],[],[],[]];

        sortedCNS.forEach(l => {
            const diffDays = Math.floor((now - new Date(getV(l, 'Date'))) / (1000 * 60 * 60 * 24));
            if (diffDays <= 7) weekBins[3].push(l); 
            else if (diffDays <= 14) weekBins[2].push(l); 
            else if (diffDays <= 21) weekBins[1].push(l); 
            else if (diffDays <= 28) weekBins[0].push(l);
        });

        allSessions.forEach(s => {
            const diffDays = Math.floor((now - new Date(getV(s, 'Date'))) / (1000 * 60 * 60 * 24));
            const f = getV(s, 'Fatigue');
            if (diffDays <= 28 && f) {
                let binIdx = -1;
                if (diffDays <= 7) binIdx = 3; else if (diffDays <= 14) binIdx = 2; else if (diffDays <= 21) binIdx = 1; else if (diffDays <= 28) binIdx = 0;
                sessionBins[binIdx].push(Number(f));
            }
        });

        weekBins.forEach((bin, i) => {
            if (bin.length > 0) {
                const maxLog = bin.reduce((max, cur) => Number(getV(cur, 'Score')) > Number(getV(max, 'Score')) ? cur : max);
                cnsData.peak[i] = Number(getV(maxLog, 'Score')); 
                cnsData.grades[i] = getBaseGrade(getV(maxLog, 'Grade'));
            }
            if (sessionBins[i].length > 0) {
                cnsData.fatigue[i] = sessionBins[i].reduce((a,b)=>a+b, 0) / sessionBins[i].length;
            }
        });

        let gL = document.getElementById('cnsLineChart').getContext('2d').createLinearGradient(0,0,0,300); 
        gL.addColorStop(0, 'rgba(0,188,212,0.4)'); gL.addColorStop(1, 'transparent');
        
        charts.line = new Chart(document.getElementById('cnsLineChart'), {
            type: 'line', 
            data: { 
                labels: cnsData.labels, 
                datasets: [
                    { type: 'line', label: 'Peak Send', data: cnsData.peak, borderColor: '#00BCD4', backgroundColor: gL, fill: true, tension: 0.4, spanGaps: true, yAxisID: 'y' },
                    { type: 'bar', label: 'Avg Fatigue', data: cnsData.fatigue, backgroundColor: 'rgba(239, 68, 68, 0.3)', borderRadius: 4, yAxisID: 'y1' }
                ] 
            },
            options: { 
                responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => ctx.datasetIndex === 0 ? ' Peak: ' + cnsData.grades[ctx.dataIndex] : ' Fatigue: ' + ctx.raw.toFixed(1) + '/10' } } }, 
                scales: { 
                    y: { display: false, position: 'left' }, 
                    y1: { display: false, position: 'right', min: 0, max: 10 },
                    x: { grid: { display: false } } 
                } 
            }
        });

        let aero = 0, ancap = 0, power = 0;
        let grips = { 'Crimps':0, 'Slopers':0, 'Pockets':0, 'Pinches':0, 'Tufas':0, 'Jugs':0 };
        currentFilteredLogs.forEach(l => {
            const st = String(getV(l, 'ClimStyles') || getV(l, 'climstyles') || "").toLowerCase();
            if(st.includes('endurance')) aero++; else if(st.includes('cruxy')) power++; else if(st.includes('athletic')) ancap++;
            Object.keys(grips).forEach(g => { if(String(getV(l, 'Holds') || "").includes(g)) grips[g]++; });
        });
        if(aero===0 && ancap===0 && power===0) { aero=1; ancap=1; power=1; } 
        charts.pie = new Chart(document.getElementById('energyPieChart'), { type: 'doughnut', data: { labels: ['Aero', 'AnCap', 'Power'], datasets: [{ data: [aero, ancap, power], backgroundColor: ['#2196F3', '#FF9800', '#F44336'], borderColor: '#171717' }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } });
        charts.radar = new Chart(document.getElementById('gripRadarChart'), { type: 'radar', data: { labels: Object.keys(grips), datasets: [{ data: Object.values(grips), borderColor: '#9C27B0', backgroundColor: 'rgba(156, 39, 176, 0.2)' }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { r: { ticks: { display: false }, grid: { color: '#333' }, angleLines: { color: '#333' } } } } });

        const renderList = (id, html) => { document.getElementById(id).innerHTML = html || '<div class="empty-msg">No logs fit this criteria.</div>'; };
        
        const hof = [...currentFilteredLogs].filter(l => Number(getV(l, 'Rating')) >= 4).sort((a,b)=>(Number(getV(b, 'Score'))||0)-(Number(getV(a, 'Score'))||0)).slice(0,5);
        renderList('list-fame', hof.map(l => {
            const name = String(getV(l, 'Name') || "");
            const cleanName = name ? name.split('@')[0].trim() : "Unknown";
            return `<div class="list-item"><div><div class="list-main">${cleanName}</div><div class="list-sub">${'★'.repeat(Number(getV(l, 'Rating')))}</div></div><div class="list-badge">${getBaseGrade(getV(l, 'Grade'))}</div></div>`
        }).join(''));

        const limit = [...currentFilteredLogs].filter(l => String(getV(l, 'Effort')||"").includes('Limit') || String(getV(l, 'GradeFeel')||"").includes('Hard')).sort((a,b)=>(Number(getV(b, 'Score'))||0)-(Number(getV(a, 'Score'))||0)).slice(0,5);
        renderList('list-limit', limit.map(l => {
            const name = String(getV(l, 'Name') || "");
            const cleanName = name ? name.split('@')[0].trim() : "Unknown";
            return `<div class="list-item"><div><div class="list-main">${cleanName}</div><div class="list-sub">${formatShortDate(getV(l, 'Date'))}</div></div><div class="list-badge" style="color:#ef4444;">${getBaseGrade(getV(l, 'Grade'))}</div></div>`
        }).join(''));

        let steepHTML = '';
        AppConfig.steepness.forEach(st => {
            const logsForSt = currentFilteredLogs.filter(l => String(getV(l, 'Angle')||"").includes(st) && getV(l, 'Score'));
            if(logsForSt.length > 0) {
                const peak = logsForSt.reduce((max, cur) => Number(getV(cur, 'Score')) > Number(getV(max, 'Score')) ? cur : max);
                steepHTML += `<div class="list-item"><div class="list-main">${st}</div><div class="list-badge" style="color:#3b82f6;">${getBaseGrade(getV(peak, 'Grade'))}</div></div>`;
            } else steepHTML += `<div class="list-item"><div class="list-main" style="color:#555;">${st}</div><div class="list-badge" style="background:transparent; color:#555;">-</div></div>`;
        });
        renderList('list-steepness', steepHTML);

        const locs = {};
        currentFilteredLogs.forEach(l => { 
            let n = String(getV(l, 'Name') || ""); 
            if(n) {
                if(n.includes('@')) n = n.split('@')[1].trim(); 
                if (n) locs[n] = (locs[n] || 0) + 1; 
            }
        });
        const topLocs = Object.keys(locs).sort((a,b)=>locs[b]-locs[a]).slice(0,5);
        renderList('list-locations', topLocs.map(loc => `<div class="list-item"><div class="list-main">${loc}</div><div class="list-badge" style="color:#fff; background:#333;">${locs[loc]} Session${locs[loc]>1?'s':''}</div></div>`).join(''));
        
        Dashboard.renderLogbook();
    }
    
    renderDashboard(); 
});
