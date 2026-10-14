import React from 'react';
import { clsx } from 'clsx';

export type BadgeVariant =
  | 'default'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral'
  | 'amber';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'md',
  className,
}) => {
  const variantStyles: Record<BadgeVariant, string> = {
    default: 'bg-surface-100 text-surface-700 border-surface-200',
    neutral: 'bg-surface-100 text-surface-600 border-surface-200',
    amber: 'bg-amber-50 text-amber-800 border-amber-300',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    danger: 'bg-rose-50 text-rose-700 border-rose-200',
    info: 'bg-sky-50 text-sky-700 border-sky-200',
  };

  const sizeStyles = {
    sm: 'px-1.5 py-0.5 text-[11px] leading-tight font-medium',
    md: 'px-2 py-0.5 text-xs font-medium',
  };

  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-md border tracking-wide uppercase font-mono',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
    >
      {children}
    </span>
  );
};
