document.addEventListener('DOMContentLoaded', () => {
    // 1. Pull Data from Main App Memory
    const rawData = localStorage.getItem('climbingLogs') || localStorage.getItem('climbLogs'); 
    const logs = rawData ? JSON.parse(rawData) : [];

    // 2. Archetype Engine
    function determineArchetype(data) {
        if (!data || data.length === 0) return null;

        let scores = { balletDancer: 0, caveDweller: 0, hangdog: 0, masochist: 0, longDistance: 0 };

        data.forEach(log => {
            if (!log.tags) return;
            const t = log.tags.toLowerCase();
            
            if (t.includes('slab') || t.includes('vertical') || t.includes('technical')) scores.balletDancer++;
            if (t.includes('overhang') || t.includes('roof') || t.includes('athletic')) scores.caveDweller++;
            if (t.includes('project') || t.includes('limit')) scores.hangdog++;
            if (t.includes('endurance') || t.includes('pumped') || t.includes('tufas')) scores.masochist++;
            if (t.includes('breezy') || t.includes('flash') || t.includes('onsight')) scores.longDistance++;
        });

        let topArchetype = Object.keys(scores).reduce((a, b) => scores[a] > scores[b] ? a : b);
        if (scores[topArchetype] === 0) return null; 

        const archetypes = {
            balletDancer: { title: "🩰 The Ballet Dancer", roast: '"A pure glide. No pull required."' },
            caveDweller: { title: "🦇 The Cave Dweller", roast: '"Technique is for ballet dancers!"' },
            hangdog: { title: "🐕 The Hangdog Specialist", roast: '"My rope is my sanctuary."' },
            masochist: { title: "🩸 The Masochist", roast: '"If I\'m not crying, it\'s only a warm-up."' },
            longDistance: { title: "🏔️ The Long Distance Climber", roast: '"Just logging my vertical junk miles."' }
        };

        return archetypes[topArchetype];
    }

    // Inject Archetype
    const currentArchetype = determineArchetype(logs);
    if (currentArchetype) {
        document.getElementById('arch-title').innerText = currentArchetype.title;
        document.getElementById('arch-roast').innerText = currentArchetype.roast;
    }

    // --- DATA PROCESSING ENGINE ---
    
    // Process Pyramid (Last 60 Days)
    const sixtyDaysAgo = new Date(); sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    const recentLogs = logs.filter(l => new Date(l.date || Date.now()) >= sixtyDaysAgo);
    let pyramidMap = {};
    recentLogs.forEach(l => {
        if(!l.grade || !l.score) return;
        let g = l.grade.replace(/[⚡👁️🚀🛠️\s]/g, '');
        if(!pyramidMap[g]) pyramidMap[g] = { count: 0, score: l.score };
        pyramidMap[g].count++;
    });
    let pyrSorted = Object.keys(pyramidMap).sort((a,b) => pyramidMap[a].score - pyramidMap[b].score);
    let pyrLabels = pyrSorted.length ? pyrSorted : ['No Data'];
    let pyrData = pyrSorted.length ? pyrSorted.map(g => pyramidMap[g].count) : [0];

    // Process Energy Pie
    let aero = 0, ancap = 0, maxp = 0;
    logs.forEach(l => {
        const t = (l.tags || '').toLowerCase();
        if(t.includes('endurance') || t.includes('breezy') || t.includes('slab')) aero++;
        if(t.includes('cruxy') || t.includes('pumped') || t.includes('solid')) ancap++;
        if(t.includes('athletic') || t.includes('limit') || t.includes('roof') || t.includes('dynamic')) maxp++;
    });
    if(aero===0 && ancap===0 && maxp===0) { aero=1; ancap=1; maxp=1; } // Prevent empty chart

    // Process Grip Radar
    let holds = { 'Crimps': 0, 'Slopers': 0, 'Pockets': 0, 'Pinches': 0, 'Jugs': 0, 'Tufas': 0 };
    logs.forEach(l => {
        const t = (l.tags || '');
        Object.keys(holds).forEach(h => { if (t.includes(h)) holds[h]++; });
    });

    // --- CHART DEFAULTS (The UI Cleanup) ---
    Chart.defaults.color = '#737373';
    Chart.defaults.font.family = "'Inter', sans-serif";
    
    const baseOptions = { 
        responsive: true, 
        maintainAspectRatio: false, 
        plugins: { 
            legend: { display: false } // Legend Killer
        } 
    };

    const radarOptions = {
        ...baseOptions,
        scales: {
            r: {
                ticks: { display: false, maxTicksLimit: 5 }, // Radar Number Killer
                grid: { color: '#262626' },
                angleLines: { color: '#262626' },
                pointLabels: { color: '#a3a3a3', font: { size: 11, weight: 'bold' } }
            }
        }
    };

    const lineOptions = {
        ...baseOptions,
        scales: {
            y: { grid: { color: '#262626' } },
            x: { grid: { display: false } }
        }
    };

    // --- RENDER CHARTS ---
    
    // 1. Pyramid
    new Chart(document.getElementById('pyramidChart'), { 
        type: 'bar', 
        data: { labels: pyrLabels, datasets: [{ data: pyrData, backgroundColor: '#10b981', borderRadius: 4 }] }, 
        options: lineOptions 
    });
    
    // 2. Energy Pie
    new Chart(document.getElementById('energyPieChart'), { 
        type: 'doughnut', 
        data: { labels: ['AeroCap', 'AnCap', 'Max Power'], datasets: [{ data: [aero, ancap, maxp], backgroundColor: ['#3b82f6', '#eab308', '#ef4444'], borderWidth: 2, borderColor: '#171717' }] }, 
        options: { ...baseOptions, cutout: '65%' } 
    });
    
    // 3. Grip Radar
    new Chart(document.getElementById('gripRadarChart'), { 
        type: 'radar', 
        data: { labels: Object.keys(holds), datasets: [{ data: Object.values(holds), backgroundColor: 'rgba(168, 85, 247, 0.2)', borderColor: '#a855f7', borderWidth: 2, pointBackgroundColor: '#a855f7' }] }, 
        options: radarOptions 
    });
    
    // 4. CNS Line (Placeholder for complex chronological grouping)
    new Chart(document.getElementById('cnsLineChart'), { 
        type: 'line', 
        data: { labels: ['W1', 'W2', 'W3', 'W4'], datasets: [{ data: [1, 2, 4, 3], borderColor: '#0ea5e9', backgroundColor: 'rgba(14, 165, 233, 0.1)', fill: true, tension: 0.4 }] }, 
        options: lineOptions 
    });
});
