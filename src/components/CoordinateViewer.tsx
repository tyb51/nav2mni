import React, { useState } from 'react';
import { Coordinate } from '@/types/FileTypes';

interface CoordinateViewerProps {
  originalCoordinates: Coordinate[] | null;
  convertedCoordinates: Coordinate[] | null;
  className?: string;
}

const CoordinateViewer: React.FC<CoordinateViewerProps> = ({ 
  originalCoordinates, 
  convertedCoordinates,
  className = '' 
}) => {
  const [activeTab, setActiveTab] = useState<'original' | 'converted'>('converted');
  
  if (!originalCoordinates && !convertedCoordinates) {
    return (
      <div className={className}>
        <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--primary-text)' }}>Coordinate Viewer</h2>
        <div 
          className="p-8 text-center rounded-lg"
          style={{ 
            backgroundColor: 'var(--card-bg)', 
            borderColor: 'var(--card-border)',
            border: '1px solid',
            color: 'var(--secondary-text)'
          }}
        >
          No coordinates available. Complete the conversion process to view coordinates.
        </div>
      </div>
    );
  }
  
  const displayCoordinates = activeTab === 'original' ? originalCoordinates : convertedCoordinates;
  
  return (
    <div className={className}>
      <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--primary-text)' }}>Coordinate Viewer</h2>
      
      <div className="flex mb-4 border-b" style={{ borderColor: 'var(--card-border)' }}>
        <button
          className={`py-2 px-4 ${activeTab === 'original' ? 'border-b-2 font-medium' : ''}`}
          style={{ 
            borderColor: activeTab === 'original' ? 'var(--accent-color)' : 'transparent',
            color: activeTab === 'original' ? 'var(--accent-color)' : 'var(--secondary-text)'
          }}
          onClick={() => setActiveTab('original')}
        >
          Original Coordinates
        </button>
        <button
          className={`py-2 px-4 ${activeTab === 'converted' ? 'border-b-2 font-medium' : ''}`}
          style={{ 
            borderColor: activeTab === 'converted' ? 'var(--accent-color)' : 'transparent',
            color: activeTab === 'converted' ? 'var(--accent-color)' : 'var(--secondary-text)'
          }}
          onClick={() => setActiveTab('converted')}
        >
          MNI Coordinates
        </button>
      </div>
      
      <div 
        className="overflow-x-auto rounded-lg"
        style={{ 
          backgroundColor: 'var(--card-bg)', 
          borderColor: 'var(--card-border)',
          border: '1px solid'
        }}
      >
        <table className="min-w-full">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--card-border)' }}>
              <th className="py-2 px-4 text-left" style={{ color: 'var(--primary-text)' }}>Name</th>
              <th className="py-2 px-4 text-left" style={{ color: 'var(--primary-text)' }}>X</th>
              <th className="py-2 px-4 text-left" style={{ color: 'var(--primary-text)' }}>Y</th>
              <th className="py-2 px-4 text-left" style={{ color: 'var(--primary-text)' }}>Z</th>
              <th className="py-2 px-4 text-left" style={{ color: 'var(--primary-text)' }}>Units</th>
              <th className="py-2 px-4 text-left" style={{ color: 'var(--primary-text)' }}>Space</th>
            </tr>
          </thead>
          <tbody>
            {displayCoordinates?.map((coord, index) => (
              <tr 
                key={index} 
                className={index % 2 === 0 ? '' : ''}
                style={{ 
                  backgroundColor: index % 2 === 0 ? 'var(--card-bg)' : 'rgba(0,0,0,0.03)',
                  borderBottom: '1px solid var(--card-border)'
                }}
              >
                <td className="py-2 px-4" style={{ color: 'var(--primary-text)' }}>{coord.name}</td>
                <td className="py-2 px-4" style={{ color: 'var(--primary-text)' }}>{coord.x.toFixed(2)}</td>
                <td className="py-2 px-4" style={{ color: 'var(--primary-text)' }}>{coord.y.toFixed(2)}</td>
                <td className="py-2 px-4" style={{ color: 'var(--primary-text)' }}>{coord.z.toFixed(2)}</td>
                <td className="py-2 px-4" style={{ color: 'var(--secondary-text)' }}>{coord.units}</td>
                <td className="py-2 px-4" style={{ color: 'var(--secondary-text)' }}>{coord.space}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CoordinateViewer;
