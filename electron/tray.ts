import { Tray, Menu, nativeImage, BrowserWindow, app } from 'electron';
import * as path from 'path';
import { GatewayManager, GatewayStatus } from './gateway-manager';

export class TrayManager {
  private tray: Tray | null = null;
  private mainWindow: BrowserWindow;
  private gatewayManager: GatewayManager;

  constructor(mainWindow: BrowserWindow, gatewayManager: GatewayManager) {
    this.mainWindow = mainWindow;
    this.gatewayManager = gatewayManager;
    this.createTray();

    // 监听状态变化，更新托盘图标
    this.gatewayManager.onStatusChange((state) => {
      this.updateTrayIcon(state.status);
      this.updateContextMenu(state.status, state.feishuConnected);
    });
  }

  private createTray(): void {
    // 使用简单的模板图标（macOS 菜单栏）
    const iconPath = app.isPackaged
      ? path.join(process.resourcesPath, 'assets', 'tray-icon.png')
      : path.join(__dirname, '../../assets/tray-icon.png');

    // 创建一个16x16的简单图标（实际项目应使用真实图标文件）
    const icon = nativeImage.createEmpty();
    this.tray = new Tray(icon);
    this.tray.setToolTip('OpenClaw 飞书专版');

    // 点击显示主窗口
    this.tray.on('click', () => {
      if (this.mainWindow.isVisible()) {
        this.mainWindow.focus();
      } else {
        this.mainWindow.show();
      }
    });

    this.updateContextMenu('stopped', false);
    this.updateTrayIcon('stopped');
  }

  private updateTrayIcon(status: GatewayStatus): void {
    if (!this.tray) return;

    // 用标题表示状态（macOS 菜单栏支持）
    const statusEmoji: Record<GatewayStatus, string> = {
      stopped: '⚪',
      starting: '🟡',
      running: '🟢',
      error: '🔴',
    };
    this.tray.setTitle(statusEmoji[status] || '⚪');
  }

  private updateContextMenu(status: GatewayStatus, feishuConnected: boolean): void {
    if (!this.tray) return;

    const statusText: Record<GatewayStatus, string> = {
      stopped: '已停止',
      starting: '正在启动...',
      running: '运行中',
      error: '异常',
    };

    const menu = Menu.buildFromTemplate([
      {
        label: `AI 助手 ${statusText[status]}`,
        enabled: false,
      },
      {
        label: feishuConnected ? '📱 飞书已连接' : '📱 飞书未连接',
        enabled: false,
      },
      { type: 'separator' },
      {
        label: '💬 打开对话',
        click: () => {
          this.mainWindow.show();
          this.mainWindow.webContents.send('navigate', '/chat');
        },
      },
      {
        label: '⚙️ 设置',
        click: () => {
          this.mainWindow.show();
          this.mainWindow.webContents.send('navigate', '/settings');
        },
      },
      { type: 'separator' },
      {
        label: status === 'running' ? '🔄 重启服务' : '▶️ 启动服务',
        click: async () => {
          if (status === 'running') {
            await this.gatewayManager.restart();
          } else {
            await this.gatewayManager.start();
          }
        },
      },
      {
        label: '⏹ 停止服务',
        enabled: status === 'running' || status === 'starting',
        click: async () => {
          await this.gatewayManager.stop();
        },
      },
      { type: 'separator' },
      {
        label: '🔧 重新配置',
        click: () => {
          this.mainWindow.show();
          this.mainWindow.webContents.send('navigate', '/wizard');
        },
      },
      { type: 'separator' },
      {
        label: '退出 OpenClaw 飞书专版',
        click: () => {
          app.quit();
        },
      },
    ]);

    this.tray.setContextMenu(menu);
  }

  destroy(): void {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }
}
