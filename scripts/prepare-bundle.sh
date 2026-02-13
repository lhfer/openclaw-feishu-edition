#!/bin/bash
#
# OpenClaw 飞书专版 — 预打包脚本
#
# 作用：下载 Node.js 二进制 + 安装 OpenClaw 引擎到 bundled/ 目录，
#       使 DMG 安装后用户零依赖即可运行。
#
# 用法：
#   ./scripts/prepare-bundle.sh              # 默认 arm64
#   ./scripts/prepare-bundle.sh x64          # Intel Mac
#   ./scripts/prepare-bundle.sh universal    # 同时打包 arm64 + x64
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BUNDLE_DIR="$PROJECT_DIR/bundled"

# Node.js 版本（LTS）
NODE_VERSION="22.13.1"
# 目标架构
ARCH="${1:-arm64}"

echo "============================================"
echo " OpenClaw 飞书专版 — 预打包脚本"
echo " Node.js: v${NODE_VERSION}"
echo " 架构:    ${ARCH}"
echo "============================================"
echo ""

# ====== 清理旧的 bundled 目录 ======
if [ -d "$BUNDLE_DIR" ]; then
  echo "🗑  清理旧的 bundled 目录..."
  rm -rf "$BUNDLE_DIR"
fi
mkdir -p "$BUNDLE_DIR"

# ====== 下载 Node.js 二进制 ======
download_node() {
  local arch=$1
  local node_arch

  case "$arch" in
    arm64) node_arch="arm64" ;;
    x64|x86_64) node_arch="x64" ;;
    *) echo "❌ 不支持的架构: $arch"; exit 1 ;;
  esac

  local tarball="node-v${NODE_VERSION}-darwin-${node_arch}.tar.gz"
  local url="https://nodejs.org/dist/v${NODE_VERSION}/${tarball}"
  local tmp_dir="$BUNDLE_DIR/tmp"

  mkdir -p "$tmp_dir"

  echo "📦 下载 Node.js v${NODE_VERSION} (${node_arch})..."
  echo "   URL: ${url}"

  if command -v curl &>/dev/null; then
    curl -L --progress-bar -o "$tmp_dir/$tarball" "$url"
  elif command -v wget &>/dev/null; then
    wget -q --show-progress -O "$tmp_dir/$tarball" "$url"
  else
    echo "❌ 需要 curl 或 wget"
    exit 1
  fi

  echo "📂 解压 Node.js..."
  tar -xzf "$tmp_dir/$tarball" -C "$tmp_dir"

  local extracted_dir="$tmp_dir/node-v${NODE_VERSION}-darwin-${node_arch}"

  # 只需要 node 二进制 + npm（用于安装 openclaw）
  mkdir -p "$BUNDLE_DIR/node/bin"
  mkdir -p "$BUNDLE_DIR/node/lib"

  cp "$extracted_dir/bin/node" "$BUNDLE_DIR/node/bin/node"
  chmod +x "$BUNDLE_DIR/node/bin/node"

  # 复制 npm（安装时需要，也用于后续更新）
  if [ -d "$extracted_dir/lib/node_modules/npm" ]; then
    cp -R "$extracted_dir/lib/node_modules" "$BUNDLE_DIR/node/lib/"
    # 创建 npm 符号链接
    ln -sf "../lib/node_modules/npm/bin/npm-cli.js" "$BUNDLE_DIR/node/bin/npm"
    ln -sf "../lib/node_modules/npm/bin/npx-cli.js" "$BUNDLE_DIR/node/bin/npx"
    chmod +x "$BUNDLE_DIR/node/bin/npm" "$BUNDLE_DIR/node/bin/npx"
  fi

  echo "✅ Node.js v${NODE_VERSION} (${node_arch}) 已准备"
  echo "   二进制: $BUNDLE_DIR/node/bin/node"
  echo "   大小: $(du -sh "$BUNDLE_DIR/node/bin/node" | cut -f1)"

  # 清理临时文件
  rm -rf "$tmp_dir"
}

# ====== 安装 OpenClaw 引擎 ======
install_openclaw() {
  echo ""
  echo "📦 安装 OpenClaw 引擎..."

  local node_bin="$BUNDLE_DIR/node/bin/node"
  local npm_bin="$BUNDLE_DIR/node/bin/npm"

  # 验证 node 可用
  local node_ver
  node_ver=$("$node_bin" --version)
  echo "   Node.js 版本: $node_ver"

  # 创建引擎安装目录
  mkdir -p "$BUNDLE_DIR/engine"

  # 初始化 package.json
  cat > "$BUNDLE_DIR/engine/package.json" <<'PKGJSON'
{
  "name": "openclaw-bundled-engine",
  "version": "1.0.0",
  "private": true,
  "description": "Bundled OpenClaw engine for 飞书专版"
}
PKGJSON

  # 使用淘宝镜像加速安装
  # --ignore-scripts: 跳过 node-llama-cpp 等原生 C++ 模块的编译
  #   飞书专版只使用云端 API（MiniMax/GLM/豆包/Kimi），不需要本地模型推理
  # --no-optional: 跳过可选依赖
  echo "   正在从 npm 安装 openclaw（使用国内镜像）..."
  echo "   （跳过原生模块编译 — 飞书专版仅使用云端 API）"
  "$node_bin" "$npm_bin" install openclaw \
    --prefix "$BUNDLE_DIR/engine" \
    --registry "https://registry.npmmirror.com" \
    --no-fund \
    --no-audit \
    --no-optional \
    --ignore-scripts \
    2>&1 | tail -10

  # 验证安装
  local openclaw_bin="$BUNDLE_DIR/engine/node_modules/.bin/openclaw"
  if [ -f "$openclaw_bin" ] || [ -L "$openclaw_bin" ]; then
    echo "✅ OpenClaw 引擎已安装"
    echo "   路径: $openclaw_bin"

    # 获取版本
    local oc_ver
    oc_ver=$("$node_bin" "$openclaw_bin" --version 2>/dev/null || echo "未知")
    echo "   版本: $oc_ver"
  else
    echo "❌ OpenClaw 安装失败 — 未找到可执行文件"
    echo "   请检查网络连接或 npm 镜像是否可用"
    ls -la "$BUNDLE_DIR/engine/node_modules/.bin/" 2>/dev/null || echo "   .bin 目录不存在"
    exit 1
  fi
}

# ====== 计算最终大小 ======
print_summary() {
  echo ""
  echo "============================================"
  echo " 打包完成"
  echo "============================================"
  echo ""
  echo "📁 bundled/ 目录结构:"
  echo "   bundled/"
  echo "   ├── node/           — Node.js v${NODE_VERSION} 运行时"
  echo "   │   ├── bin/node"
  echo "   │   ├── bin/npm"
  echo "   │   └── lib/node_modules/npm/"
  echo "   └── engine/         — OpenClaw 引擎 + 所有依赖"
  echo "       └── node_modules/"
  echo "           └── .bin/openclaw"
  echo ""
  echo "📊 大小统计:"
  echo "   Node.js 二进制:  $(du -sh "$BUNDLE_DIR/node/bin/node" 2>/dev/null | cut -f1)"
  echo "   Node.js 完整:    $(du -sh "$BUNDLE_DIR/node" 2>/dev/null | cut -f1)"
  echo "   OpenClaw 引擎:   $(du -sh "$BUNDLE_DIR/engine" 2>/dev/null | cut -f1)"
  echo "   总计:            $(du -sh "$BUNDLE_DIR" 2>/dev/null | cut -f1)"
  echo ""
  echo "💡 下一步: 运行 npm run dist:mac 构建 DMG"
  echo ""
}

# ====== 主流程 ======
download_node "$ARCH"
install_openclaw
print_summary
