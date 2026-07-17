// --- src/client/network.js ---
import { GameState } from './state.js';
import { Camera, FX, Renderer } from './renderer.js';
import { Sound } from './audio.js';

const CONFIG = window.GAME_CONFIG;

export const Network = {
  ws: null,
  
  connect() { 
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}`;
    this.ws = new WebSocket(wsUrl); 

    this.ws.onopen = () => { 
        document.getElementById("status-text").innerText = ""; 
        const playBtn = document.getElementById("play-btn");
        playBtn.innerText = "VÀO TRẬN"; 
        playBtn.disabled = false; 
    };

    this.ws.onclose = () => { 
        document.getElementById("status-text").innerText = "Mất kết nối với Server!"; 
        document.getElementById("play-btn").disabled = true; 
        const uiLayer = document.getElementById("ui-layer");
        uiLayer.style.display = "flex"; uiLayer.style.opacity = "1"; uiLayer.style.transform = "scale(1)"; 
    };

    this.ws.onmessage = this.onMessage.bind(this); 
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
      const uiLayer = document.getElementById("ui-layer");
      const playBtn = document.getElementById("play-btn");
      const statusText = document.getElementById("status-text");

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
          
          let left = Math.floor(CONFIG.RESPAWN_TIME / 1000); playBtn.innerText = `HỒI SINH: ${left}S`;
          const interval = setInterval(() => { 
            left--; 
            if (left <= 0) { 
              clearInterval(interval); playBtn.innerText = "VÀO TRẬN LẠI"; playBtn.disabled = false; statusText.innerText = ""; 
            } else { 
              playBtn.innerText = `HỒI SINH: ${left}S`; 
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
  }
};
