/**
 * Types for different file formats used in the application
 */

export interface DicomFile {
  name: string;
  path: string;
  seriesID?: string;
  studyID?: string;
  modality?: string;
}

export interface JsonFile {
  name: string;
  path: string;
  data: any; // Contains parsed JSON data
}

export interface NiftiFile {
  name: string;
  path: string;
  seriesID?: string;
  isT1?: boolean;
}

export interface DeformationFieldFile {
  name: string;
  path: string;
}

export interface OutputFile {
  name: string;
  path: string;
  type: 'nifti' | 'deformation' | 'coordinates' | 'other';
}

export interface Coordinate {
  name: string;
  x: number;
  y: number;
  z: number;
  units: 'VOX' | 'MM';
  orientation: 'LPS' | 'RAS' | 'RPI';
  space: 'IMAGE' | 'PAT' | 'MNI';
}

export interface CoordinateSet {
  original: Coordinate[];
  converted?: Coordinate[];
}
