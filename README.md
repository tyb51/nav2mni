# Navigation to MNI Coordinate Converter

This Next.js web application transforms Medtronic StealthStation and BrainLab navigation coordinates to MNI standard space, enabling cross-study comparisons and advanced neuroimaging analyses.

## Overview

The app provides a modern web interface to the core functionality of the original StealthCoordinateConvertor desktop application. It automates the process of:

1. Converting DICOM images to NIfTI format
2. Generating deformation fields for spatial normalization
3. Transforming surgical coordinates from native patient space to MNI space

## Features

- **Upload Interface**: Easily upload StealthStation export data and coordinate files
- **Automatic Processing**: Identifies DICOM directories and coordinate JSON files
- **Step-by-Step Conversion**: Guided workflow through the conversion process
- **Coordinate Visualization**: View original and converted coordinates
- **Console Output**: Detailed logs of each step in the process

## Technical Implementation

The application is built with:

- **Frontend**: Next.js 15, React, TypeScript, and TailwindCSS
- **Backend**: Next.js API routes with Python processing
- **Python Libraries**: nibabel, numpy, dicom2nifti for medical imaging tasks
- **MATLAB Integration**: Optional MATLAB processing for advanced deformation field generation

## Architecture

### Frontend Components

- **DirectorySelector**: File selection interface
- **FileManager**: Manages and displays uploaded files
- **ControlPanel**: Process control buttons and options
- **CoordinateViewer**: Tabular display of coordinate data
- **ConsoleOutput**: Terminal-like log display

### Backend API Routes

- **/api/dicom-convert**: Handles DICOM to NIfTI conversion
- **/api/deformation**: Generates deformation fields using SPM/MATLAB
- **/api/convert-coordinates**: Warps coordinates using deformation fields

### Python Processing

The original Python scripts have been integrated into the web app:
- **coordinatetools.py**: Core coordinate transformation functions
- **stealth_decoder.py**: Parses StealthStation coordinate files
- **custom_dicom_conv.py**: Specialized DICOM conversion

## Usage

1. **Select Source Directory**: Upload a directory containing StealthStation export data
2. **Review Files**: Verify DICOM directory and coordinate file detection
3. **Convert DICOM**: Convert the DICOM images to NIfTI format
4. **Generate Deformation Field**: Create the deformation field for spatial normalization
5. **Convert Coordinates**: Transform the coordinates to MNI space

## Setup & Development

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Install Python dependencies:
   ```
   pip install nibabel numpy dicom2nifti pydicom
   ```
4. Start the development server:
   ```
   npm run dev
   ```

## Requirements

- Node.js 18+
- Python 3.8+
- MATLAB with SPM12 (optional, for advanced deformation field generation)
