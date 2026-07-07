// --- src/client/main.js ---
import { GameState } from './state.js';
import { Camera, Resources, Renderer } from './renderer.js';

const CONFIG = window.GAME_CONFIG;

// Tự động nhận diện giao thức (http/https)
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
      GameState.targetX = GameState.clientX;
      GameState.targetY = GameState.clientY;
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
        if (prevDead && !me.isDead) {
          GameState.clientX = GameState.targetX = me.x;
          GameState.clientY = GameState.targetY = me.y;
          GameState.velocityX = GameState.velocityY = 0;
        }
      }
      
      GameState.isDead = me?.isDead || false;
      GameState.lastAttackTime = me?.lastAttackTime || GameState.lastAttackTime;

      const now = Date.now();
      for (const p of data.players || []) {
        if (p.id !== GameState.playerId && p.isDead && !GameState.prevPlayerDeadState[p.id] && p.killerId === GameState.playerId) {
          const gainXp = Math.floor((p.score || 0) * CONFIG.KILL_SCORE_MULTIPLIER_HUD);
          Renderer.addKillXpEffect(me.x, me.y - (me.radius || 30) - 30, gainXp);
        }
        GameState.prevPlayerDeadState[p.id] = p.isDead;
      }
    }
    if (data.type === "lose_xp") {
      const me = (data.players || []).find((p) => p.id === GameState.playerId);
      if (me) {
        me.xp -= data.amount || 5;
        if (me.xp <= 0) {
          GameState.lastAttackTime = 0;
          GameState.isAttacking = false;
          GameState.rightMouseDown = false;
          Network.sendPositionUpdate(true);
        }
      }
    }
  },
  sendPositionUpdate(forceSendAngle = false) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const me = (GameState.stateBuffer[GameState.stateBuffer.length - 1]?.players || []).find((p) => p.id === GameState.playerId);
    
    if (me && me.isDead) return;
    if (!forceSendAngle && Date.now() - GameState.lastSentTime < CONFIG.CLIENT_SEND_INTERVAL) return;
    
    const dx = Math.abs(GameState.clientX - GameState.lastSentX);
    const dy = Math.abs(GameState.clientY - GameState.lastSentY);
    const dAngle = Math.abs(GameState.mouseAngle - GameState.lastSentAngle);
    
    if (dx > 1 || dy > 1 || forceSendAngle || dAngle > CONFIG.ANGLE_SEND_THRESHOLD) {
      this.ws.send(JSON.stringify({
        type: "move",
        x: GameState.clientX,
        y: GameState.clientY,
        rightMouseDown: GameState.rightMouseDown && GameState.clientXp > 0,
        angle: GameState.mouseAngle,
      }));
      GameState.lastSentX = GameState.clientX;
      GameState.lastSentY = GameState.clientY;
      GameState.lastSentTime = Date.now();
      GameState.lastSentAngle = GameState.mouseAngle;
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
        Network.sendPositionUpdate(true);
        GameState.mouseMoveThrottled = false;
      });
    });
    canvas.addEventListener("mousedown", (e) => {
      if (e.button === 2 && GameState.clientXp > 0 && GameState.clientLevel >= 1) {
        GameState.rightMouseDown = true;
        if (!GameState.loseXpInterval) {
          GameState.loseXpInterval = setInterval(() => {
            const amount = Math.floor(GameState.clientXpToNext * CONFIG.XP_LOSS_PERCENT);
            Network.ws.send(JSON.stringify({ type: "lose_xp", amount }));
          }, CONFIG.XP_LOSS_INTERVAL);
        }
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
        if (GameState.loseXpInterval) { clearInterval(GameState.loseXpInterval); GameState.loseXpInterval = null; }
      }
    });
    window.addEventListener("resize", Renderer.resizeCanvas);
  }
};

// ===== UPDATE PHYSICS =====
function updatePhysics() {
  if (GameState.clientX === null || GameState.clientY === null) return;
  
  if (GameState.targetX !== null && GameState.targetY !== null) {
    if (GameState.isAttacking) {
      GameState.targetX = GameState.clientX;
      GameState.targetY = GameState.clientY;
      GameState.velocityX = 0;
      GameState.velocityY = 0;
    } else if (GameState.isMoving) {
      const speed = GameState.getSpeedByLevel(GameState.clientLevel) * (GameState.rightMouseDown ? CONFIG.SPRINT_MULTIPLIER : 1);
      const length = Math.hypot(GameState.lastDx, GameState.lastDy);
      if (length > 0) {
        GameState.targetX = GameState.clientX + (GameState.lastDx / length) * speed;
        GameState.targetY = GameState.clientY + (GameState.lastDy / length) * speed;
      }
    } else {
      const latestState = GameState.stateBuffer[GameState.stateBuffer.length - 1];
      const me = latestState?.players.find((p) => p.id === GameState.playerId);
      if (me) {
        GameState.clientX = GameState.targetX = me.x;
        GameState.clientY = GameState.targetY = me.y;
        GameState.velocityX = GameState.velocityY = 0;
      }
    }
    
    GameState.velocityX += (GameState.targetX - GameState.clientX) * CONFIG.SMOOTHING_FACTOR;
    GameState.velocityY += (GameState.targetY - GameState.clientY) * CONFIG.SMOOTHING_FACTOR;
    GameState.velocityX *= 0.85;
    GameState.velocityY *= 0.85;
    
    if (Math.abs(GameState.velocityX) < CONFIG.MIN_VELOCITY && Math.abs(GameState.velocityY) < CONFIG.MIN_VELOCITY) {
      GameState.velocityX = GameState.velocityY = 0;
    }
    
    GameState.clientX += GameState.velocityX;
    GameState.clientY += GameState.velocityY;
    
    // Chặn biên bản đồ
    GameState.clientX = Math.max(GameState.clientRadius, Math.min(CONFIG.MAP_WIDTH - GameState.clientRadius, GameState.clientX));
    GameState.clientY = Math.max(GameState.clientRadius, Math.min(CONFIG.MAP_HEIGHT - GameState.clientRadius, GameState.clientY));
  }

  // Quản lý Animation chém
  const attackDuration = CONFIG.BASE_ATTACK_DURATION + (GameState.clientLevel * CONFIG.ATTACK_DURATION_PER_LEVEL);
  if (GameState.isAttacking && Date.now() - GameState.attackTime > attackDuration) {
    GameState.isAttacking = false;
  }
}

// ===== MAIN GAME LOOP =====
function loop() {
  updatePhysics();
  if (!GameState.isAttacking) Network.sendPositionUpdate();
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
      if (GameState.loseXpInterval) { clearInterval(GameState.loseXpInterval); GameState.loseXpInterval = null; }
    }
  }, CONFIG.UI_UPDATE_INTERVAL || 100);
}

main();
