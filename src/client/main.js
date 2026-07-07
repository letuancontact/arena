const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// Tự động nhận diện giao thức (http/https) và chuyển thành ws/wss
const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
const wsUrl = `${protocol}//${window.location.host}`;

// ===== CONFIG =====
const CONFIG = {
  WEBSOCKET_URL: wsUrl,
  MAP_WIDTH: 3000,
  MAP_HEIGHT: 2000,
  BUFFER_DELAY: 50,
  SEND_INTERVAL: 50,
  ANGLE_SEND_THRESHOLD: 0.05,
  ZOOM_SMOOTHING: 0.05,
  SMOOTHING_FACTOR: 0.15,
  MIN_VELOCITY: 0.1,
  ANGLE_LERP: 0.25,
  TOTAL_FOOD_TYPES: 12,
  XP_LOSS_PERCENT: 0.025,
  XP_LOSS_INTERVAL: 200,
  UI_UPDATE_INTERVAL: 100,
  MIN_SPEED: 2.2,
  MAX_SPEED: 4,
  MAX_LEVEL: 40,
  RADIUS_TABLE: [
    20,
    30,
    35,
    36,
    35,
    36,
    38,
    44,
    39,
    41, // 1-10
    42,
    44,
    44.5,
    43,
    43.5,
    46,
    47,
    58,
    49,
    52, // 11-20
    60,
    58,
    58,
    72,
    77,
    60,
    64,
    68,
    70,
    72, // 21-30
    76,
    66,
    68,
    69,
    70,
    77,
    68,
    83,
    74,
    76, // 31-40
  ],
};

const ATTACK_DURATION = 360; // ms
const ATTACK_SWING = Math.PI; // Góc vung tối đa (90 độ)

// ===== RESOURCES =====
const Resources = {
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
    for (let i = 0; i < CONFIG.TOTAL_FOOD_TYPES; i++) {
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

// ===== GAME STATE =====
const GameState = {
  playerId: null,
  players: {},
  food: [],
  mapWidth: CONFIG.MAP_WIDTH,
  mapHeight: CONFIG.MAP_HEIGHT,
  clientX: null,
  clientY: null,
  clientRadius: 20,
  clientLevel: 1,
  clientXp: 0,
  clientXpToNext: 100,
  targetX: null,
  targetY: null,
  velocityX: 0,
  velocityY: 0,
  lastDx: 0,
  lastDy: 0,
  isMoving: false,
  rightMouseDown: false,
  lastSentX: 0,
  lastSentY: 0,
  lastSentTime: 0,
  lastSentAngle: 0,
  stateBuffer: [],
  prevPositions: {},
  prevAngles: {},
  mouseX: 0,
  mouseY: 0,
  mouseMoveThrottled: false,
  loseXpInterval: null,
  isAttacking: false,
  attackTime: 0,
  lastAttackTime: 0,
  getXpToNext(level) {
    return Math.floor(100 * Math.pow(1.2, level - 1));
  },
  getRadiusByLevel(level) {
    return CONFIG.RADIUS_TABLE[
      Math.max(0, Math.min(CONFIG.RADIUS_TABLE.length - 1, level - 1))
    ];
  },
  getSpeedByLevel(level) {
    const t = (level - 1) / (CONFIG.MAX_LEVEL - 1);
    return (
      CONFIG.MAX_SPEED - (CONFIG.MAX_SPEED - CONFIG.MIN_SPEED) * Math.sqrt(t)
    );
  },
};

// ===== CAMERA =====
const Camera = {
  currentZoom: 1.0,
  targetZoom: 1.0,
  getZoomByLevel(level) {
    const baseZoom = 1.0,
      minZoom = 0.3;
    const zoomReductions = [
      0.008, 0.001, 0.002, 0.003, 0.004, 0.015, 0.01, 0.004, 0.002, 0.003,
      0.008, 0.002, 0.002, 0.003, 0.002, 0.006, 0.002, 0.002, 0.002, 0.002,
      0.008, 0.003, 0.008, 0.006, 0.004, 0.006, 0.006, 0.008, 0.007, 0.006,
      0.008, 0.009, 0.006, 0.004, 0.002, 0.001, 0.001, 0.001, 0.001, 0.001,
    ];
    let zoom = baseZoom;
    for (let i = 0; i < level - 1; i++) {
      const reduction = zoomReductions[i] || 0;
      zoom -= reduction;
      if (zoom < minZoom) {
        zoom = minZoom;
        break;
      }
    }
    return zoom;
  },
  updateZoom() {
    if (Math.abs(this.currentZoom - this.targetZoom) > 0.001) {
      this.currentZoom +=
        (this.targetZoom - this.currentZoom) * CONFIG.ZOOM_SMOOTHING;
    } else {
      this.currentZoom = this.targetZoom;
    }
  },
};

// ===== NETWORK =====
const Network = {
  ws: null,
  connect() {
    this.ws = new WebSocket(CONFIG.WEBSOCKET_URL);
    this.ws.onmessage = this.onMessage;
  },
  onMessage(msg) {
    const data = JSON.parse(msg.data);
    if (data.type === "init") {
      GameState.playerId = data.id;
      if (data.mapWidth) GameState.mapWidth = data.mapWidth;
      if (data.mapHeight) GameState.mapHeight = data.mapHeight;
      GameState.clientX = data.x ?? GameState.mapWidth / 2;
      GameState.clientY = data.y ?? GameState.mapHeight / 2;
      GameState.targetX = GameState.clientX;
      GameState.targetY = GameState.clientY;
    }
    if (data.type === "state") {
      GameState.stateBuffer.push({
        time: Date.now(),
        food: data.food ? data.food.map((f) => ({ ...f })) : [],
        players: (data.players || []).map((p) => ({
          ...p,
          isAttacking: p.isAttacking,
          attackTime: p.attackTime,
        })),
      });
      if (GameState.stateBuffer.length > 5) GameState.stateBuffer.shift();
      const prevDead = GameState.isDead;
      const me = (data.players || []).find((p) => p.id === GameState.playerId);
      if (me) {
        const oldLevel = GameState.clientLevel;
        GameState.clientLevel = me.level || 1;
        GameState.clientXp = me.xp || 0;
        GameState.clientXpToNext =
          me.xpToNext || GameState.getXpToNext(GameState.clientLevel);
        GameState.clientRadius = GameState.getRadiusByLevel(
          GameState.clientLevel
        );
        if (oldLevel !== GameState.clientLevel) {
          Camera.targetZoom = Camera.getZoomByLevel(GameState.clientLevel);
        }
        // Kiểm tra vừa hồi sinh
        if (prevDead && !me.isDead) {
          GameState.clientX = me.x;
          GameState.clientY = me.y;
          GameState.targetX = me.x;
          GameState.targetY = me.y;
          GameState.velocityX = 0;
          GameState.velocityY = 0;
        }
      }
      GameState.isDead = me?.isDead || false;
      // Khi nhận state từ server, lưu lastAttackTime cho GameState
      GameState.lastAttackTime =
        (data.players || []).find((p) => p.id === GameState.playerId)
          ?.lastAttackTime || GameState.lastAttackTime;

      // Hiệu ứng +XP khi giết đối thủ
      const now = Date.now();
      for (const p of data.players || []) {
        // Kiểm tra đối thủ vừa chết (isDead chuyển từ false -> true)
        if (
          p.id !== GameState.playerId &&
          p.isDead &&
          !prevPlayerDeadState[p.id] &&
          p.killerId === GameState.playerId
        ) {
          // Hiển thị hiệu ứng +XP thưởng là score (60% score của đối thủ)
          const gainXp = Math.floor((p.score || 0) * 0.6);
          pendingKillXpEffects.push({
            x: me.x,
            y: me.y - (me.radius || 30) - 30,
            amount: gainXp,
            start: now,
          });
        }
        prevPlayerDeadState[p.id] = p.isDead;
      }
      prevXp = me.xp;
    }
    if (data.type === "lose_xp") {
      const me = (data.players || []).find((p) => p.id === GameState.playerId);
      if (me) {
        me.xp -= data.amount || 5;
        me.score -= data.amount || 5; // Trừ luôn vào score tổng
        if (me.score < 0) me.score = 0;
        // Các xử lý giảm level như cũ
        if (me.xp <= 0) {
          me.isDead = true;
          me.deadTime = Date.now();
          GameState.lastAttackTime = 0; // Reset cooldown khi chết
          GameState.isAttacking = false;
          GameState.attackTime = 0;
          GameState.velocityX = 0;
          GameState.velocityY = 0;
          GameState.targetX = me.x;
          GameState.targetY = me.y;
          GameState.clientX = me.x;
          GameState.clientY = me.y;
          GameState.isMoving = false;
          GameState.rightMouseDown = false;
          GameState.lastSentX = me.x;
          GameState.lastSentY = me.y;
          GameState.lastSentTime = Date.now();
          GameState.lastSentAngle = Input.getMouseAngleToCenter(
            GameState.mouseX,
            GameState.mouseY
          );
          Network.sendPositionUpdate(true);
        }
      }
    }
  },
  sendPositionUpdate(forceSendAngle = false) {
    // Chặn gửi dữ liệu nếu WebSocket chưa mở
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const now = Date.now();
    const me = (
      GameState.stateBuffer[GameState.stateBuffer.length - 1]?.players || []
    ).find((p) => p.id === GameState.playerId);
    if (me && me.isDead) return;
    if (!forceSendAngle && now - GameState.lastSentTime < CONFIG.SEND_INTERVAL)
      return;
    const dx = Math.abs(GameState.clientX - GameState.lastSentX);
    const dy = Math.abs(GameState.clientY - GameState.lastSentY);
    const angle = Input.getMouseAngleToCenter(
      GameState.mouseX,
      GameState.mouseY
    );
    const dAngle = Math.abs(angle - GameState.lastSentAngle);
    if (
      dx > 1 ||
      dy > 1 ||
      forceSendAngle ||
      dAngle > CONFIG.ANGLE_SEND_THRESHOLD
    ) {
      this.ws.send(
        JSON.stringify({
          type: "move",
          x: GameState.clientX,
          y: GameState.clientY,
          rightMouseDown: GameState.rightMouseDown && GameState.clientXp > 0,
          angle,
        })
      );
      GameState.lastSentX = GameState.clientX;
      GameState.lastSentY = GameState.clientY;
      GameState.lastSentTime = now;
      GameState.lastSentAngle = angle;
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
        const dx = GameState.mouseX - canvas.width / 2;
        const dy = GameState.mouseY - canvas.height / 2;
        GameState.lastDx = dx;
        GameState.lastDy = dy;
        GameState.isMoving = Math.hypot(dx, dy) > GameState.clientRadius;
        // Luôn gửi angle mới nhất lên server
        Network.sendPositionUpdate(true);
        GameState.mouseMoveThrottled = false;
      });
    });
    canvas.addEventListener("mousedown", (e) => {
      if (e.button === 2) {
        if (GameState.clientXp > 0 && GameState.clientLevel >= 1) {
          GameState.rightMouseDown = true;
          if (!GameState.loseXpInterval) {
            GameState.loseXpInterval = setInterval(() => {
              const amount = Math.floor(
                GameState.clientXpToNext * CONFIG.XP_LOSS_PERCENT
              );
              Network.ws.send(JSON.stringify({ type: "lose_xp", amount }));
            }, CONFIG.XP_LOSS_INTERVAL);
          }
        }
      }
      if (e.button === 0) {
        // Chuột trái
        const now = Date.now();
        const level = GameState.clientLevel || 1;
        const ATTACK_COOLDOWN = getAttackCooldown(level);
        const lastAttack = GameState.lastAttackTime || 0;
        if (!GameState.isAttacking && now - lastAttack >= ATTACK_COOLDOWN) {
          GameState.isAttacking = true;
          GameState.attackTime = now;
          // Gửi tín hiệu attack lên server
          Network.ws.send(JSON.stringify({ type: "attack" }));
        }
      }
    });
    canvas.addEventListener("mouseup", (e) => {
      if (e.button === 2) {
        GameState.rightMouseDown = false;
        if (GameState.loseXpInterval) {
          clearInterval(GameState.loseXpInterval);
          GameState.loseXpInterval = null;
        }
      }
    });
    window.addEventListener("resize", Renderer.resizeCanvas);
  },
  getMouseAngleToCenter(mouseX, mouseY) {
    const dx = mouseX - canvas.width / 2;
    const dy = mouseY - canvas.height / 2;
    return Math.atan2(dy, dx);
  },
};

// ===== RENDERER =====
const Renderer = {
  leaderboardDiv: null,
  xpBar: null,
  xpFill: null,
  fillImage: null,
  levelCircle: null,
  minimap: null,
  minimapCtx: null,
  setupUI() {
    // XP Bar
    this.xpBar = document.createElement("div");
    this.xpBar.style.cssText = `bottom:10px;left:50%;transform:translateX(-50%);width:300px;height:40px;background:url(img/xpbar.png) no-repeat center center;background-size:cover;z-index:1000;overflow:hidden;position:fixed;`;
    document.body.appendChild(this.xpBar);
    this.xpFill = document.createElement("div");
    this.xpFill.style.cssText = `position:absolute;bottom:12px;left:76px;width:215px;height:16px;overflow:hidden;`;
    this.xpBar.appendChild(this.xpFill);
    this.fillImage = document.createElement("div");
    this.fillImage.style.cssText = `position:relative;left:-215px;width:215px;height:100%;background:url(img/progressxp.png) no-repeat left center;background-size:contain;transition:left 0.1s linear;`;
    this.xpFill.appendChild(this.fillImage);
    // Level circle
    this.levelCircle = document.createElement("div");
    this.levelCircle.style.cssText = `position:fixed;bottom:22px;left:calc(50% - 142px);width:20px;height:20px;color:white;font-family:Arial;font-size:16px;font-weight:800;display:flex;align-items:center;justify-content:center;z-index:1001;pointer-events:none;`;
    this.levelCircle.textContent = GameState.clientLevel;
    document.body.appendChild(this.levelCircle);
    // Leaderboard
    this.leaderboardDiv =
      document.getElementById("leaderboard") || document.createElement("div");
    this.leaderboardDiv.id = "leaderboard";
    this.leaderboardDiv.style.cssText = `position:fixed;top:20px;left:20px;background:rgba(30,30,30,0.85);color:#f0f0f0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;font-size:14px;line-height:1.6;border-radius:10px;padding:14px 20px;z-index:1002;min-width:180px;box-shadow:0 4px 12px rgba(0,0,0,0.6);pointer-events:none;backdrop-filter:blur(4px);border:1px solid rgba(255,255,255,0.08);`;
    document.body.appendChild(this.leaderboardDiv);
    // Minimap
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
    if (
      !Resources.offscreenCanvas ||
      Resources.offscreenCanvas.width !== GameState.mapWidth ||
      Resources.offscreenCanvas.height !== GameState.mapHeight
    ) {
      Resources.offscreenCanvas = document.createElement("canvas");
      Resources.offscreenCanvas.width = GameState.mapWidth;
      Resources.offscreenCanvas.height = GameState.mapHeight;
      Resources.offscreenCtx = Resources.offscreenCanvas.getContext("2d");
    }
    if (
      Resources.mapPatternReady &&
      Resources.mapBgImg.complete &&
      Resources.mapBgImg.naturalHeight !== 0
    ) {
      Resources.offscreenCtx.save();
      Resources.offscreenCtx.imageSmoothingEnabled = false;
      Resources.offscreenCtx.fillStyle = Resources.mapPattern;
      Resources.offscreenCtx.fillRect(
        0,
        0,
        GameState.mapWidth,
        GameState.mapHeight
      );
      Resources.offscreenCtx.restore();
    } else {
      Resources.offscreenCtx.fillStyle = "#000";
      Resources.offscreenCtx.fillRect(
        0,
        0,
        GameState.mapWidth,
        GameState.mapHeight
      );
    }
  },
  updateUI() {
    // XP bar
    const percent = Math.min(1, GameState.clientXp / GameState.clientXpToNext);
    const maxShift = 215;
    this.fillImage.style.left = -maxShift + percent * maxShift + "px";
    this.levelCircle.textContent = GameState.clientLevel;
    // Minimap
    this.minimapCtx.clearRect(0, 0, this.minimap.width, this.minimap.height);
    this.minimapCtx.strokeStyle = "#aaa";
    this.minimapCtx.lineWidth = 2;
    this.minimapCtx.strokeRect(
      8,
      8,
      this.minimap.width - 16,
      this.minimap.height - 16
    );
    const allPlayersArr =
      GameState.stateBuffer[GameState.stateBuffer.length - 1]?.players || [];
    let top1 = null;
    if (allPlayersArr.length > 0) {
      top1 = allPlayersArr.slice().sort((a, b) => {
        if (b.level !== a.level) return b.level - a.level;
        return (b.score || 0) - (a.score || 0);
      })[0];
    }
    if (top1) {
      const px = 8 + (top1.x / GameState.mapWidth) * (this.minimap.width - 16);
      const py =
        8 + (top1.y / GameState.mapHeight) * (this.minimap.height - 16);
      this.minimapCtx.beginPath();
      this.minimapCtx.arc(px, py, 5, 0, Math.PI * 2);
      this.minimapCtx.fillStyle = "#ff3333";
      this.minimapCtx.fill();
      if (Resources.kingImg.complete && Resources.kingImg.naturalHeight !== 0) {
        const crownWidth = 18;
        const crownHeight =
          crownWidth *
          (Resources.kingImg.naturalHeight / Resources.kingImg.naturalWidth);
        this.minimapCtx.drawImage(
          Resources.kingImg,
          px - crownWidth / 2,
          py - 4 - crownHeight,
          crownWidth,
          crownHeight
        );
      }
    }
    const me = allPlayersArr.find((p) => p.id === GameState.playerId);
    if (me && !me.isDead) {
      const px = 8 + (me.x / GameState.mapWidth) * (this.minimap.width - 16);
      const py = 8 + (me.y / GameState.mapHeight) * (this.minimap.height - 16);
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
      this.leaderboardDiv.innerHTML =
        "<b>TOP PLAYERS</b><br/><i>No players</i>";
      return;
    }
    const sorted = [...playersArr].sort((a, b) => {
      if (b.level !== a.level) return b.level - a.level;
      return (b.score || 0) - (a.score || 0);
    });
    let html = `<div style="font-weight:bold;font-size:16px;color:#00ffff;margin-bottom:6px;">★ TOP PLAYERS ★</div>`;
    sorted.slice(0, 8).forEach((p, i) => {
      html += `<div style="margin:2px 0;"><span style="color:#aaa;">${
        i + 1
      }.</span><span style="color:${
        p.id === GameState.playerId ? "#ff0" : "#fff"
      };font-weight:bold;">${
        p.name || "???"
      }</span><span style="color:#0ff;">Lv${
        p.level
      }</span><span style="float:right;color:#f88;"><b>${
        p.score || 0
      }</b></span></div>`;
    });
    this.leaderboardDiv.innerHTML = html;
  },
  getScaledImageSize(img, targetSize) {
    if (!img.complete || img.naturalWidth === 0 || img.naturalHeight === 0)
      return { width: targetSize, height: targetSize };
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
  lerp(a, b, t) {
    return a + (b - a) * t;
  },
  lerpObj(a, b, t) {
    return { ...b, x: this.lerp(a.x, b.x, t), y: this.lerp(a.y, b.y, t) };
  },
  lerpAngle(a, b, t) {
    let diff = b - a;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    return a + diff * t;
  },
  getMoveAngle(id, curr, prev) {
    if (!prev) return 0;
    const dx = curr.x - prev.x,
      dy = curr.y - prev.y;
    if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01)
      return GameState.prevAngles[id] ?? 0;
    return Math.atan2(dy, dx);
  },
  getInterpolatedState() {
    const renderTime = Date.now() - CONFIG.BUFFER_DELAY;
    let older, newer;
    for (let i = GameState.stateBuffer.length - 1; i >= 0; i--) {
      if (GameState.stateBuffer[i].time <= renderTime) {
        older = GameState.stateBuffer[i];
        newer = GameState.stateBuffer[i + 1] || GameState.stateBuffer[i];
        break;
      }
    }
    if (!older)
      older = newer = GameState.stateBuffer[0] || { food: [], players: [] };
    let t = 0;
    if (older !== newer && newer.time !== older.time) {
      t = (renderTime - older.time) / (newer.time - older.time);
      t = Math.max(0, Math.min(1, t));
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
          const vx = (p.x - prev.x) / dt,
            vy = (p.y - prev.y) / dt;
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
      const baseRatio = 2.75,
        growPerLevel = 0.04;
      const weaponSize = radius * (baseRatio + growPerLevel * (level - 1));
      const weaponHeadOffset = weaponSize * 0.4;

      // Tính toán góc swing
      let swing = 0;
      if (isAttacking && attackTime > 0) {
        const now = Date.now();
        const t = Math.min(1, (now - attackTime) / ATTACK_DURATION);
        swing =
          Math.sin(t * Math.PI) *
          (level < 37 ? ATTACK_SWING : ATTACK_SWING * 0.68);
      }

      // Tay trái
      let leftWeaponAngle = angle - Math.PI * 0.7 + swing;
      const leftStartX = x + Math.cos(leftWeaponAngle) * radius;
      const leftStartY = y + Math.sin(leftWeaponAngle) * radius;
      const leftDx = Math.cos(leftWeaponAngle) * weaponHeadOffset;
      const leftDy = Math.sin(leftWeaponAngle) * weaponHeadOffset;

      this.drawImageWithAspectRatio(
        weaponImg,
        leftStartX + leftDx,
        leftStartY + leftDy,
        weaponSize * (level >= 37 ? 1.1 : 1),
        leftWeaponAngle - Math.PI / 7.5
      );

      // Tay phải nếu level >= 37
      if (level >= 37) {
        let rightWeaponAngle = angle + Math.PI * 0.7 - swing;
        const rightStartX = x + Math.cos(rightWeaponAngle) * radius;
        const rightStartY = y + Math.sin(rightWeaponAngle) * radius;
        const rightDx = Math.cos(rightWeaponAngle) * weaponHeadOffset;
        const rightDy = Math.sin(rightWeaponAngle) * weaponHeadOffset;

        const drawX = rightStartX + rightDx;
        const drawY = rightStartY + rightDy;
        const aspect = weaponImg.naturalWidth / weaponImg.naturalHeight;
        const drawWidth = weaponSize,
          drawHeight = weaponSize / aspect;

        ctx.save();
        ctx.translate(drawX, drawY);
        ctx.rotate(rightWeaponAngle + Math.PI + Math.PI / 7.5);
        ctx.scale(-1, 1);
        ctx.drawImage(
          weaponImg,
          -drawWidth / 2,
          -drawHeight / 2,
          drawWidth,
          drawHeight
        );
        ctx.restore();
      }
    }
  },
  draw() {
    if (GameState.clientX === null || GameState.clientY === null) {
      requestAnimationFrame(() => this.draw());
      return;
    }
    // Smooth movement
    if (GameState.targetX !== null && GameState.targetY !== null) {
      if (GameState.isAttacking) {
        // Đang chém: đứng im, không cập nhật vị trí
        GameState.targetX = GameState.clientX;
        GameState.targetY = GameState.clientY;
        GameState.velocityX = 0;
        GameState.velocityY = 0;
      } else if (GameState.isMoving) {
        const speed =
          GameState.getSpeedByLevel(GameState.clientLevel) *
          (GameState.rightMouseDown ? 2 : 1);
        const length = Math.hypot(GameState.lastDx, GameState.lastDy);
        if (length > 0) {
          const normalizedDx = GameState.lastDx / length;
          const normalizedDy = GameState.lastDy / length;
          GameState.targetX = GameState.clientX + normalizedDx * speed;
          GameState.targetY = GameState.clientY + normalizedDy * speed;
          GameState.targetX = Math.max(
            GameState.clientRadius,
            Math.min(
              GameState.mapWidth - GameState.clientRadius,
              GameState.targetX
            )
          );
          GameState.targetY = Math.max(
            GameState.clientRadius,
            Math.min(
              GameState.mapHeight - GameState.clientRadius,
              GameState.targetY
            )
          );
        }
      } else {
        const latestState =
          GameState.stateBuffer[GameState.stateBuffer.length - 1];
        if (latestState) {
          const me = latestState.players.find(
            (p) => p.id === GameState.playerId
          );
          if (me) {
            GameState.clientX = me.x;
            GameState.clientY = me.y;
            GameState.targetX = me.x;
            GameState.targetY = me.y;
            GameState.velocityX = 0;
            GameState.velocityY = 0;
          }
        }
      }
      const dx = GameState.targetX - GameState.clientX;
      const dy = GameState.targetY - GameState.clientY;
      GameState.velocityX += dx * CONFIG.SMOOTHING_FACTOR;
      GameState.velocityY += dy * CONFIG.SMOOTHING_FACTOR;
      GameState.velocityX *= 0.85;
      GameState.velocityY *= 0.85;
      GameState.clientX += GameState.velocityX;
      GameState.clientY += GameState.velocityY;
      if (
        Math.abs(GameState.velocityX) < CONFIG.MIN_VELOCITY &&
        Math.abs(GameState.velocityY) < CONFIG.MIN_VELOCITY
      ) {
        GameState.velocityX = 0;
        GameState.velocityY = 0;
      }
      GameState.clientX = Math.max(
        GameState.clientRadius,
        Math.min(GameState.mapWidth - GameState.clientRadius, GameState.clientX)
      );
      GameState.clientY = Math.max(
        GameState.clientRadius,
        Math.min(
          GameState.mapHeight - GameState.clientRadius,
          GameState.clientY
        )
      );
    }
    Camera.updateZoom();
    // Chặn gửi lệnh di chuyển khi đang chém
    if (!GameState.isAttacking) {
      Network.sendPositionUpdate();
    }
    // Draw
    const centerX = canvas.width / 2,
      centerY = canvas.height / 2;
    const offsetX = centerX - GameState.clientX * Camera.currentZoom;
    const offsetY = centerY - GameState.clientY * Camera.currentZoom;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(Camera.currentZoom, Camera.currentZoom);
    ctx.translate(offsetX / Camera.currentZoom, offsetY / Camera.currentZoom);
    // Background
    if (Resources.offscreenCanvas) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, GameState.mapWidth, GameState.mapHeight);
      ctx.clip();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(Resources.offscreenCanvas, 0, 0);
      ctx.restore();
    } else {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, GameState.mapWidth, GameState.mapHeight);
    }
    ctx.strokeStyle = "#222";
    ctx.lineWidth = 8 / Camera.currentZoom;
    ctx.strokeRect(0, 0, GameState.mapWidth, GameState.mapHeight);
    // Interpolated state
    const { interpFood, interpPlayers } = this.getInterpolatedState();
    const margin = 100 / Camera.currentZoom;
    const viewportLeft =
      GameState.clientX - canvas.width / (2 * Camera.currentZoom) - margin;
    const viewportRight =
      GameState.clientX + canvas.width / (2 * Camera.currentZoom) + margin;
    const viewportTop =
      GameState.clientY - canvas.height / (2 * Camera.currentZoom) - margin;
    const viewportBottom =
      GameState.clientY + canvas.height / (2 * Camera.currentZoom) + margin;
    // Draw food
    for (const f of interpFood) {
      if (
        f.x >= viewportLeft &&
        f.x <= viewportRight &&
        f.y >= viewportTop &&
        f.y <= viewportBottom
      ) {
        const type = f.type ?? 0;
        const img = Resources.foodImages[type];
        if (img && img.complete && img.naturalHeight !== 0) {
          const targetSize = f.radius * 2;
          this.drawImageWithAspectRatio(img, f.x, f.y, targetSize);
        } else {
          ctx.beginPath();
          ctx.arc(f.x, f.y, f.radius, 0, Math.PI * 2);
          ctx.fillStyle = "#ccc";
          ctx.fill();
        }
      }
    }
    // Draw other players
    for (const id in interpPlayers) {
      const p = interpPlayers[id];
      // Ẩn player nếu đang chết
      if (p.isDead) continue;
      if (
        p.x >= viewportLeft &&
        p.x <= viewportRight &&
        p.y >= viewportTop &&
        p.y <= viewportBottom
      ) {
        const prev = GameState.prevPositions[id];
        let targetAngle =
          typeof p.angle === "number"
            ? p.angle
            : this.getMoveAngle(id, p, prev);
        let lastAngle = GameState.prevAngles[id] ?? targetAngle;
        let angle = this.lerpAngle(lastAngle, targetAngle, CONFIG.ANGLE_LERP);
        GameState.prevAngles[id] = angle;
        GameState.prevPositions[id] = { x: p.x, y: p.y };
        // Mount
        if (
          p.rightMouseDown &&
          !p.isDead &&
          Resources.mountImg.complete &&
          Resources.mountImg.naturalHeight !== 0
        ) {
          const mountSize = (p.radius + 22) * 2;
          this.drawImageWithAspectRatio(
            Resources.mountImg,
            p.x,
            p.y,
            mountSize,
            angle
          );
        }
        // Player
        const img = Resources.getPlayerImage(p.level || 1);
        if (img && img.complete && img.naturalHeight !== 0) {
          const targetSize = p.radius * 2;
          this.drawImageWithAspectRatio(img, p.x, p.y, targetSize, angle);
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fillStyle = "#808080";
          ctx.fill();
        }
        // Crown
        const allPlayersArr =
          GameState.stateBuffer[GameState.stateBuffer.length - 1]?.players ||
          [];
        let top1 = null;
        if (allPlayersArr.length > 0) {
          top1 = allPlayersArr.slice().sort((a, b) => {
            if (b.level !== a.level) return b.level - a.level;
            return (b.score || 0) - (a.score || 0);
          })[0];
        }
        if (
          top1 &&
          p.id === top1.id &&
          Resources.kingImg.complete &&
          Resources.kingImg.naturalHeight !== 0
        ) {
          const crownWidth = p.radius * 1.4;
          const crownHeight =
            crownWidth *
            (Resources.kingImg.naturalHeight / Resources.kingImg.naturalWidth);
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(angle - Math.PI / 2);
          ctx.drawImage(
            Resources.kingImg,
            -crownWidth / 2,
            -p.radius - crownHeight + p.level * 1.5,
            crownWidth,
            crownHeight
          );
          ctx.restore();
        }
        // Weapon
        this.drawWeapons(
          p.x,
          p.y,
          p.radius,
          p.level,
          p.angle,
          p.isAttacking,
          p.attackTime
        );
        // === Hiển thị tên đối thủ dưới mỗi player ===
        if (p.name) {
          ctx.save();
          ctx.font = `bold 18px Arial`;
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.fillStyle = "#fff";
          ctx.strokeStyle = "#222";
          ctx.lineWidth = 4;
          // Vẽ viền chữ cho rõ
          ctx.strokeText(p.name, p.x, p.y + p.radius + 8);
          ctx.fillText(p.name, p.x, p.y + p.radius + 8);
          ctx.restore();
        }
      }
    }
    // Draw main player
    if (
      GameState.clientRadius &&
      GameState.clientX !== null &&
      GameState.clientY !== null
    ) {
      const me = (
        GameState.stateBuffer[GameState.stateBuffer.length - 1]?.players || []
      ).find((p) => p.id === GameState.playerId);

      // Nếu player chính đang chết, KHÔNG vẽ player chính, chỉ vẽ modal
      if (me && me.isDead) {
        // VẪN vẽ map, vẽ player khác như bình thường
        if (!respawnModal) {
          respawnModal = document.createElement("div");
          respawnModal.style =
            "position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.7);color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:9999;font-size:2.5rem;";
          document.body.appendChild(respawnModal);
        }
        const now = Date.now();
        const left = Math.max(0, 5 - Math.floor((now - me.deadTime) / 1000));
        respawnModal.innerHTML = `<div>Bạn đã bị hạ!</div><div>Hồi sinh sau: <b>${left}</b> giây</div>`;
        // KHÔNG return ở đây, để vẫn vẽ map và player khác
      } else if (respawnModal) {
        respawnModal.remove();
        respawnModal = null;
      }

      // Nếu chưa chết, vẽ player chính như bình thường
      if (!me || !me.isDead) {
        // Giữ nguyên hướng khi đang chém
        let targetAngle = GameState.prevAngles[GameState.playerId] ?? 0;
        if (!GameState.isAttacking) {
          targetAngle = Input.getMouseAngleToCenter(
            GameState.mouseX,
            GameState.mouseY
          );
        }
        let lastAngle = GameState.prevAngles[GameState.playerId] ?? targetAngle;
        let angle = this.lerpAngle(lastAngle, targetAngle, CONFIG.ANGLE_LERP);
        GameState.prevAngles[GameState.playerId] = angle;
        GameState.prevPositions[GameState.playerId] = {
          x: GameState.clientX,
          y: GameState.clientY,
        };
        const showMount = !!(me && me.rightMouseDown);
        if (
          showMount &&
          Resources.mountImg.complete &&
          Resources.mountImg.naturalHeight !== 0
        ) {
          const mountSize = (GameState.clientRadius + 22) * 2;
          this.drawImageWithAspectRatio(
            Resources.mountImg,
            GameState.clientX,
            GameState.clientY,
            mountSize,
            angle
          );
        }
        const mainImg = Resources.getPlayerImage(GameState.clientLevel || 1);
        if (mainImg && mainImg.complete && mainImg.naturalHeight !== 0) {
          const targetSize = GameState.clientRadius * 2;
          this.drawImageWithAspectRatio(
            mainImg,
            GameState.clientX,
            GameState.clientY,
            targetSize,
            angle
          );
        } else {
          ctx.beginPath();
          ctx.arc(
            GameState.clientX,
            GameState.clientY,
            GameState.clientRadius,
            0,
            Math.PI * 2
          );
          ctx.fill();
        }
        // Crown
        const allPlayersArr =
          GameState.stateBuffer[GameState.stateBuffer.length - 1]?.players ||
          [];
        let top1 = null;
        if (allPlayersArr.length > 0) {
          top1 = allPlayersArr.slice().sort((a, b) => {
            if (b.level !== a.level) return b.level - a.level;
            return (b.score || 0) - (a.score || 0);
          })[0];
        }
        if (
          top1 &&
          top1.id === GameState.playerId &&
          Resources.kingImg.complete &&
          Resources.kingImg.naturalHeight !== 0
        ) {
          const crownWidth = GameState.clientRadius * 1.4;
          const crownHeight =
            crownWidth *
            (Resources.kingImg.naturalHeight / Resources.kingImg.naturalWidth);
          ctx.save();
          ctx.translate(GameState.clientX, GameState.clientY);
          ctx.rotate(targetAngle - Math.PI / 2);
          ctx.drawImage(
            Resources.kingImg,
            -crownWidth / 2,
            -GameState.clientRadius - crownHeight + top1.level * 1.5,
            crownWidth,
            crownHeight
          );
          ctx.restore();
        }
        // Weapon
        this.drawWeapons(
          GameState.clientX,
          GameState.clientY,
          GameState.clientRadius,
          GameState.clientLevel,
          angle,
          GameState.isAttacking,
          GameState.attackTime
        );

        // === Draw cooldown progress bar ===
        const level = GameState.clientLevel || 1;
        const cooldown = getAttackCooldown(level);
        const now = Date.now();
        const lastAttack = GameState.lastAttackTime || 0;
        const cdElapsed = now - lastAttack;
        if (cdElapsed < cooldown) {
          // Vẽ progress bar màu vàng phía dưới player
          const barWidth = GameState.clientRadius * 2;
          const barHeight = 7;
          const barX = GameState.clientX - barWidth / 2;
          const barY = GameState.clientY + GameState.clientRadius + 12;
          // Viền bar
          ctx.save();
          ctx.beginPath();
          ctx.strokeStyle = "#bfa600";
          ctx.lineWidth = 2;
          ctx.rect(barX, barY, barWidth, barHeight);
          ctx.stroke();
          // Fill bar
          ctx.beginPath();
          ctx.fillStyle = "#ffe066";
          // Bar chạy ngược: đầy khi vừa chém, thu hẹp dần
          const percent = 1 - Math.max(0, Math.min(1, cdElapsed / cooldown));
          ctx.rect(barX, barY, barWidth * percent, barHeight);
          ctx.fill();
          ctx.restore();
        }

        // === Draw main player name ===
        if (me && me.name) {
          ctx.save();
          ctx.font = `bold 18px Arial`;
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.fillStyle = "#00ff66"; // Màu xanh lá cho main player
          ctx.strokeStyle = "#006633";
          ctx.lineWidth = 4;
          // Vẽ viền chữ cho rõ
          ctx.strokeText(
            me.name,
            GameState.clientX,
            GameState.clientY + GameState.clientRadius + 8
          );
          ctx.fillText(
            me.name,
            GameState.clientX,
            GameState.clientY + GameState.clientRadius + 8
          );
          ctx.restore();
        }
      }
    }
    // Reset attack đúng thời điểm
    if (
      GameState.isAttacking &&
      Date.now() - GameState.attackTime > ATTACK_DURATION
    ) {
      GameState.isAttacking = false;
    }
    ctx.restore();
    // UI
    const allPlayersArr =
      GameState.stateBuffer[GameState.stateBuffer.length - 1]?.players || [];
    this.updateLeaderboard(allPlayersArr);
    // Lấy player chính
    const me = allPlayersArr.find((p) => p.id === GameState.playerId);
    // Nếu player chính đang chết, chỉ hiển thị modal hồi sinh, không vẽ map/player
    if (me && me.isDead) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!respawnModal) {
        respawnModal = document.createElement("div");
        respawnModal.style =
          "position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.7);color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:9999;font-size:2.5rem;";
        document.body.appendChild(respawnModal);
      }
      const now = Date.now();
      const left = Math.max(0, 5 - Math.floor((now - me.deadTime) / 1000));
      respawnModal.innerHTML = `<div>Bạn đã bị hạ!</div><div>Hồi sinh sau: <b>${left}</b> giây</div>`;
      requestAnimationFrame(() => this.draw());
      return;
    } else if (respawnModal) {
      respawnModal.remove();
      respawnModal = null;
    }
    // Draw HUD XP effects
    const now = Date.now();
    pendingHudXpEffects = pendingHudXpEffects.filter(
      (e) => now - e.start < 1000
    );
    for (const e of pendingHudXpEffects) {
      const t = (now - e.start) / 1000;
      ctx.save();
      ctx.globalAlpha = 1 - t;
      ctx.font = "bold 40px Arial";
      ctx.fillStyle = "#00ff66";
      ctx.strokeStyle = "#009944";
      ctx.lineWidth = 4;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.strokeText(`+${e.amount} XP`, canvas.width / 2, 80 - t * 30);
      ctx.fillText(`+${e.amount} XP`, canvas.width / 2, 80 - t * 30);
      ctx.restore();
    }
    // Vẽ hiệu ứng +XP khi kill
    const nowKillXp = Date.now();
    pendingKillXpEffects = pendingKillXpEffects.filter(
      (e) => nowKillXp - e.start < 1000
    );
    for (const e of pendingKillXpEffects) {
      const t = (nowKillXp - e.start) / 1000;
      ctx.save();
      ctx.globalAlpha = 1 - t;
      ctx.font = "bold 32px Arial";
      ctx.fillStyle = "#00ff66";
      ctx.strokeStyle = "#009944";
      ctx.lineWidth = 3;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      const baseX = canvas.width / 2;
      const baseY = 100;
      ctx.strokeText(`+${e.amount} XP`, baseX, baseY - t * 40);
      ctx.fillText(`+${e.amount} XP`, baseX, baseY - t * 40);
      ctx.restore();
    }
    requestAnimationFrame(() => this.draw());
  },
};

function getAttackCooldown(level) {
  return 500 + (level - 1) * 60;
}

let respawnModal = null;
let pendingHudXpEffects = [];
// Hiệu ứng +XP trên đầu đối thủ khi bị kill
let pendingKillXpEffects = [];
let prevKills = {};
let prevXp = 0;
let prevPlayerDeadState = {};

// ===== MAIN GAME LOOP =====
function main() {
  Renderer.resizeCanvas();
  Resources.load();
  Renderer.setupUI();
  Network.connect();
  Input.setup();
  Camera.currentZoom = Camera.getZoomByLevel(1);
  Camera.targetZoom = Camera.currentZoom;
  requestAnimationFrame(() => Renderer.draw());
  setInterval(() => {
    Renderer.updateUI();
    // XP mount logic
    if (GameState.clientXp <= 0 && GameState.rightMouseDown) {
      GameState.rightMouseDown = false;
      if (GameState.loseXpInterval) {
        clearInterval(GameState.loseXpInterval);
        GameState.loseXpInterval = null;
      }
    }
    if (
      GameState.clientXp > 0 &&
      GameState.rightMouseDown &&
      !GameState.loseXpInterval
    ) {
      GameState.loseXpInterval = setInterval(() => {
        const amount = Math.floor(
          GameState.clientXpToNext * CONFIG.XP_LOSS_PERCENT
        );
        Network.ws.send(JSON.stringify({ type: "lose_xp", amount }));
      }, CONFIG.XP_LOSS_INTERVAL);
      Network.ws.send(
        JSON.stringify({
          type: "move",
          x: GameState.clientX,
          y: GameState.clientY,
          rightMouseDown: true,
          angle: Input.getMouseAngleToCenter(
            GameState.mouseX,
            GameState.mouseY
          ),
        })
      );
    }
  }, CONFIG.UI_UPDATE_INTERVAL);
}

main();
