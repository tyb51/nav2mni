import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import * as childProcess from 'child_process';
import { promisify } from 'util';
import { resolvePath, resolvePathFromParent, ensureDirectory } from '@/utils/pathUtils';

// Convert callback-based functions to Promise-based
const exec = promisify(childProcess.exec);
const readdir = promisify(fs.readdir);
const writeFile = promisify(fs.writeFile);

export async function POST(request: NextRequest) {
  try {
    const { inputNiftiPath, templateDirectory, outputDirectory } = await request.json();
    
    // Validate input
    if (!inputNiftiPath || !outputDirectory) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Create output directory if it doesn't exist
    await ensureDirectory(outputDirectory);

    // Check if template directory exists or use default
    const templateDir = templateDirectory || path.join(process.cwd(), 'public', 'templates');
    
    // Generate a temporary MATLAB script
    const scriptPath = path.join(process.cwd(), 'temp', 'gen_deform.m');
    
    // Ensure temp directory exists
    await ensureDirectory(path.join(process.cwd(), 'temp'));
    
    // Get absolute file paths to handle both direct and uploaded file paths
    const absoluteInputNiftiPath = resolvePathFromParent(inputNiftiPath);
    const absoluteOutputDir = resolvePath(outputDirectory);
    
    // Create MATLAB script content
    const matlabScript = `
    %% Generate deformation field
    try
        % Add SPM to path
        spmDir = 'C:\\Users\\ketin\\Documents\\MATLAB\\spm12';
        addpath(genpath(spmDir));
        
        % Input parameters
        inputNifti = '${absoluteInputNiftiPath.replace(/\\/g, '\\\\')}';
        templateDir = '${templateDir.replace(/\\/g, '\\\\')}';
        outputDir = '${absoluteOutputDir.replace(/\\/g, '\\\\')}';
        
        % Extract filename without extension
        [~, baseFilename, ~] = fileparts(inputNifti);
        if endsWith(baseFilename, '.nii')
            [~, baseFilename, ~] = fileparts(baseFilename);
        end
        
        % Call SPM batch for normalization
        clear matlabbatch;
        
        % Segment the T1 image
        matlabbatch{1}.spm.spatial.preproc.channel.vols = {inputNifti};
        matlabbatch{1}.spm.spatial.preproc.channel.biasreg = 0.001;
        matlabbatch{1}.spm.spatial.preproc.channel.biasfwhm = 60;
        matlabbatch{1}.spm.spatial.preproc.channel.write = [0 0];
        matlabbatch{1}.spm.spatial.preproc.tissue(1).tpm = {[templateDir '\\tpm\\TPM.nii,1']};
        matlabbatch{1}.spm.spatial.preproc.tissue(1).ngaus = 1;
        matlabbatch{1}.spm.spatial.preproc.tissue(1).native = [1 0];
        matlabbatch{1}.spm.spatial.preproc.tissue(1).warped = [0 0];
        matlabbatch{1}.spm.spatial.preproc.tissue(2).tpm = {[templateDir '\\tpm\\TPM.nii,2']};
        matlabbatch{1}.spm.spatial.preproc.tissue(2).ngaus = 1;
        matlabbatch{1}.spm.spatial.preproc.tissue(2).native = [1 0];
        matlabbatch{1}.spm.spatial.preproc.tissue(2).warped = [0 0];
        matlabbatch{1}.spm.spatial.preproc.tissue(3).tpm = {[templateDir '\\tpm\\TPM.nii,3']};
        matlabbatch{1}.spm.spatial.preproc.tissue(3).ngaus = 2;
        matlabbatch{1}.spm.spatial.preproc.tissue(3).native = [1 0];
        matlabbatch{1}.spm.spatial.preproc.tissue(3).warped = [0 0];
        matlabbatch{1}.spm.spatial.preproc.tissue(4).tpm = {[templateDir '\\tpm\\TPM.nii,4']};
        matlabbatch{1}.spm.spatial.preproc.tissue(4).ngaus = 3;
        matlabbatch{1}.spm.spatial.preproc.tissue(4).native = [1 0];
        matlabbatch{1}.spm.spatial.preproc.tissue(4).warped = [0 0];
        matlabbatch{1}.spm.spatial.preproc.tissue(5).tpm = {[templateDir '\\tpm\\TPM.nii,5']};
        matlabbatch{1}.spm.spatial.preproc.tissue(5).ngaus = 4;
        matlabbatch{1}.spm.spatial.preproc.tissue(5).native = [1 0];
        matlabbatch{1}.spm.spatial.preproc.tissue(5).warped = [0 0];
        matlabbatch{1}.spm.spatial.preproc.tissue(6).tpm = {[templateDir '\\tpm\\TPM.nii,6']};
        matlabbatch{1}.spm.spatial.preproc.tissue(6).ngaus = 2;
        matlabbatch{1}.spm.spatial.preproc.tissue(6).native = [0 0];
        matlabbatch{1}.spm.spatial.preproc.tissue(6).warped = [0 0];
        matlabbatch{1}.spm.spatial.preproc.warp.mrf = 1;
        matlabbatch{1}.spm.spatial.preproc.warp.cleanup = 1;
        matlabbatch{1}.spm.spatial.preproc.warp.reg = [0 0.001 0.5 0.05 0.2];
        matlabbatch{1}.spm.spatial.preproc.warp.affreg = 'mni';
        matlabbatch{1}.spm.spatial.preproc.warp.fwhm = 0;
        matlabbatch{1}.spm.spatial.preproc.warp.samp = 3;
        matlabbatch{1}.spm.spatial.preproc.warp.write = [1 1];
        matlabbatch{1}.spm.spatial.preproc.warp.vox = NaN;
        matlabbatch{1}.spm.spatial.preproc.warp.bb = [NaN NaN NaN; NaN NaN NaN];
        
        % Run the batch job
        spm_jobman('run', matlabbatch);
        
        % Get the output deformation field files
        [inputDir, inputFile, inputExt] = fileparts(inputNifti);
        forwardDeformationFile = fullfile(inputDir, ['y_' inputFile inputExt]);
        inverseDeformationFile = fullfile(inputDir, ['iy_' inputFile inputExt]);
        
        % Move files to output directory if different from input directory
        if ~strcmp(inputDir, outputDir)
            if exist(forwardDeformationFile, 'file')
                [~, forwardName, forwardExt] = fileparts(forwardDeformationFile);
                movefile(forwardDeformationFile, fullfile(outputDir, [forwardName forwardExt]));
                forwardDeformationFile = fullfile(outputDir, [forwardName forwardExt]);
            end
            
            if exist(inverseDeformationFile, 'file')
                [~, inverseName, inverseExt] = fileparts(inverseDeformationFile);
                movefile(inverseDeformationFile, fullfile(outputDir, [inverseName inverseExt]));
                inverseDeformationFile = fullfile(outputDir, [inverseName inverseExt]);
            end
        end
        
        % Output success
        disp('Deformation field generation completed successfully');
        disp(['Forward deformation field: ' forwardDeformationFile]);
        disp(['Inverse deformation field: ' inverseDeformationFile]);
        exit(0);
    catch ME
        disp(['Error: ' ME.message]);
        for i = 1:length(ME.stack)
            disp(['File: ' ME.stack(i).file ', Line: ' num2str(ME.stack(i).line) ', Function: ' ME.stack(i).name]);
        end
        exit(1);
    end
    `;
    
    // Write the MATLAB script to file
    await writeFile(scriptPath, matlabScript);
    
    // Execute MATLAB script
    // Use absolute paths to avoid directory issues
    const absoluteScriptPath = path.isAbsolute(scriptPath) ? 
      scriptPath : path.join(process.cwd(), scriptPath);
      
    const command = `matlab -nosplash -nodesktop -r "run('${absoluteScriptPath.replace(/\\/g, '\\\\')}')"`;
    
    const { stdout, stderr } = await exec(command, { timeout: 300000 }); // 5-minute timeout
    
    // Check for deformation field files
    const files = await readdir(outputDirectory);
    const deformationFiles = files.filter(file => file.startsWith('y_') || file.startsWith('iy_'));
    
    return NextResponse.json({
      success: true,
      message: 'Deformation field generation completed',
      stdout,
      stderr,
      deformationFiles
    });
  } catch (error) {
    console.error('Error in deformation field generation:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: (error as Error).message || 'Unknown error occurred during deformation field generation' 
      },
      { status: 500 }
    );
  }
}
