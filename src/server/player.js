const { RADIUS_TABLE } = require("./constants");
const { randomName, uuid } = require("./utils");

function getRadiusByLevel(level) {
  return RADIUS_TABLE[
    Math.max(0, Math.min(RADIUS_TABLE.length - 1, level - 1))
  ];
}
function getXpToNext(level) {
  return Math.floor(100 * Math.pow(1.2, level - 1));
}
function createPlayer(ws) {
  const id = uuid();
  return {
    id,
    x: 0,
    y: 0,
    radius: getRadiusByLevel(1),
    ws,
    level: 1,
    xp: 0,
    speed: 4,
    name: randomName(),
    score: 0,
    isAttacking: false,
    attackTime: 0,
    lastAttackTime: 0,
    justRespawned: 0,
    isDead: false,
    deadTime: 0,
    rightMouseDown: false,
  };
}
function handlePlayerMove(player, data, mapWidth, mapHeight) {
  if (player.isDead) return;
  // Nếu đang chém thì không cho di chuyển và đổi hướng
  const ATTACK_DURATION = 360; // ms, phải đồng bộ với client và server
  if (player.isAttacking && Date.now() - player.attackTime < ATTACK_DURATION) {
    return;
  }
  if (typeof data.x === "number" && typeof data.y === "number") {
    player.x = Math.max(
      player.radius,
      Math.min(mapWidth - player.radius, data.x)
    );
    player.y = Math.max(
      player.radius,
      Math.min(mapHeight - player.radius, data.y)
    );
  }
  if (typeof data.angle === "number") {
    player.angle = data.angle;
  }
  if (data.rightMouseDown && player.xp > 0) {
    player.speed = 8;
    player.rightMouseDown = true;
  } else {
    player.speed = 4;
    player.rightMouseDown = false;
  }
}
function handlePlayerAttack(player) {
  const now = Date.now();
  const cooldown = 500 + (player.level - 1) * 60;
  if (!player.lastAttackTime || now - player.lastAttackTime >= cooldown) {
    player.isAttacking = true;
    player.attackTime = now;
    player.lastAttackTime = now;
  }
}
function respawnPlayer(player, mapWidth, mapHeight) {
  player.x = Math.random() * mapWidth;
  player.y = Math.random() * mapHeight;
  player.isDead = false;
  player.justRespawned = Date.now();
  player.rightMouseDown = false;
}

module.exports = {
  getRadiusByLevel,
  getXpToNext,
  createPlayer,
  handlePlayerMove,
  handlePlayerAttack,
  respawnPlayer,
};
