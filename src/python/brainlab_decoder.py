import pydicom
import coordinatetools as ct
from pydicom.fileset import FileSet
import array
from dataclasses import dataclass
import numpy as np
import numpy.linalg as lin
from typing import Type, Union

from imp import reload
reload(ct)


@dataclass
class BrainlabTags:
    """
    Brainlab DICOM private attribute container.
    Useful for updating if any tags change in Brainlab export.
    """
    SegmentSequence = 0x00620002
    SurfaceSequence = 0x00660002
    TypeCodeSequence = 0x00671001
    TypeCode = 0x00080100
    SegmentLabel = 0x00620005
    SurfacePointsSequence = 0x00660011
    PointCoordinatesData = 0x00660016
    ReferenceSeriesSequence = 0x00081115
    SeriesInstanceUID = 0x0020000E

    ##Necessary for frameOfReference decoding
    RegistrationSequence = 0x00700308
    MatrixRegistrationSequence = 0x00700309
    MatrixSequence = 0x0070030A
    FrameOfReferenceTransformMatrix = 0x300600C6

    FrameOfReferenceUID = 0x00200052
    ReferenceInstanceSequence = 0x00081140
    StudiesContainingOtherReferencedInstancesSequence = 0x00081200
    ReferencedSOPInstanceUID = 0X00081155


def determine_orientation(image_orientation_patient):
    """
    Determine the orientation (RAS, LAS, LPS, RPS) from the Image Orientation Patient attribute.

    Returns:
        str: The orientation as a string.
    """
    row_cosines = image_orientation_patient[:3]
    col_cosines = image_orientation_patient[3:]

    if row_cosines[0] > 0 and col_cosines[1] > 0:
        return "RAS"
    elif row_cosines[0] < 0 and col_cosines[1] > 0:
        return "LAS"
    elif row_cosines[0] < 0 and col_cosines[1] < 0:
        return "LPS"
    elif row_cosines[0] > 0 and col_cosines[1] < 0:
        return "RPS"
    else:
        return "Unknown"


def extract_points_from_dicom(dicom_dir: str, target_series_uid: str = None, search_target_str: str = None):
    """
    Extract labeled points from a Brainlab DICOM file.

    Args:
        dicom_dir (str): Path to the DICOM directory.
        target_series_uid (str, optional):  If specified, points are converted to this series.
        search_target_str (str, optional): If target_series_uid is None, search for a series containing this string in its description or protocol name.

    Returns:
        list[ct.Point]: A list of extracted points.
    """
    dicom_file = pydicom.filereader.dcmread(dicom_dir)
    
    # Convert to FileSet to easilyAcces data without iterating trough Patients -> exams - > studies -> ..
    file_set = FileSet(dicom_file)
    point_slices = file_set.find(SeriesDescription='Points and Trajectories')

    if target_series_uid is None and search_target_str is not None:        
        # If target is not defined and a search string is provided, find the target series based on the search string.
        target_series_uid = _find_target_series_uid_by_string(file_set, search_target_str)

    conversion_matrices = []
    if target_series_uid is not None:
        #calculate all conversion matrices for possible conversion target_series
        conversion_matrices = _generate_conversion_matrices(file_set)

    collected_points = []
    for point_slice in point_slices:
        dicom_data = point_slice.load()
        # Two sequences in the DICOM file that contain our information.
        # dc represents the DICOM data. Individual attributes and their values can be accessed as python dicts.
        # eg dc[0x00620002] is attribute SegmentSequence at Tag (0062,0002). As this is a sequence it is a list of dicts by itself

        segments = dicom_data[BrainlabTags.SegmentSequence]
        surfaces = dicom_data[BrainlabTags.SurfaceSequence]

        for idx, segment in enumerate(segments):
            segment_type = segment[BrainlabTags.TypeCodeSequence][0]

            # 'BL-0005' is Labeled Point according to BL Conformance-Statement
            # Brainlab Type Code Sequence for Labeled Point is: (BL-S14-1, BL-0005, Labeled Point)
            # Just using the tag for now
            if segment_type[BrainlabTags.TypeCode].value != 'BL-0005':
                continue

            label = segment[BrainlabTags.SegmentLabel].value
            surface = surfaces[idx]
            # SurfacePointsSequence attribute should only have one entry
            points = surface[BrainlabTags.SurfacePointsSequence][0]
            raw_bytes = points[BrainlabTags.PointCoordinatesData].value
            xyz = array.array('f', raw_bytes).tolist()

            #Brainlab stores coordinates in the LPS coordinate systems
            extracted_point = ct.Point(label, xyz[0], xyz[1], xyz[2], units='MM', orientation='LPS', space='PAT')
            # ReferenceSeriesSequence should only contain 1 item
            reference_series_uid = dicom_data[BrainlabTags.ReferenceSeriesSequence][0][BrainlabTags.SeriesInstanceUID].value

            reference_attributes = _getattr_from_loaded_series(file_set, reference_series_uid, 'ProtocolName',
                                                               'ImageOrientationPatient')
            
            # Destect the orientation of the DICOM volume. When converting to NiFTI it will retain the same orientation as the DICOM volume.
            # But brainlab always uses LPS coordinate systems
            image_orientation = determine_orientation(reference_attributes['ImageOrientationPatient'])

            # Correct the axes op the point to the orientation of the specific DICOM volume. This has to be done Here especially for the volumes that are not on the desired (T1) target volume
            # Doing the 'convert_coordinate()' function below will not work with coordinates that are not oriented according to the orientation of the volume they are defined in.
            extracted_point = ct._correct_coordinate_for_vol_orientation(image_orientation, extracted_point, 'source_vol',[])
         

            print(extracted_point, 'in volume: ', reference_attributes['ProtocolName'], ' with estimated orientation: ', image_orientation)

            if target_series_uid is not None and reference_series_uid != target_series_uid:
                matching_conversion_matrix = next(
                    filter(lambda x: x.ref == reference_series_uid and x.target == target_series_uid,
                           conversion_matrices), None)
                if matching_conversion_matrix is not None:
                    if extracted_point.orientation != image_orientation:
                        raise ValueError(f"[convert_coordinate] Orientation mismatch between DICOM volume {reference_attributes['ProtocolName']} and point {extracted_point}. DICOM volume orientation: {image_orientation}, point orientation: {extracted_point.orientation}")
                    extracted_point = matching_conversion_matrix.convert_coordinate(extracted_point)
                    target_attributes = _getattr_from_loaded_series(file_set, target_series_uid, 'ProtocolName')
                    print('Converted to target: ', target_attributes['ProtocolName'], ': ', extracted_point)

            collected_points.append(extracted_point)

    return collected_points

class ConversionMatrix:
    """
    Represents a conversion matrix between two coordinate systems.
    """

    def __init__(self, ref: str, target: str, matrix):
        """
        Initializes a ConversionMatrix.

        Args:
            ref (str): Reference series UID.
            target (str): Target series UID.
            matrix (np.ndarray): 4x4 conversion matrix.
        """
        self.ref = ref
        self.target = target
        self.matrix = matrix

    def convert_coordinate(self, coordinate: Union[Type[ct.Point], Type[np.ndarray]]):
        """
        Converts a coordinate using the conversion matrix.

        Args:
            coordinate (Union[Type[ct.Point], Type[np.ndarray]]): The coordinate to convert (ct.Point or np.ndarray).

        Returns:
            Union[Type[ct.Point], Type[np.ndarray]]: The converted coordinate.

        Raises:
            ValueError: If the coordinate format is unsupported.
        """
        if isinstance(coordinate, ct.Point):
            return coordinate.mult(self.matrix)
        elif isinstance(coordinate, np.ndarray):
            return np.matmul(self.matrix, coordinate)
        else:
            raise ValueError(
                f"[BL decoder][Conversion matrix] unsupported coordinate format: {type(coordinate)}")


def _getattr_from_loaded_series(file_set: FileSet, series_uid: str, *attributes: str):
    """
    Extracts attributes from a loaded series.

    Args:
        file_set (FileSet): The FileSet containing the DICOM data.
        series_uid (str): The series UID.
        *attributes (str): Variable number of attributes to extract.

    Returns:
        dict: A dictionary containing the extracted attributes and their values.
    """
    reference_volume = file_set.find(SeriesInstanceUID=series_uid)[0]
    if reference_volume is not None:
        reference = reference_volume.load()
        result_dict = {key: reference[key].value for key in attributes}
        return result_dict
    return None


def _inverse_conversion_matrix(conversion_matrix: ConversionMatrix) -> ConversionMatrix:
    """
    Calculates the inverse of a conversion matrix.
    """
    return ConversionMatrix(conversion_matrix.target, conversion_matrix.ref, lin.inv(conversion_matrix.matrix))


def _extract_frame_of_references(file_set: FileSet) -> list[str]:
    """
    Extracts unique Frame of Reference UIDs from the FileSet.
    Computation expensive. find_values param `load` need to be True because of the nested key: FrameOfReferenceUID
    
    Args:
        file_set (FileSet): FileSet based on DICOM files of interest.

    Returns:
        list[str]: A list of unique frame of reference UIDs.
    """
    return file_set.find_values("FrameOfReferenceUID", load=True)


def _extract_series_in_frame_of_reference(file_set: FileSet, reference: str) -> list[str]:
    """
      Find all slices with a specific FrameOfReference: reference.
      From these slices find the unique SeriesInstanceUID values (as in all series within this Specific Frame of Reference.
      Find the slices again with FileSet.find (could just filter vals). And keep the first slice t

    Args:
        file_set (FileSet): FileSet based on DICOM files of interest.
        reference (str): FrameOfReferenceUID string.

    Returns:
        list[str]: A list of unique series instance UIDs within the specified frame of reference.
    """
    series_list = []
    slices_in_reference = file_set.find(FrameOfReferenceUID=reference, load=True)
    series_uids = file_set.find_values("SeriesInstanceUID", instances=slices_in_reference)

    for series_uid in series_uids:
        series = file_set.find(SeriesInstanceUID=series_uid)[0]
        modality = series.Modality
        if modality == 'MR' or modality == 'CT':
            series_list.append(series_uid)
    return series_list


def _find_target_series_uid_by_string(file_set: FileSet, search_string: str):
    """
    Find all values of SeriesDescription. Check if a value contains T1. If so find all files with this SeriesDescription and find the first value with a valid SerieesInstanceUID.
    If none found repeat same steps for ProtocollName

    Args:
        file_set (FileSet): FileSet based on DICOM files of interest.
        search_string (str): Search string for partial string matching (case-insensitive).

    Returns:
        str: The target series UID if found, otherwise None.
    """
    descriptions = file_set.find_values("SeriesDescription")
    for description in descriptions:
        if search_string.lower() in description.lower():
            series = file_set.find(SeriesDescription=description)
            for s in series:
                uid = s.SeriesInstanceUID
                if uid is not None:
                    print('Found target series UID from string in SeriesDescription', search_string.lower(),
                          ', SeriesDescription: ', description, '. UID: ', uid)
                    return uid

    protocols = file_set.find_values("ProtocolName")
    for protocol in protocols:
        if search_string.lower() in protocol.lower():
            series = file_set.find(ProtocolName=protocol)
            for s in series:
                uid = s.SeriesInstanceUID
                if uid is not None:
                    print('Found target series UID from string in ProtocolName', search_string.lower(), ', protocol: ',
                          protocol, '. UID: ', uid)
                    return uid

    return None


def _generate_conversion_matrices(file_set: FileSet) -> list[ConversionMatrix]:
    """
    Generates conversion matrices from REG series.

    Args:
        file_set (FileSet): The FileSet containing the DICOM data.

    Returns:
        list[ConversionMatrix]: A list of conversion matrices.
    """
    reg_slices = file_set.find(SeriesDescription='Image Fusions', Modality='REG')
    conversion_matrices = []

    for reg_slice in reg_slices:
        dicom_data = reg_slice.load()

        # Could use this, but this is not series specific and brainab DOES provide conversion matrices for Series in the same FrameOfReference.
        #frame_of_reference = dc[BL.FrameOfReferenceUID].value
        reference_series_dict = dicom_data[BrainlabTags.ReferenceSeriesSequence]
        reference_series_uid = reference_series_dict[0][BrainlabTags.SeriesInstanceUID].value
        ###TODO find testset with more then 1 SERIES registration within a single STUDY and between studies.
        ###TODO: My theory is there is possibly a single registration file for each FrameOfReference OR for each STUDY (and possibly different FrameOfReference)
     
        registrations = dicom_data[BrainlabTags.RegistrationSequence]

        for registration_index, registration in enumerate(registrations):
            # Currently not really used
            # TODO: !!!! Decide if we want to also convert series withing same frame of reference. Current code DOES include this. Manual evaluation of conversion shows only
            # TODO: very minor differences, neither overwhelmingly positive nor negetive
            target_frame_of_reference = registration[BrainlabTags.FrameOfReferenceUID].value
            ##Get the SOPInstanceUID of the first slice in the referenced items to determine the SeriesInstanceUID and prtocol name
            target_instance_uid = registration[BrainlabTags.ReferenceInstanceSequence][0][BrainlabTags.ReferencedSOPInstanceUID].value
            target_volume = file_set.find(SOPInstanceUID=target_instance_uid)[0]
            target_series_uid = target_volume.SeriesInstanceUID

            frame_of_reference_transform_matrix = registration[BrainlabTags.MatrixRegistrationSequence][0][
                BrainlabTags.MatrixSequence][0][BrainlabTags.FrameOfReferenceTransformMatrix].value
            matrix_array = np.ndarray(shape=(4, 4), buffer=np.array(frame_of_reference_transform_matrix))
            conversion_matrix = ConversionMatrix(reference_series_uid, target_series_uid, matrix_array)
            conversion_matrices.append(conversion_matrix)

            # Also add inverse matrix for conversion in both ways.Might change if changing search strategy in the matrices list
            #Dont add the inversion of the eye matrix for conversion to itself 
            if reference_series_uid != target_series_uid:
                inverse_conversion_matrix = _inverse_conversion_matrix(conversion_matrix)
                conversion_matrices.append(inverse_conversion_matrix)

    return conversion_matrices
