import numpy as np
import coordinatetools as ct
import nibabel as nb
import os


class Exam:
    def __init__(self, name: str, studyID: str, seriesID: str, date: str, designations, mtcs):
        self.name = name,
        self.studyID = studyID
        self.seriesID = seriesID
        self.date = date
        self.designations = designations
        self.mtcs = mtcs

    def __str__(self):
        return f"Exam(name={self.name}, studyID={self.studyID}, seriesID={self.seriesID}, date={self.date}, designations={self.designations}, mtcs={self.mtcs})"


class Patient:
    def __init__(self, name: str, mrn: str, exams: [Exam], pointmap):  # plans, annotations, ACPC
        self.name = name
        self.mrn = mrn
        self.exams = exams
        self.pointmap = pointmap

    def __str__(self):
        exams_str = ", ".join(str(exam) for exam in self.exams)
        return f"Patient(name={self.name}, mrn={self.mrn}, exams=[{exams_str}], pointmap={self.pointmap})"


def decodePatient(dct) -> Patient:
    exams = decodeExams(dct["exams"])
    points = decodePoints(dct["annotations"])
    return Patient(dct["name"], dct["mrn"], exams, points)


def decodeExams(exams):
    examList = []
    for exam in exams:
        designations = []
        for d in exam["designations"]:
            designations.append(d)
        mtcs = {}
        if "volumeTreference" in exam:
            mtcs["volumeTreference"] = decodeMatrix(exam["volumeTreference"])
        if "dicomTvolMM" in exam:
            mtcs["dicomTvolMM"] = decodeMatrix(exam["dicomTvolMM"])
        if "rpiTvolMM" in exam:
            mtcs["rpiTvolMM"] = decodeMatrix(exam["rpiTvolMM"])
        # Somehow name is extracted as tuple and indexing it here doesn't work
        # name = exam['name'][0] if isinstance(exam['name'], tuple) else exam['name']
        examList.append(Exam(exam['name'], exam['studyID'], exam['seriesID'], exam['dateLoaded'], designations, mtcs))
    return examList


def decodeMatrix(mtx):
    m = np.ndarray(shape=(4, 4), dtype=float)
    for idx, x in np.ndenumerate(m):
        # print('For position:' + str(idx[0]) + str(idx[1]) + ': ' + mtx[str(idx[0]) + str(idx[1])])
        m[idx[0], idx[1]] = float(mtx[str(idx[0]) + str(idx[1])])
    return m


def decodePoints(annotations):
    cats = ['LPS', 'RPI', 'DCM']
    pointMap = {}

    for cat in cats:
        ptList = []
        if cat == 'RPI':
            orient = 'RPI'
        else:
            # DCM and LPS are both in LPS -> Should verify for DCM
            orient = 'LPS'

        if cat == 'DCM':
            # Only DCM is in MM.
            units = 'MM'
        else:
            units = 'VOX'

        for p in annotations[cat]:
            n = p["name"]
            coo = p["point"]
            ptList.append(ct.Point(n, float(coo['x']), float(coo['y']), float(coo['z']), units=units, orientation=orient,space='IMG'))
        pointMap[cat] = ptList

    return pointMap


def _stealth_lps_to_ras_ori_voxel(p: ct.Point, vol: nb.Nifti1Image) -> ct.Point:
    """
    A specific version of _stealth_lps_to_voxel_ras that expresses the point in RAS orientation.
    Usefull to debug the coordinates as viewers such as MRIcroGL can only display RAS coordinates.
    
    Args:
        p (ct.Point): Point object from StealthStation (labeled as LPS orientation) in IMG space
        vol_header: Loaded target volume nifti header for dimensions and pixel dimensions
        
    Returns:
        ct.Point: Point object representing voxel coordinates in RAS orientation and PAT space
        
    """
    return _stealth_lps_to_target_ori_voxel(p, vol, orientation='RAS')

def _stealth_lps_to_target_ori_voxel(p: ct.Point, vol: nb.Nifti1Image, orientation: str = None) -> ct.Point:
    """
    Converts a LPS point from Medtronic StealthStation file 
    to actual voxel coordinates in the orientation of target volume.
    
    This function takes coordinates from the StealthStation export (we define image space here as raw data in the file)  
    and converts them to patient space voxel coordinates in RAS orientation, 
    applying the appropriate dimension transformations for x and y axis and
    taking into account the pixel dimensions of the volume.
    
    NOTE: Requires the source volume to be in RAS orientation. For different 
    orientations, follow up with coordinate tools _get_orientation_corrected_point()
    
    Args:
        p (ct.Point): Point object from StealthStation (labeled as LPS orientation) in IMG space
        vol_header: Loaded target volume nifti header for dimensions and pixel dimensions
        orientation: The desired orientation of the coordinate. If None, defaults to volume orientation
    Returns:
        ct.Point: Point object representing voxel coordinates in desired orientation and PAT space
        
    Raises:
        ValueError: If point is not in LPS orientation or IMG space
    """
    if p.orientation != 'LPS':
        raise ValueError("[_stealth_lps_to_voxel_ras] Supplied point %s is not is LPS orientation" % p)
    if p.space != 'IMG':
        raise ValueError("[_stealth_lps_to_voxel_ras] Supplied point %s is not is IMG space" % p)

    volume_orientation = "".join(nb.aff2axcodes(vol.affine))
    desired_orientation = orientation if orientation is not None else volume_orientation
   
    vol_header = vol.header
    # Get dimensions in form e.g.  (512, 512, 291)
    dim = vol.shape
    # Get pixel dimensions in form e.g.  [-1.    0.425    0.39    0.39    1.    1.    1.    1.] (non zero indexing)
    pix_dim = vol_header['pixdim']

    # Get the voxel indices adjusted for pixel size
    point = ct.Point(p.name, 
                     p.x / pix_dim[1], 
                     p.y / pix_dim[2], 
                     p.z / pix_dim[3], 
                     units=p.units, orientation='LPS', space='PAT')
    
    corrected_point = ct._correct_coordinate_for_vol_orientation(desired_orientation, point, ori_truth='source_vol', dim=dim)
   
    return corrected_point


#def ras2lps(p: ct.Point, vol) -> ct.Point:
    """
    STEALTH ONLY: converts both
    Helper function to generate sample points e.g. from manually acquired RAS coordinates on the target volume
    :param p: Point object in RAS orientation
    :param vol: loaded target volume nifti
    :return: Point object in LPS orientation
    """
    if True:
        raise ValueError("[RAS2LPS] Not tested. Uncomment to reassess usage")

    if p.orientation != 'RAS':
        raise ValueError("[RAS2LPS] Supplied point %s is not in RAS orientation" % p)

    header = vol.header
    dim = header['dim']
    pix_dim = header['pixdim']
    x2 = (dim[1] - p.x) * pix_dim[1] # TODO CHECK CHECK
    y2 = (dim[2] - p.y) * pix_dim[2]
    z2 = p.z * pix_dim[3]
    return ct.Point(p.name, x2, y2, z2, units=p.units, orientation='LPS', space=p.space)


# Convert coordinate in the reference image to coordinate on target modality
def convRefToTargetCoo(p: ct.Point, volTref: np.ndarray, target_vol) -> ct.Point:
    """
    Convert coordinate in the reference image to coordinate on target modality
    :param p: Point object in LPS orientation
    :param volTref: 4x4 ndarray
    :param target_vol: loaded target volume nifti
    :return:
    """

    if p.orientation != 'LPS':
        raise ValueError("[LPS2RAS] Supplied point %s is not in LPS orientation. Use of this function might be faulty" % p)

    #which is actually volTref * p as in [4x4]x[4x1]
    coreg = p.mult(volTref, orientation='LPS')
    return _stealth_lps_to_target_ori_voxel(coreg, target_vol)


def extract_seriesID(filename) -> str:
    """
    Helper tool to extract series ID from file name. This adheres to the naming scheme assigned in the dcm_conversion_ext.py file
    Current convention of file name: 'mr_' + seriesID + .nii
    """
    # Split the string into the base name and the extension, and discard the extension
    base_name = filename.partition('.')
    # Split the string at the last underscore
    base, seriesID = base_name[0].rsplit('_', 1)
    return seriesID
