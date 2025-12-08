# 🚀 Complete Guide: How to Run InterDev Project

Hướng dẫn từ A đến Z để chạy project InterDev trên máy của bạn.

## 📋 Prerequisites (Cài đặt trước)

### 1. Node.js
```bash
# Kiểm tra
node --version  # Phải >= v18

# Nếu chưa có, tải từ https://nodejs.org/
```

### 2. Yarn
```bash
# Cài đặt
npm install -g yarn

# Kiểm tra
yarn --version
```

### 3. Docker (Tùy chọn - Nếu muốn dùng Docker)
```bash
# Tải từ https://www.docker.com/products/docker-desktop

# Kiểm tra
docker --version
docker-compose --version
```

---

## ⚡ OPTION 1: Chạy với Docker (Khuyên dùng)

### Bước 1: Chuẩn bị Environment
```bash
# Copy file .env
cd c:\Users\ASUS\Desktop\InterDev\InterDev
copy .env.example .env
copy client\.env.example client\.env
```

### Bước 2: Start Docker Services
```bash
# Cách 1: Dùng helper script
.\docker-helper.ps1
# Chọn option 1: Start all services

# Cách 2: Direct command
docker-compose up -d
```

✅ PostgreSQL sẽ chạy tại: `localhost:5432`
✅ Redis sẽ chạy tại: `localhost:6379`
✅ Adminer UI tại: `http://localhost:8080`
✅ Redis Commander tại: `http://localhost:8081`

### Bước 3: Cài đặt Dependencies

**Terminal 1 - Backend:**
```bash
cd server
yarn install
```

**Terminal 2 - Frontend:**
```bash
cd client
yarn install
```

### Bước 4: Chạy Development Servers

**Terminal 1 - Backend:**
```bash
cd server
yarn start:dev
```
✅ Backend sẽ chạy tại: `http://localhost:3000`

**Terminal 2 - Frontend:**
```bash
cd client
yarn dev
```
✅ Frontend sẽ chạy tại: `http://localhost:5173`

### ✨ Done! Bạn đã có:
- 🐘 PostgreSQL (localhost:5432)
- 🔴 Redis (localhost:6379)
- 🚀 Backend NestJS (localhost:3000)
- ⚛️ Frontend React (localhost:5173)
- 🎨 Adminer UI (localhost:8080)
- 📊 Redis Commander (localhost:8081)

---

## ⚡ OPTION 2: Chạy mà không dùng Docker

### Bước 1: Setup PostgreSQL Local

**Windows:**
1. Tải PostgreSQL từ https://www.postgresql.org/download/windows/
2. Cài đặt và nhớ password cho `postgres` user
3. Tạo database: `interdev`

```bash
# Mở pgAdmin hoặc command:
psql -U postgres
# CREATE DATABASE interdev;
```

**Mac/Linux:**
```bash
# Cài đặt
brew install postgresql@15
brew services start postgresql@15

# Tạo database
createdb -U postgres interdev
```

### Bước 2: Setup Redis Local

**Windows:**
1. Tải từ https://github.com/microsoftarchive/redis/releases
2. Hoặc dùng WSL: `wsl redis-server`

**Mac:**
```bash
brew install redis
brew services start redis
```

**Linux:**
```bash
sudo apt-get install redis-server
sudo systemctl start redis-server
```

### Bước 3: Cập nhật .env

```bash
cd c:\Users\ASUS\Desktop\InterDev\InterDev
copy .env.example .env
copy client\.env.example client\.env
```

Edit `.env`:
```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_postgres_password  # ← Đổi thành password của bạn
DB_NAME=interdev

REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=redis123
```

### Bước 4: Cài Dependencies

**Terminal 1:**
```bash
cd c:\Users\ASUS\Desktop\InterDev\InterDev\server
yarn install
```

**Terminal 2:**
```bash
cd c:\Users\ASUS\Desktop\InterDev\InterDev\client
yarn install
```

### Bước 5: Chạy Servers

**Terminal 1 - Backend:**
```bash
cd c:\Users\ASUS\Desktop\InterDev\InterDev\server
yarn start:dev
```

**Terminal 2 - Frontend:**
```bash
cd c:\Users\ASUS\Desktop\InterDev\InterDev\client
yarn dev
```

---

## 🎯 SUPER FAST: Copy-Paste Commands

### Nếu đã cài Docker:

```powershell
# Copy-paste all at once
cd c:\Users\ASUS\Desktop\InterDev\InterDev
copy .env.example .env
copy client\.env.example client\.env
docker-compose up -d
cd server && yarn install
cd ../client && yarn install

# Mở 2 terminals khác nhau:
# Terminal 1
cd c:\Users\ASUS\Desktop\InterDev\InterDev\server
yarn start:dev

# Terminal 2
cd c:\Users\ASUS\Desktop\InterDev\InterDev\client
yarn dev
```

### Nếu không dùng Docker:

```powershell
cd c:\Users\ASUS\Desktop\InterDev\InterDev

# Cập nhật .env file (edit manually)
# Đảm bảo PostgreSQL & Redis đang chạy

# Cài dependencies
cd server && yarn install && cd ../client && yarn install

# Chạy servers (2 terminals)
# Terminal 1: cd c:\Users\ASUS\Desktop\InterDev\InterDev\server && yarn start:dev
# Terminal 2: cd c:\Users\ASUS\Desktop\InterDev\InterDev\client && yarn dev
```

---

## 🔍 Kiểm tra Services Đang Chạy

### Backend
```bash
# Curl
curl http://localhost:3000

# Hoặc mở browser: http://localhost:3000
# Nên thấy: "Hello World!"
```

### Frontend
```bash
# Mở browser: http://localhost:5173
# Nên thấy: Vite + React boilerplate
```

### PostgreSQL (Docker)
```bash
docker-compose exec postgres psql -U postgres -d interdev
# Hoặc dùng Adminer: http://localhost:8080
```

### Redis (Docker)
```bash
docker-compose exec redis redis-cli -a redis123
# Hoặc dùng Redis Commander: http://localhost:8081
```

---

## 📁 Cấu Trúc Folder

```
InterDev/
├── server/              # Backend (NestJS)
│   └── src/
│       ├── modules/
│       ├── common/
│       ├── config/
│       └── database/
├── client/              # Frontend (React)
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── services/
│       └── types/
├── docker-compose.yml   # Docker services
├── .env.example         # Environment template
└── README.md
```

---

## 🛠️ Các Lệnh Thường Dùng

### Backend (server folder)
```bash
yarn start:dev       # Run development
yarn build           # Build production
yarn lint            # Check code
yarn test            # Run tests
```

### Frontend (client folder)
```bash
yarn dev             # Run development
yarn build           # Build production
yarn lint            # Check code
```

### Docker
```bash
docker-compose up -d                 # Start services
docker-compose down                  # Stop services
docker-compose logs -f               # View logs
docker-compose logs -f postgres      # View specific service
docker-compose ps                    # List services
```

---

## 🐛 Troubleshooting

### Error: Port 3000 already in use
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Mac/Linux
lsof -i :3000
kill -9 <PID>
```

### Error: Cannot connect to database
```bash
# Check Docker is running
docker ps

# Check if PostgreSQL service is up
docker-compose ps

# Restart PostgreSQL
docker-compose restart postgres

# Check logs
docker-compose logs postgres
```

### Error: Yarn install fails
```bash
# Clear cache
yarn cache clean

# Delete node_modules
rm -r node_modules

# Reinstall
yarn install
```

### Error: ".env file not found"
```bash
# Copy template
copy .env.example .env
copy client\.env.example client\.env

# Edit .env with correct values
notepad .env
notepad client\.env
```

---

## 📝 Checklist: Trước khi chạy

- [ ] Node.js v18+ cài đặt (`node --version`)
- [ ] Yarn cài đặt (`yarn --version`)
- [ ] Docker cài đặt (nếu dùng Docker)
- [ ] `.env` file đã copy từ `.env.example`
- [ ] `.env` file đã cập nhật credentials
- [ ] PostgreSQL chạy (Docker hoặc local)
- [ ] Redis chạy (Docker hoặc local)
- [ ] 2 terminals mở sẵn cho backend + frontend

---

## 🎯 Summary: 3 Bước Chính

### BƯỚC 1: Chuẩn bị
```bash
cd c:\Users\ASUS\Desktop\InterDev\InterDev
copy .env.example .env
copy client\.env.example client\.env
docker-compose up -d
```

### BƯỚC 2: Install Dependencies
```bash
cd server && yarn install
cd ../client && yarn install
```

### BƯỚC 3: Chạy Servers
```bash
# Terminal 1
cd server && yarn start:dev

# Terminal 2 (mở terminal mới)
cd client && yarn dev
```

### 🎉 Xong! Mở browser:
- Backend: http://localhost:3000
- Frontend: http://localhost:5173

---

## 📞 Need Help?

1. Xem `DOCKER_SETUP.md` - Docker detailed guide
2. Xem `QUICK_START.md` - Quick start guide
3. Xem `STRUCTURE.md` - Project structure
4. Check logs: `docker-compose logs -f`

---

**Thế đó! Chúc bạn coding happy! 🚀**
