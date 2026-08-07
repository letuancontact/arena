// --- public/auth.js ---
document.addEventListener("DOMContentLoaded", () => {
    // 1. Khai báo các Element giao diện Auth 
    const authModal = document.getElementById("auth-modal");
    const openAuthBtn = document.getElementById("user-profile-btn");
    const closeAuthBtn = document.getElementById("close-auth-btn");
    const tabLogin = document.getElementById("tab-login");
    const tabRegister = document.getElementById("tab-register");
    const authSubmitBtn = document.getElementById("auth-submit-btn");
    const authUsernameInput = document.getElementById("auth-username");
    const authPasswordInput = document.getElementById("auth-password");
    const authMessage = document.getElementById("auth-message");
    
    // Nút mạng xã hội (tạm thời)
    const btnGoogle = document.getElementById("btn-google");
    const btnFacebook = document.getElementById("btn-facebook");
    
    // 2. Khai báo các Element ngoài Sảnh chờ
    const profileNameDisplay = document.getElementById("profile-name-display");
    const gameNameInput = document.getElementById("player-name");
    const lobbyHighScore = document.getElementById("lobby-high-score");
    const highestScoreVal = document.getElementById("highest-score-val");

    let currentMode = "login"; 

    // 3. KIỂM TRA TRẠNG THÁI ĐĂNG NHẬP
    const savedUser = localStorage.getItem("evoUsername");
    const savedScore = localStorage.getItem("evoHighScore"); 
    
    if (savedUser) {
        profileNameDisplay.textContent = savedUser;
        profileNameDisplay.style.color = "#00ffcc"; 
        
        if (gameNameInput) {
            gameNameInput.value = savedUser;
            gameNameInput.disabled = true; 
        }
        if (savedScore !== null && lobbyHighScore) {
            highestScoreVal.textContent = savedScore;
            lobbyHighScore.style.display = "block";
        }
    }

    // 4. MỞ / ĐÓNG MODAL
    openAuthBtn.addEventListener("click", () => {
        if (localStorage.getItem("evoUsername")) {
            if (confirm("Bạn có muốn đăng xuất khỏi tài khoản này không?")) {
                localStorage.removeItem("evoUsername");
                localStorage.removeItem("evoHighScore"); 
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

    // 5. LOGIC CHUYỂN TAB (Đã tối ưu cho giao diện mới)
    tabLogin.addEventListener("click", () => {
        currentMode = "login";
        tabLogin.classList.add("active-tab");
        tabRegister.classList.remove("active-tab");
        authMessage.textContent = "";
    });

    tabRegister.addEventListener("click", () => {
        currentMode = "register";
        tabRegister.classList.add("active-tab");
        tabLogin.classList.remove("active-tab");
        authMessage.textContent = "";
    });

    // 6. SỰ KIỆN NÚT GOOGLE / FACEBOOK (Báo tính năng sắp ra mắt)
    if (btnGoogle) {
        btnGoogle.addEventListener("click", () => {
            alert("Tính năng Đăng nhập bằng Google đang được phát triển, vui lòng chờ bản cập nhật sau nhé!");
        });
    }
    if (btnFacebook) {
        btnFacebook.addEventListener("click", () => {
            alert("Tính năng Đăng nhập bằng Facebook đang được phát triển, vui lòng chờ bản cập nhật sau nhé!");
        });
    }

    // 7. GỬI DỮ LIỆU VỀ SERVER
    authSubmitBtn.addEventListener("click", async () => {
        const username = authUsernameInput.value.trim();
        const password = authPasswordInput.value.trim();

        if (username.length < 3 || password.length < 3) {
            authMessage.style.color = "#ff4444";
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
                    localStorage.setItem("evoUsername", data.username);
                    localStorage.setItem("evoHighScore", data.highestScore || 0);
                    
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
                    setTimeout(() => {
                        tabLogin.click();
                        authUsernameInput.value = username;
                        authPasswordInput.value = "";
                        authMessage.style.color = "#00ffcc";
                        authMessage.textContent = "Vui lòng nhập mật khẩu để đăng nhập!";
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
