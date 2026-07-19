// --- src/client/network.js ---
import { GameState } from './state.js';
import { Camera, FX, Renderer } from './renderer.js';
import { Sound } from './audio.js';

const CONFIG = window.GAME_CONFIG;
let uiHideTimeout = null; 

let cachedUiLayer = null;
let cachedSpeakerIcon = undefined; 

export const Network = {
  ws: null,
  
  connect() { 
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}`;
    this.ws = new WebSocket(wsUrl); 

    this.ws.onopen = () => { document.getElementById("status-text").innerText = ""; const playBtn = document.getElementById("play-btn"); playBtn.innerText = "VÀO TRẬN"; playBtn.disabled = false; };
    this.ws.onclose = () => { document.getElementById("status-text").innerText = "Mất kết nối với Server!"; document.getElementById("play-btn").disabled = true; const uiLayer = document.getElementById("ui-layer"); uiLayer.style.display = "flex"; uiLayer.style.opacity = "1"; uiLayer.style.transform = "scale(1)"; };
    this.ws.onmessage = this.onMessage.bind(this); 
  },

  onMessage(msg) {
    const data = JSON.parse(msg.data);
    if (data.type === "init") {
      GameState.playerId = data.id;
      GameState.mapWidth = data.mapWidth || CONFIG.MAP_WIDTH; GameState.mapHeight = data.mapHeight || CONFIG.MAP_HEIGHT;
      GameState.clientX = GameState.serverX = data.x ?? GameState.mapWidth / 2;
      GameState.clientY = GameState.serverY = data.y ?? GameState.mapHeight / 2;
      GameState.food = data.food || []; GameState.magnetFoods = [];
    }
    
    if (data.type === "state") {
      GameState.stateBuffer.push({ time: Date.now(), players: data.players || [] });
      if (GameState.stateBuffer.length > 5) GameState.stateBuffer.shift();

      if (data.foodAdded && data.foodAdded.length > 0) GameState.food.push(...data.foodAdded);
      
      if (data.foodRemoved && data.foodRemoved.length > 0) { 
        const removedSet = new Set(data.foodRemoved); 
        GameState.food = GameState.food.filter(f => !removedSet.has(f.id)); 
      }

      if (data.hits && data.hits.length > 0) {
        for (const hit of data.hits) {
            Renderer.addDamageText(hit.x, hit.y, hit.amount); Renderer.addHitFlash(hit.victimId);
            if (hit.attackerId === GameState.playerId) { FX.spawnHitSparks(hit.x, hit.y); Camera.addShake(4); Sound.play('hit'); }
            if (hit.victimId === GameState.playerId) { Camera.addShake(12); Camera.screenFlash = 0.5; Camera.flashColor = "255, 50, 50"; Sound.play('hurt'); }
        }
      }

      // ==========================================
      // GIAO DIỆN KILL STREAK GỌN NHẸ (BẢN GỐC)
      // ==========================================
      if (data.announcements && data.announcements.length > 0) {
        for (const ann of data.announcements) {
          if (ann.type === "killstreak") {
            if (ann.streak === 2) Sound.play("doublekill");
            else if (ann.streak === 3) Sound.play("triplekill");
            else if (ann.streak === 5) Sound.play("quadkill");
            else if (ann.streak === 7) Sound.play("megakill");
            else if (ann.streak >= 10) Sound.play("legendary");

            const container = document.getElementById('streak-announcer-container');
            if (container) {
                const popup = document.createElement('div');
                popup.className = 'streak-popup';
                
                // GIỮ NGUYÊN BẢN GỐC: [Tên] ⚔ [Số mạng]
                popup.innerHTML = `
                    <span>${ann.name || "Khách"}</span>
                    <img src="img/sword-icon.png" style="height: 12px; width: 12px; object-fit: contain; margin-top: -1px;" alt="⚔️" onerror="this.outerHTML='⚔️'">
                    <span style="color: #ffcc00; font-weight: 900;">${ann.streak}</span>
                `;
                
                container.appendChild(popup);
                setTimeout(() => { if (popup.parentNode) popup.remove(); }, 3100);
            }
          }
        }
      }
      
      // ==========================================
      // FIX LỖI DELAY HIỂN THỊ GAME OVER
      // ==========================================
      const prevDead = GameState.isDead ?? true; 
      const me = (data.players || []).find((p) => p.id === GameState.playerId);
      // Nếu server không gửi data player (vì đã chết), tự động hiểu là Đã chết để mở form ngay
      const isCurrentlyDead = me ? me.isDead : true; 

      if (!cachedUiLayer) cachedUiLayer = document.getElementById("ui-layer");
      if (cachedSpeakerIcon === undefined) {
         cachedSpeakerIcon = document.getElementById("sound-btn") || document.getElementById("mute-btn") || document.querySelector("[class*='sound']") || document.querySelector("[id*='sound']") || null;
      }

      // 1. SỐNG LẠI (HỒI SINH)
      if (prevDead && !isCurrentlyDead) { 
        if (me) {
            GameState.clientX = GameState.serverX = me.x; 
            GameState.clientY = GameState.serverY = me.y; 
        }
        if (uiHideTimeout) clearTimeout(uiHideTimeout); 
        if (cachedUiLayer) {
            cachedUiLayer.style.opacity = "0"; 
            cachedUiLayer.style.transform = "scale(1.05)"; 
            uiHideTimeout = setTimeout(() => cachedUiLayer.style.display = "none", 400); 
        }
        if (cachedSpeakerIcon) cachedSpeakerIcon.style.display = "block";
      } 

      // 2. VỪA BỊ GIẾT -> HIỆN GAME OVER LẬP TỨC
      if (!prevDead && isCurrentlyDead) {
        if (uiHideTimeout) clearTimeout(uiHideTimeout); 
        if (cachedSpeakerIcon) cachedSpeakerIcon.style.display = "none";
        
        let finalKillerName = "MỘT KẺ VÔ DANH";
        if (me) {
            const killer = (data.players || []).find(k => k.id === me.killerId);
            if (killer) finalKillerName = killer.name || "MỘT KẺ VÔ DANH";
        }

        if (window.showGameOver) {
            window.showGameOver(GameState.clientLevel, 0, GameState.clientXp, finalKillerName);
        }
      }

      // 3. CẬP NHẬT CHỈ SỐ NHÂN VẬT NẾU CÒN SỐNG
      if (me) {
        const oldLevel = GameState.clientLevel;
        GameState.clientLevel = me.level || 1; GameState.clientXp = me.xp || 0; 
        GameState.clientXpToNext = me.xpToNext || GameState.getXpToNext(GameState.clientLevel); GameState.clientRadius = GameState.getRadiusByLevel(GameState.clientLevel);
        
        if (GameState.clientLevel > oldLevel) { Sound.play('levelUp'); Camera.screenFlash = 1.0; Camera.flashColor = "255, 255, 255"; } 
        if (oldLevel !== GameState.clientLevel) Camera.targetZoom = Camera.getZoomByLevel(GameState.clientLevel);

        if (!me.isDead) {
            GameState.serverX = me.x; GameState.serverY = me.y;
        }
      }
      
      GameState.isDead = isCurrentlyDead; GameState.lastAttackTime = me?.lastAttackTime || GameState.lastAttackTime;

      if (prevDead && isCurrentlyDead && cachedSpeakerIcon && cachedUiLayer && cachedUiLayer.style.display !== "none") {
          cachedSpeakerIcon.style.display = "none";
      }

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
            Renderer.addFloatingText(p.x, p.y - 12, `+${xpGained} XP`, "#00ff66", 14); Renderer.addFloatingText(p.x, p.y + 12, "KILL!", "#ff3333", 16);        
            Sound.play('kill'); GameState.freezeUntil = Date.now() + 40; Camera.addShake(15); FX.spawnHitSparks(p.x, p.y);
          }
        }
        if (p.id === GameState.playerId) { 
          const prevLevel = GameState.prevPlayerLevels[p.id]; 
          if (prevLevel && p.level > prevLevel && !p.isDead) { Renderer.addLevelUpEffect(p.x, p.y, p.radius); Renderer.addFloatingText(p.x, p.y - p.radius - 20, "LEVEL UP!", "#00ffff", 18); }
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
    const rightMouseChanged = GameState.rightMouseDown !== GameState.lastRightMouse; const movingChanged = GameState.isMoving !== GameState.lastMoving;
    
    if (forceUpdate || dAngle > CONFIG.ANGLE_SEND_THRESHOLD || rightMouseChanged || movingChanged) {
      this.ws.send(JSON.stringify({ type: "move", angle: GameState.mouseAngle, rightMouseDown: GameState.rightMouseDown && GameState.clientXp > 0, is moving: GameState.isMoving }));
      GameState.lastSentTime = Date.now(); GameState.lastSentAngle = GameState.mouseAngle; GameState.lastRightMouse = GameState.rightMouseDown; GameState.lastMoving = GameState.isMoving;
    }
  }
};
