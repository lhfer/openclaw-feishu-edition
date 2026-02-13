import React from 'react';
import GlassCard from '../../components/GlassCard';
import GlassButton from '../../components/GlassButton';

interface WelcomeProps {
  onNext: () => void;
}

export default function Welcome({ onNext }: WelcomeProps) {
  const features = [
    {
      icon: '💬',
      title: '飞书对话',
      desc: '在飞书中直接与 AI 助手对话，个人私聊或群聊皆可',
    },
    {
      icon: '🧠',
      title: '智能处理',
      desc: '文件处理、信息整理、内容创作，强大的 AI 能力随叫随到',
    },
    {
      icon: '🔄',
      title: '多模型切换',
      desc: '支持 MiniMax、GLM、豆包等国产大模型，自由切换',
    },
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full max-w-lg mx-auto text-center">
      {/* Logo 和标题 */}
      <div className="mb-8 animate-slide-up">
        <div className="text-6xl mb-4">🦞</div>
        <h1 className="text-2xl font-bold tracking-tight mb-2">
          OpenClaw 飞书专版
        </h1>
        <p className="text-[var(--text-secondary)] text-sm leading-relaxed">
          将 AI 助手接入你的飞书，3 分钟完成配置
        </p>
      </div>

      {/* 功能卡片 */}
      <div className="grid grid-cols-3 gap-3 w-full mb-10">
        {features.map((f, i) => (
          <GlassCard
            key={f.title}
            padding="sm"
            className="animate-slide-up"
          >
            <div className="text-center py-2">
              <div className="text-2xl mb-2">{f.icon}</div>
              <div className="text-xs font-semibold mb-1">{f.title}</div>
              <div className="text-[10px] text-[var(--text-tertiary)] leading-relaxed">
                {f.desc}
              </div>
            </div>
          </GlassCard>
        ))}
      </div>

      {/* 开始按钮 */}
      <GlassButton size="lg" onClick={onNext} className="animate-fade-in min-w-[200px]">
        开始配置
      </GlassButton>

      <p className="mt-4 text-[10px] text-[var(--text-tertiary)]">
        基于 OpenClaw 开源项目 · 数据全部存储在本机
      </p>
    </div>
  );
}
