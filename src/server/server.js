// --- src/server/server.js ---
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

app.use(express.static(path.join(__dirname, "../../public"), { maxAge: "7d" }));
app.use("/shared", express.static(path.join(__dirname, "../shared"), { maxAge: "7d" }));

const players = new Map();
const bots = new Map();
let food = [];

foodLib.spawnFood(food);

function getSafeSpawn(activePlayers, mapW, mapH) {
  let bestPos = { x: Math.random() * mapW, y: Math.random() * mapH };
  let maxDistFound = -1;
  for (let i = 0; i < 30; i++) { 
    const tx = Math.random() * mapW; const ty = Math.random() * mapH;
    let minDistToPlayer = Infinity;
    for (const p of activePlayers) {
      if (!p.isDead) { const d = Math.hypot(p.x - tx, p.y - ty); if (d < minDistToPlayer) minDistToPlayer = d; }
    }
    if (minDistToPlayer === Infinity) return { x: tx, y: ty };
    if (minDistToPlayer > 800) return { x: tx, y: ty }; 
    if (minDistToPlayer > maxDistFound) { maxDistFound = minDistToPlayer; bestPos = { x: tx, y: ty }; }
  }
  return bestPos;
}

function getActiveEntities() {
    const arr = [];
    for (const p of players.values()) arr.push(p);
    for (const b of bots.values()) arr.push(b);
    return arr;
}

function heartbeat() { this.isAlive = true; }

wss.on("connection", (ws) => {
  ws.isAlive = true; ws.on('pong', heartbeat);
  const p = playerLib.createPlayer(ws);
  const safePos = getSafeSpawn(getActiveEntities(), CONFIG.MAP_WIDTH, CONFIG.MAP_HEIGHT);
  
  p.x = safePos.x; p.y = safePos.y; p.isDead = true; p.killStreak = 0; p.lastActiveTime = Date.now(); 
  players.set(p.id, p);

  ws.send(JSON.stringify({ type: "init", id: p.id, mapWidth: CONFIG.MAP_WIDTH, mapHeight: CONFIG.MAP_HEIGHT, food: food }));

  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg); const player = players.get(p.id); if (!player) return;
      
      player.lastActiveTime = Date.now();

      if (data.type === "join") {
        if (player.isDead) {
          player.name = String(data.name || "Khách").substring(0, 15);
          playerLib.respawnPlayer(player, CONFIG.MAP_WIDTH, CONFIG.MAP_HEIGHT);
          const safePos = getSafeSpawn(getActiveEntities(), CONFIG.MAP_WIDTH, CONFIG.MAP_HEIGHT);
          player.x = safePos.x; player.y = safePos.y; player.killStreak = 0;
        }
      }
      if (data.type === "move") playerLib.handlePlayerMove(player, data);
      if (data.type === "attack") playerLib.handlePlayerAttack(player);
    } catch (err) {}
  });

  ws.on("close", () => { players.delete(p.id); });
});

const interval = setInterval(function ping() { wss.clients.forEach(function each(ws) { if (ws.isAlive === false) return ws.terminate(); ws.isAlive = false; ws.ping(); }); }, 30000); 
wss.on('close', function close() { clearInterval(interval); });

const AFK_TIMEOUT = 3 * 60 * 1000;
setInterval(() => {
    const now = Date.now();
    for (const [id, p] of players) {
        if (p.lastActiveTime && (now - p.lastActiveTime > AFK_TIMEOUT)) {
            if (p.ws && p.ws.readyState === 1) { 
                p.ws.send(JSON.stringify({ type: "kicked", reason: "Treo máy quá lâu (AFK)" }));
                p.ws.close();
            }
            players.delete(id);
            console.log(`[Hệ thống] Đã ngắt kết nối player ${id} do AFK.`);
        }
    }
}, 10000); 

let lastBroadcast = Date.now();
let lastHeavyTick = Date.now();
let lastTick = Date.now(); 
let foodTree = null;
let foodAdded = [];
let foodRemoved = [];
let hitsBuffer = []; 
let announcementsBuffer = []; 

setInterval(() => {
  const now = Date.now();
  const dtMultiplier = Math.min(((now - lastTick) / 1000) * 60, 3);
  lastTick = now;

  for (const p of players.values()) playerLib.updatePhysics(p, CONFIG.MAP_WIDTH, CONFIG.MAP_HEIGHT, dtMultiplier);
  for (const b of bots.values()) playerLib.updatePhysics(b, CONFIG.MAP_WIDTH, CONFIG.MAP_HEIGHT, dtMultiplier);

  const newlySpawned = foodLib.spawnFood(food); 
  if (newlySpawned.length > 0) { foodAdded.push(...newlySpawned); foodTree = spatialIndex.buildFoodIndex(food); } 
  else if (!foodTree) { foodTree = spatialIndex.buildFoodIndex(food); }

  const playerArray = [];
  for (const p of players.values()) { if (!p.isDead) playerArray.push(p); }
  for (const b of bots.values()) { if (!b.isDead) playerArray.push(b); }

  for (const p of playerArray) {
    const nearbyFood = spatialIndex.searchNearbyFood(foodTree, p.x, p.y, p.radius + 24);
    for (const f of nearbyFood) {
      if (collisionLib.checkFoodCollision(p, f)) {
        food.splice(food.indexOf(f), 1); foodRemoved.push(f.id);
        if (p.level < CONFIG.MAX_LEVEL) {
          p.xp += f.xp || 10; p.score += f.xp || 10;
          while (p.xp >= playerLib.getXpToNext(p.level) && p.level < CONFIG.MAX_LEVEL) { p.xp -= playerLib.getXpToNext(p.level); p.level++; p.radius = playerLib.getRadiusByLevel(p.level); }
        } else { p.xp = Math.min(p.xp + (f.xp || 10), playerLib.getXpToNext(CONFIG.MAX_LEVEL)); p.score += f.xp || 10; }
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

      const nearbyVictims = spatialIndex.searchNearbyPlayers(playerTree, attacker.x, attacker.y, exactReach + 50);
      for (const victim of nearbyVictims) {
        if (victim.id === attacker.id || (victim.justRespawned && now - victim.justRespawned < CONFIG.HIT_COOLDOWN) || attacker.hitVictims.has(victim.id)) continue; 
        
        if (collisionLib.weaponHitsPlayerArc(attacker, victim)) {
          attacker.hitVictims.add(victim.id); 
          
          let damageAmount = 0;
          if (victim.level > 1) { damageAmount = playerLib.getXpToNext(victim.level - 1); victim.level--; victim.radius = playerLib.getRadiusByLevel(victim.level); victim.xp = playerLib.getXpToNext(victim.level); } 
          else { damageAmount = victim.xp > 0 ? victim.xp : 15; victim.xp = 0; }

          hitsBuffer.push({ x: victim.x, y: victim.y, amount: damageAmount, victimId: victim.id, attackerId: attacker.id });
          victim.isDead = true; victim.deadTime = now; victim.killerId = attacker.id;
          
          victim.killStreak = 0; 
          attacker.killStreak = (attacker.killStreak || 0) + 1; 
          
          const s = attacker.killStreak;
          if (s === 2 || s === 3 || s === 5 || s === 7 || s === 10) {
              announcementsBuffer.push({ type: "killstreak", name: attacker.name || "Khách", streak: s });
          }

          let gainXp = Math.floor((victim.score || 0) * CONFIG.KILL_SCORE_MULTIPLIER_ATTACKER);
          attacker.xp += gainXp; attacker.score = (attacker.score || 0) + gainXp;
          
          while (attacker.xp >= playerLib.getXpToNext(attacker.level) && attacker.level < CONFIG.MAX_LEVEL) { attacker.xp -= playerLib.getXpToNext(attacker.level); attacker.level++; attacker.radius = playerLib.getRadiusByLevel(attacker.level); }
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
    
    const allPlayers = [];
    const pushPlayerState = (p) => {
        allPlayers.push({
            id: p.id, x: Math.round(p.x), y: Math.round(p.y), radius: p.radius, level: p.level || 1, xp: p.xp || 0,
            xpToNext: playerLib.getXpToNext(p.level || 1), rightMouseDown: !!p.rightMouseDown, angle: p.angle || 0,
            name: p.name, score: p.score || 0, isAttacking: !!p.isAttacking, attackTime: p.attackTime || 0,
            lastAttackTime: p.lastAttackTime || 0, justRespawned: p.justRespawned || 0, isDead: !!p.isDead,
            deadTime: p.deadTime || 0, killerId: p.killerId || null, isBot: !!p.isBot,
            
            // --- THÊM DÒNG NÀY ĐỂ GỬI DỮ LIỆU CHUỖI HẠ GỤC VỀ CLIENT ---
            killStreak: p.killStreak || 0 
        });
    };
    for (const p of players.values()) pushPlayerState(p);
    for (const b of bots.values()) pushPlayerState(b);
    
    const statePayload = JSON.stringify({ 
        type: "state", players: allPlayers, 
        foodAdded: foodAdded.length > 0 ? foodAdded : undefined, 
        foodRemoved: foodRemoved.length > 0 ? foodRemoved : undefined,
        hits: hitsBuffer.length > 0 ? hitsBuffer : undefined,
        announcements: announcementsBuffer.length > 0 ? announcementsBuffer : undefined
    });

    for (const p of players.values()) { if (p.ws.readyState === p.ws.OPEN) p.ws.send(statePayload); }
    
    foodAdded = []; foodRemoved = []; hitsBuffer = []; announcementsBuffer = []; 
  }

  if (now - lastHeavyTick >= CONFIG.HEAVY_TICK_RATE) {
    lastHeavyTick = now;
    
    const allEntities = getActiveEntities();
    
    for (const entity of allEntities) {
      if (entity.isDead && now - entity.deadTime >= CONFIG.RESPAWN_TIME) {
        if (entity.isBot) {
          playerLib.respawnPlayer(entity, CONFIG.MAP_WIDTH, CONFIG.MAP_HEIGHT);
          const safePos = getSafeSpawn(allEntities, CONFIG.MAP_WIDTH, CONFIG.MAP_HEIGHT);
          entity.x = safePos.x; entity.y = safePos.y; entity.angle = Math.random() * Math.PI * 2; entity.killerId = null; entity.killStreak = 0;
        }
      }
    }
    
    let botTarget = Math.max(0, CONFIG.MAX_PLAYERS - players.size); let botCount = bots.size;
    if (botCount < botTarget) { 
      for (let i = botCount; i < botTarget; i++) {
        const bot = botLib.createBot(CONFIG.MAP_WIDTH, CONFIG.MAP_HEIGHT); bot.killStreak = 0;
        const safePos = getSafeSpawn(allEntities, CONFIG.MAP_WIDTH, CONFIG.MAP_HEIGHT); 
        bot.x = safePos.x; bot.y = safePos.y; 
        bots.set(bot.id, bot); 
        allEntities.push(bot); 
      }
    } 
    else if (botCount > botTarget) { let removeCount = botCount - botTarget; for (const [id, bot] of bots) { bots.delete(id); if (--removeCount <= 0) break; } }
  }
}, CONFIG.SERVER_TICK_RATE);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`[Engine] Server running on port ${PORT}`));
