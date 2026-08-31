import React from 'react';
import { Inbox } from 'lucide-react';
import { Button } from './Button';
import { cn } from '../../utils/cn';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = <Inbox className="w-10 h-10 text-slate-400" />,
  title,
  description,
  actionLabel,
  onAction,
  className,
}) => {
  return (
    <div className={cn('flex flex-col items-center justify-center p-8 text-center rounded-xl border border-dashed border-border bg-white', className)}>
      <div className="p-3 bg-slate-50 rounded-full mb-3 text-slate-500">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-charcoal">{title}</h3>
      {description && <p className="text-xs text-charcoal-muted max-w-sm mt-1 mb-4">{description}</p>}
      {actionLabel && onAction && (
        <Button size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
};
