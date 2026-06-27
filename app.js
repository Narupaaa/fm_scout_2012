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

            const idxMap = {
                name: headers.indexOf('Name'), age: headers.indexOf('Age'),
                val: headers.indexOf('Value'), pos: headers.indexOf('Position'),
                avRat: headers.findIndex(h => h.includes('Av Rat') || h.includes('AvRaw'))
            };

            if (idxMap.name === -1) return showToastNotification('ไฟล์ไม่ตรงตามแพตเทิร์นสกินหลัก (ไม่พบคอลัมน์ Name)', 'error');

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
                    Nationality: 'Unknown', Nat: 10
                };

                headers.forEach((h, index) => {
                    if (['Name', 'Age', 'Value', 'Position', 'Sec. Position', 'Av Rat', 'Left Foot', 'Right Foot', 'Club'].includes(h) || !h) return;
                    if (h === 'Nat') {
                        isNaN(tds[index]) ? p.Nationality = tds[index] : p.Nat = parseInt(tds[index]) || 10;
                    } else {
                        p[h] = parseInt(tds[index]) || 1;
                    }
                });
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
        container.innerHTML = list.length === 0 ? `<div class="bg-fm-card border border-fm-border rounded-xl p-10 text-center text-gray-500"><i class="fa-solid fa-folder-open text-4xl block mb-3 text-gray-600"></i>ไม่มีข้อมูลนักเตะ กรุณานำเข้าไฟล์ HTML ด้านซ้าย</div>` : '';

        list.forEach((p, idx) => {
            const card = document.createElement('div');
            // ใช้ flex-col และ md:flex-row เพื่อให้แสดงผลเรียงจากซ้ายไปขวาบนจอคอมพิวเตอร์
            card.className = "bg-fm-card border border-fm-border rounded-xl shadow-lg flex flex-col md:flex-row overflow-hidden";

            const renderAttr = (title, keys) => {
                return `<div class="flex-1"><h4 class="text-[10px] font-black text-fm-excellent uppercase border-b border-fm-border/50 pb-0.5 mb-1">${title}</h4>` +
                    keys.map(k => `<div class="flex justify-between text-[10px] py-0.5 hover:bg-fm-bg/50 px-1 rounded"><span class="text-gray-400">${k}</span><span class="${p[k] >= 17 ? 'text-fm-excellent font-bold' : p[k] >= 15 ? 'text-fm-good font-bold' : 'text-white'}">${p[k] ?? '-'}</span></div>`).join('') + `</div>`;
            };

            const leftFootClass = getFootStyle(p.LeftFoot);
            const rightFootClass = getFootStyle(p.RightFoot);

            // 💡 จัด LAYOUT ใหม่ภายใน innerHTML: กราฟ (ซ้าย) -> ข้อมูล (กลาง) -> พลัง (ขวา)
            card.innerHTML = `
            <div class="p-4 flex items-center justify-center bg-fm-bg/30 min-w-[200px] border-b md:border-b-0 md:border-r border-fm-border/50">
                <canvas id="radar-${idx}" width="160" height="160"></canvas>
            </div>

            <div class="p-4 flex flex-col justify-between border-b md:border-b-0 md:border-r border-fm-border/50 md:w-80 shrink-0">
                <div>
                    <div class="flex justify-between items-start">
                        <div>
                            <h3 class="text-base font-extrabold text-white flex items-center gap-1.5">
                                ${p.Name} 
                                <button class="btn-copy text-[9px] text-fm-excellent bg-fm-excellent/10 px-1.5 py-0.5 rounded border border-fm-excellent/20 hover:bg-fm-excellent/30" data-name="${p.Name}">
                                    <i class="fa-regular fa-clone"></i>
                                </button>
                            </h3>
                            <p class="text-[11px] text-gray-400">${p.Position}</p>
                        </div>
                        <div class="text-right">
                            <div class="text-xs font-black text-white">${p.Value}</div>
                            <span class="text-[9px] bg-fm-excellent/20 text-fm-excellent px-1.5 py-0.5 rounded font-bold">Rat: ${p.AvRat}</span>
                        </div>
                    </div>
                    
                    <div class="flex flex-wrap gap-1 mt-2">
                        ${p.Age <= 21 && p._analytics.buyScore >= 70 ? '<span class="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px] px-1.5 py-0.5 rounded font-bold">WONDERKID</span>' : ''}
                        ${p.Det >= 16 ? '<span class="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] px-1.5 py-0.5 rounded font-bold">HIGH DET</span>' : ''}
                    </div>
                    
                    <div class="border-t border-fm-border/40 my-3 pt-2 text-xs flex flex-col gap-1 text-gray-300">
                        <div class="flex justify-between items-center py-1">
                            <span>เท้าที่ถนัด (L / R):</span>
                            <div class="flex items-center gap-3 text-base">
                                <span class="${leftFootClass} transition-all" title="เท้าซ้าย: ${p.LeftFoot}">
                                    <i class="fa-solid fa-shoe-prints -scale-x-100 inline-block"></i>
                                </span>
                                <span class="text-gray-600 text-[10px] font-mono">|</span>
                                <span class="${rightFootClass} transition-all" title="เท้าขวา: ${p.RightFoot}">
                                    <i class="fa-solid fa-shoe-prints"></i>
                                </span>
                            </div>
                        </div>
                        <div class="flex justify-between"><span>ตำแหน่งเด่น:</span><span class="text-fm-excellent font-bold">${p._analytics.bestPos} (${p._analytics.bestScore}%)</span></div>
                        <div class="flex justify-between"><span>ความน่าซื้อ:</span><span class="text-emerald-400 font-bold text-sm">${p._analytics.buyScore}/100</span></div>
                    </div>
                </div>
            </div>

            <div class="flex-grow p-4 flex gap-4 bg-[#151c25]/30">
                ${renderAttr('Technical', ['Cro', 'Dri', 'Fin', 'Fir', 'Hea', 'Pas', 'Tac', 'Tec'])}
                ${renderAttr('Mental', ['Ant', 'Bra', 'Cmp', 'Cnt', 'Dec', 'Det', 'Off', 'Pos', 'Wor'])}
                ${renderAttr('Physical', ['Acc', 'Agi', 'Bal', 'Jum', 'Nat', 'Pac', 'Sta', 'Str'])}
            </div>
        `;

            card.querySelector('.btn-copy').addEventListener('click', function () {
                executeTextCopy(this.getAttribute('data-name'), this);
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

        const cx = canvas.width / 2, cy = canvas.height / 2, r = 50;

        const metrics = [
            { name: 'Def', val: analyticsData.defending },
            { name: 'Phy', val: analyticsData.physical },
            { name: 'Spd', val: analyticsData.speed },
            { name: 'Cre', val: analyticsData.creativity },
            { name: 'Att', val: analyticsData.attacking },
            { name: 'Tec', val: analyticsData.technical },
            { name: 'Aer', val: analyticsData.aerial },
            { name: 'Men', val: analyticsData.mental }
        ];

        const numAxes = metrics.length;

        // 1. วาดพื้นหลัง 8 เหลี่ยมลดหลั่นตามโซนพลัง (FM Skin Styles)
        [['#65824c', 1], ['#b8a362', 15 / 20], ['#b07f56', 10 / 20], ['#a85b54', 5 / 20]].forEach(([color, ratio]) => {
            ctx.beginPath();
            metrics.forEach((_, i) => {
                const angle = (i * Math.PI / 4) - Math.PI / 2;
                ctx[i === 0 ? 'moveTo' : 'lineTo'](cx + (r * ratio) * Math.cos(angle), cy + (r * ratio) * Math.sin(angle));
            });
            ctx.closePath();
            ctx.fillStyle = color;
            ctx.fill();
        });

        // 2. คำนวณพิกัดจุดพลังของนักเตะเก็บไว้ใน Array
        const points = [];
        let maxVal = 1;
        metrics.forEach((m, i) => {
            const angle = (i * Math.PI / 4) - Math.PI / 2;
            const normalizedVal = Math.max(1, Math.min(20, m.val));
            const dist = (normalizedVal / 20) * r;
            if (normalizedVal > maxVal) maxVal = normalizedVal;
            points.push({
                x: cx + dist * Math.cos(angle),
                y: cy + dist * Math.sin(angle),
                angle: angle,
                val: normalizedVal
            });
        });

        // 3. ปรับปรุง: ระบบแรเงากราฟด้วยการไล่เฉดสีรัศมี (Radial Gradient Colors)
        // สร้าง Gradient จากจุดศูนย์กลางวิ่งออกไปยังขอบรัศมีสูงสุดของพลังนักเตะ
        const gradient = ctx.createRadialGradient(cx, cy, 2, cx, cy, (maxVal / 20) * r);

        // กำหนดสีแรเงาตามความเทพของนักเตะ (Excellent -> ฟ้าเรืองแสง, ทั่วไป -> ขาวนวลโปร่งแสง)
        if (maxVal >= 17) {
            gradient.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
            gradient.addColorStop(0.6, 'rgba(77, 160, 214, 0.35)'); // สีแรเงาฟ้า Excellent
            gradient.addColorStop(1, 'rgba(77, 160, 214, 0.15)');
        } else if (maxVal >= 15) {
            gradient.addColorStop(0, 'rgba(255, 255, 255, 0.35)');
            gradient.addColorStop(0.7, 'rgba(161, 208, 245, 0.25)'); // สีแรเงาฟ้าอ่อน Good
            gradient.addColorStop(1, 'rgba(161, 208, 245, 0.05)');
        } else {
            gradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
            gradient.addColorStop(1, 'rgba(255, 255, 255, 0.05)'); // สีขาวโปร่งแสงปกติ
        }

        // ถมพื้นที่แรเงาด้วยลวดลาย Gradient ที่คำนวณไว้
        ctx.beginPath();
        points.forEach((pt, i) => {
            ctx[i === 0 ? 'moveTo' : 'lineTo'](pt.x, pt.y);
        });
        ctx.closePath();

        ctx.fillStyle = 'rgba(237, 241, 245, 0.31)';

        ctx.fill();

        // 4. วาดเส้นขอบแบบแยกเซกเมนต์เปลี่ยนสีตามค่าพลัง
        ctx.lineWidth = 2.2;
        for (let i = 0; i < numAxes; i++) {
            const pt1 = points[i];
            const pt2 = points[(i + 1) % numAxes];

            ctx.beginPath();
            ctx.moveTo(pt1.x, pt1.y);
            ctx.lineTo(pt2.x, pt2.y);

            if (pt1.val >= 17) {
                ctx.strokeStyle = '#4da0d6';
            } else if (pt1.val >= 15) {
                ctx.strokeStyle = '#a1d0f5';
            } else {
                ctx.strokeStyle = '#ffffff';
            }
            ctx.stroke();
        }

        // 5. วาดจุดแกน (Vertices Dots) และข้อความกำกับค่าพลัง
        points.forEach((pt, i) => {
            const m = metrics[i];

            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 2.5, 0, 2 * Math.PI);
            ctx.fillStyle = pt.val >= 17 ? '#4da0d6' : pt.val >= 15 ? '#a1d0f5' : '#ffffff';
            ctx.fill();

            // เส้นใยแมงมุมวิ่งเข้าหาจุดศูนย์กลาง
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + r * Math.cos(pt.angle), cy + r * Math.sin(pt.angle));
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
            ctx.lineWidth = 0.5;
            ctx.stroke();

            // แสดงข้อความกำกับปรับสีตามความเก่ง
            ctx.font = 'bold 8px Inter, sans-serif';
            ctx.fillStyle = pt.val >= 17 ? '#4da0d6' : pt.val >= 15 ? '#a1d0f5' : '#cbd5e1';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            const labelDist = r + 12;
            const lx = cx + labelDist * Math.cos(pt.angle);
            const ly = cy + labelDist * Math.sin(pt.angle);

            ctx.fillText(`${m.name}(${m.val})`, lx, ly);
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