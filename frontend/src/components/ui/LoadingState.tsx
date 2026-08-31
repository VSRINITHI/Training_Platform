import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../utils/cn';

interface LoadingStateProps {
  message?: string;
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading data...',
  className,
}) => {
  return (
    <div className={cn('flex flex-col items-center justify-center py-12 px-4 text-center', className)}>
      <Loader2 className="w-8 h-8 text-primary animate-spin mb-3" />
      <p className="text-sm font-medium text-charcoal-muted">{message}</p>
    </div>
  );
};
