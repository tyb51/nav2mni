import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ensureDirectory } from '@/utils/pathUtils';

// Max 100MB file size
const MAX_FILE_SIZE = 100 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const sessionId = formData.get('sessionId') as string || uuidv4();
    const sourceType = formData.get('sourceType') as 'stealth' | 'brainlab' || 'stealth';
    const uploadType = formData.get('uploadType') as string || 'unknown';
    
    // Process the file
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }
    
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size exceeds limit (100MB)' },
        { status: 400 }
      );
    }
    
    // Create directory for this session
    const uploadDir = path.join(process.cwd(), 'uploads', sessionId);
    await ensureDirectory(uploadDir);
    
    // Create subdirectory for upload type (dicom, json, etc.)
    let targetDir = uploadDir;
    if (uploadType === 'dicom') {
      targetDir = path.join(uploadDir, 'dicom');
      await ensureDirectory(targetDir);
    } else if (uploadType === 'json') {
      targetDir = path.join(uploadDir, 'json');
      await ensureDirectory(targetDir);
    } else if (uploadType === 'nifti') {
      targetDir = path.join(uploadDir, 'nifti');
      await ensureDirectory(targetDir);
    }
    
    // Path where we'll save the file
    const fileName = file.name.replace(/\s+/g, '_');
    const filePath = path.join(targetDir, fileName);
    
    // For DICOM directory uploads (zip files), we'll extract them
    if (uploadType === 'dicom' && fileName.endsWith('.zip')) {
      // Save the zip file
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      await fs.writeFile(filePath, buffer);
      
      // Extract the zip file
      const extract = await import('extract-zip');
      await extract.default(filePath, { dir: targetDir });
      
      // Delete the zip file after extraction
      await fs.unlink(filePath);
      
      return NextResponse.json({
        success: true,
        sessionId,
        sourceType,
        uploadType,
        message: 'DICOM directory uploaded and extracted',
        uploadedPath: targetDir
      });
    }
    
    // For normal files, just save them directly
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await fs.writeFile(filePath, buffer);
    
    // Create output directory for conversion results
    const outputDir = path.join(uploadDir, 'output');
    await ensureDirectory(outputDir);
    
    return NextResponse.json({
      success: true,
      sessionId,
      sourceType,
      uploadType,
      message: `File uploaded successfully (${uploadType})`,
      uploadedPath: filePath,
      outputPath: outputDir
    });
  } catch (error) {
    console.error('Error in file upload:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: (error as Error).message || 'Unknown error occurred during file upload' 
      },
      { status: 500 }
    );
  }
}

// Endpoint to check upload session status
export async function GET(request: NextRequest) {
  try {
    // Get session ID from query parameter
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    
    if (!sessionId) {
      return NextResponse.json(
        { error: 'No session ID provided' },
        { status: 400 }
      );
    }
    
    // Check if session directory exists
    const sessionDir = path.join(process.cwd(), 'uploads', sessionId);
    const exists = await fs.stat(sessionDir).then(() => true).catch(() => false);
    
    if (!exists) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }
    
    // List files in the session directory
    const files: Record<string, string[]> = {
      dicom: [],
      json: [],
      nifti: [],
      output: []
    };
    
    // Check each subdirectory
    for (const dir of Object.keys(files)) {
      const dirPath = path.join(sessionDir, dir);
      try {
        const dirFiles = await fs.readdir(dirPath);
        files[dir] = dirFiles;
      } catch {
        // Directory might not exist yet
        files[dir] = [];
      }
    }
    
    return NextResponse.json({
      success: true,
      sessionId,
      files,
      sessionPath: sessionDir
    });
  } catch (error) {
    console.error('Error checking session status:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: (error as Error).message || 'Unknown error occurred while checking session status' 
      },
      { status: 500 }
    );
  }
}

// Endpoint to clean up session files
export async function DELETE(request: NextRequest) {
  try {
    // Get session ID from query parameter
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    
    if (!sessionId) {
      return NextResponse.json(
        { error: 'No session ID provided' },
        { status: 400 }
      );
    }
    
    // Check if session directory exists
    const sessionDir = path.join(process.cwd(), 'uploads', sessionId);
    const exists = await fs.stat(sessionDir).then(() => true).catch(() => false);
    
    if (!exists) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }
    
    // Recursively delete the session directory and all its contents
    const rimrafModule = await import('rimraf');
    await rimrafModule.rimraf(sessionDir);
    
    return NextResponse.json({
      success: true,
      message: 'Session files deleted successfully',
      sessionId
    });
  } catch (error) {
    console.error('Error deleting session files:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: (error as Error).message || 'Unknown error occurred while deleting session files' 
      },
      { status: 500 }
    );
  }
}
