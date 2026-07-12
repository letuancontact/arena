"use strict";

const express = require("express");
const path = require("path");
const { WebSocketServer } = require("ws");
const http = require("http");

const CONFIG = require("../shared/constants");
const utils = require("./utils");
const playerLib = require("./player");
const botLib = require("./bot");
const foodLib = require("./food");
const collisionLib = require("./collision");
const spatialIndex = require("./spatialIndex");

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.static(path.join(__dirname, "../../public")));
app.use("/shared", express.static(path.join(__dirname, "../shared")));

const players = new Map();
const bots = new Map();
let food = [];

foodLib.spawnFood(food);

// ===== ĐÃ FIX: THUẬT TOÁN HỒI SINH AN TOÀN THÔNG MINH (SMART SAFE SPAWN) =====
function getSafeSpawn(activePlayers, mapW, mapH) {
  let bestPos = { x: Math.random() * mapW, y: Math.random() * mapH };
  let maxDistFound = -1;

  // Thử 30 lần để quét radar toàn bản đồ
  for (let i = 0; i < 30; i++) { 
    const tx = Math.random() * mapW;
    const ty = Math.random() * mapH;
    
    let minDistToPlayer = Infinity;
    
    // Đo khoảng cách tới người chơi gần nhất tại tọa độ này
    for (const p of activePlayers) {
      if (!p.isDead) {
        const d = Math.hypot(p.x - tx, p.y - ty);
        if (d < minDistToPlayer) minDistToPlayer = d;
      }
    }

    // Nếu server chưa có ai, chọn luôn điểm này
    if (minDistToPlayer === Infinity) return { x: tx, y: ty };

    // 800 pixel là đủ an toàn, nằm ngoài rìa camera của người chơi
    if (minDistToPlayer > 800) {
      return { x: tx, y: ty }; // Đạt chuẩn, xuất hiện ngay!
    }

    // GHI NHỚ: Nếu không đạt chuẩn tuyệt đối, cứ lưu lại điểm "vắng nhất" đã từng quét qua
    if (minDistToPlayer > maxDistFound) {
      maxDistFound = minDistToPlayer;
      bestPos = { x: tx, y: ty };
    }
  }
  
  // Trả về nơi vắng vẻ nhất tìm được (chống việc rớt ngẫu nhiên trúng đầu người khác)
  return bestPos;
}

wss.on("connection", (ws) => {
  const p = playerLib.createPlayer(ws);
  const safePos = getSafeSpawn([...players.values(), ...bots.values()], CONFIG.MAP_WIDTH, CONFIG.MAP_HEIGHT);
  p.x = safePos.x;
  p.y = safePos.y;
  p.isDead = true; 
  players.set(p.id, p);

  ws.send(JSON.stringify({ type: "init", id: p.id, mapWidth: CONFIG.MAP_WIDTH, mapHeight: CONFIG.MAP_HEIGHT, food: food }));

  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg);
      const player = players.get(p.id);
      if (!player) return;

      if (data.type === "join") {
        if (player.isDead) {
          player.name = String(data.name || "Khách").substring(0, 15);
          playerLib.respawnPlayer(player, CONFIG.MAP_WIDTH, CONFIG.MAP_HEIGHT);
          
          // Người chơi cũng được hưởng ké thuật toán Hồi sinh an toàn mới
          const safePos = getSafeSpawn([...players.values(), ...bots.values()], CONFIG.MAP_WIDTH, CONFIG.MAP_HEIGHT);
          player.x = safePos.x; player.y = safePos.y; 
        }
      }

      if (data.type === "move") playerLib.handlePlayerMove(player, data);
      if (data.type === "attack") playerLib.handlePlayerAttack(player);
    } catch (err) {
      console.error("Invalid message:", msg);
    }
  });

  ws.on("close", () => {
    players.delete(p.id);
  });
});

let lastBroadcast = Date.now();
let lastHeavyTick = Date.now();
let lastTick = Date.now(); 
let foodTree = null;
let foodAdded = [];
let foodRemoved = [];

setInterval(() => {
  const now = Date.now();
  const dtMultiplier = Math.min(((now - lastTick) / 1000) * 60, 3);
  lastTick = now;

  for (const p of players.values()) playerLib.updatePhysics(p, CONFIG.MAP_WIDTH, CONFIG.MAP_HEIGHT, dtMultiplier);
  for (const b of bots.values()) playerLib.updatePhysics(b, CONFIG.MAP_WIDTH, CONFIG.MAP_HEIGHT, dtMultiplier);

  const newlySpawned = foodLib.spawnFood(food); 
  if (newlySpawned.length > 0) { foodAdded.push(...newlySpawned); foodTree = spatialIndex.buildFoodIndex(food); } 
  else if (!foodTree) { foodTree = spatialIndex.buildFoodIndex(food); }

  const playerArray = [...players.values(), ...bots.values()].filter(e => !e.isDead);

  for (const p of playerArray) {
    const nearbyFood = spatialIndex.searchNearbyFood(foodTree, p.x, p.y, p.radius + 24);
    for (const f of nearbyFood) {
      if (collisionLib.checkFoodCollision(p, f)) {
        food.splice(food.indexOf(f), 1); foodRemoved.push(f.id);
        if (p.level < CONFIG.MAX_LEVEL) {
          p.xp += f.xp || 10; p.score += f.xp || 10;
          while (p.xp >= playerLib.getXpToNext(p.level) && p.level < CONFIG.MAX_LEVEL) {
            p.xp -= playerLib.getXpToNext(p.level); p.level++; p.radius = playerLib.getRadiusByLevel(p.level);
          }
        } else {
          p.xp = Math.min(p.xp + (f.xp || 10), playerLib.getXpToNext(CONFIG.MAX_LEVEL)); p.score += f.xp || 10;
        }
        break;
      }
    }
  }

  const playerTree = spatialIndex.buildPlayerIndex(playerArray);
  for (const attacker of playerArray) {
    const attackDuration = CONFIG.BASE_ATTACK_DURATION + (attacker.level || 1) * CONFIG.ATTACK_DURATION_PER_LEVEL;
    if (attacker.isAttacking && now - attacker.attackTime < attackDuration) {
      if (!attacker.hitVictims) attacker.hitVictims = new Set();
      const weaponSize = attacker.radius * (2.75 + 0.04 * ((attacker.level || 1) - 1));
      const exactReach = attacker.radius + weaponSize * 0.85;

      const nearbyVictims = spatialIndex.searchNearbyPlayers(playerTree, attacker.x, attacker.y, exactReach + 100);
      for (const victim of nearbyVictims) {
        if (victim.id === attacker.id || (victim.justRespawned && now - victim.justRespawned < CONFIG.HIT_COOLDOWN) || attacker.hitVictims.has(victim.id)) continue; 
        
        if (collisionLib.weaponHitsPlayerArc(attacker, victim)) {
          attacker.hitVictims.add(victim.id); 
          if (victim.level > 1) { victim.level--; victim.radius = playerLib.getRadiusByLevel(victim.level); victim.xp = playerLib.getXpToNext(victim.level); } 
          else { victim.xp = 0; }
          
          victim.isDead = true; victim.deadTime = now; victim.killerId = attacker.id;
          let gainXp = Math.floor((victim.score || 0) * CONFIG.KILL_SCORE_MULTIPLIER_ATTACKER);
          attacker.xp += gainXp; attacker.score = (attacker.score || 0) + gainXp;
          
          while (attacker.xp >= playerLib.getXpToNext(attacker.level) && attacker.level < CONFIG.MAX_LEVEL) {
            attacker.xp -= playerLib.getXpToNext(attacker.level); attacker.level++; attacker.radius = playerLib.getRadiusByLevel(attacker.level);
          }
        }
      }
    } else { if (attacker.hitVictims) attacker.hitVictims.clear(); }
  }

  for (const entity of playerArray) {
    const attackDuration = CONFIG.BASE_ATTACK_DURATION + (entity.level || 1) * CONFIG.ATTACK_DURATION_PER_LEVEL;
    if (entity.isAttacking && now - entity.attackTime >= attackDuration) entity.isAttacking = false;
  }

  for (const bot of bots.values()) { if (!bot.isDead) botLib.updateBot(bot, foodTree, playerTree); }

  if (now - lastBroadcast >= CONFIG.SERVER_BROADCAST_RATE) {
    lastBroadcast = now;
    const allPlayers = [...players.values(), ...bots.values()].map(p => ({
      id: p.id, x: Math.round(p.x), y: Math.round(p.y), radius: p.radius, level: p.level || 1, xp: p.xp || 0,
      xpToNext: playerLib.getXpToNext(p.level || 1), rightMouseDown: !!p.rightMouseDown, angle: p.angle || 0,
      name: p.name, score: p.score || 0, isAttacking: !!p.isAttacking, attackTime: p.attackTime || 0,
      lastAttackTime: p.lastAttackTime || 0, justRespawned: p.justRespawned || 0, isDead: !!p.isDead,
      deadTime: p.deadTime || 0, killerId: p.killerId || null, isBot: !!p.isBot,
    }));
    
    const statePayload = JSON.stringify({ type: "state", players: allPlayers, foodAdded: foodAdded.length > 0 ? foodAdded : undefined, foodRemoved: foodRemoved.length > 0 ? foodRemoved : undefined });
    for (const p of players.values()) { if (p.ws.readyState === p.ws.OPEN) p.ws.send(statePayload); }
    foodAdded = []; foodRemoved = [];
  }

  if (now - lastHeavyTick >= CONFIG.HEAVY_TICK_RATE) {
    lastHeavyTick = now;
    for (const entity of [...players.values(), ...bots.values()]) {
      if (entity.isDead && now - entity.deadTime >= CONFIG.RESPAWN_TIME) {
        if (entity.isBot) {
          playerLib.respawnPlayer(entity, CONFIG.MAP_WIDTH, CONFIG.MAP_HEIGHT);
          
          // Bắt buộc Bot phải áp dụng vị trí an toàn tuyệt đối khi hồi sinh
          const safePos = getSafeSpawn([...players.values(), ...bots.values()], CONFIG.MAP_WIDTH, CONFIG.MAP_HEIGHT);
          entity.x = safePos.x; entity.y = safePos.y; 
          entity.angle = Math.random() * Math.PI * 2;
          entity.killerId = null;
        }
      }
    }
    
    const realPlayers = players.size;
    let botTarget = Math.max(0, CONFIG.MAX_PLAYERS - realPlayers);
    let botCount = bots.size;
    if (botCount < botTarget) { 
      for (let i = botCount; i < botTarget; i++) {
        const bot = botLib.createBot(CONFIG.MAP_WIDTH, CONFIG.MAP_HEIGHT);
        
        // Bắt buộc Bot mới tạo cũng phải áp dụng vị trí an toàn tuyệt đối
        const safePos = getSafeSpawn([...players.values(), ...bots.values()], CONFIG.MAP_WIDTH, CONFIG.MAP_HEIGHT);
        bot.x = safePos.x; bot.y = safePos.y;
        
        bots.set(bot.id, bot); 
      }
    } 
    else if (botCount > botTarget) { let removeCount = botCount - botTarget; for (const [id, bot] of bots) { bots.delete(id); if (--removeCount <= 0) break; } }
  }

}, CONFIG.SERVER_TICK_RATE);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`[Engine] Server running on port ${PORT}`));
