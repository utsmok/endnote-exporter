import React from 'react';

interface LogViewProps {
  logs: string[];
}

export const LogView: React.FC<LogViewProps> = ({ logs }) => {
  return (
    <div className="h-64 p-2 my-4 overflow-y-scroll bg-gray-900 text-white rounded-md">
      {logs.length === 0 ? (
        <p>&gt; Waiting for logs...</p>
      ) : (
        logs.map((log, index) => <p key={index}>&gt; {log}</p>)
      )}
    </div>
  );
};
