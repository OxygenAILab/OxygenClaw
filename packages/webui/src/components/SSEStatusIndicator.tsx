import React from 'react';

interface SSEStatusIndicatorProps {
  isConnected: boolean;
  isReconnecting?: boolean;
  error?: Error | null;
  className?: string;
}

export const SSEStatusIndicator: React.FC<SSEStatusIndicatorProps> = ({
  isConnected,
  isReconnecting = false,
  error = null,
  className = '',
}) => {
  if (!isConnected && !isReconnecting && !error) {
    return null;
  }

  return (
    <div className={`flex items-center gap-2 text-xs ${className}`}>
      {isConnected && !isReconnecting && (
        <>
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-[#5C635D]">实时连接中</span>
        </>
      )}

      {isReconnecting && (
        <>
          <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
          <span className="text-[#5C635D]">重新连接中...</span>
        </>
      )}

      {error && !isReconnecting && (
        <>
          <div className="w-2 h-2 bg-red-500 rounded-full"></div>
          <span className="text-red-600">连接失败</span>
        </>
      )}
    </div>
  );
};

interface ConnectionStatusBadgeProps {
  status: 'connected' | 'disconnected' | 'reconnecting' | 'error';
  className?: string;
}

export const ConnectionStatusBadge: React.FC<ConnectionStatusBadgeProps> = ({
  status,
  className = '',
}) => {
  const statusConfig = {
    connected: {
      color: 'bg-green-100 text-green-700 border-green-200',
      icon: (
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      ),
      label: '已连接',
    },
    disconnected: {
      color: 'bg-gray-100 text-gray-600 border-gray-200',
      icon: (
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
        </svg>
      ),
      label: '未连接',
    },
    reconnecting: {
      color: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      icon: (
        <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      ),
      label: '重连中',
    },
    error: {
      color: 'bg-red-100 text-red-700 border-red-200',
      icon: (
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
        </svg>
      ),
      label: '错误',
    },
  };

  const config = statusConfig[status];

  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full border text-xs ${config.color} ${className}`}>
      {config.icon}
      <span>{config.label}</span>
    </div>
  );
};
