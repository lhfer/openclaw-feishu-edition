import { app, BrowserWindow, ipcMain, nativeTheme, Menu } from 'electron';
import * as path from 'path';
import { GatewayManager } from './gateway-manager';
import { TrayManager } from './tray';
import { registerIpcHandlers } from './ipc-handlers';
import { ConfigManager } from '../core/config-manager';

// 单实例锁
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;
let trayManager: TrayManager | null = null;
let gatewayManager: GatewayManager | null = null;
let configManager: ConfigManager | null = null;
let isQuitting = false;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 860,
    height: 640,
    minWidth: 720,
    minHeight: 540,
    titleBarStyle: 'hiddenInset',
    vibrancy: 'under-window',
    visualEffectState: 'active',
    transparent: true,
    backgroundColor: '#00000000',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
  });

  // 窗口就绪后优雅显示
  win.once('ready-to-show', () => {
    win.show();
  });

  // 关闭窗口时隐藏而不退出（菜单栏常驻）
  win.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      win.hide();
    }
  });

  // 加载页面
  if (isDev) {
    win.loadURL('http://localhost:5173');
    // win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '../../renderer/index.html'));
  }

  return win;
}

app.whenReady().then(async () => {
  // 初始化配置管理器
  configManager = new ConfigManager();

  // 初始化 Gateway 管理器
  gatewayManager = new GatewayManager(configManager);

  // 注册 IPC 处理器
  registerIpcHandlers(configManager, gatewayManager);

  // 创建主窗口
  mainWindow = createWindow();

  // 创建系统托盘
  trayManager = new TrayManager(mainWindow, gatewayManager);

  // 如果已配置完成，自动启动 Gateway
  if (configManager.isConfigured()) {
    try {
      await gatewayManager.start();
    } catch (err) {
      console.error('Gateway 启动失败:', err);
    }
  }

  // macOS dock 行为
  app.on('activate', () => {
    if (mainWindow) {
      mainWindow.show();
    }
  });
});

// 退出前清理
app.on('before-quit', async () => {
  isQuitting = true;
  if (gatewayManager) {
    await gatewayManager.stop();
  }
});

app.on('window-all-closed', () => {
  // macOS 上不退出，保持菜单栏常驻
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
