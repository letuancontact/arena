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

wss.on("connection", (ws) => {
  const p = playerLib.createPlayer(ws);
  p.x = Math.random() * CONFIG.MAP_WIDTH;
  p.y = Math.random() * CONFIG.MAP_HEIGHT;
  players.set(p.id, p);

  ws.send(JSON.stringify({ type: "init", id: p.id, mapWidth: CONFIG.MAP_WIDTH, mapHeight: CONFIG.MAP_HEIGHT }));

  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg);
      const player = players.get(p.id);
      if (!player) return;

      if (data.type === "move") {
        // Chỉ cập nhật Input, không nhận tọa độ x, y
        playerLib.handlePlayerMove(player, data);
      }
      
      // Xóa BỎ HOÀN TOÀN khối data.type === 'lose_xp' vì Server đã tự lo.

      if (data.type === "attack") {
        playerLib.handlePlayerAttack(player);
      }
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
let foodTree = null;
let foodDirty = true;

/**
 * Main Game Loop (Chạy mỗi 16ms ~ 60 FPS)
 */
setInterval(() => {
  const now = Date.now();

  // 1. Cập nhật vị trí vật lý (Physics) cho TOÀN BỘ NGƯỜI CHƠI (Bảo mật tuyệt đối)
  for (const p of players.values()) {
    playerLib.updatePhysics(p, CONFIG.MAP_WIDTH, CONFIG.MAP_HEIGHT);
  }

  // 2. Quản lý Food
  const oldFoodCount = food.length;
  foodLib.spawnFood(food); 
  if (food.length > oldFoodCount) foodDirty = true;

  if (foodDirty || !foodTree) {
    foodTree = spatialIndex.buildFoodIndex(food);
    foodDirty = false;
  }

  const playerArray = [...players.values(), ...bots.values()].filter(e => !e.isDead);

  // 3. Kiểm tra ăn thức ăn
  for (const p of playerArray) {
    const nearbyFood = spatialIndex.searchNearbyFood(foodTree, p.x, p.y, p.radius + 24);
    for (const f of nearbyFood) {
      if (collisionLib.checkFoodCollision(p, f)) {
        food.splice(food.indexOf(f), 1);
        foodDirty = true;
        
        if (p.level < CONFIG.MAX_LEVEL) {
          p.xp += f.xp || 10;
          p.score += f.xp || 10;
          while (p.xp >= playerLib.getXpToNext(p.level) && p.level < CONFIG.MAX_LEVEL) {
            p.xp -= playerLib.getXpToNext(p.level);
            p.level++;
            p.radius = playerLib.getRadiusByLevel(p.level);
          }
        } else {
          p.xp = Math.min(p.xp + (f.xp || 10), playerLib.getXpToNext(CONFIG.MAX_LEVEL));
          p.score += f.xp || 10;
        }
        break;
      }
    }
  }

  // 4. Xử lý Chiến đấu (Combat)
  const playerTree = spatialIndex.buildPlayerIndex(playerArray);
  for (const attacker of playerArray) {
    const attackDuration = CONFIG.BASE_ATTACK_DURATION + (attacker.level || 1) * CONFIG.ATTACK_DURATION_PER_LEVEL;
    
    if (attacker.isAttacking && now - attacker.attackTime < attackDuration) {
      if (!attacker.hitVictims) attacker.hitVictims = new Set();
      
      const weaponReach = attacker.radius * 4.5;
      const nearbyVictims = spatialIndex.searchNearbyPlayers(playerTree, attacker.x, attacker.y, weaponReach + 100);
      
      for (const victim of nearbyVictims) {
        if (victim.id === attacker.id) continue;
        if (victim.justRespawned && now - victim.justRespawned < CONFIG.HIT_COOLDOWN) continue;
        if (attacker.hitVictims.has(victim.id)) continue; 
        
        if (collisionLib.weaponHitsPlayerArc(attacker, victim)) {
          attacker.hitVictims.add(victim.id); 
          
          if (victim.level > 1) {
            victim.level--;
            victim.radius = playerLib.getRadiusByLevel(victim.level);
            victim.xp = playerLib.getXpToNext(victim.level);
          } else {
            victim.xp = 0;
          }
          
          victim.isDead = true;
          victim.deadTime = now;
          victim.killerId = attacker.id;
          
          let gainXp = Math.floor((victim.score || 0) * CONFIG.KILL_SCORE_MULTIPLIER_ATTACKER);
          attacker.xp += gainXp;
          attacker.score = (attacker.score || 0) + gainXp;
          
          while (attacker.xp >= playerLib.getXpToNext(attacker.level) && attacker.level < CONFIG.MAX_LEVEL) {
            attacker.xp -= playerLib.getXpToNext(attacker.level);
            attacker.level++;
            attacker.radius = playerLib.getRadiusByLevel(attacker.level);
          }
        }
      }
    } else {
      if (attacker.hitVictims) attacker.hitVictims.clear();
    }
  }

  for (const entity of playerArray) {
    const attackDuration = CONFIG.BASE_ATTACK_DURATION + (entity.level || 1) * CONFIG.ATTACK_DURATION_PER_LEVEL;
    if (entity.isAttacking && now - entity.attackTime >= attackDuration) {
      entity.isAttacking = false;
    }
  }

  // 5. Broadcast State (Network Tick)
  if (now - lastBroadcast >= CONFIG.SERVER_BROADCAST_RATE) {
    lastBroadcast = now;
    const allPlayers = [...players.values(), ...bots.values()].map(p => ({
      id: p.id,
      x: Math.round(p.x),
      y: Math.round(p.y),
      radius: p.radius,
      level: p.level || 1,
      xp: p.xp || 0,
      xpToNext: playerLib.getXpToNext(p.level || 1),
      rightMouseDown: !!p.rightMouseDown,
      angle: p.angle || 0,
      name: p.name,
      score: p.score || 0,
      isAttacking: !!p.isAttacking,
      attackTime: p.attackTime || 0,
      lastAttackTime: p.lastAttackTime || 0,
      justRespawned: p.justRespawned || 0,
      isDead: !!p.isDead,
      deadTime: p.deadTime || 0,
      killerId: p.killerId || null,
      isBot: !!p.isBot,
    }));
    
    const statePayload = JSON.stringify({
      type: "state",
      players: allPlayers,
      food: food,
      mapWidth: CONFIG.MAP_WIDTH,
      mapHeight: CONFIG.MAP_HEIGHT,
    });

    for (const p of players.values()) {
      if (p.ws.readyState === p.ws.OPEN) p.ws.send(statePayload);
    }
  }

  // 6. Heavy Tick (Hồi sinh & Bot)
  if (now - lastHeavyTick >= CONFIG.HEAVY_TICK_RATE) {
    lastHeavyTick = now;
    
    for (const entity of [...players.values(), ...bots.values()]) {
      if (entity.isDead && now - entity.deadTime >= CONFIG.RESPAWN_TIME) {
        playerLib.respawnPlayer(entity, CONFIG.MAP_WIDTH, CONFIG.MAP_HEIGHT);
        if (entity.isBot) entity.angle = Math.random() * Math.PI * 2;
        entity.killerId = null;
      }
    }
    
    const realPlayers = players.size;
    let botTarget = Math.max(0, CONFIG.MAX_PLAYERS - realPlayers);
    let botCount = bots.size;
    
    if (botCount < botTarget) {
      for (let i = botCount; i < botTarget; i++) {
        const bot = botLib.createBot(CONFIG.MAP_WIDTH, CONFIG.MAP_HEIGHT);
        bots.set(bot.id, bot);
      }
    } else if (botCount > botTarget) {
      let removeCount = botCount - botTarget;
      for (const [id, bot] of bots) {
        bots.delete(id);
        if (--removeCount <= 0) break;
      }
    }
  }

  // 7. Cập nhật vị trí Bot
  for (const bot of bots.values()) {
    if (!bot.isDead) botLib.updateBot(bot, CONFIG.MAP_WIDTH, CONFIG.MAP_HEIGHT);
  }
}, CONFIG.SERVER_TICK_RATE);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`[Engine] Server running on port ${PORT}`));
