// --- src/client/main.js ---

// =======================================================
// HACK: BỘ ĐÁNH CHẶN DỮ LIỆU ĐỂ BẮT LẤY TÊN NGƯỜI GIẾT
// =======================================================
const originalParse = JSON.parse;
JSON.parse = function(text, reviver) {
    const data = originalParse(text, reviver);
    if (data && typeof data === 'object') {
        // Quét tìm tất cả các khóa có thể chứa tên kẻ địch từ Server gửi về
        const possibleKiller = data.killerName || data.killer || data.killedBy || data.by || data.name;
        // Kiểm tra xem dữ liệu này có đi kèm tín hiệu chết hay không
        if (possibleKiller && (data.type === 'dead' || data.type === 'death' || data.isDead || data.killer)) {
            window.LAST_KILLER_NAME = possibleKiller; 
            localStorage.setItem('last_killer', possibleKiller);
        }
    }
    return data;
};
// =======================================================

import { GameState } from './state.js';
import { Camera, Resources, Renderer } from './renderer.js';
import { Sound } from './audio.js';
import { Network } from './network.js';
import { Input } from './input.js';

const CONFIG = window.GAME_CONFIG;
const canvas = document.getElementById("game");

GameState.freezeUntil = 0;
let respawnInterval = null; 

const uiLayer = document.getElementById("ui-layer");
const lobbyScreen = document.getElementById("lobby-screen");
const gameOverScreen = document.getElementById("game-over-screen");
const playBtn = document.getElementById("play-btn");
const respawnBtn = document.getElementById("respawn-btn");
const nameInput = document.getElementById("player-name");
const muteBtn = document.getElementById("mute-btn");
const statusText = document.getElementById("status-text");

playBtn.addEventListener("mouseenter", () => { Sound.init(); Sound.play('hover'); });
respawnBtn.addEventListener("mouseenter", () => { Sound.init(); Sound.play('hover'); });
nameInput.addEventListener("mouseenter", () => { Sound.init(); Sound.play('hover'); });
nameInput.addEventListener("focus", () => { Sound.init(); Sound.play('click'); });

muteBtn.addEventListener("click", () => {
    Sound.init();
    const muted = Sound.toggleMute();
    muteBtn.innerHTML = muted ? "🔇" : "🔊";
    if (!muted) Sound.play('click');
});

nameInput.value = localStorage.getItem("evowar_name") || "";

function startGame() {
  Sound.init(); Sound.play('click');
  if (!Network.ws || Network.ws.readyState !== WebSocket.OPEN) return;
  
  const name = nameInput.value.trim() || "Khách"; 
  localStorage.setItem("evowar_name", name);
  
  if (respawnInterval) clearInterval(respawnInterval);
  
  uiLayer.style.display = 'none';
  lobbyScreen.style.display = 'none';
  gameOverScreen.style.display = 'none';
  statusText.innerText = "";

  Network.ws.send(JSON.stringify({ type: "join", name: name }));
}

playBtn.addEventListener("click", startGame);
respawnBtn.addEventListener("click", startGame);
nameInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && !playBtn.disabled && !playBtn.hasAttribute("disabled")) startGame();
});

// ==========================================
// HÀM HIỂN THỊ GAME OVER HOÀN CHỈNH
// ==========================================
function triggerGameOver(level, kills, xp, killerName) {
    if (lobbyScreen && lobbyScreen.style.display !== 'none') return; 

    try {
        const currentLevel = level || GameState.clientLevel || 1;
        
        // --- XỬ LÝ LẤY TÊN TỪ BỘ ĐÁNH CHẶN ---
        let finalKiller = "MỘT KẺ VÔ DANH"; // Mặc định nếu tự đâm vào tường/lỗi
        
        if (typeof killerName === 'string' && killerName.trim() !== '') {
            finalKiller = killerName;
        } else if (window.LAST_KILLER_NAME) {
            finalKiller = window.LAST_KILLER_NAME;
        } else if (typeof GameState.killerName === 'string' && GameState.killerName.trim() !== '') {
            finalKiller = GameState.killerName;
        } else if (localStorage.getItem('last_killer')) { 
            finalKiller = localStorage.getItem('last_killer');
        }
        
        // Xóa dấu vết đợt trước để không bị trùng cho lượt chơi sau
        window.LAST_KILLER_NAME = "";
        localStorage.removeItem('last_killer');
        
        const killerEl = document.getElementById('go-killer-name');
        if (killerEl) killerEl.innerText = finalKiller;
        
        let nextLevel = currentLevel + 1;
        if (nextLevel > 40) nextLevel = 40; 
        const nextImgEl = document.getElementById('go-next-img');
        if (nextImgEl) nextImgEl.src = `img/lv${nextLevel}.png`;

        if (uiLayer) uiLayer.style.display = 'block';
        if (gameOverScreen) gameOverScreen.style.display = 'flex'; 

        // --- ĐẾM NGƯỢC 3 GIÂY ---
        const timerEl = document.getElementById('respawn-timer');
        let countdown = 3; 
        
        if (respawnBtn) respawnBtn.disabled = true; 
        if (timerEl) timerEl.innerText = `HỒI SINH SAU: ${countdown}s`;
        
        if (respawnInterval) clearInterval(respawnInterval);
        
        respawnInterval = setInterval(() => {
            countdown--;
            if (countdown > 0) {
                if (timerEl) timerEl.innerText = `HỒI SINH SAU: ${countdown}s`;
            } else {
                clearInterval(respawnInterval);
                if (timerEl) timerEl.innerText = "ĐÃ SẴN SÀNG!";
                if (respawnBtn) respawnBtn.disabled = false;
            }
        }, 1000);

    } catch (e) {
        console.warn("Lỗi UI ẩn:", e);
    }
}

export const showGameOver = triggerGameOver;
window.showGameOver = triggerGameOver; 
// ==========================================

export function enablePlayButton() {
    playBtn.disabled = false;
    playBtn.innerText = "PLAY";
    statusText.innerText = "SẴN SÀNG!";
    setTimeout(() => { statusText.innerText = ""; }, 1500);
}

function updatePhysics(dtMultiplier) {
  if (GameState.clientX === null || GameState.clientY === null || GameState.isDead) return;
  
  let diff = GameState.targetMouseAngle - GameState.mouseAngle;
  while (diff > Math.PI) diff -= 2 * Math.PI; while (diff < -Math.PI) diff += 2 * Math.PI;
  GameState.mouseAngle += diff * 0.15 * dtMultiplier;
  
  const attackDuration = CONFIG.BASE_ATTACK_DURATION + (GameState.clientLevel * CONFIG.ATTACK_DURATION_PER_LEVEL);
  
  if (GameState.isAttacking && Date.now() - GameState.attackTime < attackDuration) {
      const speed = GameState.getSpeedByLevel(GameState.clientLevel) * 0.3;
      GameState.clientX += Math.cos(GameState.mouseAngle) * speed * dtMultiplier;
      GameState.clientY += Math.sin(GameState.mouseAngle) * speed * dtMultiplier;
  } else if (GameState.isMoving) {
    const speed = GameState.getSpeedByLevel(GameState.clientLevel) * (GameState.rightMouseDown && GameState.clientXp > 0 ? CONFIG.SPRINT_MULTIPLIER : 1);
    GameState.clientX += Math.cos(GameState.mouseAngle) * speed * dtMultiplier;
    GameState.clientY += Math.sin(GameState.mouseAngle) * speed * dtMultiplier;
  }
  
  GameState.clientX = Math.max(GameState.clientRadius, Math.min(CONFIG.MAP_WIDTH - GameState.clientRadius, GameState.clientX));
  GameState.clientY = Math.max(GameState.clientRadius, Math.min(CONFIG.MAP_HEIGHT - GameState.clientRadius, GameState.clientY));

  if (GameState.serverX != null && GameState.serverY != null) {
    const dx = GameState.clientX - GameState.serverX, dy = GameState.clientY - GameState.serverY;
    const dist = Math.hypot(dx, dy);
    if (dist > 150) { GameState.clientX = GameState.serverX; GameState.clientY = GameState.serverY; } 
    else if (dist > 1) { 
      const lerpFactor = 1 - Math.pow(0.85, dtMultiplier); 
      GameState.clientX -= dx * lerpFactor; GameState.clientY -= dy * lerpFactor; 
    }
  }

  if (GameState.isAttacking && Date.now() - GameState.attackTime > attackDuration) GameState.isAttacking = false;
}

let lastFrameTime = null;
function loop(currentTime) {
  if (Date.now() < GameState.freezeUntil) { requestAnimationFrame(loop); return; }
  if (!lastFrameTime) lastFrameTime = currentTime;
  const dtMultiplier = Math.min((currentTime - lastFrameTime) / 1000, 0.05) * 60; 
  lastFrameTime = currentTime;
  
  updatePhysics(dtMultiplier); 
  Renderer.draw(dtMultiplier); 
  
  requestAnimationFrame(loop);
}

function main() {
  Renderer.resizeCanvas(); window.addEventListener("resize", Renderer.resizeCanvas);
  Resources.load(); 
  Renderer.setupUI(); 
  Network.connect(); 
  Input.setup(canvas);
  
  Camera.currentZoom = Camera.getZoomByLevel(1); Camera.targetZoom = Camera.currentZoom;
  muteBtn.innerHTML = Sound.isMuted ? "🔇" : "🔊";
  
  playBtn.disabled = true;
  playBtn.innerText = "ĐANG KẾT NỐI...";
  
  requestAnimationFrame(loop);
  
  let wasDead = true; 

  setInterval(() => {
    if (GameState.isDead && !wasDead) {
        wasDead = true;
        setTimeout(() => {
            if (gameOverScreen && gameOverScreen.style.display === 'none' && lobbyScreen.style.display === 'none') {
                triggerGameOver(GameState.clientLevel, GameState.kills, GameState.score, GameState.killerName);
            }
        }, 200);
    } 
    else if (!GameState.isDead && wasDead) {
        wasDead = false;
    }

    if (!GameState.isDead) Renderer.updateUI();
    if (GameState.clientXp <= 0 && GameState.rightMouseDown) { 
        GameState.rightMouseDown = false; 
        Network.sendPositionUpdate(true); 
    }
  }, CONFIG.UI_UPDATE_INTERVAL || 100);
}

main();
