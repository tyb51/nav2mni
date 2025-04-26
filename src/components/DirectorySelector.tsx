import React, { useRef, useState } from 'react';

interface DirectorySelectorProps {
  onDirectorySelected: (directoryPath: string, files: FileList) => void;
  className?: string;
}

const DirectorySelector: React.FC<DirectorySelectorProps> = ({ 
  onDirectorySelected,
  className = '' 
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };
  
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) {
      setIsDragging(true);
    }
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      const item = e.dataTransfer.items[0];
      if (item.kind === 'file') {
        const entry = item.webkitGetAsEntry();
        if (entry && entry.isDirectory) {
          // We need to use the file input to get the directory contents
          if (fileInputRef.current) {
            fileInputRef.current.click();
          }
        }
      }
    }
  };
  
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = e.target.files;
      console.log(files[0]);
      const directoryPath = files[0].webkitRelativePath.split('/')[0];
      onDirectorySelected(directoryPath, files);
    }
  };
  
  const handleButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };
  
  return (
    <div className={className}>
      <div 
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          isDragging ? 'border-blue-500 bg-blue-50' : ''
        }`}
        style={{ 
          borderColor: isDragging ? 'var(--accent-color)' : 'var(--card-border)',
          backgroundColor: isDragging ? 'rgba(59, 130, 246, 0.1)' : 'var(--card-bg)',
          color: 'var(--primary-text)'
        }}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleButtonClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          webkitdirectory="true"
          directory=""
          className="hidden"
          onChange={handleFileInputChange}
        />
        <div className="flex flex-col items-center justify-center">
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
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" 
            />
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={1.5} 
              d="M12 11v6m-3-3h6" 
            />
          </svg>
          <p className="text-lg font-medium" style={{ color: 'var(--primary-text)' }}>
            Select StealthStation Export Directory
          </p>
          <p className="mt-2" style={{ color: 'var(--secondary-text)' }}>
            Drag and drop a folder or click to browse
          </p>
        </div>
      </div>
    </div>
  );
};

export default DirectorySelector;
