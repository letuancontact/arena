// --- src/server/bot.js ---
"use strict";

const CONFIG = require("../shared/constants");
const { randomName, uuid } = require("./utils");
const { getRadiusByLevel, handlePlayerAttack } = require("./player");
const spatialIndex = require("./spatialIndex");

function createBot(mapWidth, mapHeight) {
  const id = "bot_" + uuid();
  return {
    id,
    x: Math.random() * mapWidth,
    y: Math.random() * mapHeight,
    radius: getRadiusByLevel(1),
    level: 1,
    xp: 0,
    speed: 4,
    name: randomName(),
    score: 0,
    angle: Math.random() * Math.PI * 2,
    isMoving: true,
    rightMouseDown: false,
    isAttacking: false,
    attackTime: 0,
    lastAttackTime: 0,
    justRespawned: 0, 
    isDead: false,
    deadTime: 0,
    lastXpDrain: 0,
    hitVictims: new Set(),
    isBot: true,
    state: "EXPLORE",
    changeStateTime: 0,
    lastReaction: 0 
  };
}

function updateBot(bot, foodTree, playerTree) {
  const now = Date.now();
  
  if (now - bot.changeStateTime > 500) {
    bot.changeStateTime = now;
    bot.rightMouseDown = false;
    
    const huntVision = bot.radius * 4.5;
    const escapeVision = bot.radius * 12; 
    
    const nearbyPlayers = spatialIndex.searchNearbyPlayers(playerTree, bot.x, bot.y, escapeVision);
    
    let nearestThreat = null;
    let nearestPrey = null;
    let minThreatDist = Infinity;
    let minPreyDist = Infinity;

    for (const p of nearbyPlayers) {
      if (p.id === bot.id || p.isDead) continue;
      if (now - (p.justRespawned || 0) < CONFIG.HIT_COOLDOWN) continue; 
      
      const dist = Math.hypot(p.x - bot.x, p.y - bot.y);
      if (p.level > bot.level + 1) {
        if (dist < minThreatDist) { minThreatDist = dist; nearestThreat = p; }
      } else {
        if (dist < minPreyDist) { minPreyDist = dist; nearestPrey = p; }
      }
    }

    if (nearestThreat && minThreatDist < escapeVision) {
      bot.state = "ESCAPE";
      
      // Lạng lách (Zig-zag) khi chạy trốn thay vì chạy đường thẳng
      const baseEscapeAngle = Math.atan2(bot.y - nearestThreat.y, bot.x - nearestThreat.x) + Math.PI;
      const juke = (Math.random() > 0.5 ? 1 : -1) * (Math.PI / 4.5); 
      
      // Bị ép sát quá thì chạy thẳng, xa xa thì lạng lách
      bot.angle = baseEscapeAngle + (minThreatDist < bot.radius * 3 ? 0 : juke); 
      
      // Bot biết dùng Tốc Biến (Sprint) để chạy nếu bị dí sát
      if (minThreatDist < bot.radius * 4.5 && bot.xp > 0) bot.rightMouseDown = true;
    } 
    else if (nearestPrey && minPreyDist < huntVision) {
      bot.state = "ATTACK";
      
      // Cân nhắc "Hit & Run" - Nếu con mồi quay mặt lại, bot sẽ chùn bước
      const preyAimAngle = Math.atan2(bot.y - nearestPrey.y, bot.x - nearestPrey.x);
      let isPreyAimingUs = false;
      if (nearestPrey.angle !== undefined) {
         let angleDiff = Math.abs(nearestPrey.angle - preyAimAngle);
         while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
         isPreyAimingUs = Math.abs(angleDiff) < Math.PI / 3; // Nằm trong tầm ngắm
      }

      if (isPreyAimingUs && minPreyDist < bot.radius * 4) {
          // Lùi ra một chút xíu (Kite)
          bot.angle = Math.atan2(bot.y - nearestPrey.y, bot.x - nearestPrey.x);
          bot.rightMouseDown = false;
      } else {
          // Lao vào truy đuổi
          bot.angle = Math.atan2(nearestPrey.y - bot.y, nearestPrey.x - bot.x);
          // Bot biết xài Sprint để rượt nếu mục tiêu đang chạy
          if (minPreyDist > bot.radius * 2 && bot.xp > 0) bot.rightMouseDown = true; 
      }
    } 
    else {
      bot.state = "COLLECT";
      const nearbyFood = spatialIndex.searchNearbyFood(foodTree, bot.x, bot.y, huntVision);
      if (nearbyFood.length > 0) {
        const f = nearbyFood[0];
        bot.angle = Math.atan2(f.y - bot.y, f.x - bot.x);
      } else {
        bot.state = "EXPLORE";
        if (Math.random() < 0.4) bot.angle += (Math.random() - 0.5) * Math.PI;
      }
    }
  }

  // CHỈ CHO PHÉP BOT QUÉT ĐIỀU KIỆN CHÉM SAU MỖI 400ms (Độ trễ con người)
  if (now - bot.lastReaction > 400) {
    bot.lastReaction = now;

    // 70% cơ hội tung chiêu (30% cơ hội đứng nhìn do bị cuống)
    if (Math.random() < 0.70) {
      const weaponSize = bot.radius * (2.75 + 0.04 * ((bot.level || 1) - 1));
      const exactReach = bot.radius + weaponSize * 0.85;

      const potentialVictims = spatialIndex.searchNearbyPlayers(playerTree, bot.x, bot.y, exactReach);
      for (const v of potentialVictims) {
        if (v.id !== bot.id && !v.isDead) {
          if (now - (v.justRespawned || 0) >= CONFIG.HIT_COOLDOWN) {
            handlePlayerAttack(bot);
            break; 
          }
        }
      }
    }
  }
}

module.exports = { createBot, updateBot };
