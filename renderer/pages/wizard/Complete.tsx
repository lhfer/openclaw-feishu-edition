import React, { useState } from 'react';
import GlassCard from '../../components/GlassCard';
import GlassButton from '../../components/GlassButton';
import type { WizardData } from './WizardFlow';

interface CompleteProps {
  data: WizardData;
  onComplete: () => void;
}

export default function Complete({ data, onComplete }: CompleteProps) {
  const [starting, setStarting] = useState(false);

  const handleStart = async () => {
    setStarting(true);
    await onComplete();
  };

  const openExternal = (url: string) => {
    if (window.openclawAPI) {
      window.openclawAPI.openExternal(url);
    } else {
      window.open(url, '_blank');
    }
  };

  const providerNames: Record<string, string> = {
    minimax: 'MiniMax M2.1',
    zhipu: 'GLM 4.7 Flash',
    doubao: '豆包 1.5 Pro',
  };

  return (
    <div className="flex flex-col items-center justify-center h-full max-w-lg mx-auto text-center">
      {/* 成功动画 */}
      <div className="mb-6 animate-check-bounce">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center shadow-lg shadow-green-500/30">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
      </div>

      <h2 className="text-2xl font-bold mb-2 animate-slide-up">🎉 配置完成！</h2>
      <p className="text-sm text-[var(--text-secondary)] mb-6 animate-slide-up">
        你的 AI 助手已经准备就绪
      </p>

      {/* 配置摘要 */}
      <GlassCard className="w-full mb-6 text-left animate-slide-up">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--text-secondary)]">飞书应用</span>
            <span className="text-sm font-medium">{data.feishuBotName || '我的AI助手'}</span>
          </div>
          <div className="h-px bg-[var(--glass-border)]" />
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--text-secondary)]">App ID</span>
            <span className="text-sm font-mono text-[var(--text-tertiary)]">
              {data.feishuAppId.slice(0, 8)}...{data.feishuAppId.slice(-4)}
            </span>
          </div>
          <div className="h-px bg-[var(--glass-border)]" />
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--text-secondary)]">AI 模型</span>
            <span className="text-sm font-medium">
              {data.modelProvider
                ? providerNames[data.modelProvider] || data.modelProvider
                : '未配置（稍后设置）'}
            </span>
          </div>
        </div>
      </GlassCard>

      {/* 使用指南 */}
      <GlassCard className="w-full mb-6 text-left animate-slide-up">
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">如何使用</h3>

          <div className="flex items-start gap-3">
            <span className="text-lg">📱</span>
            <div>
              <div className="text-sm font-medium">在飞书中使用</div>
              <div className="text-xs text-[var(--text-secondary)]">
                打开飞书 → 搜索「{data.feishuBotName || '我的AI助手'}」→ 开始对话
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <span className="text-lg">💻</span>
            <div>
              <div className="text-sm font-medium">在本机使用</div>
              <div className="text-xs text-[var(--text-secondary)]">
                点击菜单栏 🦞 图标 → 打开对话窗口
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <span className="text-lg">👥</span>
            <div>
              <div className="text-sm font-medium">在飞书群聊中使用</div>
              <div className="text-xs text-[var(--text-secondary)]">
                在群聊中 @{data.feishuBotName || '我的AI助手'} 加上你的问题即可
              </div>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* 小提示 */}
      <div className="text-xs text-[var(--text-tertiary)] mb-6 space-y-1 animate-fade-in">
        <p>· 支持发送图片和文件给 AI 处理</p>
        <p>· 随时在设置中更换模型或调整配置</p>
        <p>· AI 助手将在菜单栏常驻运行</p>
      </div>

      {/* 开始使用按钮 */}
      <GlassButton
        size="lg"
        onClick={handleStart}
        loading={starting}
        className="min-w-[200px] animate-fade-in"
      >
        {starting ? '正在启动...' : '🚀 开始使用'}
      </GlassButton>
    </div>
  );
}
