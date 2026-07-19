// TÌM ĐẾN HÀM triggerGameOver VÀ THAY BẰNG ĐOẠN NÀY:
function triggerGameOver(level, kills, xp, killerName) {
    if (lobbyScreen && lobbyScreen.style.display !== 'none') return; 
    if (!isPlaying) return; 
    
    isPlaying = false; 

    try {
        const currentLevel = level || GameState.clientLevel || 1;
        const finalKiller = (killerName && killerName.trim() !== '') ? killerName : "MỘT KẺ VÔ DANH";
        
        const killerEl = document.getElementById('go-killer-name');
        if (killerEl) killerEl.innerText = finalKiller;
        
        const evolutionMilestones = [1, 2, 6, 10, 15, 21, 28, 36, 45];
        let nextEvolutionLevel = evolutionMilestones.find(m => m > currentLevel);

        if (!nextEvolutionLevel) {
            nextEvolutionLevel = "MAX"; 
        }

        const nextImgEl = document.getElementById('go-next-img');
        if (nextImgEl) {
            nextImgEl.src = nextEvolutionLevel !== "MAX" ? `img/lv${nextEvolutionLevel}.png` : `img/lv45.png`;
        }

        // --- FIX DELAY BẰNG CÁCH TẮT CSS TRANSITION TẠM THỜI ---
        if (uiLayer) {
            uiLayer.style.transition = 'none'; // Ép hiện lên lập tức, không chờ hiệu ứng mờ mờ 0.4 giây nữa
            uiLayer.style.display = 'flex';    // Đổi về flex cho chuẩn
            uiLayer.style.opacity = '1';         
            uiLayer.style.transform = 'scale(1)'; 
            
            // Trả lại hiệu ứng mờ 0.4 giây sau 50ms (để khi bấm Play nó còn mờ đi đẹp đẽ)
            setTimeout(() => { 
                if(uiLayer) uiLayer.style.transition = 'opacity 0.4s ease, transform 0.4s ease'; 
            }, 50);
        }
        // --------------------------------------------------------

        if (lobbyScreen) lobbyScreen.style.display = 'none';
        if (gameOverScreen) {
            gameOverScreen.style.display = 'flex'; 
            gameOverScreen.style.opacity = '1';
        }

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
        console.warn("Lỗi UI:", e);
    }
}
