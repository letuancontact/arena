// --- src/client/main.js ---
import { GameState } from './state.js';
import { Camera, FX, Resources, Renderer } from './renderer.js';

const CONFIG = window.GAME_CONFIG;
const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
const wsUrl = `${protocol}//${window.location.host}`;
const canvas = document.getElementById("game");

GameState.freezeUntil = 0;

// =========================================================================
// 1. TIÊM CSS GIAO DIỆN CHUẨN NGUYÊN BẢN (ĐÃ VÁ LỖI CHUỖI SVG)
// =========================================================================
const uiStyle = document.createElement('style');
uiStyle.innerHTML = `
  /* Nền Tổ Ong (Honeycomb Pattern) bằng CSS thuần, siêu nhẹ không tốn băng thông */
  #ui-layer {
    background-color: #1a1e24;
    background-image: url("data:image/svg+xml,%3Csvg width='40' height='69.28203230275509' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M40 11.547L40 23.094L20 34.641L0 23.094L0 11.547L20 0L40 11.547ZM20 46.188L20 57.735L0 69.282L-20 57.735L-20 46.188L0 34.641L20 46.188ZM60 46.188L60 57.735L40 69.282L20 57.735L20 46.188L40 34.641L60 46.188Z' fill='none' stroke='%23252a32' stroke-width='2' /%3E%3C/svg%3E");
    background-size: 80px 138.56px;
    display: flex; flex-direction: column; align-items: center; justify-content: space-evenly;
    font-family: 'Segoe UI', Arial, sans-serif;
    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 2000;
    transition: opacity 0.4s ease, transform 0.4s ease;
    padding: 20px 0; box-sizing: border-box;
  }

  /* Khối văn bản hộp thoại mờ góc bo tròn */
  .menu-panel {
    background: rgba(30, 38, 46, 0.88);
    border: 2px solid rgba(65, 75, 85, 0.7);
    border-radius: 16px;
    padding: 25px 40px;
    text-align: center;
    max-width: 800px;
    width: 90%;
    box-shadow: 0 12px 35px rgba(0,0,0,0.6);
  }
  
  .small-panel { max-width: 740px; padding: 15px 30px; }

  /* Typography */
  .menu-panel h1 { color: #ffffff; font-size: 30px; margin: 0 0 8px 0; font-weight: 800; text-shadow: 1px 2px 4px rgba(0,0,0,0.9); }
  .menu-panel h2 { color: #b0b0b0; font-size: 24px; margin: 0 0 15px 0; font-weight: 700; text-shadow: 1px 2px 4px rgba(0,0,0,0.9); }
  .menu-panel p { color: #e0e0e0; font-size: 15px; line-height: 1.5; margin: 5px 0; font-weight: 500; }
  .small-panel p { font-size: 13px; color: #bbbbbb; margin: 4px 0; line-height: 1.4; }

  /* Khu vực hiển thị Logo */
  .logo-container { text-align: center; margin: 10px 0; position: relative; }
  #game-logo { height: 150px; object-fit: contain; filter: drop-shadow(0 15px 15px rgba(0,0,0,0.7)); animation: float 3s ease-in-out infinite; }
  .version-text { color: #777; font-size: 12px; font-weight: bold; margin-top: -5px; }

  @keyframes float {
    0% { transform: translateY(0px); }
    50% { transform: translateY(-10px); }
    100% { transform: translateY(0px); }
  }

  /* Khối Input và Nút Chơi */
  .action-container { display: flex; flex-direction: column; align-items: center; gap: 15px; margin-top: 10px; }
  
  #name-input {
    background: rgba(15, 20, 25, 0.95); border: 2px solid #556677; color: #fff; 
    padding: 12px 20px; border-radius: 8px; font-size: 18px; text-align: center; 
    outline: none; transition: all 0.3s ease; width: 260px; font-weight: bold;
    box-shadow: inset 0 2px 5px rgba(0,0,0,0.5);
  }
  #name-input:focus { border-color: #ff6600; background: rgba(25, 30, 35, 1); box-shadow: 0 0 15px rgba(255,102,0,0.4); }

  /* Nút PLAY màu cam 3D dày dặn chuẩn Evowars */
  #play-btn {
    background: linear-gradient(to bottom, #ff8c00 0%, #e63900 100%);
    border: 3px solid #ffcc00;
    border-bottom-width: 6px;
    color: #ffffff; font-weight: 900; font-size: 32px; padding: 10px 70px;
    border-radius: 12px; cursor: pointer; transition: all 0.05s ease;
    text-transform: uppercase; box-shadow: 0 8px 25px rgba(0, 0, 0, 0.6), inset 0 2px 4px rgba(255,255,255,0.4);
    text-shadow: 2px 2px 0px #802000;
    letter-spacing: 2px; font-family: 'Impact', 'Arial Black', sans-serif;
  }
  #play-btn:hover:not(:disabled) { filter: brightness(1.1); transform: translateY(-2px); border-bottom-width: 8px; }
  #play-btn:active:not(:disabled) { transform: translateY(4px); border-bottom-width: 2px; filter: brightness(0.9); }
  
  #play-btn:disabled { 
    background: linear-gradient(to bottom, #555, #333) !important; border-color: #777 !important; color: #aaa !important;
    border-bottom-width: 3px !important; cursor: not-allowed; text-shadow: none !important; font-size: 18px !important; padding: 14px 40px !important;
    font-family: monospace, sans-serif !important;
  }

  #status-text { color: #ff3333; font-size: 16px; font-weight: bold; margin-top: 10px; text-shadow: 1px 1px 2px black;}

  /* Icon Mute thu nhỏ đặt sát cạnh Minimap */
  #mute-btn {
    position: fixed; top: 12px; right: 212px; 
    background: rgba(15,22,30,0.8); color: white; border: 2px solid #445566; 
    width: 36px; height: 38px; border-radius: 50%; cursor: pointer; font-size: 16px; 
    display: flex; align-items: center; justify-content: center; z-index: 9999; 
    transition: all 0.2s ease; box-shadow: 0 4px 10px rgba(0,0,0,0.4);
  }
  #mute-btn:hover { background: #334455; border-color: #fff; transform: scale(1.1); }

  /* Responsive mượt cho Điện thoại */
  @media (max-width: 768px) {
    .menu-panel { padding: 15px 20px; width: 92%; }
    .menu-panel h1 { font-size: 20px; margin-bottom: 4px; }
    .menu-panel h2 { font-size: 16px; margin-bottom: 8px; }
    .menu-panel p { font-size: 13px; }
    .small-panel p { font-size: 11px; }
    #game-logo { height: 100px; }
    #play-btn { font-size: 24px; padding: 8px 50px; }
    #mute-btn { top: 8px; right: 102px; width: 30px; height: 30px; font-size: 13px; border-width: 1px; }
  }
`;
document.head.appendChild(uiStyle);

// =========================================================================
// 2. SOUND ENGINE
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
      gain.gain.setValueAtTime(0.04, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.connect(gain); gain.connect(this.ctx.destination); osc.start(now); osc.stop(now + 0.1);
    }
    else if (type === 'click') {
      const osc = this.ctx.createOscillator(); const gain = this.ctx.createGain();
      osc.type = 'square'; osc.frequency.setValueAtTime(800, now); osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
      gain.gain.setValueAtTime(0.08, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
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
    else if (type === 'levelUp') {
      const playNote = (freq, startOffset, duration) => {
        const osc = this.ctx.createOscillator(); const gain = this.ctx.createGain();
        osc.type = 'sine'; 
        osc.frequency.setValueAtTime(freq, now + startOffset);
        gain.gain.setValueAtTime(0, now + startOffset);
        gain.gain.linearRampToValueAtTime(0.06, now + startOffset + duration * 0.1); 
        gain.gain.exponentialRampToValueAtTime(0.001, now + startOffset + duration);
        osc.connect(gain); gain.connect(this.ctx.destination);
        osc.start(now + startOffset); osc.stop(now + startOffset + duration);
      };
      playNote(523.25, 0, 0.35);      
      playNote(659.25, 0.08, 0.35);    
      playNote(783.99, 0.16, 0.35);    
      playNote(1046.50, 0.26, 0.6);  
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

const muteBtn = document.createElement("button");
muteBtn.id = "mute-btn";
muteBtn.innerHTML = Sound.isMuted ? "🔇" : "🔊";
document.body.appendChild(muteBtn);

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
    this.ws.onopen = () => { statusText.innerText = ""; playBtn.innerText = "PLAY"; playBtn.disabled = false; };
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
          statusText.innerText = "BẠN ĐÃ BỊ HẠ GỤC!"; playBtn.disabled = true;
          
          let left = Math.floor(CONFIG.RESPAWN_TIME / 1000); playBtn.innerText = `HỒI SINH SAU: ${left}S`;
          const interval = setInterval(() => { 
            left--; 
            if (left <= 0) { 
              clearInterval(interval); playBtn.innerText = "PLAY"; playBtn.disabled = false; statusText.innerText = ""; 
            } else { 
              playBtn.innerText = `HỒI SINH SAU: ${left}S`; 
            } 
          }, 1000);
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
