import React from 'react';

interface GlassButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  icon?: React.ReactNode;
}

export default function GlassButton({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  className = '',
  icon,
}: GlassButtonProps) {
  const variants = {
    primary: `
      bg-gradient-to-r from-blue-500 to-indigo-500
      text-white font-semibold
      shadow-lg shadow-blue-500/20
      hover:shadow-xl hover:shadow-blue-500/30
      hover:from-blue-600 hover:to-indigo-600
      active:scale-[0.98]
    `,
    secondary: `
      glass text-[var(--text-primary)] font-medium
      hover:bg-[var(--glass-bg-hover)]
      active:scale-[0.98]
    `,
    ghost: `
      bg-transparent text-[var(--accent)]
      hover:bg-[rgba(0,122,255,0.08)]
      active:scale-[0.98]
    `,
    danger: `
      bg-gradient-to-r from-red-500 to-red-600
      text-white font-semibold
      shadow-lg shadow-red-500/20
      hover:shadow-xl hover:shadow-red-500/30
      active:scale-[0.98]
    `,
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs rounded-glass-xs',
    md: 'px-5 py-2.5 text-sm rounded-glass-sm',
    lg: 'px-8 py-3.5 text-base rounded-glass-sm',
  };

  return (
    <button
      className={`
        no-drag inline-flex items-center justify-center gap-2
        transition-all duration-200 ease-out
        ${variants[variant]}
        ${sizes[size]}
        ${disabled || loading ? 'opacity-50 cursor-not-allowed' : ''}
        ${className}
      `}
      onClick={onClick}
      disabled={disabled || loading}
    >
      {loading ? (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
          <circle
            className="opacity-25"
            cx="12" cy="12" r="10"
            stroke="currentColor"
            strokeWidth="3"
            fill="none"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      ) : icon ? (
        <span className="text-base">{icon}</span>
      ) : null}
      {children}
    </button>
  );
}
