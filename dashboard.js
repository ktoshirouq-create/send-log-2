document.addEventListener('DOMContentLoaded', () => {
    const rawData = localStorage.getItem('climbingLogs') || localStorage.getItem('climbLogs');
    const allLogs = rawData ? JSON.parse(rawData) : [];
    let activeFilter = 'All';

    const filterPills = document.querySelectorAll('.filter-pill');
    filterPills.forEach(pill => {
        pill.addEventListener('click', (e) => {
            filterPills.forEach(p => p.classList.remove('active'));
            e.target.classList.add('active');
            activeFilter = e.target.getAttribute('data-filter');
            renderDashboard(); 
        });
    });

    let charts = { pie: null, radar: null, line: null };
    Chart.defaults.color = '#aaa';
    Chart.defaults.borderColor = '#333';

    function renderDashboard() {
        const filteredLogs = activeFilter === 'All' ? allLogs : allLogs.filter(l => l.type === activeFilter);
        
        // --- UPDATE QUICK STATS ---
        document.getElementById('stat-sends').innerText = filteredLogs.length;
        const outdoorLogs = filteredLogs.filter(l => String(l.type).includes('Outdoor'));
        const outdoorDays = new Set(outdoorLogs.map(l => (l.date || '').substring(0,10))).size;
        document.getElementById('stat-outdoor').innerText = activeFilter.includes('Indoor') ? 'N/A' : outdoorDays;
        
        // PEAK GRADE FIX: No comparing apples to oranges
        let maxScore = 0; let peakG = '-';
        filteredLogs.forEach(l => {
            if (l.score && l.score > maxScore) { maxScore = l.score; peakG = l.grade; }
        });
        
        if (filteredLogs.length === 0) {
            document.getElementById('stat-peak').innerText = '-';
        } else if (activeFilter === 'All') {
            document.getElementById('stat-peak').innerText = 'Mix';
        } else {
            document.getElementById('stat-peak').innerText = peakG.replace(/[⚡👁️🚀🛠️\s]/g, '');
        }

        // --- UPDATE ARCHETYPE ---
        let scores = { balletDancer: 0, caveDweller: 0, hangdog: 0, masochist: 0, longDistance: 0 };
        filteredLogs.forEach(log => {
            if (!log.tags && !log.angle) return;
            const t = ((log.tags || "") + " " + (log.angle || "")).toLowerCase();
            
            if (t.includes('slab') || t.includes('vertical') || t.includes('technical')) scores.balletDancer++;
            if (t.includes('overhang') || t.includes('roof') || t.includes('athletic')) scores.caveDweller++;
            if (t.includes('project') || t.includes('limit')) scores.hangdog++;
            if (t.includes('endurance') || t.includes('pumped') || t.includes('hard')) scores.masochist++;
            if (t.includes('breezy') || t.includes('flash') || t.includes('onsight') || t.includes('quick')) scores.longDistance++;
        });
        
        let topArchetype = Object.keys(scores).reduce((a, b) => scores[a] > scores[b] ? a : b);
        if (filteredLogs.length === 0 || scores[topArchetype] === 0) {
            document.getElementById('arch-title').innerText = "Analyzing Data...";
            document.getElementById('arch-roast').innerText = "Log more routes with tags to generate your archetype.";
        } else {
            const archetypes = {
                balletDancer: { title: "🩰 The Ballet Dancer", roast: '"A pure glide. No pull required."' },
                caveDweller: { title: "🦇 The Cave Dweller", roast: '"Technique is for ballet dancers!"' },
                hangdog: { title: "🐕 The Hangdog Specialist", roast: '"My rope is my sanctuary."' },
                masochist: { title: "🩸 The Masochist", roast: '"If I\'m not crying, it\'s only a warm-up."' },
                longDistance: { title: "🏔️ The Long Distance Climber", roast: '"Just logging my vertical junk miles."' }
            };
            document.getElementById('arch-title').innerText = archetypes[topArchetype].title;
            document.getElementById('arch-roast').innerText = archetypes[topArchetype].roast;
        }

        // --- UPDATE CHARTS ---
        Object.values(charts).forEach(c => { if(c) c.destroy(); }); 

        let aero = 0, ancap = 0, power = 0;
        filteredLogs.forEach(l => {
            const t = (l.tags || "").toLowerCase();
            if(t.includes('endurance')) aero++;
            else if(t.includes('cruxy')) power++;
            else if(t.includes('athletic')) ancap++;
        });
        if(aero===0 && ancap===0 && power===0) { aero=1; ancap=1; power=1; } 
        
        charts.pie = new Chart(document.getElementById('energyPieChart'), {
            type: 'doughnut',
            data: { labels: ['AeroCap (Endurance)', 'AnCap (Athletic)', 'Max Power (Cruxy)'], datasets: [{ data: [aero, ancap, power], backgroundColor: ['#2196F3', '#FF9800', '#F44336'], borderWidth: 2, borderColor: '#1e1e1e' }] },
            options: { responsive: true, plugins: { legend: { display: false } } }
        });

        let grips = { 'Crimps':0, 'Slopers':0, 'Pockets':0, 'Pinches':0, 'Tufas':0, 'Jugs':0 };
        filteredLogs.forEach(l => {
            const t = (l.tags || "");
            Object.keys(grips).forEach(g => { if(t.includes(g)) grips[g]++; });
        });
        charts.radar = new Chart(document.getElementById('gripRadarChart'), {
            type: 'radar',
            data: { labels: Object.keys(grips), datasets: [{ data: Object.values(grips), borderColor: '#9C27B0', backgroundColor: 'rgba(156, 39, 176, 0.2)', pointBackgroundColor: '#9C27B0', borderWidth: 2 }] },
            options: { responsive: true, plugins: { legend: { display: false } }, scales: { r: { ticks: { display: false }, grid: { color: '#333' }, angleLines: { color: '#333' } } } }
        });

        // CNS CHART FIX: Using "null" to create clean breaks instead of dropping to zero.
        const sortedLogs = [...filteredLogs].filter(l=>l.score).sort((a,b) => new Date(a.date) - new Date(b.date));
        const cnsData = { labels: ['W1', 'W2', 'W3', 'W4'], data: [null, null, null, null], grades: ['-','-','-','-'] };
        
        const now = new Date();
        const weekBins = [[],[],[],[]];
        sortedLogs.forEach(l => {
            const d = new Date(l.date);
            const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24));
            if (diffDays <= 7) weekBins[3].push(l);
            else if (diffDays <= 14) weekBins[2].push(l);
            else if (diffDays <= 21) weekBins[1].push(l);
            else if (diffDays <= 28) weekBins[0].push(l);
        });
        
        weekBins.forEach((bin, i) => {
            if (bin.length > 0) {
                const maxLog = bin.reduce((max, cur) => cur.score > max.score ? cur : max);
                cnsData.data[i] = maxLog.score;
                cnsData.grades[i] = maxLog.grade.replace(/[⚡👁️🚀🛠️\s]/g, '');
            }
        });

        let validScores = cnsData.data.filter(v => v !== null && v > 0);
        let minS = validScores.length > 0 ? Math.min(...validScores) : 0;
        if(minS > 100) minS -= 50;
        
        let gradient = charts.pie.ctx.createLinearGradient(0, 0, 0, 300); 
        gradient.addColorStop(0, 'rgba(0, 188, 212, 0.4)');
        gradient.addColorStop(1, 'transparent');

        charts.line = new Chart(document.getElementById('cnsLineChart'), {
            type: 'line',
            data: { labels: cnsData.labels, datasets: [{ data: cnsData.data, borderColor: '#00BCD4', backgroundColor: gradient, fill: true, tension: 0.4, pointRadius: 5 }] },
            options: { 
                responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => ' Peak: ' + cnsData.grades[ctx.dataIndex] } } },
                scales: { y: { display: false, min: minS }, x: { grid: { display: false } } }
            }
        });

        // --- UPDATE MEANINGFUL LISTS ---
        const renderList = (id, html) => { document.getElementById(id).innerHTML = html || '<div class="empty-msg">No logs fit this criteria yet.</div>'; };
        
        const hof = [...filteredLogs].filter(l => String(l.tags).includes('4 Star') || String(l.tags).includes('5 Star')).sort((a,b)=>b.score-a.score).slice(0,5);
        renderList('list-fame', hof.map(l => `<div class="list-item"><div><div class="list-main">${l.name}</div><div class="list-sub">${String(l.tags).match(/[45] Star/)?.[0] || '★'}</div></div><div class="list-badge">${l.grade.replace(/[⚡👁️🚀🛠️\s]/g, '')}</div></div>`).join(''));

        const limit = [...filteredLogs].filter(l => String(l.tags).includes('Limit') || String(l.tags).includes('Hard')).sort((a,b)=>b.score-a.score).slice(0,5);
        renderList('list-limit', limit.map(l => `<div class="list-item"><div><div class="list-main">${l.name}</div><div class="list-sub">${(l.date || '').substring(5)}</div></div><div class="list-badge" style="background:rgba(239, 68, 68, 0.15); color:#ef4444;">${l.grade.replace(/[⚡👁️🚀🛠️\s]/g, '')}</div></div>`).join(''));

        const steepTypes = ['Slab', 'Vertical', 'Overhang', 'Roof'];
        let steepHTML = '';
        steepTypes.forEach(st => {
            const logsForSt = filteredLogs.filter(l => (l.angle && l.angle.includes(st)) || (l.tags && l.tags.includes(st)));
            if(logsForSt.length > 0) {
                const peak = logsForSt.reduce((max, cur) => cur.score > max.score ? cur : max);
                steepHTML += `<div class="list-item"><div><div class="list-main">${st}</div></div><div class="list-badge" style="background:rgba(59, 130, 246, 0.15); color:#3b82f6;">${peak.grade.replace(/[⚡👁️🚀🛠️\s]/g, '')}</div></div>`;
            } else {
                steepHTML += `<div class="list-item"><div><div class="list-main" style="color:#555;">${st}</div></div><div class="list-badge" style="background:transparent; color:#555;">-</div></div>`;
            }
        });
        renderList('list-steepness', steepHTML);

        const locCounts = {};
        filteredLogs.forEach(l => {
            let loc = l.name;
            if(loc.includes('@')) loc = loc.split('@')[1].trim(); 
            if(!locCounts[loc]) locCounts[loc] = 0;
            locCounts[loc]++;
        });
        const topLocs = Object.keys(locCounts).sort((a,b)=>locCounts[b]-locCounts[a]).slice(0,5);
        renderList('list-locations', topLocs.map(loc => `<div class="list-item"><div><div class="list-main">${loc}</div></div><div class="list-badge" style="background:#333; color:#fff;">${locCounts[loc]} Sessions</div></div>`).join(''));
    }

    renderDashboard(); 
});
