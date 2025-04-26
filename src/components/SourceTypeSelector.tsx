import React from 'react';

interface SourceTypeSelectorProps {
  sourceType: 'stealth' | 'brainlab';
  onSourceTypeChange: (type: 'stealth' | 'brainlab') => void;
  className?: string;
}

const SourceTypeSelector: React.FC<SourceTypeSelectorProps> = ({
  sourceType,
  onSourceTypeChange,
  className = ''
}) => {
  return (
    <div className={`${className} card p-6 rounded-lg`}>
      <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--primary-text)' }}>Navigation System Type</h2>
      
      <p className="mb-4" style={{ color: 'var(--secondary-text)' }}>
        Select the navigation system that was used to generate the coordinate data:
      </p>
      
      <div className="flex space-x-4">
        <button
          onClick={() => onSourceTypeChange('stealth')}
          className={`flex-1 py-4 px-6 rounded-lg transition-all ease-in-out duration-200 flex flex-col items-center justify-center ${
            sourceType === 'stealth' 
              ? 'border-2 shadow-md'
              : 'border opacity-70 hover:opacity-100'
          }`}
          style={{ 
            borderColor: sourceType === 'stealth' ? 'var(--accent-color)' : 'var(--card-border)',
            backgroundColor: sourceType === 'stealth' ? 'rgba(59, 130, 246, 0.1)' : 'var(--card-bg)',
          }}
        >
          <svg className="w-12 h-12 mb-2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9 17L15 12L9 7V17Z" fill="currentColor" style={{ color: 'var(--accent-color)' }} />
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--accent-color)' }} />
          </svg>
          <span className="font-medium" style={{ color: 'var(--primary-text)' }}>StealthStation</span>
          <span className="text-sm mt-1" style={{ color: 'var(--secondary-text)' }}>Uses JSON coordinate file</span>
        </button>
        
        <button
          onClick={() => onSourceTypeChange('brainlab')}
          className={`flex-1 py-4 px-6 rounded-lg transition-all ease-in-out duration-200 flex flex-col items-center justify-center ${
            sourceType === 'brainlab' 
              ? 'border-2 shadow-md'
              : 'border opacity-70 hover:opacity-100'
          }`}
          style={{ 
            borderColor: sourceType === 'brainlab' ? 'var(--accent-color)' : 'var(--card-border)',
            backgroundColor: sourceType === 'brainlab' ? 'rgba(59, 130, 246, 0.1)' : 'var(--card-bg)',
          }}
        >
          <svg className="w-12 h-12 mb-2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 17L17 12H14V7H10V12H7L12 17Z" fill="currentColor" style={{ color: 'var(--accent-color)' }} />
            <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--accent-color)' }} />
          </svg>
          <span className="font-medium" style={{ color: 'var(--primary-text)' }}>BrainLab</span>
          <span className="text-sm mt-1" style={{ color: 'var(--secondary-text)' }}>Uses DICOM coordinate data</span>
        </button>
      </div>
    </div>
  );
};

export default SourceTypeSelector;
