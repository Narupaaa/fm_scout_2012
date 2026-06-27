/**
 * Tactical Analytics Logic Engine for FM Scout
 */
const TacticalAnalytics = {
    FOOT_VALUES: { "Very Strong": 20, "Strong": 15, "Fairly Strong": 12, "Reasonable": 8, "Weak": 4, "Very Weak": 1 },

    /**
     * วิเคราะห์และคำนวณคะแนนประสิทธิภาพเชิงลึกรายบุคคล
     */
    calculate: function(player) {
        const getV = (k) => player[k] ?? 10;
        
        // 1. คำนวณค่าพลังเฉลี่ยแยกแต่ละแกนสำหรับกราฟเรดาร์
        const metrics = {
            defending: Math.round((getV('Mar') + getV('Tac') + getV('Pos')) / 3),
            physical: Math.round((getV('Agi') + getV('Bal') + getV('Sta') + getV('Str')) / 4),
            speed: Math.round((getV('Acc') + getV('Pac')) / 2),
            creativity: Math.round((getV('Pas') + getV('Cre') + getV('Fla')) / 3),
            attacking: Math.round((getV('Fin') + getV('Cmp') + getV('Off')) / 3),
            technical: Math.round((getV('Dri') + getV('Fir') + getV('Tec')) / 3),
            aerial: Math.round((getV('Hea') + getV('Jum')) / 2),
            mental: Math.round((getV('Ant') + getV('Bra') + getV('Cnt') + getV('Dec') + getV('Det') + getV('Tea')) / 6)
        };

        // 2. คำนวณความเหมาะสมของตำแหน่งอ้างอิงสูตร FM Paper Weighting
        const ratings = {
            GK: Math.round(((getV('Han')*2.5 + getV('Ref')*2.5 + getV('Agi')*1.65 + getV('One')*1.65) / 8.3) * 5),
            DC: Math.round(((getV('Hea')*1.9 + getV('Mar')*1.9 + getV('Tac')*1.9 + getV('Pos')*1.9) / 7.6) * 5),
            DL_R: Math.round(((getV('Tac')*2.15 + getV('Pos')*2.15 + getV('Acc')*2.15 + getV('Pac')*2.15) / 8.6) * 5),
            MC: Math.round(((getV('Pas')*2.0 + getV('Cre')*2.0 + getV('Fir')*1.15 + getV('Tec')*1.15) / 6.3) * 5),
            AMC: Math.round(((getV('Acc')*2.7 + getV('Pac')*2.7 + getV('Pas')*1.8 + getV('Cre')*1.8) / 9.0) * 5),
            AMR_L: Math.round(((getV('Acc')*3.55 + getV('Pac')*3.55 + getV('Dri')*1.8 + getV('Cro')*1.8) / 10.7) * 5),
            ST: Math.round(((getV('Acc')*3.2 + getV('Pac')*3.2 + getV('Fin')*1.55 + getV('Cmp')*1.55) / 9.5) * 5)
        };

        // หาตำแหน่งที่ดีที่สุดจาก Rating
        let bestPos = "MC", bestScore = 0;
        Object.entries(ratings).forEach(([pos, score]) => {
            if (score > bestScore) { bestScore = score; bestPos = pos; }
        });

        // 3. คำนวณค่ารวมพลังคุณสมบัติทั้งหมด (Total Attributes)
        let totalAttr = Object.keys(player).reduce((acc, k) => {
            return acc + (typeof player[k] === 'number' && !['Age','Nat'].includes(k) ? player[k] : 0);
        }, 0);
        
        // 4. คำนวณความคุ้มค่าราคาตลาด (Buy Score Market Analysis)
        let valNum = parseFloat(player.Value.replace(/[^0-9.]/g, '')) || 0;
        if (player.Value.toLowerCase().includes('m')) valNum *= 1000; // แปลงล้านเป็นหน่วยพันเพื่อเทียบฐานข้อมูลเดียวกัน
        
        let ageBonus = player.Age <= 21 ? 30 : player.Age <= 26 ? 22 : 12;
        let priceBonus = valNum > 15000 ? 5 : valNum > 2000 ? 15 : 25;
        let detBonus = getV('Det') >= 16 ? 5 : 0;

        let buyScore = Math.round((bestScore * 0.4) + ageBonus + priceBonus + detBonus);

        return {
            ...metrics,
            ratings,
            bestPos,
            bestScore,
            totalAttr,
            buyScore: Math.min(100, buyScore)
        };
    }
};