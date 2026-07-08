"use strict";

const { FOOD_TYPES, FOOD_COUNT, MAP_WIDTH, MAP_HEIGHT } = require("../shared/constants");
const { uuid } = require("./utils");

function spawnFood(foodList) {
  const addedFood = []; // Mảng chứa thức ăn mới sinh ra
  while (foodList.length < FOOD_COUNT) {
    const foodType = FOOD_TYPES[Math.floor(Math.random() * FOOD_TYPES.length)];
    const newFood = {
      id: uuid(),
      x: Math.random() * MAP_WIDTH,
      y: Math.random() * MAP_HEIGHT,
      radius: foodType.radius,
      xp: foodType.xp,
      type: foodType.type,
    };
    foodList.push(newFood);
    addedFood.push(newFood);
  }
  return addedFood;
}

module.exports = { spawnFood };
