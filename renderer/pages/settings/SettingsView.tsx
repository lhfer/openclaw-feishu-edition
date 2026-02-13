import React, { useState, useEffect } from 'react';
import GlassCard from '../../components/GlassCard';
import GlassButton from '../../components/GlassButton';
import GlassInput from '../../components/GlassInput';

interface SettingsViewProps {
  onBack: () => void;
}

type SettingsTab = 'feishu' | 'model' | 'plugins' | 'general';

export default function SettingsView({ onBack }: SettingsViewProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('feishu');
  const [advancedMode, setAdvancedMode] = useState(false);
  const [config, setConfig] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [plugins, setPlugins] = useState<Array<{ name: string; id: string; status: string; description: string }>>([]);
  const [pluginLoading, setPluginLoading] = useState<string | null>(null);
  const [pluginListLoading, setPluginListLoading] = useState(false);
  const [pluginError, setPluginError] = useState<string | null>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  // 切换到插件 tab 时自动加载插件列表
  useEffect(() => {
    if (activeTab === 'plugins' && plugins.length === 0) {
      loadPlugins();
    }
  }, [activeTab]);

  const loadConfig = async () => {
    if (window.openclawAPI) {
      const cfg = await window.openclawAPI.getConfig();
      setConfig(cfg);
    } else {
      // 开发模式默认值
      setConfig({
        feishu: {
          appId: 'cli_demo12345678',
          appSecret: 'xxxxxxxxxx',
          botName: '我的AI助手',
          connectionMode: 'websocket',
          dmPolicy: 'open',
          groupPolicy: 'open',
          requireMention: true,
          renderMode: 'card',
        },
        model: { primary: 'minimax/MiniMax-M2.1', provider: 'minimax' },
        gateway: { port: 18789, bind: '127.0.0.1' },
        advanced: {
          sessionTimeout: 1800,
          queueMode: 'sequential',
          toolProfile: 'messaging',
          memoryEnabled: true,
          sandboxEnabled: false,
          browserEnabled: false,
          streamingEnabled: true,
          logLevel: 'info',
        },
      });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    if (window.openclawAPI && config) {
      await window.openclawAPI.saveConfig(config);
      await window.openclawAPI.restartGateway();
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const updateConfig = (path: string, value: any) => {
    setConfig((prev: any) => {
      const next = JSON.parse(JSON.stringify(prev));
      const keys = path.split('.');
      let obj = next;
      for (let i = 0; i < keys.length - 1; i++) {
        obj = obj[keys[i]];
      }
      obj[keys[keys.length - 1]] = value;
      return next;
    });
  };

  if (!config) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-pulse-soft text-lg">加载中...</div>
      </div>
    );
  }

  const loadPlugins = async () => {
    if (!window.openclawAPI?.listPlugins) {
      setPluginError('API 未就绪（可能引擎未安装）');
      return;
    }
    setPluginListLoading(true);
    setPluginError(null);
    try {
      const list = await window.openclawAPI.listPlugins();
      console.log('[Plugins] 加载到', list.length, '个插件:', JSON.stringify(list));
      setPlugins(list);
      if (list.length === 0) {
        setPluginError('未能解析插件列表。可能引擎未安装或未运行。');
      }
    } catch (e: any) {
      console.error('[Plugins] 加载失败:', e);
      setPluginError(`加载失败: ${e?.message || e}`);
    }
    setPluginListLoading(false);
  };

  const handleTogglePlugin = async (pluginId: string, enable: boolean) => {
    if (!window.openclawAPI?.togglePlugin) {
      setPluginError('API 未就绪');
      return;
    }
    setPluginLoading(pluginId);
    setPluginError(null);
    try {
      const result = await window.openclawAPI.togglePlugin(pluginId, enable);
      console.log('[Plugins] toggle 结果:', JSON.stringify(result));
      if (!result?.success) {
        setPluginError(`操作失败: ${result?.message || '未知错误'}`);
      }
      // 刷新列表
      await loadPlugins();
    } catch (e: any) {
      console.error('[Plugins] Toggle failed:', e);
      setPluginError(`操作失败: ${e?.message || e}`);
    }
    setPluginLoading(null);
  };

  const tabs: { id: SettingsTab; label: string; icon: string }[] = [
    { id: 'feishu', label: '飞书连接', icon: '📱' },
    { id: 'model', label: 'AI 模型', icon: '🤖' },
    { id: 'plugins', label: '插件管理', icon: '🧩' },
    { id: 'general', label: '通用设置', icon: '⚙️' },
  ];

  return (
    <div className="h-full flex flex-col px-6 py-2">
      {/* 顶部栏 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <GlassButton variant="ghost" size="sm" onClick={onBack}>
            ← 返回
          </GlassButton>
          <h1 className="text-lg font-bold">设置</h1>
        </div>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="text-xs text-[var(--success)] animate-fade-in">✅ 已保存</span>
          )}
          <GlassButton size="sm" onClick={handleSave} loading={saving}>
            保存并重启
          </GlassButton>
        </div>
      </div>

      <div className="flex gap-4 flex-1 overflow-hidden">
        {/* 侧边 Tab */}
        <div className="flex flex-col gap-1 w-32 flex-shrink-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                no-drag flex items-center gap-2 px-3 py-2.5 rounded-glass-xs text-sm text-left
                transition-all duration-200
                ${activeTab === tab.id
                  ? 'glass font-medium text-[var(--accent)]'
                  : 'text-[var(--text-secondary)] hover:bg-[rgba(0,0,0,0.03)] dark:hover:bg-[rgba(255,255,255,0.03)]'
                }
              `}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto pr-1">
          {/* ===== 飞书连接 ===== */}
          {activeTab === 'feishu' && (
            <div className="space-y-4 animate-fade-in">
              <GlassCard>
                <h3 className="text-sm font-semibold mb-4">飞书连接</h3>
                <div className="space-y-3">
                  <GlassInput
                    label="App ID"
                    value={config.feishu.appId}
                    onChange={(v) => updateConfig('feishu.appId', v)}
                  />
                  <GlassInput
                    label="App Secret"
                    value={config.feishu.appSecret}
                    onChange={(v) => updateConfig('feishu.appSecret', v)}
                    type="password"
                  />
                  <GlassInput
                    label="Verification Token"
                    value={config.feishu.verificationToken || ''}
                    onChange={(v) => updateConfig('feishu.verificationToken', v)}
                    type="password"
                    hint="在「事件与回调」→「加密策略」页面获取"
                  />
                  <GlassInput
                    label="Encrypt Key"
                    value={config.feishu.encryptKey || ''}
                    onChange={(v) => updateConfig('feishu.encryptKey', v)}
                    type="password"
                    hint="在「事件与回调」→「加密策略」页面获取"
                  />
                  <GlassInput
                    label="机器人名称"
                    value={config.feishu.botName}
                    onChange={(v) => updateConfig('feishu.botName', v)}
                  />
                </div>
              </GlassCard>

              {advancedMode && (
                <GlassCard className="animate-slide-up">
                  <h3 className="text-sm font-semibold mb-3">飞书高级设置</h3>
                  <div className="space-y-3">
                    <SettingRow label="连接模式" hint="推荐长连接">
                      <select
                        value={config.feishu.connectionMode}
                        onChange={(e) => updateConfig('feishu.connectionMode', e.target.value)}
                        className="input-glass text-sm py-1.5"
                      >
                        <option value="websocket">WebSocket 长连接（推荐）</option>
                        <option value="webhook">Webhook 回调</option>
                      </select>
                    </SettingRow>
                    <SettingRow label="私聊策略" hint="谁可以和机器人私聊">
                      <select
                        value={config.feishu.dmPolicy}
                        onChange={(e) => updateConfig('feishu.dmPolicy', e.target.value)}
                        className="input-glass text-sm py-1.5"
                      >
                        <option value="open">所有人</option>
                        <option value="paired">已配对用户</option>
                        <option value="whitelist">白名单</option>
                      </select>
                    </SettingRow>
                    <SettingRow label="群聊策略" hint="群聊中的行为">
                      <select
                        value={config.feishu.groupPolicy}
                        onChange={(e) => updateConfig('feishu.groupPolicy', e.target.value)}
                        className="input-glass text-sm py-1.5"
                      >
                        <option value="open">开放（所有群）</option>
                        <option value="whitelist">白名单</option>
                        <option value="off">关闭</option>
                      </select>
                    </SettingRow>
                    <SettingToggle
                      label="群聊需要 @"
                      hint="群聊中是否需要 @ 机器人才触发"
                      value={config.feishu.requireMention}
                      onChange={(v) => updateConfig('feishu.requireMention', v)}
                    />
                    <SettingRow label="渲染模式" hint="消息展示方式">
                      <select
                        value={config.feishu.renderMode}
                        onChange={(e) => updateConfig('feishu.renderMode', e.target.value)}
                        className="input-glass text-sm py-1.5"
                      >
                        <option value="card">卡片模式（推荐）</option>
                        <option value="raw">原始文本</option>
                        <option value="auto">自动</option>
                      </select>
                    </SettingRow>
                    <SettingToggle
                      label="流式回复"
                      hint="打字机效果，逐字显示回复"
                      value={config.advanced.streamingEnabled}
                      onChange={(v) => updateConfig('advanced.streamingEnabled', v)}
                    />
                  </div>
                </GlassCard>
              )}
            </div>
          )}

          {/* ===== AI 模型 ===== */}
          {activeTab === 'model' && (
            <div className="space-y-4 animate-fade-in">
              <GlassCard>
                <h3 className="text-sm font-semibold mb-4">AI 模型</h3>
                <div className="space-y-3">
                  <SettingRow label="当前模型">
                    <span className="text-sm font-medium">
                      {config.model.primary || '未配置'}
                    </span>
                  </SettingRow>

                  {/* 模型切换 */}
                  <div className="space-y-2">
                    {['minimax', 'zai', 'doubao', 'moonshot', 'custom'].map((p) => {
                      const names: Record<string, string> = {
                        minimax: 'MiniMax',
                        zai: '智谱 GLM',
                        doubao: '豆包（非官方支持）',
                        moonshot: 'Kimi（月之暗面）',
                        custom: '自定义（OpenAI 兼容）',
                      };
                      const defaultModels: Record<string, string> = {
                        minimax: 'MiniMax-M2.1',
                        zai: 'glm-4.7-flash',
                        doubao: 'doubao-1.5-pro-256k',
                        moonshot: 'moonshot-v1-128k',
                        custom: '',
                      };
                      const isActive = config.model.provider === p;
                      const hasKey = config.providers?.[p]?.apiKey;

                      return (
                        <div
                          key={p}
                          className={`
                            no-drag flex items-center gap-3 p-3 rounded-glass-xs
                            transition-all cursor-pointer
                            ${isActive ? 'glass ring-1 ring-[var(--accent)]' : 'hover:bg-[rgba(0,0,0,0.02)]'}
                          `}
                          onClick={() => {
                            updateConfig('model.provider', p);
                            if (p !== 'custom') {
                              updateConfig('model.primary', `${p}/${defaultModels[p]}`);
                            }
                          }}
                        >
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${isActive ? 'border-[var(--accent)]' : 'border-[var(--text-tertiary)]'}`}>
                            {isActive && <div className="w-2 h-2 rounded-full bg-[var(--accent)]" />}
                          </div>
                          <span className="text-sm flex-1">{names[p]}</span>
                          <span className={`text-xs ${hasKey ? 'text-[var(--success)]' : 'text-[var(--text-tertiary)]'}`}>
                            {hasKey ? '✅ 已配置' : '未配置'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </GlassCard>

              {/* 选中的模型的详细配置 */}
              {config.model.provider && (
                <GlassCard className="animate-slide-up">
                  <h3 className="text-sm font-semibold mb-3">
                    {config.model.provider === 'custom' ? '自定义模型配置' : `${config.model.provider} 配置`}
                  </h3>
                  <div className="space-y-3">
                    <GlassInput
                      label="API Base URL"
                      value={config.providers?.[config.model.provider]?.baseUrl || ''}
                      onChange={(v) => {
                        if (!config.providers[config.model.provider]) {
                          updateConfig(`providers.${config.model.provider}`, {
                            baseUrl: v, apiKey: '', api: 'openai-completions', models: [],
                          });
                        } else {
                          updateConfig(`providers.${config.model.provider}.baseUrl`, v);
                        }
                      }}
                      placeholder="https://api.example.com/v1"
                      hint="API 请求地址"
                    />
                    <GlassInput
                      label="API Key"
                      value={config.providers?.[config.model.provider]?.apiKey || ''}
                      onChange={(v) => updateConfig(`providers.${config.model.provider}.apiKey`, v)}
                      type="password"
                      placeholder="输入 API Key"
                    />
                    <GlassInput
                      label="模型名称"
                      value={config.model.primary?.split('/')?.pop() || ''}
                      onChange={(v) => updateConfig('model.primary', `${config.model.provider}/${v}`)}
                      placeholder="例如: gpt-4o, MiniMax-M2.1"
                      hint="模型 ID，会作为 API 请求中的 model 参数"
                    />
                  </div>
                </GlassCard>
              )}
            </div>
          )}

          {/* ===== 插件管理 ===== */}
          {activeTab === 'plugins' && (
            <div className="space-y-4 animate-fade-in">
              <GlassCard>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold">插件管理</h3>
                  <GlassButton variant="ghost" size="sm" onClick={loadPlugins}>
                    🔄 刷新
                  </GlassButton>
                </div>
                <p className="text-xs text-[var(--text-secondary)] mb-4">
                  管理 OpenClaw 插件。启用插件后需重启 Gateway 才能生效。
                </p>

                {pluginError && (
                  <div className="mb-3 p-2.5 rounded-glass-xs bg-[rgba(255,100,100,0.08)] text-xs text-[var(--warning)]">
                    ⚠️ {pluginError}
                  </div>
                )}

                {pluginListLoading ? (
                  <div className="text-center py-6">
                    <div className="animate-pulse-soft text-sm text-[var(--text-tertiary)]">正在加载插件列表...</div>
                  </div>
                ) : plugins.length === 0 ? (
                  <div className="text-center py-6">
                    <p className="text-sm text-[var(--text-tertiary)] mb-3">未检测到插件，请确保引擎已安装</p>
                    <GlassButton variant="primary" size="sm" onClick={loadPlugins}>
                      🔄 重新加载
                    </GlassButton>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* 分组：已启用 */}
                    {plugins.filter(p => p.status === 'loaded').length > 0 && (
                      <>
                        <div className="text-xs font-medium text-[var(--success)] mt-2 mb-1">
                          ✅ 已启用 ({plugins.filter(p => p.status === 'loaded').length})
                        </div>
                        {plugins.filter(p => p.status === 'loaded').map((plugin) => (
                          <PluginRow
                            key={plugin.id}
                            plugin={plugin}
                            loading={pluginLoading === plugin.id}
                            onToggle={(enable) => handleTogglePlugin(plugin.id, enable)}
                          />
                        ))}
                      </>
                    )}

                    {/* 分组：已禁用 */}
                    {plugins.filter(p => p.status === 'disabled').length > 0 && (
                      <>
                        <div className="text-xs font-medium text-[var(--text-tertiary)] mt-4 mb-1">
                          ⏸️ 已禁用 ({plugins.filter(p => p.status === 'disabled').length})
                        </div>
                        {plugins.filter(p => p.status === 'disabled').map((plugin) => (
                          <PluginRow
                            key={plugin.id}
                            plugin={plugin}
                            loading={pluginLoading === plugin.id}
                            onToggle={(enable) => handleTogglePlugin(plugin.id, enable)}
                          />
                        ))}
                      </>
                    )}
                  </div>
                )}
              </GlassCard>

              <GlassCard>
                <h3 className="text-sm font-semibold mb-2">推荐插件</h3>
                <div className="space-y-2 text-xs text-[var(--text-secondary)]">
                  <div className="flex items-start gap-2">
                    <span className="text-base">📱</span>
                    <div>
                      <span className="font-medium">@openclaw/feishu</span> — 飞书/Lark 频道插件（必须启用）
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-base">🧠</span>
                    <div>
                      <span className="font-medium">memory-lancedb</span> — 向量记忆（推荐，增强长期记忆能力）
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-base">🔑</span>
                    <div>
                      <span className="font-medium">minimax-portal-auth</span> — MiniMax 认证插件（选择 MiniMax 时自动启用）
                    </div>
                  </div>
                </div>
              </GlassCard>

              <GlassCard>
                <h3 className="text-sm font-semibold mb-2">关于通义千问 (Qwen)</h3>
                <div className="text-xs text-[var(--text-secondary)] space-y-1.5">
                  <p>通义千问不支持直接填写 API Key，需要通过 OAuth 设备码授权登录。</p>
                  <p>如需使用通义千问，请在上方启用 <span className="font-medium">qwen-portal-auth</span> 插件，然后在终端运行 <code className="px-1 py-0.5 rounded bg-[rgba(0,0,0,0.05)] dark:bg-[rgba(255,255,255,0.05)]">openclaw auth qwen</code> 完成授权。</p>
                </div>
              </GlassCard>
            </div>
          )}

          {/* ===== 通用设置 ===== */}
          {activeTab === 'general' && (
            <div className="space-y-4 animate-fade-in">
              <GlassCard>
                <h3 className="text-sm font-semibold mb-4">通用设置</h3>
                <div className="space-y-3">
                  <SettingRow label="语言">
                    <span className="text-sm">简体中文</span>
                  </SettingRow>
                </div>
              </GlassCard>

              {advancedMode && (
                <>
                  <GlassCard className="animate-slide-up">
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <span>⚙️</span> Gateway 设置
                    </h3>
                    <div className="space-y-3">
                      <SettingRow label="端口" hint="默认 18789">
                        <input
                          type="number"
                          value={config.gateway.port}
                          onChange={(e) => updateConfig('gateway.port', parseInt(e.target.value))}
                          className="input-glass text-sm py-1.5 w-24 text-center"
                        />
                      </SettingRow>
                      <SettingRow label="绑定地址" hint="仅本机访问更安全">
                        <select
                          value={config.gateway.bind}
                          onChange={(e) => updateConfig('gateway.bind', e.target.value)}
                          className="input-glass text-sm py-1.5"
                        >
                          <option value="127.0.0.1">仅本机 (127.0.0.1)</option>
                          <option value="0.0.0.0">所有地址 (0.0.0.0)</option>
                        </select>
                      </SettingRow>
                    </div>
                  </GlassCard>

                  <GlassCard className="animate-slide-up">
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <span>💬</span> 消息处理
                    </h3>
                    <div className="space-y-3">
                      <SettingRow label="处理模式" hint="消息执行策略">
                        <select
                          value={config.advanced.queueMode}
                          onChange={(e) => updateConfig('advanced.queueMode', e.target.value)}
                          className="input-glass text-sm py-1.5"
                        >
                          <option value="sequential">顺序执行（推荐）</option>
                          <option value="parallel">并行执行</option>
                        </select>
                      </SettingRow>
                      <SettingRow label="空闲超时" hint="超时后重置会话">
                        <select
                          value={config.advanced.sessionTimeout}
                          onChange={(e) => updateConfig('advanced.sessionTimeout', parseInt(e.target.value))}
                          className="input-glass text-sm py-1.5"
                        >
                          <option value={600}>10 分钟</option>
                          <option value={1800}>30 分钟（推荐）</option>
                          <option value={3600}>1 小时</option>
                          <option value={7200}>2 小时</option>
                        </select>
                      </SettingRow>
                    </div>
                  </GlassCard>

                  <GlassCard className="animate-slide-up">
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <span>🛡️</span> 工具与安全
                    </h3>
                    <div className="space-y-3">
                      <SettingRow label="工具预设" hint="AI 可使用的工具范围">
                        <select
                          value={config.advanced.toolProfile}
                          onChange={(e) => updateConfig('advanced.toolProfile', e.target.value)}
                          className="input-glass text-sm py-1.5"
                        >
                          <option value="minimal">最小（仅对话）</option>
                          <option value="messaging">标准（推荐）</option>
                          <option value="coding">编程</option>
                          <option value="full">完整</option>
                        </select>
                      </SettingRow>
                      <SettingToggle
                        label="记忆系统"
                        hint="AI 会记住对话上下文"
                        value={config.advanced.memoryEnabled}
                        onChange={(v) => updateConfig('advanced.memoryEnabled', v)}
                      />
                    </div>
                  </GlassCard>

                  <GlassCard className="animate-slide-up">
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <span>📊</span> 日志
                    </h3>
                    <div className="space-y-3">
                      <SettingRow label="日志级别">
                        <select
                          value={config.advanced.logLevel}
                          onChange={(e) => updateConfig('advanced.logLevel', e.target.value)}
                          className="input-glass text-sm py-1.5"
                        >
                          <option value="error">仅错误</option>
                          <option value="warn">警告</option>
                          <option value="info">信息（推荐）</option>
                          <option value="debug">调试</option>
                        </select>
                      </SettingRow>
                    </div>
                  </GlassCard>
                </>
              )}

              {/* 高级模式切换 */}
              <button
                onClick={() => setAdvancedMode(!advancedMode)}
                className="
                  no-drag w-full p-3 rounded-glass-sm text-sm text-center
                  text-[var(--accent)] hover:bg-[rgba(0,122,255,0.05)]
                  transition-colors
                "
              >
                {advancedMode ? '🔽 收起高级模式' : '🔧 开启高级模式'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ===== 辅助组件 =====

function SettingRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex-shrink-0">
        <div className="text-sm">{label}</div>
        {hint && <div className="text-[10px] text-[var(--text-tertiary)]">{hint}</div>}
      </div>
      <div className="no-drag">{children}</div>
    </div>
  );
}

function PluginRow({
  plugin,
  loading,
  onToggle,
}: {
  plugin: { name: string; id: string; status: string; description: string };
  loading: boolean;
  onToggle: (enable: boolean) => void;
}) {
  const isLoaded = plugin.status === 'loaded';
  return (
    <div className="flex items-center justify-between gap-3 p-2.5 rounded-glass-xs bg-[rgba(0,0,0,0.02)] dark:bg-[rgba(255,255,255,0.02)]">
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium truncate">{plugin.name || plugin.id}</div>
        {plugin.description && (
          <div className="text-[10px] text-[var(--text-tertiary)] truncate">{plugin.description}</div>
        )}
      </div>
      <button
        onClick={() => onToggle(!isLoaded)}
        disabled={loading}
        className={`
          no-drag flex-shrink-0 px-3 py-1 rounded-full text-[10px] font-medium
          transition-all duration-200
          ${loading ? 'opacity-50 cursor-wait' : 'cursor-pointer'}
          ${isLoaded
            ? 'bg-[var(--success)] text-white hover:bg-green-600'
            : 'bg-[var(--glass-bg)] text-[var(--text-secondary)] hover:bg-[rgba(0,122,255,0.1)] hover:text-[var(--accent)]'
          }
        `}
      >
        {loading ? '...' : isLoaded ? '已启用' : '启用'}
      </button>
    </div>
  );
}

function SettingToggle({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <div className="text-sm">{label}</div>
        {hint && <div className="text-[10px] text-[var(--text-tertiary)]">{hint}</div>}
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`
          no-drag w-11 h-6 rounded-full relative transition-colors duration-200
          ${value ? 'bg-[var(--accent)]' : 'bg-gray-300 dark:bg-gray-600'}
        `}
      >
        <div
          className={`
            absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm
            transition-transform duration-200
            ${value ? 'translate-x-[22px]' : 'translate-x-0.5'}
          `}
        />
      </button>
    </div>
  );
}
