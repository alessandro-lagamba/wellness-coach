/**
 * Connection Status Badge - Real-time Backend Connection
 */

'use client';

interface ConnectionStatusProps {
  isConnected: boolean | null;
}

export function ConnectionStatus({ isConnected }: ConnectionStatusProps) {
  const statusText = isConnected === null
    ? 'Checking...'
    : isConnected
      ? 'Connected'
      : 'Offline';

  const baseClasses = isConnected === null
    ? 'bg-yellow-500/10 text-yellow-300 border border-yellow-500/30'
    : isConnected
      ? 'bg-green-500/20 text-green-400 border border-green-500/30'
      : 'bg-red-500/20 text-red-400 border border-red-500/30';

  const dotClasses = isConnected === null
    ? 'bg-yellow-300 animate-pulse'
    : isConnected
      ? 'bg-green-400 animate-pulse'
      : 'bg-red-400';

  return (
    <div className={`
      flex items-center space-x-2 px-3 py-1.5 rounded-full text-sm font-medium
      ${baseClasses}
    `}>
      <div className={`
        w-2 h-2 rounded-full
        ${dotClasses}
      `} />
      <span>{statusText}</span>
    </div>
  );
}
