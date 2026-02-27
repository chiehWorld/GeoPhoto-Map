# GeoPhoto Map 🌍📸

GeoPhoto Map 是一款专为摄影爱好者和 NAS 用户设计的个人照片地图展示系统。它能自动扫描您的照片库，提取 GPS 元数据，并在交互式地图上以聚合簇的形式展示您的足迹。

## Beta v1.2.1 特性
**本次更新不涉及缩略图或数据库结构更改，因此不需要刷新任何持久化文件**。
1. 修复碎图问题：
- 原因：之前详情卡片尝试直接加载原始照片文件。由于浏览器原生不支持直接显示 HEIC，导致出现碎图。
- 修复：现在详情卡片统一加载经过后端转换的 JPEG 缩略图，确保所有照片（包括 HEIC）都能完美预览。
2. 扩大预览尺寸：
- 将底部详情卡片的图片预览区域从 24x24 (96px) 扩大到了 40x40 (160px)。
- 卡片整体宽度也进行了扩展（max-w-2xl），提供了更开阔的视觉空间。
增加了悬停缩放效果（Hover Scale），让预览更具交互感。
- 展示完整物理路径：
  - 在详情卡片底部新增了 Path 区域。
  - 现在您可以直接看到照片在 NAS 上的完整存储路径（例如 /app/nas_photos/IMG_7116.HEIC），方便您在文件管理器中快速定位。
3. UI 细节提升：
- 优化了排版，使用了更清晰的图标（坐标、日期、文件夹）。
- 增加了背景微光效果（Glow Effect），使详情卡片在暗色地图背景下更具质感。

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
  -v "/你的缩略图存储路径:/app/geophoto_thumbs" \
  -v "/你的数据库存储路径:/app/geophoto_data" \
  geophoto-map
```

## 📂 目录说明

在 Docker 的 volumes 配置中，冒号（:）后面的部分是容器内部的路径。你可以根据自己的喜好自由命名，但为了方便管理和在应用界面中识别，建议遵循以下几个原则：

1. 推荐的命名方式：建议统一使用 /app/ 作为前缀，后面接一个描述性的名称。
例如：
```
  - "/volume1/photo:/app/photos_main"           # 主照片库
  - "/volume2/backup/iphone:/app/photos_iphone" # 手机备份
  - "/volume3/archive/2023:/app/photos_2023"    # 年度归档
```

2. 命名建议:
- 使用下划线或连字符：避免使用空格（例如用 photos_main 而不是 photos main）。
- 具有辨识度：因为这些名字（如 /app/photos_main）会直接显示在你网页端的“Scan Directories”列表中，起一个你能一眼看出是哪个文件夹的名字会很有帮助。
- 不要冲突：确保容器内路径是唯一的，不要把两个不同的物理文件夹映射到同一个容器路径。

3. 如何在应用中使用:
- 当你按照 YAML 挂载好并启动容器后：
  - 打开 GeoPhoto Map 网页。
  - 在左侧边栏底部的 Scan Directories 区域。
  - 在输入框中输入你在 YAML 中定义的容器内路径（例如 /app/photos_main）。
  - 点击 "+" 号添加。
  - 对其他路径（如 /app/photos_iphone）重复上述步骤。

## 💡 迁移至群晖 (Synology)

1. 在本地使用 `docker save geophoto-map > geophoto-map.tar` 导出镜像。
2. 在群晖 **Container Manager** 中导入该 `.tar` 文件。
3. 使用 **Docker Compose** (项目) 进行部署，确保卷映射（Volumes）指向正确的共享文件夹路径。

---
*GeoPhoto Map - 让每一张照片都有迹可循。*
