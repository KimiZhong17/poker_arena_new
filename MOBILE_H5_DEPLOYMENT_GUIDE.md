# 手机 H5 部署指南

## 概述

让玩家通过手机浏览器访问你的游戏，需要将游戏构建为 Web 版本（H5），然后部署到可以通过手机访问的服务器上。

## 方案对比

### 方案 1：局域网 H5（最简单，适合测试）

**优点**：
- ✅ 无需公网服务器
- ✅ 配置简单
- ✅ 免费

**缺点**：
- ❌ 只能在同一个 WiFi 网络下玩
- ❌ 无法远程访问

**适用场景**：家庭聚会、办公室内部游戏

### 方案 2：云服务器部署（推荐，适合正式发布）

**优点**：
- ✅ 任何地方都能访问
- ✅ 支持 HTTPS（更安全）
- ✅ 可以绑定域名

**缺点**：
- ❌ 需要购买服务器（约 ¥50-100/月）
- ❌ 配置稍复杂

**适用场景**：正式发布、远程多人游戏

---

## 方案 1：局域网 H5 部署（快速开始）

### 步骤 1：构建 Web 版本

1. 打开 Cocos Creator
2. 点击 "项目" -> "构建发布"
3. 配置构建选项：
   - **发布平台**：选择 "Web Mobile"
   - **初始场景**：选择你的登录场景
   - **构建路径**：默认即可（`build/web-mobile`）
   - **调试模式**：取消勾选（正式版）
   - **源码打包**：勾选（减小体积）

4. 点击 "构建"，等待完成
5. 构建完成后，点击 "运行"测试

### 步骤 2：配置服务器地址

在构建之前，确保 `NetworkConfig.ts` 中的服务器 IP 设置正确：

\`\`\`typescript
// poker_arena_client/assets/Scripts/Config/NetworkConfig.ts
export class NetworkConfig {
    // 改成你的电脑的局域网 IP
    private static SERVER_IP: string = '192.168.1.100'; // 你的服务器 IP
    private static SERVER_PORT: number = 3000;
}
\`\`\`

### 步骤 3：部署 Web 文件

有两种方式：

#### 方式 A：使用 Node.js 静态服务器（推荐）

1. 安装 `http-server`：
   \`\`\`bash
   npm install -g http-server
   \`\`\`

2. 进入构建目录：
   \`\`\`bash
   cd poker_arena_client/build/web-mobile
   \`\`\`

3. 启动服务器：
   \`\`\`bash
   http-server -p 8080 --cors
   \`\`\`

4. 服务器会显示：
   \`\`\`
   Starting up http-server, serving ./
   Available on:
     http://192.168.1.100:8080
     http://127.0.0.1:8080
   \`\`\`

#### 方式 B：使用 Python 静态服务器

\`\`\`bash
cd poker_arena_client/build/web-mobile
python -m http.server 8080
\`\`\`

### 步骤 4：手机访问

1. 确保手机和电脑在同一个 WiFi 网络
2. 在手机浏览器中访问：`http://192.168.1.100:8080`
3. 开始游戏！

### 完整流程示例

\`\`\`bash
# 终端 1：启动游戏服务器
cd poker_arena_server
npm start
# 显示：Network: http://192.168.1.100:3000

# 终端 2：启动 Web 服务器
cd poker_arena_client/build/web-mobile
http-server -p 8080 --cors
# 显示：Available on: http://192.168.1.100:8080

# 手机浏览器访问：http://192.168.1.100:8080
\`\`\`

---

## 方案 2：云服务器部署（正式发布）

### 准备工作

1. **购买云服务器**（选择一个）：
   - 阿里云 ECS（推荐国内）
   - 腾讯云 CVM
   - AWS EC2
   - DigitalOcean（推荐国外）

   **配置建议**：
   - CPU: 1-2 核
   - 内存: 2GB
   - 带宽: 1-3 Mbps
   - 系统: Ubuntu 20.04 LTS

2. **购买域名**（可选但推荐）：
   - 阿里云万网
   - 腾讯云 DNSPod
   - GoDaddy

### 步骤 1：服务器环境配置

SSH 连接到服务器后：

\`\`\`bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装 Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# 安装 Nginx
sudo apt install -y nginx

# 安装 PM2（进程管理器）
sudo npm install -g pm2
\`\`\`

### 步骤 2：上传游戏文件

#### 上传游戏服务器

\`\`\`bash
# 在本地打包服务器代码
cd poker_arena_server
npm run build  # 如果有 build 脚本

# 使用 scp 上传到服务器
scp -r poker_arena_server root@your-server-ip:/var/www/
\`\`\`

#### 上传 Web 客户端

\`\`\`bash
# 上传构建好的 Web 文件
scp -r poker_arena_client/build/web-mobile root@your-server-ip:/var/www/poker-arena-web
\`\`\`

### 步骤 3：配置 Nginx

创建 Nginx 配置文件：

\`\`\`bash
sudo nano /etc/nginx/sites-available/poker-arena
\`\`\`

添加以下内容：

\`\`\`nginx
# HTTP 配置
server {
    listen 80;
    server_name your-domain.com;  # 改成你的域名或 IP

    # Web 客户端
    location / {
        root /var/www/poker-arena-web;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # WebSocket 代理（游戏服务器）
    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # API 代理
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
\`\`\`

启用配置：

\`\`\`bash
sudo ln -s /etc/nginx/sites-available/poker-arena /etc/nginx/sites-enabled/
sudo nginx -t  # 测试配置
sudo systemctl restart nginx
\`\`\`

### 步骤 4：启动游戏服务器

\`\`\`bash
cd /var/www/poker_arena_server
npm install --production
pm2 start src/server.ts --name poker-arena-server
pm2 save
pm2 startup  # 设置开机自启
\`\`\`

### 步骤 5：配置 HTTPS（推荐）

使用 Let's Encrypt 免费 SSL 证书：

\`\`\`bash
# 安装 Certbot
sudo apt install -y certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d your-domain.com

# 自动续期
sudo certbot renew --dry-run
\`\`\`

### 步骤 6：配置防火墙

\`\`\`bash
# 允许 HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 3000/tcp  # 游戏服务器端口
sudo ufw enable
\`\`\`

### 步骤 7：更新客户端配置

修改 `NetworkConfig.ts`：

\`\`\`typescript
export class NetworkConfig {
    // 使用域名或服务器公网 IP
    private static SERVER_IP: string = 'your-domain.com'; // 或 '123.45.67.89'
    private static SERVER_PORT: number = 80; // 如果使用 Nginx 代理，改为 80
}
\`\`\`

重新构建并上传客户端。

---

## 手机浏览器优化

### 1. 添加到主屏幕（PWA）

在 `index.html` 中添加：

\`\`\`html
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black">
<meta name="apple-mobile-web-app-title" content="Poker Arena">
<link rel="apple-touch-icon" href="icon.png">
\`\`\`

### 2. 禁用缩放

\`\`\`html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
\`\`\`

### 3. 全屏模式

\`\`\`html
<meta name="mobile-web-app-capable" content="yes">
\`\`\`

---

## 测试清单

- [ ] 手机能访问游戏页面
- [ ] 能正常登录
- [ ] 能创建/加入房间
- [ ] 能正常游戏（发牌、出牌、结算）
- [ ] 触摸操作流畅
- [ ] 横屏/竖屏显示正常
- [ ] 网络断线能重连

---

## 常见问题

### Q: 手机无法连接到服务器

**A**: 检查：
1. 手机和电脑是否在同一个 WiFi
2. 防火墙是否允许端口 3000 和 8080
3. `NetworkConfig.ts` 中的 IP 是否正确
4. 服务器是否正在运行

### Q: 游戏加载很慢

**A**: 优化方案：
1. 在构建时勾选 "源码打包"
2. 压缩图片资源
3. 使用 CDN 加速
4. 启用 Nginx gzip 压缩

### Q: 触摸操作不灵敏

**A**:
1. 确保 Cocos Creator 构建时选择了 "Web Mobile"
2. 检查触摸事件是否正确绑定
3. 调整按钮大小（手机屏幕较小）

### Q: 横屏显示不正常

**A**:
1. 在 Cocos Creator 项目设置中配置屏幕方向
2. 添加 CSS 媒体查询适配不同屏幕

---

## 性能优化建议

1. **资源优化**：
   - 压缩图片（使用 TinyPNG）
   - 使用雪碧图（Sprite Atlas）
   - 减少音效文件大小

2. **网络优化**：
   - 启用 WebSocket 压缩
   - 减少网络消息频率
   - 使用二进制协议（MessagePack）

3. **渲染优化**：
   - 减少节点数量
   - 使用对象池
   - 避免频繁的 DOM 操作

---

## 下一步

- [ ] 添加微信分享功能
- [ ] 支持微信小游戏
- [ ] 添加支付功能（如需要）
- [ ] 接入统计分析（Google Analytics）
- [ ] 添加客服系统

---

## 快速命令参考

\`\`\`bash
# 本地测试
cd poker_arena_client/build/web-mobile && http-server -p 8080 --cors

# 查看服务器日志
pm2 logs poker-arena-server

# 重启服务器
pm2 restart poker-arena-server

# 查看服务器状态
pm2 status

# 更新代码后
cd /var/www/poker_arena_server
git pull
npm install
pm2 restart poker-arena-server
\`\`\`
