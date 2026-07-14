// --- src/client/state.js ---
const CONFIG = window.GAME_CONFIG;

export const GameState = {
  playerId: null,
  players: {},
  food: [],
  mapWidth: CONFIG.MAP_WIDTH,
  mapHeight: CONFIG.MAP_HEIGHT,
  clientX: null,
  clientY: null,
  clientRadius: 20,
  clientLevel: 1,
  clientXp: 0,
  clientXpToNext: 100,
  targetX: null,
  targetY: null,
  velocityX: 0,
  velocityY: 0,
  lastDx: 0,
  lastDy: 0,
  isMoving: false,
  rightMouseDown: false,
  lastSentX: 0,
  lastSentY: 0,
  lastSentTime: 0,
  lastSentAngle: 0,
  mouseAngle: 0,
  targetMouseAngle: 0, // ĐÃ THÊM: Điểm neo để xoay nhân vật mềm mại
  stateBuffer: [],
  prevPositions: {},
  prevAngles: {},
  mouseX: 0,
  mouseY: 0,
  mouseMoveThrottled: false,
  isAttacking: false,
  attackTime: 0,
  lastAttackTime: 0,
  prevPlayerDeadState: {},
  prevPlayerLevels: {},
  
  isTouch: false, 
  sprintTouchId: null, 
  joystick: {
    active: false,
    id: null, 
    baseX: 0,
    baseY: 0,
    stickX: 0,
    stickY: 0
  },

  getXpToNext(level) {
    return Math.floor(100 * Math.pow(1.35, level - 1));
  },
  getRadiusByLevel(level) {
    return CONFIG.RADIUS_TABLE[Math.max(0, Math.min(CONFIG.RADIUS_TABLE.length - 1, level - 1))];
  },
  getSpeedByLevel(level) {
    const t = (level - 1) / (CONFIG.MAX_LEVEL - 1);
    return CONFIG.MAX_SPEED - (CONFIG.MAX_SPEED - CONFIG.MIN_SPEED) * Math.sqrt(t);
  }
};
