document.addEventListener("DOMContentLoaded", () => {
    // Các Element giao diện
    const authModal = document.getElementById("auth-modal");
    const openAuthBtn = document.getElementById("user-profile-btn");
    const closeAuthBtn = document.getElementById("close-auth-btn");
    const tabLogin = document.getElementById("tab-login");
    const tabRegister = document.getElementById("tab-register");
    const authSubmitBtn = document.getElementById("auth-submit-btn");
    const authUsernameInput = document.getElementById("auth-username");
    const authPasswordInput = document.getElementById("auth-password");
    const authMessage = document.getElementById("auth-message");
    
    const profileNameDisplay = document.getElementById("profile-name-display");
    const gameNameInput = document.getElementById("player-name");

    let currentMode = "login"; // Trạng thái hiện tại: login hoặc register

    // 1. Kiểm tra xem người dùng đã đăng nhập từ lần trước chưa
    const savedUser = localStorage.getItem("evoUsername");
    if (savedUser) {
        profileNameDisplay.textContent = savedUser;
        profileNameDisplay.style.color = "#00ffcc"; // Đổi màu xanh lá báo hiệu đã đăng nhập
        if (gameNameInput) {
            gameNameInput.value = savedUser;
            gameNameInput.disabled = true; // Khóa input tên nếu đã đăng nhập
        }
    }

    // 2. Mở / Đóng Modal
    openAuthBtn.addEventListener("click", () => {
        // Nếu đã đăng nhập, bấm vào Avatar sẽ hỏi Đăng xuất
        if (localStorage.getItem("evoUsername")) {
            if (confirm("Bạn có muốn đăng xuất khỏi tài khoản này không?")) {
                localStorage.removeItem("evoUsername");
                location.reload(); // Tải lại trang để về trạng thái Khách
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
                    // Đăng nhập thành công -> Lưu vào máy
                    localStorage.setItem("evoUsername", data.username);
                    
                    // Cập nhật giao diện lập tức
                    profileNameDisplay.textContent = data.username;
                    profileNameDisplay.style.color = "#00ffcc";
                    if (gameNameInput) {
                        gameNameInput.value = data.username;
                        gameNameInput.disabled = true; 
                    }
                    
                    // Tự động đóng Popup sau 1 giây
                    setTimeout(() => {
                        authModal.style.display = "none";
                    }, 1000);
                } else {
                    // Đăng ký thành công -> Tự động chuyển qua tab Đăng nhập
                    setTimeout(() => {
                        tabLogin.click();
                        authMessage.style.color = "#00ffcc";
                        authMessage.textContent = "Vui lòng đăng nhập với tài khoản vừa tạo!";
                    }, 1000);
                }
            } else {
                // Báo lỗi từ server (Trùng tên, sai mật khẩu...)
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
