import React, { useState, useEffect } from 'react';
import WizardFlow from './pages/wizard/WizardFlow';
import SettingsView from './pages/settings/SettingsView';
import ChatView from './pages/chat/ChatView';

type AppView = 'loading' | 'wizard' | 'main' | 'settings';

export default function App() {
  const [view, setView] = useState<AppView>('loading');

  useEffect(() => {
    checkSetupStatus();
  }, []);

  const checkSetupStatus = async () => {
    try {
      if (window.openclawAPI) {
        const configured = await window.openclawAPI.isConfigured();
        console.log('[App] isConfigured =', configured);
        setView(configured ? 'main' : 'wizard');
      } else {
        // Electron preload 未加载，或开发模式 → 进向导
        console.log('[App] openclawAPI not found, entering wizard');
        setView('wizard');
      }
    } catch (err) {
      console.error('[App] checkSetupStatus error:', err);
      setView('wizard');
    }
  };

  const handleWizardComplete = () => {
    setView('main');
  };

  const handleGoToSettings = () => {
    setView('settings');
  };

  const handleBackToMain = () => {
    setView('main');
  };

  const handleRerunWizard = () => {
    setView('wizard');
  };

  if (view === 'loading') {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-pulse-soft text-2xl">🦞</div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-transparent">
      {/* macOS 标题栏拖拽区域 — 仅这 48px 高的条可拖拽窗口 */}
      <div className="h-12 flex-shrink-0 titlebar-drag" />

      {/* 主内容区域 — 全部可交互，支持滚动 */}
      <div className="h-[calc(100vh-48px)] overflow-y-auto">
        {view === 'wizard' && (
          <WizardFlow onComplete={handleWizardComplete} />
        )}

        {view === 'main' && (
          <ChatView
            onGoToSettings={handleGoToSettings}
            onRerunWizard={handleRerunWizard}
          />
        )}

        {view === 'settings' && (
          <SettingsView onBack={handleBackToMain} />
        )}
      </div>
    </div>
  );
}
