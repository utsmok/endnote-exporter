import React, { useState, useEffect } from 'react';
import { DropZone } from './components/DropZone';
import { StatusCard } from './components/StatusCard';
import { LogView } from './components/LogView';
import { ActionBar } from './components/ActionBar';

function App(): JSX.Element {
  const [enlFile, setEnlFile] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [status, setStatus] = useState('Ready');
  const [statusType, setStatusType] = useState<'info' | 'success' | 'error'>('info');

  useEffect(() => {
    const handleFileSelected = (filePath: string) => {
      setEnlFile(filePath);
      setStatus(`File selected: ${filePath}`);
      setStatusType('info');
    };

    const handleExportProgress = (message: string) => {
      setLogs((prevLogs) => [...prevLogs, message]);
    };

    const handleExportComplete = ({ count, outputPath }: { count: number; outputPath: string }) => {
      setStatus(`Export complete! ${count} references exported to ${outputPath}`);
      setStatusType('success');
    };

    const handleExportError = (errorMessage: string) => {
      setStatus(`Export failed: ${errorMessage}`);
      setStatusType('error');
    };

    window.api.onFileSelected(handleFileSelected);
    window.api.onExportProgress(handleExportProgress);
    window.api.onExportComplete(handleExportComplete);
    window.api.onExportError(handleExportError);

    return () => {
      window.api.removeListeners();
    };
  }, []);

  const handleExport = () => {
    if (enlFile) {
      setStatus('Exporting...');
      setStatusType('info');
      setLogs([]);
      window.api.startExport(enlFile);
    }
  };

  const handleDropZoneClick = () => {
    window.api.openFileDialog();
  };

  return (
    <div className="container p-4 mx-auto">
      <h1 className="text-2xl font-bold">EndNote to Zotero Exporter</h1>
      <div onClick={handleDropZoneClick} className="cursor-pointer">
        <DropZone />
      </div>
      <StatusCard status={status} type={statusType} />
      <LogView logs={logs} />
      <ActionBar disabled={!enlFile} onClick={handleExport} />
    </div>
  );
}

export default App;
