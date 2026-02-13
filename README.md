# OpenClaw 飞书专版

> 零依赖、开箱即用的飞书 AI 机器人桌面应用，专为中国用户打造。

OpenClaw 飞书专版是一款 macOS 桌面应用，让你在 3 分钟内拥有一个私有的飞书 AI 助手。无需服务器、无需命令行、无需安装 Node.js —— 下载 DMG，拖入 Applications，配置飞书凭证和 API Key 即可使用。

## 功能特性

- **零依赖安装**：DMG 内置 Node.js 运行时和 OpenClaw 引擎，拖入即用
- **图形化配置向导**：步步引导，3 分钟完成飞书机器人连接和 AI 模型配置
- **多模型支持**：MiniMax、智谱 GLM、豆包 Doubao、Kimi（月之暗面）四大国产模型，一键切换
- **私聊 + 群聊**：支持飞书私聊直接对话，群聊 @机器人 触发回复
- **飞书长连接**：基于 WebSocket 长连接，无需公网服务器或域名
- **菜单栏常驻**：macOS 菜单栏图标显示运行状态，一键管理
- **34 个内置插件**：天气查询、网页摘要、代码执行等（大部分默认关闭，按需启用）

## 支持的 AI 模型

| 模型 | 特点 | 适合场景 |
|------|------|---------|
| **MiniMax**（推荐） | 中文写作能力出色，性价比高 | 日常对话、写作创意 |
| **智谱 GLM** | 编程和工具调用能力强 | 编程辅助、技术问答 |
| **豆包 Doubao** | 字节出品，综合能力强 | 通用场景 |
| **Kimi** | 128K 超长上下文 | 长文档处理、深度分析 |

## 快速开始

### 1. 下载安装

从 [Releases](../../releases) 页面下载最新的 `.dmg` 文件，双击打开后拖入 Applications 文件夹。

### 2. 创建飞书机器人

在[飞书开放平台](https://open.feishu.cn)创建企业自建应用，添加机器人能力，配置权限和事件订阅。详见 [安装使用指南](docs/安装使用指南.md)。

### 3. 配置并使用

启动应用，按配置向导填入飞书 App ID / Secret 和 AI 模型 API Key，即可在飞书中与你的 AI 助手对话。

## 从源码构建

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建 DMG（含 Node.js 和 OpenClaw 引擎打包）
npm run dist:mac

# 仅构建，不打包引擎（需要系统已安装 Node.js）
npm run dist:mac:nobundle
```

### 构建要求

- Node.js 18+ （开发机器上需要，最终 DMG 用户不需要）
- macOS 12 Monterey 或更高

## 项目结构

```
openclaw-feishu-edition/
├── core/                  # 核心业务逻辑
│   ├── config-manager.ts  # 配置管理（飞书凭证、模型设置）
│   ├── feishu-validator.ts # 飞书配置验证
│   └── model-validator.ts  # AI 模型连接验证
├── electron/              # Electron 主进程
│   ├── main.ts            # 应用入口
│   ├── gateway-manager.ts # OpenClaw 引擎管理（核心）
│   ├── ipc-handlers.ts    # IPC 通信
│   ├── preload.ts         # 预加载脚本
│   └── tray.ts            # 菜单栏托盘
├── renderer/              # React 前端
│   ├── components/        # UI 组件
│   ├── pages/             # 页面（配置向导、设置等）
│   └── App.tsx            # 应用根组件
├── scripts/
│   └── prepare-bundle.sh  # 打包脚本（下载 Node.js + 安装引擎）
├── locales/
│   └── zh-CN.json         # 中文本地化
├── docs/
│   └── 安装使用指南.md      # 详细安装使用文档
└── package.json
```

## 技术栈

- **Electron** — 跨平台桌面应用框架
- **React + TypeScript** — 前端 UI
- **Tailwind CSS** — 样式
- **Vite** — 前端构建工具
- **OpenClaw** — AI Gateway 引擎
- **飞书开放平台 SDK** — 长连接消息通信

## 文档

- [安装使用指南](docs/安装使用指南.md) — 从零开始的完整配置教程，包含飞书机器人创建、模型开通等

## License

MIT
