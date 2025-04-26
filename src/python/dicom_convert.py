#!/usr/bin/env python
"""
Script to convert DICOM images to NIfTI format
This script is called by the web backend to convert DICOM files to NIfTI format.
"""

import os
import sys
import argparse
import traceback
import logging

# Import directly from the same directory
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(current_dir)
import custom_dicom_conv as cdc

def setup_logging():
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler(sys.stdout)
        ]
    )
    return logging.getLogger(__name__)

def parse_arguments():
    parser = argparse.ArgumentParser(description='Convert DICOM images to NIfTI format')
    parser.add_argument('--dicom_dir', required=True, help='Directory containing DICOM files')
    parser.add_argument('--output_dir', required=True, help='Output directory for NIfTI files')
    parser.add_argument('--convert_all', action='store_true', help='Convert all image series (not just T1)')
    parser.add_argument('--series_id', help='Override series ID for selection')
    parser.add_argument('--compression', action='store_true', help='Enable compression')
    parser.add_argument('--reorient', action='store_true', help='Enable reorientation')
    
    return parser.parse_args()

def main():
    logger = setup_logging()
    args = parse_arguments()
    
    logger.info(f"Starting DICOM conversion from: {args.dicom_dir}")
    logger.info(f"Output directory: {args.output_dir}")
    logger.info(f"Convert all series: {args.convert_all}")
    logger.info(f"Series ID override: {args.series_id}")
    
    try:
        # Create output directory if it doesn't exist
        os.makedirs(args.output_dir, exist_ok=True)
        
        # Call the conversion function
        converted_files = cdc.convert_directory(
            dicom_directory=args.dicom_dir,
            output_folder=args.output_dir,
            compression=args.compression,
            conv_all=args.convert_all,
            reorient=args.reorient,
            series_id_override=args.series_id
        )
        
        if converted_files:
            logger.info(f"Successfully converted {len(converted_files)} files:")
            for file in converted_files:
                logger.info(f"- {file}")
            return 0
        else:
            logger.error("No files were converted")
            return 1
            
    except Exception as e:
        logger.error(f"Error during conversion: {str(e)}")
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    sys.exit(main())
