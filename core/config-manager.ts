import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';

export interface FeishuConfig {
  enabled: boolean;
  appId: string;
  appSecret: string;
  verificationToken: string;
  encryptKey: string;
  botName: string;
  connectionMode: string;
  dmPolicy: string;
  groupPolicy: string;
  requireMention: boolean;
  renderMode: string;
}

export interface ModelProviderConfig {
  baseUrl: string;
  apiKey: string;
  api: string;
  models: Array<{
    id: string;
    name: string;
    reasoning?: boolean;
  }>;
}

export interface AppConfig {
  feishu: FeishuConfig;
  model: {
    primary: string;
    provider: string;
    fallbacks: string[];
  };
  providers: Record<string, ModelProviderConfig>;
  gateway: {
    port: number;
    bind: string;
  };
  advanced: {
    sessionTimeout: number;
    queueMode: string;
    toolProfile: string;
    memoryEnabled: boolean;
    sandboxEnabled: boolean;
    browserEnabled: boolean;
    streamingEnabled: boolean;
    logLevel: string;
    maxConcurrent: number;
  };
  setupCompleted: boolean;
}

const DEFAULT_CONFIG: AppConfig = {
  feishu: {
    enabled: true,
    appId: '',
    appSecret: '',
    verificationToken: '',
    encryptKey: '',
    botName: '我的AI助手',
    connectionMode: 'websocket',
    dmPolicy: 'open',
    groupPolicy: 'open',
    requireMention: true,
    renderMode: 'card',
  },
  model: {
    primary: '',
    provider: '',
    fallbacks: [],
  },
  providers: {
    minimax: {
      // 中国用户使用 api.minimaxi.com（注意多了个 i），国际版是 api.minimax.io
      // /anthropic 端点 → anthropic-messages 格式（官方推荐）
      // /v1 端点 → openai-completions 格式
      baseUrl: 'https://api.minimaxi.com/anthropic',
      apiKey: '',
      api: 'anthropic-messages',
      models: [
        { id: 'MiniMax-M2.5', name: 'MiniMax M2.5', reasoning: true },
        { id: 'MiniMax-M2.1', name: 'MiniMax M2.1', reasoning: true },
        { id: 'MiniMax-Text-01', name: 'MiniMax Text 01' },
      ],
    },
    zai: {
      // GLM 在 OpenClaw 中使用 zai 作为 provider ID
      baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
      apiKey: '',
      api: 'openai-completions',
      models: [
        { id: 'glm-4.7-flash', name: 'GLM 4.7 Flash', reasoning: true },
        { id: 'glm-4-plus', name: 'GLM 4 Plus' },
      ],
    },
    doubao: {
      baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
      apiKey: '',
      api: 'openai-completions',
      models: [
        { id: 'doubao-1.5-pro-256k', name: '豆包 1.5 Pro', reasoning: true },
        { id: 'doubao-1.5-lite-32k', name: '豆包 1.5 Lite' },
      ],
    },
    moonshot: {
      // Moonshot（月之暗面 / Kimi）
      baseUrl: 'https://api.moonshot.cn/v1',
      apiKey: '',
      api: 'openai-completions',
      models: [
        { id: 'moonshot-v1-128k', name: 'Kimi 128K', reasoning: true },
        { id: 'moonshot-v1-32k', name: 'Kimi 32K' },
        { id: 'moonshot-v1-8k', name: 'Kimi 8K' },
      ],
    },
  },
  gateway: {
    port: 18789,
    bind: '127.0.0.1',
  },
  advanced: {
    sessionTimeout: 1800,
    queueMode: 'sequential',
    toolProfile: 'messaging',
    memoryEnabled: true,
    sandboxEnabled: false,
    browserEnabled: false,
    streamingEnabled: true,
    logLevel: 'info',
    maxConcurrent: 4,
  },
  setupCompleted: false,
};

export class ConfigManager {
  private configDir: string;
  private configPath: string;
  private config: AppConfig;

  constructor() {
    this.configDir = path.join(os.homedir(), '.openclaw');
    this.configPath = path.join(this.configDir, 'feishu-edition.json');
    this.config = this.loadConfig();
    // 启动时始终确保 openclaw.json 存在
    this.ensureNativeConfig();
  }

  getConfigDir(): string {
    return this.configDir;
  }

  getConfig(): AppConfig {
    return { ...this.config };
  }

  saveConfig(partial: Partial<AppConfig>): void {
    this.config = { ...this.config, ...partial };
    this.ensureDir();
    fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8');

    // 同步生成 openclaw.json（Gateway 用的原生配置）
    this.generateOpenClawConfig();
  }

  isConfigured(): boolean {
    return this.config.setupCompleted && !!this.config.feishu.appId;
  }

  /**
   * 确保 openclaw.json 原生配置文件存在（Gateway 启动前调用）
   */
  ensureNativeConfig(): void {
    this.ensureDir();
    // 每次都重新生成，确保配置始终与飞书专版设置同步
    console.log('[Config] 重新生成 openclaw.json');
    this.generateOpenClawConfig();
  }

  resetConfig(): void {
    this.config = { ...DEFAULT_CONFIG };
    this.saveConfig(this.config);
  }

  /**
   * 根据飞书专版配置生成 OpenClaw 原生 openclaw.json
   * 包含完整的最佳实践配置，让小白用户开箱即用
   */
  private generateOpenClawConfig(): void {
    const oc = this.config;

    // ====== 1. 构建 providers 配置 ======
    const providers: Record<string, any> = {};
    for (const [key, provider] of Object.entries(oc.providers)) {
      if (provider.apiKey) {
        // 关键：自动检测 API 格式，防止 baseUrl 和 api 格式不匹配导致 404
        // 如果 baseUrl 以 /anthropic 结尾，必须用 anthropic-messages 格式
        // 如果 baseUrl 以 /v1 结尾，必须用 openai-completions 格式
        let correctedApi = provider.api;
        const url = provider.baseUrl.replace(/\/+$/, ''); // 去掉尾部斜杠
        if (url.endsWith('/anthropic') && correctedApi !== 'anthropic-messages') {
          console.log(`[Config] ⚠️ ${key}: baseUrl 是 /anthropic 端点，自动修正 api 为 anthropic-messages（原值: ${correctedApi}）`);
          correctedApi = 'anthropic-messages';
        } else if (url.endsWith('/v1') && correctedApi === 'anthropic-messages') {
          console.log(`[Config] ⚠️ ${key}: baseUrl 是 /v1 端点，自动修正 api 为 openai-completions（原值: ${correctedApi}）`);
          correctedApi = 'openai-completions';
        }

        providers[key] = {
          baseUrl: provider.baseUrl,
          apiKey: provider.apiKey,
          api: correctedApi,
          models: provider.models,
        };
      }
    }

    // ====== 2. 自动计算 model fallbacks ======
    // 从所有已配置 API Key 的 provider 中提取首选模型作为 fallback
    const autoFallbacks: string[] = [];
    if (oc.model.fallbacks.length > 0) {
      // 用户手动指定了 fallbacks，优先使用
      autoFallbacks.push(...oc.model.fallbacks);
    } else {
      // 自动从其他已配置的 provider 中选择 fallback
      for (const [key, provider] of Object.entries(oc.providers)) {
        if (provider.apiKey && provider.models.length > 0) {
          const modelId = `${key}/${provider.models[0].id}`;
          // 不把 primary 模型加入 fallbacks
          if (modelId !== oc.model.primary) {
            autoFallbacks.push(modelId);
          }
        }
      }
    }

    // ====== 3. 自动检测时区 ======
    let userTimezone = 'Asia/Shanghai'; // 默认中国用户
    try {
      // Node.js 环境获取系统时区
      userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai';
    } catch { /* 使用默认值 */ }

    // ====== 4. 构建 env 环境变量块 ======
    // 将各 provider 的 API Key 写入环境变量（部分 provider 需要环境变量方式认证）
    const envVars: Record<string, string> = {};
    if (oc.providers.minimax?.apiKey) {
      envVars['MINIMAX_API_KEY'] = oc.providers.minimax.apiKey;
    }
    if (oc.providers.zai?.apiKey) {
      envVars['ZAI_API_KEY'] = oc.providers.zai.apiKey;
    }
    if (oc.providers.doubao?.apiKey) {
      envVars['DOUBAO_API_KEY'] = oc.providers.doubao.apiKey;
    }
    if (oc.providers.moonshot?.apiKey) {
      envVars['MOONSHOT_API_KEY'] = oc.providers.moonshot.apiKey;
    }
    // 自定义 provider 的 key 也放入环境变量
    if (oc.providers.custom?.apiKey) {
      envVars['CUSTOM_API_KEY'] = oc.providers.custom.apiKey;
    }

    // ====== 5. 生成完整的 openclaw.json ======
    const openclawConfig: any = {
      // --- Gateway ---
      gateway: {
        mode: 'local',
        port: oc.gateway.port,
        bind: oc.gateway.bind === '127.0.0.1' ? 'loopback' : oc.gateway.bind,
        auth: { token: this.getOrCreateToken() },
        controlUi: { enabled: true },
      },

      // --- 飞书 Channel ---
      channels: {
        feishu: {
          enabled: oc.feishu.enabled,
          dmPolicy: oc.feishu.dmPolicy,
          groupPolicy: oc.feishu.groupPolicy,
          // 会话隔离 — 每个私聊对象独立会话，防止上下文泄露
          dmScope: 'per-peer',
          // 流式回复配置 — 飞书消息卡片支持逐步更新
          streaming: oc.advanced.streamingEnabled,
          // 等 streaming chunk 积累后再更新飞书卡片，减少 API 调用
          blockStreaming: true,
          // 每个消息块的最大字符数（飞书卡片单段限制）
          textChunkLimit: 2000,
          // 飞书允许的附件大小上限 (MB)
          mediaMaxMb: 30,
          accounts: {
            main: {
              domain: 'feishu',
              appId: oc.feishu.appId,
              appSecret: oc.feishu.appSecret,
              ...(oc.feishu.verificationToken ? { verificationToken: oc.feishu.verificationToken } : {}),
              ...(oc.feishu.encryptKey ? { encryptKey: oc.feishu.encryptKey } : {}),
              botName: oc.feishu.botName,
            },
          },
        },
      },

      // --- Agent 默认配置 ---
      agents: {
        defaults: {
          model: {
            primary: oc.model.primary || undefined,
            fallbacks: autoFallbacks.length > 0 ? autoFallbacks : undefined,
          },
          workspace: path.join(this.configDir, 'workspace'),
          // 用户时区 — 让 AI 回复中的时间信息正确
          userTimezone,
          // 上下文压缩策略 — 长对话时自动压缩早期消息，避免超出 token 限制
          compaction: { mode: 'safeguard' },
          // 上下文裁剪 — 自动清理过期上下文，避免 token 超限
          contextPruning: {
            mode: 'cache-ttl',
            ttl: '6h',
            keepLastAssistants: 3,
          },
          // 最大并发会话数 — 防止资源耗尽
          maxConcurrent: oc.advanced.maxConcurrent || 4,
          // 记忆搜索 — 启用后 AI 可以检索历史对话
          ...(oc.advanced.memoryEnabled ? { memorySearch: { enabled: true } } : {}),
        },
      },

      // --- 会话管理 ---
      // 注意：session.scope 不是有效字段，会话隔离通过 channels.feishu.dmScope 配置
      // reset 配置放在 agents.defaults 级别或 channel 级别

      // --- 模型 Providers ---
      models: {
        providers: Object.keys(providers).length > 0 ? providers : undefined,
      },

      // --- 工具配置 ---
      tools: {
        profile: oc.advanced.toolProfile,
      },

      // --- 环境变量 ---
      ...(Object.keys(envVars).length > 0 ? { env: envVars } : {}),

      // --- 日志 ---
      logging: { level: oc.advanced.logLevel },
    };

    const openclawConfigPath = path.join(this.configDir, 'openclaw.json');
    fs.writeFileSync(openclawConfigPath, JSON.stringify(openclawConfig, null, 2), 'utf-8');

    // 同时生成 .env 文件（部分工具/插件通过环境变量读取 API Key）
    this.generateEnvFile(envVars);
  }

  /**
   * 生成 ~/.openclaw/.env 文件
   * 某些 OpenClaw 插件和第三方工具通过环境变量获取 API Key
   */
  private generateEnvFile(envVars: Record<string, string>): void {
    if (Object.keys(envVars).length === 0) return;

    const lines = [
      '# OpenClaw 飞书专版自动生成的环境变量',
      '# 由安装程序管理，请勿手动编辑（会被覆盖）',
      `# 生成时间: ${new Date().toISOString()}`,
      '',
    ];

    for (const [key, value] of Object.entries(envVars)) {
      lines.push(`${key}=${value}`);
    }

    const envPath = path.join(this.configDir, '.env');
    fs.writeFileSync(envPath, lines.join('\n') + '\n', { mode: 0o600 });
  }

  /**
   * 公开获取 token（供 gateway-manager 通过环境变量传递）
   */
  getGatewayToken(): string {
    return this.getOrCreateToken();
  }

  /**
   * 获取或自动生成 Gateway auth token（持久化到文件，避免每次变化）
   */
  private getOrCreateToken(): string {
    const tokenPath = path.join(this.configDir, 'credentials', 'gateway-token');
    try {
      if (fs.existsSync(tokenPath)) {
        const token = fs.readFileSync(tokenPath, 'utf-8').trim();
        if (token.length >= 16) return token;
      }
    } catch { /* 读取失败则重新生成 */ }

    // 生成新 token
    const token = crypto.randomBytes(32).toString('hex');
    this.ensureDir();
    fs.writeFileSync(tokenPath, token, { mode: 0o600 });
    console.log('[Config] 已生成 Gateway auth token');
    return token;
  }

  private loadConfig(): AppConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        const raw = fs.readFileSync(this.configPath, 'utf-8');
        const loaded = JSON.parse(raw);
        return { ...DEFAULT_CONFIG, ...loaded };
      }
    } catch (err) {
      console.error('加载配置失败:', err);
    }
    return { ...DEFAULT_CONFIG };
  }

  private ensureDir(): void {
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true, mode: 0o700 });
    }
    // 创建子目录（包括 OpenClaw 需要的 session store）
    const dirs = ['workspace', 'credentials', 'workspace/memory', 'workspace/skills', 'agents/main/sessions'];
    for (const dir of dirs) {
      const fullPath = path.join(this.configDir, dir);
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
      }
    }
  }
}
