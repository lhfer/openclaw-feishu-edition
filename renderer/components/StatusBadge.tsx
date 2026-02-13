import React from 'react';

type BadgeStatus = 'pending' | 'checking' | 'success' | 'warning' | 'error';

interface StatusBadgeProps {
  status: BadgeStatus;
  label: string;
  message?: string;
  detail?: string;
  action?: {
    label: string;
    url?: string;
    type?: 'link' | 'retry';
    onClick?: () => void;
  };
  className?: string;
}

export default function StatusBadge({
  status,
  label,
  message,
  detail,
  action,
  className = '',
}: StatusBadgeProps) {
  const [expanded, setExpanded] = React.useState(false);

  const statusConfig: Record<BadgeStatus, { icon: string; color: string; bg: string }> = {
    pending: { icon: '○', color: 'text-[var(--text-tertiary)]', bg: '' },
    checking: { icon: '⏳', color: 'text-[var(--warning)]', bg: 'step-checking' },
    success: { icon: '✅', color: 'text-[var(--success)]', bg: '' },
    warning: { icon: '⚠️', color: 'text-[var(--warning)]', bg: '' },
    error: { icon: '❌', color: 'text-[var(--error)]', bg: '' },
  };

  const config = statusConfig[status];

  const handleActionClick = () => {
    if (action?.onClick) {
      action.onClick();
    } else if (action?.url && window.openclawAPI) {
      window.openclawAPI.openExternal(action.url);
    } else if (action?.url) {
      window.open(action.url, '_blank');
    }
  };

  return (
    <div
      className={`
        no-drag rounded-glass-sm p-3 transition-all duration-300
        ${config.bg}
        ${status === 'checking' ? 'glass' : ''}
        ${(detail || action) && status !== 'pending' && status !== 'checking'
          ? 'cursor-pointer hover:bg-[rgba(0,0,0,0.02)] dark:hover:bg-[rgba(255,255,255,0.02)]'
          : ''
        }
        ${className}
      `}
      onClick={() => {
        if (detail || action) setExpanded(!expanded);
      }}
    >
      {/* 主行 */}
      <div className="flex items-center gap-3">
        <span className={`text-lg ${status === 'success' ? 'animate-check-bounce' : ''}`}>
          {config.icon}
        </span>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium">{label}</span>
          {message && (
            <span className={`text-xs ml-2 ${config.color}`}>{message}</span>
          )}
        </div>
        {(detail || action) && status !== 'pending' && status !== 'checking' && (
          <svg
            width="12" height="12" viewBox="0 0 24 24" fill="none"
            stroke="var(--text-tertiary)" strokeWidth="2"
            className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        )}
      </div>

      {/* 展开详情 */}
      {expanded && (detail || action) && (
        <div className="mt-3 pl-9 space-y-2 animate-fade-in">
          {detail && (
            <p className="text-xs text-[var(--text-secondary)] whitespace-pre-line leading-relaxed">
              {detail}
            </p>
          )}
          {action && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleActionClick();
              }}
              className="
                inline-flex items-center gap-1.5 text-xs font-medium
                text-[var(--accent)] hover:text-blue-600
                transition-colors
              "
            >
              {action.type === 'link' ? '🔗' : '🔄'} {action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
