const RBush = require("rbush");

// Food: {id, x, y, radius, ...}
function buildFoodIndex(foodList) {
  const tree = new RBush();
  const items = foodList.map((f) => ({
    minX: f.x - f.radius,
    minY: f.y - f.radius,
    maxX: f.x + f.radius,
    maxY: f.y + f.radius,
    ref: f,
  }));
  tree.load(items);
  return tree;
}
function searchNearbyFood(tree, x, y, radius) {
  return tree
    .search({
      minX: x - radius,
      minY: y - radius,
      maxX: x + radius,
      maxY: y + radius,
    })
    .map((item) => item.ref);
}
// Player: {id, x, y, radius, ...}
function buildPlayerIndex(playerList) {
  const tree = new RBush();
  const items = playerList.map((p) => ({
    minX: p.x - p.radius,
    minY: p.y - p.radius,
    maxX: p.x + p.radius,
    maxY: p.y + p.radius,
    ref: p,
  }));
  tree.load(items);
  return tree;
}
function searchNearbyPlayers(tree, x, y, radius) {
  return tree
    .search({
      minX: x - radius,
      minY: y - radius,
      maxX: x + radius,
      maxY: y + radius,
    })
    .map((item) => item.ref);
}

module.exports = {
  buildFoodIndex,
  searchNearbyFood,
  buildPlayerIndex,
  searchNearbyPlayers,
};
