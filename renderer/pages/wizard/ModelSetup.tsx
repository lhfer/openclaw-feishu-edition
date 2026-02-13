import React, { useState } from 'react';
import GlassCard from '../../components/GlassCard';
import GlassButton from '../../components/GlassButton';
import GlassInput from '../../components/GlassInput';
import type { WizardData } from './WizardFlow';

interface ModelSetupProps {
  data: WizardData;
  onUpdate: (partial: Partial<WizardData>) => void;
  onNext: () => void;
  onBack: () => void;
}

interface ModelProvider {
  id: string;
  name: string;
  icon: string;
  tagline: string;
  features: string[];
  url: string;          // 平台开通链接（"去开通 →"）
  apiBaseUrl: string;   // API 请求地址（填入 Base URL 输入框）
  defaultModel: string;
  defaultModelName: string;
  color: string;
}

const PROVIDERS: ModelProvider[] = [
  {
    id: 'minimax',
    name: 'MiniMax',
    icon: '✨',
    tagline: '擅长写作，性价比高',
    features: ['写作创意强', '中文理解好', '价格实惠'],
    url: 'https://www.minimaxi.com/platform',
    apiBaseUrl: 'https://api.minimaxi.com/anthropic',
    defaultModel: 'MiniMax-M2.5',
    defaultModelName: 'MiniMax M2.5',
    color: '#6366F1',
  },
  {
    id: 'zai',
    name: '智谱 GLM',
    icon: '🔬',
    tagline: '擅长编程，工具调用好',
    features: ['编程能力强', '工具调用好', '开源生态'],
    url: 'https://open.bigmodel.cn',
    apiBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'glm-4.7-flash',
    defaultModelName: 'GLM 4.7 Flash',
    color: '#10B981',
  },
  {
    id: 'doubao',
    name: '豆包',
    icon: '🎯',
    tagline: '字节出品（非官方支持）',
    features: ['综合能力强', '字节跳动出品', '非官方渠道'],
    url: 'https://console.volcengine.com/ark',
    apiBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    defaultModel: 'doubao-1.5-pro-256k',
    defaultModelName: '豆包 1.5 Pro',
    color: '#F59E0B',
  },
  {
    id: 'moonshot',
    name: 'Kimi',
    icon: '🌙',
    tagline: '月之暗面，超长上下文',
    features: ['128K 超长上下文', '中文能力出色', '价格适中'],
    url: 'https://platform.moonshot.cn',
    apiBaseUrl: 'https://api.moonshot.cn/v1',
    defaultModel: 'moonshot-v1-128k',
    defaultModelName: 'Kimi 128K',
    color: '#3B82F6',
  },
  {
    id: 'custom',
    name: '自定义',
    icon: '🔧',
    tagline: '兼容 OpenAI API 的服务',
    features: ['自定义 Base URL', '任意模型名称', 'OpenAI 兼容'],
    url: '',
    apiBaseUrl: '',
    defaultModel: '',
    defaultModelName: '自定义模型',
    color: '#8B5CF6',
  },
];

export default function ModelSetup({ data, onUpdate, onNext, onBack }: ModelSetupProps) {
  const [selectedProvider, setSelectedProvider] = useState<string>(data.modelProvider || '');
  const [apiKey, setApiKey] = useState(data.modelApiKey || '');
  const [baseUrl, setBaseUrl] = useState(data.modelBaseUrl || '');
  const [customModelId, setCustomModelId] = useState(data.modelId || '');
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const currentProvider = PROVIDERS.find((p) => p.id === selectedProvider);
  const isCustom = selectedProvider === 'custom';

  const handleSelectProvider = (providerId: string) => {
    const provider = PROVIDERS.find((p) => p.id === providerId)!;
    setSelectedProvider(providerId);
    setValidationResult(null);
    if (providerId !== 'custom') {
      setCustomModelId(provider.defaultModel);
      setBaseUrl('');
      onUpdate({
        modelProvider: providerId,
        modelId: provider.defaultModel,
        modelBaseUrl: '',
      });
    } else {
      onUpdate({
        modelProvider: 'custom',
        modelId: customModelId,
        modelBaseUrl: baseUrl,
      });
    }
  };

  const handleValidate = async () => {
    if (!apiKey.trim() || !currentProvider) return;

    setValidating(true);
    setValidationResult(null);

    try {
      if (window.openclawAPI) {
        const result = await window.openclawAPI.validateModel(
          selectedProvider,
          apiKey,
          currentProvider.defaultModel
        );
        setValidationResult(result);
      } else {
        // 开发模式模拟
        await new Promise((r) => setTimeout(r, 1500));
        setValidationResult({ success: true, message: '模型连接成功' });
      }
    } catch {
      setValidationResult({ success: false, message: '验证过程出错' });
    }

    setValidating(false);
  };

  const handleNext = () => {
    onUpdate({
      modelProvider: selectedProvider,
      modelApiKey: apiKey,
      modelBaseUrl: baseUrl,
      modelId: isCustom ? customModelId : (currentProvider?.defaultModel || ''),
    });
    onNext();
  };

  const handleSkip = () => {
    onUpdate({ modelProvider: '', modelApiKey: '', modelId: '', modelBaseUrl: '' });
    onNext();
  };

  const openExternal = (url: string) => {
    if (window.openclawAPI) {
      window.openclawAPI.openExternal(url);
    } else {
      window.open(url, '_blank');
    }
  };

  return (
    <div className="max-w-xl mx-auto">
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold mb-1">🤖 选择你的 AI 大脑</h2>
        <p className="text-sm text-[var(--text-secondary)]">
          为你的 AI 助手选择一个大模型。你也可以先跳过，稍后在设置中配置。
        </p>
      </div>

      {/* 模型选择卡片 */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {PROVIDERS.map((provider) => (
          <GlassCard
            key={provider.id}
            hover
            padding="sm"
            onClick={() => handleSelectProvider(provider.id)}
            className={`
              text-center transition-all duration-200
              ${selectedProvider === provider.id
                ? 'ring-2 ring-[var(--accent)] shadow-lg'
                : ''
              }
            `}
          >
            <div className="py-1">
              <div className="text-2xl mb-1.5">{provider.icon}</div>
              <div className="text-sm font-semibold mb-0.5">{provider.name}</div>
              <div className="text-[10px] text-[var(--text-tertiary)] mb-2">
                {provider.tagline}
              </div>
              <div className="space-y-0.5">
                {provider.features.map((f) => (
                  <div
                    key={f}
                    className="text-[10px] text-[var(--text-secondary)]"
                  >
                    {f}
                  </div>
                ))}
              </div>
              {provider.url && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openExternal(provider.url);
                  }}
                  className="
                    no-drag mt-2 text-[10px] text-[var(--accent)]
                    hover:underline
                  "
                >
                  去开通 →
                </button>
              )}
            </div>
          </GlassCard>
        ))}
      </div>

      {/* API Key 输入区 */}
      {selectedProvider && currentProvider && (
        <GlassCard className="mb-4 animate-slide-up">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <span>{currentProvider.icon}</span>
              <span className="font-medium">配置 {currentProvider.name}</span>
              {!isCustom && (
                <span className="text-xs text-[var(--text-tertiary)]">
                  — 默认使用 {currentProvider.defaultModelName}
                </span>
              )}
            </div>

            <GlassInput
              label="API Base URL"
              value={isCustom ? baseUrl : (baseUrl || currentProvider.apiBaseUrl || '')}
              onChange={(v) => {
                setBaseUrl(v.trim());
                setValidationResult(null);
              }}
              placeholder={isCustom ? 'https://api.example.com/v1' : currentProvider.apiBaseUrl || ''}
              hint={isCustom ? '兼容 OpenAI API 的服务地址（必填）' : '默认已填，如需自定义可修改'}
            />

            <GlassInput
              label="API Key"
              value={apiKey}
              onChange={(v) => {
                setApiKey(v.trim());
                setValidationResult(null);
              }}
              placeholder="输入你的 API Key"
              type="password"
              hint={isCustom ? '你的 API 密钥' : `从 ${currentProvider.name} 开放平台获取（以 sk- 开头）`}
            />

            <GlassInput
              label="模型名称"
              value={isCustom ? customModelId : (customModelId || currentProvider.defaultModel)}
              onChange={(v) => {
                setCustomModelId(v.trim());
                setValidationResult(null);
              }}
              placeholder={isCustom ? '例如: gpt-4o, claude-3-sonnet' : currentProvider.defaultModel}
              hint={isCustom ? '模型 ID（必填）' : '如需更换模型可直接修改'}
            />

            {/* 验证按钮和结果 */}
            <div className="flex items-center gap-3">
              <GlassButton
                variant="secondary"
                size="sm"
                onClick={handleValidate}
                loading={validating}
                disabled={!apiKey.trim()}
              >
                测试连接
              </GlassButton>

              {validationResult && (
                <span
                  className={`text-xs font-medium ${
                    validationResult.success
                      ? 'text-[var(--success)]'
                      : 'text-[var(--error)]'
                  }`}
                >
                  {validationResult.success ? '✅' : '❌'} {validationResult.message}
                </span>
              )}
            </div>
          </div>
        </GlassCard>
      )}

      {/* 操作按钮 */}
      <div className="flex justify-between mt-6">
        <GlassButton variant="ghost" onClick={onBack}>
          返回
        </GlassButton>
        <div className="flex gap-3">
          <GlassButton variant="ghost" onClick={handleSkip}>
            跳过，稍后配置
          </GlassButton>
          <GlassButton
            onClick={handleNext}
            disabled={selectedProvider !== '' && !apiKey.trim()}
          >
            下一步
          </GlassButton>
        </div>
      </div>
    </div>
  );
}
