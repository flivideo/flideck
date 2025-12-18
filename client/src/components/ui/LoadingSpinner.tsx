interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  message?: string;
}

/**
 * Loading spinner with optional message.
 */
export function LoadingSpinner({ size = 'md', message }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <div
        className={`${sizeClasses[size]} border-2 border-slate-600 border-t-blue-500 rounded-full animate-spin`}
      />
      {message && <p className="text-sm text-slate-400">{message}</p>}
    </div>
  );
}
