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
        className={`${sizeClasses[size]} rounded-full animate-spin`}
        style={{
          borderWidth: '2px',
          borderStyle: 'solid',
          borderColor: '#4a4040',
          borderTopColor: '#ffde59'
        }}
      />
      {message && <p className="text-sm" style={{ color: '#ccba9d' }}>{message}</p>}
    </div>
  );
}
