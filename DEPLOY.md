# 🦈 Shark Fit 部署文档

> **项目名称**: Shark Fit 训练记录系统  
> **技术栈**: React 19 (Vite) + Node.js (Express) + SQLite (better-sqlite3)  
> **目标环境**: Linux 服务器 + 宝塔面板  
> **最低配置**: 2 核 CPU / 2 GB 内存

---

## 一、项目架构总览

```
┌─────────────────────────────────────────────────┐
│                  用户浏览器                       │
│          (手机/电脑 访问 http://IP:3001)           │
└──────────────────────┬──────────────────────────┘
                       │ HTTP 请求
                       ▼
┌─────────────────────────────────────────────────┐
│            Node.js Express 服务 (端口 3001)        │
│                                                 │
│  ┌───────────────┐  ┌────────────────────────┐  │
│  │  静态文件服务    │  │    REST API 服务        │  │
│  │  (dist/ 目录)   │  │    /api/*              │  │
│  │  提供前端页面    │  │    处理数据读写          │  │
│  └───────────────┘  └──────────┬─────────────┘  │
│                                │                │
│                     ┌──────────▼─────────────┐  │
│                     │  SQLite 数据库           │  │
│                     │  server/sharkfit.db     │  │
│                     │  (文件级数据库, 零配置)    │  │
│                     └────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

**关键理解**：这个项目 **只需要启动一个进程** (`node server/server.js`)，它同时承担：
1. **前端静态文件服务** — 将 `dist/` 目录下构建好的 HTML/JS/CSS 通过 HTTP 提供给浏览器
2. **后端 API 服务** — 处理所有 `/api/*` 路由的数据读写请求
3. **数据库** — SQLite 是嵌入式数据库，无需单独安装和启动数据库服务，数据全部存储在 `server/sharkfit.db` 文件中

---

## 二、项目目录结构

```
fitness-pwa/
├── dist/                       # ⭐ 前端构建产物（已构建好，直接部署）
│   ├── index.html
│   └── assets/
│       ├── index-xxx.css       # 所有样式（~32KB）
│       └── index-xxx.js        # 所有逻辑（~864KB）
│
├── server/                     # ⭐ 后端代码目录
│   ├── server.js               # Express 主入口
│   ├── db.js                   # 数据库初始化 + 建表 + 默认数据播种
│   ├── package.json            # 后端依赖声明
│   ├── package-lock.json       # 后端依赖锁定
│   └── sharkfit.db             # SQLite 数据库文件（首次启动自动创建）
│
├── src/                        # 前端源码（部署时不需要）
├── node_modules/               # 前端依赖（部署时不需要）
├── package.json                # 前端依赖声明（部署时不需要）
├── vite.config.js              # Vite 构建配置（部署时不需要）
└── ...
```

---

## 三、服务器部署步骤（宝塔面板）

### 步骤 1：准备 Node.js 环境

在宝塔面板中：
1. 进入 **软件商店** → 搜索 **Node.js版本管理器** → 安装
2. 安装 Node.js **v18** 或更高版本（推荐 v20 LTS）
3. 确认安装成功：
```bash
node -v    # 应输出 v18.x.x 或 v20.x.x
npm -v     # 应输出 9.x.x 或 10.x.x
```

### 步骤 2：上传项目文件

将以下文件/目录上传到服务器（例如 `/www/wwwroot/sharkfit/`）：

```
需要上传的文件：
├── dist/               # 整个目录（前端构建产物）
└── server/             # 整个目录（后端代码）
    ├── server.js
    ├── db.js
    ├── package.json
    └── package-lock.json
```

> **⚠️ 注意**：不需要上传 `node_modules/`、`src/`、根目录的 `package.json` 等前端开发文件。`sharkfit.db` 也不需要上传，首次启动会自动创建。

### 步骤 3：安装后端依赖

```bash
cd /www/wwwroot/sharkfit/server
npm install --production
```

这将安装 4 个依赖：
- `express` — Web 框架
- `cors` — 跨域中间件
- `better-sqlite3` — SQLite 数据库驱动（会编译 C++ 原生模块）
- `uuid` — 生成唯一 ID

> **⚠️ 如果 `better-sqlite3` 编译失败**，需要先安装编译工具：
> ```bash
> # CentOS / RHEL
> yum install -y gcc gcc-c++ make python3
> 
> # Ubuntu / Debian
> apt-get install -y build-essential python3
> ```
> 然后重新执行 `npm install --production`。

### 步骤 4：首次启动测试

```bash
cd /www/wwwroot/sharkfit
node server/server.js
```

启动成功后应看到：
```
  ╔══════════════════════════════════════╗
  ║    🦈 Shark Fit API Server           ║
  ║    运行在: http://0.0.0.0:3001        ║
  ║    数据库: sharkfit.db (SQLite)       ║
  ╚══════════════════════════════════════╝
```

同时会输出 `[DB] 首次启动，播种默认动作数据...`，表示数据库已自动创建并写入了 31 个预设动作和 7 天周计划。

使用 `Ctrl+C` 停止测试进程。

### 步骤 5：验证服务可用

在浏览器中访问：
```
http://你的服务器IP:3001/api/health
```

应返回类似：
```json
{
  "status": "ok",
  "timestamp": "2026-04-26T...",
  "database": {
    "exercises": 31,
    "records": 0
  }
}
```

然后访问主页：
```
http://你的服务器IP:3001
```

应能看到 Shark Fit 应用界面。

### 步骤 6：防火墙放行端口

在宝塔面板中：
1. 进入 **安全** → **防火墙**
2. 放行端口 **3001**（TCP 协议）
3. 如果服务器有云安全组（如阿里云/腾讯云），也需要在云控制台放行 3001 端口

### 步骤 7：使用 PM2 守护进程（保持后台运行）

```bash
# 安装 PM2
npm install -g pm2

# 启动并守护
cd /www/wwwroot/sharkfit
pm2 start server/server.js --name sharkfit

# 设置开机自启
pm2 save
pm2 startup
```

常用 PM2 命令：
```bash
pm2 list              # 查看所有运行中的应用
pm2 logs sharkfit     # 查看实时日志
pm2 restart sharkfit  # 重启
pm2 stop sharkfit     # 停止
pm2 delete sharkfit   # 删除
```

### 步骤 8（可选）：使用 Nginx 反向代理

如果你希望通过域名（或 80/443 端口）访问，可以在宝塔面板中新建一个网站，然后添加反向代理：

在宝塔面板中：
1. **网站** → **添加站点** → 填入域名
2. 进入站点设置 → **反向代理** → **添加反向代理**
3. 填写：
   - 代理名称：`sharkfit`
   - 目标URL：`http://127.0.0.1:3001`
   - 发送域名：`$host`

这样就可以通过域名直接访问，无需在 URL 中带 `:3001`。

---

## 四、数据库结构

SQLite 数据库文件路径：`server/sharkfit.db`（首次启动 `server.js` 时自动创建）

### 表 1：`exercises`（动作库）

| 字段       | 类型     | 说明           | 示例                    |
|-----------|---------|---------------|------------------------|
| id        | TEXT PK | UUID 主键      | `e1`                   |
| name      | TEXT    | 动作名称        | `平板杠铃卧推`            |
| target    | TEXT    | 目标肌群        | `胸`                    |
| sets      | INTEGER | 推荐组数        | `4`                    |
| reps      | TEXT    | 推荐次数        | `6-8`                  |
| rest      | INTEGER | 推荐休息(秒)     | `90`                   |
| imageUrl  | TEXT    | 动作图片 URL    | (空字符串)               |
| notes     | TEXT    | 动作注意事项     | `沉肩扎根，肩胛骨收紧...`  |
| created_at| DATETIME| 创建时间        | 自动生成                 |

### 表 2：`routines`（周训练计划）

| 字段         | 类型     | 说明                     | 示例                     |
|-------------|---------|-------------------------|-------------------------|
| dayOfWeek   | INT PK  | 星期几 (0=周日, 1=周一...)  | `1`                     |
| name        | TEXT    | 计划名称                  | `胸 + 三头 + 腹`          |
| exerciseIds | TEXT    | 动作 ID 数组 (JSON 字符串)  | `["e1","e2","e3"]`       |

### 表 3：`workout_sets`（训练打卡记录）

| 字段        | 类型     | 说明             | 示例                       |
|------------|---------|-----------------|---------------------------|
| id         | TEXT PK | UUID 主键        | `uuid-v4-string`           |
| exerciseId | TEXT    | 关联的动作 ID     | `e1`                       |
| date       | TEXT    | 训练日期          | `2026-04-26`               |
| weight     | REAL    | 重量 (kg)        | `80.0`                     |
| reps       | INTEGER | 次数             | `8`                        |
| isPR       | INTEGER | 是否个人纪录 (0/1) | `1`                        |
| created_at | DATETIME| 创建时间          | 自动生成                    |

### 表 4：`body_weight`（体重记录）

| 字段        | 类型     | 说明          | 示例              |
|------------|---------|--------------|------------------|
| id         | TEXT PK | UUID 主键     | `uuid-v4-string`  |
| weight     | REAL    | 体重 (kg)     | `73.5`            |
| date       | TEXT    | 日期           | `2026-04-26`      |
| created_at | DATETIME| 创建时间        | 自动生成           |

### 索引

- `idx_sets_date` → `workout_sets(date)`
- `idx_sets_exercise` → `workout_sets(exerciseId)`
- `idx_weight_date` → `body_weight(date)`

---

## 五、完整 API 接口文档

### 基础信息

- **Base URL**: `http://服务器IP:3001`
- **Content-Type**: `application/json`
- **字符集**: UTF-8

---

### 5.1 健康检查

#### `GET /api/health`

检查服务是否正常运行。

**响应示例**：
```json
{
  "status": "ok",
  "timestamp": "2026-04-26T08:00:00.000Z",
  "database": { "exercises": 31, "records": 125 }
}
```

---

### 5.2 动作库

#### `GET /api/exercises`

获取全部动作列表。

**响应**：`200` — 返回动作数组

---

#### `POST /api/exercises`

新增一个动作。

**请求体**：
```json
{
  "name": "引体向上",           // 必填
  "target": "背",              // 必填
  "sets": 4,                   // 可选，默认 4
  "reps": "6-8",               // 可选，默认 "8-12"
  "rest": 90,                  // 可选，默认 60 (秒)
  "imageUrl": "",              // 可选
  "notes": "宽握，挺胸沉肩"     // 可选
}
```

**响应**：`201` — 返回创建的完整动作对象（含自动生成的 `id`）

---

#### `PUT /api/exercises/:id`

修改一个动作（部分更新，只传需要修改的字段）。

**请求体**（示例，只修改备注）：
```json
{ "notes": "新的注意事项" }
```

**响应**：`200` — 返回修改后的完整动作对象

---

#### `DELETE /api/exercises/:id`

删除一个动作。**级联操作**：同时删除该动作的所有打卡记录，并从周计划中移除该动作的引用。

**响应**：`200` — `{ "success": true, "message": "..." }`

---

### 5.3 周训练计划

#### `GET /api/routines`

获取全部 7 天的周计划。

**响应示例**：
```json
[
  { "dayOfWeek": 0, "name": "休息 / 轻有氧", "exerciseIds": [] },
  { "dayOfWeek": 1, "name": "胸 + 三头 + 腹", "exerciseIds": ["e1", "e2", "e3"] },
  ...
]
```

---

#### `PUT /api/routines/:dayOfWeek`

修改某天的训练计划。

**URL 参数**：`dayOfWeek` 为 0-6（0=周日，1=周一，...，6=周六）

**请求体**：
```json
{
  "name": "新计划名",                        // 可选
  "exerciseIds": ["e1", "e8", "e14"]        // 可选，动作 ID 数组
}
```

**响应**：`200` — 返回修改后的计划对象

---

### 5.4 训练打卡记录

#### `GET /api/records`

获取打卡记录。支持查询参数过滤。

**查询参数**（可选）：
- `?date=2026-04-26` — 按日期筛选
- `?exerciseId=e1` — 按动作筛选

**响应**：`200` — 返回记录数组

---

#### `POST /api/records`

新增一组打卡记录。服务端自动计算是否为 PR（个人纪录）。

**请求体**：
```json
{
  "exerciseId": "e1",       // 必填
  "date": "2026-04-26",     // 必填
  "weight": 80,             // 必填 (kg)
  "reps": 8                 // 必填
}
```

**响应**：`201` — 返回含 `id` 和 `isPR` 的完整记录

---

#### `DELETE /api/records/:id`

删除一组打卡记录。

**响应**：`200` — `{ "success": true, "message": "..." }`

---

### 5.5 体重记录

#### `POST /api/bodyweight`

记录体重。每天只保留一条记录（同一天重复提交会覆盖前值）。

**请求体**：
```json
{
  "weight": 73.5,             // 必填 (kg)
  "date": "2026-04-26"        // 必填
}
```

**响应**：`201` — `{ "id": "...", "weight": 73.5, "date": "2026-04-26" }`

---

### 5.6 数据分析

#### `GET /api/analytics/summary`

获取分析概览（本周总容量、连续训练天数）。

**响应**：
```json
{
  "totalVolume": 12500,      // 本周总容量 (weight × reps 之和)
  "streak": 3                // 连续训练天数
}
```

---

#### `GET /api/analytics/strength/:exerciseId`

获取某动作的力量增长趋势（每天取最大重量）。

**响应**：
```json
[
  { "date": "2026-04-20", "maxWeight": 75 },
  { "date": "2026-04-22", "maxWeight": 77.5 },
  { "date": "2026-04-24", "maxWeight": 80 }
]
```

---

#### `GET /api/analytics/weight`

获取体重趋势。

**响应**：
```json
[
  { "date": "2026-04-20", "weight": 75.0 },
  { "date": "2026-04-21", "weight": 74.8 },
  { "date": "2026-04-22", "weight": 74.5 }
]
```

---

### 5.7 全量数据同步

#### `GET /api/sync/pull`

⭐ **核心接口**。前端每次打开应用时调用此接口，一次性拉取全部数据。

**响应**：
```json
{
  "exercises": [ ... ],         // 全部动作
  "routines": [ ... ],          // 全部周计划（exerciseIds 已解析为数组）
  "history": [                  // 全部训练记录（按日期嵌套）
    {
      "date": "2026-04-26",
      "workouts": [
        {
          "exerciseId": "e1",
          "sets": [
            { "id": "...", "weight": 80, "reps": 8, "isPR": false }
          ]
        }
      ]
    }
  ],
  "bodyWeight": [               // 全部体重记录
    { "id": "...", "weight": 73.5, "date": "2026-04-26" }
  ]
}
```

---

## 六、前端数据流说明

前端使用 **Zustand** 状态管理库，数据流如下：

```
应用打开 → 调用 GET /api/sync/pull → 全量覆盖本地状态
                                          │
用户操作（如记录训练）→ 乐观更新本地 UI → 异步推送到后端 API
                                          │
后端写入 SQLite → 返回确认 → 前端用真实 ID 替换临时 ID
```

**API 地址逻辑**：前端代码会自动检测当前页面的 `hostname`，拼接 `:3001` 作为 API 地址。也就是说：
- 如果用户访问 `http://47.86.24.26:3001`，API 请求发往 `http://47.86.24.26:3001/api/*`
- 如果用户访问 `http://localhost:3001`，API 请求发往 `http://localhost:3001/api/*`
- **无需硬编码 IP 地址**

---

## 七、常见问题

### Q: 如何备份数据？
数据全部存储在 `server/sharkfit.db` 一个文件中。定期复制这个文件即可完成备份。

### Q: 如何重置所有数据？
```bash
cd /www/wwwroot/sharkfit/server
rm sharkfit.db sharkfit.db-shm sharkfit.db-wal
pm2 restart sharkfit
```
重启后会自动重新创建数据库并播种默认动作。

### Q: 端口冲突怎么办？
修改环境变量：
```bash
PORT=3002 pm2 start server/server.js --name sharkfit
```
同时需要在前端 `src/store/useFitnessStore.js` 中修改 `getApiBaseUrl` 函数的端口号，然后重新构建前端（`npm run build`）。

### Q: 如何查看实时日志？
```bash
pm2 logs sharkfit
```

### Q: 内存占用多大？
Node.js 进程约 **30-50 MB** 内存，SQLite 数据库文件通常 **< 1 MB**。2 核 2 GB 服务器完全够用。

---

## 八、部署 Checklist

```
□ 1. 宝塔安装 Node.js v18+
□ 2. 上传 dist/ 和 server/ 目录到服务器
□ 3. 在 server/ 目录执行 npm install --production
□ 4. 测试启动：node server/server.js
□ 5. 访问 http://IP:3001/api/health 确认接口可用
□ 6. 访问 http://IP:3001 确认页面可用
□ 7. 宝塔防火墙 + 云安全组放行 3001 端口
□ 8. 安装 PM2 并守护进程
□ 9.（可选）配置 Nginx 反向代理 + 域名
```
