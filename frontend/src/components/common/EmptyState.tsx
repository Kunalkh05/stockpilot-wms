import React from 'react';
import { LucideIcon } from 'lucide-react';
import { Button } from './Button.js';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-lg border border-dashed border-surface-300">
      <div className="w-12 h-12 rounded-full bg-surface-100 flex items-center justify-center text-surface-500 mb-4">
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-sm font-semibold text-surface-900">{title}</h3>
      <p className="text-xs text-surface-500 max-w-sm mt-1 mb-5">{description}</p>
      {actionLabel && onAction && (
        <Button variant="primary" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
};
