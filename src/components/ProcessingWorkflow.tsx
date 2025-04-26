import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import SourceTypeSelector from './SourceTypeSelector';
import FileUploader from './FileUploader';
import ControlPanel from './ControlPanel';
import { Coordinate } from '@/types/FileTypes';

interface ProcessingWorkflowProps {
  onProcessingStart: (message: string) => void;
  onProcessingComplete: (message: string) => void;
  onError: (error: string) => void;
  onAddLog: (log: string) => void;
  onCoordinatesLoaded: (original: Coordinate[], converted: Coordinate[]) => void;
  className?: string;
}

interface UploadedFile {
  path: string;
  type: 'dicom' | 'json' | 'nifti';
  filename: string;
}

const ProcessingWorkflow: React.FC<ProcessingWorkflowProps> = ({
  onProcessingStart,
  onProcessingComplete,
  onError,
  onAddLog,
  onCoordinatesLoaded,
  className = ''
}) => {
  // Session management
  const [sessionId, setSessionId] = useState<string>('');
  const [sourceType, setSourceType] = useState<'stealth' | 'brainlab'>('stealth');
  
  // Uploaded files tracking
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, UploadedFile>>({});
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [outputDir, setOutputDir] = useState<string | null>(null);
  
  // Processing state
  const [processingStep, setProcessingStep] = useState<number>(0);
  const [isConverting, setIsConverting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Initialize the session ID
  useEffect(() => {
    setSessionId(uuidv4());
  }, []);
  
  // Clean up the session when component unmounts
  useEffect(() => {
    return () => {
      if (sessionId) {
        // Delete the session files when the component unmounts
        fetch(`/api/upload?sessionId=${sessionId}`, {
          method: 'DELETE'
        }).catch(err => console.error('Error cleaning up session:', err));
      }
    };
  }, [sessionId]);
  
  // Handle source type change
  const handleSourceTypeChange = (type: 'stealth' | 'brainlab') => {
    setSourceType(type);
    
    // Reset uploads if source type changes
    setUploadedFiles({});
    setProcessingStep(1);
  };
  
  // Define the upload result type
  interface UploadResult {
    success: boolean;
    sessionId: string;
    sourceType: 'stealth' | 'brainlab';
    uploadType: string;
    message: string;
    uploadedPath: string;
    outputPath?: string;
  }

  // Handle file upload completion
  const handleUploadComplete = (type: 'dicom' | 'json' | 'nifti', result: UploadResult) => {
    onAddLog(`Uploaded ${type} file: ${result.message}`);
    
    // Add to uploaded files
    setUploadedFiles(prev => ({
      ...prev,
      [type]: {
        path: result.uploadedPath,
        type,
        filename: result.uploadedPath.split('/').pop() || ''
      }
    }));
    
    // Store output directory
    if (result.outputPath && !outputDir) {
      setOutputDir(result.outputPath);
    }
    
    // Advance processing step based on source type and uploads
    if (sourceType === 'stealth' && type === 'json') {
      setProcessingStep(Math.max(processingStep, 2));
    } else if (sourceType === 'brainlab' && type === 'dicom') {
      setProcessingStep(Math.max(processingStep, 2));
    } else if (type === 'dicom') {
      setProcessingStep(Math.max(processingStep, 2));
    }
  };
  
  // Handle upload error
  const handleUploadError = (error: string) => {
    setUploadError(error);
    onError(`Upload error: ${error}`);
  };
  
  // Handle DICOM conversion
  const handleConvertDicom = async () => {
    if (!uploadedFiles.dicom) {
      onError('No DICOM files uploaded');
      return false;
    }
    
    setIsConverting(true);
    onProcessingStart('Converting DICOM files to NIfTI...');
    
    try {
      const response = await fetch('/api/dicom-convert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dicomDirectory: uploadedFiles.dicom.path,
          outputDirectory: outputDir,
          convertAll: false,
          seriesIdOverride: '',
        }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        onAddLog(`[DICOM CONVERT] Successfully converted ${result.convertedFiles?.length || 0} files`);
        result.convertedFiles?.forEach((file: string) => {
          onAddLog(`[DICOM CONVERT] Created: ${file}`);
        });
        
        // Update processing step
        setProcessingStep(Math.max(processingStep, 3));
        onProcessingComplete('DICOM conversion completed');
        return true;
      } else {
        onError(`[DICOM CONVERT] Error: ${result.error}`);
        return false;
      }
    } catch (error) {
      onError(`[DICOM CONVERT] Error: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    } finally {
      setIsConverting(false);
    }
  };
  
  // Handle deformation field generation
  const handleGenerateDeformation = async () => {
    if (!outputDir) {
      onError('No output directory set');
      return false;
    }
    
    setIsProcessing(true);
    onProcessingStart('Generating deformation field...');
    
    try {
      // Find the T1 NIfTI file
      const sessionResponse = await fetch(`/api/upload?sessionId=${sessionId}`);
      const sessionData = await sessionResponse.json();
      
      const niftiFiles = sessionData.files.nifti || [];
      const outputFiles = sessionData.files.output || [];
      
      let t1NiftiPath = '';
      
      // Try to find a T1 NIfTI file
      for (const file of outputFiles) {
        if (file.toLowerCase().includes('t1') || file.toLowerCase().includes('mr_')) {
          t1NiftiPath = `${outputDir}/${file}`;
          break;
        }
      }
      
      if (!t1NiftiPath && outputFiles.length > 0) {
        // If no specific T1 file found, use the first one
        t1NiftiPath = `${outputDir}/${outputFiles[0]}`;
      }
      
      if (!t1NiftiPath && niftiFiles.length > 0) {
        // If no output files, check if user uploaded a NIfTI directly
        t1NiftiPath = `${sessionData.sessionPath}/nifti/${niftiFiles[0]}`;
      }
      
      if (!t1NiftiPath) {
        onError('No T1 NIfTI file found. Please convert DICOM first.');
        setIsProcessing(false);
        return false;
      }
      
      onAddLog(`[WARP] Using T1 MR file: ${t1NiftiPath}`);
      
      const response = await fetch('/api/deformation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputNiftiPath: t1NiftiPath,
          outputDirectory: outputDir,
          templateDirectory: null,
        }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        onAddLog(`[WARP] Successfully generated deformation fields`);
        result.deformationFiles?.forEach((file: string) => {
          onAddLog(`[WARP] Created: ${file}`);
        });
        
        // Update processing step
        setProcessingStep(Math.max(processingStep, 4));
        onProcessingComplete('Deformation field generation completed');
        return true;
      } else {
        onError(`[WARP] Error: ${result.error}`);
        return false;
      }
    } catch (error) {
      onError(`[WARP] Error: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Handle coordinate conversion
  const handleConvertCoordinates = async () => {
    if (!outputDir) {
      onError('No output directory set');
      return false;
    }
    
    // Check requirements based on source type
    if (sourceType === 'stealth' && !uploadedFiles.json) {
      onError('No JSON coordinate file uploaded for StealthStation');
      return false;
    }
    
    if (sourceType === 'brainlab' && !uploadedFiles.dicom) {
      onError('No DICOM directory uploaded for BrainLab');
      return false;
    }
    
    setIsProcessing(true);
    onProcessingStart('Converting coordinates...');
    
    try {
      // Get session data to find necessary files
      const sessionResponse = await fetch(`/api/upload?sessionId=${sessionId}`);
      const sessionData = await sessionResponse.json();
      
      const niftiFiles = sessionData.files.output || [];
      const deformFiles = sessionData.files.output || [];
      
      // Find T1 NIfTI file
      let t1NiftiPath = '';
      for (const file of niftiFiles) {
        if (file.toLowerCase().includes('t1') || file.toLowerCase().includes('mr_')) {
          t1NiftiPath = `${outputDir}/${file}`;
          break;
        }
      }
      
      if (!t1NiftiPath && niftiFiles.length > 0) {
        t1NiftiPath = `${outputDir}/${niftiFiles[0]}`;
      }
      
      if (!t1NiftiPath) {
        onError('No T1 NIfTI file found. Please convert DICOM first.');
        setIsProcessing(false);
        return false;
      }
      
      // Find deformation field
      let deformationFieldPath = '';
      for (const file of deformFiles) {
        if (file.startsWith('iy_') || file.startsWith('y_')) {
          deformationFieldPath = `${outputDir}/${file}`;
          break;
        }
      }
      
      if (!deformationFieldPath) {
        onError('No deformation field found. Please generate a deformation field first.');
        setIsProcessing(false);
        return false;
      }
      
      // For StealthStation we need the JSON file
      const jsonFilePath = sourceType === 'stealth' 
        ? uploadedFiles.json?.path 
        : '';
      
      // For BrainLab we need the DICOM directory
      const dicomDirectory = sourceType === 'brainlab' 
        ? uploadedFiles.dicom?.path 
        : '';
      
      const response = await fetch('/api/convert-coordinates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          niftiFilePath: t1NiftiPath,
          jsonFilePath,
          dicomDirectory,
          deformationFieldPath,
          outputDirectory: outputDir,
          templatePath: null,
          sourceType
        }),
      });
      
      const result = await response.json();
      
      if (result.success && result.coordinates) {
        onAddLog(`[COORDINATE CONVERT] Successfully converted coordinates`);
        
        // Log original coordinates
        onAddLog('Original coordinates (voxel):');
        result.coordinates.original?.forEach((coord: Coordinate) => {
          onAddLog(`${coord.name}: (${parseFloat(coord.x.toString()).toFixed(2)}, ${parseFloat(coord.y.toString()).toFixed(2)}, ${parseFloat(coord.z.toString()).toFixed(2)}) ${coord.units}`);
        });
        
        // Log warped coordinates
        onAddLog('Warped coordinates (MNI):');
        result.coordinates.warped?.forEach((coord: Coordinate) => {
          onAddLog(`${coord.name}: (${parseFloat(coord.x.toString()).toFixed(2)}, ${parseFloat(coord.y.toString()).toFixed(2)}, ${parseFloat(coord.z.toString()).toFixed(2)}) ${coord.units}`);
        });
        
        // Send coordinates to parent component
        onCoordinatesLoaded(result.coordinates.original || [], result.coordinates.warped || []);
        
        // Update processing step
        setProcessingStep(5);
        onProcessingComplete('Coordinate conversion completed');
        return true;
      } else {
        onError(`[COORDINATE CONVERT] Error: ${result.error}`);
        return false;
      }
    } catch (error) {
      onError(`[COORDINATE CONVERT] Error: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Determine what files are required based on source type and current step
  const isDicomRequired = sourceType === 'brainlab' || processingStep < 3;
  const isJsonRequired = sourceType === 'stealth' && processingStep >= 1;
  
  return (
    <div className={`${className} space-y-6`}>
      {/* Step 1: Select source type */}
      <SourceTypeSelector 
        sourceType={sourceType} 
        onSourceTypeChange={handleSourceTypeChange} 
      />
      
      {/* Step 2: Upload files */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <FileUploader
          uploadType="dicom"
          sourceType={sourceType}
          sessionId={sessionId}
          onUploadComplete={(result) => handleUploadComplete('dicom', result)}
          onUploadError={handleUploadError}
          required={isDicomRequired}
          disabled={isConverting || isProcessing}
        />
        
        {sourceType === 'stealth' && (
          <FileUploader
            uploadType="json"
            sourceType={sourceType}
            sessionId={sessionId}
            onUploadComplete={(result) => handleUploadComplete('json', result)}
            onUploadError={handleUploadError}
            required={isJsonRequired}
            disabled={isConverting || isProcessing}
          />
        )}
      </div>
      
      {/* Error display */}
      {uploadError && (
        <div className="p-4 border rounded-lg text-red-700 bg-red-50 border-red-200">
          <h3 className="font-medium mb-1">Upload Error</h3>
          <p>{uploadError}</p>
        </div>
      )}
      
      {/* Step 3-5: Processing controls */}
      {processingStep >= 2 && (
        <ControlPanel
          onConvertDicom={handleConvertDicom}
          onGenerateDeformation={handleGenerateDeformation}
          onConvertCoordinates={() => handleConvertCoordinates()}
          disabled={isConverting || isProcessing}
          className="card p-6 rounded-lg"
        />
      )}
    </div>
  );
};

export default ProcessingWorkflow;
