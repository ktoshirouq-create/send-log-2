// EXHIBIT D: The Shared Config (Keeps Dashboard & Mobile perfectly synced)
const AppConfig = {
    gyms: ["OKS", "Torshov", "Løkka", "Bryn", "Gneiss", "Other"],
    months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    days: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    disciplines: ['Indoor Rope Climbing', 'Indoor Bouldering', 'Outdoor Rope Climbing', 'Outdoor Bouldering'],
    styles: { 'project': 'Project', 'quick': 'Send', 'flash': 'Flash', 'onsight': 'Onsight', 'worked': 'Worked' },
    grades: {
        ropes: { labels: ["5c","5c+","6a","6a+","6b","6b+","6c","6c+","7a","7a+","7b","7b+"], scores: [567,583,600,617,633,650,667,683,700,717,733,750], colors: [] },
        bouldsIn: { labels: ["4","5","6A","6B","6C","7A","7B"], scores: [400,500,600,633,667,700,733], colors: ["#ffffff", "#22c55e", "#3b82f6", "#eab308", "#ef4444", "#3f3f46", "#a855f7"] },
        bouldsOut: { labels: ["3","4","5","5+","6A","6A+","6B","6B+","6C","6C+","7A","7A+","7B","7B+","7C"], scores: [300,400,500,550,600,617,633,650,667,683,700,717,733,750,767], colors: [] }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    // V32 FIX: Pointing to the new Master Vaults
    const allLogs = JSON.parse(localStorage.getItem('crag_climbs_master') || '[]');
    const allSessions = JSON.parse(localStorage.getItem('crag_sessions_master') || '[]');
    
    let activeDisc = 'All';
    let activeTime = 'All';
    let charts = { pie: null, radar: null, line: null, pyr: null };
    
    Chart.defaults.color = '#737373';
    Chart.defaults.borderColor = '#262626';

    const getBaseGrade = (g) => String(g || "").replace(/[⚡💎🚀🛠️❌\s]/g, '');
    const getScaleConfig = (disc) => {
        if (disc === 'Indoor Bouldering') return AppConfig.grades.bouldsIn;
        if (disc === 'Outdoor Bouldering') return AppConfig.grades.bouldsOut;
        return AppConfig.grades.ropes;
    };

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
        let filteredLogs = allLogs.filter(l => {
            if (activeDisc !== 'All' && l.Type !== activeDisc) return false;
            if (activeTime === 'All') return true;
            
            const logDate = new Date(l.Date);
            const diffDays = (now - logDate) / (1000 * 60 * 60 * 24);
            return diffDays <= parseInt(activeTime);
        });

        // 1. HERO STATS
        document.getElementById('stat-sends').innerText = filteredLogs.length;
        const outDays = new Set(filteredLogs.filter(l => String(l.Type).includes('Outdoor')).map(l => l.Date)).size;
        document.getElementById('stat-outdoor').innerText = activeDisc.includes('Indoor') ? 'N/A' : outDays;
        
        let maxScore = 0, peakG = '-';
        filteredLogs.forEach(l => { if (l.Score && Number(l.Score) > maxScore && l.Style !== 'worked') { maxScore = Number(l.Score); peakG = l.Grade; } });
        document.getElementById('stat-peak').innerText = (filteredLogs.length === 0) ? '-' : (activeDisc === 'All' ? 'Mix' : getBaseGrade(peakG));

        // 2. CLIMBER IDENTITY
        let dayC = {}, timeC = {}, indoorCount = 0;
        filteredLogs.forEach(l => { 
            const d = new Date(l.Date).getDay();
            const dayName = AppConfig.days[d];
            dayC[dayName] = (dayC[dayName] || 0) + 1; 
            if (String(l.Type).includes('Indoor')) indoorCount++;
        });
        
        const topDay = Object.keys(dayC).length ? Object.keys(dayC).reduce((a, b) => dayC[a] > dayC[b] ? a : b) : '-';
        
        let envLabel = '-';
        if (filteredLogs.length > 0) {
            const inRatio = indoorCount / filteredLogs.length;
            if (inRatio >= 0.8) envLabel = 'Gym Rat 🐀';
            else if (inRatio <= 0.4) envLabel = 'Crag Hound 🐺';
            else envLabel = 'Weekend Warrior 🏕️';
        }

        document.getElementById('id-day').innerText = topDay;
        document.getElementById('id-env').innerText = envLabel;
        document.getElementById('id-arch').innerText = 'Data Miner 🔒'; // Evolving this later!

        Object.values(charts).forEach(c => { if(c) c.destroy(); });

        // 3. SEND PYRAMID
        const pyrCanvas = document.getElementById('pyramidChart');
        const pyrOverlay = document.getElementById('pyramidOverlay');

        if (activeDisc === 'All' || filteredLogs.length === 0) {
            pyrCanvas.style.display = 'none';
            pyrOverlay.style.display = 'flex';
        } else {
            pyrCanvas.style.display = 'block';
            pyrOverlay.style.display = 'none';
            
            const grades = {};
            const conf = getScaleConfig(activeDisc);
            
            filteredLogs.forEach(l => {
                if (l.Score && l.Style !== 'worked') {
                    const clean = getBaseGrade(l.Grade);
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

        // 4. CNS PEAK & FATIGUE OVERLAY
        const sortedCNS = [...filteredLogs].filter(l=>l.Score && l.Style !== 'worked').sort((a,b) => new Date(a.Date) - new Date(b.Date));
        const cnsData = { labels: ['W4', 'W3', 'W2', 'W1'], peak: [null, null, null, null], grades: ['-','-','-','-'], fatigue: [0,0,0,0] };
        const weekBins = [[],[],[],[]]; // Oldest to Newest
        const sessionBins = [[],[],[],[]];

        sortedCNS.forEach(l => {
            const diffDays = Math.floor((now - new Date(l.Date)) / (1000 * 60 * 60 * 24));
            if (diffDays <= 7) weekBins[3].push(l); 
            else if (diffDays <= 14) weekBins[2].push(l); 
            else if (diffDays <= 21) weekBins[1].push(l); 
            else if (diffDays <= 28) weekBins[0].push(l);
        });

        // Map fatigue from sessions
        allSessions.forEach(s => {
            const diffDays = Math.floor((now - new Date(s.Date)) / (1000 * 60 * 60 * 24));
            if (diffDays <= 28 && s.Fatigue) {
                let binIdx = -1;
                if (diffDays <= 7) binIdx = 3; else if (diffDays <= 14) binIdx = 2; else if (diffDays <= 21) binIdx = 1; else if (diffDays <= 28) binIdx = 0;
                sessionBins[binIdx].push(Number(s.Fatigue));
            }
        });

        weekBins.forEach((bin, i) => {
            if (bin.length > 0) {
                const maxLog = bin.reduce((max, cur) => Number(cur.Score) > Number(max.Score) ? cur : max);
                cnsData.peak[i] = Number(maxLog.Score); 
                cnsData.grades[i] = getBaseGrade(maxLog.Grade);
            }
            if (sessionBins[i].length > 0) {
                cnsData.fatigue[i] = sessionBins[i].reduce((a,b)=>a+b, 0) / sessionBins[i].length; // Average fatigue
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

        // 5. ENERGY SYSTEMS & GRIP MATRIX
        let aero = 0, ancap = 0, power = 0;
        let grips = { 'Crimps':0, 'Slopers':0, 'Pockets':0, 'Pinches':0, 'Tufas':0, 'Jugs':0 };
        filteredLogs.forEach(l => {
            const st = (l.ClimStyles || "").toLowerCase();
            if(st.includes('endurance')) aero++; else if(st.includes('cruxy')) power++; else if(st.includes('athletic')) ancap++;
            Object.keys(grips).forEach(g => { if((l.Holds || "").includes(g)) grips[g]++; });
        });
        if(aero===0 && ancap===0 && power===0) { aero=1; ancap=1; power=1; } 
        charts.pie = new Chart(document.getElementById('energyPieChart'), { type: 'doughnut', data: { labels: ['Aero', 'AnCap', 'Power'], datasets: [{ data: [aero, ancap, power], backgroundColor: ['#2196F3', '#FF9800', '#F44336'], borderColor: '#171717' }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } });
        charts.radar = new Chart(document.getElementById('gripRadarChart'), { type: 'radar', data: { labels: Object.keys(grips), datasets: [{ data: Object.values(grips), borderColor: '#9C27B0', backgroundColor: 'rgba(156, 39, 176, 0.2)' }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { r: { ticks: { display: false }, grid: { color: '#333' }, angleLines: { color: '#333' } } } } });

        // 6. LISTS
        const renderList = (id, html) => { document.getElementById(id).innerHTML = html || '<div class="empty-msg">No logs fit this criteria.</div>'; };
        
        const hof = [...filteredLogs].filter(l => Number(l.Rating) >= 4).sort((a,b)=>(Number(b.Score)||0)-(Number(a.Score)||0)).slice(0,5);
        renderList('list-fame', hof.map(l => `<div class="list-item"><div><div class="list-main">${l.Name.split('@')[0]}</div><div class="list-sub">${'★'.repeat(l.Rating)}</div></div><div class="list-badge">${getBaseGrade(l.Grade)}</div></div>`).join(''));

        const limit = [...filteredLogs].filter(l => (l.Effort||"").includes('Limit') || (l.GradeFeel||"").includes('Hard')).sort((a,b)=>(Number(b.Score)||0)-(Number(a.Score)||0)).slice(0,5);
        renderList('list-limit', limit.map(l => `<div class="list-item"><div><div class="list-main">${l.Name.split('@')[0]}</div><div class="list-sub">${formatShortDate(l.Date)}</div></div><div class="list-badge" style="color:#ef4444;">${getBaseGrade(l.Grade)}</div></div>`).join(''));

        let steepHTML = '';
        AppConfig.steepness.forEach(st => {
            const logsForSt = filteredLogs.filter(l => (l.Angle||"").includes(st) && l.Score);
            if(logsForSt.length > 0) {
                const peak = logsForSt.reduce((max, cur) => Number(cur.Score) > Number(max.Score) ? cur : max);
                steepHTML += `<div class="list-item"><div class="list-main">${st}</div><div class="list-badge" style="color:#3b82f6;">${getBaseGrade(peak.Grade)}</div></div>`;
            } else steepHTML += `<div class="list-item"><div class="list-main" style="color:#555;">${st}</div><div class="list-badge" style="background:transparent; color:#555;">-</div></div>`;
        });
        renderList('list-steepness', steepHTML);

        const locs = {};
        filteredLogs.forEach(l => { let n = l.Name; if(n && n.includes('@')) n = n.split('@')[1].trim(); locs[n] = (locs[n] || 0) + 1; });
        const topLocs = Object.keys(locs).sort((a,b)=>locs[b]-locs[a]).slice(0,5);
        renderList('list-locations', topLocs.map(loc => `<div class="list-item"><div class="list-main">${loc}</div><div class="list-badge" style="color:#fff; background:#333;">${locs[loc]} Session${locs[loc]>1?'s':''}</div></div>`).join(''));
    }
    
    renderDashboard(); 
});
