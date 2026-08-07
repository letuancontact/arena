// --- src/server/models/User.js ---
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        minlength: 3,
        maxlength: 20
    },
    password: {
        type: String,
        required: true
    },
    highestScore: {
        type: Number,
        default: 0
    },
    // ==========================================
    // MỚI THÊM: HỆ THỐNG TIỀN TỆ VÀ TRANG PHỤC
    // ==========================================
    gold: {
        type: Number,
        default: 0    // Vàng kiếm được trong game
    },
    diamonds: {
        type: Number,
        default: 0    // Kim cương (nạp tiền hoặc thưởng sự kiện)
    },
    ownedSkins: {
        type: [String],
        default: ["lv1"] // Danh sách các ID trang phục đã mua/sở hữu
    },
    equippedSkin: {
        type: String,
        default: "lv1"   // Trang phục đang mặc hiện tại
    },
    // ==========================================
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("User", userSchema);
