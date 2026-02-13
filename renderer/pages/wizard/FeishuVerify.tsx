import React, { useEffect, useState, useRef } from 'react';
import GlassCard from '../../components/GlassCard';
import GlassButton from '../../components/GlassButton';
import StatusBadge from '../../components/StatusBadge';

interface FeishuVerifyProps {
  appId: string;
  appSecret: string;
  onNext: () => void;
  onBack: () => void;
}

interface VerifyStep {
  id: string;
  label: string;
  status: 'pending' | 'checking' | 'success' | 'warning' | 'error';
  message?: string;
  detail?: string;
  action?: {
    label: string;
    url?: string;
    type?: 'link' | 'retry';
  };
}

export default function FeishuVerify({ appId, appSecret, onNext, onBack }: FeishuVerifyProps) {
  const [steps, setSteps] = useState<VerifyStep[]>([
    { id: 'credentials', label: '凭证验证', status: 'pending' },
    { id: 'permissions', label: '权限检查', status: 'pending' },
    { id: 'app_status', label: '应用状态', status: 'pending' },
    { id: 'bot_capability', label: '机器人能力', status: 'pending' },
    { id: 'event_subscription', label: '事件订阅', status: 'pending' },
  ]);
  const [isRunning, setIsRunning] = useState(false);
  const [allDone, setAllDone] = useState(false);
  const hasRun = useRef(false);

  // 首次进入时自动执行校验
  useEffect(() => {
    if (!hasRun.current) {
      hasRun.current = true;
      runValidation();
    }
  }, []);

  const runValidation = async () => {
    setIsRunning(true);
    setAllDone(false);

    // 重置所有步骤
    setSteps((prev) =>
      prev.map((s) => ({ ...s, status: 'pending' as const, message: '', detail: '', action: undefined }))
    );

    if (window.openclawAPI) {
      // 监听实时进度
      const cleanup = window.openclawAPI.onFeishuValidateProgress((step) => {
        setSteps((prev) =>
          prev.map((s) =>
            s.id === step.id ? { ...s, ...step } : s
          )
        );
      });

      try {
        await window.openclawAPI.validateFeishu(appId, appSecret);
      } catch (err) {
        console.error('校验失败:', err);
      }

      cleanup();
    } else {
      // 开发模式模拟
      await simulateValidation();
    }

    setIsRunning(false);
    setAllDone(true);
  };

  const simulateValidation = async () => {
    const delays = [800, 1200, 1000, 800, 600];
    const results: Partial<VerifyStep>[] = [
      { status: 'success', message: 'App ID 和 App Secret 验证通过' },
      { status: 'success', message: '消息收发权限已开通' },
      { status: 'warning', message: '应用尚未发布', detail: '你的飞书应用尚未发布，机器人将无法接收消息。\n\n请前往「版本管理与发布」→ 创建新版本 → 提交审核。', action: { label: '前往发布', url: `https://open.feishu.cn/app/${appId}/version`, type: 'link' } },
      { status: 'success', message: '机器人能力已启用' },
      { status: 'success', message: '请确认已配置长连接事件订阅' },
    ];

    for (let i = 0; i < steps.length; i++) {
      // 开始检查
      setSteps((prev) =>
        prev.map((s, idx) =>
          idx === i ? { ...s, status: 'checking' as const, message: '正在检查...' } : s
        )
      );
      await new Promise((r) => setTimeout(r, delays[i]));

      // 更新结果
      setSteps((prev) =>
        prev.map((s, idx) =>
          idx === i ? { ...s, ...results[i] } as VerifyStep : s
        )
      );
    }
  };

  const hasErrors = steps.some((s) => s.status === 'error');
  const hasWarnings = steps.some((s) => s.status === 'warning');
  const allSuccess = steps.every((s) => s.status === 'success');

  return (
    <div className="max-w-xl mx-auto">
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold mb-1">
          {isRunning ? '🔍 正在检查飞书配置...' : allSuccess ? '✅ 检查完成' : '📋 检查结果'}
        </h2>
        <p className="text-sm text-[var(--text-secondary)]">
          {isRunning
            ? '正在逐项验证你的飞书应用配置'
            : allSuccess
            ? '所有检查通过，你的飞书配置一切就绪'
            : hasErrors
            ? '部分检查未通过，请根据提示修正后重试'
            : '存在警告项，建议处理后继续'}
        </p>
      </div>

      {/* 校验步骤列表 */}
      <GlassCard className="mb-4">
        <div className="space-y-1">
          {steps.map((step) => (
            <StatusBadge
              key={step.id}
              status={step.status}
              label={step.label}
              message={step.message}
              detail={step.detail}
              action={step.action}
            />
          ))}
        </div>
      </GlassCard>

      {/* 结果总结 */}
      {allDone && !allSuccess && (
        <GlassCard padding="sm" className="mb-4">
          <div className="flex items-start gap-2 text-xs">
            <span className="mt-0.5">{hasErrors ? '💡' : '💡'}</span>
            <div className="text-[var(--text-secondary)] leading-relaxed">
              {hasErrors ? (
                <>
                  请先修复标红的错误项。点击每个检查项可以展开查看详细修复步骤。
                  <br />
                  修复后点击下方「重新检查」按钮。
                </>
              ) : (
                <>
                  警告项不会阻止你继续，但建议尽快处理以确保机器人正常工作。
                  <br />
                  你可以先继续配置，稍后再处理警告项。
                </>
              )}
            </div>
          </div>
        </GlassCard>
      )}

      {/* 操作按钮 */}
      <div className="flex justify-between mt-6">
        <GlassButton variant="ghost" onClick={onBack}>
          返回修改
        </GlassButton>
        <div className="flex gap-3">
          {allDone && !allSuccess && (
            <GlassButton
              variant="secondary"
              onClick={runValidation}
              disabled={isRunning}
              loading={isRunning}
            >
              重新检查
            </GlassButton>
          )}
          <GlassButton
            onClick={onNext}
            disabled={isRunning || hasErrors}
          >
            {hasErrors ? '请先修复错误' : '下一步'}
          </GlassButton>
        </div>
      </div>
    </div>
  );
}
