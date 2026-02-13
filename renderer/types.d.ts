/**
 * 全局类型声明
 */

interface EngineDetectResult {
  installed: boolean;
  version?: string;
  path?: string;
}

interface InstallProgress {
  phase: 'checking' | 'downloading' | 'installing' | 'done' | 'error';
  message: string;
  percent?: number;
}

interface GatewayState {
  status: 'stopped' | 'starting' | 'running' | 'error';
  pid?: number;
  uptime?: number;
  error?: string;
  feishuConnected: boolean;
  modelConfigured: boolean;
  engineStatus: 'not_installed' | 'installing' | 'installed' | 'install_error';
  engineVersion?: string;
  enginePath?: string;
}

interface OpenClawAPI {
  // 配置管理
  getConfig: () => Promise<import('../core/config-manager').AppConfig>;
  saveConfig: (config: Partial<import('../core/config-manager').AppConfig>) => Promise<{ success: boolean }>;
  isConfigured: () => Promise<boolean>;
  resetConfig: () => Promise<{ success: boolean }>;

  // 引擎管理
  detectEngine: () => Promise<EngineDetectResult>;
  installEngine: () => Promise<{ success: boolean; error?: string }>;
  onInstallProgress: (callback: (progress: InstallProgress) => void) => () => void;

  // 飞书校验
  validateFeishu: (appId: string, appSecret: string) => Promise<any[]>;
  onFeishuValidateProgress: (callback: (step: any) => void) => () => void;

  // 模型校验
  validateModel: (provider: string, apiKey: string, modelId: string) => Promise<any>;

  // Gateway 管理
  startGateway: () => Promise<{ success: boolean; error?: string }>;
  stopGateway: () => Promise<{ success: boolean }>;
  restartGateway: () => Promise<{ success: boolean; error?: string }>;
  getGatewayStatus: () => Promise<GatewayState>;
  onGatewayStatusChange: (callback: (status: GatewayState) => void) => () => void;

  // 应用控制
  getAppVersion: () => Promise<string>;
  openExternal: (url: string) => Promise<void>;
  getTheme: () => Promise<boolean>;
  onThemeChange: (callback: (isDark: boolean) => void) => () => void;
  showWindow: () => Promise<void>;
  quitApp: () => Promise<void>;
}

declare global {
  interface Window {
    openclawAPI: OpenClawAPI;
  }
}

export {};
