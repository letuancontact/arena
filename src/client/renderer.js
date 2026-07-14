// --- src/client/renderer.js ---
import { GameState } from './state.js';
const CONFIG = window.GAME_CONFIG;

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

export const Camera = {
  x: null, y: null, currentZoom: 1.0, targetZoom: 1.0,
  shakeX: 0, shakeY: 0, shakePower: 0, screenFlash: 0,
  
  getZoomByLevel(level) {
    let zoom = 1.0; const minZoom = 0.3;
    const zoomReductions = [0.008, 0.001, 0.002, 0.003, 0.004, 0.015, 0.01, 0.004, 0.002, 0.003, 0.008, 0.002, 0.002, 0.003, 0.002, 0.006, 0.002, 0.002, 0.002, 0.002, 0.008, 0.003, 0.008, 0.006, 0.004, 0.006, 0.006, 0.008, 0.007, 0.006, 0.008, 0.009, 0.006, 0.004, 0.002, 0.001, 0.001, 0.001, 0.001, 0.001];
    for (let i = 0; i < level - 1; i++) { zoom -= (zoomReductions[i] || 0); if (zoom < minZoom) { zoom = minZoom; break; } }
    if (window.innerWidth <= 768) zoom *= 0.55; 
    return zoom;
  },
  
  addShake(power) { this.shakePower = Math.max(this.shakePower, power); },

  update(targetX, targetY, dtMultiplier) {
    if (this.x === null) { this.x = targetX; this.y = targetY; }
    const dist = Math.hypot(targetX - this.x, targetY - this.y);
    if (dist > 200) { this.x = targetX; this.y = targetY; } 
    else { this.x += (targetX - this.x) * 0.15 * dtMultiplier; this.y += (targetY - this.y) * 0.15 * dtMultiplier; }
    if (Math.abs(this.currentZoom - this.targetZoom) > 0.001) this.currentZoom += (this.targetZoom - this.currentZoom) * CONFIG.ZOOM_SMOOTHING * dtMultiplier;
    else this.currentZoom = this.targetZoom;

    if (this.shakePower > 0.1) {
      this.shakeX = (Math.random() - 0.5) * this.shakePower;
      this.shakeY = (Math.random() - 0.5) * this.shakePower;
      this.shakePower *= 0.85; 
    } else { this.shakeX = 0; this.shakeY = 0; this.shakePower = 0; }
    if (this.screenFlash > 0) { this.screenFlash -= 0.03 * dtMultiplier; if (this.screenFlash < 0) this.screenFlash = 0; }
  },
};

export const Resources = {
  foodImages: {}, playerImages: {}, weaponImages: {}, mountImg: new Image(), kingImg: new Image(), mapBgImg: new Image(), mapPattern: null, mapPatternReady: false, offscreenCanvas: null, offscreenCtx: null,
  
  load() {
    for (let i = 0; i < 12; i++) { const img = new Image(); img.src = `img/food${i}.png`; this.foodImages[i] = img; }
    this.mountImg.src = "img/mountsright.png"; this.kingImg.src = "img/king.png";
    this.mapBgImg.onload = () => { this.mapPattern = ctx.createPattern(this.mapBgImg, "repeat"); this.mapPatternReady = true; Renderer.renderBackground(); };
    this.mapBgImg.src = "img/mapbg.png";
  },
  getPlayerImage(level) { if (!this.playerImages[level]) { const img = new Image(); img.src = `img/lv${level}.png`; this.playerImages[level] = img; } return this.playerImages[level]; },
  getWeaponImage(level) { if (!this.weaponImages[level]) { const img = new Image(); img.src = `img/weapon${level}.png`; this.weaponImages[level] = img; } return this.weaponImages[level]; },
};

export const FX = {
  particles: Array.from({length: 250}, () => ({ active: false, type: 0, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 0, color: "" })),
  spawn(x, y, vx, vy, life, size, color, type = 0) {
    for (let i = 0; i < this.particles.length; i++) {
      if (!this.particles[i].active) {
        const p = this.particles[i];
        p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.life = life; p.maxLife = life; p.size = size; p.color = color; p.type = type; p.active = true;
        break;
      }
    }
  },
  spawnHitSparks(x, y) {
    const num = window.innerWidth <= 768 ? 4 : 8; 
    for(let i=0; i<num; i++) {
      const angle = Math.random() * Math.PI * 2; const speed = Math.random() * 12 + 5;
      this.spawn(x, y, Math.cos(angle)*speed, Math.sin(angle)*speed, 0.3 + Math.random()*0.1, 2, "#ffcc00", 1);
    }
  },

  updateAndDraw(ctx, dtMultiplier, vL, vR, vT, vB) {
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (p.active) {
        p.x += p.vx * dtMultiplier; p.y += p.vy * dtMultiplier; p.life -= 0.016 * dtMultiplier; p.vx *= 0.92; p.vy *= 0.92; 
        if (p.life <= 0) { p.active = false; continue; } 
        if (p.x < vL || p.x > vR || p.y < vT || p.y > vB) continue;

        const ratio = p.life / p.maxLife;
        ctx.save();
        ctx.globalAlpha = ratio;
        ctx.fillStyle = p.color;
        if (p.type === 1) { 
          const angle = Math.atan2(p.vy, p.vx);
          ctx.translate(p.x, p.y); ctx.rotate(angle);
          ctx.fillRect(-p.size, -p.size/2, p.size * 4, p.size); // Dùng fillRect thay roundRect
        } else {
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size * ratio, 0, 6.28); ctx.fill();
        }
        ctx.restore();
      }
    }
  }
};

export const Renderer = {
  leaderboardDiv: null, xpBar: null, xpFill: null, fillImage: null, levelCircle: null, minimap: null, minimapCtx: null, 
  trails: Array.from({length: 150}, () => ({active: false, x:0, y:0, angle:0, level:1, radius:0, time:0})),
  levelUpEffects: Array.from({length: 5}, () => ({active: false, x:0, y:0, radius:0, start:0})),
  xpEffects: Array.from({length: 15}, () => ({active: false, x:0, y:0, amount:0, start:0})),
  visualRadius: {},
  floatingTexts: Array.from({length: 20}, () => ({active: false, x: 0, y: 0, text: "", color: "", size: 18, start: 0})),
  killFeeds: Array.from({length: 3}, () => ({active: false, killer: "", victim: "", isMe: false, start: 0})),
  lastHeight: 0, lastCheck: 0,

  addFloatingText(x, y, text, color, size) {
    for(let i=0; i<this.floatingTexts.length; i++) {
      if(!this.floatingTexts[i].active) {
        const e = this.floatingTexts[i]; e.x = x; e.y = y; e.text = text; e.color = color; e.size = size; e.start = Date.now(); e.active = true; break;
      }
    }
  },

  addKillFeed(k, v, isMe) {
    for(let i = 2; i > 0; i--) { Object.assign(this.killFeeds[i], this.killFeeds[i-1]); }
    Object.assign(this.killFeeds[0], { killer: String(k).substring(0, 12), victim: String(v).substring(0, 12), isMe, start: Date.now(), active: true });
  },

  addLevelUpEffect(x, y, radius) {
    for(let i=0; i<this.levelUpEffects.length; i++) {
      if(!this.levelUpEffects[i].active) { Object.assign(this.levelUpEffects[i], {x, y, radius, start: Date.now(), active: true}); break; }
    }
  },
  
  addTrail(x, y, angle, level, radius) {
    for (let i = 0; i < this.trails.length; i++) {
      const t = this.trails[i];
      if (!t.active) { Object.assign(t, {x, y, angle, level, radius, time: Date.now(), active: true}); break; }
    }
  },

  setupUI() {
    const isMob = window.innerWidth <= 768; const dpr = Math.min(window.devicePixelRatio || 1, 2); 
    this.xpBar = document.createElement("div"); this.xpBar.style.cssText = `bottom:10px;left:50%;transform:translateX(-50%) ${isMob ? 'scale(0.7)' : 'scale(1)'};transform-origin:bottom center;width:300px;height:40px;background:url(img/xpbar.png) no-repeat center center;background-size:cover;z-index:1000;overflow:hidden;position:fixed;`; document.body.appendChild(this.xpBar);
    this.xpFill = document.createElement("div"); this.xpFill.style.cssText = `position:absolute;bottom:12px;left:76px;width:215px;height:16px;overflow:hidden;`; this.xpBar.appendChild(this.xpFill);
    this.fillImage = document.createElement("div"); this.fillImage.style.cssText = `position:relative;left:-215px;width:215px;height:100%;background:url(img/progressxp.png) no-repeat left center;background-size:contain;transition:left 0.1s linear;`; this.xpFill.appendChild(this.fillImage);
    this.levelCircle = document.createElement("div"); this.levelCircle.style.cssText = `position:fixed;bottom:${isMob ? '16px' : '22px'};left:calc(50% - ${isMob ? '100px' : '142px'});width:20px;height:20px;color:white;font-family:Arial;font-size:16px;font-weight:800;display:flex;align-items:center;justify-content:center;z-index:1001;pointer-events:none;`; document.body.appendChild(this.levelCircle);
    this.leaderboardDiv = document.getElementById("leaderboard") || document.createElement("div"); this.leaderboardDiv.id = "leaderboard"; this.leaderboardDiv.style.cssText = `position:fixed;top:${isMob ? '5px' : '20px'};left:${isMob ? '5px' : '20px'};background:rgba(30,30,30,0.85);color:#f0f0f0;font-family:sans-serif;font-size:${isMob ? '10px' : '14px'};line-height:1.4;border-radius:8px;padding:${isMob ? '6px 10px' : '14px 20px'};z-index:1002;min-width:${isMob ? '110px' : '180px'};pointer-events:none;`; document.body.appendChild(this.leaderboardDiv);
    this.minimap = document.createElement("canvas"); this.minimap.width = 180 * dpr; this.minimap.height = 120 * dpr; 
    this.minimap.style.cssText = `position:fixed;top:5px;right:${isMob ? '5px' : '20px'};background:rgba(20,20,20,0.92);border-radius:8px;z-index:1002;width:${isMob ? '90px' : '180px'} !important;height:${isMob ? '60px' : '120px'} !important;pointer-events:none;`; 
    document.body.appendChild(this.minimap); this.minimapCtx = this.minimap.getContext("2d"); this.minimapCtx.scale(dpr, dpr);
  },
  
  resizeCanvas() { 
    const dpr = Math.min(window.devicePixelRatio || 1, 2); 
    canvas.width = window.innerWidth * dpr; canvas.height = window.innerHeight * dpr; 
    canvas.style.width = window.innerWidth + "px"; canvas.style.height = window.innerHeight + "px";
  },
  
  renderBackground() {
    if (!Resources.offscreenCanvas) { Resources.offscreenCanvas = document.createElement("canvas"); Resources.offscreenCanvas.width = CONFIG.MAP_WIDTH; Resources.offscreenCanvas.height = CONFIG.MAP_HEIGHT; Resources.offscreenCtx = Resources.offscreenCanvas.getContext("2d", {alpha: false}); }
    if (Resources.mapPatternReady) { Resources.offscreenCtx.fillStyle = Resources.mapPattern; Resources.offscreenCtx.fillRect(0, 0, CONFIG.MAP_WIDTH, CONFIG.MAP_HEIGHT); }
  },

  drawShadow(x, y, radius, sY = 1.0) {
    ctx.save(); ctx.translate(x, y + radius * 0.2); ctx.scale(1.0, 0.4 * sY);
    ctx.fillStyle = "rgba(0, 0, 0, 0.25)"; ctx.beginPath(); ctx.arc(0, 0, radius * 1.2, 0, 6.28); ctx.fill(); ctx.restore();
  },

  drawWeapons(x, y, radius, level, angle, isAtk, atkTime, isMov) {
    const img = Resources.getWeaponImage(level || 1);
    if (img && img.complete) {
      const size = radius * (2.75 + 0.04 * (level - 1)), offset = size * 0.4;
      let swing = 0, t = 0, sway = (isMov && !isAtk) ? Math.sin(Date.now() / 150) * 0.12 : 0;
      if (isAtk) {
        t = Math.min(1, (Date.now() - atkTime) / (CONFIG.BASE_ATTACK_DURATION + (level * CONFIG.ATTACK_DURATION_PER_LEVEL)));
        swing = Math.sin(t * Math.PI) * CONFIG.ATTACK_SWING_ANGLE;
      }
      let wAngle = angle - 2.2 + swing + sway;
      const wx = x + Math.cos(wAngle) * (radius + offset), wy = y + Math.sin(wAngle) * (radius + offset);
      ctx.save(); ctx.translate(wx, wy); ctx.rotate(wAngle - 0.4); 
      const {width, height} = this.getScaledImageSize(img, size);
      ctx.drawImage(img, -width/2, -height/2, width, height); ctx.restore();
    }
  },

  getScaledImageSize(img, target) {
    const ratio = img.naturalWidth / img.naturalHeight;
    return ratio > 1 ? {width: target, height: target / ratio} : {width: target * ratio, height: target};
  },

  draw(dt = 1) {
    if (GameState.clientX === null) return;
    const now = Date.now(); Camera.update(GameState.clientX, GameState.clientY, dt);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const wW = window.innerWidth, wH = window.innerHeight;
    
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = "#000"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr * Camera.currentZoom, 0, 0, dpr * Camera.currentZoom, (wW/2 - Camera.x * Camera.currentZoom) * dpr, (wH/2 - Camera.y * Camera.currentZoom) * dpr);
    
    if (Resources.offscreenCanvas) ctx.drawImage(Resources.offscreenCanvas, 0, 0);
    
    const vL = Camera.x - wW/(2*Camera.currentZoom) - 50, vR = Camera.x + wW/(2*Camera.currentZoom) + 50;
    const vT = Camera.y - wH/(2*Camera.currentZoom) - 50, vB = Camera.y + wH/(2*Camera.currentZoom) + 50;

    // --- ĐÃ TỐI ƯU 1: BATCH RENDERING THỨC ĂN (GOM THEO LOẠI ẢNH) ---
    const foodByType = {};
    for (const f of GameState.food) {
      if (f.x > vL && f.x < vR && f.y > vT && f.y < vB) {
        const type = f.type || 0;
        if (!foodByType[type]) foodByType[type] = [];
        foodByType[type].push(f);
      }
    }
    for (const type in foodByType) {
      const img = Resources.foodImages[type];
      if (img && img.complete) {
        for (const f of foodByType[type]) {
          const pulse = 1.0 + Math.sin(now / 200 + (f.x+f.y)%10) * 0.05;
          const size = f.radius * 2 * pulse;
          ctx.drawImage(img, f.x - size/2, f.y - size/2, size, size);
        }
      }
    }

    FX.updateAndDraw(ctx, dt, vL, vR, vT, vB);

    // VẼ NGƯỜI CHƠI KHÁC
    const renderTime = Date.now() - CONFIG.CLIENT_BUFFER_DELAY;
    let older = GameState.stateBuffer.find(s => s.time <= renderTime) || GameState.stateBuffer[0];
    let newer = GameState.stateBuffer[GameState.stateBuffer.indexOf(older) + 1] || older;
    let interpT = (older === newer) ? 0 : (renderTime - older.time) / (newer.time - older.time);

    for (const p of newer.players) {
      if (p.id === GameState.playerId || p.isDead) continue;
      const prev = older.players.find(o => o.id === p.id) || p;
      const x = prev.x + (p.x - prev.x) * interpT, y = prev.y + (p.y - prev.y) * interpT;
      if (x < vL || x > vR || y < vT || y > vB) continue;

      const vRad = p.radius; // Đã đơn giản hóa visualRadius để giảm lag
      const breath = 1.0 + Math.sin(now / 400) * 0.02;
      this.drawShadow(x, y, vRad, breath);
      const img = Resources.getPlayerImage(p.level || 1);
      if (img && img.complete) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(p.angle || 0); ctx.scale(1, breath);
        ctx.drawImage(img, -vRad, -vRad, vRad * 2, vRad * 2); ctx.restore();
      }
      this.drawWeapons(x, y, vRad, p.level, p.angle, p.isAttacking, p.attackTime, true);
    }
    
    // VẼ BẢN THÂN
    const me = (GameState.stateBuffer[GameState.stateBuffer.length-1]?.players || []).find(p => p.id === GameState.playerId);
    if (me && !me.isDead) {
      const breath = 1.0 + Math.sin(now / 400) * 0.02;
      this.drawShadow(GameState.clientX, GameState.clientY, GameState.clientRadius, breath);
      const img = Resources.getPlayerImage(GameState.clientLevel || 1);
      if (img && img.complete) {
        ctx.save(); ctx.translate(GameState.clientX, GameState.clientY); ctx.rotate(GameState.mouseAngle); ctx.scale(1, breath);
        ctx.drawImage(img, -GameState.clientRadius, -GameState.clientRadius, GameState.clientRadius * 2, GameState.clientRadius * 2); ctx.restore();
      }
      this.drawWeapons(GameState.clientX, GameState.clientY, GameState.clientRadius, GameState.clientLevel, GameState.mouseAngle, GameState.isAttacking, GameState.attackTime, GameState.isMoving);
    }

    // VẼ FLOATING TEXT (CHỈ VẼ TRONG MÀN HÌNH)
    for (const e of this.floatingTexts) {
      if (e.active) {
        const t = (now - e.start) / 1000; if (t > 1) { e.active = false; continue; }
        const fY = e.y - t * 50; if (e.x < vL || e.x > vR || fY < vT || fY > vB) continue;
        ctx.save(); ctx.globalAlpha = 1 - t; ctx.font = `900 ${e.size}px Arial`; ctx.textAlign = "center";
        ctx.lineWidth = 2; ctx.strokeStyle = (e.text === "KILL!") ? "#900" : "#0088ff";
        ctx.strokeText(e.text, e.x, fY); ctx.fillStyle = e.color; ctx.fillText(e.text, e.x, fY); ctx.restore();
      }
    }

    // --- VẼ UI GIAO DIỆN (DPR SCALE) ---
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    
    // ĐÃ TỐI ƯU 2: KILL FEED DÙNG fillRect (KHÔNG BO GÓC) ĐỂ GIẢM TẢI CPU
    if (this.leaderboardDiv) {
      if (now - this.lastCheck > 1000) { this.lastHeight = this.leaderboardDiv.offsetHeight; this.lastCheck = now; }
      const kfY = this.leaderboardDiv.offsetTop + this.lastHeight + 10;
      let active = 0;
      for (const kf of this.killFeeds) {
        if (!kf.active) continue;
        const elap = now - kf.start; if (elap > 3000) { kf.active = false; continue; }
        ctx.save(); ctx.globalAlpha = elap > 2500 ? (3000 - elap)/500 : 1;
        ctx.fillStyle = "rgba(0,0,0,0.4)";
        ctx.fillRect(20, kfY + active * 28, 200, 24); // Đã thay roundRect bằng fillRect
        ctx.font = "bold 12px Arial"; ctx.fillStyle = kf.isMe ? "#ff0" : "#fff";
        ctx.textAlign = "left"; ctx.fillText(kf.killer, 28, kfY + active * 28 + 17);
        ctx.textAlign = "right"; ctx.fillStyle = "#aaa"; ctx.fillText(kf.victim, 212, kfY + active * 28 + 17);
        ctx.restore(); active++;
      }
    }

    const meState = (GameState.stateBuffer[GameState.stateBuffer.length-1]?.players || []).find(p => p.id === GameState.playerId);
    if (!GameState.isDead) {
        const pct = Math.min(1, GameState.clientXp / GameState.clientXpToNext);
        this.fillImage.style.left = -215 + pct * 215 + "px";
        this.levelCircle.textContent = GameState.clientLevel;
    }
  }
};
