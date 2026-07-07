const express = require("express");
const path = require("path");
const { WebSocketServer } = require("ws");
const http = require("http");
const Quadtree = require("quadtree-lib");

// Import các module đã tách
const constants = require("./constants");
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

const players = new Map();
const bots = new Map();
let food = [];

// Spawn food ban đầu
foodLib.spawnFood(food);

wss.on("connection", (ws) => {
  // Tạo player mới
  const p = playerLib.createPlayer(ws);
  // Spawn tại vị trí random
  p.x = Math.random() * constants.MAP_WIDTH;
  p.y = Math.random() * constants.MAP_HEIGHT;
  players.set(p.id, p);

  ws.send(
    JSON.stringify({
      type: "init",
      id: p.id,
      mapWidth: constants.MAP_WIDTH,
      mapHeight: constants.MAP_HEIGHT,
    })
  );

  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg);
      const player = players.get(p.id);
      if (!player) return;
      if (data.type === "move") {
        playerLib.handlePlayerMove(
          player,
          data,
          constants.MAP_WIDTH,
          constants.MAP_HEIGHT
        );
      }
      if (data.type === "lose_xp") {
        player.xp -= data.amount || 5;
        player.score -= data.amount || 5;
        if (player.score < 0) player.score = 0;
        player.speed = 4;
        while (player.xp < 0 && player.level > 1) {
          player.level--;
          player.radius = playerLib.getRadiusByLevel(player.level);
          player.xp += playerLib.getXpToNext(player.level);
        }
        if (player.level === 1 && player.xp < 0) player.xp = 0;
        if (player.xp <= 0) player.rightMouseDown = false;
      }
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

function getWeaponBaseAndTip(player, which = "left") {
  const angle = player.angle || 0;
  const level = player.level || 1;
  const radius = player.radius || playerLib.getRadiusByLevel(level);
  const ATTACK_SWING = Math.PI;
  const ATTACK_DURATION = 360;
  let swing = 0;
  if (player.isAttacking) {
    const t = Math.min(1, (Date.now() - player.attackTime) / ATTACK_DURATION);
    swing =
      Math.sin(t * Math.PI) * (level < 37 ? ATTACK_SWING : ATTACK_SWING * 0.68);
  }
  let weaponAngle;
  if (which === "left") {
    weaponAngle = angle - Math.PI * 0.7 + swing;
  } else {
    weaponAngle = angle + Math.PI * 0.7 - swing;
  }
  const baseRatio = 2.75,
    growPerLevel = 0.04;
  const weaponSize = radius * (baseRatio + growPerLevel * (level - 1));
  const weaponHeadOffset = weaponSize * 0.4;
  const baseX = player.x + Math.cos(weaponAngle) * radius;
  const baseY = player.y + Math.sin(weaponAngle) * radius;
  const reach = (weaponHeadOffset + weaponSize / 2) * 1.4;
  const tipX = baseX + Math.cos(weaponAngle) * reach;
  const tipY = baseY + Math.sin(weaponAngle) * reach;
  return { base: { x: baseX, y: baseY }, tip: { x: tipX, y: tipY } };
}

let lastBroadcast = Date.now();
const BROADCAST_INTERVAL = 50;
let lastHeavyTick = Date.now();
const HEAVY_TICK_INTERVAL = 200;
let foodTree = null;
let foodDirty = true;
const MAX_FOOD = 400;

// Game loop chính: di chuyển, va chạm, ăn food (16ms)
setInterval(() => {
  // 1. Spawn thêm food nếu thiếu (đánh dấu foodDirty nếu có spawn)
  const oldFoodCount = food.length;
  while (food.length < MAX_FOOD) {
    foodLib.spawnFood(food);
    foodDirty = true;
  }

  // 2. Xây dựng spatial index cho food (rbush) chỉ khi foodDirty
  if (foodDirty || !foodTree) {
    foodTree = spatialIndex.buildFoodIndex(food);
    foodDirty = false;
  }

  // 3. Chỉ lấy entity còn sống để xử lý logic
  const playerArray = [...players.values(), ...bots.values()].filter(
    (e) => !e.isDead
  );

  // 4. Kiểm tra player ăn food (tối ưu: break ngay khi ăn, foodDirty nếu có ăn)
  for (const p of playerArray) {
    const nearbyFood = spatialIndex.searchNearbyFood(
      foodTree,
      p.x,
      p.y,
      p.radius + 24
    );
    for (const f of nearbyFood) {
      if (collisionLib.checkFoodCollision(p, f)) {
        food.splice(food.indexOf(f), 1);
        foodDirty = true;
        if (p.level < constants.MAX_LEVEL) {
          p.xp += f.xp || 10;
          p.score += f.xp || 10;
          while (
            p.xp >= playerLib.getXpToNext(p.level) &&
            p.level < constants.MAX_LEVEL
          ) {
            p.xp -= playerLib.getXpToNext(p.level);
            p.level++;
            p.radius = playerLib.getRadiusByLevel(p.level);
          }
        } else {
          p.xp = Math.min(
            p.xp + (f.xp || 10),
            playerLib.getXpToNext(constants.MAX_LEVEL)
          );
          p.score += f.xp || 10;
        }
        break;
      }
    }
  }

  // 5. Xử lý tấn công (dùng spatial index cho player còn sống)
  const now = Date.now();
  const BASE_ATTACK_DURATION = 320;
  const ATTACK_DURATION_PER_LEVEL = 10; // 0.01s mỗi level
  const HIT_COOLDOWN = 1000;
  const playerTree = spatialIndex.buildPlayerIndex(playerArray);
  for (const attacker of playerArray) {
    // Tính ATTACK_DURATION riêng cho từng attacker
    const ATTACK_DURATION =
      BASE_ATTACK_DURATION + (attacker.level || 1) * ATTACK_DURATION_PER_LEVEL;
    if (attacker.isAttacking && now - attacker.attackTime < ATTACK_DURATION) {
      const weaponReach = attacker.radius * 4.5;
      const nearbyVictims = spatialIndex.searchNearbyPlayers(
        playerTree,
        attacker.x,
        attacker.y,
        weaponReach
      );
      for (const victim of nearbyVictims) {
        if (victim.id === attacker.id) continue;
        if (victim.justRespawned && now - victim.justRespawned < HIT_COOLDOWN)
          continue;
        if (
          collisionLib.weaponHitsPlayer(attacker, victim, getWeaponBaseAndTip)
        ) {
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
          let gainXp = Math.floor((victim.score || 0) * 0.3);
          attacker.xp += gainXp;
          while (
            attacker.xp >= playerLib.getXpToNext(attacker.level) &&
            attacker.level < constants.MAX_LEVEL
          ) {
            attacker.xp -= playerLib.getXpToNext(attacker.level);
            attacker.level++;
            attacker.radius = playerLib.getRadiusByLevel(attacker.level);
          }
          attacker.score = (attacker.score || 0) + gainXp;
        }
      }
    }
  }

  // 6. Reset trạng thái chém sau khi hết animation
  for (const entity of playerArray) {
    const ATTACK_DURATION =
      BASE_ATTACK_DURATION + (entity.level || 1) * ATTACK_DURATION_PER_LEVEL;
    if (entity.isAttacking && now - entity.attackTime >= ATTACK_DURATION) {
      entity.isAttacking = false;
    }
  }

  // 7. Gửi state cho client mỗi BROADCAST_INTERVAL ms (tối giản fields)
  if (Date.now() - lastBroadcast >= BROADCAST_INTERVAL) {
    lastBroadcast = Date.now();
    const allPlayers = [...players.values(), ...bots.values()].map(
      (player) => ({
        id: player.id,
        x: Math.round(player.x),
        y: Math.round(player.y),
        radius: player.radius,
        level: player.level || 1,
        xp: player.xp || 0,
        xpToNext: playerLib.getXpToNext(player.level || 1),
        rightMouseDown: !!player.rightMouseDown,
        angle: player.angle || 0,
        name: player.name,
        score: player.score || 0,
        isAttacking: !!player.isAttacking,
        attackTime: player.attackTime || 0,
        lastAttackTime: player.lastAttackTime || 0,
        justRespawned: player.justRespawned || 0,
        isDead: !!player.isDead,
        deadTime: player.deadTime || 0,
        killerId: player.killerId || null,
        isBot: !!player.isBot,
      })
    );
    for (const p of players.values()) {
      if (p.ws.readyState === p.ws.OPEN) {
        p.ws.send(
          JSON.stringify({
            type: "state",
            players: allPlayers,
            food,
            mapWidth: constants.MAP_WIDTH,
            mapHeight: constants.MAP_HEIGHT,
          })
        );
      }
    }
  }

  // 8. Tick nặng (hồi sinh, bot, dead) chỉ mỗi HEAVY_TICK_INTERVAL
  if (Date.now() - lastHeavyTick >= HEAVY_TICK_INTERVAL) {
    lastHeavyTick = Date.now();
    // Hồi sinh
    for (const entity of [...players.values(), ...bots.values()]) {
      if (entity.isDead && now - entity.deadTime >= 5000) {
        playerLib.respawnPlayer(
          entity,
          constants.MAP_WIDTH,
          constants.MAP_HEIGHT
        );
        if (entity.isBot) {
          entity.angle = Math.random() * Math.PI * 2;
        }
        entity.killerId = null;
      }
    }
    // Đảm bảo đủ bot: chỉ spawn bot nếu thiếu người chơi thật
    const realPlayers = [...players.values()].length;
    let botTarget = Math.max(0, constants.MAX_PLAYERS - realPlayers);
    let botCount = [...bots.values()].length;
    if (botCount < botTarget) {
      for (let i = botCount; i < botTarget; i++) {
        const bot = botLib.createBot(constants.MAP_WIDTH, constants.MAP_HEIGHT);
        bots.set(bot.id, bot);
      }
    }
    if (botCount > botTarget) {
      let removeCount = botCount - botTarget;
      for (const [id, bot] of bots) {
        bots.delete(id);
        if (--removeCount <= 0) break;
      }
    }
  }

  // 9. Update bot (chỉ xử lý bot còn sống)
  for (const bot of bots.values()) {
    if (!bot.isDead) {
      botLib.updateBot(bot, constants.MAP_WIDTH, constants.MAP_HEIGHT);
    }
  }
}, 16);

// Khởi chạy server với cổng tự động từ Render hoặc 3000 ở local
const PORT = process.env.PORT || 3000;
server.listen(PORT, () =>
  console.log(`Server running on port ${PORT}`)
);
