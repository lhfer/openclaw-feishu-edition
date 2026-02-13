import { ipcMain, shell, app, nativeTheme, BrowserWindow } from 'electron';
import { ConfigManager } from '../core/config-manager';
import { GatewayManager } from './gateway-manager';
import { FeishuValidator } from '../core/feishu-validator';
import { ModelValidator } from '../core/model-validator';

export function registerIpcHandlers(
  configManager: ConfigManager,
  gatewayManager: GatewayManager
): void {
  // ===== 配置管理 =====
  ipcMain.handle('config:get', () => {
    return configManager.getConfig();
  });

  ipcMain.handle('config:save', (_event, config: any) => {
    configManager.saveConfig(config);
    return { success: true };
  });

  ipcMain.handle('config:isConfigured', () => {
    return configManager.isConfigured();
  });

  ipcMain.handle('config:reset', () => {
    configManager.resetConfig();
    return { success: true };
  });

  // ===== 引擎管理 =====
  ipcMain.handle('engine:detect', () => {
    const result = gatewayManager.detectEngine();
    console.log('[IPC] engine:detect →', JSON.stringify(result));
    return result;
  });

  ipcMain.handle('engine:install', async (event) => {
    // 注册安装进度监听 → 转发到渲染进程
    const cleanup = gatewayManager.onInstallProgress((progress) => {
      event.sender.send('engine:install:progress', progress);
    });

    try {
      const result = await gatewayManager.installEngine();
      return result;
    } finally {
      cleanup();
    }
  });

  // ===== 飞书校验 =====
  ipcMain.handle('feishu:validate', async (event, appId: string, appSecret: string) => {
    const validator = new FeishuValidator();
    const results: any[] = [];

    for await (const step of validator.validate(appId, appSecret)) {
      results.push(step);
      // 向渲染进程发送实时进度
      event.sender.send('feishu:validate:progress', step);
    }

    return results;
  });

  // ===== 模型校验 =====
  ipcMain.handle(
    'model:validate',
    async (_event, provider: string, apiKey: string, modelId: string) => {
      const validator = new ModelValidator();
      return await validator.validate(provider, apiKey, modelId);
    }
  );

  // ===== Gateway 管理 =====
  ipcMain.handle('gateway:start', async () => {
    try {
      await gatewayManager.start();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('gateway:stop', async () => {
    await gatewayManager.stop();
    return { success: true };
  });

  ipcMain.handle('gateway:restart', async () => {
    try {
      await gatewayManager.restart();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('gateway:status', () => {
    const state = gatewayManager.getState();
    console.log('[IPC] gateway:status →', JSON.stringify(state));
    return state;
  });

  ipcMain.handle('gateway:getLogs', (_event, count?: number) => {
    return gatewayManager.getRecentLogs(count || 50);
  });

  // 转发 Gateway 状态变化到渲染进程
  gatewayManager.onStatusChange((state) => {
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      win.webContents.send('gateway:status-change', state);
    }
  });

  // ===== 插件管理 =====
  ipcMain.handle('plugins:list', () => {
    return gatewayManager.listPlugins();
  });

  ipcMain.handle('plugins:toggle', (_event, pluginId: string, enable: boolean) => {
    return gatewayManager.togglePlugin(pluginId, enable);
  });

  // ===== 应用控制 =====
  ipcMain.handle('app:version', () => {
    return app.getVersion();
  });

  ipcMain.handle('app:openExternal', (_event, url: string) => {
    shell.openExternal(url);
  });

  ipcMain.handle('app:theme', () => {
    return nativeTheme.shouldUseDarkColors;
  });

  // 监听主题变化
  nativeTheme.on('updated', () => {
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      win.webContents.send('app:theme-change', nativeTheme.shouldUseDarkColors);
    }
  });

  ipcMain.handle('app:showWindow', () => {
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
      windows[0].show();
      windows[0].focus();
    }
  });

  ipcMain.handle('app:quit', () => {
    app.quit();
  });
}
