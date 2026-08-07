// --- src/server/routes/shop.js ---
const express = require("express");
const User = require("../models/User");
const router = express.Router();

// Danh sách trang phục và giá bán
const SKIN_PRICES = {
    "lv2": { price: 100, currency: "gold" },
    "lv3": { price: 500, currency: "gold" },
    "lv4": { price: 10, currency: "diamonds" },
    "lv5": { price: 50, currency: "diamonds" }
};

// API Mua trang phục
router.post("/buy", async (req, res) => {
    try {
        const { username, skinId } = req.body;
        const user = await User.findOne({ username });
        if (!user) return res.status(404).json({ success: false, message: "Không tìm thấy tài khoản!" });

        const skin = SKIN_PRICES[skinId];
        if (!skin) return res.status(400).json({ success: false, message: "Trang phục không tồn tại!" });

        if (user.ownedSkins.includes(skinId)) {
            return res.status(400).json({ success: false, message: "Bạn đã sở hữu trang phục này rồi!" });
        }

        // Kiểm tra và trừ tiền
        if (skin.currency === "gold") {
            if (user.gold < skin.price) return res.status(400).json({ success: false, message: "Không đủ Vàng!" });
            user.gold -= skin.price;
        } else if (skin.currency === "diamonds") {
            if (user.diamonds < skin.price) return res.status(400).json({ success: false, message: "Không đủ Kim Cương!" });
            user.diamonds -= skin.price;
        }

        // Lưu trang phục vào tài khoản
        user.ownedSkins.push(skinId);
        await user.save();

        res.status(200).json({ 
            success: true, 
            message: "Mua thành công!", 
            gold: user.gold, 
            diamonds: user.diamonds, 
            ownedSkins: user.ownedSkins 
        });
    } catch (error) {
        console.error("[Shop] Lỗi mua hàng:", error);
        res.status(500).json({ success: false, message: "Lỗi máy chủ!" });
    }
});

// API Mặc trang phục
router.post("/equip", async (req, res) => {
    try {
        const { username, skinId } = req.body;
        const user = await User.findOne({ username });
        if (!user) return res.status(404).json({ success: false, message: "Không tìm thấy tài khoản!" });

        if (!user.ownedSkins.includes(skinId) && skinId !== "lv1") {
            return res.status(400).json({ success: false, message: "Bạn chưa sở hữu trang phục này!" });
        }

        user.equippedSkin = skinId;
        await user.save();

        res.status(200).json({ success: true, message: "Trang bị thành công!", equippedSkin: user.equippedSkin });
    } catch (error) {
        console.error("[Shop] Lỗi trang bị:", error);
        res.status(500).json({ success: false, message: "Lỗi máy chủ!" });
    }
});

module.exports = router;
