import React from 'react';
import { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon: LucideIcon;
  to?: string;
  variant?: 'default' | 'amber' | 'danger' | 'success';
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  subtext,
  icon: Icon,
  to,
  variant = 'default',
}) => {
  const content = (
    <div className="p-4 bg-white rounded-lg border border-surface-200 hover:border-surface-300 shadow-sm transition-all hover:shadow">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-surface-500 uppercase tracking-wider">{label}</span>
        <div className="p-1.5 rounded-md bg-surface-100 text-surface-600">
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="text-2xl font-bold font-mono tracking-tight text-surface-900">{value}</div>
      {subtext && <div className="text-xs text-surface-500 mt-1">{subtext}</div>}
    </div>
  );

  if (to) {
    return <Link to={to} className="block group">{content}</Link>;
  }

  return content;
};
