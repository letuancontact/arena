document.addEventListener("DOMContentLoaded", () => {
    // Các Element giao diện Auth
    const authModal = document.getElementById("auth-modal");
    const openAuthBtn = document.getElementById("user-profile-btn");
    const closeAuthBtn = document.getElementById("close-auth-btn");
    const tabLogin = document.getElementById("tab-login");
    const tabRegister = document.getElementById("tab-register");
    const authSubmitBtn = document.getElementById("auth-submit-btn");
    const authUsernameInput = document.getElementById("auth-username");
    const authPasswordInput = document.getElementById("auth-password");
    const authMessage = document.getElementById("auth-message");
    
    // Các Element ngoài Sảnh chờ
    const profileNameDisplay = document.getElementById("profile-name-display");
    const gameNameInput = document.getElementById("player-name");
    const lobbyHighScore = document.getElementById("lobby-high-score");
    const highestScoreVal = document.getElementById("highest-score-val");

    let currentMode = "login"; 

    // 1. Kiểm tra trạng thái đăng nhập khi vừa vào web
    const savedUser = localStorage.getItem("evoUsername");
    const savedScore = localStorage.getItem("evoHighScore"); // Lấy điểm đã lưu
    
    if (savedUser) {
        profileNameDisplay.textContent = savedUser;
        profileNameDisplay.style.color = "#00ffcc"; 
        if (gameNameInput) {
            gameNameInput.value = savedUser;
            gameNameInput.disabled = true; 
        }
        // Hiện điểm kỷ lục
        if (savedScore !== null && lobbyHighScore) {
            highestScoreVal.textContent = savedScore;
            lobbyHighScore.style.display = "block";
        }
    }

    // 2. Mở / Đóng Modal
    openAuthBtn.addEventListener("click", () => {
        if (localStorage.getItem("evoUsername")) {
            if (confirm("Bạn có muốn đăng xuất khỏi tài khoản này không?")) {
                localStorage.removeItem("evoUsername");
                localStorage.removeItem("evoHighScore"); // Xóa luôn điểm khi đăng xuất
                location.reload(); 
            }
            return;
        }
        authModal.style.display = "flex";
        authMessage.textContent = "";
    });

    closeAuthBtn.addEventListener("click", () => {
        authModal.style.display = "none";
    });

    // 3. Logic chuyển Tab
    tabLogin.addEventListener("click", () => {
        currentMode = "login";
        tabLogin.style.color = "#00ffcc";
        tabLogin.style.borderBottom = "3px solid #00ffcc";
        tabRegister.style.color = "#888";
        tabRegister.style.borderBottom = "3px solid transparent";
        authMessage.textContent = "";
    });

    tabRegister.addEventListener("click", () => {
        currentMode = "register";
        tabRegister.style.color = "#00ffcc";
        tabRegister.style.borderBottom = "3px solid #00ffcc";
        tabLogin.style.color = "#888";
        tabLogin.style.borderBottom = "3px solid transparent";
        authMessage.textContent = "";
    });

    // 4. Gửi dữ liệu Đăng ký / Đăng nhập về Server
    authSubmitBtn.addEventListener("click", async () => {
        const username = authUsernameInput.value.trim();
        const password = authPasswordInput.value.trim();

        if (username.length < 3 || password.length < 3) {
            authMessage.textContent = "Tên và mật khẩu phải có ít nhất 3 ký tự!";
            return;
        }

        authSubmitBtn.disabled = true;
        authSubmitBtn.textContent = "ĐANG XỬ LÝ...";
        authMessage.style.color = "#ffffff";
        authMessage.textContent = "Đang kết nối...";

        try {
            const endpoint = currentMode === "login" ? "/api/auth/login" : "/api/auth/register";
            const response = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (data.success) {
                authMessage.style.color = "#00ffcc";
                authMessage.textContent = data.message;
                
                if (currentMode === "login") {
                    // Đăng nhập thành công -> Lưu tên và điểm vào máy
                    localStorage.setItem("evoUsername", data.username);
                    localStorage.setItem("evoHighScore", data.highestScore || 0);
                    
                    // Cập nhật giao diện lập tức
                    profileNameDisplay.textContent = data.username;
                    profileNameDisplay.style.color = "#00ffcc";
                    
                    if (gameNameInput) {
                        gameNameInput.value = data.username;
                        gameNameInput.disabled = true; 
                    }
                    if (lobbyHighScore) {
                        highestScoreVal.textContent = data.highestScore || 0;
                        lobbyHighScore.style.display = "block";
                    }
                    
                    setTimeout(() => {
                        authModal.style.display = "none";
                    }, 1000);
                } else {
                    // Đăng ký thành công
                    setTimeout(() => {
                        tabLogin.click();
                        authMessage.style.color = "#00ffcc";
                        authMessage.textContent = "Vui lòng đăng nhập với tài khoản vừa tạo!";
                    }, 1000);
                }
            } else {
                authMessage.style.color = "#ff4444";
                authMessage.textContent = data.message;
            }
        } catch (error) {
            authMessage.style.color = "#ff4444";
            authMessage.textContent = "Lỗi kết nối máy chủ!";
        } finally {
            authSubmitBtn.disabled = false;
            authSubmitBtn.textContent = "XÁC NHẬN";
        }
    });
});
