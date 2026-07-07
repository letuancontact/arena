"use strict";

const CONFIG = require("../shared/constants");
const { randomName, uuid } = require("./utils");

function getRadiusByLevel(level) {
  return CONFIG.RADIUS_TABLE[Math.max(0, Math.min(CONFIG.RADIUS_TABLE.length - 1, level - 1))];
}

function getXpToNext(level) {
  return Math.floor(100 * Math.pow(1.2, level - 1));
}

function createPlayer(ws) {
  const id = uuid();
  return {
    id,
    ws,
    x: 0,
    y: 0,
    radius: getRadiusByLevel(1),
    level: 1,
    xp: 0,
    speed: 4,
    name: randomName(),
    score: 0,
    angle: 0,
    isMoving: false,
    rightMouseDown: false,
    isAttacking: false,
    attackTime: 0,
    lastAttackTime: 0,
    justRespawned: 0,
    isDead: false,
    deadTime: 0,
    lastXpDrain: 0,
    hitVictims: new Set()
  };
}

// CHƯƠNG 13: Authoritative Logic - Chỉ nhận THAO TÁC, từ chối nhận TỌA ĐỘ từ Client
function handlePlayerMove(player, data) {
  if (player.isDead) return;
  if (typeof data.angle === "number") player.angle = data.angle;
  if (typeof data.isMoving === "boolean") player.isMoving = data.isMoving;
  player.rightMouseDown = !!data.rightMouseDown;
}

function handlePlayerAttack(player) {
  const now = Date.now();
  const cooldown = 500 + (player.level - 1) * 60;
  if (!player.lastAttackTime || now - player.lastAttackTime >= cooldown) {
    player.isAttacking = true;
    player.attackTime = now;
    player.lastAttackTime = now;
    if (player.hitVictims) player.hitVictims.clear();
  }
}

// CHƯƠNG 13: Game Loop Physics cho Player chạy trực tiếp trên Server
function updatePhysics(player, mapWidth, mapHeight) {
  if (player.isDead) return;

  const attackDuration = CONFIG.BASE_ATTACK_DURATION + (player.level * CONFIG.ATTACK_DURATION_PER_LEVEL);
  
  // Đứng im khi đang vung kiếm
  if (player.isAttacking && Date.now() - player.attackTime < attackDuration) {
    return;
  }

  // Quản lý Chạy nước rút (Sprint) & Tự động trừ XP trên Server
  let isSprinting = false;
  if (player.rightMouseDown && player.xp > 0 && player.level >= 1) {
    isSprinting = true;
    const now = Date.now();
    if (!player.lastXpDrain) player.lastXpDrain = now;
    
    if (now - player.lastXpDrain >= CONFIG.XP_LOSS_INTERVAL) {
      const xpToNext = getXpToNext(player.level);
      const amount = Math.floor(xpToNext * CONFIG.XP_LOSS_PERCENT) || 1;
      
      player.xp -= amount;
      player.score = Math.max(0, player.score - amount);
      
      if (player.xp <= 0) {
        player.xp = 0;
        player.rightMouseDown = false;
        isSprinting = false;
      }
      player.lastXpDrain = now;
    }
  } else {
    player.rightMouseDown = false;
  }

  // Di chuyển (Physics)
  if (player.isMoving) {
    const t = (player.level - 1) / (CONFIG.MAX_LEVEL - 1);
    const baseSpeed = CONFIG.MAX_SPEED - (CONFIG.MAX_SPEED - CONFIG.MIN_SPEED) * Math.sqrt(t);
    const speed = baseSpeed * (isSprinting ? CONFIG.SPRINT_MULTIPLIER : 1);
    
    player.x += Math.cos(player.angle) * speed;
    player.y += Math.sin(player.angle) * speed;
    
    // Giới hạn biên
    player.x = Math.max(player.radius, Math.min(mapWidth - player.radius, player.x));
    player.y = Math.max(player.radius, Math.min(mapHeight - player.radius, player.y));
  }
}

function respawnPlayer(player, mapWidth, mapHeight) {
  player.x = Math.random() * mapWidth;
  player.y = Math.random() * mapHeight;
  player.radius = getRadiusByLevel(1);
  player.level = 1;
  player.xp = 0;
  player.speed = 4;
  player.score = 0;
  player.isDead = false;
  player.justRespawned = Date.now();
  player.hitVictims = new Set();
}

module.exports = {
  getRadiusByLevel,
  getXpToNext,
  createPlayer,
  handlePlayerMove,
  handlePlayerAttack,
  updatePhysics,
  respawnPlayer
};
