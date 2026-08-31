import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '../ui/Button';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an unhandled rendering error:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[50vh] flex flex-col items-center justify-center p-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-7 h-7" />
          </div>

          <div className="max-w-md space-y-1">
            <h2 className="text-lg font-bold text-charcoal">
              {this.props.fallbackTitle || 'Something went wrong rendering this view'}
            </h2>
            <p className="text-xs text-charcoal-muted">
              {this.state.error?.message ||
                this.props.fallbackMessage ||
                'An unexpected error occurred while displaying this page.'}
            </p>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Button size="sm" variant="outline" onClick={this.handleReload} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>
              Refresh Page
            </Button>
            <Button size="sm" onClick={this.handleGoHome} leftIcon={<Home className="w-3.5 h-3.5" />}>
              Go to Home
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
