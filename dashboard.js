// AppConfig, getBaseGrade, getCleanDate, escapeHTML, formatShortDate, getScaleConfig
// are defined in shared.js (loaded before this file).

let currentFilteredLogs = [];
let allSessionsMaster = [];

const getV = (obj, prop) => {
    if (!obj) return undefined;
    if (obj[prop] !== undefined) return obj[prop];
    const lowerProp = prop.toLowerCase();
    const matchedKey = Object.keys(obj).find(k => k.toLowerCase() === lowerProp);
    return matchedKey ? obj[matchedKey] : undefined;
};

const getChartScore = (l) => {
    const typeStr = String(getV(l, 'Type') || "");
    const gradeStr = getBaseGrade(getV(l, 'Grade') || "");
    const sConf = getScaleConfig(typeStr);
    
    if (sConf && sConf.labels) {
        const idx = sConf.labels.indexOf(gradeStr);
        if (idx > -1) return sConf.scores[idx];
    }
    return Number(getV(l, 'Score')) || 0; 
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

        if (angle.includes('Overhang') || angle.includes('Roof') || angle.includes('Pillar') || angle.includes('Shield')) attr.Power += 2;
        if (styleTag.includes('cruxy') || styleTag.includes('athletic')) attr.Power += 2;
        if (type.includes('Bouldering')) attr.Power += 1;

        if (type.includes('Rope') || type.includes('Multipitch') || type.includes('Trad') || type.includes('Ice')) attr.Endurance += 1;
        if (styleTag.includes('endurance') || styleTag.includes('volume')) attr.Endurance += 3;
        if ((styleResult === 'toprope' || styleResult === 'autobelay') && (styleTag.includes('endurance') || styleTag.includes('volume'))) attr.Endurance += 3;

        if (angle.includes('Slab') || angle.includes('Vertical') || angle.includes('Mixed')) attr.Technique += 2;
        if (holds.includes('Slopers') || holds.includes('Pinches') || holds.includes('Volumes') || holds.includes('Brittle') || holds.includes('Chandeliers')) attr.Technique += 2;
        if (styleResult === 'onsight') attr.Technique += 2;

        if (holds.includes('Crimps') || holds.includes('Pockets') || holds.includes('Cracks')) {
            attr.Fingers += 2;
            if (angle.includes('Overhang') || angle.includes('Roof')) attr.Fingers += 2; 
            if (isOutdoor) attr.Fingers += 1; 
            if (score > 600) attr.Fingers += 1; 
        }

        if (styleResult === 'flash' || styleResult === 'onsight' || styleResult === 'allfree') attr.Headspace += 3;
        if (effort.includes('Limit')) attr.Headspace += 2;
        if (type.includes('Multipitch') || type.includes('Trad') || type.includes('Ice')) attr.Headspace += 3; 

        if (styleResult === 'project' || styleResult === 'worked') attr.Tenacity += 3;
        if (burns >= 3) attr.Tenacity += 1;
        if (burns >= 5) attr.Tenacity += 2;
    });
    
    const maxVal = Math.max(...Object.values(attr), 1);
    Object.keys(attr).forEach(k => attr[k] = 40 + Math.round((attr[k] / maxVal) * 60));
    return attr;
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
    activeMultiClimbId: null,
    wrapUpData: [],
    activeWrapUpIdx: 0,
    activeCardIdx: 0,
    
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
        document.querySelectorAll('.table-row.expanded').forEach(r => {
            if (r.id !== `row-${id}`) {
                r.classList.remove('expanded');
                const dId = r.id.replace('row-', 'details-');
                const d = document.getElementById(dId);
                if (d) d.classList.remove('active');
            }
        });

        const row = document.getElementById(`row-${id}`);
        const details = document.getElementById(`details-${id}`);
        if(row && details) { 
            row.classList.toggle('expanded'); 
            details.classList.toggle('active'); 
        }
    },

    setActiveMulti: (id) => {
        Dashboard.haptic();
        Dashboard.activeMultiClimbId = id;
        document.querySelectorAll('#multi-route-selector .filter-pill').forEach(p => p.classList.remove('active'));
        const activePill = Array.from(document.querySelectorAll('#multi-route-selector .filter-pill')).find(p => p.getAttribute('onclick').includes(id));
        if (activePill) activePill.classList.add('active');
        
        const selectedClimb = currentFilteredLogs.find(c => getV(c, 'ClimbID') === String(id));
        Dashboard.renderTopo(selectedClimb);
    },

    renderTopo: (climb) => {
        const canvas = document.getElementById('topo-canvas');
        if (!climb) { canvas.innerHTML = '<div class="empty-msg">Select a route to view topo.</div>'; return; }

        let pitches = [];
        const breakdown = String(getV(climb, 'PitchBreakdown') || "");
        if (breakdown) {
            pitches = breakdown.split(',').map(p => {
                const parts = p.trim().split(':');
                return parts.length > 1 ? parts[1].trim() : parts[0].trim();
            });
        } else {
            const pCount = Number(getV(climb, 'Pitches')) || 2;
            for(let i=0; i<pCount; i++) pitches.push(getBaseGrade(getV(climb, 'Grade')));
        }

        const width = 400; 
        const pitchHeight = 65; 
        const padding = 50;
        const totalHeight = (pitches.length * pitchHeight) + padding * 2;
        
        let svg = `<svg width="100%" height="auto" viewBox="0 0 ${width} ${totalHeight}" style="max-height: 500px; display: block; overflow: visible;" xmlns="http://www.w3.org/2000/svg">`;
        
        let currentX = width / 2;
        let currentY = totalHeight - padding; 
        
        const cruxGrade = getBaseGrade(getV(climb, 'Grade'));
        
        svg += `<line x1="20%" y1="${currentY}" x2="80%" y2="${currentY}" stroke="#262626" stroke-width="2" stroke-dasharray="4 4" />`;
        svg += `<text x="${width/2}" y="${currentY + 20}" fill="#555" font-size="11" font-weight="800" text-anchor="middle" font-family="Inter" letter-spacing="1">GROUND</text>`;

        pitches.forEach((grade, index) => {
            const cleanG = getBaseGrade(grade);
            const isCrux = cleanG === cruxGrade;
            const offsetX = (Math.random() - 0.5) * 80;
            const nextX = Math.max(80, Math.min(width - 80, currentX + offsetX));
            const nextY = currentY - pitchHeight;

            let lineColor = '#10b981'; 
            if (isCrux) lineColor = '#ef4444'; 
            else {
                 const num = parseInt(cleanG);
                 if(num >= 7 || cleanG.includes('WI6') || cleanG.includes('WI7')) lineColor = '#c084fc';
                 else if (num === 6 || cleanG.includes('WI5')) lineColor = '#eab308';
                 else if (num <= 5 || cleanG.includes('WI4') || cleanG.includes('WI3')) lineColor = '#3b82f6';
            }

            svg += `<path d="M ${currentX} ${currentY} Q ${currentX} ${currentY - pitchHeight/2} ${nextX} ${nextY}" fill="none" stroke="${lineColor}" stroke-width="5" stroke-linecap="round" />`;
            svg += `<circle cx="${nextX}" cy="${nextY}" r="7" fill="#121212" stroke="${lineColor}" stroke-width="3" />`;
            
            const isLeft = nextX > width/2;
            const textAnchor = isLeft ? 'start' : 'end';
            const textOffsetX = isLeft ? 18 : -18;
            
            svg += `<text x="${nextX + textOffsetX}" y="${nextY + 4}" fill="#e5e5e5" font-size="13" font-weight="800" font-family="Inter" text-anchor="${textAnchor}">P${index+1}: ${grade}</text>`;

            currentX = nextX;
            currentY = nextY;
        });

        svg += `<text x="${currentX}" y="${currentY - 20}" fill="#fbbf24" font-size="13" font-weight="800" text-anchor="middle" font-family="Inter" letter-spacing="1">SUMMIT</text>`;
        svg += `</svg>`;
        canvas.innerHTML = svg;
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
            document.getElementById('insightDesc').innerText = copy[type].desc;
            modal.classList.add('active');
        }
    },

    setupInsights: () => {
        if (!document.getElementById('insightModal')) {
            const modalHTML = `
            <div id="insightModal" class="modal-overlay" style="position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.9); z-index:3000; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(8px); opacity:0; pointer-events:none; transition:0.3s;" onclick="if(event.target===this) this.classList.remove('active')">
                <div class="modal-content" style="background:#121212; padding:30px; border-radius:16px; width:90%; max-width:400px; border:1px solid #1a1a1a; transform:translateY(20px); transition:0.3s; box-shadow:0 20px 50px rgba(0,0,0,0.8);">
                    <h2 id="insightTitle" style="color:#10b981; border:none; margin-bottom:15px; font-size:1.2rem; font-weight:800;">Insight</h2>
                    <p id="insightDesc" style="color:#a3a3a3; font-size:0.95rem; line-height:1.6; font-weight:500; margin:0; font-family:'Inter',sans-serif; white-space:pre-wrap;"></p>
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
        addIcon('Climber Profile', 'profile');
    },

    initWrapUp: function(allLogsMaster) {
        const groups = {};
        allLogsMaster.forEach(l => {
            const dStr = getCleanDate(getV(l, 'Date'));
            if (!dStr) return;
            const d = new Date(dStr);
            if (isNaN(d)) return;
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(l);
        });

        const wrapUps = [];
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        
        Object.keys(groups).sort((a,b) => b.localeCompare(a)).forEach(key => {
            const logs = groups[key];
            const [year, mStr] = key.split('-');
            const monthName = monthNames[parseInt(mStr, 10) - 1];
            
            const volume = logs.length;
            let peakScore = 0;
            let peakGrade = '-';
            let indoorCount = 0;
            let outdoorCount = 0;
            const partners = {};
            const days = {};
            const locs = {};

            logs.forEach(l => {
                const s = getChartScore(l); 
                const style = String(getV(l, 'Style') || "").toLowerCase();
                const invalidStyles = ['worked', 'toprope', 'autobelay', 'project', 'bailed'];
                
                if (s > peakScore && !invalidStyles.includes(style)) {
                    peakScore = s;
                    peakGrade = getBaseGrade(getV(l, 'Grade'));
                }
                
                const type = String(getV(l, 'Type') || "");
                if (type.includes('Indoor')) indoorCount++;
                if (type.includes('Outdoor')) outdoorCount++;
                
                const p = String(getV(l, 'Partner') || "").trim();
                if (p) {
                    p.split(',').forEach(n => {
                        const cleanN = n.trim();
                        if (cleanN) partners[cleanN] = (partners[cleanN] || 0) + 1;
                    });
                }
                
                const dDate = new Date(getCleanDate(getV(l, 'Date')));
                if (!isNaN(dDate)) {
                    const dName = AppConfig.days[dDate.getDay()];
                    days[dName] = (days[dName] || 0) + 1;
                }
                
                let loc = String(getV(l, 'Name') || "");
                if (loc.includes('@')) loc = loc.split('@')[1].trim();
                else loc = type.includes('Indoor') ? "The Gym" : loc;
                if (loc) locs[loc] = (locs[loc] || 0) + 1;
            });
            
            const totalInOut = indoorCount + outdoorCount || 1;
            const indoorPct = Math.round((indoorCount / totalInOut) * 100);
            const outdoorPct = 100 - indoorPct;
            
            const topLoc = Object.keys(locs).sort((a,b) => locs[b] - locs[a])[0] || '-';
            const topPartner = Object.keys(partners).sort((a,b) => partners[b] - partners[a])[0] || 'Solo / Auto-belay';
            
            const attr = calcRPG(logs);
            const archMap = { 'Power': 'The Caveman', 'Endurance': 'The Juggernaut', 'Technique': 'The Technician', 'Fingers': 'The Scalpel', 'Headspace': 'The Assassin', 'Tenacity': 'The Pitbull' };
            const topAttrs = Object.keys(attr).filter(k => attr[k] === 100);
            const archetype = topAttrs.length > 1 ? 'The All-Rounder' : (archMap[topAttrs[0]] || 'The All-Rounder');
            
            const favDay = Object.keys(days).sort((a,b) => days[b] - days[a])[0] || '-';

            wrapUps.push({ key, monthName, year, volume, peakGrade, indoorPct, outdoorPct, topLoc, topPartner, archetype, favDay });
        });
        
        Dashboard.wrapUpData = wrapUps;

        if(!document.getElementById('wrapup-styles')) {
            const style = document.createElement('style');
            style.id = 'wrapup-styles';
            style.innerHTML = `
                .wu-teaser { background: linear-gradient(135deg, #10b981 0%, #047857 100%); color: #000; border-radius: 12px; padding: 16px; margin-top: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; font-weight: 800; box-shadow: 0 10px 25px rgba(16,185,129,0.2); }
                .wu-teaser-title { font-size: 1.1rem; }
                .wu-teaser-btn { background: #000; color: #10b981; padding: 6px 12px; border-radius: 20px; font-size: 0.85rem; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
                
                .wu-vault-wrapper { margin-top: 40px; margin-bottom: 30px; }
                .wu-vault-header { font-size: 0.9rem; font-weight: 800; color: #737373; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
                .wu-vault-row { display: flex; gap: 12px; overflow-x: auto; padding-bottom: 12px; scrollbar-width: none; }
                .wu-vault-row::-webkit-scrollbar { display: none; }
                .wu-vault-card { flex: 0 0 auto; width: 120px; background: #1a1a1a; border: 1px solid #262626; border-radius: 12px; padding: 16px; cursor: pointer; text-align: center; transition: 0.2s; }
                .wu-vault-card.latest { border-color: #10b981; background: rgba(16,185,129,0.05); }
                .wu-vault-card:active { transform: scale(0.95); }
                .wu-vault-month { font-size: 1.1rem; font-weight: 800; color: #fff; margin-bottom: 4px; }
                .wu-vault-year { font-size: 0.8rem; font-weight: 600; color: #a3a3a3; }
                
                .wu-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: #0a0a0a; z-index: 9999; display: none; flex-direction: column; }
                .wu-overlay.active { display: flex; }
                .wu-progress-row { display: flex; gap: 4px; padding: 16px; padding-top: 48px; }
                .wu-progress-bar { flex: 1; height: 4px; background: rgba(255,255,255,0.2); border-radius: 2px; overflow: hidden; }
                .wu-progress-fill { height: 100%; width: 0%; background: #fff; transition: width 0.3s; }
                .wu-progress-bar.done .wu-progress-fill { width: 100%; }
                .wu-progress-bar.active .wu-progress-fill { width: 100%; transition: width 4.5s linear; }
                
                .wu-content { flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 32px; text-align: center; position: relative; }
                .wu-close { position: absolute; top: 24px; right: 24px; color: #fff; font-size: 24px; font-weight: bold; background: none; border: none; z-index: 10; opacity: 0.5; cursor: pointer; }
                .wu-close:active { opacity: 1; }
                
                .wu-tap-left, .wu-tap-right { position: absolute; top: 0; bottom: 0; width: 50%; z-index: 5; }
                .wu-tap-left { left: 0; }
                .wu-tap-right { right: 0; }
                
                .wu-super-text { font-size: 5rem; font-weight: 900; background: linear-gradient(135deg, #10b981, #3b82f6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 16px; line-height: 1; }
                .wu-main-text { font-size: 1.5rem; font-weight: 700; color: #fff; margin-bottom: 12px; }
                .wu-sub-text { font-size: 1.1rem; font-weight: 500; color: #a3a3a3; line-height: 1.5; }
            `;
            document.head.appendChild(style);
        }

        if(!document.getElementById('wu-overlay')) {
            const overlay = document.createElement('div');
            overlay.id = 'wu-overlay';
            overlay.className = 'wu-overlay';
            overlay.innerHTML = `
                <div class="wu-progress-row" id="wu-progress-row"></div>
                <button class="wu-close" onclick="Dashboard.closeWrapUp()">×</button>
                <div class="wu-tap-left" onclick="Dashboard.prevWrapUpCard()"></div>
                <div class="wu-tap-right" onclick="Dashboard.nextWrapUpCard()"></div>
                <div class="wu-content" id="wu-content"></div>
            `;
            document.body.appendChild(overlay);
        }

        const statsGrid = document.getElementById('standard-stats-grid');
        let teaserContainer = document.getElementById('wu-teaser-container');
        if(!teaserContainer && statsGrid) {
            teaserContainer = document.createElement('div');
            teaserContainer.id = 'wu-teaser-container';
            statsGrid.parentElement.insertBefore(teaserContainer, statsGrid);
        }

        const logSearchEl = document.getElementById('logSearch');
        let vaultContainer = document.getElementById('wu-vault-container');
        if(!vaultContainer && logSearchEl) {
            vaultContainer = document.createElement('div');
            vaultContainer.id = 'wu-vault-container';
            logSearchEl.parentElement.parentElement.insertBefore(vaultContainer, logSearchEl.parentElement);
        }

        if(Dashboard.wrapUpData.length > 0) {
            const latest = Dashboard.wrapUpData[0];
            const dismissedKey = `crag_wrapup_dismissed_${latest.key}`;
            
            if(teaserContainer) {
                if(!localStorage.getItem(dismissedKey)) {
                    teaserContainer.innerHTML = `
                        <div class="wu-teaser" onclick="Dashboard.openWrapUp(0, true)">
                            <div class="wu-teaser-title">${latest.monthName} '${latest.year.slice(-2)} Wrap-Up is here.</div>
                            <div class="wu-teaser-btn">View</div>
                        </div>
                    `;
                } else {
                    teaserContainer.innerHTML = '';
                }
            }
            
            if(vaultContainer) {
                vaultContainer.innerHTML = `
                    <div class="wu-vault-wrapper">
                        <div class="wu-vault-header">
                            <span style="display:inline-block; width:12px; height:12px; background:#10b981; border-radius:3px;"></span> 
                            Monthly Recaps
                        </div>
                        <div class="wu-vault-row">
                            ${Dashboard.wrapUpData.map((w, i) => `
                                <div class="wu-vault-card ${i === 0 ? 'latest' : ''}" onclick="Dashboard.openWrapUp(${i}, false)">
                                    <div class="wu-vault-month">${w.monthName.substring(0,3)}</div>
                                    <div class="wu-vault-year">${w.year}</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }
        }
    },

    openWrapUp: function(dataIdx, isFromTeaser) {
        Dashboard.haptic();
        Dashboard.activeWrapUpIdx = dataIdx;
        Dashboard.activeCardIdx = 0;
        
        const data = Dashboard.wrapUpData[dataIdx];
        if(isFromTeaser) {
            localStorage.setItem(`crag_wrapup_dismissed_${data.key}`, 'true');
            const teaser = document.getElementById('wu-teaser-container');
            if(teaser) teaser.innerHTML = '';
        }
        
        document.getElementById('wu-overlay').classList.add('active');
        Dashboard.renderWrapUpCard();
    },

    closeWrapUp: function() {
        Dashboard.haptic();
        document.getElementById('wu-overlay').classList.remove('active');
        clearTimeout(Dashboard.wrapUpTimer);
    },

    nextWrapUpCard: function() {
        Dashboard.haptic();
        if(Dashboard.activeCardIdx < 4) {
            Dashboard.activeCardIdx++;
            Dashboard.renderWrapUpCard();
        } else {
            Dashboard.closeWrapUp();
        }
    },

    prevWrapUpCard: function() {
        Dashboard.haptic();
        if(Dashboard.activeCardIdx > 0) {
            Dashboard.activeCardIdx--;
            Dashboard.renderWrapUpCard();
        }
    },

    renderWrapUpCard: function() {
        clearTimeout(Dashboard.wrapUpTimer);
        const data = Dashboard.wrapUpData[Dashboard.activeWrapUpIdx];
        const pRow = document.getElementById('wu-progress-row');
        const content = document.getElementById('wu-content');
        
        pRow.innerHTML = Array(5).fill(0).map((_, i) => `
            <div class="wu-progress-bar ${i < Dashboard.activeCardIdx ? 'done' : (i === Dashboard.activeCardIdx ? 'active' : '')}">
                <div class="wu-progress-fill"></div>
            </div>
        `).join('');

        let html = '';
        if(Dashboard.activeCardIdx === 0) {
            html = `<div class="wu-super-text">${data.volume}</div>
                    <div class="wu-main-text">Climbs Logged</div>
                    <div class="wu-sub-text">You showed up and logged ${data.volume} climbs in ${data.monthName}.</div>`;
        } else if(Dashboard.activeCardIdx === 1) {
            html = `<div class="wu-super-text" style="background: linear-gradient(135deg, #ef4444, #fb923c); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">${data.peakGrade}</div>
                    <div class="wu-main-text">Peak Grade</div>
                    <div class="wu-sub-text">The absolute hardest crux you pulled this month.</div>`;
        } else if(Dashboard.activeCardIdx === 2) {
            html = `<div class="wu-super-text" style="background: linear-gradient(135deg, #a855f7, #ec4899); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">${data.indoorPct}%</div>
                    <div class="wu-main-text">Indoor Rat</div>
                    <div class="wu-sub-text">You spent ${data.indoorPct}% of your time inside and ${data.outdoorPct}% touching real rock.<br><br>Top spot: <b style="color:#fff;">${data.topLoc}</b></div>`;
        } else if(Dashboard.activeCardIdx === 3) {
            html = `<div class="wu-super-text" style="font-size:3.5rem; background: linear-gradient(135deg, #eab308, #f59e0b); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">${data.topPartner}</div>
                    <div class="wu-main-text">MVP Belayer</div>
                    <div class="wu-sub-text">The person who caught your falls and fed you slack the most this month.</div>`;
        } else if(Dashboard.activeCardIdx === 4) {
            html = `<div class="wu-super-text" style="font-size:3.5rem; background: linear-gradient(135deg, #10b981, #06b6d4); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">${data.archetype}</div>
                    <div class="wu-main-text">Your Identity</div>
                    <div class="wu-sub-text">Your primary climbing style in ${data.monthName}.<br><br>Favorite day: <b style="color:#fff;">${data.favDay}</b></div>`;
        }

        content.innerHTML = html;
        
        Dashboard.wrapUpTimer = setTimeout(() => {
            Dashboard.nextWrapUpCard();
        }, 5000);
    },

    renderLogbook: () => {
        const tbody = document.getElementById('masterLogbookBody');
        const logCount = document.getElementById('logCount');
        if (!tbody) return; 

        const q = (document.getElementById('logSearch') ? document.getElementById('logSearch').value.toLowerCase() : "");
        
        let displayData = currentFilteredLogs.filter(l => {
            if (!q) return true;
            const searchString = `${getV(l, 'Name')} ${getV(l, 'Notes')} ${getV(l, 'Grade')} ${getV(l, 'Holds')} ${AppConfig.styles[getV(l, 'Style')]||""}`.toLowerCase();
            return searchString.includes(q);
        });

        if (logCount) logCount.innerText = `${displayData.length} CLIMBS`;

        displayData.sort((a, b) => {
            let valA, valB;
            if (Dashboard.sortCol === 'Date') { valA = new Date(getCleanDate(getV(a, 'Date'))).getTime() || 0; valB = new Date(getCleanDate(getV(b, 'Date'))).getTime() || 0; }
            else if (Dashboard.sortCol === 'Name') { valA = String(getV(a, 'Name')||"").toLowerCase(); valB = String(getV(b, 'Name')||"").toLowerCase(); }
            else if (Dashboard.sortCol === 'Grade') { valA = Number(getV(a, 'Score')) || 0; valB = Number(getV(b, 'Score')) || 0; }
            else if (Dashboard.sortCol === 'Style') { valA = String(getV(a, 'Style')||"").toLowerCase(); valB = String(getV(b, 'Style')||"").toLowerCase(); }
            
            
            if (valA < valB) return Dashboard.sortAsc ? -1 : 1;
            if (valA > valB) return Dashboard.sortAsc ? 1 : -1;
            return 0;
        });

        if (displayData.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="empty-msg">No logs match your search.</td></tr>`;
            return;
        }

        const paginatedData = displayData.slice(0, Dashboard.logLimit);

        let tableHtml = paginatedData.map(l => {
            const id = getV(l, 'ClimbID') || Math.random().toString(36).substr(2, 9); 
            const name = String(getV(l, 'Name') || "");
            const cleanName = escapeHTML(name ? name.split('@')[0].trim() : "Unknown");
            const cleanNotes = escapeHTML(getV(l, 'Notes'));
            
            const type = String(getV(l, 'Type') || "");
            const grade = String(getV(l, 'Grade') || "");
            
            let gradeDisplay = grade;
            if (type === 'Indoor Bouldering') {
                const conf = AppConfig.grades.bouldsIn;
                const idx = conf.labels.indexOf(getBaseGrade(grade));
                if (idx > -1 && conf.colors[idx]) {
                    gradeDisplay = `<span style="color: ${conf.colors[idx]}; text-shadow: 0 0 8px ${conf.colors[idx]}40;">${grade}</span>`;
                }
            }
            
            let dotColor = '#737373';
            if (type === 'Indoor Rope Climbing') dotColor = '#10b981';
            else if (type === 'Indoor Bouldering') dotColor = '#3b82f6';
            else if (type === 'Outdoor Rope Climbing') dotColor = '#f97316';
            else if (type === 'Outdoor Bouldering') dotColor = '#a855f7';
            else if (type === 'Outdoor Multipitch') dotColor = '#ef4444';
            else if (type === 'Outdoor Trad Climbing') dotColor = '#d97706';
            else if (type === 'Outdoor Ice Climbing') dotColor = '#0ea5e9';
            
            const discDot = `<span class="disc-dot" style="background-color: ${dotColor}; box-shadow: 0 0 8px ${dotColor}60;"></span>`;
            
            const sessionID = getV(l, 'SessionID');
            const session = allSessionsMaster.find(s => getV(s, 'SessionID') === sessionID);
            const fatigue = session && getV(session, 'Fatigue') ? `${getV(session, 'Fatigue')}/10` : '-';
            const focus = session && getV(session, 'Focus') ? getV(session, 'Focus') : '-';

            return `
            <tr class="table-row" id="row-${id}" onclick="Dashboard.toggleRow('${id}')" style="border-left: 3px solid ${dotColor};">
                <td style="color:#a3a3a3; font-weight: 500;">${formatShortDate(getV(l, 'Date'))}</td>
                <td style="font-weight:600; color:#e5e5e5; word-break: break-word;">${discDot}${cleanName}</td>
                <td style="font-weight:700; color:#fff;">${gradeDisplay}</td>
                <td class="col-style" style="color:#a3a3a3;">${AppConfig.styles[getV(l, 'Style')] || getV(l, 'Style')}</td>
                
            </tr>
            <tr class="details-row" id="details-${id}">
                <td colspan="4" style="padding:0;">
                    <div class="details-content">
                        <div class="details-grid">
                            <div><div class="d-lbl">Rating</div><div class="d-val" style="color:#eab308;">${'★'.repeat(Number(getV(l, 'Rating')) || 0) || '-'}</div></div>
                            <div><div class="d-lbl">Burns</div><div class="d-val">${getV(l, 'Burns') || 1}</div></div>
                            <div><div class="d-lbl">${type.includes('Ice') ? 'Ice Feature' : 'Angle'}</div><div class="d-val">${getV(l, 'Angle') || '-'}</div></div>
                            <div><div class="d-lbl">${type.includes('Ice') ? 'Ice Cond.' : 'Holds'}</div><div class="d-val">${getV(l, 'Holds') || '-'}</div></div>
                            <div><div class="d-lbl">RPE (Effort)</div><div class="d-val">${getV(l, 'Effort') || '-'}</div></div>
                            <div><div class="d-lbl">Session Fatigue</div><div class="d-val" style="color:#fb923c;">${fatigue}</div></div>
                            <div><div class="d-lbl">Session Focus</div><div class="d-val" style="color:#60a5fa;">${focus}</div></div>
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
                <td colspan="4" style="text-align:center; font-weight:700; color:#fff; padding:18px; letter-spacing:1px; text-transform:uppercase;">
                    Load More Climbs ▾
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

    const logSearchInput = document.getElementById('logSearch');
    if (logSearchInput) {
        logSearchInput.addEventListener('input', () => {
            Dashboard.logLimit = 10; 
            Dashboard.renderLogbook();
        });
    }

    const syncText = document.getElementById('syncStatus');
    if (syncText) syncText.innerText = "SYNCING...";

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
                if (syncText) {
                    syncText.innerText = "● LIVE";
                    setTimeout(() => syncText.innerText = "", 3000);
                }
                renderDashboard(); 
            }
        }).catch(err => {
            console.log("Dashboard background sync failed", err);
            if(syncText) {
                syncText.innerText = "○ OFFLINE";
                syncText.style.color = "#737373";
                setTimeout(() => syncText.innerText = "", 3000);
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

    function renderDashboard() {
        Dashboard.setupInsights();
        Dashboard.initWrapUp(allLogs);
        
        const now = new Date();
        const isMultiMode = activeDisc === 'Outdoor Multipitch';
        
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
            const clean = getCleanDate(getV(l, 'Date'));
            if (!clean) return false;
            const parts = clean.split('-');
            if (parts.length !== 3) return false; 
            const logDate = new Date(parseInt(parts[0]), parseInt(parts[1])-1, parseInt(parts[2]));
            if (isNaN(logDate.getTime())) return false;
            const diffDays = (now - logDate) / (1000 * 60 * 60 * 24);
            return diffDays <= parseInt(activeTime);
        });

        document.querySelectorAll('.standard-card').forEach(el => el.style.display = isMultiMode ? 'none' : 'block');
        document.getElementById('standard-stats-grid').style.display = isMultiMode ? 'none' : 'grid';
        document.getElementById('multi-stats-wrapper').style.display = isMultiMode ? 'block' : 'none';
        document.getElementById('multipitch-topo-card').style.display = isMultiMode ? 'block' : 'none';
        document.getElementById('limit-log-card').style.display = isMultiMode ? 'none' : 'block';

        if (isMultiMode) {
            document.getElementById('stat-multi-routes').innerText = currentFilteredLogs.length;
            
            let maxEpic = 0;
            let peakCrux = '-';
            let peakScore = 0;
            let wallDays = new Set();

            currentFilteredLogs.forEach(l => {
                let pCount = 0;
                const breakdown = String(getV(l, 'PitchBreakdown') || "");
                if (breakdown) pCount = breakdown.split(',').length;
                else pCount = Number(getV(l, 'Pitches')) || 2;

                if (pCount > maxEpic) maxEpic = pCount;

                const score = Number(getV(l, 'Score')) || 0;
                if (score > peakScore) { peakScore = score; peakCrux = getBaseGrade(getV(l, 'Grade')); }

                const dateStr = getCleanDate(getV(l, 'Date'));
                if (dateStr) wallDays.add(dateStr);
            });

            document.getElementById('stat-multi-epic').innerText = maxEpic;
            document.getElementById('stat-multi-peak').innerText = peakCrux;
            document.getElementById('stat-multi-peak').style.color = '#ef4444';
            document.getElementById('stat-multi-days').innerText = wallDays.size;

            const multiSelector = document.getElementById('multi-route-selector');
            const recentMultis = [...currentFilteredLogs].sort((a,b) => new Date(getCleanDate(getV(b, 'Date'))) - new Date(getCleanDate(getV(a, 'Date'))));
            
            if (recentMultis.length > 0) {
                if (!Dashboard.activeMultiClimbId || !recentMultis.find(c => getV(c, 'ClimbID') === Dashboard.activeMultiClimbId)) {
                    Dashboard.activeMultiClimbId = getV(recentMultis[0], 'ClimbID');
                }

                multiSelector.innerHTML = recentMultis.map(l => {
                    const id = getV(l, 'ClimbID');
                    const rawName = String(getV(l, 'Name') || "Unknown");
                    const name = escapeHTML(rawName.split('@')[0].trim());
                    return `<div class="filter-pill ${String(id) === String(Dashboard.activeMultiClimbId) ? 'active' : ''}" onclick="Dashboard.setActiveMulti('${id}')">${name}</div>`;
                }).join('');

                const selectedClimb = recentMultis.find(c => getV(c, 'ClimbID') === Dashboard.activeMultiClimbId);
                Dashboard.renderTopo(selectedClimb);
            } else {
                multiSelector.innerHTML = '';
                document.getElementById('topo-canvas').innerHTML = '<div class="empty-msg" style="margin-top:40px;">No multipitch routes logged in this time frame.</div>';
            }
        }

        if (!isMultiMode) {
            
            const elStatSends = document.getElementById('stat-sends');
            if (elStatSends) elStatSends.innerText = currentFilteredLogs.length;
            
            const outDays = new Set(currentFilteredLogs.filter(l => String(getV(l, 'Type')).includes('Outdoor')).map(l => getCleanDate(getV(l, 'Date')))).size;
            const elStatOutdoor = document.getElementById('stat-outdoor');
            if (elStatOutdoor) elStatOutdoor.innerText = activeDisc.includes('Indoor') ? 'N/A' : outDays;
            
            let maxScore = 0, peakG = '-';
            let dayC = {}, indoorCount = 0;
            currentFilteredLogs.forEach(l => { 
                const s = Number(getV(l, 'Score'));
                const style = String(getV(l, 'Style') || "").toLowerCase();
                const isSend = s && style !== 'worked' && style !== 'toprope' && style !== 'autobelay';
                
                if (isSend && s > maxScore) { maxScore = s; peakG = String(getV(l, 'Grade') || ""); } 
                
                const dateStr = getCleanDate(getV(l, 'Date'));
                if (dateStr) { const d = new Date(dateStr); if(!isNaN(d)) { dayC[AppConfig.days[d.getDay()]] = (dayC[AppConfig.days[d.getDay()]] || 0) + 1; } }
                if (String(getV(l, 'Type') || "").toLowerCase().includes('indoor')) indoorCount++;
            });

            const peakEl = document.getElementById('stat-peak');
            if (peakEl) {
                const cleanPeak = getBaseGrade(peakG);
                peakEl.innerText = (currentFilteredLogs.length === 0) ? '-' : (activeDisc === 'All' ? 'Mix' : cleanPeak);
                if (currentFilteredLogs.length > 0 && activeDisc === 'Indoor Bouldering') {
                    const conf = AppConfig.grades.bouldsIn;
                    const idx = conf.labels.indexOf(cleanPeak);
                    peakEl.style.color = (idx > -1 && conf.colors[idx]) ? conf.colors[idx] : '#fff';
                } else peakEl.style.color = '#fff';
            }

            const topDay = Object.keys(dayC).length ? Object.keys(dayC).length > 0 ? Object.keys(dayC).reduce((a, b) => dayC[a] > dayC[b] ? a : b) : '-' : '-';
            let envLabel = '-';
            if (currentFilteredLogs.length > 0) {
                const inRatio = indoorCount / currentFilteredLogs.length;
                if (inRatio >= 0.8) envLabel = 'Gym Rat';
                else if (inRatio <= 0.4) envLabel = 'Dirtbag';
                else envLabel = 'Gumby';
            }

            const elIdDay = document.getElementById('id-day');
            if (elIdDay) elIdDay.innerText = topDay;
            const elIdEnv = document.getElementById('id-safe-space');
            if (elIdEnv) elIdEnv.innerText = envLabel;

            const currAttr = calcRPG(currentFilteredLogs);
            const baseAttr = calcRPG(allTimeLogsFiltered);

            let archetype = "The All-Rounder";
            if (currentFilteredLogs.length > 0) {
                const archMap = { 'Power': 'The Caveman', 'Endurance': 'The Juggernaut', 'Technique': 'The Technician', 'Fingers': 'The Scalpel', 'Headspace': 'The Assassin', 'Tenacity': 'The Pitbull' };
                const topAttrs = Object.keys(currAttr).filter(k => currAttr[k] === 100);
                archetype = topAttrs.length > 1 ? 'The All-Rounder' : archMap[topAttrs[0]];
            }
            const elIdArch = document.getElementById('id-arch');
            if (elIdArch) elIdArch.innerText = archetype;

            const levelUpSessionId = localStorage.getItem('crag_levelup_session');
            let isLevelUpToday = false;
            if (levelUpSessionId) {
                const todayStr = getCleanDate(new Date());
                if (levelUpSessionId.includes(todayStr)) isLevelUpToday = true;
            }

            const topStatsGrid = document.getElementById('standard-stats-grid');
            if (topStatsGrid && isLevelUpToday && !document.getElementById('dash-gold-ribbon')) {
                topStatsGrid.style.position = 'relative';
                topStatsGrid.insertAdjacentHTML('beforeend', `
                    <div id="dash-gold-ribbon" style="position: absolute; top: -15px; right: -15px; width: 80px; height: 80px; overflow: hidden; border-radius: 0 12px 0 0; z-index: 100; pointer-events: none;">
                        <div style="position: absolute; top: 18px; right: -28px; width: 120px; background: linear-gradient(135deg, #f59e0b, #fbbf24, #fcd34d); color: #451a03; font-size: 10px; font-weight: 900; text-align: center; padding: 5px 0; transform: rotate(45deg); box-shadow: 0 2px 15px rgba(245,158,11,0.5); text-transform: uppercase; letter-spacing: 1px;">Level Up</div>
                    </div>
                `);
            }

            Object.values(window.charts).forEach(c => { if(c) c.destroy(); });
            
            const gradesForPyramid = {};
            currentFilteredLogs.forEach(l => {
                const style = String(getV(l, 'Style') || "").toLowerCase();
                const isSend = Number(getV(l, 'Score')) && style !== 'worked' && style !== 'toprope' && style !== 'autobelay';
                if (isSend) {
                    const clean = getBaseGrade(String(getV(l, 'Grade') || ""));
                    gradesForPyramid[clean] = (gradesForPyramid[clean] || 0) + 1;
                }
            });

            const pyrCanvas = document.getElementById('pyramidChart');
            if (pyrCanvas) {
                if (activeDisc === 'All' || currentFilteredLogs.length === 0) {
                    pyrCanvas.parentElement.parentElement.style.display = 'none';
                } else {
                    pyrCanvas.parentElement.parentElement.style.display = 'block';
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
                        options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { display: false }, y: { ticks: { color: '#a3a3a3', font: { weight: '600' } }, grid: { display: false, drawBorder: false } } } }
                    });
                }
            }

            const radarCanvas = document.getElementById('attributeRadarChart');
            if (radarCanvas) {
                const radarLabels = Object.keys(currAttr).map(k => [k.toUpperCase(), currAttr[k].toString()]);
                window.charts.radar = new Chart(radarCanvas, { 
                    type: 'radar', 
                    data: { labels: radarLabels, datasets: [ { label: 'Current Phase', data: Object.values(currAttr), borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.4)', pointBackgroundColor: '#10b981', pointRadius: 0, borderWidth: 2, fill: true }, { label: 'All-Time Base', data: Object.values(baseAttr), borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(255,255,255,0.02)', pointRadius: 0, borderWidth: 2, borderDash: [4, 4], fill: true } ] }, 
                    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true, position: 'top', labels: { color: '#a3a3a3', boxWidth: 12, font: {size: 11, weight: '600'} } }, tooltip: { callbacks: { label: function(context) { return ` ${context.dataset.label}: ${context.raw}`; } } } }, scales: { r: { min: 0, max: 100, ticks: { display: false, stepSize: 20 }, grid: { color: 'rgba(255,255,255,0.05)' }, angleLines: { display: false }, pointLabels: { color: '#a3a3a3', font: { size: 10, weight: '700' } } } } } 
                });
            }
        } 

        const partnerCounts = {};
        currentFilteredLogs.forEach(l => {
            const partnerStr = getV(l, 'Partner');
            if (partnerStr) {
                const names = String(partnerStr).split(',').map(n => n.trim()).filter(n => n.length > 0);
                names.forEach(n => { partnerCounts[n] = (partnerCounts[n] || 0) + 1; });
            }
        });

        const sortedPartners = Object.keys(partnerCounts).sort((a, b) => partnerCounts[b] - partnerCounts[a]).slice(0, 3);
        const partnerContainer = document.getElementById('belayer-container');

        if (partnerContainer) {
            if (sortedPartners.length > 0) {
                partnerContainer.innerHTML = sortedPartners.map((name, index) => {
                    const rank = index + 1;
                    const podiumClass = `rank-${rank}`;
                    return `
                        <div class="belayer-podium ${podiumClass}">
                            <div class="belayer-left">
                                <div class="belayer-rank-icon">${rank}</div>
                                <div class="belayer-name">${escapeHTML(name)}</div>
                            </div>
                            <div class="belayer-count-badge">${partnerCounts[name]} climbs</div>
                        </div>
                    `;
                }).join('');
            } else {
                partnerContainer.innerHTML = '<div class="empty-msg">Not enough belayer data yet.</div>';
            }
        }

        const steepnessPeaks = {};
        const featuresToRender = (activeDisc === 'Outdoor Ice Climbing') ? AppConfig.iceFeatures : AppConfig.steepness;
        featuresToRender.forEach(st => steepnessPeaks[st] = null);
        
        const locSessions = {};
        const locs = {};

        currentFilteredLogs.forEach(l => { 
            const s = Number(getV(l, 'Score'));
            const style = String(getV(l, 'Style') || "").toLowerCase();
            const isSend = s && style !== 'worked' && style !== 'toprope' && style !== 'autobelay';
            const angleStr = String(getV(l, 'Angle') || "");
            let nameStr = String(getV(l, 'Name') || "");
            const sessionID = String(getV(l, 'SessionID') || "");

            featuresToRender.forEach(st => {
                if (angleStr.includes(st) && isSend) {
                    if (!steepnessPeaks[st] || s > Number(getV(steepnessPeaks[st], 'Score'))) steepnessPeaks[st] = l;
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

        Object.keys(locSessions).forEach(loc => { locs[loc] = locSessions[loc].size; });

        const renderList = (id, html) => { const el = document.getElementById(id); if(el) el.innerHTML = html || '<div class="empty-msg">No data available for this phase.</div>'; };
        
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
        featuresToRender.forEach(st => {
            const peakLog = steepnessPeaks[st];
            if(peakLog) steepHTML += `<div class="list-item"><div class="list-main">${st}</div><div class="list-badge" style="background: rgba(59,130,246,0.15); color:#3b82f6;">${getBaseGrade(getV(peakLog, 'Grade'))}</div></div>`;
            else steepHTML += `<div class="list-item"><div class="list-main" style="color:#555;">${st}</div><div class="list-badge" style="background:transparent; color:#555;">-</div></div>`;
        });
        renderList('list-steepness', steepHTML);

        const topLocs = Object.keys(locs).sort((a,b)=>locs[b]-locs[a]).slice(0,5);
        renderList('list-locations', topLocs.map(loc => `<div class="list-item"><div class="list-main">${escapeHTML(loc)}</div><div class="list-badge">${locs[loc]} Session${locs[loc]>1?'s':''}</div></div>`).join(''));
        
        Dashboard.renderLogbook();
    }
    
    renderDashboard(); 
});
