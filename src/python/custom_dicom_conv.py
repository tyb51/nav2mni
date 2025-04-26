"Adapted from the pydicom. Some custom implementation of the conversion algorithm "
import traceback

import unicodedata
import re
import pydicom
import gc
from pydicom.tag import Tag

import dicom2nifti.common as common
import dicom2nifti.convert_dicom as convert_dicom
import dicom2nifti.settings

import os
import logging

logger = logging.getLogger(__name__)


def convert_directory(dicom_directory, output_folder, conv_all=False, compression=True, reorient=True, series_id_override=None):
    """
    This function will order all dicom files by series and order them one by one
    :param conv_all: convert all series in the dicom folder or try to limit to T1 MRI
    :param compression: enable or disable gzip compression
    :param reorient: reorient the dicoms according to LAS orientation
    :param output_folder: folder to write the nifti files to
    :param dicom_directory: directory with dicom files
    :return outputs: List of file path strings of converted Series
    """
    # sort dicom files by series uid
    dicom_series = {}
    for root, _, files in os.walk(dicom_directory):
        for dicom_file in files:
            file_path = os.path.join(root, dicom_file)
            # noinspection PyBroadException
            try:
                if common.is_dicom_file(file_path):
                    # read the dicom as fast as possible
                    # (max length for SeriesInstanceUID is 64 so defer_size 100 should be ok)

                    dicom_headers = pydicom.read_file(file_path,
                                                      defer_size="1 KB",
                                                      stop_before_pixels=False,
                                                      force=dicom2nifti.settings.pydicom_read_force)
                    if not _is_valid_imaging_dicom(dicom_headers, conv_all, series_id_override):
                        logger.info("Skipping: %s" % file_path)
                        continue
                    logger.info("Organizing: %s" % file_path)
                    if dicom_headers.SeriesInstanceUID not in dicom_series:
                        dicom_series[dicom_headers.SeriesInstanceUID] = []
                    dicom_series[dicom_headers.SeriesInstanceUID].append(dicom_headers)
            except:  # Explicitly capturing all errors here to be able to continue processing all the rest
                logger.warning("Unable to read: %s" % file_path)
                traceback.print_exc()
    outputs = []
    # start converting one by one
    for series_id, dicom_input in dicom_series.items():
        base_filename = ""
        # noinspection PyBroadException
        try:
            # construct the filename for the nifti
            base_filename = "MR"
            if 'SeriesNumber' in dicom_input[0]:
                # uncomment if you want te have the series number first
                base_filename = _remove_accents('%s_%s' % (base_filename,
                                                           dicom_input[0].SeriesNumber))
                if 'SeriesDescription' in dicom_input[0] and 'T1' in dicom_input[0].SeriesDescription.upper():
                    base_filename = _remove_accents('%s_%s' % (base_filename,
                                                               dicom_input[0].SeriesDescription))

                elif 'SequenceName' in dicom_input[0] and 'T1' in dicom_input[0].SequenceName.upper():
                    base_filename = _remove_accents('%s_%s' % (base_filename,
                                                               dicom_input[0].SequenceName))

                elif 'ProtocolName' in dicom_input[0] and 'T1' in dicom_input[0].ProtocolName.upper():
                    base_filename = _remove_accents('%s_%s' % (base_filename,
                                                               dicom_input[0].ProtocolName))
            else:
                base_filename = _remove_accents(dicom_input[0].SeriesInstanceUID)
            # Necessary for recognition by the conversion algo
            # base_filename = _remove_accents('%s_%s' % (base_filename, dicom_input[0].get("StudyID", 'StudyID not found')))
            logger.info('--------------------------------------------')
            logger.info('Start converting %s' % base_filename)
            if compression:
                nifti_file = os.path.join(output_folder, base_filename + '.nii.gz')
            else:
                nifti_file = os.path.join(output_folder, base_filename + '.nii')

            outputs.append(nifti_file)
            if not os.path.isfile(nifti_file):
                convert_dicom.dicom_array_to_nifti(dicom_input, nifti_file, reorient)
            gc.collect()
            return outputs
        except:  # Explicitly capturing app exceptions here to be able to continue processing
            logger.info("Unable to convert: %s" % base_filename)
            traceback.print_exc()


def _is_valid_imaging_dicom(dicom_header, conv_all, override):
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

        if not conv_all:
            if dicom_header.Modality.upper() != 'MR':
                return False
            if not ('T1' in dicom_header.get("SeriesDescription", "").upper()
                    or 'T1' in dicom_header.get("ProtocolName", "").upper()
                    or 'T1' in dicom_header.get("SequenceName", "").upper()):
                if dicom_header.get("SeriesNumber", "-1") != override:
                    return False

        # for all others if there is image position patient we assume it is ok
        if Tag(0x0020, 0x0037) not in dicom_header:
            return False

        return True
    except (KeyError, AttributeError):
        return False


def _remove_accents(unicode_filename):
    """
    Function that will try to remove accents from a unicode string to be used in a filename.
    input filename should be either an ascii or unicode string
    """
    # noinspection PyBroadException
    try:
        unicode_filename = unicode_filename.replace(" ", "_")
        cleaned_filename = unicodedata.normalize('NFKD', unicode_filename).encode('ASCII', 'ignore').decode('ASCII')

        cleaned_filename = re.sub(r'[^\w\s-]', '', cleaned_filename.strip().lower())
        cleaned_filename = re.sub(r'[-\s]+', '-', cleaned_filename)

        return cleaned_filename
    except:
        traceback.print_exc()
        return unicode_filename


def _remove_accents_(unicode_filename):
    """
    Function that will try to remove accents from a unicode string to be used in a filename.
    input filename should be either an ascii or unicode string
    """
    valid_characters = bytes(b'-_.() 1234567890abcdefghijklmnopqrstuvwxyz')
    cleaned_filename = unicodedata.normalize('NFKD', unicode_filename).encode('ASCII', 'ignore')

    new_filename = ""

    for char_int in bytes(cleaned_filename):
        char_byte = bytes([char_int])
        if char_byte in valid_characters:
            new_filename += char_byte.decode()

    return new_filename
