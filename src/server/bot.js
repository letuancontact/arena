"use strict";

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
    isMoving: true, // Bot lúc nào cũng di chuyển
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
    
    // AI Memory
    state: "EXPLORE",
    changeStateTime: 0
  };
}

function updateBot(bot, foodTree, playerTree) {
  const now = Date.now();
  
  // 1. Bot suy nghĩ và đưa ra quyết định mỗi 500ms (Tiết kiệm CPU)
  if (now - bot.changeStateTime > 500) {
    bot.changeStateTime = now;
    bot.rightMouseDown = false;
    
    // Tầm nhìn của bot (Bán kính cơ thể x 12)
    const visionRange = bot.radius * 12;
    
    // Quét tìm kẻ thù hoặc con mồi bằng RBush
    const nearbyPlayers = spatialIndex.searchNearbyPlayers(playerTree, bot.x, bot.y, visionRange);
    
    let nearestThreat = null;
    let nearestPrey = null;
    let minThreatDist = Infinity;
    let minPreyDist = Infinity;

    for (const p of nearbyPlayers) {
      if (p.id === bot.id || p.isDead) continue;
      
      const dist = Math.hypot(p.x - bot.x, p.y - bot.y);
      // Sợ kẻ thù level cao hơn
      if (p.level > bot.level) {
        if (dist < minThreatDist) { minThreatDist = dist; nearestThreat = p; }
      } 
      // Bắt nạt con mồi level bé hơn hoặc bằng
      else {
        if (dist < minPreyDist) { minPreyDist = dist; nearestPrey = p; }
      }
    }

    // --- State Machine (Máy Trạng Thái) ---
    if (nearestThreat && minThreatDist < visionRange) {
      bot.state = "ESCAPE";
      // Chạy ngược hướng kẻ thù
      bot.angle = Math.atan2(bot.y - nearestThreat.y, bot.x - nearestThreat.x) + Math.PI;
      
      // Chạy nước rút nếu có XP và kẻ thù đuổi quá sát
      if (minThreatDist < bot.radius * 5 && bot.xp > 0) bot.rightMouseDown = true;
    } 
    else if (nearestPrey && minPreyDist < visionRange) {
      bot.state = "ATTACK";
      // Đuổi theo con mồi
      bot.angle = Math.atan2(nearestPrey.y - bot.y, nearestPrey.x - bot.x);
      
      // Chạy nước rút nếu con mồi ở xa
      if (minPreyDist > bot.radius * 3 && bot.xp > 0) bot.rightMouseDown = true;
    } 
    else {
      bot.state = "COLLECT";
      // Quét tìm thức ăn gần nhất
      const nearbyFood = spatialIndex.searchNearbyFood(foodTree, bot.x, bot.y, visionRange);
      if (nearbyFood.length > 0) {
        const f = nearbyFood[0];
        bot.angle = Math.atan2(f.y - bot.y, f.x - bot.x);
      } else {
        bot.state = "EXPLORE";
        // Random đổi hướng đi dạo
        if (Math.random() < 0.4) bot.angle += (Math.random() - 0.5) * Math.PI;
      }
    }
  }

  // 2. Tự động vung kiếm nếu có con mồi trong tầm (Chạy liên tục mỗi 16ms)
  if (bot.state === "ATTACK") {
    const weaponReach = bot.radius * 4.5;
    const potentialVictims = spatialIndex.searchNearbyPlayers(playerTree, bot.x, bot.y, weaponReach);
    
    for (const v of potentialVictims) {
      if (v.id !== bot.id && !v.isDead && v.level <= bot.level) {
        // Mô phỏng việc click chuột trái chém y như người thật
        handlePlayerAttack(bot);
        break;
      }
    }
  }
}

module.exports = { createBot, updateBot };
