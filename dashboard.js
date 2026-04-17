const AppConfig = {
    api: "https://script.google.com/macros/s/AKfycbwMh-T7DB7S06_8DB2GC4dniByVHrRSqbODdLRhjciDOXSDL-V4_vzQtRXee2Wmqp9L/exec",
    gyms: ["OKS", "Torshov", "Løkka", "Bryn", "Gneiss", "Other"],
    months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    days: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    disciplines: ['Indoor Rope Climbing', 'Indoor Bouldering', 'Outdoor Rope Climbing', 'Outdoor Bouldering', 'Outdoor Multipitch'],
    styles: { 'project': 'Project', 'quick': 'Send', 'flash': 'Flash', 'onsight': 'Onsight', 'toprope': 'Top Rope', 'autobelay': 'Auto Belay', 'worked': 'Worked', 'topped': 'Topped Out', 'allfree': 'All Free', 'bailed': 'Bailed' },
    steepness: ['Slab', 'Vertical', 'Overhang', 'Roof'],
    grades: {
        ropesIn: { labels: ["5a","5a+","5b","5b+","5c","5c+","6a","6a+","6b","6b+","6c","6c+","7a","7a+","7b","7b+"], scores: [500,517,533,550,567,583,600,617,633,650,667,683,700,717,733,750], colors: [] },
        ropesOut: { labels: ["3","4-","4","4+","5-","5a","5a+","5b","5b+","5c","5c+","6a","6a+","6b","6b+","6c","6c+","7a","7a+","7b","7b+","7c","7c+","8a"], scores: [100,200,250,300,400,500,517,533,550,567,583,600,617,633,650,667,683,700,717,733,750,767,783,800], colors: [] },
        bouldsIn: { labels: ["4","5","6A","6B","6C","7A","7B"], scores: [400,500,600,633,667,700,733], colors: ["#ffffff", "#22c55e", "#3b82f6", "#eab308", "#ef4444", "#3f3f46", "#a855f7"] },
        bouldsOut: { labels: ["3","4","5","5+","6A","6A+","6B","6B+","6C","6C+","7A","7A+","7B","7B+","7C"], scores: [300,400,500,550,600,617,633,650,667,683,700,717,733,750,767], colors: [] }
    }
};

let currentFilteredLogs = [];
let allSessionsMaster = [];

const getV = (obj, prop) => {
    if (!obj) return undefined;
    if (obj[prop] !== undefined) return obj[prop];
    const lowerProp = prop.toLowerCase();
    const matchedKey = Object.keys(obj).find(k => k.toLowerCase() === lowerProp);
    return matchedKey ? obj[matchedKey] : undefined;
};

const escapeHTML = (str) => {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
};

const getBaseGrade = (g) => String(g || "").replace(/[⚡💎🚀🛠️❌🪢🔄\s]/g, '');
const getLocalISO = (d = new Date()) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().substring(0, 10);
const getCleanDate = (dStr) => dStr ? String(dStr).substring(0, 10) : getLocalISO();

const formatShortDate = (dStr) => {
    const clean = dStr ? String(dStr).substring(0, 10) : "";
    if(!clean) return "";
    const [y, m, d] = clean.split('-');
    return `${d} ${AppConfig.months[parseInt(m)-1]}`;
};

const ArchetypeDefs = {
    'The Caveman': "You are a dynamic powerhouse. You treat every route like a board climb, favoring explosive movement, big deadpoints, and campus beta. While others waste time analyzing micro-beta, you prefer to just drag yourself up the wall like a caveman. Subtlety is a suggestion; raw pulling power is your weapon of choice.",
    'The Juggernaut': "You win through sheer attrition. You don't need to campus the crux when you have the stamina to hang on terrible holds for five minutes to map out the sequence. You are a slow-moving, unstoppable force built for long, sustained walls.",
    'The Technician': "You climb with your brain and your feet. You thrive on vertical faces and slabs, relying on high steps, drop knees, and impeccable balance to float up routes. You make climbing look easy, even when it's desperately insecure.",
    'The Scalpel': "Your tendon strength is surgical. You slice through crux sequences by locking down on credit-card crimps and mono pockets that would terrify a normal climber. The smaller and sharper the hold, the more in control you become.",
    'The Assassin': "Ice water runs in your veins. You approach intimidating lines and outdoor runouts with a quiet, deadly efficiency. You bypass the mental panic that shuts down other climbers, treating high-stakes, fear-inducing moves as just another calculated equation to solve.",
    'The Pitbull': "You don't just climb a route; you wear it down. You are fueled by pure grit, logging endless burns and breaking projects into microscopic, repeatable beta. The word 'quit' isn't in your vocabulary—you will happily sacrifice skin and sanity on the exact same sequence until it goes.",
    'The All-Rounder': "A rare breed. Your stat polygon is perfectly balanced. You can pull on a roof, balance on a slab, and hold on through a deep pump. The ultimate climbing chameleon."
};

const Dashboard = {
    sortCol: 'Date',
    sortAsc: false,
    logLimit: 10, 
    
    haptic: () => { if (navigator.vibrate) navigator.vibrate(40); },
    
    sortLogbook: (col) => {
        Dashboard.haptic();
        if (Dashboard.sortCol === col) Dashboard.sortAsc = !Dashboard.sortAsc; 
        else { Dashboard.sortCol = col; Dashboard.sortAsc = false; }
        Dashboard.logLimit = 10; 
        Dashboard.renderLogbook();
    },

    toggleRow: (id) => {
        Dashboard.haptic();
        const row = document.getElementById(`row-${id}`);
        const details = document.getElementById(`details-${id}`);
        if(row && details) { row.classList.toggle('expanded'); details.classList.toggle('active'); }
    },

    editClimb: (id) => {
        Dashboard.haptic();
        localStorage.setItem('crag_edit_climb_id', id);
        window.location.href = 'index.html';
    },

    openArchetypeModal: () => {
        Dashboard.haptic();
        const archText = document.getElementById('id-arch').innerText;
        const cleanArch = archText.replace(/[^a-zA-Z\s\-]/g, '').trim(); 
        const desc = ArchetypeDefs[cleanArch] || ArchetypeDefs['The All-Rounder'];
        
        document.getElementById('archModalTitle').innerText = cleanArch;
        document.getElementById('archModalDesc').innerText = desc;
        document.getElementById('archetypeModal').classList.add('active');
    },
    
    closeArchetypeModal: () => {
        Dashboard.haptic();
        document.getElementById('archetypeModal').classList.remove('active');
    },

    showInsight: (type) => {
        Dashboard.haptic();
        const copy = {
            'profile': { title: 'Climber Profile', desc: 'A dynamic breakdown of your climbing style. The shape morphs based on the steepness, hold types, and effort levels of your sends. It compares your current training phase against your all-time baseline to highlight weaknesses.' }
        };
        const modal = document.getElementById('insightModal');
        if(modal && copy[type]) {
            document.getElementById('insightTitle').innerText = copy[type].title;
            document.getElementById('insightDesc').innerHTML = copy[type].desc;
            modal.classList.add('active');
        }
    },

    setupInsights: () => {
        if (!document.getElementById('insightModal')) {
            const modalHTML = `
            <div id="insightModal" class="modal-overlay" style="position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.9); z-index:3000; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(8px); opacity:0; pointer-events:none; transition:0.3s;" onclick="if(event.target===this) this.classList.remove('active')">
                <div class="modal-content" style="background:#121212; padding:30px; border-radius:16px; width:90%; max-width:400px; border:1px solid #1a1a1a; transform:translateY(20px); transition:0.3s; box-shadow:0 20px 50px rgba(0,0,0,0.8);">
                    <h2 id="insightTitle" style="color:#10b981; border:none; margin-bottom:15px; font-size:1.2rem; font-weight:800;">Insight</h2>
                    <p id="insightDesc" style="color:#a3a3a3; font-size:0.95rem; line-height:1.6; font-weight:500; margin:0; font-family:'Inter',sans-serif;"></p>
                    <button style="background:#10b981; color:#000; border:none; padding:14px; width:100%; border-radius:14px; font-weight:800; font-size:1.05rem; cursor:pointer; margin-top:24px;" onclick="document.getElementById('insightModal').classList.remove('active'); Dashboard.haptic();">Got it</button>
                </div>
            </div>`;
            document.body.insertAdjacentHTML('beforeend', modalHTML);
        }

        const addIcon = (textMatches, type) => {
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
            let node;
            while (node = walker.nextNode()) {
                if (node.nodeValue.trim() === textMatches) {
                    const parent = node.parentNode;
                    if (!parent.querySelector(`.icon-${type}`)) {
                        const icon = document.createElement('span');
                        icon.className = `info-icon icon-${type}`;
                        icon.style.cssText = 'display:inline-flex; align-items:center; justify-content:center; margin-left:8px; color:#10b981; font-size:0.85rem; font-weight:800; cursor:pointer; background:rgba(16,185,129,0.15); border-radius:50%; width:22px; height:22px; vertical-align:middle; line-height:1; transition:0.2s;';
                        icon.innerHTML = 'i';
                        icon.onclick = (e) => { e.stopPropagation(); Dashboard.showInsight(type); };
                        
                        parent.insertBefore(icon, node.nextSibling);
                    }
                }
            }
        };
        addIcon('CLIMBER PROFILE', 'profile');
    },

    renderLogbook: () => {
        const tbody = document.getElementById('masterLogbookBody');
        const q = document.getElementById('logSearch').value.toLowerCase();
        
        let displayData = currentFilteredLogs.filter(l => {
            if (!q) return true;
            const searchString = `${getV(l, 'Name')} ${getV(l, 'Notes')} ${getV(l, 'Grade')} ${getV(l, 'Holds')} ${AppConfig.styles[getV(l, 'Style')]||""}`.toLowerCase();
            return searchString.includes(q);
        });

        document.getElementById('logCount').innerText = `${displayData.length} LOGS`;

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

        const paginatedData = displayData.slice(0, Dashboard.logLimit);

        let tableHtml = paginatedData.map(l => {
            const id = getV(l, 'ClimbID') || Math.random().toString(36).substr(2, 9); 
            const name = String(getV(l, 'Name') || "");
            const cleanName = escapeHTML(name ? name.split('@')[0].trim() : "Unknown");
            const cleanNotes = escapeHTML(getV(l, 'Notes'));
            
            const grade = String(getV(l, 'Grade') || "");
            
            const type = String(getV(l, 'Type') || "");
            let dotColor = '#737373';
            if (type === 'Indoor Rope Climbing') dotColor = '#10b981';
            else if (type === 'Indoor Bouldering') dotColor = '#3b82f6';
            else if (type === 'Outdoor Rope Climbing') dotColor = '#f97316';
            else if (type === 'Outdoor Bouldering') dotColor = '#a855f7';
            else if (type === 'Outdoor Multipitch') dotColor = '#ef4444';
            
            const discDot = `<span class="disc-dot" style="background-color: ${dotColor}; box-shadow: 0 0 8px ${dotColor}60;"></span>`;
            
            const sessionID = getV(l, 'SessionID');
            const session = allSessionsMaster.find(s => getV(s, 'SessionID') === sessionID);
            const fatigue = session && getV(session, 'Fatigue') ? `${getV(session, 'Fatigue')}/10` : '-';
            const focus = session && getV(session, 'Focus') ? getV(session, 'Focus') : '-';

            return `
            <tr class="table-row" id="row-${id}" onclick="Dashboard.toggleRow('${id}')">
                <td style="color:#a3a3a3; font-weight: 500;">${formatShortDate(getV(l, 'Date'))}</td>
                <td style="font-weight:600; color:#e5e5e5; word-break: break-word;">${discDot}${cleanName}</td>
                <td style="font-weight:700; color:#fff;">${grade}</td>
                <td class="col-style" style="color:#a3a3a3;">${AppConfig.styles[getV(l, 'Style')] || getV(l, 'Style')}</td>
                <td class="align-right" style="color: #a3a3a3; font-weight: 600;">${getV(l, 'Burns') || 1}</td>
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
                            ${getV(l, 'Pitches') ? `<div><div class="d-lbl">Pitches</div><div class="d-val">${getV(l, 'Pitches')}</div></div>` : ''}
                            ${getV(l, 'GearStyle') ? `<div><div class="d-lbl">Gear Style</div><div class="d-val">${getV(l, 'GearStyle')}</div></div>` : ''}
                            ${getV(l, 'PackWeight') ? `<div><div class="d-lbl">Pack Weight</div><div class="d-val">${getV(l, 'PackWeight')}</div></div>` : ''}
                            ${getV(l, 'PitchBreakdown') ? `<div class="d-notes" style="grid-column: span 3;">Pitches: ${getV(l, 'PitchBreakdown')}</div>` : ''}
                        </div>
                        ${cleanNotes ? `<div class="d-notes">"${cleanNotes}"</div>` : ''}
                        <div class="log-actions" style="display:flex; gap:12px; margin-top:20px;">
                            <button class="log-edit-btn" style="flex:1; padding:12px; background:rgba(59,130,246,0.1); color:#3b82f6; border:none; border-radius:8px; font-weight:700; cursor:pointer;" onclick="Dashboard.editClimb('${id}')">Edit Entry</button>
                        </div>
                    </div>
                </td>
            </tr>`;
        }).join('');

        if (displayData.length > Dashboard.logLimit) {
            tableHtml += `
            <tr class="table-row" onclick="Dashboard.haptic(); Dashboard.logLimit += 10; Dashboard.renderLogbook();">
                <td colspan="5" style="text-align:center; font-weight:700; color:#fff; padding:18px; letter-spacing:1px; text-transform:uppercase;">
                    Load More Logs ▾
                </td>
            </tr>`;
        }

        tbody.innerHTML = tableHtml;
    }
};

window.charts = { radar: null, pyr: null };

document.addEventListener('DOMContentLoaded', () => {
    if (window.Chart) { Chart.defaults.color = '#a3a3a3'; Chart.defaults.borderColor = 'rgba(255,255,255,0.05)'; Chart.defaults.font.family = "'Inter', sans-serif"; }

    let allLogs = JSON.parse(localStorage.getItem('crag_climbs_master') || '[]');
    if (allLogs.length === 0) {
        allLogs = JSON.parse(localStorage.getItem('climbingLogs') || localStorage.getItem('climbLogs') || '[]');
    }

    let allSessions = JSON.parse(localStorage.getItem('crag_sessions_master') || '[]');
    if (allSessions.length === 0) {
        allSessions = JSON.parse(localStorage.getItem('sessionLogs') || '[]');
    }
    
    allSessionsMaster = allSessions; 
    
    let activeDisc = 'All';
    let activeTime = '90'; 
    
    const getScaleConfig = (disc) => {
        if (disc === 'Indoor Bouldering') return AppConfig.grades.bouldsIn;
        if (disc === 'Outdoor Bouldering') return AppConfig.grades.bouldsOut;
        if (disc === 'Outdoor Rope Climbing' || disc === 'Outdoor Multipitch') return AppConfig.grades.ropesOut;
        return AppConfig.grades.ropesIn;
    };

    const searchInput = document.getElementById('logSearch');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            Dashboard.logLimit = 10; 
            Dashboard.renderLogbook();
        });
    }

    const syncText = document.getElementById('syncStatus');
    if (syncText) syncText.innerText = "(Syncing)";

    fetch(AppConfig.api)
        .then(res => res.json())
        .then(data => {
            if (data.status === 'success') {
                if (data.climbs && data.climbs.length > 0) {
                    allLogs = data.climbs;
                    localStorage.setItem('crag_climbs_master', JSON.stringify(allLogs));
                }
                if (data.sessions && data.sessions.length > 0) {
                    allSessions = data.sessions;
                    allSessionsMaster = allSessions;
                    localStorage.setItem('crag_sessions_master', JSON.stringify(allSessions));
                }
                if (syncText) syncText.innerText = "● LIVE";
                setTimeout(() => { if(syncText) syncText.innerText = ""; }, 3000);
                renderDashboard(); 
            }
        }).catch(err => {
            console.log("Dashboard background sync failed", err);
            if (syncText) {
                syncText.innerText = "○ OFFLINE";
                syncText.style.color = "#737373";
            }
        });

    const attachFilters = (id, propName, className) => {
        document.querySelectorAll(`#${id} .${className}`).forEach(btn => {
            btn.addEventListener('click', (e) => {
                Dashboard.haptic(); 
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

    // ==========================================
    // SPORTS SCIENCE ENGINE (ACWR) - Dashboard
    // ==========================================
    const ReadinessEngine = {
        cleanseData: (sessions) => {
            return sessions.filter(session => allLogs.some(c => String(c.SessionID) === String(session.SessionID)));
        },
        getHistoricalAverageFatigue: (sessions) => {
            const fScores = sessions.filter(s => s.Fatigue && s.Fatigue !== "0").map(s => Number(s.Fatigue));
            if (fScores.length === 0) return 5;
            return fScores.reduce((a, b) => a + b, 0) / fScores.length;
        },
        calculateDailyLoad: (targetDate, validSessions) => {
            const daySessions = validSessions.filter(s => getCleanDate(s.Date) === targetDate);
            if (daySessions.length === 0) return { load: 0, missingFatigue: false };

            let totalVolume = 0;
            let maxFatigue = 0;
            let missingFatigue = false;
            const avgFatigue = ReadinessEngine.getHistoricalAverageFatigue(validSessions);

            daySessions.forEach(session => {
                if (!session.Fatigue || session.Fatigue === "0") missingFatigue = true;
                let sessionFatigue = (session.Fatigue && session.Fatigue !== "0") ? Number(session.Fatigue) : avgFatigue;
                
                if (sessionFatigue > maxFatigue) maxFatigue = sessionFatigue;

                const sessionClimbs = allLogs.filter(c => String(c.SessionID) === String(session.SessionID));
                sessionClimbs.forEach(climb => {
                    const conf = getScaleConfig(climb.Type);
                    const cleanGrade = getBaseGrade(climb.Grade);
                    const gradeIdx = conf.labels.indexOf(cleanGrade);
                    const baseXP = gradeIdx > -1 ? conf.scores[gradeIdx] : 0;
                    const pitches = climb.Pitches ? Number(climb.Pitches) : 1;
                    
                    if (['Project', 'Worked', 'project', 'worked'].includes(climb.Style)) {
                        let hpFactor = climb.HighPoint ? (Number(climb.HighPoint) / 100) : 0.5;
                        let burns = (climb.Burns && climb.Burns !== '-') ? Number(climb.Burns) : 1;
                        totalVolume += (baseXP * hpFactor * burns) * pitches;
                    } else {
                        totalVolume += Number(climb.Score) * pitches;
                    }
                });
            });

            return { load: totalVolume * maxFatigue, missingFatigue };
        },
        generateACWR: () => {
            const validSessions = ReadinessEngine.cleanseData(allSessionsMaster);
            let acuteLoad = 0; 
            let chronicLoad = 0;
            let blockedByAcuteFatigue = false;

            const today = new Date();
            today.setHours(0,0,0,0);

            for (let i = 0; i < 28; i++) {
                let targetDate = new Date(today);
                targetDate.setDate(targetDate.getDate() - i);
                let dateString = getLocalISO(targetDate);
                
                let { load, missingFatigue } = ReadinessEngine.calculateDailyLoad(dateString, validSessions);
                
                if (i < 7) {
                    acuteLoad += load;
                    if (missingFatigue) blockedByAcuteFatigue = true;
                }
                chronicLoad += load;
            }

            if (blockedByAcuteFatigue) {
                return { status: 'LOCKED', percent: '-', ratio: '-', color: '#737373', msg: "⚠️ Missing Session Fatigue. Update recent logs in Journal to unlock Readiness Score." };
            }

            chronicLoad = chronicLoad / 4;

            if (chronicLoad < 2000) {
                return { status: 'CALIBRATING', percent: '...', ratio: '-', color: '#3b82f6', msg: "Building Base: Volume too low for accurate ACWR. Focus on steady accumulation." };
            }

            const ratioNum = acuteLoad / chronicLoad;
            const ratio = ratioNum.toFixed(2);

            if (ratioNum > 1.5) return { status: 'DANGER', percent: '30%', color: '#ff1744', ratio: ratio + 'x', msg: "Overtraining risk. High injury probability. Strict rest recommended." };
            if (ratioNum > 1.3) return { status: 'WARNING', percent: '55%', color: '#ffc107', ratio: ratio + 'x', msg: "High systemic load. Focus on volume, avoid limit projecting." };
            
            if (ratioNum < 0.8 && acuteLoad < 1000) return { status: 'PRIME', percent: '100%', color: '#00e5ff', ratio: ratio + 'x', msg: "Fully Recovered. Prime for Limit Effort." };
            if (ratioNum < 0.8) return { status: 'UNDER', percent: '75%', color: '#ffc107', ratio: ratio + 'x', msg: "Undertraining detected. Increase training stimulus." };
            
            return { status: 'OPTIMAL', percent: '85%', color: '#00e5ff', ratio: ratio + 'x', msg: "Balanced training. Optimal zone for power generation." };
        }
    };

    const calcRPG = (logs) => {
        let attr = { Power: 0, Endurance: 0, Technique: 0, Fingers: 0, Headspace: 0, Tenacity: 0 };
        if (logs.length === 0) return { Power: 40, Endurance: 40, Technique: 40, Fingers: 40, Headspace: 40, Tenacity: 40 };

        logs.forEach(l => {
            const angle = String(getV(l, 'Angle') || "");
            const styleTag = String(getV(l, 'ClimStyles') || "").toLowerCase();
            const holds = String(getV(l, 'Holds') || "");
            const effort = String(getV(l, 'Effort') || "");
            const styleResult = String(getV(l, 'Style') || "").toLowerCase();
            const burns = Number(getV(l, 'Burns')) || 1;
            const type = String(getV(l, 'Type') || "");
            const isOutdoor = type.toLowerCase().includes('outdoor');
            const score = Number(getV(l, 'Score')) || 0;
            
            const pitches = Number(getV(l, 'Pitches')) || 1;
            const gear = String(getV(l, 'GearStyle') || "");
            const pack = String(getV(l, 'PackWeight') || "");

            if (angle.includes('Overhang') || angle.includes('Roof')) attr.Power += 2;
            if (styleTag.includes('cruxy') || styleTag.includes('athletic')) attr.Power += 2;
            if (type.includes('Bouldering')) attr.Power += 1;

            if (type.includes('Rope')) attr.Endurance += 1;
            if (styleTag.includes('endurance') || styleTag.includes('volume')) attr.Endurance += 3;
            if ((styleResult === 'toprope' || styleResult === 'autobelay') && (styleTag.includes('endurance') || styleTag.includes('volume'))) attr.Endurance += 3;

            if (angle.includes('Slab') || angle.includes('Vertical')) attr.Technique += 2;
            if (holds.includes('Slopers') || holds.includes('Pinches') || holds.includes('Volumes')) attr.Technique += 2;
            if (styleResult === 'onsight') attr.Technique += 2;

            if (holds.includes('Crimps') || holds.includes('Pockets')) {
                attr.Fingers += 2;
                if (angle.includes('Overhang') || angle.includes('Roof')) attr.Fingers += 2; 
                if (isOutdoor) attr.Fingers += 1; 
                if (score > 600) attr.Fingers += 1; 
            }

            if (styleResult === 'flash' || styleResult === 'onsight') attr.Headspace += 3;
            if (effort.includes('Limit')) attr.Headspace += 2;
            if (isOutdoor && type.includes('Rope')) attr.Headspace += 2; 

            if (styleResult === 'project' || styleResult === 'worked') attr.Tenacity += 3;
            if (burns >= 3) attr.Tenacity += 1;
            if (burns >= 5) attr.Tenacity += 2;
            
            if (type === 'Outdoor Multipitch') {
                attr.Endurance += pitches;
                if (pack === 'Heavy' || pack === 'Training Weight') attr.Tenacity += 3;
                if (gear === 'Trad' || gear === 'Mixed') attr.Headspace += 4;
            }
        });
        
        const maxVal = Math.max(...Object.values(attr), 1);
        Object.keys(attr).forEach(k => attr[k] = 40 + Math.round((attr[k] / maxVal) * 60));
        return attr;
    };

    function renderDashboard() {
        Dashboard.setupInsights();
        const now = new Date();
        
        const allTimeLogsFiltered = allLogs.filter(l => {
            const type = String(getV(l, 'Type') || "");
            let normalizedType = type;
            if (type === 'indoor_ropes') normalizedType = 'Indoor Rope Climbing';
            else if (type === 'indoor_boulders') normalizedType = 'Indoor Bouldering';
            if (activeDisc !== 'All' && normalizedType !== activeDisc) return false;
            return true;
        });

        currentFilteredLogs = allTimeLogsFiltered.filter(l => {
            if (activeTime === 'All') return true;
            const logDate = new Date(getV(l, 'Date'));
            const diffDays = (now - logDate) / (1000 * 60 * 60 * 24);
            return diffDays <= parseInt(activeTime);
        });

        let maxScore = 0, peakG = '-';
        let dayC = {}, indoorCount = 0;
        const gradesForPyramid = {};
        const steepnessPeaks = { 'Slab': null, 'Vertical': null, 'Overhang': null, 'Roof': null };

        const locSessions = {};
        const locs = {};

        currentFilteredLogs.forEach(l => { 
            const s = Number(getV(l, 'Score'));
            const style = String(getV(l, 'Style') || "").toLowerCase();
            const isSend = s && style !== 'worked' && style !== 'toprope' && style !== 'autobelay' && style !== 'bailed';
            const gradeStr = String(getV(l, 'Grade') || "");
            const typeStr = String(getV(l, 'Type') || "").toLowerCase();
            const dateStr = getV(l, 'Date');
            const angleStr = String(getV(l, 'Angle') || "");
            let nameStr = String(getV(l, 'Name') || "");
            const sessionID = String(getV(l, 'SessionID') || "");

            if (isSend && s > maxScore) { 
                maxScore = s; 
                peakG = gradeStr; 
            } 

            if (isSend) {
                const clean = getBaseGrade(gradeStr);
                gradesForPyramid[clean] = (gradesForPyramid[clean] || 0) + 1;
            }

            if (dateStr) {
                const d = new Date(dateStr).getDay();
                const dayName = AppConfig.days[d];
                dayC[dayName] = (dayC[dayName] || 0) + 1; 
            }
            if (typeStr.includes('indoor')) indoorCount++;

            AppConfig.steepness.forEach(st => {
                if (angleStr.includes(st) && isSend) {
                    if (!steepnessPeaks[st] || s > Number(getV(steepnessPeaks[st], 'Score'))) {
                        steepnessPeaks[st] = l;
                    }
                }
            });

            if(nameStr) {
                if(nameStr.includes('@')) nameStr = nameStr.split('@')[1].trim(); 
                if (nameStr && sessionID) {
                    if (!locSessions[nameStr]) locSessions[nameStr] = new Set();
                    locSessions[nameStr].add(sessionID);
                }
            }
        });

        Object.keys(locSessions).forEach(loc => {
            locs[loc] = locSessions[loc].size;
        });

        // ==========================================
        // RENDER READINESS HUD (POGO Style)
        // ==========================================
        const acwr = ReadinessEngine.generateACWR();
        const hudWrapper = document.getElementById('readiness-hud-wrapper');
        if (hudWrapper) {
            hudWrapper.innerHTML = `
            <div class="readiness-hud-card" id="readiness-hud" style="background: var(--card-surface, #121212); margin-bottom: 24px; border-radius: 16px; padding: 1.5rem; box-shadow: 0 4px 20px ${acwr.color}15; border: 1px solid rgba(255, 255, 255, 0.05); position: relative; overflow: hidden;">
                ${acwr.status === 'DANGER' ? `
                <div class="warning-banner" id="overtrain-warning" style="background: rgba(255, 23, 68, 0.15); color: #ff1744; text-align: center; font-weight: 800; font-size: 0.8rem; padding: 6px; margin: -1.5rem -1.5rem 1rem -1.5rem; letter-spacing: 1px;">
                    ⚠️ OVERTRAINING RISK: Reduce load today.
                </div>` : ''}
                
                <div class="hud-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
                    <div class="hud-column">
                        <span class="hud-label" style="font-size: 0.75rem; color: #888888; letter-spacing: 1.5px; font-weight: 700;">READINESS</span>
                        <div class="hud-value" id="readiness-percent" style="font-size: 3rem; font-weight: 900; margin: 0.2rem 0; color: ${acwr.color};">${acwr.percent}</div>
                        <span class="hud-sub" id="readiness-sub" style="font-size: 0.85rem; font-weight: 600; color: #ffffff;">${acwr.status}</span>
                    </div>
                    <div class="hud-column right-align" style="text-align: right;">
                        <span class="hud-label" style="font-size: 0.75rem; color: #888888; letter-spacing: 1.5px; font-weight: 700;">LOAD RATIO</span>
                        <div class="hud-value" id="load-ratio" style="font-size: 3rem; font-weight: 900; margin: 0.2rem 0; color: ${acwr.color};">${acwr.ratio}</div>
                        <span class="hud-sub" style="font-size: 0.85rem; font-weight: 600; color: #ffffff;">ACWR</span>
                    </div>
                </div>

                <div class="hud-prescription" id="hud-msg" style="background: rgba(255, 255, 255, 0.03); padding: 1rem; border-radius: 8px; font-size: 0.9rem; line-height: 1.4; color: #cccccc; border-left: 3px solid ${acwr.color};">
                    ${acwr.msg}
                </div>
            </div>`;
        }

        const statsS = document.getElementById('stat-sends'); if(statsS) statsS.innerText = currentFilteredLogs.length;
        const outDays = new Set(currentFilteredLogs.filter(l => String(getV(l, 'Type')).includes('Outdoor')).map(l => getV(l, 'Date'))).size;
        const statsO = document.getElementById('stat-outdoor'); if(statsO) statsO.innerText = activeDisc.includes('Indoor') ? 'N/A' : outDays;
        
        const peakEl = document.getElementById('stat-peak');
        if (peakEl) {
            const cleanPeak = getBaseGrade(peakG);
            peakEl.innerText = (currentFilteredLogs.length === 0) ? '-' : (activeDisc === 'All' ? 'Mix' : cleanPeak);
            
            if (currentFilteredLogs.length > 0 && activeDisc === 'Indoor Bouldering') {
                const conf = AppConfig.grades.bouldsIn;
                const idx = conf.labels.indexOf(cleanPeak);
                peakEl.style.color = (idx > -1 && conf.colors[idx]) ? conf.colors[idx] : '#fff';
            } else {
                peakEl.style.color = '#fff';
            }
        }

        const topDay = Object.keys(dayC).length ? Object.keys(dayC).length > 0 ? Object.keys(dayC).reduce((a, b) => dayC[a] > dayC[b] ? a : b) : '-' : '-';
        
        // Environment Logic Update Patch
        let envLabel = '-';
        const totalS = allSessionsMaster.length;
        if (totalS > 0) {
            const outS = allSessionsMaster.filter(s => !AppConfig.gyms.includes(getV(s, 'Location'))).length;
            const outRatio = outS / totalS;
            if (outRatio > 0.6) envLabel = 'Crag Hound';
            else if (outRatio < 0.2) envLabel = 'Gym Rat';
            else envLabel = 'All-Terrain';
        }

        const idDay = document.getElementById('id-day'); if(idDay) idDay.innerText = topDay;
        const idEnv = document.getElementById('id-env'); if(idEnv) idEnv.innerText = envLabel;

        Object.values(window.charts).forEach(c => { if(c) c.destroy(); });

        const pyrCard = document.getElementById('pyramidCard');
        const pyrCanvas = document.getElementById('pyramidChart');

        if (pyrCard && pyrCanvas) {
            if (activeDisc === 'All' || currentFilteredLogs.length === 0) {
                pyrCard.style.display = 'none';
            } else {
                pyrCard.style.display = 'block';
                const conf = getScaleConfig(activeDisc);
                const sortedGrades = Object.keys(gradesForPyramid).sort((a,b) => conf.labels.indexOf(a) - conf.labels.indexOf(b));
                const pyrData = sortedGrades.map(g => gradesForPyramid[g]);
                
                const pyrColors = sortedGrades.map(g => {
                    const idx = conf.labels.indexOf(g);
                    return (conf.colors && conf.colors[idx]) ? conf.colors[idx] : 'rgba(16, 185, 129, 0.85)';
                });

                window.charts.pyr = new Chart(pyrCanvas, {
                    type: 'bar',
                    data: { labels: sortedGrades, datasets: [{ data: pyrData, backgroundColor: pyrColors, borderRadius: { topRight: 6, bottomRight: 6, topLeft: 0, bottomLeft: 0 }, borderSkipped: false }] },
                    options: { 
                        responsive: true, maintainAspectRatio: false, indexAxis: 'y', 
                        plugins: { legend: { display: false } }, 
                        scales: { 
                            x: { display: false },
                            y: { ticks: { color: '#a3a3a3', font: { weight: '600' } }, grid: { display: false, drawBorder: false } }
                        } 
                    }
                });
            }
        }

        const currAttr = calcRPG(currentFilteredLogs);
        const baseAttr = calcRPG(allTimeLogsFiltered);

        let archetype = "The All-Rounder";
        if (currentFilteredLogs.length > 0) {
            const archMap = {
                'Power': 'The Caveman', 'Endurance': 'The Juggernaut', 'Technique': 'The Technician',
                'Fingers': 'The Scalpel', 'Headspace': 'The Assassin', 'Tenacity': 'The Pitbull'
            };
            const topAttrs = Object.keys(currAttr).filter(k => currAttr[k] === 100);
            archetype = topAttrs.length > 1 ? 'The All-Rounder' : archMap[topAttrs[0]];
        }
        
        const idArch = document.getElementById('id-arch'); if(idArch) idArch.innerText = archetype;

        const radarLabels = Object.keys(currAttr).map(k => [k.toUpperCase(), currAttr[k].toString()]);
        const radarCanvas = document.getElementById('attributeRadarChart');

        if (radarCanvas) {
            window.charts.radar = new Chart(radarCanvas, { 
                type: 'radar', 
                data: { 
                    labels: radarLabels, 
                    datasets: [
                        { 
                            label: 'Current Phase', data: Object.values(currAttr), borderColor: '#10b981', 
                            backgroundColor: 'rgba(16, 185, 129, 0.4)', pointBackgroundColor: '#10b981', pointRadius: 0, borderWidth: 2, fill: true
                        },
                        { 
                            label: 'All-Time Base', data: Object.values(baseAttr), borderColor: 'rgba(255,255,255,0.15)', 
                            backgroundColor: 'rgba(255,255,255,0.02)', pointRadius: 0, borderWidth: 2, borderDash: [4, 4], fill: true
                        }
                    ] 
                }, 
                options: { 
                    responsive: true, maintainAspectRatio: false, 
                    plugins: { 
                        legend: { display: true, position: 'top', labels: { color: '#a3a3a3', boxWidth: 12, font: {size: 11, weight: '600'} } },
                        tooltip: { callbacks: { label: function(context) { return ` ${context.dataset.label}: ${context.raw}`; } } }
                    }, 
                    scales: { 
                        r: { 
                            min: 0, max: 100, ticks: { display: false, stepSize: 20 }, 
                            grid: { color: 'rgba(255,255,255,0.05)' }, angleLines: { display: false }, 
                            pointLabels: { color: '#a3a3a3', font: { size: 10, weight: '700' } } 
                        } 
                    } 
                } 
            });
        }

        const renderList = (id, html) => { 
            const el = document.getElementById(id); 
            if(el) el.innerHTML = html || '<div class="empty-msg">No data available for this phase.</div>'; 
        };
        
        const hof = [...currentFilteredLogs].filter(l => Number(getV(l, 'Rating')) >= 4).sort((a,b)=>(Number(getV(b, 'Score'))||0)-(Number(getV(a, 'Score'))||0)).slice(0,5);
        renderList('list-fame', hof.map(l => {
            const name = String(getV(l, 'Name') || "");
            const cleanName = escapeHTML(name ? name.split('@')[0].trim() : "Unknown");
            return `<div class="list-item"><div><div class="list-main">${cleanName}</div><div class="list-sub">${'★'.repeat(Number(getV(l, 'Rating')))}</div></div><div class="list-badge">${getBaseGrade(getV(l, 'Grade'))}</div></div>`
        }).join(''));

        const limit = [...currentFilteredLogs].filter(l => String(getV(l, 'Effort')||"").includes('Limit')).sort((a,b)=>(Number(getV(b, 'Score'))||0)-(Number(getV(a, 'Score'))||0)).slice(0,5);
        renderList('list-limit', limit.map(l => {
            const name = String(getV(l, 'Name') || "");
            const cleanName = escapeHTML(name ? name.split('@')[0].trim() : "Unknown");
            return `<div class="list-item"><div><div class="list-main">${cleanName}</div><div class="list-sub">${formatShortDate(getV(l, 'Date'))}</div></div><div class="list-badge" style="background: rgba(239,68,68,0.15); color:#ef4444;">${getBaseGrade(getV(l, 'Grade'))}</div></div>`
        }).join(''));

        let steepHTML = '';
        AppConfig.steepness.forEach(st => {
            const peakLog = steepnessPeaks[st];
            if(peakLog) {
                steepHTML += `<div class="list-item"><div class="list-main">${st}</div><div class="list-badge" style="background: rgba(59,130,246,0.15); color:#3b82f6;">${getBaseGrade(getV(peakLog, 'Grade'))}</div></div>`;
            } else {
                steepHTML += `<div class="list-item"><div class="list-main" style="color:#555;">${st}</div><div class="list-badge" style="background:transparent; color:#555;">-</div></div>`;
            }
        });
        renderList('list-steepness', steepHTML);

        const topLocs = Object.keys(locs).sort((a,b)=>locs[b]-locs[a]).slice(0,5);
        renderList('list-locations', topLocs.map(loc => `<div class="list-item"><div class="list-main">${escapeHTML(loc)}</div><div class="list-badge">${locs[loc]} Session${locs[loc]>1?'s':''}</div></div>`).join(''));
        
        Dashboard.renderLogbook();
    }
    
    renderDashboard(); 
});
