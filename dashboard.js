document.addEventListener('DOMContentLoaded', () => {
    const allLogs = JSON.parse(localStorage.getItem('climbingLogs') || localStorage.getItem('climbLogs') || '[]');
    let activeDisc = 'All';
    let activeTime = 'All';
    let charts = { pie: null, radar: null, line: null, pyr: null };
    
    Chart.defaults.color = '#737373';
    Chart.defaults.borderColor = '#262626';

    const getBaseGrade = (g) => String(g || "").replace(/[⚡💎🚀🛠️\s]/g, '');

    const attachFilters = (id, propName) => {
        document.querySelectorAll(`#${id} .filter-pill`).forEach(pill => {
            pill.addEventListener('click', (e) => {
                document.querySelectorAll(`#${id} .filter-pill`).forEach(p => p.classList.remove('active'));
                e.target.classList.add('active');
                if (propName === 'disc') activeDisc = e.target.getAttribute('data-filter');
                if (propName === 'time') activeTime = e.target.getAttribute('data-time');
                renderDashboard();
            });
        });
    };
    attachFilters('disc-filter', 'disc');
    attachFilters('time-filter', 'time');

    function renderDashboard() {
        const now = new Date();
        let filteredLogs = allLogs.filter(l => {
            if (activeDisc !== 'All' && l.type !== activeDisc) return false;
            if (activeTime === 'All') return true;
            
            const logDate = new Date(l.date);
            if (activeTime === 'YTD') return logDate.getFullYear() === now.getFullYear();
            
            const diffDays = (now - logDate) / (1000 * 60 * 60 * 24);
            return diffDays <= parseInt(activeTime);
        });

        document.getElementById('stat-sends').innerText = filteredLogs.length;
        const outDays = new Set(filteredLogs.filter(l => String(l.type).includes('Outdoor')).map(l => l.date)).size;
        document.getElementById('stat-outdoor').innerText = activeDisc.includes('Indoor') ? 'N/A' : outDays;
        
        let maxScore = 0, peakG = '-';
        filteredLogs.forEach(l => { if (l.score && l.score > maxScore) { maxScore = l.score; peakG = l.grade; } });
        document.getElementById('stat-peak').innerText = (filteredLogs.length === 0) ? '-' : (activeDisc === 'All' ? 'Mix' : getBaseGrade(peakG));

        let dayC = {}, timeC = {};
        filteredLogs.forEach(l => { 
            if (l.day) dayC[l.day] = (dayC[l.day] || 0) + 1; 
            if (l.timeofday) timeC[l.timeofday] = (timeC[l.timeofday] || 0) + 1; 
        });
        const topDay = Object.keys(dayC).length ? Object.keys(dayC).reduce((a, b) => dayC[a] > dayC[b] ? a : b) : '-';
        const topTime = Object.keys(timeC).length ? Object.keys(timeC).reduce((a, b) => timeC[a] > timeC[b] ? a : b) : '-';
        document.getElementById('habit-day').innerText = topDay;
        document.getElementById('habit-time').innerText = topTime;

        Object.values(charts).forEach(c => { if(c) c.destroy(); });

        const grades = {};
        filteredLogs.forEach(l => {
            if (l.score) {
                const clean = getBaseGrade(l.grade);
                grades[clean] = (grades[clean] || 0) + 1;
            }
        });
        const sortedGrades = Object.keys(grades).sort((a,b) => a.localeCompare(b));
        const pyrData = sortedGrades.map(g => grades[g]);

        charts.pyr = new Chart(document.getElementById('pyramidChart'), {
            type: 'bar',
            data: { labels: sortedGrades, datasets: [{ data: pyrData, backgroundColor: '#10b981', borderRadius: 4 }] },
            options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { display: false } } }
        });

        const sortedCNS = [...filteredLogs].filter(l=>l.score).sort((a,b) => new Date(a.date) - new Date(b.date));
        const cnsData = { labels: ['W1', 'W2', 'W3', 'W4'], data: [null, null, null, null], grades: ['-','-','-','-'] };
        const weekBins = [[],[],[],[]];
        sortedCNS.forEach(l => {
            const diffDays = Math.floor((now - new Date(l.date)) / (1000 * 60 * 60 * 24));
            if (diffDays <= 7) weekBins[3].push(l); else if (diffDays <= 14) weekBins[2].push(l); else if (diffDays <= 21) weekBins[1].push(l); else if (diffDays <= 28) weekBins[0].push(l);
        });
        weekBins.forEach((bin, i) => {
            if (bin.length > 0) {
                const maxLog = bin.reduce((max, cur) => cur.score > max.score ? cur : max);
                cnsData.data[i] = maxLog.score; cnsData.grades[i] = getBaseGrade(maxLog.grade);
            }
        });
        let gL = document.getElementById('cnsLineChart').getContext('2d').createLinearGradient(0,0,0,300); gL.addColorStop(0, 'rgba(0,188,212,0.4)'); gL.addColorStop(1, 'transparent');
        charts.line = new Chart(document.getElementById('cnsLineChart'), {
            type: 'line', data: { labels: cnsData.labels, datasets: [{ data: cnsData.data, borderColor: '#00BCD4', backgroundColor: gL, fill: true, tension: 0.4, spanGaps: true }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => ' Peak: ' + cnsData.grades[ctx.dataIndex] } } }, scales: { y: { display: false }, x: { grid: { display: false } } } }
        });

        let aero = 0, ancap = 0, power = 0;
        let grips = { 'Crimps':0, 'Slopers':0, 'Pockets':0, 'Pinches':0, 'Tufas':0, 'Jugs':0 };
        filteredLogs.forEach(l => {
            const st = (l.climstyles || "").toLowerCase();
            if(st.includes('endurance')) aero++; else if(st.includes('cruxy')) power++; else if(st.includes('athletic')) ancap++;
            Object.keys(grips).forEach(g => { if((l.holds || "").includes(g)) grips[g]++; });
        });
        if(aero===0 && ancap===0 && power===0) { aero=1; ancap=1; power=1; } 
        charts.pie = new Chart(document.getElementById('energyPieChart'), { type: 'doughnut', data: { labels: ['Aero', 'AnCap', 'Power'], datasets: [{ data: [aero, ancap, power], backgroundColor: ['#2196F3', '#FF9800', '#F44336'], borderColor: '#171717' }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } });
        charts.radar = new Chart(document.getElementById('gripRadarChart'), { type: 'radar', data: { labels: Object.keys(grips), datasets: [{ data: Object.values(grips), borderColor: '#9C27B0', backgroundColor: 'rgba(156, 39, 176, 0.2)' }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { r: { ticks: { display: false } } } } });

        const renderList = (id, html) => { document.getElementById(id).innerHTML = html || '<div class="empty-msg">No logs fit this criteria.</div>'; };
        
        const hof = [...filteredLogs].filter(l => Number(l.rating) >= 4).sort((a,b)=>(b.score||0)-(a.score||0)).slice(0,5);
        renderList('list-fame', hof.map(l => `<div class="list-item"><div><div class="list-main">${l.name}</div><div class="list-sub">${l.rating} Stars</div></div><div class="list-badge">${getBaseGrade(l.grade)}</div></div>`).join(''));

        const limit = [...filteredLogs].filter(l => (l.effort||"").includes('Limit') || (l.gradefeel||"").includes('Hard')).sort((a,b)=>(b.score||0)-(a.score||0)).slice(0,5);
        renderList('list-limit', limit.map(l => `<div class="list-item"><div><div class="list-main">${l.name}</div><div class="list-sub">${l.date}</div></div><div class="list-badge" style="color:#ef4444;">${getBaseGrade(l.grade)}</div></div>`).join(''));

        let steepHTML = '';
        ['Slab', 'Vertical', 'Overhang', 'Roof'].forEach(st => {
            const logsForSt = filteredLogs.filter(l => (l.angle||"").includes(st));
            if(logsForSt.length > 0) {
                const peak = logsForSt.reduce((max, cur) => (cur.score || 0) > (max.score || 0) ? cur : max);
                steepHTML += `<div class="list-item"><div class="list-main">${st}</div><div class="list-badge" style="color:#3b82f6;">${getBaseGrade(peak.grade)}</div></div>`;
            } else steepHTML += `<div class="list-item"><div class="list-main" style="color:#555;">${st}</div><div class="list-badge" style="background:transparent; color:#555;">-</div></div>`;
        });
        renderList('list-steepness', steepHTML);

        const locs = {};
        filteredLogs.forEach(l => { let n = l.name; if(n && n.includes('@')) n = n.split('@')[1].trim(); locs[n] = (locs[n] || 0) + 1; });
        const topLocs = Object.keys(locs).sort((a,b)=>locs[b]-locs[a]).slice(0,5);
        renderList('list-locations', topLocs.map(loc => `<div class="list-item"><div class="list-main">${loc}</div><div class="list-badge" style="color:#fff;">${locs[loc]} Session${locs[loc]>1?'s':''}</div></div>`).join(''));
    }
    renderDashboard(); 
});
