import React from 'react';
import { cn } from '../../utils/cn';

export interface RadioProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: React.ReactNode;
  description?: string;
}

export const Radio = React.forwardRef<HTMLInputElement, RadioProps>(
  ({ className, label, description, id, ...props }, ref) => {
    const radioId = id || (typeof label === 'string' ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="flex items-start space-x-2.5">
        <input
          ref={ref}
          id={radioId}
          type="radio"
          className={cn(
            'h-4 w-4 border-border text-primary focus:ring-primary focus:ring-offset-0 transition-colors mt-0.5 cursor-pointer',
            className
          )}
          {...props}
        />
        {(label || description) && (
          <div className="text-sm">
            {label && (
              <label htmlFor={radioId} className="font-medium text-charcoal cursor-pointer select-none">
                {label}
              </label>
            )}
            {description && <p className="text-xs text-charcoal-muted mt-0.5">{description}</p>}
          </div>
        )}
      </div>
    );
  }
);

Radio.displayName = 'Radio';
