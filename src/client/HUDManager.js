// --- src/client/HUDManager.js ---
export class HUDManager {
    constructor() {
        this.dom = {
            hudContainer: document.getElementById('game-hud'),
            playerAvatar: document.getElementById('player-avatar'), // Lấy thẻ Avatar
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

        this.MAX_LB_ROWS = 10;
        this.lbPool = [];
        this.initLeaderboardPool();

        this.state = {
            hp: -1, maxHp: -1, exp: -1, maxExp: -1, level: -1,
            gold: -1, diamond: -1, kill: -1, death: -1,
        };
    }

    showHUD(show) {
        if (this.dom.hudContainer) {
            this.dom.hudContainer.style.display = show ? 'block' : 'none';
        }
    }

    updatePlayerStats(hp, maxHp, exp, maxExp, level, name) {
        if (!this.dom.hudContainer) return;
        
        if (name && this.dom.playerName.innerText !== name) {
            this.dom.playerName.innerText = name;
        }

        if (this.state.level !== level) {
            this.state.level = level;
            this.dom.levelText.innerText = `Level ${level}`;
            this.dom.levelBadge.innerText = level;
            // TỰ ĐỘNG CẬP NHẬT AVATAR THEO LEVEL
            if (this.dom.playerAvatar) {
                this.dom.playerAvatar.src = `img/lv${level}.png`;
            }
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
            const row = document.createElement('div');
            row.className = 'lb-row'; row.style.display = 'none';

            const leftDiv = document.createElement('div'); leftDiv.className = 'lb-rank-name';
            const rankSpan = document.createElement('span'); const nameSpan = document.createElement('span');
            leftDiv.appendChild(rankSpan); leftDiv.appendChild(nameSpan);

            const scoreSpan = document.createElement('span'); scoreSpan.className = 'lb-score';
            row.appendChild(leftDiv); row.appendChild(scoreSpan);
            this.dom.lbContainer.appendChild(row);

            this.lbPool.push({ element: row, rank: rankSpan, name: nameSpan, score: scoreSpan, active: false });
        }
    }

    updateLeaderboard(playersData) {
        if (!this.dom.lbContainer || !playersData) return;
        const sorted = [...playersData].sort((a, b) => { 
            if (b.level !== a.level) return b.level - a.level; 
            return (b.score || 0) - (a.score || 0); 
        });

        const count = Math.min(sorted.length, this.MAX_LB_ROWS);
        for (let i = 0; i < this.MAX_LB_ROWS; i++) {
            const poolItem = this.lbPool[i];
            if (i < count) {
                const data = sorted[i];
                poolItem.rank.innerText = `#${i + 1}`;
                poolItem.name.innerText = data.name || "Khách";
                
                // HIỂN THỊ CHUẨN K/D THEO THIẾT KẾ
                const kills = data.kills || data.score || 0; 
                const deaths = data.deaths || 0;
                poolItem.score.innerText = `${kills} / ${deaths}`;
                
                poolItem.element.className = `lb-row ${i < 3 ? 'rank-' + (i + 1) : ''}`;
                if (!poolItem.active) { poolItem.element.style.display = 'flex'; poolItem.active = true; }
            } else {
                if (poolItem.active) { poolItem.element.style.display = 'none'; poolItem.active = false; }
            }
        }
    }
}
export const HUD = new HUDManager();
