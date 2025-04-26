import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import * as childProcess from 'child_process';
import { promisify } from 'util';
import { resolvePath, resolvePathFromParent, ensureDirectory } from '@/utils/pathUtils';

// Convert callback-based functions to Promise-based
const exec = promisify(childProcess.exec);
const readdir = promisify(fs.readdir);

export async function POST(request: NextRequest) {
  try {
    const { dicomDirectory, outputDirectory, convertAll, seriesIdOverride } = await request.json();
    
    // Validate input
    if (!dicomDirectory || !outputDirectory) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Create output directory if it doesn't exist
    await ensureDirectory(outputDirectory);

    // Build Python command
    const pythonScript = path.join(process.cwd(), 'src', 'python', 'dicom_convert.py');
    
    // Use 'python3' on Unix systems or 'python' on Windows
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    
    // Get absolute file paths - try both direct and parent directory resolution
    // This handles cases where the path might be relative to the upload directory
    const absoluteDicomDir = resolvePathFromParent(dicomDirectory);
    const absoluteOutputDir = resolvePath(outputDirectory);
    
    let command = `${pythonCmd} "${pythonScript}" --dicom_dir "${absoluteDicomDir}" --output_dir "${absoluteOutputDir}"`;
    
    if (convertAll) {
      command += ' --convert_all';
    }
    
    if (seriesIdOverride) {
      command += ` --series_id "${seriesIdOverride}"`;
    }

    // Execute the Python script
    const { stdout, stderr } = await exec(command);
    
    // Check for converted files
    const files = await readdir(outputDirectory);
    const niftiFiles = files.filter(file => file.endsWith('.nii') || file.endsWith('.nii.gz'));
    
    return NextResponse.json({
      success: true,
      message: 'DICOM conversion completed',
      stdout,
      stderr,
      convertedFiles: niftiFiles
    });
  } catch (error) {
    console.error('Error in DICOM conversion:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: (error as Error).message || 'Unknown error occurred during DICOM conversion' 
      },
      { status: 500 }
    );
  }
}
