import React, { useState, useEffect } from 'react';
import { JsonFile } from '@/types/FileTypes';

interface FileManagerProps {
  files: FileList | null;
  directoryPath: string | null;
  className?: string;
  onDicomDirectoryFound: (directory: string | null) => void;
  onJsonFileFound: (file: JsonFile | null) => void;
  onOutputDirectorySet: (directory: string | null) => void;
}

const FileManager: React.FC<FileManagerProps> = ({ 
  files, 
  directoryPath,
  className = '',
  onDicomDirectoryFound,
  onJsonFileFound,
  onOutputDirectorySet
}) => {
  const [dicomDirectory, setDicomDirectory] = useState<string | null>(null);
  const [jsonFile, setJsonFile] = useState<JsonFile | null>(null);
  const [outputDirectory, setOutputDirectory] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');

  // Effect to call parent callbacks when data changes
  useEffect(() => {
    onDicomDirectoryFound(dicomDirectory);
  }, [dicomDirectory, onDicomDirectoryFound]);

  useEffect(() => {
    onJsonFileFound(jsonFile);
  }, [jsonFile, onJsonFileFound]);

  useEffect(() => {
    onOutputDirectorySet(outputDirectory);
  }, [outputDirectory, onOutputDirectorySet]);

  useEffect(() => {
    if (files && directoryPath) {
      setIsProcessing(true);
      setProcessingStatus('Scanning files...');
      
      // Find DICOM directory and JSON file
      const fileArray = Array.from(files);
      
      // Process in the next tick to avoid UI freezing
      setTimeout(() => {
        processFiles(fileArray, directoryPath);
      }, 0);
    }
  }, [files, directoryPath]);

  const processFiles = (fileArray: File[], directoryPath: string) => {
    // Find stealthExport directory containing DICOMDIR
    let foundDicomDir = false;
    let foundJsonFile = false;
    let jsonFilePath = '';
    
    // First pass to identify structure
    fileArray.forEach(file => {
      const relativePath = file.webkitRelativePath;
      const pathParts = relativePath.split('/');
      
      // Look for DICOMDIR in stealthExport* directories
      if (pathParts.length > 1 && 
          pathParts[1].startsWith('stealthExport') && 
          pathParts[pathParts.length - 1] === 'DICOMDIR') {
        setDicomDirectory(`${directoryPath}/${pathParts[1]}`);
        foundDicomDir = true;
        setProcessingStatus('Found DICOM directory');
      }
      
      // Look for JSON coordinate file
      if (file.name.endsWith('.json') && pathParts.length === 2) {
        foundJsonFile = true;
        jsonFilePath = relativePath;
        setProcessingStatus('Found coordinate file');
      }
    });

    // Set output directory
    setOutputDirectory(`${directoryPath}/Conversion`);
    
    // Second pass to load JSON file contents if found
    if (foundJsonFile) {
      const jsonFileObj = fileArray.find(f => f.webkitRelativePath === jsonFilePath);
      if (jsonFileObj) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = JSON.parse(e.target?.result as string);
            setJsonFile({
              name: jsonFileObj.name,
              path: jsonFilePath,
              data: data
            });
            setProcessingStatus('Loaded coordinate file');
          } catch (error) {
            console.error('Error parsing JSON file:', error);
            setProcessingStatus('Error parsing coordinate file');
          }
          setIsProcessing(false);
        };
        reader.readAsText(jsonFileObj);
      }
    } else {
      setIsProcessing(false);
    }
    
    // Show status message if no files found
    if (!foundDicomDir && !foundJsonFile) {
      setProcessingStatus('No valid files found. Please select a directory containing Stealth export data.');
      setIsProcessing(false);
    }
  };

  if (!files || !directoryPath) {
    return null;
  }

  return (
    <div className={className}>
      <h2 className="text-xl font-semibold mb-4">File Organization</h2>
      
      {isProcessing ? (
        <div className="animate-pulse">
          <p>{processingStatus}</p>
        </div>
      ) : (
        <div className="grid gap-4">
          <div className="p-4 border rounded-lg" style={{ borderColor: 'var(--card-border)' }}>
            <h3 className="font-medium" style={{ color: 'var(--primary-text)' }}>Source Directory</h3>
            <p className="text-sm" style={{ color: 'var(--secondary-text)' }}>{directoryPath}</p>
          </div>
          
          {dicomDirectory && (
            <div className="p-4 border rounded-lg" style={{ borderColor: 'var(--card-border)' }}>
              <h3 className="font-medium" style={{ color: 'var(--primary-text)' }}>DICOM Directory</h3>
              <p className="text-sm" style={{ color: 'var(--secondary-text)' }}>{dicomDirectory}</p>
            </div>
          )}
          
          {jsonFile && (
            <div className="p-4 border rounded-lg" style={{ borderColor: 'var(--card-border)' }}>
              <h3 className="font-medium" style={{ color: 'var(--primary-text)' }}>Coordinate File</h3>
              <p className="text-sm" style={{ color: 'var(--secondary-text)' }}>{jsonFile.path}</p>
              {jsonFile.data.name && (
                <p className="text-sm mt-2" style={{ color: 'var(--primary-text)' }}>
                  <span className="font-medium">Patient:</span> {jsonFile.data.name}, 
                  <span className="font-medium ml-2">MRN:</span> {jsonFile.data.mrn}
                </p>
              )}
            </div>
          )}
          
          {outputDirectory && (
            <div className="p-4 border rounded-lg" style={{ borderColor: 'var(--card-border)' }}>
              <h3 className="font-medium" style={{ color: 'var(--primary-text)' }}>Output Directory</h3>
              <p className="text-sm" style={{ color: 'var(--secondary-text)' }}>{outputDirectory}</p>
            </div>
          )}
          
          {(!dicomDirectory || !jsonFile) && (
            <div className="p-4 border rounded-lg" style={{ borderColor: 'var(--warning-color)', backgroundColor: 'rgba(245, 158, 11, 0.1)' }}>
              <h3 className="font-medium" style={{ color: 'var(--warning-color)' }}>Missing Files</h3>
              <ul className="list-disc list-inside text-sm mt-2" style={{ color: 'var(--warning-color)' }}>
                {!dicomDirectory && <li>DICOM directory not found</li>}
                {!jsonFile && <li>Coordinate file (.json) not found</li>}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FileManager;
