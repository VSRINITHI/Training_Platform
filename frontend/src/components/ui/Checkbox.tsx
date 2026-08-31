import React from 'react';
import { cn } from '../../utils/cn';

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: React.ReactNode;
  description?: string;
  error?: string;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, description, error, id, ...props }, ref) => {
    const checkboxId = id || (typeof label === 'string' ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="flex items-start space-x-2.5">
        <input
          ref={ref}
          id={checkboxId}
          type="checkbox"
          className={cn(
            'h-4 w-4 rounded border-border text-primary focus:ring-primary focus:ring-offset-0 transition-colors mt-0.5 cursor-pointer',
            className
          )}
          {...props}
        />
        {(label || description) && (
          <div className="text-sm">
            {label && (
              <label htmlFor={checkboxId} className="font-medium text-charcoal cursor-pointer select-none">
                {label}
              </label>
            )}
            {description && <p className="text-xs text-charcoal-muted mt-0.5">{description}</p>}
            {error && <p className="text-xs text-danger font-medium mt-0.5">{error}</p>}
          </div>
        )}
      </div>
    );
  }
);

Checkbox.displayName = 'Checkbox';
