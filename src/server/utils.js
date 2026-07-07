const crypto = require("crypto");
function randomName() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let name = "";
  for (let i = 0; i < 4; i++)
    name += chars[Math.floor(Math.random() * chars.length)];
  return name;
}
function uuid() {
  return crypto.randomUUID();
}
module.exports = { randomName, uuid };
