document.addEventListener('DOMContentLoaded', () => {
    // 1. Pull Data from Main App Memory
    const rawData = localStorage.getItem('climbingLogs'); // Adjust this key if your main app uses a different one
    const logs = rawData ? JSON.parse(rawData) : [];

    // 2. Archetype Engine
    function determineArchetype(data) {
        if (!data || data.length === 0) return null;

        let scores = { balletDancer: 0, caveDweller: 0, hangdog: 0, masochist: 0, longDistance: 0 };

        data.forEach(log => {
            if (!log.tags) return;
            const t = log.tags.toLowerCase();
            
            if (t.includes('slab') || t.includes('vertical')) scores.balletDancer++;
            if (t.includes('overhang') || t.includes('roof')) scores.caveDweller++;
            if (t.includes('project') || t.includes('limit')) scores.hangdog++;
            if (t.includes('endurance') || t.includes('pump')) scores.masochist++;
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

    // 3. Inject Archetype
    const currentArchetype = determineArchetype(logs);
    if (currentArchetype) {
        document.getElementById('arch-title').innerText = currentArchetype.title;
        document.getElementById('arch-roast').innerText = currentArchetype.roast;
    }

    // 4. Initialize Blank Charts (Ready for data mapping)
    const chartOptions = { responsive: true, color: '#fff' };
    
    new Chart(document.getElementById('pyramidChart'), { type: 'bar', data: { labels: ['6a', '6b', '6c', '7a'], datasets: [{ label: 'Send Pyramid', data: [0,0,0,0], backgroundColor: '#4CAF50' }] }, options: chartOptions });
    new Chart(document.getElementById('energyPieChart'), { type: 'doughnut', data: { labels: ['AeroCap', 'AnCap', 'Max Power'], datasets: [{ data: [33,33,33], backgroundColor: ['#2196F3', '#FF9800', '#F44336'] }] }, options: chartOptions });
    new Chart(document.getElementById('gripRadarChart'), { type: 'radar', data: { labels: ['Crimps', 'Slopers', 'Pockets', 'Jugs'], datasets: [{ label: 'Grip Strength', data: [0,0,0,0], borderColor: '#9C27B0' }] }, options: chartOptions });
    new Chart(document.getElementById('cnsLineChart'), { type: 'line', data: { labels: ['W1', 'W2', 'W3', 'W4'], datasets: [{ label: 'Max Grade', data: [0,0,0,0], borderColor: '#00BCD4' }] }, options: chartOptions });
});
