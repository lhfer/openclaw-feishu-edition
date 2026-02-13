import React from 'react';

interface Step {
  id: string;
  label: string;
}

interface StepIndicatorProps {
  steps: Step[];
  currentStep: number;
  className?: string;
}

export default function StepIndicator({ steps, currentStep, className = '' }: StepIndicatorProps) {
  return (
    <div className={`flex items-center justify-center gap-2 ${className}`}>
      {steps.map((step, index) => {
        const isActive = index === currentStep;
        const isCompleted = index < currentStep;

        return (
          <React.Fragment key={step.id}>
            {/* 步骤圆点 */}
            <div className="flex flex-col items-center gap-1">
              <div
                className={`
                  w-8 h-8 rounded-full flex items-center justify-center
                  transition-all duration-500 ease-out
                  ${isCompleted
                    ? 'bg-[var(--success)] text-white scale-100'
                    : isActive
                    ? 'bg-[var(--accent)] text-white scale-110 shadow-lg shadow-blue-500/30'
                    : 'glass text-[var(--text-tertiary)]'
                  }
                `}
              >
                {isCompleted ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <span className="text-xs font-semibold">{index + 1}</span>
                )}
              </div>
              <span
                className={`
                  text-[10px] whitespace-nowrap
                  transition-colors duration-300
                  ${isActive ? 'text-[var(--accent)] font-medium' : 'text-[var(--text-tertiary)]'}
                `}
              >
                {step.label}
              </span>
            </div>

            {/* 连接线 */}
            {index < steps.length - 1 && (
              <div className="flex-1 max-w-[40px] h-[2px] mx-1 mt-[-16px] rounded-full overflow-hidden bg-[var(--glass-border)]">
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{
                    width: isCompleted ? '100%' : '0%',
                    background: 'var(--accent)',
                  }}
                />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
