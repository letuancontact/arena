// Chỉ giữ lại comment đầu dòng thực sự cần thiết
const MAP_WIDTH = 6000;
const MAP_HEIGHT = 3000;
const MAX_LEVEL = 40;
const FOOD_TYPES = [
  { radius: 8, xp: 5, type: 0 },
  { radius: 8, xp: 6, type: 1 },
  { radius: 8, xp: 7, type: 2 },
  { radius: 12, xp: 10, type: 3 },
  { radius: 12, xp: 12, type: 4 },
  { radius: 12, xp: 14, type: 5 },
  { radius: 16, xp: 18, type: 6 },
  { radius: 16, xp: 22, type: 7 },
  { radius: 16, xp: 26, type: 8 },
  { radius: 18, xp: 30, type: 9 },
  { radius: 20, xp: 34, type: 10 },
  { radius: 22, xp: 38, type: 11 },
];
const RADIUS_TABLE = [
  20,
  30,
  35,
  36,
  35,
  36,
  38,
  44,
  39,
  41, // 1-10
  42,
  44,
  44.5,
  43,
  43.5,
  46,
  47,
  58,
  49,
  52, // 11-20
  60,
  58,
  58,
  72,
  77,
  60,
  64,
  68,
  70,
  72, // 21-30
  76,
  68,
  70,
  72,
  76,
  78,
  72,
  84,
  77,
  78, // 31-40
];
const FOOD_COUNT = 650;
const MAX_PLAYERS = 20;

module.exports = {
  MAP_WIDTH,
  MAP_HEIGHT,
  MAX_LEVEL,
  FOOD_TYPES,
  RADIUS_TABLE,
  FOOD_COUNT,
  MAX_PLAYERS,
};
