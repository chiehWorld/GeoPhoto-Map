# 使用镜像源拉取 Node.js 20 官方镜像
FROM docker.m.daocloud.io/library/node:20-slim AS builder

# 设置工作目录
WORKDIR /app

# 复制 package.json 和 package-lock.json
COPY package*.json ./

# 安装所有依赖（包括开发依赖，用于构建前端）
RUN npm install

# 复制所有源代码
COPY . .

# 构建前端静态资源
RUN npm run build

# 编译后端代码 (使用 tsc)
RUN npx tsc server.ts --esModuleInterop --module ESNext --moduleResolution node --target ESNext --outDir dist-server --skipLibCheck

# --- 运行阶段 ---
FROM docker.m.daocloud.io/library/node:20-slim

WORKDIR /app

# 安装 sharp 所需的基础运行库和 exiftool (更换为阿里云镜像源以加速)
RUN sed -i 's/deb.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list.d/debian.sources && \
    apt-get update && apt-get install -y \
    libvips-dev \
    libimage-exiftool-perl \
    && rm -rf /var/lib/apt/lists/*

# 复制依赖文件
COPY package*.json ./

# 使用国内镜像源安装生产依赖
RUN npm config set registry https://registry.npmmirror.com && \
    npm install --omit=dev

# 复制构建产物
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/dist-server ./
COPY --from=builder /app/config.json ./

# 创建必要的目录
RUN mkdir -p /app/thumbnails /app/data /app/photos /app/photos_external

# 暴露端口
EXPOSE 3000
ENV NODE_ENV=production

# 直接用 node 运行编译后的文件
CMD ["node", "server.js"]
