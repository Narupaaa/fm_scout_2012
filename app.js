/**
 * Application Core & DOM Interaction Controller
 */
(function () {
    let globalPlayersDatabase = [];

    // เรียกใช้ระบบดักจับ Event ต่างๆ เมื่อเว็บพร้อมทำโครงสร้าง
    window.addEventListener('DOMContentLoaded', () => {
        initializeDOMEvents();
        renderDashboard();
    });

    function initializeDOMEvents() {
        // จัดการ Input การเปลี่ยนแปลงของแถบ Range Sliders
        document.querySelectorAll('.slider-group').forEach(group => {
            const slider = group.querySelector('input[type="range"]');
            const label = group.querySelector('.val-lbl');
            slider.addEventListener('input', () => {
                label.textContent = slider.value;
                renderDashboard();
            });
        });

        // เปิดระบบสืบค้นอัตโนมัติเมื่อกดพิมพ์หรือเปลี่ยนตัวกรอง
        ['search-name', 'filter-position-class', 'sort-order'].forEach(id => {
            document.getElementById(id).addEventListener(
                id.includes('select') || id.includes('filter') ? 'change' : 'input',
                renderDashboard
            );
        });

        // สลับมุมมองตาราง/การ์ดรายงาน
        document.getElementById('view-cards-btn').addEventListener('click', () => switchViewMode(true));
        document.getElementById('view-table-btn').addEventListener('click', () => switchViewMode(false));

        // ทางลัดตัวเลือก
        document.getElementById('shortcut-wonderkid').addEventListener('click', () => applyPreset('wonderkid'));
        document.getElementById('shortcut-zerocost').addEventListener('click', () => applyPreset('zerocost'));

        // ปุ่ม Reset
        document.getElementById('btn-reset').addEventListener('click', resetAllFilters);

        // โซนรับอัปโหลดไฟล์ HTML
        document.getElementById('upload-zone').addEventListener('click', () => document.getElementById('file-upload').click());
        document.getElementById('file-upload').addEventListener('change', handleIncomingFile);
    }

    function switchViewMode(showCards) {
        document.getElementById('view-cards-btn').className = showCards ? "text-xs font-bold px-4 py-2 rounded-lg bg-fm-excellent text-fm-bg" : "text-xs font-bold px-4 py-2 rounded-lg bg-fm-bg text-gray-300";
        document.getElementById('view-table-btn').className = !showCards ? "text-xs font-bold px-4 py-2 rounded-lg bg-fm-excellent text-fm-bg" : "text-xs font-bold px-4 py-2 rounded-lg bg-fm-bg text-gray-300";
        document.getElementById('cards-view-container').classList.toggle('hidden', !showCards);
        document.getElementById('table-view-container').classList.toggle('hidden', showCards);
        renderDashboard();
    }

    function resetAllFilters() {
        document.getElementById('search-name').value = '';
        document.getElementById('filter-position-class').value = 'ALL';
        document.querySelectorAll('.slider-group').forEach(g => {
            g.querySelector('input').value = 1;
            g.querySelector('.val-lbl').textContent = 1;
        });
        renderDashboard();
    }

    function applyPreset(type) {
        resetAllFilters();
        if (type === 'wonderkid') document.getElementById('sort-order').value = 'age-asc';
        if (type === 'zerocost') {
            const detGroup = document.querySelector('.slider-group[data-id="det"]');
            detGroup.querySelector('input').value = 15;
            detGroup.querySelector('.val-lbl').textContent = 15;
        }
        renderDashboard();
    }

    async function handleIncomingFile(e) {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const buffer = await file.arrayBuffer();
            const arr = new Uint8Array(buffer.slice(0, 4));
            const isUtf16 = (arr[0] === 0xFF && arr[1] === 0xFE) || (arr[0] === 0x3C && arr[1] === 0x00);

            const decoder = new TextDecoder(isUtf16 ? 'utf-16le' : 'utf-8');
            parseHTMLReport(decoder.decode(buffer));
        } catch (err) {
            showToastNotification('เกิดข้อผิดพลาดในการโหลดระบบโครงสร้างไฟล์', 'error');
        }
    }

    function parseHTMLReport(htmlString) {
        try {
            const doc = new DOMParser().parseFromString(htmlString, 'text/html');
            const table = doc.querySelector('table');
            if (!table) return showToastNotification('ไม่พบตารางสรุปรายงานในไฟล์ HTML ที่อัปโหลด', 'error');

            const rows = Array.from(table.querySelectorAll('tr'));
            const headers = Array.from(rows[0].querySelectorAll('td')).map(td => td.textContent.trim());

            // ดึงพิกัดดัชนีคอลัมน์จาก Header
            const idxMap = {
                name: headers.indexOf('Name'), age: headers.indexOf('Age'),
                val: headers.indexOf('Value'), pos: headers.indexOf('Position'),
                avRat: headers.findIndex(h => h.includes('Av Rat') || h.includes('AvRaw')),
                gls: headers.indexOf('Gls'),
                ast: headers.indexOf('Ast'),
                apps: headers.indexOf('Apps'),
                intApps: headers.indexOf('Int'),
                ythApps: headers.findIndex(h => h.includes('Yth Apps') || h.includes('Yth')) // 💡 ดักจับคอลัมน์เยาวชน
            };

            if (idxMap.name === -1) return showToastNotification('ไฟล์ไม่ตรงตามแพตเทิร์นสกินหลัก', 'error');

            globalPlayersDatabase = rows.slice(1).map(row => {
                const tds = Array.from(row.querySelectorAll('td')).map(td => td.textContent.trim());
                if (tds.length === 0 || !tds[idxMap.name]) return null;

                const p = {
                    Name: tds[idxMap.name],
                    Age: parseInt(tds[idxMap.age]) || 18,
                    Value: tds[idxMap.val] || '-',
                    Position: tds[idxMap.pos] || 'M (C)',
                    SecPosition: headers.includes('Sec. Position') ? tds[headers.indexOf('Sec. Position')] : '-',
                    AvRat: idxMap.avRat !== -1 ? tds[idxMap.avRat] : '-',
                    LeftFoot: headers.includes('Left Foot') ? tds[headers.indexOf('Left Foot')] : 'Reasonable',
                    RightFoot: headers.includes('Right Foot') ? tds[headers.indexOf('Right Foot')] : 'Very Strong',
                    Club: headers.includes('Club') ? tds[headers.indexOf('Club')] : 'Unknown',

                    // 💡 กำหนดค่าเริ่มต้นแยกกันอย่างชัดเจนป้องกันการชนกันของตัวแปร
                    Nationality: 'Unknown',
                    NaturalFitness: 10,

                    Gls: idxMap.gls !== -1 ? parseInt(tds[idxMap.gls]) || 0 : 0,
                    Ast: idxMap.ast !== -1 ? parseInt(tds[idxMap.ast]) || 0 : 0,
                    Apps: idxMap.apps !== -1 ? tds[idxMap.apps] : '0',
                    YthApps: idxMap.ythApps !== -1 ? parseInt(tds[idxMap.ythApps]) || 0 : 0,
                    IntApps: idxMap.intApps !== -1 ? parseInt(tds[idxMap.intApps]) || 0 : 0
                };

                // วนลูปเก็บค่าพลัง Attributes ย่อย
                headers.forEach((h, index) => {
                    if (['Name', 'Age', 'Value', 'Position', 'Sec. Position', 'Av Rat', 'Left Foot', 'Right Foot', 'Club'].includes(h) || !h) return;

                    // 💡 ตรรกะคัดกรองคำซ้ำขั้นสูง: เช็คคอลัมน์ 'Nat'
                    if (h === 'Nat') {
                        if (isNaN(tds[index]) || tds[index] === '-') {
                            p.Nationality = tds[index] || 'Unknown'; // ถ้าเป็นข้อความ (เช่น GER, BIH) -> สัญชาติ
                        } else {
                            p.NaturalFitness = parseInt(tds[index]) || 10; // ถ้าเป็นตัวเลข -> Natural Fitness
                        }
                    } else {
                        // แมปชื่อเรียกค่าพลังทางขวาสุดตามปกติ
                        p[h] = parseInt(tds[index]) || 1;
                    }
                });

                // ผูกค่ากลับไปหา Physical Attribute ให้ฟังก์ชันแสดงผลทางขวาเรียกใช้ได้ไม่พัง
                p.Nat = p.NaturalFitness;

                return p;
            }).filter(Boolean);

            renderDashboard();
            showToastNotification(`นำเข้าข้อมูลสำเร็จแล้วจำนวน ${globalPlayersDatabase.length} รายการ`);
        } catch (e) {
            showToastNotification('กระบวนการดึงข้อมูลผิดพลาด', 'error');
        }
    }

    function renderDashboard() {
        const query = document.getElementById('search-name').value.toLowerCase();
        const posClass = document.getElementById('filter-position-class').value;
        const sortOrder = document.getElementById('sort-order').value;
        const getFilterVal = (id) => parseInt(document.querySelector(`.slider-group[data-id="${id}"] input`).value);

        // เชื่อมต่อการวิเคราะห์จาก Moduleคำนวณภายนอก (TacticalAnalytics)
        let processed = globalPlayersDatabase.map(p => ({
            ...p,
            _analytics: TacticalAnalytics.calculate(p)
        })).filter(p => {
            if (!p.Name.toLowerCase().includes(query) && !p.Nationality.toLowerCase().includes(query)) return false;

            if (posClass !== 'ALL') {
                const matchMap = {
                    GK: p.Position === 'GK',
                    DC: p.Position.includes('D (C)'),
                    'DL/R': p.Position.includes('D (L)') || p.Position.includes('D (R)') || p.Position.includes('WB'),
                    MC: p.Position.includes('M (C)') || p.Position.includes('DM'),
                    AMC: p.Position.includes('AM (C)'),
                    'AMR/L': p.Position.includes('AM (R)') || p.Position.includes('AM (L)'),
                    ST: p.Position.includes('ST')
                };
                if (!matchMap[posClass]) return false;
            }

            if (['defending', 'physical', 'speed', 'creativity', 'attacking'].some(m => p._analytics[m] < getFilterVal(`avg-${m}`))) return false;
            if (['fin', 'pas', 'tac', 'ant', 'pac', 'det'].some(attr => (p[attr.charAt(0).toUpperCase() + attr.slice(1)] || 1) < getFilterVal(attr))) return false;

            return true;
        });

        const sortMap = {
            'buy-score-desc': (a, b) => b._analytics.buyScore - a._analytics.buyScore,
            'total-desc': (a, b) => b._analytics.totalAttr - a._analytics.totalAttr,
            'avrat-desc': (a, b) => parseFloat(b.AvRat || 0) - parseFloat(a.AvRat || 0),
            'age-asc': (a, b) => a.Age - b.Age
        };
        processed.sort(sortMap[sortOrder]);

        document.getElementById('match-count-badge').innerHTML = `<i class="fa-solid fa-filter mr-1.5"></i>ผ่านคัดกรอง: ${processed.length}`;
        document.getElementById('player-count-badge').innerHTML = `<i class="fa-solid fa-database mr-1.5"></i>ฐานข้อมูล: ${globalPlayersDatabase.length} นักเตะ`;

        const isCard = !document.getElementById('cards-view-container').classList.contains('hidden');
        isCard ? renderCards(processed) : renderTable(processed);
    }

    function renderCards(list) {
        const container = document.getElementById('cards-view-container');
        container.innerHTML = list.length === 0 ? `<div class="bg-pitch-panel border border-pitch-border p-12 text-center font-mono text-xs text-gray-500">// NO SCOUTING DATA GENERATED. PLEASE UPLOAD INTERMEDIATE REPORT FILE.</div>` : '';

        list.forEach((p, idx) => {
            const card = document.createElement('div');
            card.className = "bg-pitch-panel border border-pitch-border flex flex-col xl:flex-row overflow-hidden relative group";

            const renderAttr = (title, keys) => {
                return `<div class="flex-1 font-mono"><h4 class="text-[9px] font-bold text-pitch-gold uppercase border-b border-pitch-border/60 pb-1 mb-2 tracking-widest">${title}</h4>` +
                    keys.map(k => `<div class="flex justify-between text-[11px] py-1 border-b border-pitch-border/10 hover:bg-pitch-bg/40 px-1"><span class="text-gray-500">${k}</span><span class="${p[k] >= 17 ? 'text-pitch-gold font-bold bg-pitch-gold/10 px-1' : p[k] >= 15 ? 'text-white font-bold bg-white/5 px-1' : 'text-gray-400'}">${p[k] ?? '-'}</span></div>`).join('') + `</div>`;
            };

            const leftFootClass = getFootStyle(p.LeftFoot);
            const rightFootClass = getFootStyle(p.RightFoot);

            const ana = p._analytics;
            const labels = { defending: 'เกมรับ', physical: 'ร่างกาย', speed: 'ความเร็ว', creativity: 'สร้างสรรค์', attacking: 'เกมรุก', technical: 'เทคนิค', aerial: 'ลูกกลางอากาศ', mental: 'สภาพจิตใจ' };
            let pros = Object.keys(labels).filter(k => ana[k] >= 15).map(k => labels[k]);
            let cons = Object.keys(labels).filter(k => ana[k] < 10).map(k => labels[k]);

            card.innerHTML = `
    <!-- โซนกราฟเรดาร์ความคมชัดวิศวกรรมแทคติก -->
    <div class="p-6 flex items-center justify-center bg-pitch-bg/20 min-w-[220px] border-b xl:border-b-0 xl:border-r border-pitch-border/50">
        <canvas id="radar-${idx}" width="170" height="170" class="opacity-90 group-hover:opacity-100 transition-opacity"></canvas>
    </div>

    <!-- แผงประวัติสถิติและคะแนนวิเคราะห์เชิงลึก -->
    <div class="p-6 flex flex-col justify-between border-b xl:border-b-0 xl:border-r border-pitch-border/50 xl:w-80 shrink-0">
        <div>
            <div class="flex justify-between items-start gap-2">
                <div>
                    <h3 class="text-base font-display font-bold text-white flex items-center gap-2">
                        ${p.Name} 
                        <button class="btn-copy text-[9px] font-mono text-pitch-gold bg-pitch-gold/5 px-1.5 py-0.5 border border-pitch-gold/20 hover:bg-pitch-gold/20 transition-all" data-name="${p.Name}">
                            COPY
                        </button>
                    </h3>
                    <p class="text-[11px] font-mono text-gray-500 tracking-wider mt-0.5">${p.Position}</p>
                </div>
                <div class="text-right font-mono">
                    <div class="text-xs font-bold text-white">${p.Value}</div>
                    <span class="text-[10px] text-pitch-gold bg-pitch-gold/10 px-1 font-bold">Age: ${p.Age}</span>
                </div>
            </div>
            
            <div class="flex flex-wrap gap-1 mt-3">
                ${p.Age <= 21 && p._analytics.buyScore >= 70 ? '<span class="border border-pitch-gold/40 text-pitch-gold font-mono text-[9px] px-2 py-0.5 bg-pitch-gold/5 font-bold tracking-wider">ELITE WONDERKID</span>' : ''}
                ${p.Det >= 16 ? '<span class="border border-pitch-mint/40 text-pitch-mint font-mono text-[9px] px-2 py-0.5 bg-pitch-mint/5 font-bold tracking-wider">IRON WILL</span>' : ''}
            </div>

            <div class="mt-4 grid grid-cols-4 gap-0.5 text-center bg-pitch-bg border border-pitch-border/60 font-mono p-2">
                <div>
                    <span class="text-gray-600 block text-[9px] uppercase">RATING</span>
                    <span class="text-white font-bold text-xs">${p.AvRat}</span>
                </div>
                <div class="border-l border-pitch-border/40">
                    <span class="text-gray-600 block text-[9px] uppercase">Apps</span>
                    <span class="text-white font-bold text-xs">${p.Apps}</span>
                </div>
                <div class="border-l border-pitch-border/40">
                    <span class="text-pitch-gold block text-[9px] uppercase">Gls</span>
                    <span class="text-white font-bold text-xs">${p.Gls}</span>
                </div>
                <div class="border-l border-pitch-border/40">
                    <span class="text-pitch-mint block text-[9px] uppercase">Ast</span>
                    <span class="text-white font-bold text-xs">${p.Ast}</span>
                </div>
            </div>
            
            <div class="border-t border-pitch-border/40 mt-4 pt-3 font-mono text-[11px] flex flex-col gap-1.5 text-gray-400">
                <div class="flex justify-between items-center">
                    <span>Dominant Feet (L/R):</span>
                    <span class="text-white text-xs">${p.LeftFoot.substring(0, 4)} / ${p.RightFoot.substring(0, 4)}</span>
                </div>
                <div class="flex justify-between"><span>Club / Nation:</span><span class="text-white truncate max-w-[160px]">${p.Club} / ${p.Nationality}</span></div>
                <div class="flex justify-between"><span>Int Caps / Youth:</span><span class="text-white">${p.IntApps} <span class="text-gray-600">(${p.YthApps})</span></span></div>
                <div class="flex justify-between"><span>Calculated Role:</span><span class="text-pitch-gold font-bold">${p._analytics.bestPos}</span></div>
                <div class="flex justify-between items-center pt-1 border-t border-pitch-border/20"><span>Purchase Score:</span><span class="text-pitch-gold font-display font-bold text-sm">${p._analytics.buyScore} / 100</span></div>
            </div>
        </div>

        <div class="mt-4 pt-3 border-t border-pitch-border/30">
            <button class="toggle-desc-btn text-[10px] font-mono w-full bg-pitch-bg hover:bg-pitch-border text-gray-400 hover:text-white py-2 transition-all uppercase tracking-widest">
                // TOGGLE TEXTUAL SUMMARY
            </button>
        </div>
    </div>

    <!-- บล็อกแสดงข้อมูลค่าพลังดิบสไตล์โมโนสเปซคมกริบ -->
    <div class="attr-raw-block flex-grow p-6 flex flex-col sm:flex-row gap-6 bg-pitch-bg/20">
        ${renderAttr('Technical Core', ['Cro', 'Dri', 'Fin', 'Fir', 'Hea', 'Pas', 'Tac', 'Tec'])}
        ${renderAttr('Mental Frame', ['Ant', 'Bra', 'Cmp', 'Cnt', 'Dec', 'Det', 'Off', 'Pos', 'Wor'])}
        ${renderAttr('Physical Index', ['Acc', 'Agi', 'Bal', 'Jum', 'Nat', 'Pac', 'Sta', 'Str'])}
    </div>

    <!-- บล็อกสรุปข้อความกรณีเปิดดูบทวิเคราะห์ -->
    <div class="attr-summary-block hidden flex-grow p-6 bg-pitch-bg/40 flex flex-col gap-4 font-mono">
        <h4 class="text-xs font-bold text-pitch-gold uppercase tracking-wider border-b border-pitch-border pb-2">
            // TACTICAL INTELLIGENCE DOSSIER
        </h4>
        <div class="text-xs text-gray-400 leading-relaxed space-y-3">
            <p class="text-white">
                > Target profile <span class="text-pitch-gold">${p.Name}</span> operates optimally within <span class="text-pitch-gold">${p.Position}</span> architectures.
            </p>
            <div class="p-3 bg-pitch-bg border-l-2 border-pitch-gold">
                <span class="text-pitch-gold font-bold block mb-1">PROS / KEY ADVANTAGES:</span>
                <span class="text-gray-300 text-[11px]">${pros.length ? pros.join(', ') : 'ไม่มีทักษะที่อยู่ในระดับสูงเป็นพิเศษ'}</span>
            </div>
            <div class="p-3 bg-pitch-bg border-l-2 border-gray-600">
                <span class="text-gray-500 font-bold block mb-1">CONS / LIMITATIONS:</span>
                <span class="text-gray-300 text-[11px]">${cons.length ? cons.join(', ') : 'โครงสร้างพลังมีความสมดุล ไม่มีจุดบกพร่องร้ายแรง'}</span>
            </div>
        </div>
    </div>
`;

            card.querySelector('.btn-copy').addEventListener('click', function () {
                executeTextCopy(this.getAttribute('data-name'), this);
            });

            card.querySelector('.toggle-desc-btn').addEventListener('click', function () {
                const rawBlock = card.querySelector('.attr-raw-block');
                const summaryBlock = card.querySelector('.attr-summary-block');
                const isShowingRaw = !rawBlock.classList.contains('hidden');
                if (isShowingRaw) {
                    rawBlock.classList.add('hidden');
                    summaryBlock.classList.remove('hidden');
                    this.innerHTML = '// SHOW RAW METRIC GRID';
                } else {
                    rawBlock.classList.remove('hidden');
                    summaryBlock.classList.add('hidden');
                    this.innerHTML = '// TOGGLE TEXTUAL SUMMARY';
                }
            });

            container.appendChild(card);
            drawRadarPolygon(`radar-${idx}`, p._analytics);
        });
    }

    function drawRadarPolygon(canvasId, analyticsData) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        // เคลียร์ Canvas เก่าก่อนวาดใหม่
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const cx = canvas.width / 2, cy = canvas.height / 2, r = 55;

        const metrics = [
            { name: 'DEF', val: analyticsData.defending },
            { name: 'PHY', val: analyticsData.physical },
            { name: 'SPD', val: analyticsData.speed },
            { name: 'CRE', val: analyticsData.creativity },
            { name: 'ATT', val: analyticsData.attacking },
            { name: 'TEC', val: analyticsData.technical },
            { name: 'AER', val: analyticsData.aerial },
            { name: 'MEN', val: analyticsData.mental }
        ];

        const numAxes = metrics.length;

        // 1. วาดเส้นโครงสร้างใยแมงมุมตารางพิกัดหลังบ้าน (Background Grid)
        ctx.strokeStyle = 'rgba(32, 46, 59, 0.5)';
        ctx.lineWidth = 0.5;
        [20, 15, 10, 5].forEach(level => {
            ctx.beginPath();
            metrics.forEach((_, i) => {
                const angle = (i * Math.PI / 4) - Math.PI / 2;
                const currR = (level / 20) * r;
                ctx[i === 0 ? 'moveTo' : 'lineTo'](cx + currR * Math.cos(angle), cy + currR * Math.sin(angle));
            });
            ctx.closePath();
            ctx.stroke();
        });

        // 2. คำนวณพิกัดจุดพลังของนักเตะเก็บไว้ใน Array
        const points = [];
        let hasEliteAttribute = false;
        metrics.forEach((m, i) => {
            const angle = (i * Math.PI / 4) - Math.PI / 2;
            const normalizedVal = Math.max(1, Math.min(20, m.val));
            const dist = (normalizedVal / 20) * r;
            if (normalizedVal >= 16) hasEliteAttribute = true;
            points.push({
                x: cx + dist * Math.cos(angle),
                y: cy + dist * Math.sin(angle),
                angle: angle,
                val: normalizedVal
            });
        });

        // 3. ถมพื้นที่แรเงาความสามารถให้สว่างดึงสายตา (High-Contrast Fills)
        ctx.beginPath();
        points.forEach((pt, i) => {
            ctx[i === 0 ? 'moveTo' : 'lineTo'](pt.x, pt.y);
        });
        ctx.closePath();

        // ถ้านักเตะมีพลังระดับ Elite ให้กราฟสว่างวาบเป็นพิเศษ
        ctx.fillStyle = hasEliteAttribute ? 'rgba(229, 193, 88, 0.24)' : 'rgba(229, 193, 88, 0.14)';
        ctx.fill();

        // 4. วาดเส้นขอบเอฟเฟกต์นีออนเรืองแสง (Double-Pass Neon Glow Stroke)[cite: 1]
        // Pass 4.1: วาดเอฟเฟกต์ฟุ้งกระจายด้านหลัง (Blur Glow Layer)
        for (let i = 0; i < numAxes; i++) {
            const pt1 = points[i];
            const pt2 = points[(i + 1) % numAxes];

            ctx.beginPath();
            ctx.moveTo(pt1.x, pt1.y);
            ctx.lineTo(pt2.x, pt2.y);

            if (pt1.val >= 15) {
                ctx.strokeStyle = pt1.val >= 17 ? 'rgba(229, 193, 88, 0.4)' : 'rgba(255, 255, 255, 0.3)';
                ctx.lineWidth = 4.5; // เส้นหนาเพื่อสร้างมิติฟุ้ง
                ctx.stroke();
            }
        }

        // Pass 4.2: วาดเส้นแกนหลักที่คมกริบทับด้านบน (Core Sharp Vector)
        for (let i = 0; i < numAxes; i++) {
            const pt1 = points[i];
            const pt2 = points[(i + 1) % numAxes];

            ctx.beginPath();
            ctx.moveTo(pt1.x, pt1.y);
            ctx.lineTo(pt2.x, pt2.y);

            if (pt1.val >= 17) {
                ctx.strokeStyle = '#E5C158'; // Gold[cite: 1]
                ctx.lineWidth = 2.0;
            } else if (pt1.val >= 15) {
                ctx.strokeStyle = '#ffffff'; // White[cite: 1]
                ctx.lineWidth = 1.5;
            } else {
                ctx.strokeStyle = '#4b5563'; // Gray-600[cite: 1]
                ctx.lineWidth = 1.0;
            }
            ctx.stroke();
        }

        // 5. วาดหมุดจุดตัด (Vertex Nodes) และข้อความกำกับ
        points.forEach((pt, i) => {
            const m = metrics[i];

            // วาดจุดแกนพลังให้ชัดขึ้น[cite: 1]
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, pt.val >= 15 ? 3.5 : 2.5, 0, 2 * Math.PI);
            ctx.fillStyle = pt.val >= 15 ? '#E5C158' : '#374151';
            ctx.fill();

            // เพิ่มวงแหวนไฮไลท์สีขาวครอบหมุดระดับโปร
            if (pt.val >= 16) {
                ctx.beginPath();
                ctx.arc(pt.x, pt.y, 4.5, 0, 2 * Math.PI);
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
                ctx.lineWidth = 0.8;
                ctx.stroke();
            }

            // เส้นแกนกลางวิ่งเข้าหาจุดศูนย์กลาง
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + r * Math.cos(pt.angle), cy + r * Math.sin(pt.angle));
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.lineWidth = 0.5;
            ctx.stroke();

            // แสดงตัวอักษรหัวข้อสถิติแบบคมชัด
            ctx.font = '700 8.5px "JetBrains Mono", monospace';
            ctx.fillStyle = pt.val >= 17 ? '#E5C158' : pt.val >= 15 ? '#ffffff' : '#6b7280';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            const labelDist = r + 13;
            const lx = cx + labelDist * Math.cos(pt.angle);
            const ly = cy + labelDist * Math.sin(pt.angle);

            ctx.fillText(`${m.name}`, lx, ly);
        });
    }
    function renderTable(list) {
        const tbody = document.getElementById('spreadsheet-tbody');
        tbody.innerHTML = list.length === 0 ? `<tr><td colspan="9" class="p-8 text-center text-gray-500">ไม่มีข้อมูลที่ตรงตามเงื่อนไข</td></tr>` : '';

        list.forEach(p => {
            const tr = document.createElement('tr');
            tr.className = "hover:bg-fm-border/30 transition-colors border-b border-fm-border/30";
            tr.innerHTML = `
                <td class="p-3"><div class="font-bold text-white">${p.Name} <span class="text-[9px] bg-fm-border px-1 py-0.5 rounded text-gray-400 font-normal ml-1">${p.Club}</span></div></td>
                <td class="p-3 text-center text-amber-400 font-bold">${p.Age}</td>
                <td class="p-3 text-gray-300">${p.Position}</td>
                <td class="p-3 text-right font-semibold text-white">${p.Value}</td>
                <td class="p-3 text-center"><span class="bg-fm-excellent/15 text-fm-excellent px-2 py-0.5 rounded font-bold">${p.AvRat}</span></td>
                <td class="p-3 text-center text-gray-400 text-[11px]">L:${p.LeftFoot} / R:${p.RightFoot}</td>
                <td class="p-3 text-center font-bold text-emerald-400">${p.Det}</td>
                <td class="p-3 text-center font-bold">${p._analytics.totalAttr}</td>
                <td class="p-3 text-center"><span class="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-black">${p._analytics.buyScore}</span></td>
            `;
            tbody.appendChild(tr);
        });
    }

    async function executeTextCopy(text, btnElement) {
        try {
            await navigator.clipboard.writeText(text);
            const origHTML = btnElement.innerHTML;
            btnElement.innerHTML = '<i class="fa-solid fa-check"></i>';
            btnElement.className = "text-[9px] text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded border border-emerald-500/30";
            setTimeout(() => {
                btnElement.innerHTML = origHTML;
                btnElement.className = "text-[9px] text-fm-excellent bg-fm-excellent/10 px-1.5 py-0.5 rounded border border-fm-excellent/20 hover:bg-fm-excellent/30";
            }, 1200);
        } catch (err) {
            showToastNotification('ไม่สามารถบันทึกข้อความลงคลิปบอร์ดได้', 'error');
        }
    }

    function showToastNotification(message, statusType = 'success') {
        const toast = document.createElement('div');
        toast.className = `fixed bottom-5 right-5 z-50 p-3 rounded-lg shadow-xl text-xs font-bold flex items-center gap-2 border ${statusType === 'success' ? 'bg-emerald-950/90 border-emerald-500/30 text-emerald-300' : 'bg-red-950/90 border-red-500/30 text-red-300'} backdrop-blur-md`;
        toast.innerHTML = `<i class="fa-solid ${statusType === 'success' ? 'fa-circle-check text-emerald-400' : 'fa-triangle-exclamation text-red-400'}"></i> ${message}`;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2500);
    }

    /**
    * ฟังก์ชันช่วยแปลงระดับความถนัดของเท้าให้เป็นสีตามระบบ FM
    * @param {string} footRating - ระดับความถนัด เช่น "Very Strong", "Strong", "Weak"
    * @returns {string} Tailwind Class สำหรับกำหนดสี
    */
    function getFootStyle(footRating) {
        switch (footRating) {
            case 'Very Strong':
                return 'text-fm-excellent drop-shadow-[0_0_3px_rgba(77,160,214,0.5)]'; // ฟ้าเด่น
            case 'Strong':
                return 'text-fm-good'; // ฟ้าอ่อน
            case 'Fairly Strong':
                return 'text-emerald-400'; // เขียว
            case 'Reasonable':
                return 'text-amber-400'; // เหลือง
            case 'Weak':
                return 'text-orange-400'; // ส้ม
            case 'Very Weak':
            default:
                return 'text-red-400'; // แดง
        }
    }
})();