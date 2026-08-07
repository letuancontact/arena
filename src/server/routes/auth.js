// --- src/server/routes/auth.js ---
const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

const router = express.Router();

// 1. API Đăng ký tài khoản
router.post("/register", async (req, res) => {
    try {
        const { username, password } = req.body;

        // Kiểm tra xem user đã tồn tại chưa
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ success: false, message: "Tên đăng nhập đã tồn tại!" });
        }

        // Mã hóa mật khẩu
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Tạo tài khoản mới lưu vào Database
        const newUser = new User({
            username,
            password: hashedPassword
        });

        await newUser.save();
        res.status(201).json({ success: true, message: "Đăng ký thành công!" });

    } catch (error) {
        console.error("[Auth] Lỗi đăng ký:", error);
        res.status(500).json({ success: false, message: "Lỗi máy chủ!" });
    }
});

// 2. API Đăng nhập
router.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;

        // Tìm user trong Database
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(400).json({ success: false, message: "Sai tên đăng nhập hoặc mật khẩu!" });
        }

        // So sánh mật khẩu người dùng nhập với mật khẩu đã băm trong DB
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: "Sai tên đăng nhập hoặc mật khẩu!" });
        }

        res.status(200).json({ 
            success: true, 
            message: "Đăng nhập thành công!",
            username: user.username,
            highestScore: user.highestScore
        });

    } catch (error) {
        console.error("[Auth] Lỗi đăng nhập:", error);
        res.status(500).json({ success: false, message: "Lỗi máy chủ!" });
    }
});

module.exports = router;
