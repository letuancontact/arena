// --- public/auth.js ---
document.addEventListener("DOMContentLoaded", () => {
    const authModal = document.getElementById("auth-modal");
    const openAuthBtn = document.getElementById("user-profile-btn");
    const closeAuthBtn = document.getElementById("close-auth-btn");
    const tabLogin = document.getElementById("tab-login");
    const tabRegister = document.getElementById("tab-register");
    const authSubmitBtn = document.getElementById("auth-submit-btn");
    const authUsernameInput = document.getElementById("auth-username");
    const authPasswordInput = document.getElementById("auth-password");
    const authMessage = document.getElementById("auth-message");
    
    const btnGoogle = document.getElementById("btn-google");
    const btnFacebook = document.getElementById("btn-facebook");
    
    const profileNameDisplay = document.getElementById("profile-name-display");
    const gameNameInput = document.getElementById("player-name");
    const lobbyHighScore = document.getElementById("lobby-high-score");
    const highestScoreVal = document.getElementById("highest-score-val");
    const respawnBtn = document.getElementById("respawn-btn"); // Nút Chơi Lại

    let currentMode = "login"; 

    // 1. KIỂM TRA TRẠNG THÁI
    const savedUser = localStorage.getItem("evoUsername");
    const savedScore = localStorage.getItem("evoHighScore"); 
    
    if (savedUser) {
        profileNameDisplay.textContent = savedUser + " (Đăng xuất)";
        profileNameDisplay.style.color = "#00ffcc"; 
        
        if (gameNameInput) {
            gameNameInput.value = savedUser;
            gameNameInput.disabled = true; 
        }
        if (savedScore !== null && lobbyHighScore) {
            highestScoreVal.textContent = savedScore;
            lobbyHighScore.style.display = "block";
        }
    } else {
        profileNameDisplay.textContent = "ĐĂNG NHẬP / ĐĂNG KÝ";
        profileNameDisplay.style.color = "#ccc";
    }

    // 2. MỞ / ĐÓNG MODAL
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

    // 3. CHUYỂN TAB 
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

    // 4. SỰ KIỆN NÚT GOOGLE / FACEBOOK 
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

    // 5. GỬI DỮ LIỆU ĐĂNG NHẬP
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
                    
                    profileNameDisplay.textContent = data.username + " (Đăng xuất)";
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

    // 6. TỰ ĐỘNG CẬP NHẬT KỶ LỤC KHI BẤM "CHƠI LẠI"
    if (respawnBtn) {
        respawnBtn.addEventListener("click", () => {
            const currentUsername = localStorage.getItem("evoUsername");
            if (currentUsername) {
                // Đợi 0.5s để Server kịp ghi dữ liệu xuống MongoDB rồi mới gọi API lấy về
                setTimeout(async () => {
                    try {
                        const response = await fetch(`/api/auth/${currentUsername}`);
                        const data = await response.json();
                        if (data.success) {
                            localStorage.setItem("evoHighScore", data.highestScore);
                            if (highestScoreVal) highestScoreVal.textContent = data.highestScore;
                        }
                    } catch (error) {
                        console.log("Không thể cập nhật điểm mới", error);
                    }
                }, 500); 
            }
        });
    }
});
