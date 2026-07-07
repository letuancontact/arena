const { randomName, uuid } = require("./utils");
const { getRadiusByLevel } = require("./player");

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
    isAttacking: false,
    attackTime: 0,
    lastAttackTime: 0,
    justRespawned: 0,
    isDead: false,
    deadTime: 0,
    rightMouseDown: false,
    angle: Math.random() * Math.PI * 2,
    isBot: true,
  };
}
function updateBot(bot, mapWidth, mapHeight) {
  const MIN_SPEED = 2.2;
  const MAX_SPEED = 4;
  const t = (bot.level - 1) / 39;
  const speed = MAX_SPEED - (MAX_SPEED - MIN_SPEED) * Math.sqrt(t);
  const nextX = bot.x + Math.cos(bot.angle) * speed;
  const nextY = bot.y + Math.sin(bot.angle) * speed;
  const margin = bot.radius + 20;
  if (
    nextX < margin ||
    nextX > mapWidth - margin ||
    nextY < margin ||
    nextY > mapHeight - margin
  ) {
    bot.angle = Math.random() * Math.PI * 2;
  }
  bot.x += Math.cos(bot.angle) * speed;
  bot.y += Math.sin(bot.angle) * speed;
  bot.x = Math.max(bot.radius, Math.min(mapWidth - bot.radius, bot.x));
  bot.y = Math.max(bot.radius, Math.min(mapHeight - bot.radius, bot.y));
}
module.exports = { createBot, updateBot };
