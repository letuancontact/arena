const {
  FOOD_TYPES,
  FOOD_COUNT,
  MAP_WIDTH,
  MAP_HEIGHT,
} = require("./constants");
const { uuid } = require("./utils");
function spawnFood(foodList) {
  while (foodList.length < FOOD_COUNT) {
    const foodType = FOOD_TYPES[Math.floor(Math.random() * FOOD_TYPES.length)];
    foodList.push({
      id: uuid(),
      x: Math.random() * MAP_WIDTH,
      y: Math.random() * MAP_HEIGHT,
      radius: foodType.radius,
      xp: foodType.xp,
      type: foodType.type,
    });
  }
}
module.exports = { spawnFood };
