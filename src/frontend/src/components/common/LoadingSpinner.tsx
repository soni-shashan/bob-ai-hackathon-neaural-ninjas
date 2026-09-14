import React from 'react';
import { Loader2, AlertTriangle, RefreshCw } from 'lucide-react';

export const LoadingSpinner: React.FC<{ message?: string; height?: string }> = ({
  message = 'Retrieving grid telemetry...',
  height = 'h-64'
}) => {
  return (
    <div className={`flex flex-col items-center justify-center ${height} text-slate-400 gap-3`}>
      <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
      <span className="text-xs uppercase tracking-wider font-mono text-slate-400">{message}</span>
    </div>
  );
};

export const ErrorMessage: React.FC<{
  title?: string;
  message?: string;
  onRetry?: () => void;
}> = ({
  title = 'Grid Telemetry Link Interrupted',
  message = 'Unable to connect to the backend server. Verify service is running.',
  onRetry
}) => {
  return (
    <div className="p-6 rounded-lg bg-red-950/20 border border-red-800/60 text-center max-w-lg mx-auto my-8">
      <div className="w-12 h-12 rounded-full bg-red-950/80 border border-red-700 flex items-center justify-center mx-auto mb-4 text-red-400">
        <AlertTriangle className="w-6 h-6" />
      </div>
      <h3 className="text-base font-semibold text-red-300 mb-1">{title}</h3>
      <p className="text-xs text-slate-400 mb-4">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-md bg-red-900/60 hover:bg-red-800/80 border border-red-700 text-xs font-mono font-medium text-white transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Reconnect
        </button>
      )}
    </div>
  );
};
