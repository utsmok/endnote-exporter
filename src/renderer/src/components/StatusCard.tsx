import React from 'react';

interface StatusCardProps {
  status: string;
  type: 'info' | 'success' | 'error';
}

const typeClasses = {
  info: 'bg-blue-100 text-blue-800',
  success: 'bg-green-100 text-green-800',
  error: 'bg-red-100 text-red-800',
};

export const StatusCard: React.FC<StatusCardProps> = ({ status, type }) => {
  return (
    <div className={`p-4 my-4 rounded-md ${typeClasses[type]}`}>
      <p>{status}</p>
    </div>
  );
};
