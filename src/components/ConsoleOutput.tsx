import React, { useRef, useEffect } from 'react';

interface ConsoleOutputProps {
  logs: string[];
  processingStatus: string | null;
  error: string | null;
  className?: string;
}

const ConsoleOutput: React.FC<ConsoleOutputProps> = ({ 
  logs, 
  processingStatus,
  error,
  className = '' 
}) => {
  const consoleRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when logs update
  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className={className}>
      <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--primary-text)' }}>Console Output</h2>
      {/* Processing status indicator */}
      {processingStatus && (
        <div 
          className="mb-4 p-3 rounded-lg flex items-center"
          style={{ 
            backgroundColor: 'rgba(59, 130, 246, 0.1)', 
            borderColor: 'var(--accent-color)',
            border: '1px solid'
          }}
        >
          <div className="animate-spin mr-2">⟳</div>
          <span style={{ color: 'var(--accent-color)' }}>{processingStatus}</span>
        </div>
      )}
      
      {/* Error message */}
      {error && (
        <div 
          className="mb-4 p-3 rounded-lg"
          style={{ 
            backgroundColor: 'rgba(239, 68, 68, 0.1)', 
            borderColor: 'var(--error-color)',
            border: '1px solid'
          }}
        >
          <span style={{ color: 'var(--error-color)' }}>{error}</span>
        </div>
      )}
      
      <div 
        ref={consoleRef}
        className="p-4 rounded-lg font-mono text-sm overflow-y-auto max-h-72"
        style={{ 
          backgroundColor: 'var(--card-bg)', 
          color: 'var(--primary-text)',
          borderColor: 'var(--card-border)',
          border: '1px solid'
        }}
      >
        {logs.length === 0 ? (
          <p style={{ color: 'var(--secondary-text)' }}>No output yet. Start an operation to see logs.</p>
        ) : (
          logs.map((log, index) => (
            <div key={index} className="mb-1">
              {log.toLowerCase().includes('error') ? (
                <span style={{ color: 'var(--error-color)' }}>{log}</span>
              ) : log.toLowerCase().includes('complete') || log.toLowerCase().includes('success') ? (
                <span style={{ color: 'var(--success-color)' }}>{log}</span>
              ) : log.toLowerCase().includes('warning') ? (
                <span style={{ color: 'var(--warning-color)' }}>{log}</span>
              ) : log.startsWith('[') ? (
                <span style={{ color: 'var(--accent-color)' }}>{log}</span>
              ) : (
                log
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ConsoleOutput;
