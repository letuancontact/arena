// --- src/client/renderer.js ---
import { GameState } from './state.js';
const CONFIG = window.GAME_CONFIG;

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

export const Camera = {
  x: null, y: null, currentZoom: 1.0, targetZoom: 1.0,
  getZoomByLevel(level) {
    let zoom = 1.0; const minZoom = 0.3;
    const zoomReductions = [0.008, 0.001, 0.002, 0.003, 0.004, 0.015, 0.01, 0.004, 0.002, 0.003, 0.008, 0.002, 0.002, 0.003, 0.002, 0.006, 0.002, 0.002, 0.002, 0.002, 0.008, 0.003, 0.008, 0.006, 0.004, 0.006, 0.006, 0.008, 0.007, 0.006, 0.008, 0.009, 0.006, 0.004, 0.002, 0.001, 0.001, 0.001, 0.001, 0.001];
    for (let i = 0; i < level - 1; i++) { zoom -= (zoomReductions[i] || 0); if (zoom < minZoom) return minZoom; }
    return zoom;
  },
  update(targetX, targetY, dtMultiplier) {
    if (this.x === null) { this.x = targetX; this.y = targetY; }
    const dist = Math.hypot(targetX - this.x, targetY - this.y);
    if (dist > 200) { this.x = targetX; this.y = targetY; } 
    else { this.x += (targetX - this.x) * 0.15 * dtMultiplier; this.y += (targetY - this.y) * 0.15 * dtMultiplier; }
    if (Math.abs(this.currentZoom - this.targetZoom) > 0.001) this.currentZoom += (this.targetZoom - this.currentZoom) * CONFIG.ZOOM_SMOOTHING * dtMultiplier;
    else this.currentZoom = this.targetZoom;
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

export const Renderer = {
  leaderboardDiv: null, xpBar: null, xpFill: null, fillImage: null, levelCircle: null, minimap: null, minimapCtx: null, 
  
  // CHƯƠNG 18: OBJECT POOLING - KHỞI TẠO BỘ NHỚ CỐ ĐỊNH CHỐNG GIẬT LAG
  particles: Array.from({length: 1000}, () => ({active: false, x:0, y:0, vx:0, vy:0, life:0, decay:0, size:0, color:""})),
  trails: Array.from({length: 2000}, () => ({active: false, x:0, y:0, angle:0, level:1, radius:0, time:0})),
  xpEffects: Array.from({length: 50}, () => ({active: false, x:0, y:0, amount:0, start:0})),

  addKillXpEffect(x, y, amount) {
    for(let i=0; i<this.xpEffects.length; i++) {
      if(!this.xpEffects[i].active) {
        const e = this.xpEffects[i];
        e.x = x; e.y = y; e.amount = amount; e.start = Date.now(); e.active = true;
        break;
      }
    }
  },
  
  addDeathParticles(x, y, radius) {
    const numParticles = 15 + Math.random() * 15;
    let added = 0;
    for (let i = 0; i < this.particles.length && added < numParticles; i++) {
      const p = this.particles[i];
      if (!p.active) {
        const angle = Math.random() * Math.PI * 2, speed = Math.random() * 6 + 3;
        p.x = x; p.y = y; p.vx = Math.cos(angle) * speed; p.vy = Math.sin(angle) * speed;
        p.life = 1.0; p.decay = Math.random() * 0.03 + 0.015; p.size = Math.random() * (radius * 0.35) + 3;
        p.color = Math.random() > 0.5 ? "#ff3333" : "#ffcc00"; p.active = true;
        added++;
      }
    }
  },

  addTrail(x, y, angle, level, radius) {
    for (let i = 0; i < this.trails.length; i++) {
      const t = this.trails[i];
      if (!t.active) {
        t.x = x; t.y = y; t.angle = angle; t.level = level; t.radius = radius; t.time = Date.now(); t.active = true;
        break;
      }
    }
  },

  setupUI() {
    const isMob = window.innerWidth <= 768; 
    this.xpBar = document.createElement("div"); this.xpBar.style.cssText = `bottom:10px;left:50%;transform:translateX(-50%) ${isMob ? 'scale(0.7)' : 'scale(1)'};transform-origin:bottom center;width:300px;height:40px;background:url(img/xpbar.png) no-repeat center center;background-size:cover;z-index:1000;overflow:hidden;position:fixed;`; document.body.appendChild(this.xpBar);
    this.xpFill = document.createElement("div"); this.xpFill.style.cssText = `position:absolute;bottom:12px;left:76px;width:215px;height:16px;overflow:hidden;`; this.xpBar.appendChild(this.xpFill);
    this.fillImage = document.createElement("div"); this.fillImage.style.cssText = `position:relative;left:-215px;width:215px;height:100%;background:url(img/progressxp.png) no-repeat left center;background-size:contain;transition:left 0.1s linear;`; this.xpFill.appendChild(this.fillImage);
    this.levelCircle = document.createElement("div"); this.levelCircle.style.cssText = `position:fixed;bottom:${isMob ? '16px' : '22px'};left:calc(50% - ${isMob ? '100px' : '142px'});width:20px;height:20px;color:white;font-family:Arial;font-size:16px;font-weight:800;display:flex;align-items:center;justify-content:center;z-index:1001;pointer-events:none;`; this.levelCircle.textContent = GameState.clientLevel; document.body.appendChild(this.levelCircle);
    this.leaderboardDiv = document.getElementById("leaderboard") || document.createElement("div"); this.leaderboardDiv.id = "leaderboard"; this.leaderboardDiv.style.cssText = `position:fixed;top:${isMob ? '5px' : '20px'};left:${isMob ? '5px' : '20px'};background:rgba(30,30,30,0.85);color:#f0f0f0;font-family:sans-serif;font-size:${isMob ? '10px' : '14px'};line-height:1.4;border-radius:8px;padding:${isMob ? '6px 10px' : '14px 20px'};z-index:1002;min-width:${isMob ? '110px' : '180px'};box-shadow:0 4px 12px rgba(0,0,0,0.6);pointer-events:none;`; document.body.appendChild(this.leaderboardDiv);
    this.minimap = document.createElement("canvas"); this.minimap.width = isMob ? 100 : 180; this.minimap.height = isMob ? 66 : 120; this.minimap.style.cssText = `position:fixed;top:5px;right:${isMob ? '5px' : '20px'};background:rgba(20,20,20,0.92);border-radius:8px;z-index:1002;width:${isMob ? '100px' : '200px'} !important;height:${isMob ? '66px' : '100px'} !important;pointer-events:none;`; document.body.appendChild(this.minimap); this.minimapCtx = this.minimap.getContext("2d");
  },
  resizeCanvas() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; },
  renderBackground() {
    if (!Resources.offscreenCanvas || Resources.offscreenCanvas.width !== CONFIG.MAP_WIDTH || Resources.offscreenCanvas.height !== CONFIG.MAP_HEIGHT) {
      Resources.offscreenCanvas = document.createElement("canvas"); Resources.offscreenCanvas.width = CONFIG.MAP_WIDTH; Resources.offscreenCanvas.height = CONFIG.MAP_HEIGHT; Resources.offscreenCtx = Resources.offscreenCanvas.getContext("2d");
    }
    if (Resources.mapPatternReady && Resources.mapBgImg.complete && Resources.mapBgImg.naturalHeight !== 0) {
      Resources.offscreenCtx.save(); Resources.offscreenCtx.imageSmoothingEnabled = false; Resources.offscreenCtx.fillStyle = Resources.mapPattern; Resources.offscreenCtx.fillRect(0, 0, CONFIG.MAP_WIDTH, CONFIG.MAP_HEIGHT); Resources.offscreenCtx.restore();
    } else { Resources.offscreenCtx.fillStyle = "#000"; Resources.offscreenCtx.fillRect(0, 0, CONFIG.MAP_WIDTH, CONFIG.MAP_HEIGHT); }
  },
  updateUI() {
    this.xpBar.style.display = GameState.isDead ? "none" : "block";
    this.levelCircle.style.display = GameState.isDead ? "none" : "flex";
    if (GameState.isDead) return;

    const percent = Math.min(1, GameState.clientXp / GameState.clientXpToNext);
    this.fillImage.style.left = -215 + percent * 215 + "px"; this.levelCircle.textContent = GameState.clientLevel;
    this.minimapCtx.clearRect(0, 0, this.minimap.width, this.minimap.height); this.minimapCtx.strokeStyle = "#aaa"; this.minimapCtx.lineWidth = 2; this.minimapCtx.strokeRect(4, 4, this.minimap.width - 8, this.minimap.height - 8);
    const allPlayersArr = GameState.stateBuffer[GameState.stateBuffer.length - 1]?.players || [];
    let top1 = null;
    if (allPlayersArr.length > 0) { top1 = allPlayersArr.slice().sort((a, b) => { if (b.level !== a.level) return b.level - a.level; return (b.score || 0) - (a.score || 0); })[0]; }
    if (top1) { const px = 4 + (top1.x / CONFIG.MAP_WIDTH) * (this.minimap.width - 8); const py = 4 + (top1.y / CONFIG.MAP_HEIGHT) * (this.minimap.height - 8); this.minimapCtx.beginPath(); this.minimapCtx.arc(px, py, 4, 0, Math.PI * 2); this.minimapCtx.fillStyle = "#ff3333"; this.minimapCtx.fill(); }
    const me = allPlayersArr.find((p) => p.id === GameState.playerId);
    if (me && !me.isDead) {
      const px = 4 + (me.x / CONFIG.MAP_WIDTH) * (this.minimap.width - 8); const py = 4 + (me.y / CONFIG.MAP_HEIGHT) * (this.minimap.height - 8); this.minimapCtx.beginPath(); this.minimapCtx.arc(px, py, 4, 0, Math.PI * 2); this.minimapCtx.fillStyle = "#00ff66"; this.minimapCtx.strokeStyle = "#fff"; this.minimapCtx.lineWidth = 1; this.minimapCtx.fill(); this.minimapCtx.stroke();
    }
  },
  updateLeaderboard(playersArr) {
    if (!playersArr || playersArr.length === 0) return;
    const sorted = [...playersArr].sort((a, b) => { if (b.level !== a.level) return b.level - a.level; return (b.score || 0) - (a.score || 0); });
    const isMob = window.innerWidth <= 768; const titleSize = isMob ? '12px' : '16px';
    let html = `<div style="font-weight:bold;font-size:${titleSize};color:#00ffff;margin-bottom:4px;">★ TOP PLAYERS ★</div>`;
    sorted.slice(0, 8).forEach((p, i) => { html += `<div style="margin:2px 0;"><span style="color:#aaa;">${i + 1}. </span><span style="color:${p.id === GameState.playerId ? "#ff0" : "#fff"};font-weight:bold;">${p.name || "???"}</span><span style="color:#0ff;margin-left:4px;">Lv${p.level}</span></div>`; });
    this.leaderboardDiv.innerHTML = html;
  },
  getScaledImageSize(img, targetSize) {
    if (!img.complete || img.naturalWidth === 0 || img.naturalHeight === 0) return { width: targetSize, height: targetSize };
    const aspectRatio = img.naturalWidth / img.naturalHeight; return aspectRatio > 1 ? { width: targetSize, height: targetSize / aspectRatio } : { width: targetSize * aspectRatio, height: targetSize };
  },
  drawImageWithAspectRatio(img, x, y, targetSize, angle = 0) {
    const { width, height } = this.getScaledImageSize(img, targetSize);
    if (angle !== 0) { ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.drawImage(img, -width / 2, -height / 2, width, height); ctx.restore(); } 
    else { ctx.drawImage(img, x - width / 2, y - height / 2, width, height); }
  },
  lerp(a, b, t) { return a + (b - a) * t; },
  lerpObj(a, b, t) { return { ...b, x: this.lerp(a.x, b.x, t), y: this.lerp(a.y, b.y, t) }; },
  lerpAngle(a, b, t) { let diff = b - a; while (diff > Math.PI) diff -= 2 * Math.PI; while (diff < -Math.PI) diff += 2 * Math.PI; return a + diff * t; },
  getMoveAngle(id, curr, prev) { if (!prev) return 0; const dx = curr.x - prev.x, dy = curr.y - prev.y; if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return GameState.prevAngles[id] ?? 0; return Math.atan2(dy, dx); },
  getInterpolatedState() {
    const renderTime = Date.now() - CONFIG.CLIENT_BUFFER_DELAY;
    let older, newer;
    for (let i = GameState.stateBuffer.length - 1; i >= 0; i--) {
      if (GameState.stateBuffer[i].time <= renderTime) { older = GameState.stateBuffer[i]; newer = GameState.stateBuffer[i + 1] || GameState.stateBuffer[i]; break; }
    }
    if (!older) older = newer = GameState.stateBuffer[0] || { players: [] };
    let t = 0; if (older !== newer && newer.time !== older.time) t = Math.max(0, Math.min(1, (renderTime - older.time) / (newer.time - older.time)));
    
    const interpPlayers = {};
    for (const p of newer.players) {
      if (p.id === GameState.playerId) continue;
      const prev = older.players.find((o) => o.id === p.id) || p;
      let interp = this.lerpObj(prev, p, t);
      if (t >= 1 && newer !== older) {
        const dt = newer.time - older.time;
        if (dt > 0) { const vx = (p.x - prev.x) / dt, vy = (p.y - prev.y) / dt; const extrapTime = Date.now() - newer.time; interp.x = p.x + vx * extrapTime; interp.y = p.y + vy * extrapTime; }
      }
      interpPlayers[p.id] = interp;
    }
    return { interpPlayers }; 
  },
  drawWeapons(x, y, radius, level, angle, isAttacking = false, attackTime = 0) {
    const weaponImg = Resources.getWeaponImage(level || 1);
    if (weaponImg && weaponImg.complete && weaponImg.naturalHeight !== 0) {
      const weaponSize = radius * (2.75 + 0.04 * (level - 1)), weaponHeadOffset = weaponSize * 0.4;
      let swing = 0;
      if (isAttacking && attackTime > 0) {
        const t = Math.min(1, (Date.now() - attackTime) / (CONFIG.BASE_ATTACK_DURATION + (level * CONFIG.ATTACK_DURATION_PER_LEVEL)));
        swing = Math.sin(t * Math.PI) * (level < 37 ? CONFIG.ATTACK_SWING_ANGLE : CONFIG.ATTACK_SWING_ANGLE * 0.68);
      }
      let leftWeaponAngle = angle - Math.PI * 0.7 + swing;
      this.drawImageWithAspectRatio(weaponImg, x + Math.cos(leftWeaponAngle) * radius + Math.cos(leftWeaponAngle) * weaponHeadOffset, y + Math.sin(leftWeaponAngle) * radius + Math.sin(leftWeaponAngle) * weaponHeadOffset, weaponSize * (level >= 37 ? 1.1 : 1), leftWeaponAngle - Math.PI / 7.5);
      if (level >= 37) {
        let rightWeaponAngle = angle + Math.PI * 0.7 - swing;
        const drawX = x + Math.cos(rightWeaponAngle) * radius + Math.cos(rightWeaponAngle) * weaponHeadOffset, drawY = y + Math.sin(rightWeaponAngle) * radius + Math.sin(rightWeaponAngle) * weaponHeadOffset;
        const aspect = weaponImg.naturalWidth / weaponImg.naturalHeight;
        ctx.save(); ctx.translate(drawX, drawY); ctx.rotate(rightWeaponAngle + Math.PI + Math.PI / 7.5); ctx.scale(-1, 1);
        ctx.drawImage(weaponImg, -weaponSize / 2, -(weaponSize / aspect) / 2, weaponSize, weaponSize / aspect); ctx.restore();
      }
    }
  },
  drawShield(x, y, radius, justRespawned) {
    const shieldTimeLeft = CONFIG.HIT_COOLDOWN - (Date.now() - justRespawned);
    if (shieldTimeLeft > 0) { ctx.save(); ctx.globalAlpha = 0.4 + Math.sin(Date.now() / 150) * 0.2; ctx.beginPath(); ctx.arc(x, y, radius + 15, 0, Math.PI * 2); ctx.fillStyle = "rgba(0, 255, 255, 0.3)"; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = "rgba(0, 255, 255, 0.8)"; ctx.stroke(); ctx.restore(); }
  },

  drawMobileUI() {
    if(GameState.isDead) return;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); const w = canvas.width, h = canvas.height;
    if (GameState.joystick.active) {
      ctx.globalAlpha = 0.3; ctx.beginPath(); ctx.arc(GameState.joystick.baseX, GameState.joystick.baseY, 50, 0, Math.PI * 2); ctx.fillStyle = "black"; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = "white"; ctx.stroke();
      ctx.globalAlpha = 0.6; ctx.beginPath(); ctx.arc(GameState.joystick.stickX, GameState.joystick.stickY, 25, 0, Math.PI * 2); ctx.fillStyle = "white"; ctx.fill();
    }
    const attackX = w - 75, attackY = h - 75, attackR = 40;
    ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.arc(attackX, attackY, attackR, 0, Math.PI * 2); ctx.fillStyle = "#ff3333"; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = "white"; ctx.stroke(); ctx.beginPath(); ctx.arc(attackX, attackY, attackR * 0.5, 0, Math.PI * 2); ctx.fillStyle = "rgba(255,255,255,0.4)"; ctx.fill();
    const sprintX = w - 160, sprintY = h - 75, sprintR = 30;
    ctx.globalAlpha = GameState.rightMouseDown ? 0.8 : 0.5; ctx.beginPath(); ctx.arc(sprintX, sprintY, sprintR, 0, Math.PI * 2); ctx.fillStyle = "#ffcc00"; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = "white"; ctx.stroke(); ctx.beginPath(); ctx.arc(sprintX, sprintY, sprintR * 0.5, 0, Math.PI * 2); ctx.fillStyle = "rgba(255,255,255,0.4)"; ctx.fill();
    ctx.restore();
  },

  draw(dtMultiplier = 1) {
    if (GameState.clientX === null || GameState.clientY === null) return;
    const now = Date.now();
    Camera.update(GameState.clientX, GameState.clientY, dtMultiplier);
    
    const centerX = canvas.width / 2, centerY = canvas.height / 2;
    const offsetX = centerX - Camera.x * Camera.currentZoom, offsetY = centerY - Camera.y * Camera.currentZoom;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = "#000"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save(); ctx.scale(Camera.currentZoom, Camera.currentZoom); ctx.translate(offsetX / Camera.currentZoom, offsetY / Camera.currentZoom);
    
    if (Resources.offscreenCanvas) { ctx.save(); ctx.beginPath(); ctx.rect(0, 0, CONFIG.MAP_WIDTH, CONFIG.MAP_HEIGHT); ctx.clip(); ctx.imageSmoothingEnabled = false; ctx.drawImage(Resources.offscreenCanvas, 0, 0); ctx.restore(); } 
    else { ctx.fillStyle = "#000"; ctx.fillRect(0, 0, CONFIG.MAP_WIDTH, CONFIG.MAP_HEIGHT); }
    ctx.strokeStyle = "#222"; ctx.lineWidth = 8 / Camera.currentZoom; ctx.strokeRect(0, 0, CONFIG.MAP_WIDTH, CONFIG.MAP_HEIGHT);
    
    const { interpPlayers } = this.getInterpolatedState();
    const margin = 100 / Camera.currentZoom;
    const viewportLeft = Camera.x - canvas.width / (2 * Camera.currentZoom) - margin, viewportRight = Camera.x + canvas.width / (2 * Camera.currentZoom) + margin;
    const viewportTop = Camera.y - canvas.height / (2 * Camera.currentZoom) - margin, viewportBottom = Camera.y + canvas.height / (2 * Camera.currentZoom) + margin;
    
    for (const f of GameState.food) {
      if (f.x >= viewportLeft && f.x <= viewportRight && f.y >= viewportTop && f.y <= viewportBottom) {
        const type = f.type ?? 0; const img = Resources.foodImages[type];
        if (img && img.complete && img.naturalHeight !== 0) { this.drawImageWithAspectRatio(img, f.x, f.y, f.radius * 2); } 
        else { ctx.beginPath(); ctx.arc(f.x, f.y, f.radius, 0, Math.PI * 2); ctx.fillStyle = "#ccc"; ctx.fill(); }
      }
    }

    // HIỂN THỊ TÀN ẢNH TỪ POOL
    for (let i = 0; i < this.trails.length; i++) {
      const t = this.trails[i];
      if (t.active) {
        if (now - t.time >= 200) { t.active = false; } 
        else {
          const img = Resources.getPlayerImage(t.level || 1);
          if (img && img.complete) { ctx.save(); ctx.globalAlpha = (1 - (now - t.time) / 200) * 0.35; this.drawImageWithAspectRatio(img, t.x, t.y, t.radius * 2, t.angle); ctx.restore(); }
        }
      }
    }
    
    // HIỂN THỊ MẢNH VỠ TỪ POOL
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i]; 
      if (p.active) {
        p.x += p.vx * dtMultiplier; p.y += p.vy * dtMultiplier; p.life -= p.decay * dtMultiplier;
        if (p.life <= 0) { p.active = false; } 
        else { ctx.save(); ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
      }
    }

    for (const id in interpPlayers) {
      const p = interpPlayers[id];
      if (p.isDead) continue;
      if (p.x >= viewportLeft && p.x <= viewportRight && p.y >= viewportTop && p.y <= viewportBottom) {
        const prev = GameState.prevPositions[id];
        let targetAngle = typeof p.angle === "number" ? p.angle : this.getMoveAngle(id, p, prev);
        let angle = this.lerpAngle(GameState.prevAngles[id] ?? targetAngle, targetAngle, CONFIG.ANGLE_LERP);
        GameState.prevAngles[id] = angle; GameState.prevPositions[id] = { x: p.x, y: p.y };

        if (p.rightMouseDown) {
          this.addTrail(p.x, p.y, angle, p.level, p.radius);
        }
        
        if (p.rightMouseDown && Resources.mountImg.complete) this.drawImageWithAspectRatio(Resources.mountImg, p.x, p.y, (p.radius + 22) * 2, angle);
        const img = Resources.getPlayerImage(p.level || 1);
        if (img && img.complete) this.drawImageWithAspectRatio(img, p.x, p.y, p.radius * 2, angle);
        
        this.drawWeapons(p.x, p.y, p.radius, p.level, p.angle, p.isAttacking, p.attackTime);
        if (p.justRespawned) this.drawShield(p.x, p.y, p.radius, p.justRespawned);
        
        if (p.name) {
          ctx.save(); ctx.font = `bold 18px Arial`; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillStyle = "#fff"; ctx.strokeStyle = "#222"; ctx.lineWidth = 4;
          ctx.strokeText(p.name, p.x, p.y + p.radius + 8); ctx.fillText(p.name, p.x, p.y + p.radius + 8); ctx.restore();
        }
      }
    }
    
    const latestState = GameState.stateBuffer[GameState.stateBuffer.length - 1];
    const me = (latestState?.players || []).find((p) => p.id === GameState.playerId);
    
    if (me && !me.isDead) {
      let targetAngle = GameState.isAttacking ? (GameState.prevAngles[GameState.playerId] ?? 0) : GameState.mouseAngle;
      let angle = this.lerpAngle(GameState.prevAngles[GameState.playerId] ?? targetAngle, targetAngle, CONFIG.ANGLE_LERP);
      GameState.prevAngles[GameState.playerId] = angle; GameState.prevPositions[GameState.playerId] = { x: GameState.clientX, y: GameState.clientY };
      
      if (me.rightMouseDown) {
        this.addTrail(GameState.clientX, GameState.clientY, angle, GameState.clientLevel, GameState.clientRadius);
      }

      if (me.rightMouseDown && Resources.mountImg.complete) this.drawImageWithAspectRatio(Resources.mountImg, GameState.clientX, GameState.clientY, (GameState.clientRadius + 22) * 2, angle);
      
      const mainImg = Resources.getPlayerImage(GameState.clientLevel || 1);
      if (mainImg && mainImg.complete) this.drawImageWithAspectRatio(mainImg, GameState.clientX, GameState.clientY, GameState.clientRadius * 2, angle);
      
      this.drawWeapons(GameState.clientX, GameState.clientY, GameState.clientRadius, GameState.clientLevel, angle, GameState.isAttacking, GameState.attackTime);
      if (me.justRespawned) this.drawShield(GameState.clientX, GameState.clientY, GameState.clientRadius, me.justRespawned);

      const cdElapsed = now - (GameState.lastAttackTime || 0), cooldown = 500 + (GameState.clientLevel - 1) * 60;
      if (cdElapsed < cooldown) {
        const barW = GameState.clientRadius * 2, barH = 7, barX = GameState.clientX - barW / 2, barY = GameState.clientY + GameState.clientRadius + 12;
        ctx.save(); ctx.beginPath(); ctx.strokeStyle = "#bfa600"; ctx.lineWidth = 2; ctx.rect(barX, barY, barW, barH); ctx.stroke();
        ctx.beginPath(); ctx.fillStyle = "#ffe066"; ctx.rect(barX, barY, barW * (1 - Math.max(0, Math.min(1, cdElapsed / cooldown))), barH); ctx.fill(); ctx.restore();
      }
      
      if (me.name) {
        ctx.save(); ctx.font = `bold 18px Arial`; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillStyle = "#00ff66"; ctx.strokeStyle = "#006633"; ctx.lineWidth = 4;
        ctx.strokeText(me.name, GameState.clientX, GameState.clientY + GameState.clientRadius + 8); ctx.fillText(me.name, GameState.clientX, GameState.clientY + GameState.clientRadius + 8); ctx.restore();
      }
    }
    
    ctx.restore();
    if (GameState.isTouch) this.drawMobileUI();

    const allPlayersArr = GameState.stateBuffer[GameState.stateBuffer.length - 1]?.players || [];
    this.updateLeaderboard(allPlayersArr);
    
    // HIỂN THỊ CHỮ XP TỪ POOL
    const nowKillXp = Date.now();
    for (let i = 0; i < this.xpEffects.length; i++) {
      const e = this.xpEffects[i];
      if (e.active) {
        if (nowKillXp - e.start >= 1000) { e.active = false; } 
        else {
          const t = (nowKillXp - e.start) / 1000;
          ctx.save(); ctx.globalAlpha = 1 - t; ctx.font = "bold 32px Arial"; ctx.fillStyle = "#00ff66"; ctx.strokeStyle = "#009944"; ctx.lineWidth = 3; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
          ctx.strokeText(`+${e.amount} XP`, canvas.width / 2, 100 - t * 40); ctx.fillText(`+${e.amount} XP`, canvas.width / 2, 100 - t * 40); ctx.restore();
        }
      }
    }
  }
};
