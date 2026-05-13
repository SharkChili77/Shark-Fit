# SharkFit 宝塔面板部署指南

## 项目架构

```
前端: Vite + React SPA → 构建产物在 dist/
后端: Node.js + Express → 入口 server/server.js (端口 3001)
数据库: SQLite → server/sharkfit.db (自动创建)
上传文件: server/uploads/
```

后端已内置静态文件服务，只需运行一个 Node.js 进程即可同时提供 API 和前端页面。

---

## 部署前准备

### 1. 宝塔面板安装 Node.js

1. 登录宝塔面板
2. 进入 **软件商店** → 搜索 **"Node.js版本管理器"** → 安装
3. 打开 Node.js 版本管理器，安装 **Node.js v20.x**（推荐 LTS）
4. 等待安装完成

### 2. 服务器放行端口

宝塔面板 → **安全** → **防火墙** → 添加规则：
- 端口: `3001`
- 协议: TCP
- 策略: 允许

> 如果使用域名 + Nginx 反向代理（推荐），可以不放行 3001 端口，只放行 80/443。

---

## 部署步骤

### 第一步：上传项目文件

#### 方式 A：宝塔文件管理器上传（简单）

1. 宝塔面板 → **文件** → 进入 `/www/wwwroot/`
2. 创建文件夹 `fitness-pwa`
3. 将 `SharkFit_Deploy_v1.0.tar.gz` 上传到 `/www/wwwroot/fitness-pwa/`
4. 右键压缩包 → **解压**

#### 方式 B：SSH 命令上传（推荐）

```bash
# 在你的 Windows 电脑上执行（需要安装 Git Bash 或使用 PowerShell）
scp D:/Desktop/健身网站/fitness-pwa/SharkFit_Deploy_v1.0.tar.gz root@你的服务器IP:/www/wwwroot/

# SSH 登录服务器
ssh root@你的服务器IP

# 创建目录并解压
mkdir -p /www/wwwroot/fitness-pwa
cd /www/wwwroot/fitness-pwa
tar -xzf /www/wwwroot/SharkFit_Deploy_v1.0.tar.gz
rm /www/wwwroot/SharkFit_Deploy_v1.0.tar.gz
```

### 第二步：安装后端依赖

```bash
cd /www/wwwroot/fitness-pwa/server
npm install --production
```

> **重要**: `better-sqlite3` 是原生 C++ 模块，必须在服务器上编译安装，不能从 Windows 拷贝 `node_modules`。
> 如果编译失败，需要安装构建工具：
> ```bash
> # CentOS/RHEL
> yum install -y gcc-c++ make python3
> # Ubuntu/Debian
> apt install -y build-essential python3
> ```

### 第三步：配置环境变量

```bash
nano /www/wwwroot/fitness-pwa/server/.env
```

修改以下内容：

```env
# JWT 密钥 - 必须修改为一个强随机字符串！
JWT_SECRET=换成你自己的随机字符串至少32位以上

# Resend 邮件配置（如果需要邮件功能）
RESEND_API_KEY=你的resend_api_key
RESEND_FROM=SharkFit <noreply@你的域名>

# 服务端口
PORT=3001
```

**生成随机 JWT 密钥**:
```bash
openssl rand -base64 48
```

### 第四步：创建日志目录

```bash
mkdir -p /www/wwwroot/fitness-pwa/logs
```

### 第五步：配置 PM2 进程管理（推荐）

PM2 可以让 Node.js 进程常驻后台、崩溃自动重启、开机自启。

```bash
# 全局安装 PM2
npm install -g pm2

# 启动项目
cd /www/wwwroot/fitness-pwa
pm2 start ecosystem.config.cjs

# 查看运行状态
pm2 status

# 查看日志
pm2 logs sharkfit

# 设置开机自启
pm2 startup
pm2 save
```

#### 替代方案：不用 PM2，用宝塔 Node 项目管理器

1. 宝塔面板 → **网站** → **Node项目** → **添加Node项目**
2. 填写配置：

| 配置项 | 值 |
|--------|-----|
| 项目目录 | `/www/wwwroot/fitness-pwa/server` |
| 启动文件 | `server.js` |
| Node版本 | 选择已安装的 v20.x |
| 包管理器 | npm |
| 项目端口 | 3001 |
| 运行用户 | www |
| 开机自启 | ✅ 开启 |
| 项目备注 | SharkFit |

3. 点击 **提交**，等待启动完成

### 第六步：验证部署

```bash
# 测试健康检查接口
curl http://127.0.0.1:3001/api/health

# 预期返回类似：
# {"status":"ok","timestamp":"...","database":{"users":1,"exercises":0,"records":0}}
```

在浏览器访问: `http://你的服务器IP:3001`

---

## 配置域名 + HTTPS（推荐）

### 1. 添加网站

宝塔面板 → **网站** → **添加站点**：
- 域名: `你的域名.com`
- PHP版本: 选择 **纯静态**
- 根目录: `/www/wwwroot/fitness-pwa/dist`（随便填，反正用反向代理）

### 2. 配置 Nginx 反向代理

点击网站 → **设置** → **反向代理** → **添加反向代理**：

| 配置项 | 值 |
|--------|-----|
| 代理名称 | sharkfit |
| 目标URL | `http://127.0.0.1:3001` |

或者手动编辑 Nginx 配置（更灵活）：

```nginx
server {
    listen 80;
    server_name 你的域名.com;

    # 上传文件缓存
    location /uploads/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # API 请求
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 前端页面
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 3. 申请 SSL 证书（HTTPS）

1. 网站 → **设置** → **SSL**
2. 选择 **Let's Encrypt** → 免费申请
3. 勾选 **强制HTTPS**

---

## 常用运维命令

```bash
# 查看服务状态
pm2 status

# 重启服务
pm2 restart sharkfit

# 查看实时日志
pm2 logs sharkfit --lines 100

# 查看错误日志
cat /www/wwwroot/fitness-pwa/logs/error.log

# 停止服务
pm2 stop sharkfit

# 数据库备份（建议定期备份）
cp /www/wwwroot/fitness-pwa/server/sharkfit.db /www/wwwroot/fitness-pwa/backup/sharkfit_$(date +%Y%m%d).db
```

---

## 常见问题

### Q: `better-sqlite3` 安装失败
A: 安装编译工具链：
```bash
# CentOS
yum groupinstall -y "Development Tools"
# Ubuntu
apt install -y build-essential
```

### Q: 端口 3001 无法访问
A: 检查防火墙：
```bash
# 云服务器安全组也要放行 3001
firewall-cmd --zone=public --add-port=3001/tcp --permanent
firewall-cmd --reload
```

### Q: 数据库被锁定
A: 确保只有一个 Node.js 进程在运行：
```bash
pm2 list
# 如果有多个，停掉多余的
pm2 delete all
pm2 start ecosystem.config.cjs
```

### Q: 上传头像功能不工作
A: 检查 uploads 目录权限：
```bash
chmod -R 755 /www/wwwroot/fitness-pwa/server/uploads
chown -R www:www /www/wwwroot/fitness-pwa/server/uploads
```

---

## 文件结构参考

```
/www/wwwroot/fitness-pwa/
├── dist/                    # 前端构建产物（自动服务）
│   ├── assets/
│   ├── index.html
│   └── ...
├── server/                  # 后端代码
│   ├── server.js            # 入口文件
│   ├── db.js                # 数据库初始化
│   ├── .env                 # 环境变量（含密钥，不要泄露）
│   ├── middleware/           # 认证、验证中间件
│   ├── routes/              # API 路由
│   ├── uploads/             # 用户上传的头像等
│   ├── sharkfit.db          # SQLite 数据库文件
│   ├── package.json
│   └── node_modules/        # 后端依赖（服务器上 npm install）
├── logs/                    # PM2 日志目录
├── ecosystem.config.cjs     # PM2 配置
└── package.json
```
