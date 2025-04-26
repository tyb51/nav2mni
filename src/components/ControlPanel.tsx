import React, { useState } from 'react';
import { JsonFile } from '@/types/FileTypes';

interface ControlPanelProps {
  dicomDirectory?: string | null;
  jsonFile?: JsonFile | null;
  outputDirectory?: string | null;
  onConvertDicom: () => Promise<boolean>;
  onGenerateDeformation: () => Promise<boolean>;
  onConvertCoordinates: (sourceType?: 'stealth' | 'brainlab') => Promise<boolean>;
  className?: string;
  disabled?: boolean;
}

const ControlPanel: React.FC<ControlPanelProps> = ({
  dicomDirectory,
  jsonFile,
  outputDirectory,
  onConvertDicom,
  onGenerateDeformation,
  onConvertCoordinates,
  className = '',
  disabled = false
}) => {
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionStatus, setActionStatus] = useState<string>('');
  const [conversionOption, setConversionOption] = useState({
    convertAll: false,
    seriesId: '',
    sourceType: 'stealth' as 'stealth' | 'brainlab'
  });

  const isReady = dicomDirectory && jsonFile && outputDirectory;
  
  const handleActionSelect = async (action: string) => {
    if (isProcessing) return;
    
    setActiveAction(action);
    setIsProcessing(true);
    setActionStatus(`Starting ${action}...`);
    
    try {
      let success = false;
      
      switch (action) {
        case 'Convert Dicom':
          success = await onConvertDicom();
          break;
        case 'Generate deformation field':
          success = await onGenerateDeformation();
          break;
        case 'Convert coordinates':
          success = await onConvertCoordinates(conversionOption.sourceType);
          break;
      }
      
      setActionStatus(success ? `${action} completed successfully` : `${action} failed`);
    } catch (error) {
      console.error(`Error during ${action}:`, error);
      setActionStatus(`Error during ${action}: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Define the Exam type for proper typing
  interface Exam {
    name: string[];
    seriesID: string;
    studyID: string;
    [key: string]: unknown; // For other properties we don't need to access directly
  }

  // Extract MR series IDs from the JSON file if available
  const availableSeriesIds = jsonFile?.data?.exams
    ?.filter((exam: Exam) => exam.name && exam.name[0]?.includes('MR'))
    ?.map((exam: Exam) => exam.seriesID) || [];

  return (
    <div className={`${className}`}>
      <h2 className="text-xl font-semibold mb-4">Processing Controls</h2>
      
      <div className="mb-4 space-y-4">
        {/* Source Type Selection */}
        <div className="border rounded-lg p-4" style={{ borderColor: 'var(--card-border)' }}>
          <h3 className="font-medium mb-2" style={{ color: 'var(--primary-text)' }}>Coordinate Source Type</h3>
          <div className="flex space-x-6">
            <label className="flex items-center space-x-2">
              <input
                type="radio"
                name="sourceType"
                value="stealth"
                checked={conversionOption.sourceType === 'stealth'}
                onChange={() => setConversionOption(prev => ({ ...prev, sourceType: 'stealth' }))}
                className="h-4 w-4 accent-blue-500"
                disabled={isProcessing}
              />
              <span style={{ color: 'var(--primary-text)' }}>StealthStation</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="radio"
                name="sourceType"
                value="brainlab"
                checked={conversionOption.sourceType === 'brainlab'}
                onChange={() => setConversionOption(prev => ({ ...prev, sourceType: 'brainlab' }))}
                className="h-4 w-4 accent-blue-500"
                disabled={isProcessing}
              />
              <span style={{ color: 'var(--primary-text)' }}>BrainLab</span>
            </label>
          </div>
          <p className="text-xs mt-2" style={{ color: 'var(--secondary-text)' }}>
            Select the navigation system that generated your coordinate data.
          </p>
        </div>
        
        {/* Convert All Option */}
        <div>
          <label className="flex items-center space-x-2 mb-2">
            <input
              type="checkbox"
              checked={conversionOption.convertAll}
              onChange={(e) => setConversionOption(prev => ({ ...prev, convertAll: e.target.checked }))}
              className="h-4 w-4"
              disabled={isProcessing}
            />
            <span>Convert all image series</span>
          </label>
          <p className="text-sm text-gray-500 mb-4">
            This option requires more processing time and space. Leave disabled to only convert a T1 MR series.
          </p>
        </div>
        
        {!conversionOption.convertAll && availableSeriesIds.length > 0 && (
          <div className="mb-4">
            <label className="block mb-1 text-sm font-medium">
              Series ID Override (optional)
            </label>
            <select
              value={conversionOption.seriesId}
              onChange={(e) => setConversionOption(prev => ({ ...prev, seriesId: e.target.value }))}
              className="w-full p-2 border border-gray-300 rounded-md"
              disabled={isProcessing}
            >
              <option value="">Auto-detect T1 series</option>
              {availableSeriesIds.map((id: string) => (
                <option key={id} value={id}>{id}</option>
              ))}
            </select>
          </div>
        )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <button
          onClick={() => handleActionSelect('Convert Dicom')}
          disabled={!isReady || isProcessing || disabled}
          className={`p-3 rounded-lg transition ${
            !isReady || isProcessing
              ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
              : activeAction === 'Convert Dicom'
                ? 'bg-blue-600 text-white'
                : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
          }`}
        >
          Convert Dicom
        </button>
        
        <button
          onClick={() => handleActionSelect('Generate deformation field')}
          disabled={!isReady || isProcessing || disabled}
          className={`p-3 rounded-lg transition ${
            !isReady || isProcessing
              ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
              : activeAction === 'Generate deformation field'
                ? 'bg-blue-600 text-white'
                : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
          }`}
        >
          Generate deformation field
        </button>
        
        <button
          onClick={() => handleActionSelect('Convert coordinates')}
          disabled={!isReady || isProcessing || disabled}
          className={`p-3 rounded-lg transition ${
            !isReady || isProcessing
              ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
              : activeAction === 'Convert coordinates'
                ? 'bg-blue-600 text-white'
                : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
          }`}
        >
          Convert coordinates
        </button>
      </div>
      
      {actionStatus && (
        <div className={`mt-4 p-3 rounded-lg ${isProcessing ? 'bg-blue-50' : actionStatus.includes('failed') || actionStatus.includes('Error') ? 'bg-red-50' : 'bg-green-50'}`}>
          <p className={`${isProcessing ? 'text-blue-700' : actionStatus.includes('failed') || actionStatus.includes('Error') ? 'text-red-700' : 'text-green-700'}`}>
            {isProcessing && <span className="inline-block animate-spin mr-2">⟳</span>}
            {actionStatus}
          </p>
        </div>
      )}
    </div>
  );
};

export default ControlPanel;
