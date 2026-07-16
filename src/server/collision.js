// --- src/server/collision.js ---
"use strict";
const CONFIG = require("../shared/constants");

function weaponHitsPlayerArc(attacker, victim) {
  const weaponSize = attacker.radius * (2.75 + 0.04 * ((attacker.level || 1) - 1));
  const exactReach = attacker.radius + weaponSize * 0.85; 
  
  const dist = Math.hypot(victim.x - attacker.x, victim.y - attacker.y);
  
  if (dist > exactReach + victim.radius) return false;
  if (dist <= victim.radius) return true;

  const angleToVictim = Math.atan2(victim.y - attacker.y, victim.x - attacker.x);
  let diff = angleToVictim - attacker.angle;
  
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  diff = Math.abs(diff);

  // ĐÃ FIX: Mở rộng góc vung kiếm cho Level 37+ thay vì auto-hit
  let halfSwing = (CONFIG.ATTACK_SWING_ANGLE) / 2;
  if (attacker.level >= 37) {
    halfSwing = (CONFIG.ATTACK_SWING_ANGLE * 1.6) / 2; // Rộng hơn 60%
  }

  const victimAngularSize = Math.asin(victim.radius / dist);
  
  if (diff <= halfSwing + victimAngularSize) {
      return true;
  }

  return false;
}

function checkFoodCollision(player, food) {
  const dist = Math.hypot(player.x - food.x, player.y - food.y);
  return dist < player.radius + food.radius;
}

module.exports = { weaponHitsPlayerArc, checkFoodCollision };
