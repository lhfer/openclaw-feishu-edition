import React, { useState } from 'react';
import GlassCard from '../../components/GlassCard';
import GlassButton from '../../components/GlassButton';
import GlassInput from '../../components/GlassInput';
import type { WizardData } from './WizardFlow';

interface FeishuSetupProps {
  data: WizardData;
  onUpdate: (partial: Partial<WizardData>) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function FeishuSetup({ data, onUpdate, onNext, onBack }: FeishuSetupProps) {
  const [showTutorial, setShowTutorial] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!data.feishuAppId.trim()) {
      newErrors.appId = '请输入 App ID';
    } else if (!data.feishuAppId.startsWith('cli_')) {
      newErrors.appId = 'App ID 通常以 cli_ 开头，请确认是否正确';
    }

    if (!data.feishuAppSecret.trim()) {
      newErrors.appSecret = '请输入 App Secret';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validate()) {
      onNext();
    }
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
        <h2 className="text-xl font-bold mb-1">🔗 连接你的飞书</h2>
        <p className="text-sm text-[var(--text-secondary)]">
          输入飞书应用的 App ID 和 App Secret 以连接你的飞书机器人
        </p>
      </div>

      {/* 配置表单 */}
      <GlassCard className="mb-4">
        <div className="space-y-4">
          <GlassInput
            label="App ID"
            value={data.feishuAppId}
            onChange={(v) => {
              onUpdate({ feishuAppId: v.trim() });
              setErrors((prev) => ({ ...prev, appId: '' }));
            }}
            placeholder="cli_xxxxxxxxxxxxxxxx"
            error={errors.appId}
            hint="在飞书开放平台「凭证与基础信息」页面获取"
          />

          <GlassInput
            label="App Secret"
            value={data.feishuAppSecret}
            onChange={(v) => {
              onUpdate({ feishuAppSecret: v.trim() });
              setErrors((prev) => ({ ...prev, appSecret: '' }));
            }}
            placeholder="输入 App Secret"
            type="password"
            error={errors.appSecret}
          />

          <GlassInput
            label="Verification Token"
            value={data.feishuVerificationToken}
            onChange={(v) => onUpdate({ feishuVerificationToken: v.trim() })}
            placeholder="输入 Verification Token"
            type="password"
            hint="在「事件与回调」→「加密策略」页面获取"
          />

          <GlassInput
            label="Encrypt Key（可选）"
            value={data.feishuEncryptKey}
            onChange={(v) => onUpdate({ feishuEncryptKey: v.trim() })}
            placeholder="输入 Encrypt Key"
            type="password"
            hint="在「事件与回调」→「加密策略」页面获取"
          />

          <GlassInput
            label="机器人名称（可选）"
            value={data.feishuBotName}
            onChange={(v) => onUpdate({ feishuBotName: v })}
            placeholder="我的AI助手"
            hint="在飞书中搜索此名称即可找到你的机器人"
          />
        </div>
      </GlassCard>

      {/* 教程入口 */}
      <button
        onClick={() => setShowTutorial(!showTutorial)}
        className="
          no-drag w-full flex items-center justify-between
          p-3 rounded-glass-sm text-sm
          text-[var(--accent)] hover:bg-[rgba(0,122,255,0.05)]
          transition-colors
        "
      >
        <span>📖 不知道怎么获取？查看详细教程</span>
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2"
          className={`transition-transform duration-200 ${showTutorial ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* 展开教程 */}
      {showTutorial && (
        <GlassCard className="mt-3 animate-slide-up">
          <div className="space-y-5">
            <h3 className="text-sm font-semibold">飞书应用创建教程</h3>

            {/* 步骤列表 */}
            {[
              {
                num: '1',
                title: '创建飞书应用',
                desc: '打开飞书开放平台，点击「创建应用」，选择「企业自建应用」，填写应用名称和描述。',
                link: { label: '打开飞书开放平台', url: 'https://open.feishu.cn/app' },
              },
              {
                num: '2',
                title: '添加机器人能力',
                desc: '进入应用详情 → 「添加应用能力」→ 勾选「机器人」。',
              },
              {
                num: '3',
                title: '配置权限',
                desc: '进入「权限管理」，搜索并开通以下权限：\nim:message（获取消息）\nim:message:send_as_bot（发送消息）\nim:message:readonly（读取消息）',
              },
              {
                num: '4',
                title: '配置事件订阅',
                desc: '进入「事件订阅」→ 选择「使用长连接接收事件」→ 添加事件 im.message.receive_v1',
              },
              {
                num: '5',
                title: '发布应用',
                desc: '「版本管理与发布」→ 创建版本 → 提交审核。企业自建应用通常自动审核通过。\n\n发布后即可在「凭证与基础信息」获取 App ID 和 App Secret。',
              },
            ].map((step) => (
              <div key={step.num} className="flex gap-3">
                <div className="
                  w-6 h-6 rounded-full bg-[var(--accent)] text-white
                  flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5
                ">
                  {step.num}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium mb-1">{step.title}</div>
                  <div className="text-xs text-[var(--text-secondary)] whitespace-pre-line leading-relaxed">
                    {step.desc}
                  </div>
                  {step.link && (
                    <button
                      onClick={() => openExternal(step.link!.url)}
                      className="
                        no-drag inline-flex items-center gap-1 mt-1.5
                        text-xs text-[var(--accent)] hover:underline
                      "
                    >
                      🔗 {step.link.label}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* 操作按钮 */}
      <div className="flex justify-between mt-6">
        <GlassButton variant="ghost" onClick={onBack}>
          返回
        </GlassButton>
        <GlassButton onClick={handleNext}>
          下一步
        </GlassButton>
      </div>
    </div>
  );
}
