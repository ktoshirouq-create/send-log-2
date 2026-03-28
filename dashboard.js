document.addEventListener('DOMContentLoaded', () => {
    const raw = localStorage.getItem('climbingLogs') || localStorage.getItem('climbLogs');
    const logs = JSON.parse(raw || '[]');
    let filter = 'All';
    let charts = {};

    Chart.defaults.color = '#737373';
    Chart.defaults.borderColor = '#262626';

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    const render = () => {
        const f = filter === 'All' ? logs : logs.filter(l => l.type === filter);
        
        // 1. Basic Stats
        document.getElementById('stat-sends').innerText = f.length;
        const outdoorDays = new Set(f.filter(l => String(l.type).includes('Outdoor')).map(l => l.date)).size;
        document.getElementById('stat-outdoor').innerText = filter.includes('Indoor') ? 'N/A' : outdoorDays;
        
        let maxS = 0, peakG = '-';
        f.forEach(l => { if(l.score && l.score > maxS) { maxS = l.score; peakG = l.grade; } });
        document.getElementById('stat-peak').innerText = filter === 'All' ? 'Mix' : peakG.replace(/[⚡👁️🚀🛠️\s]/g, '');

        // 2. Archetype Calculation
        let slabs = 0, overhangs = 0, aero = 0, power = 0;
        f.forEach(l => {
            const stp = (l.angle || "").toLowerCase();
            const sty = (l.climstyles || "").toLowerCase();
            if(stp.includes('slab')) slabs++;
            if(stp.includes('overhang') || stp.includes('roof')) overhangs++;
            if(sty.includes('endurance')) aero++;
            if(sty.includes('power') || sty.includes('cruxy')) power++;
        });

        let archTitle = "The All-Rounder";
        let archSub = "Balanced across all styles and angles.";
        
        if (f.length > 5) {
            if (overhangs > slabs && overhangs > 3) { archTitle = "The Cave Dweller"; archSub = "Gravity is merely a suggestion."; }
            else if (slabs > overhangs && slabs > 3) { archTitle = "The Slab Tactician"; archSub = "Footwork and trust over pure brawn."; }
            else if (aero > power && aero > 3) { archTitle = "The Marathoner"; archSub = "Endurance for days."; }
            else if (power > aero && power > 3) { archTitle = "The Brawler"; archSub = "High impact, powerful movement."; }
        } else if (f.length === 0) {
            archTitle = "No Data"; archSub = "Log some climbs to discover your archetype.";
        }
        
        document.getElementById('arch-title').innerText = archTitle;
        document.getElementById('arch-sub').innerText = archSub;

        // 3. Time-Machine Habits (Fallback to Date parsing)
        const days = {}, times = {};
        f.forEach(l => {
            let actualDay = l.day;
            if (!actualDay && l.date) {
                // If log is old and has no 'day' string, calculate it from the date
                const d = new Date(l.date);
                if (!isNaN(d)) actualDay = dayNames[d.getDay()].substring(0,3); // "Mon", "Tue"
            }
            if(actualDay) {
                const shortDay = actualDay.substring(0,3);
                days[shortDay] = (days[shortDay] || 0) + 1;
            }
            if(l.timeofday) times[l.timeofday] = (times[l.timeofday] || 0) + 1;
        });

        document.getElementById('habit-day').innerText = Object.keys(days).length ? Object.keys(days).reduce((a, b) => days[a] > days[b] ? a : b) : 'N/A';
        document.getElementById('habit-time').innerText = Object.keys(times).length ? Object.keys(times).reduce((a, b) => times[a] > times[b] ? a : b) : 'N/A';

        // Destroy Old Charts
        Object.values(charts).forEach(c => c.destroy());

        // 4. Energy Systems (With Empty State Fix)
        let energyData = [], energyColors = [];
        if (aero === 0 && power === 0) {
            energyData = [1]; 
            energyColors = ['#262626']; // Empty Gray Ring
        } else {
            energyData = [aero, power];
            energyColors = ['#2196F3', '#F44336']; // Blue Aero / Red Power
        }
        
        charts.energy = new Chart(document.getElementById('energyChart'), {
            type: 'doughnut',
            data: { labels: ['Aero', 'Power'], datasets: [{ data: energyData, backgroundColor: energyColors, borderWidth:0 }] },
            options: { maintainAspectRatio: false, cutout: '75%', plugins: { legend: { display: false }, tooltip: { enabled: aero > 0 || power > 0 } } }
        });

        // 5. Grip Matrix
        let g = { Crimps:0, Slopers:0, Pockets:0, Pinches:0, Tufas:0, Jugs:0 };
        let hasGripData = false;
        f.forEach(l => Object.keys(g).forEach(k => { if(String(l.holds).includes(k)) { g[k]++; hasGripData = true; } }));
        
        const gripColor = hasGripData ? 'rgba(156,39,176,0.4)' : 'rgba(38,38,38,0.5)';
        const gripBorder = hasGripData ? '#9C27B0' : '#333';

        charts.grip = new Chart(document.getElementById('gripChart'), {
            type: 'radar',
            data: { labels: Object.keys(g), datasets: [{ data: Object.values(g), borderColor: gripBorder, backgroundColor: gripColor, borderWidth:2, pointRadius: hasGripData ? 3 : 0 }] },
            options: { 
                maintainAspectRatio: false, 
                plugins: { legend: { display: false } }, 
                scales: { r: { min: 0, ticks: { display: false }, grid: { color: '#262626' }, angleLines: { color: '#262626' }, pointLabels: { font: { size: 10, family: 'Inter' } } } } 
            }
        });

        // 6. CNS Tracker
        const now = new Date();
        const weekData = [null, null, null, null];
        const weekGrades = ['','','',''];
        f.forEach(l => {
            if(!l.score || !l.date) return;
            const diff = Math.floor((now - new Date(l.date)) / (1000 * 60 * 60 * 24));
            const bin = diff <= 7 ? 3 : diff <= 14 ? 2 : diff <= 21 ? 1 : diff <= 28 ? 0 : -1;
            if(bin >= 0 && (weekData[bin] === null || l.score > weekData[bin])) {
                weekData[bin] = l.score;
                weekGrades[bin] = l.grade.replace(/[⚡👁️🚀🛠️\s]/g, '');
            }
        });
        
        let validScores = weekData.filter(v => v !== null);
        let minS = validScores.length > 0 ? Math.min(...validScores) - 20 : 0;

        charts.cns = new Chart(document.getElementById('cnsChart'), {
            type: 'line',
            data: { labels: ['W1', 'W2', 'W3', 'W4'], datasets: [{ data: weekData, borderColor: '#00BCD4', tension: 0.4, fill: true, backgroundColor: 'rgba(0,188,212,0.1)', pointRadius:5, spanGaps: true }] },
            options: { maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => ' Peak: ' + weekGrades[ctx.dataIndex] } } }, scales: { y: { display: false, min: minS }, x: { grid: { display: false } } } }
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
