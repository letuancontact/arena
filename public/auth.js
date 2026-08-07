// --- public/auth.js ---
document.addEventListener("DOMContentLoaded", () => {
    // 1. Khai báo các Element giao diện Auth (Đăng nhập/Đăng ký)
    const authModal = document.getElementById("auth-modal");
    const openAuthBtn = document.getElementById("user-profile-btn");
    const closeAuthBtn = document.getElementById("close-auth-btn");
    const tabLogin = document.getElementById("tab-login");
    const tabRegister = document.getElementById("tab-register");
    const authSubmitBtn = document.getElementById("auth-submit-btn");
    const authUsernameInput = document.getElementById("auth-username");
    const authPasswordInput = document.getElementById("auth-password");
    const authMessage = document.getElementById("auth-message");
    
    // 2. Khai báo các Element ngoài Sảnh chờ
    const profileNameDisplay = document.getElementById("profile-name-display");
    const gameNameInput = document.getElementById("player-name");
    const lobbyHighScore = document.getElementById("lobby-high-score");
    const highestScoreVal = document.getElementById("highest-score-val");

    let currentMode = "login"; // Trạng thái mặc định là tab Đăng nhập

    // 3. KIỂM TRA TRẠNG THÁI ĐĂNG NHẬP KHI VỪA VÀO WEB
    const savedUser = localStorage.getItem("evoUsername");
    const savedScore = localStorage.getItem("evoHighScore"); // Lấy điểm đã lưu
    
    if (savedUser) {
        // Cập nhật tên trên nút Avatar
        profileNameDisplay.textContent = savedUser;
        profileNameDisplay.style.color = "#00ffcc"; // Màu xanh báo hiệu đã đăng nhập
        
        // Tự động điền tên vào khung Play và khóa lại
        if (gameNameInput) {
            gameNameInput.value = savedUser;
            gameNameInput.disabled = true; 
        }
        
        // Hiện điểm kỷ lục ra sảnh chờ
        if (savedScore !== null && lobbyHighScore) {
            highestScoreVal.textContent = savedScore;
            lobbyHighScore.style.display = "block";
        }
    }

    // 4. MỞ / ĐÓNG MODAL VÀ ĐĂNG XUẤT
    openAuthBtn.addEventListener("click", () => {
        // Nếu đã có tài khoản, hỏi xem có muốn Đăng xuất không
        if (localStorage.getItem("evoUsername")) {
            if (confirm("Bạn có muốn đăng xuất khỏi tài khoản này không?")) {
                localStorage.removeItem("evoUsername");
                localStorage.removeItem("evoHighScore"); // Xóa luôn điểm ở trình duyệt
                location.reload(); // Tải lại trang để về trạng thái Khách
            }
            return;
        }
        // Nếu chưa đăng nhập thì mở bảng lên
        authModal.style.display = "flex";
        authMessage.textContent = "";
    });

    closeAuthBtn.addEventListener("click", () => {
        authModal.style.display = "none";
    });

    // 5. LOGIC CHUYỂN TAB ĐĂNG NHẬP / ĐĂNG KÝ
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

    // 6. GỬI DỮ LIỆU ĐĂNG KÝ / ĐĂNG NHẬP VỀ SERVER NODE.JS
    authSubmitBtn.addEventListener("click", async () => {
        const username = authUsernameInput.value.trim();
        const password = authPasswordInput.value.trim();

        // Kiểm tra điều kiện nhập
        if (username.length < 3 || password.length < 3) {
            authMessage.style.color = "#ff4444";
            authMessage.textContent = "Tên và mật khẩu phải có ít nhất 3 ký tự!";
            return;
        }

        // Hiệu ứng đang xử lý
        authSubmitBtn.disabled = true;
        authSubmitBtn.textContent = "ĐANG XỬ LÝ...";
        authMessage.style.color = "#ffffff";
        authMessage.textContent = "Đang kết nối...";

        try {
            // Xác định đường dẫn gọi API
            const endpoint = currentMode === "login" ? "/api/auth/login" : "/api/auth/register";
            
            // Gửi dữ liệu đi
            const response = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            // Nếu server báo thành công
            if (data.success) {
                authMessage.style.color = "#00ffcc";
                authMessage.textContent = data.message;
                
                if (currentMode === "login") {
                    // XỬ LÝ KHI ĐĂNG NHẬP THÀNH CÔNG: Lưu tên và điểm vào máy
                    localStorage.setItem("evoUsername", data.username);
                    localStorage.setItem("evoHighScore", data.highestScore || 0);
                    
                    // Cập nhật giao diện lập tức (Tên Avatar)
                    profileNameDisplay.textContent = data.username;
                    profileNameDisplay.style.color = "#00ffcc";
                    
                    // Khóa khung nhập tên
                    if (gameNameInput) {
                        gameNameInput.value = data.username;
                        gameNameInput.disabled = true; 
                    }
                    
                    // Hiện khung kỷ lục
                    if (lobbyHighScore) {
                        highestScoreVal.textContent = data.highestScore || 0;
                        lobbyHighScore.style.display = "block";
                    }
                    
                    // Tự động đóng Popup sau 1 giây
                    setTimeout(() => {
                        authModal.style.display = "none";
                    }, 1000);
                } else {
                    // XỬ LÝ KHI ĐĂNG KÝ THÀNH CÔNG
                    setTimeout(() => {
                        // Tự động chuyển qua tab Đăng nhập
                        tabLogin.click();
                        // Tự động điền luôn tên người dùng vừa đăng ký
                        authUsernameInput.value = username;
                        authPasswordInput.value = "";
                        authMessage.style.color = "#00ffcc";
                        authMessage.textContent = "Vui lòng nhập mật khẩu để đăng nhập!";
                    }, 1000);
                }
            } else {
                // Server báo lỗi (Trùng tên, sai mật khẩu...)
                authMessage.style.color = "#ff4444";
                authMessage.textContent = data.message;
            }
        } catch (error) {
            authMessage.style.color = "#ff4444";
            authMessage.textContent = "Lỗi kết nối máy chủ!";
        } finally {
            // Trả lại trạng thái bình thường cho nút bấm
            authSubmitBtn.disabled = false;
            authSubmitBtn.textContent = "XÁC NHẬN";
        }
    });
});
