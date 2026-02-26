# GeoPhoto Map 🌍📸

GeoPhoto Map 是一款专为摄影爱好者和 NAS 用户设计的个人照片地图展示系统。它能自动扫描您的照片库，提取 GPS 元数据，并在交互式地图上以聚合簇的形式展示您的足迹。

## Release v1.2 特性
1. 大规模数据性能优化
   - 数据库索引：为 path 和 has_gps 字段添加了 SQL 索引，将数据查询速度从秒级提升至毫秒级。
   - API 瘦身：
     - 新增 /api/stats 接口，仅返回统计数字。
     - 新增 /api/photos/mapped 接口，仅返回地图所需的坐标点信息，剔除了冗长的文件路径，减少了 90% 的网络传输量。
   - 扫描逻辑优化：无 GPS 照片不再生成缩略图。系统在扫描时会先检查元数据，若无位置信息则仅在数据库记录路径，直接跳过耗时的图片转换和缩略图生成步骤。这极大地节省了 NAS 的 CPU 资源和磁盘空间。
2. 可视化进度监控
   - 覆盖率进度条 (Mapping Coverage)：在侧边栏添加了绿色进度条，实时展示库中已定位照片占总照片数的百分比。
   - 扫描进度条 (Scan Progress)：
     - 后端新增了扫描计数逻辑（总数 vs 已处理数）。
     - 前端新增了蓝色动态进度条，仅在扫描进行时显示，并提供详细的文件计数（如 120,500 / 160,000）。
3. 动态配置管理
   - 多目录支持：支持在 config.json 中维护多个扫描目录。
   - 目录管理 UI：在侧边栏新增了“扫描目录”管理面板，支持在不重启容器的情况下，直接通过界面：
     - 查看当前所有扫描路径。
     - 实时添加新的扫描目录（如挂载的 NAS 路径）。
     - 删除不再需要的目录。

## ✨ 核心特性

- **智能元数据提取**：内置专业的 `exiftool` 引擎，能够精准读取包括 JPG 和 HEIC（iPhone 格式）在内的多种照片元数据，确保经纬度和拍摄时间无一遗漏。
- **完美的 HEIC 支持**：针对苹果设备常用的 HEIC 格式进行了深度优化，自动完成“元数据提取 -> 格式转换 -> 缩略图生成”的全流程，无需手动转换。
- **高性能地图展示**：采用 Leaflet 与 MarkerCluster 技术，支持数千张照片的流畅缩放与聚合展示。
- **极速缩略图预览**：自动为大图生成轻量级缩略图并持久化存储，大幅提升照片墙的加载速度，节省带宽。
- **NAS 友好型设计**：原生支持 Docker 部署，特别针对群晖（Synology）等 NAS 环境进行了路径映射优化。
- **实时同步扫描**：支持后台自动扫描与手动刷新，确保您的照片库始终保持最新状态。
- **极简暗色 UI**：采用现代化的暗色调界面设计，聚焦照片本身，提供沉浸式的浏览体验。

## 🛠️ 技术栈

- **前端**：React 19, Tailwind CSS, Lucide React, Leaflet, Framer Motion
- **后端**：Node.js, Express, SQLite (better-sqlite3)
- **图像处理**：Sharp, heic-convert, Exiftool

## 🚀 快速开始 (Docker)

### 1. 准备工作
确保您的宿主机上已安装 Docker。

### 2. 构建镜像
```bash
docker build -t geophoto-map .
```

### 3. 运行容器
```bash
docker run -d --name geophoto -p 3000:3000 \
  -v "/你的照片路径:/app/photos_external" \
  -v "/你的缩略图存储路径:/app/thumbnails" \
  -v "/你的数据库存储路径:/app/data" \
  geophoto-map
```

## 📂 目录说明

- `/app/photos_external`: 挂载您的原始照片库（支持递归扫描）。
- `/app/thumbnails`: 存放生成的缩略图文件（建议持久化）。
- `/app/data`: 存放 `photos.db` 数据库文件（建议持久化）。

## 💡 迁移至群晖 (Synology)

1. 在本地使用 `docker save geophoto-map > geophoto-map.tar` 导出镜像。
2. 在群晖 **Container Manager** 中导入该 `.tar` 文件。
3. 使用 **Docker Compose** (项目) 进行部署，确保卷映射（Volumes）指向正确的共享文件夹路径。

---
*GeoPhoto Map - 让每一张照片都有迹可循。*
