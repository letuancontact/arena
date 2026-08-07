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
    const respawnBtn = document.getElementById("respawn-btn"); 
    
    const hudGold = document.getElementById("hud-gold");
    const hudDiamond = document.getElementById("hud-diamond");

    // ==========================================
    // CÁC ELEMENT CỦA CỬA HÀNG (SHOP)
    // ==========================================
    const shopBtn = document.getElementById("shop-btn");
    const shopModal = document.getElementById("shop-modal");
    const closeShopBtn = document.getElementById("close-shop-btn");
    const shopGrid = document.getElementById("shop-grid");
    const shopGoldDisplay = document.getElementById("shop-gold");
    const shopDiamondDisplay = document.getElementById("shop-diamond");
    const shopMessage = document.getElementById("shop-message");

    // Dữ liệu các loại Trang phục (Khớp với Server)
    const SKINS_DATA = [
        { id: "lv1", name: "Chiến Binh Mới", price: 0, currency: "free", img: "img/lv1.png" },
        { id: "lv2", name: "Kẻ Săn Mồi", price: 100, currency: "gold", img: "img/lv2.png" },
        { id: "lv3", name: "Sát Thủ Đen", price: 500, currency: "gold", img: "img/lv3.png" },
        { id: "lv4", name: "Tinh Anh Tiên Phong", price: 10, currency: "diamonds", img: "img/lv4.png" },
        { id: "lv5", name: "Lãnh Chúa Máu", price: 50, currency: "diamonds", img: "img/lv5.png" }
    ];

    let currentMode = "login"; 

    // 1. KIỂM TRA TRẠNG THÁI KHỞI TẠO
    const savedUser = localStorage.getItem("evoUsername");
    const savedScore = localStorage.getItem("evoHighScore"); 
    let savedGold = parseInt(localStorage.getItem("evoGold")) || 0;
    let savedDiamonds = parseInt(localStorage.getItem("evoDiamonds")) || 0;
    
    // Đọc danh sách trang phục sở hữu từ LocalStorage
    let ownedSkins = [];
    try { ownedSkins = JSON.parse(localStorage.getItem("evoOwnedSkins")) || ["lv1"]; } catch (e) { ownedSkins = ["lv1"]; }
    let equippedSkin = localStorage.getItem("evoEquippedSkin") || "lv1";

    if (savedUser) {
        profileNameDisplay.textContent = savedUser + " (Đăng xuất)";
        profileNameDisplay.style.color = "#00ffcc"; 
        if (gameNameInput) { gameNameInput.value = savedUser; gameNameInput.disabled = true; }
        if (savedScore !== null && lobbyHighScore) { highestScoreVal.textContent = savedScore; lobbyHighScore.style.display = "block"; }
        if (hudGold) hudGold.textContent = savedGold;
        if (hudDiamond) hudDiamond.textContent = savedDiamonds;
        
        // HIỆN NÚT CỬA HÀNG KHI ĐÃ ĐĂNG NHẬP
        if (shopBtn) shopBtn.style.display = "block";
    } else {
        profileNameDisplay.textContent = "ĐĂNG NHẬP / ĐĂNG KÝ";
        profileNameDisplay.style.color = "#ccc";
        if (shopBtn) shopBtn.style.display = "none";
    }

    // 2. MỞ / ĐÓNG MODAL AUTH
    openAuthBtn.addEventListener("click", () => {
        if (localStorage.getItem("evoUsername")) {
            if (confirm("Bạn có muốn đăng xuất khỏi tài khoản này không?")) {
                localStorage.clear(); 
                location.reload(); 
            }
            return;
        }
        authModal.style.display = "flex";
        authMessage.textContent = "";
    });

    closeAuthBtn.addEventListener("click", () => { authModal.style.display = "none"; });

    tabLogin.addEventListener("click", () => {
        currentMode = "login";
        tabLogin.classList.add("active-tab"); tabRegister.classList.remove("active-tab");
        authMessage.textContent = "";
    });

    tabRegister.addEventListener("click", () => {
        currentMode = "register";
        tabRegister.classList.add("active-tab"); tabLogin.classList.remove("active-tab");
        authMessage.textContent = "";
    });

    if (btnGoogle) btnGoogle.addEventListener("click", () => alert("Tính năng Đăng nhập bằng Google đang được phát triển!"));
    if (btnFacebook) btnFacebook.addEventListener("click", () => alert("Tính năng Đăng nhập bằng Facebook đang được phát triển!"));

    // 3. GỬI DỮ LIỆU ĐĂNG NHẬP
    authSubmitBtn.addEventListener("click", async () => {
        const username = authUsernameInput.value.trim();
        const password = authPasswordInput.value.trim();

        if (username.length < 3 || password.length < 3) {
            authMessage.style.color = "#ff4444"; authMessage.textContent = "Tên và mật khẩu phải có ít nhất 3 ký tự!"; return;
        }

        authSubmitBtn.disabled = true; authSubmitBtn.textContent = "ĐANG XỬ LÝ...";
        authMessage.style.color = "#ffffff"; authMessage.textContent = "Đang kết nối...";

        try {
            const endpoint = currentMode === "login" ? "/api/auth/login" : "/api/auth/register";
            const response = await fetch(endpoint, {
                method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password })
            });
            const data = await response.json();

            if (data.success) {
                authMessage.style.color = "#00ffcc"; authMessage.textContent = data.message;
                if (currentMode === "login") {
                    localStorage.setItem("evoUsername", data.username);
                    localStorage.setItem("evoHighScore", data.highestScore || 0);
                    localStorage.setItem("evoGold", data.gold || 0);
                    localStorage.setItem("evoDiamonds", data.diamonds || 0);
                    localStorage.setItem("evoEquippedSkin", data.equippedSkin || "lv1");
                    localStorage.setItem("evoOwnedSkins", JSON.stringify(data.ownedSkins || ["lv1"]));
                    
                    setTimeout(() => location.reload(), 800); // Tải lại để lấy giao diện và Skin chuẩn
                } else {
                    setTimeout(() => {
                        tabLogin.click(); authUsernameInput.value = username; authPasswordInput.value = "";
                        authMessage.style.color = "#00ffcc"; authMessage.textContent = "Vui lòng nhập mật khẩu để đăng nhập!";
                    }, 1000);
                }
            } else {
                authMessage.style.color = "#ff4444"; authMessage.textContent = data.message;
            }
        } catch (error) {
            authMessage.style.color = "#ff4444"; authMessage.textContent = "Lỗi kết nối máy chủ!";
        } finally {
            authSubmitBtn.disabled = false; authSubmitBtn.textContent = "XÁC NHẬN";
        }
    });

    // 4. CẬP NHẬT CHỈ SỐ KHI BẤM CHƠI LẠI
    if (respawnBtn) {
        respawnBtn.addEventListener("click", () => {
            const currentUsername = localStorage.getItem("evoUsername");
            if (currentUsername) {
                setTimeout(async () => {
                    try {
                        const response = await fetch(`/api/auth/${currentUsername}`);
                        const data = await response.json();
                        if (data.success) {
                            localStorage.setItem("evoHighScore", data.highestScore);
                            localStorage.setItem("evoGold", data.gold);
                            localStorage.setItem("evoDiamonds", data.diamonds);
                            
                            savedGold = data.gold; savedDiamonds = data.diamonds;
                            
                            if (highestScoreVal) highestScoreVal.textContent = data.highestScore;
                            if (hudGold) hudGold.textContent = data.gold;
                            if (hudDiamond) hudDiamond.textContent = data.diamonds;
                        }
                    } catch (error) {}
                }, 500); 
            }
        });
    }

    // ==========================================
    // LOGIC CỬA HÀNG (SHOP)
    // ==========================================
    
    // Hàm in giao diện danh sách Shop
    function renderShop() {
        if (!shopGrid) return;
        shopGrid.innerHTML = "";
        
        // Cập nhật số tiền hiển thị trên khung Shop
        shopGoldDisplay.textContent = savedGold;
        shopDiamondDisplay.textContent = savedDiamonds;

        SKINS_DATA.forEach(skin => {
            const isOwned = ownedSkins.includes(skin.id);
            const isEquipped = (equippedSkin === skin.id);

            // Xác định giao diện Nút (Mua Vàng / Mua Kim Cương / Đang Mặc / Mặc)
            let btnClass = "btn-equip";
            let btnText = "MẶC";
            let priceHTML = `<div class="skin-price price-gold">Sở hữu vĩnh viễn</div>`;

            if (isEquipped) {
                btnClass = "btn-equipped";
                btnText = "ĐANG MẶC";
            } else if (!isOwned) {
                if (skin.currency === "gold") {
                    btnClass = "btn-buy-gold";
                    btnText = "MUA";
                    priceHTML = `<div class="skin-price price-gold">🪙 ${skin.price} Vàng</div>`;
                } else if (skin.currency === "diamonds") {
                    btnClass = "btn-buy-diamond";
                    btnText = "MUA";
                    priceHTML = `<div class="skin-price price-diamond">💎 ${skin.price} Kim cương</div>`;
                }
            }

            const card = document.createElement("div");
            card.className = "skin-card";
            card.innerHTML = `
                <img src="${skin.img}" alt="${skin.name}">
                <div class="skin-name">${skin.name}</div>
                ${priceHTML}
                <button class="skin-btn ${btnClass}" data-id="${skin.id}" ${isEquipped ? 'disabled' : ''}>${btnText}</button>
            `;
            shopGrid.appendChild(card);
        });

        // Gắn sự kiện click cho các nút Mua/Mặc
        document.querySelectorAll(".skin-btn").forEach(btn => {
            btn.addEventListener("click", async (e) => {
                const skinId = e.target.getAttribute("data-id");
                const currentUsername = localStorage.getItem("evoUsername");
                const isOwned = ownedSkins.includes(skinId);
                
                shopMessage.textContent = "Đang xử lý...";
                shopMessage.style.color = "white";

                try {
                    if (!isOwned) {
                        // API MUA HÀNG
                        const res = await fetch("/api/shop/buy", {
                            method: "POST", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ username: currentUsername, skinId })
                        });
                        const data = await res.json();
                        
                        if (data.success) {
                            savedGold = data.gold; savedDiamonds = data.diamonds;
                            ownedSkins = data.ownedSkins;
                            
                            localStorage.setItem("evoGold", savedGold);
                            localStorage.setItem("evoDiamonds", savedDiamonds);
                            localStorage.setItem("evoOwnedSkins", JSON.stringify(ownedSkins));
                            
                            if (hudGold) hudGold.textContent = savedGold;
                            if (hudDiamond) hudDiamond.textContent = savedDiamonds;
                            
                            shopMessage.textContent = "Mua trang phục thành công!";
                            shopMessage.style.color = "#00ffcc";
                            renderShop(); // Vẽ lại giao diện Cửa hàng
                        } else {
                            shopMessage.textContent = data.message;
                            shopMessage.style.color = "#ff4444";
                        }
                    } else {
                        // API MẶC TRANG PHỤC
                        const res = await fetch("/api/shop/equip", {
                            method: "POST", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ username: currentUsername, skinId })
                        });
                        const data = await res.json();

                        if (data.success) {
                            equippedSkin = data.equippedSkin;
                            localStorage.setItem("evoEquippedSkin", equippedSkin);
                            
                            // Cập nhật lại hình Avatar Sảnh Chờ
                            const lobbyAvatar = document.getElementById("player-avatar");
                            if (lobbyAvatar) lobbyAvatar.src = `img/${equippedSkin}.png`;

                            shopMessage.textContent = "Thay trang phục thành công!";
                            shopMessage.style.color = "#00ffcc";
                            renderShop(); 
                        } else {
                            shopMessage.textContent = data.message;
                            shopMessage.style.color = "#ff4444";
                        }
                    }
                } catch (error) {
                    shopMessage.textContent = "Lỗi kết nối máy chủ!";
                    shopMessage.style.color = "#ff4444";
                }
            });
        });
    }

    // Mở / Đóng cửa hàng
    if (shopBtn) {
        shopBtn.addEventListener("click", () => {
            renderShop();
            shopModal.style.display = "flex";
            shopMessage.textContent = "";
        });
    }
    if (closeShopBtn) {
        closeShopBtn.addEventListener("click", () => {
            shopModal.style.display = "none";
        });
    }
});
