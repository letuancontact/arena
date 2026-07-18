// --- src/client/main.js ---
import { GameState } from './state.js';
import { Camera, Resources, Renderer } from './renderer.js';
import { Sound } from './audio.js';
import { Network } from './network.js';
import { Input } from './input.js';

const CONFIG = window.GAME_CONFIG;
const canvas = document.getElementById("game");

GameState.freezeUntil = 0;

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
  
  // ẨN SẠCH MỌI LỚP UI ĐỂ VÀO GAME
  uiLayer.style.display = 'none';
  lobbyScreen.style.display = 'none';
  gameOverScreen.style.display = 'none';
  statusText.innerText = "";

  Network.ws.send(JSON.stringify({ type: "join", name: name }));
}

playBtn.addEventListener("click", startGame);
respawnBtn.addEventListener("click", startGame);
nameInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && !playBtn.disabled) startGame();
});

// ==========================================
// HÀM HIỂN THỊ GAME OVER BẤT TỬ
// ==========================================
function triggerGameOver(level, kills, xp, killerName) {
    // 1. KHÓA TỬ: Tuyệt đối không hiện Game Over nếu đang ở màn hình Đăng Nhập
    if (lobbyScreen && lobbyScreen.style.display !== 'none') {
        return; 
    }

    try {
        const currentLevel = level || GameState.clientLevel || 1;
        
        // 2. TÌM TÊN KẺ THÙ: Ưu tiên tên từ Network truyền vào -> Tìm trong GameState -> Dự phòng
        let finalKiller = "MỘT KẺ VÔ DANH";
        if (typeof killerName === 'string' && killerName.trim() !== '') finalKiller = killerName;
        else if (typeof GameState.killerName === 'string' && GameState.killerName.trim() !== '') finalKiller = GameState.killerName;
        
        const killerEl = document.getElementById('go-killer-name');
        if (killerEl) killerEl.innerText = finalKiller;
        
        let nextLevel = currentLevel + 1;
        if (nextLevel > 40) nextLevel = 40; 
        const nextImgEl = document.getElementById('go-next-img');
        if (nextImgEl) nextImgEl.src = `img/lv${nextLevel}.png`;

        // 3. ÉP MỞ BẢNG 3 CỘT
        if (uiLayer) uiLayer.style.display = 'block';
        if (gameOverScreen) gameOverScreen.style.display = 'flex'; 
    } catch (e) {
        console.warn("Bỏ qua lỗi nhẹ để ép UI hiện:", e);
    }
}

// XUẤT HÀM ĐA CHIỀU (Đảm bảo file network.js gọi bằng cách nào cũng trúng)
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
    // 4. RADAR DỰ PHÒNG: Lưới an toàn cuối cùng.
    // Nếu nhân vật chết mà sau 0.2s cái bảng Game Over vẫn cứng đầu không chịu hiện ra, Radar sẽ ép gọi hàm.
    if (GameState.isDead && !wasDead) {
        wasDead = true;
        setTimeout(() => {
            if (gameOverScreen && gameOverScreen.style.display === 'none' && lobbyScreen.style.display === 'none') {
                triggerGameOver(GameState.clientLevel, GameState.kills, GameState.score, GameState.killerName);
            }
        }, 200);
    } 
    // Nhân vật hồi sinh thành công thì reset lại radar
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
