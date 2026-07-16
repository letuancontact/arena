// --- src/client/main.js ---
import { GameState } from './state.js';
import { Camera, FX, Resources, Renderer } from './renderer.js';

const CONFIG = window.GAME_CONFIG;
const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
const wsUrl = `${protocol}//${window.location.host}`;
const canvas = document.getElementById("game");

GameState.freezeUntil = 0;

// =========================================================================
// 1. TỰ ĐỘNG TIÊM CSS LỘT XÁC GIAO DIỆN CHỜ (KHÔNG CẦN SỬA HTML)
// =========================================================================
const uiStyle = document.createElement('style');
uiStyle.innerHTML = `
  #ui-layer {
    background: radial-gradient(circle at center, rgba(15,25,35,0.85) 0%, rgba(5,10,15,0.95) 100%) !important;
    backdrop-filter: blur(8px);
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    font-family: 'Segoe UI', Roboto, Helvetica, sans-serif;
    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 2000;
  }
  #ui-layer h1, #ui-layer h2 { color: #fff; text-shadow: 0 0 20px #00ffff; font-size: 40px; margin-bottom: 30px; text-transform: uppercase; text-align: center; }
  #name-input {
    background: rgba(255, 255, 255, 0.05) !important; border: 2px solid rgba(0, 255, 255, 0.3) !important;
    color: #fff !important; padding: 16px 30px !important; border-radius: 40px !important; font-size: 20px !important;
    text-align: center; outline: none; transition: all 0.3s ease !important;
    box-shadow: 0 0 20px rgba(0, 255, 255, 0.1) !important; width: 280px; max-width: 80vw;
    margin-bottom: 25px; font-weight: bold; letter-spacing: 1px;
  }
  #name-input:focus { border-color: #00ffff !important; box-shadow: 0 0 30px rgba(0, 255, 255, 0.5) !important; background: rgba(255,255,255,0.1) !important; }
  #name-input::placeholder { color: rgba(255,255,255,0.4); font-weight: normal; }
  #play-btn {
    background: linear-gradient(135deg, #00ff66, #00cc55) !important; border: none !important;
    color: #003311 !important; font-weight: 900 !important; font-size: 22px !important; padding: 16px 50px !important;
    border-radius: 40px !important; cursor: pointer; transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) !important;
    text-transform: uppercase; box-shadow: 0 10px 25px rgba(0, 255, 102, 0.3) !important; letter-spacing: 2px;
  }
  #play-btn:hover:not(:disabled) { transform: translateY(-5px) scale(1.05) !important; box-shadow: 0 15px 35px rgba(0, 255, 102, 0.6) !important; }
  #play-btn:active:not(:disabled) { transform: translateY(2px) scale(0.98) !important; }
  #play-btn:disabled { background: #445566 !important; color: #8899aa !important; box-shadow: none !important; cursor: not-allowed; transform: scale(1) !important; }
  #status-text { color: #ff4444 !important; font-size: 20px !important; font-weight: bold !important; text-shadow: 0 0 15px rgba(255,68,68,0.6) !important; margin-top: 25px; letter-spacing: 1px;}
`;
document.head.appendChild(uiStyle);

// =========================================================================
// 2. HỆ THỐNG SOUND MANAGER TỐI ƯU (TIẾNG LÊN CẤP ÊM ÁI)
// =========================================================================
const Sound = {
  ctx: null, lastPlay: {}, noiseBuffer: null,
  isMuted: localStorage.getItem("evowar_muted") === "true", 
  
  init() {
    if (!this.ctx) { 
      window.AudioContext = window.AudioContext || window.webkitAudioContext; 
      this.ctx = new AudioContext(); 
      this.noiseBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.5, this.ctx.sampleRate);
      const output = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < output.length; i++) output[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  },
  
  toggleMute() {
    this.isMuted = !this.isMuted;
    localStorage.setItem("evowar_muted", this.isMuted);
    return this.isMuted;
  },

  play(type) {
    if (!this.ctx || this.isMuted) return; 
    const nowMs = Date.now();
    if (this.lastPlay[type] && nowMs - this.lastPlay[type] < 60) return; this.lastPlay[type] = nowMs;
    const now = this.ctx.currentTime;
    
    if (type === 'hover') {
      const osc = this.ctx.createOscillator(); const gain = this.ctx.createGain();
      osc.type = 'sine'; osc.frequency.setValueAtTime(600, now); osc.frequency.exponentialRampToValueAtTime(300, now + 0.1);
      gain.gain.setValueAtTime(0.05, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.connect(gain); gain.connect(this.ctx.destination); osc.start(now); osc.stop(now + 0.1);
    }
    else if (type === 'click') {
      const osc = this.ctx.createOscillator(); const gain = this.ctx.createGain();
      osc.type = 'square'; osc.frequency.setValueAtTime(800, now); osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
      gain.gain.setValueAtTime(0.1, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.connect(gain); gain.connect(this.ctx.destination); osc.start(now); osc.stop(now + 0.1);
    }
    else if (type === 'swing') {
      const noiseSrc = this.ctx.createBufferSource(); noiseSrc.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter(); filter.type = 'bandpass';
      filter.frequency.setValueAtTime(300, now); filter.frequency.linearRampToValueAtTime(1200, now + 0.15); filter.Q.value = 1.0;
      const gain = this.ctx.createGain(); gain.gain.setValueAtTime(0.5, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
      noiseSrc.connect(filter); filter.connect(gain); gain.connect(this.ctx.destination);
      noiseSrc.start(now); noiseSrc.stop(now + 0.15);
    } 
    else if (type === 'kill') {
      const osc = this.ctx.createOscillator(); const gain = this.ctx.createGain();
      osc.type = 'square'; osc.frequency.setValueAtTime(150, now); osc.frequency.exponentialRampToValueAtTime(20, now + 0.2);
      gain.gain.setValueAtTime(0.4, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.connect(gain); gain.connect(this.ctx.destination);
      osc.start(now); osc.stop(now + 0.3);
      const noiseSrc = this.ctx.createBufferSource(); noiseSrc.buffer = this.noiseBuffer;
      const nFilter = this.ctx.createBiquadFilter(); nFilter.type = 'lowpass'; nFilter.frequency.setValueAtTime(800, now);
      const nGain = this.ctx.createGain(); nGain.gain.setValueAtTime(0.4, now); nGain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      noiseSrc.connect(nFilter); nFilter.connect(nGain); nGain.connect(this.ctx.destination);
      noiseSrc.start(now); noiseSrc.stop(now + 0.2);
    } 
    // ĐÃ FIX 2: SỬ DỤNG SÓNG HÌNH SIN (SINE) ÊM ÁI CHO TIẾNG LÊN CẤP, KHÔNG BỊ CHÓI TAI
    else if (type === 'levelUp') {
      const playNote = (freq, startOffset, duration) => {
        const osc = this.ctx.createOscillator(); const gain = this.ctx.createGain();
        osc.type = 'sine'; // Sóng sine cực kỳ mềm mại
        osc.frequency.setValueAtTime(freq, now + startOffset);
        gain.gain.setValueAtTime(0, now + startOffset);
        gain.gain.linearRampToValueAtTime(0.08, now + startOffset + duration * 0.1); // Âm lượng thấp gọn gàng
        gain.gain.exponentialRampToValueAtTime(0.001, now + startOffset + duration);
        osc.connect(gain); gain.connect(this.ctx.destination);
        osc.start(now + startOffset); osc.stop(now + startOffset + duration);
      };
      // Giai điệu chuông gió thăng hoa nhẹ nhàng
      playNote(523.25, 0, 0.4);      
      playNote(659.25, 0.1, 0.4);    
      playNote(783.99, 0.2, 0.4);    
      playNote(1046.50, 0.35, 0.8);  
    }
  }
};

const uiLayer = document.getElementById("ui-layer");
const playBtn = document.getElementById("play-btn");
const nameInput = document.getElementById("name-input");
const statusText = document.getElementById("status-text");

if (uiLayer) {
    uiLayer.style.transition = "opacity 0.4s ease, transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)";
    uiLayer.style.transform = "scale(1)";
}

playBtn.addEventListener("mouseenter", () => { Sound.init(); Sound.play('hover'); });
nameInput.addEventListener("mouseenter", () => { Sound.init(); Sound.play('hover'); });
nameInput.addEventListener("focus", () => { Sound.init(); Sound.play('click'); });

// =========================================================================
// 3. ĐÃ FIX 1: NÚT MUTE TINH TẾ (CHỈ ICON) ĐẶT Ở GIỮA TRÊN CÙNG
// =========================================================================
const muteBtn = document.createElement("button");
muteBtn.innerHTML = Sound.isMuted ? "🔇" : "🔊";
muteBtn.style.cssText = "position:fixed; top:15px; left:50%; transform:translateX(-50%); background:rgba(20,25,30,0.8); color:white; border:2px solid #445566; width:46px; height:46px; border-radius:50%; cursor:pointer; font-size:22px; display:flex; align-items:center; justify-content:center; z-index:9999; transition:all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275); box-shadow: 0 4px 15px rgba(0,0,0,0.5);";
document.body.appendChild(muteBtn);

muteBtn.addEventListener("mouseenter", () => { 
    Sound.init(); Sound.play('hover'); 
    muteBtn.style.background = "rgba(40,50,60,0.9)"; 
    muteBtn.style.transform = "translateX(-50%) scale(1.15)"; 
    muteBtn.style.borderColor = "#00ffff";
    muteBtn.style.boxShadow = "0 0 15px rgba(0,255,255,0.4)";
});
muteBtn.addEventListener("mouseleave", () => { 
    muteBtn.style.background = "rgba(20,25,30,0.8)"; 
    muteBtn.style.transform = "translateX(-50%) scale(1)"; 
    muteBtn.style.borderColor = "#445566";
    muteBtn.style.boxShadow = "0 4px 15px rgba(0,0,0,0.5)";
});
muteBtn.addEventListener("click", () => {
    Sound.init();
    const muted = Sound.toggleMute();
    muteBtn.innerHTML = muted ? "🔇" : "🔊";
    if (!muted) Sound.play('click');
});

nameInput.value = localStorage.getItem("evowar_name") || "";
playBtn.addEventListener("click", () => {
  Sound.init(); Sound.play('click');
  if (!Network.ws || Network.ws.readyState !== WebSocket.OPEN) return;
  const name = nameInput.value.trim() || "Khách"; localStorage.setItem("evowar_name", name);
  Network.ws.send(JSON.stringify({ type: "join", name: name }));
  playBtn.innerText = "ĐANG VÀO..."; playBtn.disabled = true;
});

const Network = {
  ws: null,
  connect() { 
    this.ws = new WebSocket(wsUrl); 
    this.ws.onopen = () => { statusText.innerText = ""; playBtn.innerText = "VÀO TRẬN"; playBtn.disabled = false; };
    this.ws.onclose = () => { statusText.innerText = "Mất kết nối với Server!"; playBtn.disabled = true; uiLayer.style.display = "flex"; uiLayer.style.opacity = "1"; uiLayer.style.transform = "scale(1)"; };
    this.ws.onmessage = this.onMessage; 
  },
  onMessage(msg) {
    const data = JSON.parse(msg.data);
    if (data.type === "init") {
      GameState.playerId = data.id;
      GameState.mapWidth = data.mapWidth || CONFIG.MAP_WIDTH; GameState.mapHeight = data.mapHeight || CONFIG.MAP_HEIGHT;
      GameState.clientX = GameState.serverX = data.x ?? GameState.mapWidth / 2;
      GameState.clientY = GameState.serverY = data.y ?? GameState.mapHeight / 2;
      GameState.food = data.food || [];
    }
    if (data.type === "state") {
      GameState.stateBuffer.push({ time: Date.now(), players: data.players || [] });
      if (GameState.stateBuffer.length > 5) GameState.stateBuffer.shift();

      if (data.foodAdded && data.foodAdded.length > 0) GameState.food.push(...data.foodAdded);
      if (data.foodRemoved && data.foodRemoved.length > 0) { const removedSet = new Set(data.foodRemoved); GameState.food = GameState.food.filter(f => !removedSet.has(f.id)); }
      
      const prevDead = GameState.isDead ?? true; const me = (data.players || []).find((p) => p.id === GameState.playerId);
      if (me) {
        const oldLevel = GameState.clientLevel;
        GameState.clientLevel = me.level || 1; GameState.clientXp = me.xp || 0; 
        GameState.clientXpToNext = me.xpToNext || GameState.getXpToNext(GameState.clientLevel);
        GameState.clientRadius = GameState.getRadiusByLevel(GameState.clientLevel);
        
        if (GameState.clientLevel > oldLevel) { Sound.play('levelUp'); Camera.screenFlash = 1.0; } 
        // Không phát âm thanh tiếng ăn FOOD nữa theo yêu cầu
        
        if (oldLevel !== GameState.clientLevel) Camera.targetZoom = Camera.getZoomByLevel(GameState.clientLevel);

        if (prevDead && !me.isDead) { 
          GameState.clientX = GameState.serverX = me.x; GameState.clientY = GameState.serverY = me.y; 
          uiLayer.style.opacity = "0"; uiLayer.style.transform = "scale(1.05)"; 
          setTimeout(() => uiLayer.style.display = "none", 400); 
        } 
        else { GameState.serverX = me.x; GameState.serverY = me.y; }

        if (!prevDead && me.isDead) {
          uiLayer.style.display = "flex"; 
          setTimeout(() => { uiLayer.style.opacity = "1"; uiLayer.style.transform = "scale(1)"; }, 10); 
          statusText.innerText = "Bạn đã bị hạ gục!"; playBtn.disabled = true;
          let left = Math.floor(CONFIG.RESPAWN_TIME / 1000); playBtn.innerText = `HỒI SINH SAU (${left}s)`;
          const interval = setInterval(() => { left--; if (left <= 0) { clearInterval(interval); playBtn.innerText = "VÀO TRẬN LẠI"; playBtn.disabled = false; statusText.innerText = ""; } else { playBtn.innerText = `HỒI SINH SAU (${left}s)`; } }, 1000);
        }
      }
      
      GameState.isDead = me?.isDead ?? true; GameState.lastAttackTime = me?.lastAttackTime || GameState.lastAttackTime;

      for (const p of data.players || []) {
        if (p.isDead && !GameState.prevPlayerDeadState[p.id]) {
          Renderer.addDeathParticles(p.x, p.y, p.radius);
          
          const killer = (data.players || []).find(k => k.id === p.killerId);
          if (killer) {
            const isMe = (killer.id === GameState.playerId) || (p.id === GameState.playerId);
            Renderer.addKillFeed(killer.name || "Khách", p.name || "Khách", isMe);
          }

          if (p.killerId === GameState.playerId && p.id !== GameState.playerId) {
            const xpGained = Math.floor((p.score || 0) * CONFIG.KILL_SCORE_MULTIPLIER_HUD);
            Renderer.addFloatingText(p.x, p.y - 12, `+${xpGained} XP`, "#00ff66", 14); 
            Renderer.addFloatingText(p.x, p.y + 12, "KILL!", "#ff3333", 16);        
            Sound.play('kill'); GameState.freezeUntil = Date.now() + 40; Camera.addShake(15); FX.spawnHitSparks(p.x, p.y);
          }
        }
        
        if (p.id === GameState.playerId) { 
          const prevLevel = GameState.prevPlayerLevels[p.id]; 
          if (prevLevel && p.level > prevLevel && !p.isDead) {
            Renderer.addLevelUpEffect(p.x, p.y, p.radius);
            Renderer.addFloatingText(p.x, p.y - p.radius - 20, "LEVEL UP!", "#00ffff", 18); 
          }
        }
        
        GameState.prevPlayerLevels[p.id] = p.level; GameState.prevPlayerDeadState[p.id] = p.isDead;
      }
    }
  },
  sendPositionUpdate(forceUpdate = false) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const me = (GameState.stateBuffer[GameState.stateBuffer.length - 1]?.players || []).find((p) => p.id === GameState.playerId);
    if (me && me.isDead) return;
    if (!forceUpdate && Date.now() - GameState.lastSentTime < CONFIG.CLIENT_SEND_INTERVAL) return;
    
    const dAngle = Math.abs(GameState.mouseAngle - GameState.lastSentAngle);
    const rightMouseChanged = GameState.rightMouseDown !== GameState.lastRightMouse;
    const movingChanged = GameState.isMoving !== GameState.lastMoving;
    
    if (forceUpdate || dAngle > CONFIG.ANGLE_SEND_THRESHOLD || rightMouseChanged || movingChanged) {
      this.ws.send(JSON.stringify({ type: "move", angle: GameState.mouseAngle, rightMouseDown: GameState.rightMouseDown && GameState.clientXp > 0, isMoving: GameState.isMoving }));
      GameState.lastSentTime = Date.now(); GameState.lastSentAngle = GameState.mouseAngle;
      GameState.lastRightMouse = GameState.rightMouseDown; GameState.lastMoving = GameState.isMoving;
    }
  },
};

const Input = {
  setup() {
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    canvas.addEventListener("mousemove", (e) => {
      if (GameState.mouseMoveThrottled || GameState.isTouch) return;
      GameState.mouseMoveThrottled = true;
      requestAnimationFrame(() => {
        GameState.lastDx = e.clientX - window.innerWidth / 2; GameState.lastDy = e.clientY - window.innerHeight / 2;
        GameState.isMoving = Math.hypot(GameState.lastDx, GameState.lastDy) > GameState.clientRadius;
        GameState.targetMouseAngle = Math.atan2(GameState.lastDy, GameState.lastDx);
        Network.sendPositionUpdate(); GameState.mouseMoveThrottled = false;
      });
    });
    canvas.addEventListener("mousedown", (e) => {
      if (GameState.isTouch || GameState.isDead) return; Sound.init(); 
      if (e.button === 2 && GameState.clientXp > 0 && GameState.clientLevel >= 1) { GameState.rightMouseDown = true; Network.sendPositionUpdate(true); }
      if (e.button === 0) {
        const cooldown = 500 + (GameState.clientLevel - 1) * 60;
        if (!GameState.isAttacking && Date.now() - (GameState.lastAttackTime || 0) >= cooldown) {
          GameState.isAttacking = true; GameState.attackTime = Date.now(); Network.ws.send(JSON.stringify({ type: "attack" })); Sound.play('swing');
        }
      }
    });
    canvas.addEventListener("mouseup", (e) => {
      if (GameState.isTouch) return;
      if (e.button === 2) { GameState.rightMouseDown = false; Network.sendPositionUpdate(true); }
    });

    const isPointInCircle = (px, py, cx, cy, radius) => Math.hypot(px - cx, py - cy) < radius;

    canvas.addEventListener("touchstart", (e) => {
      if(GameState.isDead) return; GameState.isTouch = true; e.preventDefault(); Sound.init(); 
      for(let i=0; i<e.changedTouches.length; i++) {
        const t = e.changedTouches[i]; const tx = t.clientX, ty = t.clientY; const w = window.innerWidth, h = window.innerHeight;
        if (isPointInCircle(tx, ty, w - 75, h - 75, 60)) {
          const cooldown = 500 + (GameState.clientLevel - 1) * 60;
          if (!GameState.isAttacking && Date.now() - (GameState.lastAttackTime || 0) >= cooldown) {
            GameState.isAttacking = true; GameState.attackTime = Date.now(); Network.ws.send(JSON.stringify({ type: "attack" })); Sound.play('swing');
          }
        }
        else if (isPointInCircle(tx, ty, w - 160, h - 75, 50)) { GameState.rightMouseDown = true; GameState.sprintTouchId = t.identifier; Network.sendPositionUpdate(true); }
        else if (tx < w / 2) {
          GameState.joystick.active = true; GameState.joystick.id = t.identifier;
          GameState.joystick.baseX = tx; GameState.joystick.baseY = ty;
          GameState.joystick.stickX = tx; GameState.joystick.stickY = ty; GameState.isMoving = true;
        }
      }
    }, {passive: false});

    canvas.addEventListener("touchmove", (e) => {
      if(GameState.isDead) return; e.preventDefault();
      for(let i=0; i<e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (GameState.joystick.active && t.identifier === GameState.joystick.id) {
          const dx = t.clientX - GameState.joystick.baseX, dy = t.clientY - GameState.joystick.baseY;
          const dist = Math.hypot(dx, dy), maxDist = 50; 
          if (dist > 5) { GameState.targetMouseAngle = Math.atan2(dy, dx); GameState.isMoving = true; } else { GameState.isMoving = false; }
          if (dist > maxDist) { GameState.joystick.stickX = GameState.joystick.baseX + Math.cos(GameState.targetMouseAngle) * maxDist; GameState.joystick.stickY = GameState.joystick.baseY + Math.sin(GameState.targetMouseAngle) * maxDist; } 
          else { GameState.joystick.stickX = t.clientX; GameState.joystick.stickY = t.clientY; }
          Network.sendPositionUpdate();
        }
      }
    }, {passive: false});

    canvas.addEventListener("touchend", (e) => {
      if(GameState.isDead) return; e.preventDefault();
      for(let i=0; i<e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (GameState.joystick.active && t.identifier === GameState.joystick.id) { GameState.joystick.active = false; GameState.isMoving = false; Network.sendPositionUpdate(true); }
        if (GameState.sprintTouchId === t.identifier) { GameState.rightMouseDown = false; GameState.sprintTouchId = null; Network.sendPositionUpdate(true); }
      }
    }, {passive: false});
    window.addEventListener("resize", Renderer.resizeCanvas);
  }
};

function updatePhysics(dtMultiplier) {
  if (GameState.clientX === null || GameState.clientY === null || GameState.isDead) return;
  
  let diff = GameState.targetMouseAngle - GameState.mouseAngle;
  while (diff > Math.PI) diff -= 2 * Math.PI; while (diff < -Math.PI) diff += 2 * Math.PI;
  GameState.mouseAngle += diff * 0.15 * dtMultiplier;
  
  const attackDuration = CONFIG.BASE_ATTACK_DURATION + (GameState.clientLevel * CONFIG.ATTACK_DURATION_PER_LEVEL);
  if (GameState.isAttacking && Date.now() - GameState.attackTime < attackDuration) {
      const speed = GameState.getSpeedByLevel(GameState.clientLevel) * 0.3;
      GameState.clientX += Math.cos(GameState.mouseAngle) * speed * dtMultiplier;
      GameState.clientY += Math.sin(GameState.mouseAngle) * speed * dtMultiplier;
  } else if (GameState.isMoving) {
    const speed = GameState.getSpeedByLevel(GameState.clientLevel) * (GameState.rightMouseDown && GameState.clientXp > 0 ? CONFIG.SPRINT_MULTIPLIER : 1);
    GameState.clientX += Math.cos(GameState.mouseAngle) * speed * dtMultiplier;
    GameState.clientY += Math.sin(GameState.mouseAngle) * speed * dtMultiplier;
  }
  
  GameState.clientX = Math.max(GameState.clientRadius, Math.min(CONFIG.MAP_WIDTH - GameState.clientRadius, GameState.clientX));
  GameState.clientY = Math.max(GameState.clientRadius, Math.min(CONFIG.MAP_HEIGHT - GameState.clientRadius, GameState.clientY));

  if (GameState.serverX != null && GameState.serverY != null) {
    const dx = GameState.clientX - GameState.serverX, dy = GameState.clientY - GameState.serverY;
    const dist = Math.hypot(dx, dy);
    if (dist > 150) { GameState.clientX = GameState.serverX; GameState.clientY = GameState.serverY; } 
    else if (dist > 1) { 
      const lerpFactor = 1 - Math.pow(0.85, dtMultiplier); 
      GameState.clientX -= dx * lerpFactor; GameState.clientY -= dy * lerpFactor; 
    }
  }

  if (GameState.isAttacking && Date.now() - GameState.attackTime > attackDuration) GameState.isAttacking = false;
}

let lastFrameTime = null;
function loop(currentTime) {
  if (Date.now() < GameState.freezeUntil) { requestAnimationFrame(loop); return; }
  if (!lastFrameTime) lastFrameTime = currentTime;
  const dtMultiplier = Math.min((currentTime - lastFrameTime) / 1000, 0.05) * 60; 
  lastFrameTime = currentTime;
  updatePhysics(dtMultiplier); Renderer.draw(dtMultiplier); requestAnimationFrame(loop);
}

function main() {
  Renderer.resizeCanvas(); Resources.load(); Renderer.setupUI(); Network.connect(); Input.setup();
  Camera.currentZoom = Camera.getZoomByLevel(1); Camera.targetZoom = Camera.currentZoom;
  requestAnimationFrame(loop);
  setInterval(() => {
    if (!GameState.isDead) Renderer.updateUI();
    if (GameState.clientXp <= 0 && GameState.rightMouseDown) { GameState.rightMouseDown = false; Network.sendPositionUpdate(true); }
  }, CONFIG.UI_UPDATE_INTERVAL || 100);
}

main();
