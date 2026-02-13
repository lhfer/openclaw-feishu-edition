<p align="center">
  <img src="https://img.shields.io/badge/macOS-12%2B-blue?logo=apple&logoColor=white" alt="macOS 12+">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="MIT License">
  <img src="https://img.shields.io/badge/零命令行-纯图形界面-orange" alt="No CLI">
  <img src="https://img.shields.io/badge/零依赖-开箱即用-brightgreen" alt="Zero Dependency">
</p>

<h1 align="center">OpenClaw 飞书专版<br><sub>Feishu / Lark AI Bot Desktop App</sub></h1>

<p align="center">
  <b>给不会写代码的你，做了一个飞书 AI 机器人安装包。<br>双击安装，点点鼠标，3 分钟搞定。</b>
</p>

<p align="center">
  <i>A dead-simple macOS app that gives you an AI chatbot in Feishu / Lark.<br>No coding, no terminal, no server — just install and click.</i>
</p>

<p align="center">
  <a href="#-三步搞定--3-steps-to-go">三步搞定</a> •
  <a href="#-和普通版-openclaw-有什么区别--vs-regular-openclaw">对比普通版</a> •
  <a href="#-支持的-ai-模型--supported-models">AI 模型</a> •
  <a href="#-常见问题--faq">FAQ</a> •
  <a href="#-给开发者--for-developers">开发者</a>
</p>

---

## 做这个项目的初衷

想在飞书里接一个 AI 机器人，但一搜教程全是命令行、Docker、服务器部署……

**如果你也觉得这些太折腾了，这个项目就是为你做的。**

OpenClaw 飞书专版把所有技术细节都藏在了一个 `.dmg` 安装包里。你要做的只有三件事：在飞书后台建个机器人、去 AI 平台拿个 Key、然后在应用里填进去。全程鼠标操作，不需要打开终端，不需要输入任何命令。

> **If you've ever wished you could set up a Feishu/Lark AI bot without touching a terminal, this is it.** Download, install, click through the wizard, done. Zero command line. Zero server. Zero coding.

---

## 🚀 三步搞定 | 3 Steps to Go

<table>
<tr>
<td width="33%" align="center">

### 1️⃣ 安装应用
**Install**

下载 DMG → 拖入 Applications

就像装其他 Mac 应用一样

*Just like installing any Mac app*

</td>
<td width="33%" align="center">

### 2️⃣ 建飞书机器人
**Create Bot**

在飞书后台点点鼠标创建

[详细图文教程 →](docs/安装使用指南.md)

*Click-through guide included*

</td>
<td width="33%" align="center">

### 3️⃣ 填入 Key
**Enter API Key**

跟着应用内向导操作

粘贴 App ID 和 API Key 即可

*Paste your keys, that's it*

</td>
</tr>
</table>

**然后？** 打开飞书，找到你的机器人，直接聊天。就这么简单。

**Then?** Open Feishu, find your bot, start chatting. That's it.

> 📦 [**点击下载最新版 DMG →**](../../releases)
>
> 安装包约 230 MB，已内置全部运行依赖，下载后拖入 Applications 即可使用。
>
> ~230 MB installer with everything bundled. Download, drag, done.

---

## ⚡ 和普通版 OpenClaw 有什么区别？ | vs Regular OpenClaw

|  | **OpenClaw 飞书专版** ✨ | **OpenClaw 普通版** |
|:---|:---|:---|
| **安装方式** | DMG 拖入即用，像装 QQ 一样 | `npm install openclaw` 命令行安装 |
| **需要命令行吗** | ❌ **完全不需要** | ✅ 需要熟悉终端操作 |
| **需要装 Node.js 吗** | ❌ 已内置 | ✅ 需要自己装 |
| **需要服务器吗** | ❌ 你的 Mac 就是服务器 | ❌ 同样不需要 |
| **配置方式** | 图形界面向导，点点鼠标 | 手动编辑 YAML 配置文件 |
| **AI 模型配置** | 选模型 → 粘贴 Key → 自动完成 | 需要手动填写 URL、格式等参数 |
| **支持的平台** | 飞书（专注优化） | 飞书、Discord、Slack、微信等多平台 |
| **国产模型适配** | 已预置 MiniMax / GLM / 豆包 / Kimi | 需要自己配 URL 和 API 格式 |
| **适合谁** | 不想碰代码的团队管理者、运营、HR… | 喜欢折腾的开发者 |
| **一句话总结** | **给普通人用的飞书 AI 机器人** | 灵活强大的 AI Gateway 框架 |

> 简单说：普通版 OpenClaw 像一台组装电脑，灵活但需要动手；飞书专版像一台开箱即用的 iMac，插电就能用。
>
> *Regular OpenClaw is a DIY PC — powerful and flexible. Feishu Edition is an iMac — just plug in and go.*

---

## ✨ 功能一览 | Features

| | |
|:---|:---|
| **🖱️ 纯鼠标操作** | 从安装到使用，全程不需要打开终端或输入任何命令 |
| **📦 零依赖** | 不用装 Node.js、npm 或任何开发工具，DMG 里全包了 |
| **🧙 配置向导** | 应用内一步步引导，填空题式操作，3 分钟完成 |
| **🤖 四大国产模型** | MiniMax、智谱 GLM、豆包、Kimi，选一个就行 |
| **💬 私聊 + 群聊** | 私聊直接对话，群里 @机器人 就能触发 |
| **🔌 无需服务器** | 飞书 WebSocket 长连接，你的 Mac 就是"服务器" |
| **📍 菜单栏常驻** | 右上角小图标，绿色 = 正常运行，随时查看状态 |
| **🧩 34 个插件** | 天气、搜索、网页摘要、代码执行……按需开启 |

---

## 🤖 支持的 AI 模型 | Supported Models

选一个你喜欢的就行，应用里可以随时切换：

| 模型 | 一句话介绍 | 注册地址 |
|:---|:---|:---|
| **MiniMax** ⭐ 推荐 | 中文写作出色，性价比高，新用户有免费额度 | [minimaxi.com →](https://www.minimaxi.com/platform) |
| **智谱 GLM** | 清华系出品，编程问答强 | [open.bigmodel.cn →](https://open.bigmodel.cn) |
| **豆包 Doubao** | 字节跳动出品，综合能力好 | [volcengine.com →](https://console.volcengine.com/ark) |
| **Kimi** | 月之暗面出品，能读超长文档（128K） | [moonshot.cn →](https://platform.moonshot.cn) |

> 还没有 API Key？没关系，先装应用，向导里可以跳过，拿到 Key 后再补上。
>
> *Don't have an API key yet? Install the app first, skip the model step in the wizard, and add it later.*

---

## ❓ 常见问题 | FAQ

<details>
<summary><b>我完全不懂技术，能用吗？</b></summary>
<br>
能。这个项目就是为不懂技术的人做的。安装过程和装微信、QQ 一样——下载、拖入、打开。配置过程就是复制粘贴几个 Key。全程不需要打开终端。
</details>

<details>
<summary><b>需要安装 Node.js 吗？</b></summary>
<br>
不需要。安装包已经内置了 Node.js v22 和 OpenClaw 引擎的全部依赖。你的电脑上不需要有任何开发工具。
</details>

<details>
<summary><b>需要自己的服务器吗？</b></summary>
<br>
不需要。应用通过飞书的 WebSocket 长连接模式工作，你的 Mac 就是"服务器"。不需要公网 IP，不需要域名，不需要云服务。
</details>

<details>
<summary><b>关掉应用后机器人还能回复吗？</b></summary>
<br>
不能。机器人运行在你的 Mac 上，关掉应用（或合上电脑）后机器人就停了。重新打开应用会自动恢复。
</details>

<details>
<summary><b>支持 Intel Mac 吗？</b></summary>
<br>
支持。目前提供的 DMG 是 Apple Silicon（M1/M2/M3/M4）版本。如需 Intel 版，从源码构建时运行 <code>npm run prepare-bundle:x64</code> 即可。
</details>

<details>
<summary><b>可以同时用多个 AI 模型吗？</b></summary>
<br>
目前一次配置一个模型，但可以在设置里随时切换，切换后立即生效，不需要重启。
</details>

<details>
<summary><b>安装包为什么有 230 MB 这么大？</b></summary>
<br>
因为把所有依赖都打包进去了（Node.js 运行时 + OpenClaw 引擎 + 全部插件），这样你就不需要在电脑上安装任何其他东西。"大"换来的是"简单"。
</details>

---

## 📖 安装使用指南 | Documentation

我们写了一份非常详细的图文教程，从创建飞书机器人到开始使用，每一步都有说明：

👉 [**安装使用指南**](docs/安装使用指南.md)

内容包括：飞书机器人创建（7 步图文）、权限配置、AI 模型注册开通、常见问题排查。

---

<details>
<summary><h2>🔧 给开发者 | For Developers</h2></summary>

### 从源码构建

```bash
git clone https://github.com/lhfer/openclaw-feishu-edition.git
cd openclaw-feishu-edition

npm install           # 安装依赖
npm run dev           # 开发模式
npm run dist:mac      # 构建 DMG（含 Node.js + 引擎打包）
npm run dist:mac:nobundle  # 仅构建，不打包引擎
```

**构建要求：** Node.js 18+, macOS 12+

### 技术栈

**Electron 28** · **React 18** · **TypeScript 5** · **Tailwind CSS** · **Vite 5** · **OpenClaw Engine** · **Feishu Open Platform SDK**

### 项目结构

```
openclaw-feishu-edition/
├── core/                  # 核心逻辑（配置管理、飞书验证、模型验证）
├── electron/              # Electron 主进程（引擎管理、IPC、托盘）
├── renderer/              # React 前端（配置向导、设置页面）
├── scripts/               # 构建脚本（Node.js + 引擎打包）
├── locales/               # 中文本地化
└── docs/                  # 用户文档
```

</details>

---

## 🤝 Contributing

欢迎 PR 和 Issue！无论是 bug 反馈、功能建议还是文档改进，都非常欢迎。

如果这个项目帮到了你，请给一个 ⭐ **Star** —— 让更多不想折腾命令行的人也能发现它。

PRs and issues welcome! If this project helps you, a ⭐ **Star** helps others discover it too.

---

## 📄 License

[MIT](LICENSE)

---

<p align="center">
  <sub>
    <b>Keywords:</b> 飞书机器人 · Feishu Bot · Lark Bot · 飞书AI助手 · Feishu AI Assistant · Lark AI Chatbot · OpenClaw · 飞书自建应用 · Feishu Custom App · Lark Custom App · AI Desktop App · 国产大模型 · Chinese LLM · MiniMax · 智谱GLM · 豆包Doubao · Kimi Moonshot · macOS · Electron · 零依赖 · Zero Dependency · 零命令行 · No Command Line · 飞书开放平台 · Feishu Open Platform · Lark Open Platform
  </sub>
</p>
