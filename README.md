# Supioc AI Explorer

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.x-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](#许可证)

一个现代化多模型 AI 工具探索前端，内置聊天、绘图、视频占位与 Agent 展示页。  
前端统一走同源 `/api`，开发环境默认代理到 `https://api.supioc.com`。

## 预览截图

> 建议将截图放到 `docs/images/` 后替换下方路径。

![首页预览](docs/images/home.png)
![聊天页预览](docs/images/chat.png)
![绘图页预览](docs/images/drawing.png)

## 特性亮点

- 多页面工作台：`首页`、`聊天`、`绘图`、`视频`、`Agent`
- 多协议聊天：OpenAI / Anthropic / Gemini
- 会话系统：多会话切换、重命名、上下文占用提示、自动截断
- 模型管理：支持从接口拉取模型并添加自定义模型
- 绘图能力：Gemini 生图，支持模型、比例、分辨率配置
- 本地持久化：IndexedDB 保存会话、模型、设置与缓存

## 技术栈

- React 19
- TypeScript
- Vite 6
- Tailwind CSS 4
- Motion
- IndexedDB

## 快速开始

### 1) 安装依赖

```bash
npm install
```

### 2) 配置环境变量

Windows PowerShell：

```powershell
Copy-Item .env.example .env.local
```

macOS / Linux：

```bash
cp .env.example .env.local
```

示例：

```env
GEMINI_API_KEY="YOUR_KEY"
APP_URL="http://localhost:3000"
```

> 实际聊天/生图主要使用设置面板中配置的 API Key；`GEMINI_API_KEY` 用于兼容部分运行场景。

### 3) 启动开发环境

```bash
npm run dev
```

访问地址：`http://localhost:3000`

## 常用命令

```bash
npm run dev      # 本地开发
npm run build    # 生产构建
npm run preview  # 构建产物预览
npm run lint     # TypeScript 类型检查
npm run clean    # 清理 dist
```

## 目录结构

```text
.
├─ src/
│  ├─ components/      # 页面与 UI 组件
│  ├─ services/        # 聊天/模型/生图 API
│  ├─ db/              # IndexedDB 封装与常量
│  ├─ types.ts         # 共享类型
│  └─ App.tsx          # 应用入口
├─ .env.example
├─ vite.config.ts
└─ package.json
```

## 接口与部署说明

- 前端统一请求同源 `/api`
- 本地开发通过 `vite.config.ts` 代理到 `https://api.supioc.com`
- 生产环境请在网关层配置 `/api` 反向代理

若出现 CORS 或 404，请优先检查：

- 是否通过 `npm run dev` 启动（确保代理生效）
- 请求路径是否是 `/api/...`
- 线上是否正确配置反向代理

## 数据持久化

IndexedDB 持久化以下内容：

- 聊天会话与当前活动会话
- 默认模型与自定义模型
- 可用模型缓存（含过期时间）
- 用户设置（主题、语言、API Key、账户信息等）

## Roadmap

- [x] 多协议聊天（OpenAI / Anthropic / Gemini）
- [x] Gemini 生图工作流
- [x] 会话与模型本地持久化
- [ ] 视频生成功能接入（当前为占位页）
- [ ] Agent 页面能力实装
- [ ] 更多导入导出与协作能力

## 贡献指南

欢迎提交 Issue / PR。

1. Fork 项目并创建功能分支：`feat/xxx`
2. 保持改动聚焦，附带必要说明
3. 提交前执行：

```bash
npm run lint
npm run build
```

## 许可证

本项目使用 MIT 许可证。可在仓库中添加 `LICENSE` 文件后更新此处说明。
