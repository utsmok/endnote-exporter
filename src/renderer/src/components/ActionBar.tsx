import React from 'react';

interface ActionBarProps {
  disabled: boolean;
  onClick: () => void;
}

export const ActionBar: React.FC<ActionBarProps> = ({ disabled, onClick }) => {
  return (
    <div className="flex justify-end">
      <button
        className="px-4 py-2 text-white bg-blue-500 rounded-md hover:bg-blue-600 disabled:bg-gray-400"
        disabled={disabled}
        onClick={onClick}
      >
        Export
      </button>
    </div>
  );
};
