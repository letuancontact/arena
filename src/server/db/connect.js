const mongoose = require("mongoose");

const connectDB = async (uri) => {
    try {
        await mongoose.connect(uri);
        console.log("====================================");
        console.log("[Database] KẾT NỐI MONGODB THÀNH CÔNG!");
        console.log("====================================");
    } catch (error) {
        console.error("[Database] LỖI KẾT NỐI:", error);
        process.exit(1);
    }
};

module.exports = connectDB;
