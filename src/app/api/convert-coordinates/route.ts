import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import * as childProcess from 'child_process';
import { promisify } from 'util';
import { resolvePath, resolvePathFromParent, ensureDirectory } from '@/utils/pathUtils';

// Convert callback-based functions to Promise-based
const exec = promisify(childProcess.exec);
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

export async function POST(request: NextRequest) {
  try {
    const { 
      niftiFilePath, 
      jsonFilePath, 
      dicomDirectory,
      deformationFieldPath, 
      outputDirectory,
      templatePath,
      sourceType = 'stealth'
    } = await request.json();
    
    // Validate input
    if (!niftiFilePath || !jsonFilePath || !deformationFieldPath || !outputDirectory) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Prepare temporary Python script to handle coordinate conversion
    const pythonScript = `
import json
import nibabel as nib
import numpy as np
import sys
import os

# Import our custom modules from the original project
sys.path.append("${process.cwd().replace(/\\/g, '/')}/src/python")
import stealth_decoder
import brainlab_decoder
import coordinatetools

def main():
    # Load the input files
    nifti_file = "${niftiFilePath.replace(/\\/g, '/')}"
    json_file = "${jsonFilePath.replace(/\\/g, '/')}"
    dicom_dir = "${dicomDirectory ? dicomDirectory.replace(/\\/g, '/') : ''}"
    deformation_field = "${deformationFieldPath.replace(/\\/g, '/')}"
    template_path = "${templatePath ? templatePath.replace(/\\/g, '/') : ''}" or None
    output_dir = "${outputDirectory.replace(/\\/g, '/')}"
    source_type = "${sourceType}"  # 'stealth' or 'brainlab'
    
    # Check if files exist
    if not os.path.exists(nifti_file):
        print(f"Error: Nifti file not found: {nifti_file}")
        return False
        
    if not os.path.exists(json_file):
        print(f"Error: JSON file not found: {json_file}")
        return False
        
    if not os.path.exists(deformation_field):
        print(f"Error: Deformation field not found: {deformation_field}")
        return False
    
    # Load the MR volume
    try:
        mr_vol = nib.load(nifti_file)
        print(f"Loaded T1 MR file: {nifti_file}")
    except Exception as e:
        print(f"Error loading MR volume: {str(e)}")
        return False
    
    # Load JSON file with coordinates
    try:
        with open(json_file, 'r') as f:
            json_data = json.load(f)
        patient = stealth_decoder.decodePatient(json_data)
        print(f"Loaded coordinate file for patient: {patient.name}, MRN: {patient.mrn}")
    except Exception as e:
        print(f"Error loading JSON file: {str(e)}")
        return False
    
    # Extract series ID from nifti file
    try:
        series_id = stealth_decoder.extract_seriesID(os.path.basename(nifti_file))
        mr_exam = next(filter(lambda x: x.seriesID == series_id, patient.exams), None)
        
        if mr_exam is None:
            print(f"Error: The volume with series ID {series_id} was not found in the stealth JSON file.")
            return False
            
        print(f"Found T1 MR exam: {mr_exam.name[0]}, ID: {mr_exam.studyID}")
    except Exception as e:
        print(f"Error extracting series info: {str(e)}")
        return False
    
    # Convert coordinates
    try:
        original_coords = []
        
        if source_type == 'stealth':
            # Original LPS coordinates from JSON
            print("Using StealthStation coordinate conversion")
            for point in patient.pointmap["LPS"]:
                # Convert to voxel space based on reference exam
                vol_t_ref = mr_exam.mtcs.get('volumeTreference')
                if vol_t_ref is not None:
                    # If points are in a reference exam space (most cases)
                    conv = stealth_decoder.convRefToTargetCoo(point, vol_t_ref, mr_vol)
                else:
                    # If MR is the only series in the list
                    conv = stealth_decoder._stealth_lps_to_target_ori_voxel(point, mr_vol)
                
                original_coords.append(conv)
                print(f"Converted StealthStation voxel coordinate: {conv}")
        
        elif source_type == 'brainlab':
            # BrainLab DICOM to coordinates
            print("Using BrainLab coordinate conversion")
            if not dicom_dir or not os.path.exists(dicom_dir):
                print(f"Error: BrainLab conversion requires DICOM directory: {dicom_dir}")
                return False
                
            # Extract series ID for target search
            series_id = stealth_decoder.extract_seriesID(os.path.basename(nifti_file))
            
            # Extract points from BrainLab DICOM
            extracted_points = brainlab_decoder.extract_points_from_dicom(dicom_dir, target_series_uid=series_id)
            
            # Use extracted points directly
            original_coords = extracted_points
            print(f"Extracted {len(extracted_points)} coordinates from BrainLab DICOM")
            for coord in extracted_points:
                print(f"BrainLab coordinate: {coord}")
        
        else:
            print(f"Error: Unknown source type: {source_type}")
            return False
            
        if not original_coords:
            print("Error: No coordinates found to convert")
            return False
    except Exception as e:
        print(f"Error converting coordinates: {str(e)}")
        return False
    
    # Warp coordinates using deformation field
    try:
        df_vol = nib.load(deformation_field)
        template_nifti = template_path if template_path else None
        
        warped_coords = coordinatetools.warpCoordinates(
            coordinates=original_coords,
            df_path_or_img=deformation_field,
            input_vol_path_or_img=mr_vol,
            output_vol_path_or_img=template_nifti,
            convert_output_to_vox=False
        )
        
        print("Warped coordinates to MNI space:")
        for coord in warped_coords:
            print(str(coord))
    except Exception as e:
        print(f"Error warping coordinates: {str(e)}")
        return False
    
    # Save the results to JSON
    try:
        # Create output file
        output_file = os.path.join(output_dir, "converted_coordinates.json")
        
        # Format the coordinates for output
        output_data = {
            "original": [
                {
                    "name": coord.name,
                    "x": float(coord.x),
                    "y": float(coord.y),
                    "z": float(coord.z),
                    "units": coord.units,
                    "orientation": coord.orientation,
                    "space": coord.space
                } for coord in original_coords
            ],
            "warped": [
                {
                    "name": coord.name,
                    "x": float(coord.x),
                    "y": float(coord.y),
                    "z": float(coord.z),
                    "units": coord.units,
                    "orientation": coord.orientation,
                    "space": coord.space
                } for coord in warped_coords
            ],
            "patient": {
                "name": patient.name,
                "mrn": patient.mrn
            },
            "sources": {
                "nifti": nifti_file,
                "json": json_file,
                "deformation": deformation_field
            }
        }
        
        with open(output_file, 'w') as f:
            json.dump(output_data, f, indent=2)
            
        print(f"Saved converted coordinates to: {output_file}")
        return True
    except Exception as e:
        print(f"Error saving coordinates: {str(e)}")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
    `;
    
    // Write Python script to temporary file
    const scriptPath = path.join(process.cwd(), 'temp', 'convert_coordinates.py');
    
    // Create temp directory if it doesn't exist
    await ensureDirectory(path.join(process.cwd(), 'temp'));
    
    // Convert all paths to absolute paths for the Python script
    const absoluteNiftiPath = resolvePathFromParent(niftiFilePath);
    const absoluteJsonPath = resolvePathFromParent(jsonFilePath);
    const absoluteDicomDir = dicomDirectory ? resolvePathFromParent(dicomDirectory) : '';
    const absoluteDeformationPath = resolvePathFromParent(deformationFieldPath);
    const absoluteOutputDir = resolvePath(outputDirectory);
    
    // Update Python script with absolute paths
    const updatedScript = pythonScript
      .replace(niftiFilePath.replace(/\\/g, '/'), absoluteNiftiPath.replace(/\\/g, '/'))
      .replace(jsonFilePath.replace(/\\/g, '/'), absoluteJsonPath.replace(/\\/g, '/'))
      .replace(dicomDirectory ? dicomDirectory.replace(/\\/g, '/') : '', absoluteDicomDir.replace(/\\/g, '/'))
      .replace(deformationFieldPath.replace(/\\/g, '/'), absoluteDeformationPath.replace(/\\/g, '/'))
      .replace(outputDirectory.replace(/\\/g, '/'), absoluteOutputDir.replace(/\\/g, '/'));
    
    await writeFile(scriptPath, updatedScript);
    
    // Use 'python3' on Unix systems or 'python' on Windows
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    
    // Use absolute paths to avoid directory issues
    const absoluteScriptPath = path.isAbsolute(scriptPath) ? 
      scriptPath : path.join(process.cwd(), scriptPath);
    
    // Execute Python script
    const { stdout, stderr } = await exec(`${pythonCmd} "${absoluteScriptPath}"`, { timeout: 60000 });
    
    // Check for output file
    const outputFilePath = path.join(outputDirectory, 'converted_coordinates.json');
    let coordinates = null;
    
    if (fs.existsSync(outputFilePath)) {
      // Read the output file
      const jsonData = await readFile(outputFilePath, 'utf8');
      coordinates = JSON.parse(jsonData);
    }
    
    return NextResponse.json({
      success: coordinates !== null,
      message: coordinates !== null ? 'Coordinate conversion completed' : 'Conversion failed',
      stdout,
      stderr,
      coordinates
    });
  } catch (error) {
    console.error('Error in coordinate conversion:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: (error as Error).message || 'Unknown error occurred during coordinate conversion'
      },
      { status: 500 }
    );
  }
}
