import React, { useState, useCallback } from 'react';
import StepIndicator from '../../components/StepIndicator';
import Welcome from './Welcome';
import FeishuSetup from './FeishuSetup';
import FeishuVerify from './FeishuVerify';
import ModelSetup from './ModelSetup';
import Complete from './Complete';

interface WizardFlowProps {
  onComplete: () => void;
}

const STEPS = [
  { id: 'welcome', label: '欢迎' },
  { id: 'feishu', label: '飞书配置' },
  { id: 'verify', label: '连接校验' },
  { id: 'model', label: '模型配置' },
  { id: 'complete', label: '完成' },
];

export interface WizardData {
  feishuAppId: string;
  feishuAppSecret: string;
  feishuVerificationToken: string;
  feishuEncryptKey: string;
  feishuBotName: string;
  modelProvider: string;
  modelApiKey: string;
  modelBaseUrl: string;
  modelId: string;
}

export default function WizardFlow({ onComplete }: WizardFlowProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [wizardData, setWizardData] = useState<WizardData>({
    feishuAppId: '',
    feishuAppSecret: '',
    feishuVerificationToken: '',
    feishuEncryptKey: '',
    feishuBotName: '我的AI助手',
    modelProvider: '',
    modelApiKey: '',
    modelBaseUrl: '',
    modelId: '',
  });
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');

  const goNext = useCallback(() => {
    setDirection('forward');
    setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1));
  }, []);

  const goBack = useCallback(() => {
    setDirection('backward');
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  }, []);

  const updateData = useCallback((partial: Partial<WizardData>) => {
    setWizardData((prev) => ({ ...prev, ...partial }));
  }, []);

  const handleComplete = async () => {
    // 保存所有配置
    if (window.openclawAPI) {
      const config = await window.openclawAPI.getConfig();
      // 如果用户填了自定义 Base URL，更新到 providers 里
      const updatedProviders = { ...config.providers };
      if (wizardData.modelProvider && wizardData.modelApiKey) {
        if (!updatedProviders[wizardData.modelProvider]) {
          updatedProviders[wizardData.modelProvider] = {
            baseUrl: '',
            apiKey: '',
            api: 'openai-completions',
            models: [],
          };
        }
        updatedProviders[wizardData.modelProvider] = {
          ...updatedProviders[wizardData.modelProvider],
          apiKey: wizardData.modelApiKey,
          ...(wizardData.modelBaseUrl ? { baseUrl: wizardData.modelBaseUrl } : {}),
        };
      }

      await window.openclawAPI.saveConfig({
        ...config,
        feishu: {
          ...config.feishu,
          appId: wizardData.feishuAppId,
          appSecret: wizardData.feishuAppSecret,
          verificationToken: wizardData.feishuVerificationToken,
          encryptKey: wizardData.feishuEncryptKey,
          botName: wizardData.feishuBotName,
        },
        model: {
          primary: wizardData.modelId
            ? `${wizardData.modelProvider}/${wizardData.modelId}`
            : '',
          provider: wizardData.modelProvider,
          fallbacks: [],
        },
        providers: updatedProviders,
        setupCompleted: true,
      });

      // 启动 Gateway
      await window.openclawAPI.startGateway();
    }

    onComplete();
  };

  const animClass = direction === 'forward' ? 'animate-slide-left' : 'animate-slide-right';

  return (
    <div className="h-full flex flex-col px-8 py-4">
      {/* 步骤指示器 */}
      {currentStep > 0 && currentStep < STEPS.length - 1 && (
        <StepIndicator steps={STEPS} currentStep={currentStep} className="mb-6" />
      )}

      {/* 页面内容 */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden" key={currentStep}>
        <div className={animClass}>
          {currentStep === 0 && (
            <Welcome onNext={goNext} />
          )}

          {currentStep === 1 && (
            <FeishuSetup
              data={wizardData}
              onUpdate={updateData}
              onNext={goNext}
              onBack={goBack}
            />
          )}

          {currentStep === 2 && (
            <FeishuVerify
              appId={wizardData.feishuAppId}
              appSecret={wizardData.feishuAppSecret}
              onNext={goNext}
              onBack={goBack}
            />
          )}

          {currentStep === 3 && (
            <ModelSetup
              data={wizardData}
              onUpdate={updateData}
              onNext={goNext}
              onBack={goBack}
            />
          )}

          {currentStep === 4 && (
            <Complete
              data={wizardData}
              onComplete={handleComplete}
            />
          )}
        </div>
      </div>
    </div>
  );
}
