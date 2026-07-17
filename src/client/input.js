// --- src/client/input.js ---
import { GameState } from './state.js';
import { Network } from './network.js';
import { Sound } from './audio.js';

export const Input = {
  setup(canvas) {
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    
    canvas.addEventListener("mousemove", (e) => {
      if (GameState.mouseMoveThrottled || GameState.isTouch) return;
      GameState.mouseMoveThrottled = true;
      requestAnimationFrame(() => {
        GameState.lastDx = e.clientX - window.innerWidth / 2; GameState.lastDy = e.clientY - window.innerHeight / 2;
        GameState.isMoving = Math.hypot(GameState.lastDx, GameState.lastDy) > GameState.clientRadius;
        GameState.targetMouseAngle = Math.atan2(GameState.lastDy, GameState.lastDx);
        Network.sendPositionUpdate(); GameState.mouseMoveThrottled = false;
      });
    });

    canvas.addEventListener("mousedown", (e) => {
      if (GameState.isTouch || GameState.isDead) return; Sound.init(); 
      if (e.button === 2 && GameState.clientXp > 0 && GameState.clientLevel >= 1) { GameState.rightMouseDown = true; Network.sendPositionUpdate(true); }
      if (e.button === 0) {
        const cooldown = 500 + (GameState.clientLevel - 1) * 60;
        if (!GameState.isAttacking && Date.now() - (GameState.lastAttackTime || 0) >= cooldown) {
          GameState.isAttacking = true; GameState.attackTime = Date.now(); Network.ws.send(JSON.stringify({ type: "attack" })); Sound.play('swing');
        }
      }
    });

    canvas.addEventListener("mouseup", (e) => {
      if (GameState.isTouch) return;
      if (e.button === 2) { GameState.rightMouseDown = false; Network.sendPositionUpdate(true); }
    });

    const isPointInCircle = (px, py, cx, cy, radius) => Math.hypot(px - cx, py - cy) < radius;

    canvas.addEventListener("touchstart", (e) => {
      if(GameState.isDead) return; GameState.isTouch = true; e.preventDefault(); Sound.init(); 
      for(let i=0; i<e.changedTouches.length; i++) {
        const t = e.changedTouches[i]; const tx = t.clientX, ty = t.clientY; const w = window.innerWidth, h = window.innerHeight;
        if (isPointInCircle(tx, ty, w - 75, h - 75, 60)) {
          const cooldown = 500 + (GameState.clientLevel - 1) * 60;
          if (!GameState.isAttacking && Date.now() - (GameState.lastAttackTime || 0) >= cooldown) {
            GameState.isAttacking = true; GameState.attackTime = Date.now(); Network.ws.send(JSON.stringify({ type: "attack" })); Sound.play('swing');
          }
        }
        else if (isPointInCircle(tx, ty, w - 160, h - 75, 50)) { GameState.rightMouseDown = true; GameState.sprintTouchId = t.identifier; Network.sendPositionUpdate(true); }
        else if (tx < w / 2) {
          GameState.joystick.active = true; GameState.joystick.id = t.identifier;
          GameState.joystick.baseX = tx; GameState.joystick.baseY = ty;
          GameState.joystick.stickX = tx; GameState.joystick.stickY = ty; GameState.isMoving = true;
        }
      }
    }, {passive: false});

    canvas.addEventListener("touchmove", (e) => {
      if(GameState.isDead) return; e.preventDefault();
      for(let i=0; i<e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (GameState.joystick.active && t.identifier === GameState.joystick.id) {
          const dx = t.clientX - GameState.joystick.baseX, dy = t.clientY - GameState.joystick.baseY;
          const dist = Math.hypot(dx, dy), maxDist = 50; 
          if (dist > 5) { GameState.targetMouseAngle = Math.atan2(dy, dx); GameState.isMoving = true; } else { GameState.isMoving = false; }
          if (dist > maxDist) { GameState.joystick.stickX = GameState.joystick.baseX + Math.cos(GameState.targetMouseAngle) * maxDist; GameState.joystick.stickY = GameState.joystick.baseY + Math.sin(GameState.targetMouseAngle) * maxDist; } 
          else { GameState.joystick.stickX = t.clientX; GameState.joystick.stickY = t.clientY; }
          Network.sendPositionUpdate();
        }
      }
    }, {passive: false});

    canvas.addEventListener("touchend", (e) => {
      if(GameState.isDead) return; e.preventDefault();
      for(let i=0; i<e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (GameState.joystick.active && t.identifier === GameState.joystick.id) { GameState.joystick.active = false; GameState.isMoving = false; Network.sendPositionUpdate(true); }
        if (GameState.sprintTouchId === t.identifier) { GameState.rightMouseDown = false; GameState.sprintTouchId = null; Network.sendPositionUpdate(true); }
      }
    }, {passive: false});
  }
};
