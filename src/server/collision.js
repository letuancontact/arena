// --- src/server/collision.js ---
"use strict";
const CONFIG = require("../shared/constants");

function weaponHitsPlayerArc(attacker, victim) {
  // 1. TÍNH TOÁN TẦM CHÉM CHUẨN XÁC: 
  // Dựa đúng vào công thức vẽ ảnh kiếm (baseRatio 2.75, growPerLevel 0.04)
  const weaponSize = attacker.radius * (2.75 + 0.04 * ((attacker.level || 1) - 1));
  const exactReach = attacker.radius + weaponSize * 0.85; // 0.85 là tỷ lệ bù trừ khít với mũi kiếm đồ họa
  
  const dist = Math.hypot(victim.x - attacker.x, victim.y - attacker.y);
  
  // Nằm ngoài hoàn toàn tầm chém (đã cộng thêm bán kính nạn nhân)
  if (dist > exactReach + victim.radius) return false;
  
  // Đè lên nhau
  if (dist <= victim.radius) return true;
  
  // Kiểm tra góc vung kiếm
  const angleToVictim = Math.atan2(victim.y - attacker.y, victim.x - attacker.x);
  let diff = angleToVictim - attacker.angle;
  
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  diff = Math.abs(diff);

  // Mở rộng góc vung kiếm cho Level 37+ (Vì cầm 2 kiếm) thay vì auto-hit 360 độ
  let halfSwing = (CONFIG.ATTACK_SWING_ANGLE) / 2;
  if (attacker.level >= 37) {
    halfSwing = (CONFIG.ATTACK_SWING_ANGLE * 1.6) / 2; 
  }

  const victimAngularSize = Math.asin(victim.radius / dist);
  
  if (diff <= halfSwing + victimAngularSize) {
      return true;
  }

  return false;
}

function checkFoodCollision(player, food) {
  const dist = Math.hypot(player.x - food.x, player.y - food.y);
  // ĐÃ SỬA: Tăng bán kính va chạm để tạo hiệu ứng "Nam Châm" (Hút XP từ xa)
  const magnetRadius = player.radius + 120;
  return dist < magnetRadius + food.radius;
}

module.exports = { weaponHitsPlayerArc, checkFoodCollision };
