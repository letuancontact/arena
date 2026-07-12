// --- src/server/utils.js ---
"use strict";

// Hàm tạo ID ngẫu nhiên chuẩn xác cho Server
function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Thư viện tên người thật & Gamer tag toàn cầu
const REAL_NAMES = [
  // US / UK (Âu Mỹ)
  "John", "Alex", "Michael", "Sarah", "Emily", "David", "James", "Emma", "Olivia", "Daniel", 
  "Matthew", "Sophia", "Andrew", "Isabella", "William", "Joshua", "Mia", "Ethan", "Chloe", "Jacob",
  
  // Việt Nam
  "Tuan_Sniper", "Hung", "Minh Trí", "Hieudeptrai", "Linh", "Trang", "Lan_9x", "Nam", "Hoang", "Khoa",
  "Bao_Ngoc", "Quang", "Duy", "Thao", "Mai", "Son_Pro", "Huy", "Thanh", "Phuong", "Anh_Tu",
  
  // Japan / Korea / China (Châu Á)
  "Kenji", "Sakura", "Yuki", "Haruto", "Akira", "Wei", "Chen", "Li", "Wang", "Min-jun", "Seo-yeon",
  "Ji-woo", "Toshiro", "Hinata", "Hiroshi", "Yuna", "Jian", "Xia", "Hao", "Ryu",
  
  // Latin / Spain
  "Carlos", "Luis", "Maria", "Elena", "Lucas", "Mateo", "Julia", "Diego", "Valentina", "Sofia",
  
  // Russia / Slavic
  "Ivan", "Dmitry", "Natasha", "Anya", "Boris", "Vladimir", "Svetlana", "Igor", "Yuri", "Olga",
  
  // Fun / Classic Gamer Tags (Tên kiểu game thủ hay đặt)
  "Player1", "Guest_99", "TryHard", "GG_WP", "Lagging", "I_am_Bot", "NoobMaster", "ProGamer",
  "Shadow", "Sniper", "Ghost", "Ninja", "Dragon", "Killer", "King", "Lord", "Alpha", "Omega",
  "Unknown", "Anon", "Xxx_Slayer_xxX", "Just_Chillin", "DontKillMe", "Free_XP", "Bot_1337"
];

// Hàm bốc ngẫu nhiên 1 tên từ thư viện
function randomName() {
  const randomIndex = Math.floor(Math.random() * REAL_NAMES.length);
  return REAL_NAMES[randomIndex];
}

module.exports = { uuid, randomName };
