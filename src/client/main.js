// --- src/client/main.js ---
import { GameState } from './state.js';
import { Camera, Resources, Renderer } from './renderer.js';

const CONFIG = window.GAME_CONFIG;
const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
const wsUrl = `${protocol}//${window.location.host}`;
const canvas = document.getElementById("game");

// ===== NETWORK =====
const Network = {
  ws: null,
  connect() {
    this.ws = new WebSocket(wsUrl);
    this.ws.onmessage = this.onMessage;
  },
  onMessage(msg) {
    const data = JSON.parse(msg.data);
    if (data.type === "init") {
      GameState.playerId = data.id;
      GameState.mapWidth = data.mapWidth || CONFIG.MAP_WIDTH;
      GameState.mapHeight = data.mapHeight || CONFIG.MAP_HEIGHT;
      GameState.clientX = data.x ?? GameState.mapWidth / 2;
      GameState.clientY = data.y ?? GameState.mapHeight / 2;
      GameState.serverX = GameState.clientX;
      GameState.serverY = GameState.clientY;
    }
    if (data.type === "state") {
      GameState.stateBuffer.push({
        time: Date.now(),
        food: data.food || [],
        players: data.players || [],
      });
      if (GameState.stateBuffer.length > 5) GameState.stateBuffer.shift();
      
      const prevDead = GameState.isDead;
      const me = (data.players || []).find((p) => p.id === GameState.playerId);
      
      if (me) {
        const oldLevel = GameState.clientLevel;
        GameState.clientLevel = me.level || 1;
        GameState.clientXp = me.xp || 0;
        GameState.clientXpToNext = me.xpToNext || GameState.getXpToNext(GameState.clientLevel);
        GameState.clientRadius = GameState.getRadiusByLevel(GameState.clientLevel);
        
        if (oldLevel !== GameState.clientLevel) {
          Camera.targetZoom = Camera.getZoomByLevel(GameState.clientLevel);
        }

        // CHƯƠNG 14: Lấy tọa độ đích từ Server làm mục tiêu nội suy (Reconciliation)
        if (prevDead && !me.isDead) {
          GameState.clientX = GameState.serverX = me.x;
          GameState.clientY = GameState.serverY = me.y;
        } else {
          GameState.serverX = me.x;
          GameState.serverY = me.y;
        }
      }
      
      GameState.isDead = me?.isDead || false;
      GameState.lastAttackTime = me?.lastAttackTime || GameState.lastAttackTime;

      // Xử lý Hiệu ứng UI
      for (const p of data.players || []) {
        if (p.isDead && !GameState.prevPlayerDeadState[p.id]) {
          Renderer.addDeathParticles(p.x, p.y, p.radius);
        }
        if (p.id !== GameState.playerId && p.isDead && !GameState.prevPlayerDeadState[p.id] && p.killerId === GameState.playerId) {
          const gainXp = Math.floor((p.score || 0) * CONFIG.KILL_SCORE_MULTIPLIER_HUD);
          Renderer.addKillXpEffect(me.x, me.y - (me.radius || 30) - 30, gainXp);
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
    
    // Tối ưu hóa băng thông: Chỉ gửi Input (angle, rightMouseDown, isMoving) thay vì x, y
    if (forceUpdate || dAngle > CONFIG.ANGLE_SEND_THRESHOLD || rightMouseChanged || movingChanged) {
      this.ws.send(JSON.stringify({
        type: "move",
        angle: GameState.mouseAngle,
        rightMouseDown: GameState.rightMouseDown && GameState.clientXp > 0,
        isMoving: GameState.isMoving
      }));
      GameState.lastSentTime = Date.now();
      GameState.lastSentAngle = GameState.mouseAngle;
      GameState.lastRightMouse = GameState.rightMouseDown;
      GameState.lastMoving = GameState.isMoving;
    }
  },
};

// ===== INPUT =====
const Input = {
  setup() {
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    canvas.addEventListener("mousemove", (e) => {
      if (GameState.mouseMoveThrottled) return;
      GameState.mouseMoveThrottled = true;
      requestAnimationFrame(() => {
        GameState.mouseX = e.clientX;
        GameState.mouseY = e.clientY;
        GameState.lastDx = GameState.mouseX - canvas.width / 2;
        GameState.lastDy = GameState.mouseY - canvas.height / 2;
        GameState.isMoving = Math.hypot(GameState.lastDx, GameState.lastDy) > GameState.clientRadius;
        GameState.mouseAngle = Math.atan2(GameState.lastDy, GameState.lastDx);
        Network.sendPositionUpdate(); // Sẽ tự chặn nếu góc không thay đổi đủ lớn
        GameState.mouseMoveThrottled = false;
      });
    });
    canvas.addEventListener("mousedown", (e) => {
      if (e.button === 2 && GameState.clientXp > 0 && GameState.clientLevel >= 1) {
        GameState.rightMouseDown = true;
        Network.sendPositionUpdate(true);
      }
      if (e.button === 0) {
        const cooldown = 500 + (GameState.clientLevel - 1) * 60;
        if (!GameState.isAttacking && Date.now() - (GameState.lastAttackTime || 0) >= cooldown) {
          GameState.isAttacking = true;
          GameState.attackTime = Date.now();
          Network.ws.send(JSON.stringify({ type: "attack" }));
        }
      }
    });
    canvas.addEventListener("mouseup", (e) => {
      if (e.button === 2) {
        GameState.rightMouseDown = false;
        Network.sendPositionUpdate(true);
      }
    });
    window.addEventListener("resize", Renderer.resizeCanvas);
  }
};

// CHƯƠNG 14: Client-Side Prediction và Reconciliation
function updatePhysics() {
  if (GameState.clientX === null || GameState.clientY === null) return;
  
  const attackDuration = CONFIG.BASE_ATTACK_DURATION + (GameState.clientLevel * CONFIG.ATTACK_DURATION_PER_LEVEL);
  
  // 1. Client-Side Prediction: Tự dự đoán vị trí hiện tại dựa trên Input
  if (GameState.isAttacking && Date.now() - GameState.attackTime < attackDuration) {
    // Đứng im khi chém
  } else if (GameState.isMoving) {
    const speed = GameState.getSpeedByLevel(GameState.clientLevel) * (GameState.rightMouseDown && GameState.clientXp > 0 ? CONFIG.SPRINT_MULTIPLIER : 1);
    GameState.clientX += Math.cos(GameState.mouseAngle) * speed;
    GameState.clientY += Math.sin(GameState.mouseAngle) * speed;
  }
  
  GameState.clientX = Math.max(GameState.clientRadius, Math.min(CONFIG.MAP_WIDTH - GameState.clientRadius, GameState.clientX));
  GameState.clientY = Math.max(GameState.clientRadius, Math.min(CONFIG.MAP_HEIGHT - GameState.clientRadius, GameState.clientY));

  // 2. Reconciliation: Nhẹ nhàng kéo vị trí Client về khớp với Server để chống sai lệch mạng
  if (GameState.serverX != null && GameState.serverY != null) {
    const dist = Math.hypot(GameState.clientX - GameState.serverX, GameState.clientY - GameState.serverY);
    if (dist > 150) { 
      // Sai số lớn (Lag, hoặc Server giật mình) -> Dịch chuyển (Snap) ngay lập tức
      GameState.clientX = GameState.serverX;
      GameState.clientY = GameState.serverY;
    } else if (dist > 1) {
      // Sai số nhỏ -> Mượt mà trượt về đúng vị trí (Lerp 20% / Khung hình)
      GameState.clientX += (GameState.serverX - GameState.clientX) * 0.2;
      GameState.clientY += (GameState.serverY - GameState.clientY) * 0.2;
    }
  }

  if (GameState.isAttacking && Date.now() - GameState.attackTime > attackDuration) {
    GameState.isAttacking = false;
  }
}

function loop() {
  updatePhysics();
  Renderer.draw();
  requestAnimationFrame(loop);
}

function main() {
  Renderer.resizeCanvas();
  Resources.load();
  Renderer.setupUI();
  Network.connect();
  Input.setup();
  
  Camera.currentZoom = Camera.getZoomByLevel(1);
  Camera.targetZoom = Camera.currentZoom;
  
  requestAnimationFrame(loop);
  
  setInterval(() => {
    Renderer.updateUI();
    if (GameState.clientXp <= 0 && GameState.rightMouseDown) {
      GameState.rightMouseDown = false;
      Network.sendPositionUpdate(true);
    }
  }, CONFIG.UI_UPDATE_INTERVAL || 100);
}

main();
