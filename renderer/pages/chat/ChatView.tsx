import React, { useState, useEffect } from 'react';
import GlassCard from '../../components/GlassCard';
import GlassButton from '../../components/GlassButton';

interface ChatViewProps {
  onGoToSettings: () => void;
  onRerunWizard: () => void;
}

export default function ChatView({ onGoToSettings, onRerunWizard }: ChatViewProps) {
  const [gatewayStatus, setGatewayStatus] = useState<string>('checking');
  const [feishuConnected, setFeishuConnected] = useState(false);
  const [feishuDetail, setFeishuDetail] = useState<string>('');
  const [healthCheckDetail, setHealthCheckDetail] = useState<string>('');
  const [modelName, setModelName] = useState('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [actionLoading, setActionLoading] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [gatewayPid, setGatewayPid] = useState<number | undefined>();

  // 引擎状态
  const [engineStatus, setEngineStatus] = useState<string>('not_installed');
  const [engineVersion, setEngineVersion] = useState<string>('');
  const [installProgress, setInstallProgress] = useState<{ phase: string; message: string; percent?: number } | null>(null);

  useEffect(() => {
    checkStatus();
    // 监听 gateway 状态变化
    if (window.openclawAPI) {
      const cleanup = window.openclawAPI.onGatewayStatusChange((state) => {
        console.log('[ChatView] gateway status changed:', JSON.stringify(state));
        setGatewayStatus(state.status);
        setFeishuConnected(state.feishuConnected);
        if (state.feishuDetail) setFeishuDetail(state.feishuDetail);
        if (state.healthCheckDetail) setHealthCheckDetail(state.healthCheckDetail);
        if (state.pid) setGatewayPid(state.pid);
        if (state.recentLogs) setLogs(state.recentLogs);
        setEngineStatus(state.engineStatus || 'not_installed');
        if (state.engineVersion) setEngineVersion(state.engineVersion);
        if (state.error) {
          setErrorMessage(state.error);
        } else if (state.status === 'running') {
          setErrorMessage('');
        }
      });
      return cleanup;
    }
  }, []);

  const checkStatus = async () => {
    if (window.openclawAPI) {
      try {
        const status = await window.openclawAPI.getGatewayStatus();
        console.log('[ChatView] initial gateway status:', JSON.stringify(status));
        setGatewayStatus(status.status);
        setFeishuConnected(status.feishuConnected);
        if (status.feishuDetail) setFeishuDetail(status.feishuDetail);
        if (status.healthCheckDetail) setHealthCheckDetail(status.healthCheckDetail);
        if (status.pid) setGatewayPid(status.pid);
        if (status.recentLogs) setLogs(status.recentLogs);
        setEngineStatus(status.engineStatus || 'not_installed');
        if (status.engineVersion) setEngineVersion(status.engineVersion);
        if (status.error) setErrorMessage(status.error);

        const config = await window.openclawAPI.getConfig();
        setModelName(config.model.primary || '未配置');
      } catch (err: any) {
        console.error('[ChatView] checkStatus error:', err);
        setGatewayStatus('error');
        setErrorMessage('获取状态失败: ' + (err?.message || String(err)));
      }
    } else {
      // 开发模式
      setGatewayStatus('running');
      setFeishuConnected(true);
      setModelName('minimax/MiniMax-M2.1');
      setEngineStatus('installed');
      setEngineVersion('dev');
    }
  };

  const handleInstallEngine = async () => {
    if (!window.openclawAPI) return;
    setInstallProgress({ phase: 'checking', message: '准备安装...' });
    setErrorMessage('');

    // 监听安装进度
    const cleanup = window.openclawAPI.onInstallProgress((progress) => {
      console.log('[ChatView] install progress:', JSON.stringify(progress));
      setInstallProgress(progress);
      if (progress.phase === 'error') {
        setErrorMessage(progress.message);
      }
    });

    try {
      const result = await window.openclawAPI.installEngine();
      if (result.success) {
        setEngineStatus('installed');
        setInstallProgress(null);
        // 重新检测
        const detect = await window.openclawAPI.detectEngine();
        if (detect.version) setEngineVersion(detect.version);
      } else {
        setErrorMessage(result.error || '安装失败');
      }
    } catch (err: any) {
      setErrorMessage('安装出错: ' + (err?.message || String(err)));
    } finally {
      cleanup();
    }
  };

  const handleStartOrRestart = async () => {
    if (!window.openclawAPI) return;
    setActionLoading(true);
    setErrorMessage('');
    try {
      if (gatewayStatus === 'running') {
        setGatewayStatus('starting');
        const result = await window.openclawAPI.restartGateway();
        if (!result.success) {
          setErrorMessage(result.error || '重启失败（未知原因）');
          setGatewayStatus('error');
        }
      } else {
        setGatewayStatus('starting');
        const result = await window.openclawAPI.startGateway();
        if (!result.success) {
          setErrorMessage(result.error || '启动失败（未知原因）');
          setGatewayStatus('error');
        }
      }
    } catch (err: any) {
      console.error('[ChatView] start/restart error:', err);
      setErrorMessage('操作失败: ' + (err?.message || String(err)));
      setGatewayStatus('error');
    } finally {
      setActionLoading(false);
    }
  };

  const statusConfig: Record<string, { label: string; color: string; icon: string }> = {
    stopped: { label: '已停止', color: 'text-[var(--text-tertiary)]', icon: '⚪' },
    starting: { label: '启动中...', color: 'text-[var(--warning)]', icon: '🟡' },
    running: { label: '运行中', color: 'text-[var(--success)]', icon: '🟢' },
    error: { label: '异常', color: 'text-[var(--error)]', icon: '🔴' },
    checking: { label: '检查中...', color: 'text-[var(--text-tertiary)]', icon: '⏳' },
  };

  const status = statusConfig[gatewayStatus] || statusConfig.checking;
  const engineInstalled = engineStatus === 'installed';
  const isInstalling = installProgress && installProgress.phase !== 'done' && installProgress.phase !== 'error';

  const openExternal = (url: string) => {
    if (window.openclawAPI) {
      window.openclawAPI.openExternal(url);
    } else {
      window.open(url, '_blank');
    }
  };

  return (
    <div className="min-h-full flex flex-col items-center justify-start pt-8 pb-8 px-8 max-w-lg mx-auto overflow-y-auto">
      {/* Logo 和状态 */}
      <div className="text-center mb-5 animate-fade-in">
        <div className="text-5xl mb-3">🦞</div>
        <h1 className="text-xl font-bold mb-1">OpenClaw 飞书专版</h1>
        <div className={`flex items-center justify-center gap-1.5 text-sm ${status.color}`}>
          <span>{status.icon}</span>
          <span>{status.label}</span>
        </div>
      </div>

      {/* ====== 引擎未安装时的安装卡片 ====== */}
      {!engineInstalled && !isInstalling && (
        <GlassCard className="w-full mb-4 animate-slide-up border border-amber-400/30">
          <div className="text-center py-2">
            <div className="text-2xl mb-2">📦</div>
            <p className="text-sm font-semibold mb-1">需要安装 OpenClaw 引擎</p>
            <p className="text-xs text-[var(--text-secondary)] mb-3">
              首次使用需要下载 AI 引擎核心组件，使用国内镜像加速下载。
            </p>
            <GlassButton variant="primary" onClick={handleInstallEngine}>
              🚀 一键安装引擎
            </GlassButton>
            <p className="text-[10px] text-[var(--text-tertiary)] mt-2">
              需要系统已安装 Node.js (v22+)
            </p>
          </div>
        </GlassCard>
      )}

      {/* ====== 安装进度条 ====== */}
      {isInstalling && installProgress && (
        <GlassCard className="w-full mb-4 animate-slide-up">
          <div className="py-2">
            <div className="flex items-center gap-2 mb-2">
              <span className="animate-spin text-base">⏳</span>
              <span className="text-sm font-semibold">正在安装引擎</span>
            </div>
            <p className="text-xs text-[var(--text-secondary)] mb-3">{installProgress.message}</p>
            {installProgress.percent !== undefined && (
              <div className="w-full h-2 rounded-full bg-[var(--glass-bg)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-500"
                  style={{ width: `${installProgress.percent}%` }}
                />
              </div>
            )}
          </div>
        </GlassCard>
      )}

      {/* ====== 引擎已安装时的版本信息 ====== */}
      {engineInstalled && engineVersion && (
        <div className="text-center mb-2 animate-fade-in">
          <span className="text-[10px] text-[var(--text-tertiary)] bg-[var(--glass-bg)] px-2 py-0.5 rounded-full">
            引擎: {engineVersion}
          </span>
        </div>
      )}

      {/* ====== 错误详情卡片 ====== */}
      {errorMessage && (
        <GlassCard className="w-full mb-4 animate-slide-up border border-red-400/30">
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <span className="text-base mt-0.5">⚠️</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-[var(--error)] mb-1">错误详情</p>
                <pre className="text-xs text-[var(--text-secondary)] break-words leading-relaxed select-text whitespace-pre-wrap font-sans max-h-40 overflow-y-auto">
                  {errorMessage}
                </pre>
              </div>
            </div>
            <div className="pt-1">
              <p className="text-[10px] text-[var(--text-tertiary)]">
                提示：可截图此信息用于排查问题。
              </p>
            </div>
          </div>
        </GlassCard>
      )}

      {/* ====== 状态卡片 ====== */}
      <GlassCard className="w-full mb-5 animate-slide-up">
        <div className="space-y-3">
          {/* Gateway PID */}
          {gatewayPid && gatewayStatus === 'running' && (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span>⚙️</span>
                  <span className="text-sm">Gateway</span>
                </div>
                <span className="text-xs text-[var(--text-secondary)]">
                  PID: {gatewayPid}
                </span>
              </div>
              <div className="h-px bg-[var(--glass-border)]" />
            </>
          )}

          {/* 飞书连接 */}
          {(() => {
            const hasWarning = feishuConnected && feishuDetail && feishuDetail.includes('⚠️');
            const statusColor = feishuConnected
              ? (hasWarning ? 'text-[var(--warning)]' : 'text-[var(--success)]')
              : 'text-[var(--warning)]';
            const statusText = feishuConnected
              ? (hasWarning ? '⚠️ 已连接（有警告）' : '✅ 已连接')
              : '⚠️ 未连接';

            return (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span>📱</span>
                    <span className="text-sm">飞书连接</span>
                  </div>
                  <span className={`text-xs font-medium ${statusColor}`}>
                    {statusText}
                  </span>
                </div>

                {/* 已连接但有权限警告 */}
                {feishuConnected && hasWarning && (
                  <div className="bg-[rgba(255,150,0,0.06)] rounded-glass-xs p-2.5 text-xs space-y-1.5">
                    <div className="font-medium text-[var(--warning)]">飞书权限不完整</div>
                    <div className="text-[var(--text-secondary)] break-words whitespace-pre-wrap">{feishuDetail}</div>
                  </div>
                )}

                {/* 未连接的诊断 */}
                {!feishuConnected && gatewayStatus === 'running' && (
                  <div className="bg-[rgba(255,150,0,0.06)] rounded-glass-xs p-2.5 text-xs space-y-1.5">
                    <div className="font-medium text-[var(--warning)]">飞书未连接 — 诊断信息：</div>
                    {feishuDetail ? (
                      <div className="text-[var(--text-secondary)] break-words whitespace-pre-wrap">{feishuDetail}</div>
                    ) : (
                      <div className="text-[var(--text-secondary)]">
                        Gateway 正在运行，但未检测到飞书 channel 连接。正在通过多种方式检测...
                      </div>
                    )}
                    {healthCheckDetail && (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-[var(--accent)] hover:underline text-[11px]">
                          查看详细诊断数据
                        </summary>
                        <pre className="mt-1 text-[10px] text-[var(--text-tertiary)] whitespace-pre-wrap break-words max-h-40 overflow-y-auto bg-[rgba(0,0,0,0.03)] dark:bg-[rgba(255,255,255,0.03)] rounded-glass-xs p-2 select-text font-mono">
                          {healthCheckDetail}
                        </pre>
                      </details>
                    )}
                    <div className="text-[var(--text-tertiary)] mt-1 leading-relaxed">
                      <div className="font-medium mb-0.5">排查建议：</div>
                      1. 确认飞书开放平台已填写 Verification Token<br/>
                      2. 确认应用已发布（版本管理 → 创建版本 → 提交）<br/>
                      3. 确认事件订阅 → 选择"使用长连接接收事件" → 添加 im.message.receive_v1<br/>
                      4. 确认已添加"机器人"能力
                    </div>
                  </div>
                )}

                {/* 已连接无警告 — 简短显示 */}
                {feishuConnected && !hasWarning && feishuDetail && (
                  <div className="text-[10px] text-[var(--text-tertiary)] px-1">
                    {feishuDetail.slice(0, 120)}
                  </div>
                )}
              </>
            );
          })()}

          <div className="h-px bg-[var(--glass-border)]" />

          {/* AI 模型 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span>🤖</span>
              <span className="text-sm">AI 模型</span>
            </div>
            <span className="text-xs text-[var(--text-secondary)]">
              {modelName || '未配置'}
            </span>
          </div>
        </div>
      </GlassCard>

      {/* ====== 日志面板 ====== */}
      <div className="w-full mb-4">
        <button
          onClick={async () => {
            if (!showLogs) {
              // 打开日志时刷新
              if (window.openclawAPI?.getGatewayLogs) {
                const freshLogs = await window.openclawAPI.getGatewayLogs(80);
                setLogs(freshLogs);
              }
            }
            setShowLogs(!showLogs);
          }}
          className="
            no-drag w-full flex items-center justify-center gap-1.5
            p-2 rounded-glass-sm text-xs
            text-[var(--accent)] hover:bg-[rgba(0,122,255,0.05)]
            transition-colors
          "
        >
          <span>{showLogs ? '🔽' : '📋'}</span>
          <span>{showLogs ? '收起日志' : '查看 Gateway 日志'}</span>
          {logs.length > 0 && !showLogs && (
            <span className="text-[10px] text-[var(--text-tertiary)]">({logs.length} 条)</span>
          )}
        </button>

        {showLogs && (
          <GlassCard className="mt-2 animate-slide-up">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold">Gateway 运行日志</span>
              <button
                onClick={async () => {
                  if (window.openclawAPI?.getGatewayLogs) {
                    const freshLogs = await window.openclawAPI.getGatewayLogs(80);
                    setLogs(freshLogs);
                  }
                }}
                className="no-drag text-[10px] text-[var(--accent)] hover:underline"
              >
                刷新
              </button>
            </div>
            {logs.length === 0 ? (
              <div className="text-xs text-[var(--text-tertiary)] text-center py-4">
                暂无日志。请先启动 Gateway。
              </div>
            ) : (
              <pre className="text-[10px] text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap break-words max-h-60 overflow-y-auto select-text font-mono bg-[rgba(0,0,0,0.03)] dark:bg-[rgba(255,255,255,0.03)] rounded-glass-xs p-2">
                {logs.join('\n')}
              </pre>
            )}
          </GlassCard>
        )}
      </div>

      {/* WebChat 嵌入提示（当 Gateway 运行时） */}
      {gatewayStatus === 'running' && (
        <GlassCard className="w-full mb-5 animate-slide-up">
          <div className="text-center py-4">
            <p className="text-sm text-[var(--text-secondary)] mb-3">
              在飞书中搜索你的机器人名称即可开始对话
            </p>
            <GlassButton
              variant="secondary"
              size="sm"
              onClick={() => openExternal(`http://127.0.0.1:18789`)}
            >
              💬 打开 Web 对话界面
            </GlassButton>
          </div>
        </GlassCard>
      )}

      {/* 快捷操作 */}
      <div className="w-full grid grid-cols-3 gap-3 animate-slide-up">
        <GlassCard hover padding="sm" onClick={onGoToSettings}>
          <div className="text-center py-2">
            <div className="text-lg mb-1">⚙️</div>
            <div className="text-xs">设置</div>
          </div>
        </GlassCard>

        <GlassCard
          hover
          padding="sm"
          onClick={actionLoading || !engineInstalled ? undefined : handleStartOrRestart}
        >
          <div className="text-center py-2">
            <div className="text-lg mb-1">
              {actionLoading ? '⏳' : !engineInstalled ? '📦' : '🔄'}
            </div>
            <div className="text-xs">
              {actionLoading
                ? '请稍候...'
                : !engineInstalled
                  ? '需先安装'
                  : gatewayStatus === 'running'
                    ? '重启'
                    : '启动'}
            </div>
          </div>
        </GlassCard>

        <GlassCard hover padding="sm" onClick={onRerunWizard}>
          <div className="text-center py-2">
            <div className="text-lg mb-1">🔧</div>
            <div className="text-xs">重新配置</div>
          </div>
        </GlassCard>
      </div>

      {/* 版本信息 */}
      <p className="mt-6 text-[10px] text-[var(--text-tertiary)]">
        OpenClaw 飞书专版 v1.0.0 · 基于 OpenClaw 开源项目
      </p>
    </div>
  );
}
