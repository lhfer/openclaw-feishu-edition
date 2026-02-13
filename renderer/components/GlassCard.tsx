import React from 'react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  onClick?: () => void;
}

export default function GlassCard({
  children,
  className = '',
  hover = false,
  padding = 'md',
  onClick,
}: GlassCardProps) {
  const paddings = {
    none: '',
    sm: 'p-3',
    md: 'p-5',
    lg: 'p-8',
  };

  return (
    <div
      className={`
        glass rounded-glass ${paddings[padding]}
        ${hover ? 'glass-hover cursor-pointer' : ''}
        ${onClick ? 'cursor-pointer' : ''}
        transition-all duration-200
        ${className}
      `}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
