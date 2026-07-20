// --- src/client/main.js ---
import { GameState } from './state.js';
import { Camera, Resources, Renderer } from './renderer.js';
import { Sound } from './audio.js';
import { Network } from './network.js';
import { Input } from './input.js';
import { HUD } from './HUDManager.js'; 

const CONFIG = window.GAME_CONFIG;
const canvas = document.getElementById("game");

GameState.freezeUntil = 0;
let respawnInterval = null; 
let isPlaying = false; 

const uiLayer = document.getElementById("ui-layer");
const lobbyScreen = document.getElementById("lobby-screen");
const gameOverScreen = document.getElementById("game-over-screen");
const playBtn = document.getElementById("play-btn");
const respawnBtn = document.getElementById("respawn-btn");
const nameInput = document.getElementById("player-name");
const statusText = document.getElementById("status-text");

const settingsBtn = document.getElementById("hud-settings-btn");
const settingsModal = document.getElementById("settings-modal");
const closeSettingsBtn = document.getElementById("close-settings-btn");
const volumeSlider = document.getElementById("volume-slider");
const languageSelect = document.getElementById("language-select");

if (settingsBtn) {
    settingsBtn.addEventListener("click", () => {
        Sound.init(); Sound.play('click');
        settingsModal.style.display = 'flex';
    });
}
if (closeSettingsBtn) {
    closeSettingsBtn.addEventListener("click", () => {
        Sound.play('click');
        settingsModal.style.display = 'none';
    });
}
if (volumeSlider) {
    volumeSlider.addEventListener("input", (e) => {
        const volume = parseFloat(e.target.value);
        if (Sound.setVolume) Sound.setVolume(volume);
        Sound.isMuted = (volume === 0);
    });
}

// === KHÓA KÉO TRÌNH DUYỆT (PULL-TO-REFRESH) TRÊN ĐIỆN THOẠI ===
if (uiLayer) {
    uiLayer.addEventListener('touchmove', (e) => {
        if (e.target.type !== 'range') e.preventDefault();
    }, { passive: false });
}
document.addEventListener('contextmenu', e => e.preventDefault());
// ==============================================================

if(playBtn) playBtn.addEventListener("mouseenter", () => { Sound.init(); Sound.play('hover'); });
if(respawnBtn) respawnBtn.addEventListener("mouseenter", () => { Sound.init(); Sound.play('hover'); });
if(nameInput) {
    nameInput.addEventListener("mouseenter", () => { Sound.init(); Sound.play('hover'); });
    nameInput.addEventListener("focus", () => { Sound.init(); Sound.play('click'); });
    nameInput.value = localStorage.getItem("evowar_name") || "";
}

function startGame() {
  if (isPlaying) return; // Chặn spam click
  if (playBtn && playBtn.disabled) return;
  if (respawnBtn && respawnBtn.disabled) return;

  Sound.init(); Sound.play('click');
  if (!Network.ws || Network.ws.readyState !== WebSocket.OPEN) {
      if (statusText) statusText.innerText = "Chưa kết nối được server!";
      return;
  }
  
  const name = nameInput ? (nameInput.value.trim() || "Khách") : "Khách"; 
  localStorage.setItem("evowar_name", name);
  
  if (respawnInterval) {
      clearInterval(respawnInterval);
      respawnInterval = null;
  }
  
  if (uiLayer) uiLayer.style.display = 'none';
  if (lobbyScreen) lobbyScreen.style.display = 'none';
  if (gameOverScreen) gameOverScreen.style.display = 'none';
  if (statusText) statusText.innerText = "";

  isPlaying = true;
  
  // Bọc lỗi an toàn để đảm bảo game luôn gửi được lệnh JOIN
  try {
      if(typeof HUD !== 'undefined' && HUD.showHUD) HUD.showHUD(true); 
  } catch (error) {
      console.error("Lỗi vẽ HUD, kiểm tra HTML:", error);
  }

  Network.ws.send(JSON.stringify({ type: "join", name: name }));
}

if(playBtn) playBtn.addEventListener("click", startGame);
if(respawnBtn) respawnBtn.addEventListener("click", startGame);
if(nameInput) {
    nameInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter" && !playBtn.disabled) startGame();
    });
}

function triggerGameOver(level, kills, xp, killerName) {
    if (lobbyScreen && lobbyScreen.style.display !== 'none') return; 
    if (!isPlaying) return; 
    
    isPlaying = false; 
    if (settingsModal) settingsModal.style.display = 'none'; 
    
    try {
        if(typeof HUD !== 'undefined' && HUD.showHUD) HUD.showHUD(false); 
    } catch (e) {
        console.error("Lỗi ẩn HUD:", e);
    }

    try {
        const currentLevel = level || GameState.clientLevel || 1;
        const finalKiller = (killerName && killerName.trim() !== '') ? killerName : "MỘT KẺ VÔ DANH";
        
        const killerEl = document.getElementById('go-killer-name');
        if (killerEl) killerEl.innerText = finalKiller;
        
        const evolutionMilestones = [1, 2, 6, 10, 15, 21, 28, 36, 45]; 
        let nextEvolutionLevel = evolutionMilestones.find(m => m > currentLevel); 
        if (!nextEvolutionLevel) nextEvolutionLevel = 45; 
        
        const nextImgEl = document.getElementById('go-next-img');
        if (nextImgEl) nextImgEl.src = `img/lv${nextEvolutionLevel}.png`;

        if (uiLayer) {
            uiLayer.style.display = 'block';
            uiLayer.style.opacity = '1';         
            uiLayer.style.transform = 'scale(1)'; 
        }
        if (lobbyScreen) lobbyScreen.style.display = 'none';
        if (gameOverScreen) {
            gameOverScreen.style.display = 'flex'; 
            gameOverScreen.style.opacity = '1';
        }

        const timerEl = document.getElementById('respawn-timer');
        let countdown = 3; 
        
        if (respawnBtn) {
            respawnBtn.disabled = true; 
            respawnBtn.style.pointerEvents = 'none';
        }
        if (timerEl) timerEl.innerText = `HỒI SINH SAU: ${countdown}s`;
        
        if (respawnInterval) clearInterval(respawnInterval);
        
        respawnInterval = setInterval(() => {
            countdown--;
            if (countdown > 0) {
                if (timerEl) timerEl.innerText = `HỒI SINH SAU: ${countdown}s`;
            } else {
                clearInterval(respawnInterval);
                respawnInterval = null;
                if (timerEl) timerEl.innerText = "ĐÃ SẴN SÀNG!";
                if (respawnBtn) {
                    respawnBtn.disabled = false;
                    respawnBtn.style.pointerEvents = 'auto';
                }
            }
        }, 1000);

    } catch (e) {
        console.warn("Lỗi UI Game Over:", e);
    }
}

export const showGameOver = triggerGameOver;
window.showGameOver = triggerGameOver; 

export function enablePlayButton() {
    if (!playBtn) return;
    playBtn.disabled = false;
    playBtn.innerText = "PLAY";
    if (statusText) {
        statusText.innerText = "SẴN SÀNG!";
        setTimeout(() => { statusText.innerText = ""; }, 1500);
    }
}

function updatePhysics(dtMultiplier) {
  if (GameState.clientX === null || GameState.clientY === null || GameState.isDead) return;
  
  let diff = GameState.targetMouseAngle - GameState.mouseAngle;
  while (diff > Math.PI) diff -= 2 * Math.PI; 
  while (diff < -Math.PI) diff += 2 * Math.PI;
  GameState.mouseAngle += diff * 0.6 * dtMultiplier;
  
  const attackDuration = CONFIG.BASE_ATTACK_DURATION + (GameState.clientLevel * CONFIG.ATTACK_DURATION_PER_LEVEL);
  
  let speed = 0;
  if (GameState.isAttacking && Date.now() - GameState.attackTime < attackDuration) {
      speed = GameState.getSpeedByLevel(GameState.clientLevel) * 0.3;
  } else if (GameState.isMoving) {
      speed = GameState.getSpeedByLevel(GameState.clientLevel) * (GameState.rightMouseDown && GameState.clientXp > 0 ? CONFIG.SPRINT_MULTIPLIER : 1);
  }

  if (speed > 0) {
      GameState.clientX += Math.cos(GameState.mouseAngle) * speed * dtMultiplier;
      GameState.clientY += Math.sin(GameState.mouseAngle) * speed * dtMultiplier;
  }
  
  GameState.clientX = Math.max(GameState.clientRadius, Math.min(CONFIG.MAP_WIDTH - GameState.clientRadius, GameState.clientX));
  GameState.clientY = Math.max(GameState.clientRadius, Math.min(CONFIG.MAP_HEIGHT - GameState.clientRadius, GameState.clientY));

  if (GameState.serverX != null && GameState.serverY != null) {
    const dx = GameState.serverX - GameState.clientX;
    const dy = GameState.serverY - GameState.clientY;
    const dist = Math.hypot(dx, dy);

    if (dist > 150) { 
        GameState.clientX = GameState.serverX; 
        GameState.clientY = GameState.serverY; 
    } 
    else if (dist > 10) { 
        const lerpFactor = 1 - Math.pow(0.85, dtMultiplier); 
        GameState.clientX += dx * lerpFactor; 
        GameState.clientY += dy * lerpFactor; 
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
  
  if (playBtn) {
      playBtn.disabled = true;
      playBtn.innerText = "ĐANG KẾT NỐI...";
  }
  
  requestAnimationFrame(loop);
  
  let wasDead = true; 

  setInterval(() => {
    if (GameState.isDead && !wasDead) {
        wasDead = true;
        setTimeout(() => {
            if (gameOverScreen && gameOverScreen.style.display === 'none' && isPlaying) {
                triggerGameOver(GameState.clientLevel, GameState.kills, GameState.clientXp, GameState.killerName);
            }
        }, 250);
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
