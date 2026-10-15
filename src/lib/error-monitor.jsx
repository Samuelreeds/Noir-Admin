import React from 'react';
import { supabase } from './supabase';

/**
 * Captures an error and transmits it to the Supabase Edge Function
 */
export const captureError = async (error, customContext = {}) => {
  try {
    const payload = {
      error_type: customContext.type || 'client_exception',
      error_name: error?.name || 'Error',
      message: error?.message || String(error),
      stack_trace: error?.stack || '',
      severity: customContext.severity || 'error',
      environment: import.meta.env.MODE || 'production',
      route: window.location.pathname,
      user_id: customContext.user_id || null,
      metadata: customContext.metadata || {}
    };

    // Fire and forget to the Edge Function (does not block the UI)
    await supabase.functions.invoke('log-client-error', {
      body: payload
    });
  } catch (loggingError) {
    // Failsafe: If the logging system itself fails, log to standard console
    console.error('Failed to capture error to monitoring system:', loggingError);
  }
};

/**
 * Initializes global window listeners for unhandled exceptions
 */
export const initGlobalErrorMonitor = () => {
  if (typeof window === 'undefined') return;

  window.onerror = (message, source, lineno, colno, error) => {
    captureError(error || new Error(String(message)), { type: 'window_onerror' });
    return false; // Let default browser handling proceed
  };

  window.addEventListener('unhandledrejection', (event) => {
    captureError(event.reason || new Error('Unhandled Promise Rejection'), { type: 'unhandled_rejection' });
  });
};

/**
 * React Error Boundary to catch render-phase component crashes
 */
export class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    captureError(error, { 
      type: 'react_render_error', 
      severity: 'critical',
      metadata: { componentStack: errorInfo.componentStack }
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8F9FA] text-slate-900 p-6 font-sans">
          <div className="max-w-md w-full border border-slate-200 p-8 text-center bg-white shadow-sm">
            <div className="w-12 h-12 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
                <path d="M12 9v4"></path>
                <path d="M12 17h.01"></path>
              </svg>
            </div>
            <h2 className="text-xl font-bold uppercase tracking-tight mb-2">Something went wrong</h2>
            <p className="text-sm text-slate-500 mb-8">
              A critical system error was encountered. Our monitoring team has been automatically notified.
            </p>
            <button 
              onClick={() => window.location.reload()} 
              className="w-full bg-slate-900 text-white px-6 py-3 text-sm font-semibold uppercase tracking-wider hover:bg-slate-800 transition-colors"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}