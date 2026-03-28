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
    Chart.defaults.color = '#737373';
    Chart.defaults.borderColor = '#262626';

    function renderDashboard() {
        const filteredLogs = activeFilter === 'All' ? allLogs : allLogs.filter(l => l.type === activeFilter);
        
        // --- HABITS CALCULATION ---
        const dayMap = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayCounts = {}, timeCounts = {};
        filteredLogs.forEach(l => {
            const d = new Date(l.date).getDay();
            dayCounts[dayMap[d]] = (dayCounts[dayMap[d]] || 0) + 1;
            ['Morning', 'Afternoon', 'Evening'].forEach(t => {
                if (String(l.tags).includes(t)) timeCounts[t] = (timeCounts[t] || 0) + 1;
            });
        });
        document.getElementById('habit-day').innerText = Object.keys(dayCounts).reduce((a,b) => dayCounts[a] > dayCounts[b] ? a : b, '-');
        document.getElementById('habit-time').innerText = Object.keys(timeCounts).reduce((a,b) => timeCounts[a] > timeCounts[b] ? a : b, '-');

        // --- STATS ---
        document.getElementById('stat-sends').innerText = filteredLogs.length;
        const outdoorDays = new Set(filteredLogs.filter(l => String(l.type).includes('Outdoor')).map(l => l.date)).size;
        document.getElementById('stat-outdoor').innerText = outdoorDays;
        
        let maxS = 0, peakG = '-';
        filteredLogs.forEach(l => { if(l.score > maxS) { maxS = l.score; peakG = l.grade; } });
        document.getElementById('stat-peak').innerText = activeFilter === 'All' ? 'Mix' : peakG.replace(/[⚡👁️🚀🛠️\s]/g, '');

        // --- CHARTS ---
        Object.values(charts).forEach(c => { if(c) c.destroy(); });

        charts.pie = new Chart(document.getElementById('energyPieChart'), {
            type: 'doughnut',
            data: { labels: ['Aero', 'AnCap', 'Power'], datasets: [{ data: [1,1,1], backgroundColor: ['#2196F3', '#FF9800', '#F44336'] }] },
            options: { maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });

        charts.radar = new Chart(document.getElementById('gripRadarChart'), {
            type: 'radar',
            data: { labels: ['Crimps', 'Slopers', 'Pockets', 'Pinches', 'Tufas', 'Jugs'], datasets: [{ data: [1,1,1,1,1,1], borderColor: '#9C27B0', backgroundColor: 'rgba(156,39,176,0.1)' }] },
            options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { r: { ticks: { display: false } } } }
        });

        // CNS with NULL fix
        const weeks = [null, null, null, filteredLogs[0]?.score || null];
        charts.line = new Chart(document.getElementById('cnsLineChart'), {
            type: 'line',
            data: { labels: ['W1', 'W2', 'W3', 'W4'], datasets: [{ data: weeks, borderColor: '#00BCD4', tension: 0.4 }] },
            options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { display: false } } }
        });

        // --- LISTS & GRAMMAR FIX ---
        const locCounts = {};
        filteredLogs.forEach(l => { const loc = l.name.split('@')[1] || l.name; locCounts[loc] = (locCounts[loc] || 0) + 1; });
        document.getElementById('list-locations').innerHTML = Object.keys(locCounts).sort((a,b)=>locCounts[b]-locCounts[a]).slice(0,5).map(loc => `
            <div class="list-item">
                <div style="font-weight:bold;">${loc}</div>
                <div class="list-badge" style="background:#262626; color:#fff;">${locCounts[loc]} Session${locCounts[loc] === 1 ? '' : 's'}</div>
            </div>`).join('');
    }
    renderDashboard();
});
