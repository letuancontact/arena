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
            lbContainer: document.getElementById('lb-pool-container')
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

        // Reset toàn bộ pool
        this.lbPool.forEach(p => { p.element.style.display = 'none'; p.active = false; p.element.className = 'lb-row'; });

        // 1. In Top 5
        for (let i = 0; i < topCount; i++) {
            this.renderLbRow(this.lbPool[i], sorted[i], i, myId);
        }

        // 2. Xử lý Vạch kẻ và Bản thân nếu nằm ngoài Top 5
        if (myIndex >= 5) {
            // Vạch kẻ ngang ở vị trí số 5 (pool index 5)
            const separator = this.lbPool[5];
            separator.element.className = 'lb-row separator';
            separator.element.innerHTML = '-------';
            separator.element.style.display = 'flex'; separator.active = true;

            // Dữ liệu bản thân ở vị trí số 6 (pool index 6)
            // Khôi phục lại cấu trúc HTML vì vạch kẻ ngang đã ghi đè innerHTML
            const meRow = this.lbPool[6];
            meRow.element.innerHTML = '';
            meRow.element.appendChild(meRow.leftDiv); meRow.element.appendChild(meRow.score);
            this.renderLbRow(meRow, sorted[myIndex], myIndex, myId);
        }
    }

    renderLbRow(poolItem, data, index, myId) {
        poolItem.rank.innerText = `#${index + 1}`;
        poolItem.name.innerText = data.name || "Khách";
        const kills = data.kills || data.score || 0;
        const deaths = data.deaths || 0;
        poolItem.score.innerText = `${kills} / ${deaths}`;
        
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
