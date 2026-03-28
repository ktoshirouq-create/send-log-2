document.addEventListener('DOMContentLoaded', () => {
    const raw = localStorage.getItem('climbingLogs') || localStorage.getItem('climbLogs');
    const logs = JSON.parse(raw || '[]');
    let filter = 'All';
    let charts = {};

    Chart.defaults.color = '#737373';
    Chart.defaults.borderColor = '#262626';

    const render = () => {
        const f = filter === 'All' ? logs : logs.filter(l => l.type === filter);
        
        // Stats
        document.getElementById('stat-sends').innerText = f.length;
        const outdoorDays = new Set(f.filter(l => l.type.includes('Outdoor')).map(l => l.date)).size;
        document.getElementById('stat-outdoor').innerText = filter.includes('Indoor') ? 'N/A' : outdoorDays;
        
        let maxS = 0, peakG = '-';
        f.forEach(l => { if(l.score > maxS) { maxS = l.score; peakG = l.grade; } });
        document.getElementById('stat-peak').innerText = filter === 'All' ? 'Mix' : peakG.replace(/[⚡👁️🚀🛠️\s]/g, '');

        // HABITS
        const days = {}, times = {};
        f.forEach(l => {
            if(l.day) days[l.day] = (days[l.day] || 0) + 1;
            if(l.timeofday) times[l.timeofday] = (times[l.timeofday] || 0) + 1;
        });
        document.getElementById('habit-day').innerText = Object.keys(days).reduce((a, b) => days[a] > days[b] ? a : b, '-');
        document.getElementById('habit-time').innerText = Object.keys(times).reduce((a, b) => times[a] > times[b] ? a : b, '-');

        // Kill old charts
        Object.values(charts).forEach(c => c.destroy());

        // Energy Systems (Aero vs Power)
        let aero = 0, power = 0;
        f.forEach(l => { 
            const t = (l.climstyles || "").toLowerCase();
            if(t.includes('endurance')) aero++; else power++; 
        });
        charts.energy = new Chart(document.getElementById('energyChart'), {
            type: 'doughnut',
            data: { labels: ['Aero (Endurance)', 'Power (Hard)'], datasets: [{ data: [aero||1, power||1], backgroundColor: ['#2196F3', '#F44336'], borderWidth:0 }] },
            options: { maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });

        // Grip Matrix
        let g = { Crimps:0, Slopers:0, Pockets:0, Pinches:0, Tufas:0, Jugs:0 };
        f.forEach(l => Object.keys(g).forEach(k => { if(String(l.holds).includes(k)) g[k]++; }));
        charts.grip = new Chart(document.getElementById('gripChart'), {
            type: 'radar',
            data: { labels: Object.keys(g), datasets: [{ data: Object.values(g), borderColor: '#9C27B0', backgroundColor: 'rgba(156,39,176,0.2)', borderWidth:2, pointRadius:3 }] },
            options: { 
                maintainAspectRatio: false, 
                plugins: { legend: { display: false } }, 
                scales: { r: { ticks: { display: false }, grid: { color: '#333' }, angleLines: { color: '#333' }, pointLabels: { font: { size: 10 } } } } 
            }
        });

        // CNS Tracker
        const now = new Date();
        const weekData = [null, null, null, null];
        const weekGrades = ['','','',''];
        f.forEach(l => {
            const diff = Math.floor((now - new Date(l.date)) / (1000 * 60 * 60 * 24));
            const bin = diff <= 7 ? 3 : diff <= 14 ? 2 : diff <= 21 ? 1 : diff <= 28 ? 0 : -1;
            if(bin >= 0 && (weekData[bin] === null || l.score > weekData[bin])) {
                weekData[bin] = l.score;
                weekGrades[bin] = l.grade.replace(/[⚡👁️🚀🛠️\s]/g, '');
            }
        });
        charts.cns = new Chart(document.getElementById('cnsChart'), {
            type: 'line',
            data: { labels: ['W1', 'W2', 'W3', 'W4'], datasets: [{ data: weekData, borderColor: '#00BCD4', tension: 0.4, fill: true, backgroundColor: 'rgba(0,188,212,0.1)', pointRadius:5 }] },
            options: { 
                maintainAspectRatio: false, 
                plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => ' Peak: ' + weekGrades[ctx.dataIndex] } } }, 
                scales: { y: { display: false }, x: { grid: { display: false } } } 
            }
        });
    };

    document.querySelectorAll('.filter-pill').forEach(p => p.addEventListener('click', (e) => {
        document.querySelectorAll('.filter-pill').forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');
        filter = e.target.dataset.filter;
        render();
    }));
    render();
});
