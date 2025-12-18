import { useSocketConnection } from '../../hooks/useSocket';

interface HeaderProps {
  title?: string;
  onBack?: () => void;
  showBack?: boolean;
}

/**
 * Application header with navigation and connection status.
 */
export function Header({ title = 'FliDeck', onBack, showBack }: HeaderProps) {
  const isConnected = useSocketConnection();

  return (
    <header className="bg-slate-800 border-b border-slate-700 px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        {showBack && onBack && (
          <button
            onClick={onBack}
            className="p-2 rounded-lg hover:bg-slate-700 transition-colors"
            aria-label="Go back"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}
        <h1 className="text-xl font-semibold text-white">{title}</h1>
      </div>

      <div className="flex items-center gap-2">
        <span
          className={`w-2 h-2 rounded-full ${
            isConnected ? 'bg-green-500' : 'bg-red-500'
          }`}
          title={isConnected ? 'Connected' : 'Disconnected'}
        />
        <span className="text-sm text-slate-400">
          {isConnected ? 'Live' : 'Offline'}
        </span>
      </div>
    </header>
  );
}
