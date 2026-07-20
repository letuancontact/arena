// --- src/client/HUDManager.js ---
export class HUDManager {
    constructor() {
        this.dom = {
            hudContainer: document.getElementById('game-hud'),
            playerAvatar: document.getElementById('player-avatar'),
            playerName: document.getElementById('hud-player-name'),
            levelText: document.getElementById('hud-player-level-text'),
            levelBadge: document.getElementById('player-level-badge'),
            hpFill: document.getElementById('hud-hp-fill'),
            hpText: document.getElementById('hud-hp-text'),
            expFill: document.getElementById('hud-exp-fill'),
            gold: document.getElementById('hud-gold'),
            diamond: document.getElementById('hud-diamond'),
            kill: document.getElementById('hud-kill'),
            death: document.getElementById('hud-death'),
            lbContainer: document.getElementById('lb-pool-container'),
            comboFeed: document.getElementById('combo-announcement') // Quản lý thông báo Double, Triple
        };

        this.MAX_LB_ROWS = 7; // Top 5 + 1 vạch ngang + 1 bản thân
        this.lbPool = [];
        this.initLeaderboardPool();

        this.state = { hp: -1, maxHp: -1, exp: -1, maxExp: -1, level: -1, gold: -1, diamond: -1, kill: -1, death: -1 };
    }

    showHUD(show) { if (this.dom.hudContainer) this.dom.hudContainer.style.display = show ? 'block' : 'none'; }

    updatePlayerStats(hp, maxHp, exp, maxExp, level, name) {
        if (!this.dom.hudContainer) return;
        if (name && this.dom.playerName.innerText !== name) this.dom.playerName.innerText = name;
        if (this.state.level !== level) {
            this.state.level = level;
            this.dom.levelText.innerText = `Level ${level}`;
            this.dom.levelBadge.innerText = level;
            if (this.dom.playerAvatar) this.dom.playerAvatar.src = `img/lv${level}.png`;
        }
        if (this.state.hp !== hp || this.state.maxHp !== maxHp) {
            this.state.hp = hp; this.state.maxHp = maxHp;
            const hpPercent = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 1;
            this.dom.hpFill.style.transform = `scaleX(${hpPercent})`;
            this.dom.hpText.innerText = `${Math.ceil(hp)}/${maxHp}`;
        }
        if (this.state.exp !== exp || this.state.maxExp !== maxExp) {
            this.state.exp = exp; this.state.maxExp = maxExp;
            const expPercent = maxExp > 0 ? Math.max(0, Math.min(1, exp / maxExp)) : 0;
            this.dom.expFill.style.transform = `scaleX(${expPercent})`;
        }
    }

    updateTopBar(gold, diamond, kill, death) {
        if (!this.dom.hudContainer) return;
        if (this.state.gold !== gold) { this.state.gold = gold; this.dom.gold.innerText = gold; }
        if (this.state.diamond !== diamond) { this.state.diamond = diamond; this.dom.diamond.innerText = diamond; }
        if (this.state.kill !== kill) { this.state.kill = kill; this.dom.kill.innerText = kill; }
        if (this.state.death !== death) { this.state.death = death; this.dom.death.innerText = death; }
    }

    // --- HỆ THỐNG THÔNG BÁO DOUBLE KILL / TRIPLE KILL ---
    showKillMessage(killerName, killCount) {
        if (!this.dom.comboFeed) return;

        // Bỏ qua nếu chưa đạt mốc combo (1 kill thì không hiện thông báo bự)
        if (killCount < 2) return;

        let comboText = "";
        let color = "#fff";

        if (killCount === 2) { comboText = "DOUBLE KILL!"; color = "#ffaa00"; }      // Vàng cam
        else if (killCount === 3) { comboText = "TRIPLE KILL!"; color = "#00ffcc"; } // Xanh ngọc
        else if (killCount === 4) { comboText = "QUADRA KILL!"; color = "#b055ff"; } // Tím
        else if (killCount >= 5) { comboText = "PENTA KILL!"; color = "#ff0044"; }   // Đỏ

        // Dọn sạch chữ cũ trước khi đẩy chữ mới vào để đè lên nhau đẹp mắt
        this.dom.comboFeed.innerHTML = '';

        const item = document.createElement('div');
        item.className = 'combo-text-wrapper';
        item.innerHTML = `
            <div class="combo-killer-name">${killerName}</div>
            <div class="combo-title" style="color: ${color};">${comboText}</div>
        `;

        this.dom.comboFeed.appendChild(item);

        // Tự động xóa sau 2.5 giây
        setTimeout(() => {
            if (item.parentNode) item.parentNode.removeChild(item);
        }, 2500);
    }

    initLeaderboardPool() {
        if (!this.dom.lbContainer) return;
        for (let i = 0; i < this.MAX_LB_ROWS; i++) {
            const row = document.createElement('div'); row.className = 'lb-row'; row.style.display = 'none';
            const leftDiv = document.createElement('div'); leftDiv.className = 'lb-rank-name';
            const rankSpan = document.createElement('span'); const nameSpan = document.createElement('span');
            leftDiv.appendChild(rankSpan); leftDiv.appendChild(nameSpan);
            const scoreSpan = document.createElement('span'); scoreSpan.className = 'lb-score';
            row.appendChild(leftDiv); row.appendChild(scoreSpan);
            this.dom.lbContainer.appendChild(row);
            this.lbPool.push({ element: row, rank: rankSpan, name: nameSpan, score: scoreSpan, leftDiv: leftDiv, active: false });
        }
    }

    updateLeaderboard(playersData, myId) {
        if (!this.dom.lbContainer || !playersData) return;
        
        const sorted = [...playersData].sort((a, b) => { 
            if (b.level !== a.level) return b.level - a.level; 
            return (b.score || 0) - (a.score || 0); 
        });

        const topCount = Math.min(sorted.length, 5);
        let myIndex = sorted.findIndex(p => p.id === myId);

        this.lbPool.forEach(p => { p.element.style.display = 'none'; p.active = false; p.element.className = 'lb-row'; });

        for (let i = 0; i < topCount; i++) {
            this.renderLbRow(this.lbPool[i], sorted[i], i, myId);
        }

        if (myIndex >= 5) {
            const separator = this.lbPool[5];
            separator.element.className = 'lb-row separator';
            separator.element.innerHTML = '-------';
            separator.element.style.display = 'flex'; separator.active = true;

            const meRow = this.lbPool[6];
            meRow.element.innerHTML = '';
            meRow.element.appendChild(meRow.leftDiv); meRow.element.appendChild(meRow.score);
            this.renderLbRow(meRow, sorted[myIndex], myIndex, myId);
        }
    }

    renderLbRow(poolItem, data, index, myId) {
        poolItem.rank.innerText = `#${index + 1}`;
        poolItem.name.innerText = data.name || "Khách";
        
        // Hiển thị Level và Vương Miện
        const level = data.level || 1;
        const crowns = data.crowns || 0; 
        poolItem.score.innerText = `${level} / ${crowns}`;
        
        let classes = 'lb-row';
        if (index === 0) classes += ' rank-1';
        else if (index === 1) classes += ' rank-2';
        else if (index === 2) classes += ' rank-3';
        
        if (data.id === myId) classes += ' is-me'; 
        
        poolItem.element.className = classes;
        poolItem.element.style.display = 'flex';
        poolItem.active = true;
    }
}
export const HUD = new HUDManager();
