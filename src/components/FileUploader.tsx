import React, { useState, useRef, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

interface UploadResponse {
  success: boolean;
  sessionId: string;
  sourceType: 'stealth' | 'brainlab';
  uploadType: string;
  message: string;
  uploadedPath: string;
  outputPath?: string;
}

interface FileUploaderProps {
  uploadType: 'dicom' | 'json' | 'nifti';
  sourceType: 'stealth' | 'brainlab';
  sessionId: string;
  onUploadComplete: (result: UploadResponse) => void;
  onUploadError: (error: string) => void;
  className?: string;
  buttonText?: string;
  acceptedFileTypes?: string;
  required?: boolean;
  disabled?: boolean;
}

const FileUploader: React.FC<FileUploaderProps> = ({
  uploadType,
  sourceType,
  sessionId,
  onUploadComplete,
  onUploadError,
  className = '',
  buttonText,
  acceptedFileTypes,
  required = false,
  disabled = false
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadSpeed, setUploadSpeed] = useState(0);
  const [fileName, setFileName] = useState<string | null>(null);
  const uploadStartTime = useRef<number | null>(null);
  const uploadedBytes = useRef<number>(0);
  
  // Set the appropriate button text and accepted file types based on upload type
  const getButtonText = () => {
    if (buttonText) return buttonText;
    
    switch (uploadType) {
      case 'dicom':
        return 'Upload DICOM Files';
      case 'json':
        return 'Upload Coordinate File';
      case 'nifti':
        return 'Upload NIfTI File';
      default:
        return 'Upload File';
    }
  };
  
  const getAcceptedFileTypes = () => {
    if (acceptedFileTypes) return acceptedFileTypes;
    
    switch (uploadType) {
      case 'dicom':
        return '.dcm,.zip';
      case 'json':
        return '.json';
      case 'nifti':
        return '.nii,.nii.gz';
      default:
        return '';
    }
  };
  
  // Handle the file upload to the server
  const uploadFile = useCallback(async (file: File) => {
    setIsUploading(true);
    setUploadProgress(0);
    setFileName(file.name);
    uploadStartTime.current = Date.now();
    uploadedBytes.current = 0;
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('uploadType', uploadType);
      formData.append('sourceType', sourceType);
      formData.append('sessionId', sessionId);
      
      const xhr = new XMLHttpRequest();
      
      // Track upload progress
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(progress);
          
          // Calculate upload speed
          const currentTime = Date.now();
          const timeElapsed = (currentTime - (uploadStartTime.current || currentTime)) / 1000; // in seconds
          
          if (timeElapsed > 0) {
            const bytesPerSecond = event.loaded / timeElapsed;
            setUploadSpeed(bytesPerSecond);
          }
          
          uploadedBytes.current = event.loaded;
        }
      };
      
      // Handle response
      xhr.onload = () => {
        if (xhr.status === 200) {
          const response = JSON.parse(xhr.responseText);
          if (response.success) {
            onUploadComplete(response);
          } else {
            onUploadError(response.error || 'Upload failed');
          }
        } else {
          onUploadError(`Server returned ${xhr.status}: ${xhr.statusText}`);
        }
        setIsUploading(false);
      };
      
      // Handle errors
      xhr.onerror = () => {
        onUploadError('Network error occurred during upload');
        setIsUploading(false);
      };
      
      xhr.open('POST', '/api/upload', true);
      xhr.send(formData);
    } catch (error) {
      onUploadError((error as Error).message || 'Unknown error occurred');
      setIsUploading(false);
    }
  }, [uploadType, sourceType, sessionId, onUploadComplete, onUploadError]);
  
  // Handle dropped files
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      uploadFile(acceptedFiles[0]);
    }
  }, [uploadFile]);
  
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    disabled: isUploading || disabled,
    accept: {
      [getAcceptedFileTypes()]: []
    },
    multiple: false
  });
  
  // Format file size for display
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  
  // Format upload speed for display
  const formatUploadSpeed = (bytesPerSecond: number): string => {
    return `${formatFileSize(bytesPerSecond)}/s`;
  };
  
  // Calculate estimated time remaining
  const getTimeRemaining = (): string => {
    if (uploadProgress === 0 || uploadSpeed === 0) return 'Calculating...';
    
    const totalBytes = uploadedBytes.current / (uploadProgress / 100);
    const remainingBytes = totalBytes - uploadedBytes.current;
    const secondsRemaining = remainingBytes / uploadSpeed;
    
    if (secondsRemaining < 60) {
      return `${Math.round(secondsRemaining)}s remaining`;
    } else {
      return `${Math.round(secondsRemaining / 60)}m ${Math.round(secondsRemaining % 60)}s remaining`;
    }
  };
  
  return (
    <div className={`${className}`}>
      <div 
        {...getRootProps()} 
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          isDragActive ? 'border-blue-500 bg-blue-50' : ''
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-opacity-10'}`}
        style={{ 
          borderColor: isDragActive ? 'var(--accent-color)' : 'var(--card-border)',
          backgroundColor: isDragActive ? 'rgba(59, 130, 246, 0.1)' : 'var(--card-bg)',
          color: 'var(--primary-text)'
        }}
      >
        <input {...getInputProps()} />
        
        <div className="flex flex-col items-center justify-center">
          {isUploading ? (
            <>
              <div className="w-full max-w-md mb-2">
                <div className="w-full bg-gray-200 rounded-full h-4 dark:bg-gray-700">
                  <div 
                    className="h-4 rounded-full" 
                    style={{ 
                      width: `${uploadProgress}%`,
                      backgroundColor: 'var(--accent-color)'
                    }}
                  ></div>
                </div>
                <div className="flex justify-between mt-1 text-sm" style={{ color: 'var(--secondary-text)' }}>
                  <span>{uploadProgress}%</span>
                  <span>{formatUploadSpeed(uploadSpeed)}</span>
                </div>
                <div className="text-sm mt-1" style={{ color: 'var(--secondary-text)' }}>
                  {getTimeRemaining()}
                </div>
                <div className="mt-2" style={{ color: 'var(--primary-text)' }}>
                  Uploading {fileName}...
                </div>
              </div>
            </>
          ) : (
            <>
              <svg 
                className="w-12 h-12 mb-4" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24" 
                xmlns="http://www.w3.org/2000/svg"
                style={{ color: 'var(--accent-color)' }}
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={1.5} 
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" 
                />
              </svg>
              <p className="text-lg font-medium mb-1" style={{ color: 'var(--primary-text)' }}>
                {getButtonText()}
              </p>
              {uploadType === 'dicom' && (
                <p className="text-sm mb-2" style={{ color: 'var(--secondary-text)' }}>
                  Drop a DICOM folder or ZIP archive
                </p>
              )}
              <p className="text-sm" style={{ color: 'var(--secondary-text)' }}>
                Drag & drop or click to browse
              </p>
              {required && (
                <p className="text-sm mt-2 font-medium" style={{ color: 'var(--warning-color)' }}>
                  Required
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default FileUploader;
