<p align="center">
  <img src="https://img.shields.io/badge/macOS-12%2B-blue?logo=apple&logoColor=white" alt="macOS 12+">
  <img src="https://img.shields.io/badge/Electron-28-47848F?logo=electron&logoColor=white" alt="Electron">
  <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black" alt="React 18">
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="MIT License">
</p>

<h1 align="center">OpenClaw 飞书专版<br><sub>Feishu / Lark AI Bot Desktop App</sub></h1>

<p align="center">
  <b>3 分钟拥有你的私有飞书 AI 助手 — 零依赖、开箱即用</b><br>
  <i>Your private AI assistant on Feishu / Lark in 3 minutes — zero dependencies, ready out of the box</i>
</p>

<p align="center">
  <a href="#-快速开始--quick-start">快速开始</a> •
  <a href="#-功能特性--features">功能特性</a> •
  <a href="#-支持的-ai-模型--supported-models">AI 模型</a> •
  <a href="#-安装使用指南--documentation">文档</a> •
  <a href="#-常见问题--faq">FAQ</a>
</p>

---

## 这是什么？ | What is this?

**OpenClaw 飞书专版**是一款 macOS 桌面应用，让你在飞书（Feishu / Lark）中拥有一个 AI 聊天机器人。不需要服务器、不需要命令行、不需要安装 Node.js —— 下载 DMG，拖入 Applications，跟着向导配置，完成。

**OpenClaw Feishu Edition** is a macOS desktop app that gives you an AI chatbot inside Feishu (Lark). No server, no command line, no Node.js installation needed — download the DMG, drag to Applications, follow the setup wizard, and you're done.

> **为什么选择 OpenClaw 飞书专版？**
>
> - 你不想折腾服务器，但想让团队用上 AI
> - 你想把 AI 接入飞书，而不是切换到另一个 App
> - 你想用国产大模型，但不想写代码对接 API
>
> **Why OpenClaw Feishu Edition?**
>
> - You want AI for your team without managing servers
> - You want AI inside Feishu / Lark, not in yet another app
> - You want to use Chinese AI models without writing API code

---

## ✨ 功能特性 | Features

| 特性 Feature | 说明 Description |
|:---|:---|
| **零依赖安装** Zero-Dependency | DMG 内置 Node.js 和 OpenClaw 引擎，拖入即用。No external dependencies — everything bundled in the DMG. |
| **图形化配置** GUI Setup Wizard | 步步引导，3 分钟完成。Step-by-step wizard, done in 3 minutes. |
| **四大国产模型** 4 Chinese AI Models | MiniMax、智谱 GLM、豆包 Doubao、Kimi 一键切换。Switch between models with one click. |
| **私聊 + 群聊** DM & Group Chat | 私聊直接对话，群聊 @机器人 触发。Direct messages and @-mention in group chats. |
| **飞书长连接** WebSocket | 无需公网服务器或域名。No public server or domain needed. |
| **菜单栏常驻** Menu Bar App | macOS 菜单栏图标实时显示运行状态。Real-time status in macOS menu bar. |
| **34 个内置插件** 34 Built-in Plugins | 天气、网页摘要、代码执行等，按需启用。Weather, web summary, code execution, and more. |

---

## 🤖 支持的 AI 模型 | Supported Models

| 模型 Model | 特点 Highlights | 适合场景 Best For |
|:---|:---|:---|
| **MiniMax** ⭐ 推荐 | 中文写作出色，性价比高 · Excellent Chinese writing, cost-effective | 日常对话、写作 · Daily chat, writing |
| **智谱 GLM** (Zhipu) | 编程和工具调用强 · Strong coding & tool use | 编程辅助 · Coding assistant |
| **豆包 Doubao** (ByteDance) | 字节出品，综合能力强 · Well-rounded by ByteDance | 通用场景 · General purpose |
| **Kimi** (Moonshot) | 128K 超长上下文 · 128K ultra-long context | 长文档分析 · Long document analysis |
| **自定义** Custom | 兼容 OpenAI API 格式 · OpenAI API compatible | 高级用户 · Power users |

---

## 🚀 快速开始 | Quick Start

### 第一步：下载安装 | Step 1: Install

从 [Releases](../../releases) 页面下载最新 `.dmg` 文件，双击打开，拖入 Applications 文件夹。

Download the latest `.dmg` from [Releases](../../releases), double-click to open, drag to Applications.

> 安装包约 400–500 MB（已内置所有运行依赖）
>
> The installer is ~400–500 MB (all dependencies are bundled).

### 第二步：创建飞书机器人 | Step 2: Create Feishu Bot

在 [飞书开放平台](https://open.feishu.cn) 创建企业自建应用，添加机器人能力，配置权限和事件订阅。

Create a custom app on [Feishu Open Platform](https://open.feishu.cn), add Bot capability, configure permissions and event subscriptions.

详见 👉 [安装使用指南](docs/安装使用指南.md)

### 第三步：配置并使用 | Step 3: Configure & Use

启动应用 → 按向导填入 App ID / Secret 和 AI API Key → 在飞书中与你的 AI 助手对话！

Launch the app → Enter App ID / Secret and AI API Key in the wizard → Chat with your AI bot in Feishu!

---

## 🛠️ 从源码构建 | Build from Source

```bash
# 克隆仓库 | Clone
git clone https://github.com/lhfer/openclaw-feishu-edition.git
cd openclaw-feishu-edition

# 安装依赖 | Install dependencies
npm install

# 开发模式 | Development
npm run dev

# 构建 DMG（含 Node.js + OpenClaw 引擎）| Build DMG (with bundled engine)
npm run dist:mac

# 仅构建，不打包引擎 | Build without bundling engine
npm run dist:mac:nobundle
```

**构建要求 | Build Requirements:** Node.js 18+, macOS 12+

---

## 📁 项目结构 | Project Structure

```
openclaw-feishu-edition/
├── core/                  # 核心逻辑 | Core logic
│   ├── config-manager.ts  #   配置管理 | Config management
│   ├── feishu-validator.ts #   飞书验证 | Feishu validation
│   └── model-validator.ts  #   模型验证 | Model validation
├── electron/              # Electron 主进程 | Main process
│   ├── main.ts            #   应用入口 | Entry point
│   ├── gateway-manager.ts #   引擎管理 | Engine management
│   ├── ipc-handlers.ts    #   IPC 通信 | IPC communication
│   ├── preload.ts         #   预加载 | Preload script
│   └── tray.ts            #   菜单栏 | Menu bar tray
├── renderer/              # React 前端 | Frontend
│   ├── components/        #   UI 组件 | Components
│   ├── pages/             #   向导 & 设置 | Wizard & Settings
│   └── App.tsx            #   根组件 | Root component
├── scripts/
│   └── prepare-bundle.sh  # 打包脚本 | Bundle script
├── locales/zh-CN.json     # 中文本地化 | Chinese i18n
└── docs/                  # 文档 | Documentation
```

---

## 📖 安装使用指南 | Documentation

- [**安装使用指南**](docs/安装使用指南.md) — 从零开始的完整教程，包含飞书机器人创建、AI 模型开通、常见问题排查
- Complete setup guide (Chinese) covering Feishu bot creation, AI model onboarding, and troubleshooting

---

## ❓ 常见问题 | FAQ

<details>
<summary><b>需要安装 Node.js 吗？</b> | Do I need Node.js?</summary>
<br>
不需要。DMG 已内置 Node.js v22 和 OpenClaw 引擎。<br>
No. Node.js v22 and the OpenClaw engine are bundled in the DMG.
</details>

<details>
<summary><b>需要服务器吗？</b> | Do I need a server?</summary>
<br>
不需要。飞书长连接（WebSocket）模式让机器人直接从你的 Mac 连接飞书服务器。<br>
No. Feishu's WebSocket mode connects directly from your Mac — no public server needed.
</details>

<details>
<summary><b>支持 Intel Mac 吗？</b> | Does it support Intel Mac?</summary>
<br>
支持。构建时运行 <code>npm run prepare-bundle:x64</code> 即可。<br>
Yes. Use <code>npm run prepare-bundle:x64</code> when building.
</details>

<details>
<summary><b>可以同时用多个模型吗？</b> | Can I use multiple models?</summary>
<br>
目前一次只能配置一个模型，但可以在设置中随时切换。<br>
Currently one model at a time, but you can switch anytime in Settings.
</details>

---

## 🧩 技术栈 | Tech Stack

**Electron** · **React 18** · **TypeScript 5** · **Tailwind CSS** · **Vite 5** · **OpenClaw Engine** · **Feishu Open Platform SDK**

---

## 🤝 Contributing

欢迎 PR 和 Issue！如果这个项目对你有帮助，请给一个 ⭐ Star，这是对我最大的鼓励。

PRs and issues are welcome! If this project helps you, please give it a ⭐ Star — it means a lot.

---

## 📄 License

[MIT](LICENSE)

---

<p align="center">
  <sub>
    <b>Keywords:</b> 飞书机器人 · Feishu Bot · Lark Bot · 飞书AI助手 · Feishu AI Assistant · Lark AI Chatbot · OpenClaw · 飞书自建应用 · Feishu Custom App · Lark Custom App · AI Desktop App · 国产大模型 · Chinese LLM · MiniMax · 智谱GLM · 豆包Doubao · Kimi Moonshot · macOS · Electron · 零依赖 · Zero Dependency · 飞书开放平台 · Feishu Open Platform · Lark Open Platform
  </sub>
</p>
