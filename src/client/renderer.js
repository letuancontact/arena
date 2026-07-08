// --- src/client/renderer.js ---
import { GameState } from './state.js';
const CONFIG = window.GAME_CONFIG;

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

let respawnModal = null;
let pendingHudXpEffects = [];
let pendingKillXpEffects = [];

export const Camera = {
  currentZoom: 1.0,
  targetZoom: 1.0,
  getZoomByLevel(level) {
    const baseZoom = 1.0, minZoom = 0.3;
    const zoomReductions = [
      0.008, 0.001, 0.002, 0.003, 0.004, 0.015, 0.01, 0.004, 0.002, 0.003,
      0.008, 0.002, 0.002, 0.003, 0.002, 0.006, 0.002, 0.002, 0.002, 0.002,
      0.008, 0.003, 0.008, 0.006, 0.004, 0.006, 0.006, 0.008, 0.007, 0.006,
      0.008, 0.009, 0.006, 0.004, 0.002, 0.001, 0.001, 0.001, 0.001, 0.001,
    ];
    let zoom = baseZoom;
    for (let i = 0; i < level - 1; i++) {
      zoom -= (zoomReductions[i] || 0);
      if (zoom < minZoom) { zoom = minZoom; break; }
    }
    return zoom;
  },
  updateZoom() {
    if (Math.abs(this.currentZoom - this.targetZoom) > 0.001) {
      this.currentZoom += (this.targetZoom - this.currentZoom) * CONFIG.ZOOM_SMOOTHING;
    } else {
      this.currentZoom = this.targetZoom;
    }
  },
};

export const Resources = {
  foodImages: {},
  playerImages: {},
  weaponImages: {},
  mountImg: new Image(),
  kingImg: new Image(),
  mapBgImg: new Image(),
  mapPattern: null,
  mapPatternReady: false,
  offscreenCanvas: null,
  offscreenCtx: null,
  load() {
    for (let i = 0; i < 12; i++) {
      const img = new Image();
      img.src = `img/food${i}.png`;
      this.foodImages[i] = img;
    }
    this.mountImg.src = "img/mountsright.png";
    this.kingImg.src = "img/king.png";
    this.mapBgImg.onload = () => {
      this.mapPattern = ctx.createPattern(this.mapBgImg, "repeat");
      this.mapPatternReady = true;
      Renderer.renderBackground();
    };
    this.mapBgImg.src = "img/mapbg.png";
  },
  getPlayerImage(level) {
    if (!this.playerImages[level]) {
      const img = new Image();
      img.src = `img/lv${level}.png`;
      this.playerImages[level] = img;
    }
    return this.playerImages[level];
  },
  getWeaponImage(level) {
    if (!this.weaponImages[level]) {
      const img = new Image();
      img.src = `img/weapon${level}.png`;
      this.weaponImages[level] = img;
    }
    return this.weaponImages[level];
  },
};

export const Renderer = {
  leaderboardDiv: null,
  xpBar: null,
  xpFill: null,
  fillImage: null,
  levelCircle: null,
  minimap: null,
  minimapCtx: null,
  
  particles: [],
  trails: {},
  
  addKillXpEffect(x, y, amount) {
    pendingKillXpEffects.push({ x, y, amount, start: Date.now() });
  },

  addDeathParticles(x, y, radius) {
    const numParticles = 15 + Math.random() * 15;
    for (let i = 0; i < numParticles; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 6 + 3;
      this.particles.push({
        x: x, y: y,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        life: 1.0, 
        decay: Math.random() * 0.03 + 0.015,
        size: Math.random() * (radius * 0.35) + 3,
        color: Math.random() > 0.5 ? "#ff3333" : "#ffcc00"
      });
    }
  },
  
  setupUI() {
    this.xpBar = document.createElement("div");
    this.xpBar.style.cssText = `bottom:10px;left:50%;transform:translateX(-50%);width:300px;height:40px;background:url(img/xpbar.png) no-repeat center center;background-size:cover;z-index:1000;overflow:hidden;position:fixed;`;
    document.body.appendChild(this.xpBar);
    this.xpFill = document.createElement("div");
    this.xpFill.style.cssText = `position:absolute;bottom:12px;left:76px;width:215px;height:16px;overflow:hidden;`;
    this.xpBar.appendChild(this.xpFill);
    this.fillImage = document.createElement("div");
    this.fillImage.style.cssText = `position:relative;left:-215px;width:215px;height:100%;background:url(img/progressxp.png) no-repeat left center;background-size:contain;transition:left 0.1s linear;`;
    this.xpFill.appendChild(this.fillImage);
    this.levelCircle = document.createElement("div");
    this.levelCircle.style.cssText = `position:fixed;bottom:22px;left:calc(50% - 142px);width:20px;height:20px;color:white;font-family:Arial;font-size:16px;font-weight:800;display:flex;align-items:center;justify-content:center;z-index:1001;pointer-events:none;`;
    this.levelCircle.textContent = GameState.clientLevel;
    document.body.appendChild(this.levelCircle);
    this.leaderboardDiv = document.getElementById("leaderboard") || document.createElement("div");
    this.leaderboardDiv.id = "leaderboard";
    this.leaderboardDiv.style.cssText = `position:fixed;top:20px;left:20px;background:rgba(30,30,30,0.85);color:#f0f0f0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;font-size:14px;line-height:1.6;border-radius:10px;padding:14px 20px;z-index:1002;min-width:180px;box-shadow:0 4px 12px rgba(0,0,0,0.6);pointer-events:none;backdrop-filter:blur(4px);border:1px solid rgba(255,255,255,0.08);`;
    document.body.appendChild(this.leaderboardDiv);
    this.minimap = document.createElement("canvas");
    this.minimap.width = 180;
    this.minimap.height = 120;
    this.minimap.style.cssText = `position:fixed;top:5px;right:20px;background:rgba(20,20,20,0.92);border-radius:10px;z-index:1002;width:200px !important;height:100px !important;pointer-events:none;margin-top:10px;`;
    document.body.appendChild(this.minimap);
    this.minimapCtx = this.minimap.getContext("2d");
  },
  resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  },
  renderBackground() {
    if (!Resources.offscreenCanvas || Resources.offscreenCanvas.width !== CONFIG.MAP_WIDTH || Resources.offscreenCanvas.height !== CONFIG.MAP_HEIGHT) {
      Resources.offscreenCanvas = document.createElement("canvas");
      Resources.offscreenCanvas.width = CONFIG.MAP_WIDTH;
      Resources.offscreenCanvas.height = CONFIG.MAP_HEIGHT;
      Resources.offscreenCtx = Resources.offscreenCanvas.getContext("2d");
    }
    if (Resources.mapPatternReady && Resources.mapBgImg.complete && Resources.mapBgImg.naturalHeight !== 0) {
      Resources.offscreenCtx.save();
      Resources.offscreenCtx.imageSmoothingEnabled = false;
      Resources.offscreenCtx.fillStyle = Resources.mapPattern;
      Resources.offscreenCtx.fillRect(0, 0, CONFIG.MAP_WIDTH, CONFIG.MAP_HEIGHT);
      Resources.offscreenCtx.restore();
    } else {
      Resources.offscreenCtx.fillStyle = "#000";
      Resources.offscreenCtx.fillRect(0, 0, CONFIG.MAP_WIDTH, CONFIG.MAP_HEIGHT);
    }
  },
  updateUI() {
    const percent = Math.min(1, GameState.clientXp / GameState.clientXpToNext);
    const maxShift = 215;
    this.fillImage.style.left = -maxShift + percent * maxShift + "px";
    this.levelCircle.textContent = GameState.clientLevel;
    
    this.minimapCtx.clearRect(0, 0, this.minimap.width, this.minimap.height);
    this.minimapCtx.strokeStyle = "#aaa";
    this.minimapCtx.lineWidth = 2;
    this.minimapCtx.strokeRect(8, 8, this.minimap.width - 16, this.minimap.height - 16);
    
    const allPlayersArr = GameState.stateBuffer[GameState.stateBuffer.length - 1]?.players || [];
    let top1 = null;
    if (allPlayersArr.length > 0) {
      top1 = allPlayersArr.slice().sort((a, b) => {
        if (b.level !== a.level) return b.level - a.level;
        return (b.score || 0) - (a.score || 0);
      });
      top1 = top1[0];
    }
    if (top1) {
      const px = 8 + (top1.x / CONFIG.MAP_WIDTH) * (this.minimap.width - 16);
      const py = 8 + (top1.y / CONFIG.MAP_HEIGHT) * (this.minimap.height - 16);
      this.minimapCtx.beginPath();
      this.minimapCtx.arc(px, py, 5, 0, Math.PI * 2);
      this.minimapCtx.fillStyle = "#ff3333";
      this.minimapCtx.fill();
    }
    const me = allPlayersArr.find((p) => p.id === GameState.playerId);
    if (me && !me.isDead) {
      const px = 8 + (me.x / CONFIG.MAP_WIDTH) * (this.minimap.width - 16);
      const py = 8 + (me.y / CONFIG.MAP_HEIGHT) * (this.minimap.height - 16);
      this.minimapCtx.beginPath();
      this.minimapCtx.arc(px, py, 5, 0, Math.PI * 2);
      this.minimapCtx.fillStyle = "#00ff66";
      this.minimapCtx.strokeStyle = "#fff";
      this.minimapCtx.lineWidth = 2;
      this.minimapCtx.fill();
      this.minimapCtx.stroke();
    }
  },
  updateLeaderboard(playersArr) {
    if (!playersArr || playersArr.length === 0) {
      this.leaderboardDiv.innerHTML = "<b>TOP PLAYERS</b><br/><i>No players</i>";
      return;
    }
    const sorted = [...playersArr].sort((a, b) => {
      if (b.level !== a.level) return b.level - a.level;
      return (b.score || 0) - (a.score || 0);
    });
    let html = `<div style="font-weight:bold;font-size:16px;color:#00ffff;margin-bottom:6px;">★ TOP PLAYERS ★</div>`;
    sorted.slice(0, 8).forEach((p, i) => {
      html += `<div style="margin:2px 0;"><span style="color:#aaa;">${i + 1}.</span><span style="color:${p.id === GameState.playerId ? "#ff0" : "#fff"};font-weight:bold;">${p.name || "???"}</span><span style="color:#0ff;">Lv${p.level}</span><span style="float:right;color:#f88;"><b>${p.score || 0}</b></span></div>`;
    });
    this.leaderboardDiv.innerHTML = html;
  },
  getScaledImageSize(img, targetSize) {
    if (!img.complete || img.naturalWidth === 0 || img.naturalHeight === 0) return { width: targetSize, height: targetSize };
    const aspectRatio = img.naturalWidth / img.naturalHeight;
    let width, height;
    if (aspectRatio > 1) {
      width = targetSize;
      height = targetSize / aspectRatio;
    } else {
      width = targetSize * aspectRatio;
      height = targetSize;
    }
    return { width, height };
  },
  drawImageWithAspectRatio(img, x, y, targetSize, angle = 0) {
    const { width, height } = this.getScaledImageSize(img, targetSize);
    if (angle !== 0) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.drawImage(img, -width / 2, -height / 2, width, height);
      ctx.restore();
    } else {
      ctx.drawImage(img, x - width / 2, y - height / 2, width, height);
    }
  },
  lerp(a, b, t) { return a + (b - a) * t; },
  lerpObj(a, b, t) { return { ...b, x: this.lerp(a.x, b.x, t), y: this.lerp(a.y, b.y, t) }; },
  lerpAngle(a, b, t) {
    let diff = b - a;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    return a + diff * t;
  },
  getMoveAngle(id, curr, prev) {
    if (!prev) return 0;
    const dx = curr.x - prev.x, dy = curr.y - prev.y;
    if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return GameState.prevAngles[id] ?? 0;
    return Math.atan2(dy, dx);
  },
  getInterpolatedState() {
    const renderTime = Date.now() - CONFIG.CLIENT_BUFFER_DELAY;
    let older, newer;
    for (let i = GameState.stateBuffer.length - 1; i >= 0; i--) {
      if (GameState.stateBuffer[i].time <= renderTime) {
        older = GameState.stateBuffer[i];
        newer = GameState.stateBuffer[i + 1] || GameState.stateBuffer[i];
        break;
      }
    }
    if (!older) older = newer = GameState.stateBuffer[0] || { food: [], players: [] };
    let t = 0;
    if (older !== newer && newer.time !== older.time) {
      t = Math.max(0, Math.min(1, (renderTime - older.time) / (newer.time - older.time)));
    }
    const interpFood = newer.food.map((f) => {
      const prev = older.food.find((o) => o.id === f.id) || f;
      return this.lerpObj(prev, f, t);
    });
    const interpPlayers = {};
    for (const p of newer.players) {
      if (p.id === GameState.playerId) continue;
      const prev = older.players.find((o) => o.id === p.id) || p;
      let interp = this.lerpObj(prev, p, t);
      if (t >= 1 && newer !== older) {
        const dt = newer.time - older.time;
        if (dt > 0) {
          const vx = (p.x - prev.x) / dt, vy = (p.y - prev.y) / dt;
          const extrapTime = Date.now() - newer.time;
          interp.x = p.x + vx * extrapTime;
          interp.y = p.y + vy * extrapTime;
        }
      }
      interpPlayers[p.id] = interp;
    }
    return { interpFood, interpPlayers };
  },
  drawWeapons(x, y, radius, level, angle, isAttacking = false, attackTime = 0) {
    const weaponImg = Resources.getWeaponImage(level || 1);
    if (weaponImg && weaponImg.complete && weaponImg.naturalHeight !== 0) {
      const baseRatio = 2.75, growPerLevel = 0.04;
      const weaponSize = radius * (baseRatio + growPerLevel * (level - 1));
      const weaponHeadOffset = weaponSize * 0.4;

      let swing = 0;
      if (isAttacking && attackTime > 0) {
        const ATTACK_DURATION = CONFIG.BASE_ATTACK_DURATION + (level * CONFIG.ATTACK_DURATION_PER_LEVEL);
        const t = Math.min(1, (Date.now() - attackTime) / ATTACK_DURATION);
        swing = Math.sin(t * Math.PI) * (level < 37 ? CONFIG.ATTACK_SWING_ANGLE : CONFIG.ATTACK_SWING_ANGLE * 0.68);
      }

      let leftWeaponAngle = angle - Math.PI * 0.7 + swing;
      const leftStartX = x + Math.cos(leftWeaponAngle) * radius;
      const leftStartY = y + Math.sin(leftWeaponAngle) * radius;
      const leftDx = Math.cos(leftWeaponAngle) * weaponHeadOffset;
      const leftDy = Math.sin(leftWeaponAngle) * weaponHeadOffset;

      this.drawImageWithAspectRatio(weaponImg, leftStartX + leftDx, leftStartY + leftDy, weaponSize * (level >= 37 ? 1.1 : 1), leftWeaponAngle - Math.PI / 7.5);

      if (level >= 37) {
        let rightWeaponAngle = angle + Math.PI * 0.7 - swing;
        const rightStartX = x + Math.cos(rightWeaponAngle) * radius;
        const rightStartY = y + Math.sin(rightWeaponAngle) * radius;
        const drawX = rightStartX + Math.cos(rightWeaponAngle) * weaponHeadOffset;
        const drawY = rightStartY + Math.sin(rightWeaponAngle) * weaponHeadOffset;
        const aspect = weaponImg.naturalWidth / weaponImg.naturalHeight;
        const drawWidth = weaponSize, drawHeight = weaponSize / aspect;

        ctx.save();
        ctx.translate(drawX, drawY);
        ctx.rotate(rightWeaponAngle + Math.PI + Math.PI / 7.5);
        ctx.scale(-1, 1);
        ctx.drawImage(weaponImg, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
        ctx.restore();
      }
    }
  },
  
  // Hàm vẽ Vòng khiên bảo vệ (Spawn Protection)
  drawShield(x, y, radius, justRespawned) {
    const shieldTimeLeft = CONFIG.HIT_COOLDOWN - (Date.now() - justRespawned);
    if (shieldTimeLeft > 0) {
      ctx.save();
      // Hiệu ứng nhấp nháy mờ dần
      ctx.globalAlpha = 0.4 + Math.sin(Date.now() / 150) * 0.2; 
      ctx.beginPath();
      ctx.arc(x, y, radius + 15, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0, 255, 255, 0.3)";
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(0, 255, 255, 0.8)";
      ctx.stroke();
      ctx.restore();
    }
  },

  draw() {
    if (GameState.clientX === null || GameState.clientY === null) return;
    
    const now = Date.now();
    Camera.updateZoom();
    
    const centerX = canvas.width / 2, centerY = canvas.height / 2;
    const offsetX = centerX - GameState.clientX * Camera.currentZoom;
    const offsetY = centerY - GameState.clientY * Camera.currentZoom;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(Camera.currentZoom, Camera.currentZoom);
    ctx.translate(offsetX / Camera.currentZoom, offsetY / Camera.currentZoom);
    
    if (Resources.offscreenCanvas) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, CONFIG.MAP_WIDTH, CONFIG.MAP_HEIGHT);
      ctx.clip();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(Resources.offscreenCanvas, 0, 0);
      ctx.restore();
    } else {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, CONFIG.MAP_WIDTH, CONFIG.MAP_HEIGHT);
    }
    
    ctx.strokeStyle = "#222";
    ctx.lineWidth = 8 / Camera.currentZoom;
    ctx.strokeRect(0, 0, CONFIG.MAP_WIDTH, CONFIG.MAP_HEIGHT);
    
    const { interpFood, interpPlayers } = this.getInterpolatedState();
    const margin = 100 / Camera.currentZoom;
    const viewportLeft = GameState.clientX - canvas.width / (2 * Camera.currentZoom) - margin;
    const viewportRight = GameState.clientX + canvas.width / (2 * Camera.currentZoom) + margin;
    const viewportTop = GameState.clientY - canvas.height / (2 * Camera.currentZoom) - margin;
    const viewportBottom = GameState.clientY + canvas.height / (2 * Camera.currentZoom) + margin;
    
    // --- Vẽ Food ---
    for (const f of interpFood) {
      if (f.x >= viewportLeft && f.x <= viewportRight && f.y >= viewportTop && f.y <= viewportBottom) {
        const type = f.type ?? 0;
        const img = Resources.foodImages[type];
        if (img && img.complete && img.naturalHeight !== 0) {
          this.drawImageWithAspectRatio(img, f.x, f.y, f.radius * 2);
        } else {
          ctx.beginPath(); ctx.arc(f.x, f.y, f.radius, 0, Math.PI * 2); ctx.fillStyle = "#ccc"; ctx.fill();
        }
      }
    }

    // --- Vẽ Sprint Trails ---
    for (const id in this.trails) {
      this.trails[id] = this.trails[id].filter(t => now - t.time < 200);
      if (this.trails[id].length === 0) { delete this.trails[id]; continue; }
      for (const t of this.trails[id]) {
        const img = Resources.getPlayerImage(t.level || 1);
        if (img && img.complete) {
          ctx.save();
          ctx.globalAlpha = (1 - (now - t.time) / 200) * 0.35; 
          this.drawImageWithAspectRatio(img, t.x, t.y, t.radius * 2, t.angle);
          ctx.restore();
        }
      }
    }
    
    // --- Vẽ Particles ---
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx; p.y += p.vy; p.life -= p.decay;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      } else {
        ctx.save();
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    }

    // --- Vẽ Kẻ Địch/Bot ---
    for (const id in interpPlayers) {
      const p = interpPlayers[id];
      if (p.isDead) continue;
      if (p.x >= viewportLeft && p.x <= viewportRight && p.y >= viewportTop && p.y <= viewportBottom) {
        const prev = GameState.prevPositions[id];
        let targetAngle = typeof p.angle === "number" ? p.angle : this.getMoveAngle(id, p, prev);
        let angle = this.lerpAngle(GameState.prevAngles[id] ?? targetAngle, targetAngle, CONFIG.ANGLE_LERP);
        GameState.prevAngles[id] = angle;
        GameState.prevPositions[id] = { x: p.x, y: p.y };

        if (p.rightMouseDown) {
          if (!this.trails[p.id]) this.trails[p.id] = [];
          this.trails[p.id].push({ x: p.x, y: p.y, angle, level: p.level, radius: p.radius, time: now });
        }
        
        if (p.rightMouseDown && Resources.mountImg.complete) {
          this.drawImageWithAspectRatio(Resources.mountImg, p.x, p.y, (p.radius + 22) * 2, angle);
        }
        
        const img = Resources.getPlayerImage(p.level || 1);
        if (img && img.complete) this.drawImageWithAspectRatio(img, p.x, p.y, p.radius * 2, angle);
        
        this.drawWeapons(p.x, p.y, p.radius, p.level, p.angle, p.isAttacking, p.attackTime);
        
        // Vẽ khiên bảo vệ nếu có
        if (p.justRespawned) this.drawShield(p.x, p.y, p.radius, p.justRespawned);
        
        if (p.name) {
          ctx.save();
          ctx.font = `bold 18px Arial`; ctx.textAlign = "center"; ctx.textBaseline = "top";
          ctx.fillStyle = "#fff"; ctx.strokeStyle = "#222"; ctx.lineWidth = 4;
          ctx.strokeText(p.name, p.x, p.y + p.radius + 8);
          ctx.fillText(p.name, p.x, p.y + p.radius + 8);
          ctx.restore();
        }
      }
    }
    
    // --- Vẽ Main Player ---
    const latestState = GameState.stateBuffer[GameState.stateBuffer.length - 1];
    const me = (latestState?.players || []).find((p) => p.id === GameState.playerId);
    
    if (me && me.isDead) {
      if (!respawnModal) {
        respawnModal = document.createElement("div");
        respawnModal.style = "position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.7);color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:9999;font-size:2.5rem;";
        document.body.appendChild(respawnModal);
      }
      const left = Math.max(0, (CONFIG.RESPAWN_TIME / 1000) - Math.floor((now - me.deadTime) / 1000));
      respawnModal.innerHTML = `<div>Bạn đã bị hạ!</div><div>Hồi sinh sau: <b>${left}</b> giây</div>`;
    } else {
      if (respawnModal) { respawnModal.remove(); respawnModal = null; }
      
      let targetAngle = GameState.isAttacking ? (GameState.prevAngles[GameState.playerId] ?? 0) : GameState.mouseAngle;
      let angle = this.lerpAngle(GameState.prevAngles[GameState.playerId] ?? targetAngle, targetAngle, CONFIG.ANGLE_LERP);
      GameState.prevAngles[GameState.playerId] = angle;
      GameState.prevPositions[GameState.playerId] = { x: GameState.clientX, y: GameState.clientY };
      
      if (me && me.rightMouseDown) {
        if (!this.trails[GameState.playerId]) this.trails[GameState.playerId] = [];
        this.trails[GameState.playerId].push({ x: GameState.clientX, y: GameState.clientY, angle, level: GameState.clientLevel, radius: GameState.clientRadius, time: now });
      }

      if (me && me.rightMouseDown && Resources.mountImg.complete) {
        this.drawImageWithAspectRatio(Resources.mountImg, GameState.clientX, GameState.clientY, (GameState.clientRadius + 22) * 2, angle);
      }
      
      const mainImg = Resources.getPlayerImage(GameState.clientLevel || 1);
      if (mainImg && mainImg.complete) {
        this.drawImageWithAspectRatio(mainImg, GameState.clientX, GameState.clientY, GameState.clientRadius * 2, angle);
      }
      
      this.drawWeapons(GameState.clientX, GameState.clientY, GameState.clientRadius, GameState.clientLevel, angle, GameState.isAttacking, GameState.attackTime);
      
      // Vẽ khiên bảo vệ cho người chơi chính (Dùng me.justRespawned từ server)
      if (me && me.justRespawned) {
        this.drawShield(GameState.clientX, GameState.clientY, GameState.clientRadius, me.justRespawned);
      }

      // Cooldown bar
      const cdElapsed = now - (GameState.lastAttackTime || 0);
      const cooldown = 500 + (GameState.clientLevel - 1) * 60;
      if (cdElapsed < cooldown) {
        const barW = GameState.clientRadius * 2, barH = 7;
        const barX = GameState.clientX - barW / 2, barY = GameState.clientY + GameState.clientRadius + 12;
        ctx.save();
        ctx.beginPath(); ctx.strokeStyle = "#bfa600"; ctx.lineWidth = 2; ctx.rect(barX, barY, barW, barH); ctx.stroke();
        ctx.beginPath(); ctx.fillStyle = "#ffe066";
        const percent = 1 - Math.max(0, Math.min(1, cdElapsed / cooldown));
        ctx.rect(barX, barY, barW * percent, barH); ctx.fill();
        ctx.restore();
      }
      
      if (me && me.name) {
        ctx.save();
        ctx.font = `bold 18px Arial`; ctx.textAlign = "center"; ctx.textBaseline = "top";
        ctx.fillStyle = "#00ff66"; ctx.strokeStyle = "#006633"; ctx.lineWidth = 4;
        ctx.strokeText(me.name, GameState.clientX, GameState.clientY + GameState.clientRadius + 8);
        ctx.fillText(me.name, GameState.clientX, GameState.clientY + GameState.clientRadius + 8);
        ctx.restore();
      }
    }
    
    ctx.restore();
    
    const allPlayersArr = GameState.stateBuffer[GameState.stateBuffer.length - 1]?.players || [];
    this.updateLeaderboard(allPlayersArr);
    
    const nowKillXp = Date.now();
    pendingKillXpEffects = pendingKillXpEffects.filter(e => nowKillXp - e.start < 1000);
    for (const e of pendingKillXpEffects) {
      const t = (nowKillXp - e.start) / 1000;
      ctx.save();
      ctx.globalAlpha = 1 - t; ctx.font = "bold 32px Arial"; ctx.fillStyle = "#00ff66"; ctx.strokeStyle = "#009944";
      ctx.lineWidth = 3; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
      ctx.strokeText(`+${e.amount} XP`, canvas.width / 2, 100 - t * 40);
      ctx.fillText(`+${e.amount} XP`, canvas.width / 2, 100 - t * 40);
      ctx.restore();
    }
  }
};
