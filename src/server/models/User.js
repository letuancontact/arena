const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true, // Không cho phép trùng tên đăng nhập
        trim: true,   // Tự động xóa khoảng trắng ở 2 đầu
        minlength: 3,
        maxlength: 20
    },
    password: {
        type: String,
        required: true
    },
    highestScore: {
        type: Number,
        default: 0    // Điểm cao nhất mặc định khi mới tạo tài khoản là 0
    },
    coins: {
        type: Number,
        default: 0    // Tiền tệ trong game (để dành mua skin sau này)
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("User", userSchema);
