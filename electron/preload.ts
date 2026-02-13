import { contextBridge, ipcRenderer } from 'electron';

/**
 * 预加载脚本：安全地暴露 API 给渲染进程
 */
contextBridge.exposeInMainWorld('openclawAPI', {
  // ===== 配置管理 =====
  getConfig: () => ipcRenderer.invoke('config:get'),
  saveConfig: (config: any) => ipcRenderer.invoke('config:save', config),
  isConfigured: () => ipcRenderer.invoke('config:isConfigured'),
  resetConfig: () => ipcRenderer.invoke('config:reset'),

  // ===== 引擎管理 =====
  detectEngine: () => ipcRenderer.invoke('engine:detect'),
  installEngine: () => ipcRenderer.invoke('engine:install'),
  onInstallProgress: (callback: (progress: any) => void) => {
    const handler = (_event: any, progress: any) => callback(progress);
    ipcRenderer.on('engine:install:progress', handler);
    return () => ipcRenderer.removeListener('engine:install:progress', handler);
  },

  // ===== 飞书校验 =====
  validateFeishu: (appId: string, appSecret: string) =>
    ipcRenderer.invoke('feishu:validate', appId, appSecret),
  onFeishuValidateProgress: (callback: (step: any) => void) => {
    const handler = (_event: any, step: any) => callback(step);
    ipcRenderer.on('feishu:validate:progress', handler);
    return () => ipcRenderer.removeListener('feishu:validate:progress', handler);
  },

  // ===== 模型校验 =====
  validateModel: (provider: string, apiKey: string, modelId: string) =>
    ipcRenderer.invoke('model:validate', provider, apiKey, modelId),

  // ===== Gateway 管理 =====
  startGateway: () => ipcRenderer.invoke('gateway:start'),
  stopGateway: () => ipcRenderer.invoke('gateway:stop'),
  restartGateway: () => ipcRenderer.invoke('gateway:restart'),
  getGatewayStatus: () => ipcRenderer.invoke('gateway:status'),
  getGatewayLogs: (count?: number) => ipcRenderer.invoke('gateway:getLogs', count),
  onGatewayStatusChange: (callback: (status: any) => void) => {
    const handler = (_event: any, status: any) => callback(status);
    ipcRenderer.on('gateway:status-change', handler);
    return () => ipcRenderer.removeListener('gateway:status-change', handler);
  },

  // ===== 插件管理 =====
  listPlugins: () => ipcRenderer.invoke('plugins:list'),
  togglePlugin: (pluginId: string, enable: boolean) =>
    ipcRenderer.invoke('plugins:toggle', pluginId, enable),

  // ===== 应用控制 =====
  getAppVersion: () => ipcRenderer.invoke('app:version'),
  openExternal: (url: string) => ipcRenderer.invoke('app:openExternal', url),
  getTheme: () => ipcRenderer.invoke('app:theme'),
  onThemeChange: (callback: (isDark: boolean) => void) => {
    const handler = (_event: any, isDark: boolean) => callback(isDark);
    ipcRenderer.on('app:theme-change', handler);
    return () => ipcRenderer.removeListener('app:theme-change', handler);
  },
  showWindow: () => ipcRenderer.invoke('app:showWindow'),
  quitApp: () => ipcRenderer.invoke('app:quit'),
});
