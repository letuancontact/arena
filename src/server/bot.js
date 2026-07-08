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
    justRespawned: 0, // SỬA LỖI: Bot sinh ra lần đầu TUYỆT ĐỐI KHÔNG có khiên
    isDead: false,
    deadTime: 0,
    lastXpDrain: 0,
    hitVictims: new Set(),
    isBot: true,
    state: "EXPLORE",
    changeStateTime: 0
  };
}

function updateBot(bot, foodTree, playerTree) {
  const now = Date.now();
  
  if (now - bot.changeStateTime > 500) {
    bot.changeStateTime = now;
    bot.rightMouseDown = false;
    
    const visionRange = bot.radius * 12;
    const nearbyPlayers = spatialIndex.searchNearbyPlayers(playerTree, bot.x, bot.y, visionRange);
    
    let nearestThreat = null;
    let nearestPrey = null;
    let minThreatDist = Infinity;
    let minPreyDist = Infinity;

    for (const p of nearbyPlayers) {
      if (p.id === bot.id || p.isDead) continue;
      if (now - (p.justRespawned || 0) < CONFIG.HIT_COOLDOWN) continue; // Bỏ qua người có khiên
      
      const dist = Math.hypot(p.x - bot.x, p.y - bot.y);
      if (p.level > bot.level + 3) {
        if (dist < minThreatDist) { minThreatDist = dist; nearestThreat = p; }
      } else {
        if (dist < minPreyDist) { minPreyDist = dist; nearestPrey = p; }
      }
    }

    if (nearestThreat && minThreatDist < visionRange) {
      bot.state = "ESCAPE";
      bot.angle = Math.atan2(bot.y - nearestThreat.y, bot.x - nearestThreat.x) + Math.PI;
      if (minThreatDist < bot.radius * 5 && bot.xp > 0) bot.rightMouseDown = true;
    } 
    else if (nearestPrey && minPreyDist < visionRange) {
      bot.state = "ATTACK";
      bot.angle = Math.atan2(nearestPrey.y - bot.y, nearestPrey.x - bot.x);
      if (minPreyDist > bot.radius * 3 && bot.xp > 0) bot.rightMouseDown = true;
    } 
    else {
      bot.state = "COLLECT";
      const nearbyFood = spatialIndex.searchNearbyFood(foodTree, bot.x, bot.y, visionRange);
      if (nearbyFood.length > 0) {
        const f = nearbyFood[0];
        bot.angle = Math.atan2(f.y - bot.y, f.x - bot.x);
      } else {
        bot.state = "EXPLORE";
        if (Math.random() < 0.4) bot.angle += (Math.random() - 0.5) * Math.PI;
      }
    }
  }

  // SỬA LỖI TẦM CHÉM CỦA BOT: Giảm tầm quét vũ khí xuống khớp với chiều dài kiếm thực tế
  const weaponSize = bot.radius * (2.75 + 0.04 * (bot.level - 1));
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

module.exports = { createBot, updateBot };
