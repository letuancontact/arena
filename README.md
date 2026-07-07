# EvoWar Game

Game multiplayer online sử dụng Node.js và WebSocket.

## Docker Host

### Build và chạy:

```bash
# Build image
docker-compose build

# Chạy container
docker-compose up -d

# Truy cập game
# Mở browser: http://localhost:5002
```

### Quản lý:

```bash
# Xem logs
docker-compose logs -f

# Dừng game
docker-compose down

# Restart
docker-compose restart
```

### Chạy vĩnh viễn khi khởi động máy:

#### Windows:

```bash
# Tạo task startup (chạy với quyền Administrator)
schtasks /create /tn "EvoWar Game" /tr "docker-compose up -d" /sc onstart /ru "SYSTEM" /f
```

#### Linux:

```bash
# Tạo systemd service
sudo systemctl enable docker
sudo systemctl start docker
docker-compose up -d
```

## Local Development

```bash
# Cài đặt dependencies
npm install

# Build client
npm run build

# Chạy server
npm start
```
