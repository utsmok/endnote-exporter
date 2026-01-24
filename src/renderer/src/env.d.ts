/// <reference types="vite/client" />

interface Window {
  api: {
    openFileDialog: () => void;
    onFileSelected: (callback: (filePath: string) => void) => void;
    startExport: (enlFilePath: string) => void;
    onExportProgress: (callback: (message: string) => void) => void;
    onExportComplete: (callback: (result: { count: number; outputPath: string }) => void) => void;
    onExportError: (callback: (errorMessage: string) => void) => void;
    removeListeners: () => void;
  };
}
