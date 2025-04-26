import dicom2nifti
from dicom2nifti import common
from pydicom.tag import Tag
import asyncio


def convert_directory_async(inputDirectory, outputDirectory, compression=True, reorient=False):
    dicom2nifti.convert_directory(inputDirectory, outputDirectory, compression=compression, reorient=reorient)


class ConversionOverrideProxy:
    def __init__(self, compression=True, reorient=True, predicate=None, convert_all_modalities=False):
        self.predicate = predicate
        self.reorient = reorient
        self.compression = compression
        self.convert_all_modalities = convert_all_modalities

    def set_predicate(self, predicate):
        self.predicate = predicate

    def set_reorient(self, reorient):
        print("[CONV PROXY] Setting reorientation: " + str(reorient))
        self.reorient = reorient

    def set_compression(self, compression):
        print("[CONV PROXY] Setting compression: " + str(compression))
        self.compression = compression

    def validate_dicom_with_filter(self, dicom_header):
        """
        Function will do some basic checks to see if this is a valid imaging dicom
        """
        # if it is philips and multiframe dicom then we assume it is ok
        try:
            if common.is_philips([dicom_header]) or common.is_siemens([dicom_header]):
                if common.is_multiframe_dicom([dicom_header]):
                    return True

            if "SeriesInstanceUID" not in dicom_header:
                return False

            if "InstanceNumber" not in dicom_header:
                return False

            if "ImageOrientationPatient" not in dicom_header or len(dicom_header.ImageOrientationPatient) < 6:
                return False

            if "ImagePositionPatient" not in dicom_header or len(dicom_header.ImagePositionPatient) < 3:
                return False

            if not self.convert_all_modalities:
                if dicom_header.Modality.upper() != 'MR':
                    return False
                if not (dicom_header.SeriesDescription.upper().contains('T1') or dicom_header.ProtocolName.upper().contains('T1')):
                    return False

            # for all others if there is image position patient we assume it is ok
            if Tag(0x0020, 0x0037) not in dicom_header:
                return False

            return True
        except (KeyError, AttributeError):
            return False
