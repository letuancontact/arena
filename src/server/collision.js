function weaponHitsPlayer(attacker, victim, getWeaponBaseAndTip) {
  const level = attacker.level || 1;
  const checkArms = level >= 37 ? ["left", "right"] : ["left"];
  for (const which of checkArms) {
    const { base, tip } = getWeaponBaseAndTip(attacker, which);
    const steps = 5;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = base.x + (tip.x - base.x) * t;
      const y = base.y + (tip.y - base.y) * t;
      const dist = Math.hypot(x - victim.x, y - victim.y);
      if (dist < victim.radius) return true;
    }
  }
  return false;
}
function checkFoodCollision(player, food) {
  const dist = Math.hypot(player.x - food.x, player.y - food.y);
  return dist < player.radius + food.radius;
}
module.exports = { weaponHitsPlayer, checkFoodCollision };
