interface EmptyStateProps {
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * Empty state placeholder for when there's no content.
 */
export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <div
        className="w-16 h-16 mb-4 rounded-full flex items-center justify-center"
        style={{ backgroundColor: '#4a4040' }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-8 w-8"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          style={{ color: '#ccba9d' }}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      </div>
      <h3
        className="text-lg font-medium mb-1"
        style={{
          color: '#ffffff',
          fontFamily: "'Oswald', Arial, sans-serif",
          textTransform: 'uppercase'
        }}
      >
        {title}
      </h3>
      {description && (
        <p className="text-sm mb-4 max-w-xs" style={{ color: '#ccba9d' }}>{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="px-4 py-2 rounded-lg transition-all"
          style={{
            backgroundColor: '#ffde59',
            color: '#342d2d',
            fontFamily: "'Bebas Neue', Arial, sans-serif",
            fontSize: '1rem',
            letterSpacing: '0.5px'
          }}
          onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(1.1)'}
          onMouseLeave={(e) => e.currentTarget.style.filter = 'brightness(1)'}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
