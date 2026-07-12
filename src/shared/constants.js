"use strict";

const GAME_CONFIG = {
  // Bản đồ & Số lượng
  MAP_WIDTH: 3000,
  MAP_HEIGHT: 2000,
  MAX_PLAYERS: 20,
  MAX_FOOD: 400,
  FOOD_COUNT: 400,
  MAX_LEVEL: 40,

  // Thông số di chuyển & nội suy
  MIN_SPEED: 2.2,
  MAX_SPEED: 4,
  SPRINT_MULTIPLIER: 2,
  BOT_SPEED_MULTIPLIER: 0.55,  // BOT GIỜ CHỈ CHẠY BẰNG 55% NGƯỜI CHƠI CHÍNH (Cực chậm)
  MIN_VELOCITY: 0.1,
  SMOOTHING_FACTOR: 0.15,
  ANGLE_LERP: 0.25,

  // Thông số Mạng
  SERVER_TICK_RATE: 16,
  SERVER_BROADCAST_RATE: 50,
  HEAVY_TICK_RATE: 200,
  CLIENT_BUFFER_DELAY: 50,
  CLIENT_SEND_INTERVAL: 50,
  ANGLE_SEND_THRESHOLD: 0.05,

  // Chiến đấu (Combat)
  BASE_ATTACK_DURATION: 320,
  ATTACK_DURATION_PER_LEVEL: 10,
  ATTACK_SWING_ANGLE: Math.PI,
  HIT_COOLDOWN: 5000,          
  RESPAWN_TIME: 5000,

  // Kinh nghiệm (XP)
  XP_LOSS_PERCENT: 0.025,
  XP_LOSS_INTERVAL: 200,
  KILL_SCORE_MULTIPLIER_ATTACKER: 0.3,
  KILL_SCORE_MULTIPLIER_HUD: 0.6,
  
  FOOD_TYPES: [
    { radius: 8, xp: 5, type: 0 }, { radius: 8, xp: 6, type: 1 }, { radius: 8, xp: 7, type: 2 },
    { radius: 12, xp: 10, type: 3 }, { radius: 12, xp: 12, type: 4 }, { radius: 12, xp: 14, type: 5 },
    { radius: 16, xp: 18, type: 6 }, { radius: 16, xp: 22, type: 7 }, { radius: 16, xp: 26, type: 8 },
    { radius: 18, xp: 30, type: 9 }, { radius: 20, xp: 34, type: 10 }, { radius: 22, xp: 38, type: 11 },
  ],

  RADIUS_TABLE: [
    20, 30, 35, 36, 35, 36, 38, 44, 39, 41, 
    42, 44, 44.5, 43, 43.5, 46, 47, 58, 49, 52,
    60, 58, 58, 72, 77, 60, 64, 68, 70, 72, 
    76, 68, 70, 72, 76, 78, 72, 84, 77, 78, 
  ]
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = GAME_CONFIG;
} else if (typeof window !== "undefined") {
  window.GAME_CONFIG = GAME_CONFIG;
}
