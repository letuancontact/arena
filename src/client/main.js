// --- src/client/main.js ---
import { GameState } from './state.js';
import { Camera, Resources, Renderer } from './renderer.js';

const CONFIG = window.GAME_CONFIG;
const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
const wsUrl = `${protocol}//${window.location.host}`;
const canvas = document.getElementById("game");

// ===== AUDIO SYSTEM: TỰ TỔNG HỢP ÂM THANH BẰNG CODE KHÔNG CẦN FILE MP3 =====
const Sound = {
  ctx: null,
  init() {
    if (this.ctx) return;
    window.AudioContext = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioContext();
  },
  play(type) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain); gain.connect(this.ctx.destination);
    
    const now = this.ctx.currentTime;
    if (type === 'swing') {
      // Tiếng vung kiếm: Tần số giảm nhanh tạo tiếng "vút"
      osc.type = 'triangle'; osc.frequency.setValueAtTime(150, now); osc.frequency.exponentialRampToValueAtTime(40, now + 0.15);
      gain.gain.setValueAtTime(0.2, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
      osc.start(now); osc.stop(now + 0.15);
    } else if (type === 'eat') {
      // Tiếng nhặt hạt: Một tiếng "Bíp" cao và ngắn
      osc.type = 'sine'; osc.frequency.setValueAtTime(600, now);
      gain.gain.setValueAtTime(0.05, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      osc.start(now); osc.stop(now + 0.1);
    } else if (type === 'kill') {
      // Tiếng chém trúng: Âm trầm đục, mạnh
      osc.type = 'square'; osc.frequency.setValueAtTime(200, now); osc.frequency.exponentialRampToValueAtTime(50, now + 0.3);
      gain.gain.setValueAtTime(0.3, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.start(now); osc.stop(now + 0.3);
    } else if (type === 'levelUp') {
      // Tiếng lên cấp: Giai điệu ngắn tăng lên
      osc.type = 'sine'; osc.frequency.setValueAtTime(400, now); osc.frequency.setValueAtTime(600, now + 0.1);
      gain.gain.setValueAtTime(0.2, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
      osc.start(now); osc.stop(now + 0.4);
    }
  }
};

// ===== UI CONTROLLER (MAIN MENU) =====
const uiLayer = document.getElementById("ui-layer");
const playBtn = document.getElementById("play-btn");
const nameInput = document.getElementById("name-input");
const statusText = document.getElementById("status-text");

nameInput.value = localStorage.getItem("evowar_name") || "";

playBtn.addEventListener("click", () => {
  Sound.init(); // Trình duyệt yêu cầu user click chuột mới được bật tiếng
  if (!Network.ws || Network.ws.readyState !== WebSocket.OPEN) return;
  const name = nameInput.value.trim() || "Khách";
  localStorage.setItem("evowar_name", name);
  
  Network.ws.send(JSON.stringify({ type: "join", name: name }));
  playBtn.innerText = "ĐANG VÀO...";
  playBtn.disabled = true;
});

// ===== NETWORK =====
const Network = {
  ws: null,
  connect() { 
    this.ws = new WebSocket(wsUrl); 
    this.ws.onopen = () => {
      statusText.innerText = "";
      playBtn.innerText = "VÀO TRẬN";
      playBtn.disabled = false;
    };
    this.ws.onclose = () => {
      statusText.innerText = "Mất kết nối với Server!";
      playBtn.disabled = true;
      uiLayer.style.display = "flex";
      uiLayer.style.opacity = "1";
    };
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
      if (data.foodRemoved && data.foodRemoved.length > 0) {
        const removedSet = new Set(data.foodRemoved);
        GameState.food = GameState.food.filter(f => !removedSet.has(f.id));
      }
      
      const prevDead = GameState.isDead ?? true; 
      const me = (data.players || []).find((p) => p.id === GameState.playerId);
      
      if (me) {
        const oldLevel = GameState.clientLevel;
        const oldXp = GameState.clientXp;

        GameState.clientLevel = me.level || 1;
        GameState.clientXp = me.xp || 0; 
        GameState.clientXpToNext = me.xpToNext || GameState.getXpToNext(GameState.clientLevel);
        GameState.clientRadius = GameState.getRadiusByLevel(GameState.clientLevel);
        
        // KIỂM TRA ĐỂ PHÁT ÂM THANH LEVEL UP & ĂN THỨC ĂN
        if (GameState.clientLevel > oldLevel) Sound.play('levelUp');
        else if (GameState.clientXp > oldXp) Sound.play('eat');

        if (oldLevel !== GameState.clientLevel) Camera.targetZoom = Camera.getZoomByLevel(GameState.clientLevel);

        if (prevDead && !me.isDead) { 
          GameState.clientX = GameState.serverX = me.x; GameState.clientY = GameState.serverY = me.y; 
          uiLayer.style.opacity = "0";
          setTimeout(() => uiLayer.style.display = "none", 300);
        } else { 
          GameState.serverX = me.x; GameState.serverY = me.y; 
        }

        if (!prevDead && me.isDead) {
          // CAMERA SHAKE KHI CHẾT ĐÃ ĐƯỢC GỠ BỎ Ở ĐÂY 
          uiLayer.style.display = "flex";
          setTimeout(() => uiLayer.style.opacity = "1", 10);
          statusText.innerText = "Bạn đã bị hạ gục!";
          playBtn.disabled = true;

          let left = Math.floor(CONFIG.RESPAWN_TIME / 1000);
          playBtn.innerText = `HỒI SINH SAU (${left}s)`;
          
          const interval = setInterval(() => {
            left--;
            if (left <= 0) {
              clearInterval(interval);
              playBtn.innerText = "VÀO TRẬN LẠI";
              playBtn.disabled = false;
              statusText.innerText = "";
            } else {
              playBtn.innerText = `HỒI SINH SAU (${left}s)`;
            }
          }, 1000);
        }
      }
      
      GameState.isDead = me?.isDead ?? true; 
      GameState.lastAttackTime = me?.lastAttackTime || GameState.lastAttackTime;

      for (const p of data.players || []) {
        if (p.isDead && !GameState.prevPlayerDeadState[p.id]) Renderer.addDeathParticles(p.x, p.y, p.radius);
        if (p.id !== GameState.playerId && p.isDead && !GameState.prevPlayerDeadState[p.id] && p.killerId === GameState.playerId) {
          Renderer.addKillXpEffect(me?.x || 0, (me?.y || 0) - (me?.radius || 30) - 30, Math.floor((p.score || 0) * CONFIG.KILL_SCORE_MULTIPLIER_HUD));
          
          // PHÁT ÂM THANH KHI GIẾT ĐỊCH CHUẨN XÁC, VÀ GỠ CAMERA SHAKE
          Sound.play('kill'); 
          Camera.triggerShake(15); // Chỉ rung nhẹ xíu khi mình là người kết liễu tạo cảm giác tay (Nếu không thích bạn có thể xóa luôn dòng này)
        }
        GameState.prevPlayerDeadState[p.id] = p.isDead;
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

// ===== INPUT =====
const Input = {
  setup() {
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    
    canvas.addEventListener("mousemove", (e) => {
      if (GameState.mouseMoveThrottled || GameState.isTouch) return;
      GameState.mouseMoveThrottled = true;
      requestAnimationFrame(() => {
        GameState.lastDx = e.clientX - canvas.width / 2; GameState.lastDy = e.clientY - canvas.height / 2;
        GameState.isMoving = Math.hypot(GameState.lastDx, GameState.lastDy) > GameState.clientRadius;
        GameState.mouseAngle = Math.atan2(GameState.lastDy, GameState.lastDx);
        Network.sendPositionUpdate(); GameState.mouseMoveThrottled = false;
      });
    });
    canvas.addEventListener("mousedown", (e) => {
      if (GameState.isTouch || GameState.isDead) return;
      if (e.button === 2 && GameState.clientXp > 0 && GameState.clientLevel >= 1) { GameState.rightMouseDown = true; Network.sendPositionUpdate(true); }
      if (e.button === 0) {
        const cooldown = 500 + (GameState.clientLevel - 1) * 60;
        if (!GameState.isAttacking && Date.now() - (GameState.lastAttackTime || 0) >= cooldown) {
          GameState.isAttacking = true; GameState.attackTime = Date.now(); Network.ws.send(JSON.stringify({ type: "attack" }));
          Sound.play('swing'); // ÂM THANH KHI CHÉM TRÊN PC
        }
      }
    });
    canvas.addEventListener("mouseup", (e) => {
      if (GameState.isTouch) return;
      if (e.button === 2) { GameState.rightMouseDown = false; Network.sendPositionUpdate(true); }
    });

    const isPointInCircle = (px, py, cx, cy, radius) => Math.hypot(px - cx, py - cy) < radius;

    canvas.addEventListener("touchstart", (e) => {
      if(GameState.isDead) return;
      GameState.isTouch = true;
      e.preventDefault(); 
      for(let i=0; i<e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        const tx = t.clientX, ty = t.clientY;
        const w = canvas.width, h = canvas.height;
        
        if (isPointInCircle(tx, ty, w - 75, h - 75, 60)) {
          const cooldown = 500 + (GameState.clientLevel - 1) * 60;
          if (!GameState.isAttacking && Date.now() - (GameState.lastAttackTime || 0) >= cooldown) {
            GameState.isAttacking = true; GameState.attackTime = Date.now(); Network.ws.send(JSON.stringify({ type: "attack" }));
            Sound.play('swing'); // ÂM THANH KHI CHÉM TRÊN MOBILE
          }
        }
        else if (isPointInCircle(tx, ty, w - 160, h - 75, 50)) {
          GameState.rightMouseDown = true; GameState.sprintTouchId = t.identifier; Network.sendPositionUpdate(true);
        }
        else if (tx < w / 2) {
          GameState.joystick.active = true; GameState.joystick.id = t.identifier;
          GameState.joystick.baseX = tx; GameState.joystick.baseY = ty;
          GameState.joystick.stickX = tx; GameState.joystick.stickY = ty;
          GameState.isMoving = true;
        }
      }
    }, {passive: false});

    canvas.addEventListener("touchmove", (e) => {
      if(GameState.isDead) return;
      e.preventDefault();
      for(let i=0; i<e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (GameState.joystick.active && t.identifier === GameState.joystick.id) {
          const dx = t.clientX - GameState.joystick.baseX, dy = t.clientY - GameState.joystick.baseY;
          const dist = Math.hypot(dx, dy), maxDist = 50; 
          
          if (dist > 5) { GameState.mouseAngle = Math.atan2(dy, dx); GameState.isMoving = true; } 
          else { GameState.isMoving = false; }

          if (dist > maxDist) {
            GameState.joystick.stickX = GameState.joystick.baseX + Math.cos(GameState.mouseAngle) * maxDist;
            GameState.joystick.stickY = GameState.joystick.baseY + Math.sin(GameState.mouseAngle) * maxDist;
          } else {
            GameState.joystick.stickX = t.clientX; GameState.joystick.stickY = t.clientY;
          }
          Network.sendPositionUpdate();
        }
      }
    }, {passive: false});

    canvas.addEventListener("touchend", (e) => {
      if(GameState.isDead) return;
      e.preventDefault();
      for(let i=0; i<e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (GameState.joystick.active && t.identifier === GameState.joystick.id) {
          GameState.joystick.active = false; GameState.isMoving = false; Network.sendPositionUpdate(true);
        }
        if (GameState.sprintTouchId === t.identifier) {
          GameState.rightMouseDown = false; GameState.sprintTouchId = null; Network.sendPositionUpdate(true);
        }
      }
    }, {passive: false});

    window.addEventListener("resize", Renderer.resizeCanvas);
  }
};

function updatePhysics(dtMultiplier) {
  if (GameState.clientX === null || GameState.clientY === null || GameState.isDead) return;
  const attackDuration = CONFIG.BASE_ATTACK_DURATION + (GameState.clientLevel * CONFIG.ATTACK_DURATION_PER_LEVEL);
  
  if (GameState.isAttacking && Date.now() - GameState.attackTime < attackDuration) {
  } else if (GameState.isMoving) {
    const speed = GameState.getSpeedByLevel(GameState.clientLevel) * (GameState.rightMouseDown && GameState.clientXp > 0 ? CONFIG.SPRINT_MULTIPLIER : 1);
    GameState.clientX += Math.cos(GameState.mouseAngle) * speed * dtMultiplier;
    GameState.clientY += Math.sin(GameState.mouseAngle) * speed * dtMultiplier;
  }
  
  GameState.clientX = Math.max(GameState.clientRadius, Math.min(CONFIG.MAP_WIDTH - GameState.clientRadius, GameState.clientX));
  GameState.clientY = Math.max(GameState.clientRadius, Math.min(CONFIG.MAP_HEIGHT - GameState.clientRadius, GameState.clientY));

  if (GameState.serverX != null && GameState.serverY != null) {
    const dist = Math.hypot(GameState.clientX - GameState.serverX, GameState.clientY - GameState.serverY);
    if (dist > 150) { GameState.clientX = GameState.serverX; GameState.clientY = GameState.serverY; } 
    else if (dist > 1) { GameState.clientX += (GameState.serverX - GameState.clientX) * 0.15 * dtMultiplier; GameState.clientY += (GameState.serverY - GameState.clientY) * 0.15 * dtMultiplier; }
  }

  if (GameState.isAttacking && Date.now() - GameState.attackTime > attackDuration) GameState.isAttacking = false;
}

let lastFrameTime = null;
function loop(currentTime) {
  if (!lastFrameTime) lastFrameTime = currentTime;
  const dtMultiplier = Math.min((currentTime - lastFrameTime) / 1000, 0.1) * 60; 
  lastFrameTime = currentTime;

  updatePhysics(dtMultiplier);
  Renderer.draw(dtMultiplier);
  requestAnimationFrame(loop);
}

function main() {
  Renderer.resizeCanvas();
  Resources.load();
  Renderer.setupUI();
  Network.connect();
  Input.setup();
  Camera.currentZoom = Camera.getZoomByLevel(1); Camera.targetZoom = Camera.currentZoom;
  
  requestAnimationFrame(loop);
  setInterval(() => {
    if (!GameState.isDead) Renderer.updateUI();
    if (GameState.clientXp <= 0 && GameState.rightMouseDown) {
      GameState.rightMouseDown = false;
      Network.sendPositionUpdate(true);
    }
  }, CONFIG.UI_UPDATE_INTERVAL || 100);
}

main();
