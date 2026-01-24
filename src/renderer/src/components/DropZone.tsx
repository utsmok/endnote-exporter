import React from 'react';

export const DropZone: React.FC = () => {
  return (
    <div className="p-4 border-2 border-dashed rounded-md">
      <p className="text-center">Drag and drop your .enl file here, or click to select a file.</p>
    </div>
  );
};
