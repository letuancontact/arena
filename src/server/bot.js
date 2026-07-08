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
    justRespawned: 0, // Bot sinh ra hoàn toàn không có khiên
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
    
    // NERF 1: CẬN THỊ - Giảm tầm nhìn săn mồi từ x12 xuống x6 
    const huntVision = bot.radius * 6;
    const escapeVision = bot.radius * 12; // Nhưng vẫn nhìn xa để bỏ chạy nếu thấy kẻ thù mạnh
    
    const nearbyPlayers = spatialIndex.searchNearbyPlayers(playerTree, bot.x, bot.y, escapeVision);
    
    let nearestThreat = null;
    let nearestPrey = null;
    let minThreatDist = Infinity;
    let minPreyDist = Infinity;

    for (const p of nearbyPlayers) {
      if (p.id === bot.id || p.isDead) continue;
      
      // Tôn trọng vòng bảo vệ 5 giây của người chơi mới
      if (now - (p.justRespawned || 0) < CONFIG.HIT_COOLDOWN) continue; 
      
      const dist = Math.hypot(p.x - bot.x, p.y - bot.y);
      
      // Bỏ chạy nếu gặp người chơi hơn 1 cấp
      if (p.level > bot.level + 1) {
        if (dist < minThreatDist) { minThreatDist = dist; nearestThreat = p; }
      } else {
        if (dist < minPreyDist) { minPreyDist = dist; nearestPrey = p; }
      }
    }

    if (nearestThreat && minThreatDist < escapeVision) {
      bot.state = "ESCAPE";
      bot.angle = Math.atan2(bot.y - nearestThreat.y, bot.x - nearestThreat.x) + Math.PI;
      
      // Bot chỉ được quyền chạy nước rút (sprint) khi đang hoảng loạn trốn chạy
      if (minThreatDist < bot.radius * 4 && bot.xp > 0) bot.rightMouseDown = true;
    } 
    else if (nearestPrey && minPreyDist < huntVision) {
      bot.state = "ATTACK";
      bot.angle = Math.atan2(nearestPrey.y - bot.y, nearestPrey.x - bot.x);
      
      // NERF 2: CẤM TỐC BIẾN - Bot bị tước quyền dùng chạy nước rút khi đi săn người
      bot.rightMouseDown = false;
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

  // NERF 3: ĐỘ TRỄ CON NGƯỜI (HUMAN DELAY)
  // Mỗi khung hình, Bot có 25% cơ hội "bị ngáo" không vung kiếm ngay lập tức 
  // Dù người chơi đã nằm trong tầm chém. Điều này tạo cơ hội cho người chơi lách qua!
  if (Math.random() > 0.25) {
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

module.exports = { createBot, updateBot };
