"use strict";
const CONFIG = require("../shared/constants");

/**
 * CHƯƠNG 7 & 8: ARC HITBOX COLLISION
 * Kiểm tra va chạm theo Vùng Cung Tròn (Pizza slice). 
 * Chuẩn xác 100%, không có điểm mù như thuật toán check 5 điểm cũ.
 */
function weaponHitsPlayerArc(attacker, victim) {
  const reach = attacker.radius * 4.5; // Tầm chém dài gấp 4.5 lần bán kính cơ thể
  const dist = Math.hypot(victim.x - attacker.x, victim.y - attacker.y);
  
  // 1. Thoát nhanh: Nằm ngoài hoàn toàn tầm chém (đã cộng thêm bán kính nạn nhân)
  if (dist > reach + victim.radius) return false;
  
  // 2. Thoát nhanh: Nếu nạn nhân đứng đè lên gốc attacker thì chắc chắn trúng
  if (dist <= victim.radius) return true;

  // 3. Kỹ năng AOE 360 độ: Level 37 trở lên cầm 2 kiếm xoay tròn (trúng mọi góc)
  if (attacker.level >= 37) {
      return true;
  }
  
  // 4. Kiểm tra góc chém (Angle Check)
  const angleToVictim = Math.atan2(victim.y - attacker.y, victim.x - attacker.x);
  
  // Tính chênh lệch góc giữa hướng quay mặt của attacker và vị trí của victim
  let diff = angleToVictim - attacker.angle;
  
  // Chuẩn hóa góc về đoạn [-PI, PI] để tính toán đúng
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  diff = Math.abs(diff);

  // Nửa góc vung vũ khí. Ví dụ Swing 180 độ (PI) -> nửa góc là 90 độ (PI/2)
  const halfSwing = (CONFIG.ATTACK_SWING_ANGLE) / 2;
  
  // Nạn nhân có bán kính, nên dù tâm của họ nằm ngoài rìa cung chém, 
  // rìa cơ thể họ vẫn có thể quẹt vào kiếm. Tính góc mở rộng thêm dựa trên bán kính victim.
  const victimAngularSize = Math.asin(victim.radius / dist);
  
  // Nếu chênh lệch góc nhỏ hơn góc vung vũ khí + góc cơ thể nạn nhân -> TRÚNG ĐÒN
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
