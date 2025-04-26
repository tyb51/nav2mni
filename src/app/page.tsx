'use client';

import React, { useState } from 'react';
import ProcessingWorkflow from '@/components/ProcessingWorkflow';
import ConsoleOutput from '@/components/ConsoleOutput';
import CoordinateViewer from '@/components/CoordinateViewer';
import { Coordinate } from '@/types/FileTypes';

export default function Home() {
  const [logs, setLogs] = useState<string[]>([]);
  const [originalCoordinates, setOriginalCoordinates] = useState<Coordinate[]>([]);
  const [convertedCoordinates, setConvertedCoordinates] = useState<Coordinate[]>([]);
  const [processingStatus, setProcessingStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Add a log message to the console
  const addLog = (message: string) => {
    setLogs(prev => [...prev, message]);
  };
  
  // Handle processing start
  const handleProcessingStart = (message: string) => {
    setProcessingStatus(message);
    addLog(`[PROCESSING] ${message}`);
    setError(null);
  };
  
  // Handle processing complete
  const handleProcessingComplete = (message: string) => {
    setProcessingStatus(null);
    addLog(`[COMPLETE] ${message}`);
  };
  
  // Handle error
  const handleError = (errorMessage: string) => {
    setError(errorMessage);
    addLog(`[ERROR] ${errorMessage}`);
  };
  
  // Handle coordinates loaded
  const handleCoordinatesLoaded = (original: Coordinate[], converted: Coordinate[]) => {
    setOriginalCoordinates(original);
    setConvertedCoordinates(converted);
    addLog(`[COORDINATES] Loaded ${original.length} original and ${converted.length} converted coordinates`);
  };
  
  return (
    <main className="min-h-screen p-6 md:p-12">
      <div className="container mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--primary-text)' }}>
            Navigation to MNI Coordinate Converter
          </h1>
          <p className="text-lg" style={{ color: 'var(--secondary-text)' }}>
            Convert StealthStation or BrainLab coordinates to MNI space
          </p>
        </header>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <ProcessingWorkflow
              onProcessingStart={handleProcessingStart}
              onProcessingComplete={handleProcessingComplete}
              onError={handleError}
              onAddLog={addLog}
              onCoordinatesLoaded={handleCoordinatesLoaded}
              className="mb-8"
            />
            
            {(originalCoordinates.length > 0 || convertedCoordinates.length > 0) && (
              <CoordinateViewer
                originalCoordinates={originalCoordinates}
                convertedCoordinates={convertedCoordinates}
                className="mb-8"
              />
            )}
          </div>
          
          <div className="lg:col-span-1">
            <ConsoleOutput
              logs={logs}
              processingStatus={processingStatus}
              error={error}
              className="sticky top-6"
            />
          </div>
        </div>
      </div>
    </main>
  );
}
