import nibabel
import nibabel as nb
from typing import Type, Union
import numpy as np
import numpy.linalg as lin
from collections.abc import Iterable
from typing import Literal

class Point:
    """Represents a coordinate point (Annotation) from Medtronic Stealth data.

    Attributes:
        name (str): Name assigned to the annotation in the navigation system.
        x (float): X coordinate.
        y (float): Y coordinate.
        z (float): Z coordinate.
        units (str): Coordinate units ('VOX' or 'MM'). Defaults to 'VOX'.
        orientation (str): Coordinate orientation ('LPS', 'RAS', 'RPI'). Defaults to 'RAS'.
        space (str): Coordinate space ('IMAGE', 'PAT' (Patient/native), 'MNI'). Defaults to 'PAT'. Image space is actually a referecne to the coordinate file point representation
    """

    def __init__(self, name: str, x: float, y: float, z: float, units='VOX', orientation='RAS', space='PAT'):
        """Initializes a Point object.

        Args:
            name: Name assigned to an annotation within the Navigation system.
            x: X coordinate.
            y: Y coordinate.
            z: Z coordinate.
            units: Relevant units ('VOX', 'MM'). Defaults to 'VOX'.
            orientation: Relevant orientation ('LPS', 'RAS', 'RPI'). Defaults to 'RAS'.
            space: Coordinate space ('IMAGE', 'PAT', 'MNI'). Defaults to 'PAT'.
        """
        self.name = name
        self.x = x
        self.y = y
        self.z = z
        self.units = units
        self.orientation = orientation
        self.space = space

    def __str__(self):
        return "Point(" + self.name + ", " + str(round(self.x, 2)) + ", " + str(round(self.y, 2)) + ", " + str(
            round(self.z, 2)) + ", " + self.units + ", " + self.orientation + ", " + self.space + ")"

    
    def coo_array(self) -> np.ndarray:
        """Returns the point coordinates as a homogeneous NumPy array [x, y, z, 1].

        Returns:
            np.ndarray: A 1D NumPy arrayre presenting the point in homogeneous coordinates.
        """
        return np.array([self.x, self.y, self.z, 1])

    def mult(self, m: np.ndarray, orientation: str = None, output_space: str = None, units: str = None) -> 'Point':
        """Multiplies the point by a transformation matrix.

        Applies a 4x4 affine transformation matrix to the point's coordinates.
        Allows optional manual override of the resulting point's orientation,
        output space, and units.

        Args:
            m: 4x4 affine transformation matrix.
            orientation: Optional manual override for the output point's orientation.
                         If None, retains the current orientation.
            output_space: Optional manual override for the output point's space.
                          If None, retains the current space.
            units: Optional manual override for the output point's units.
                   If None, retains the current units.

        Returns:
            Point: A new Point object representing the transformed coordinates.
        """
        x = np.matmul(m, self.coo_array())

        return Point(self.name,
                     x[0], x[1], x[2],
                     units if units is not None else self.units,
                     orientation if orientation is not None else self.orientation,
                     output_space if output_space is not None else self.space)

def vox2mm(affine: np.ndarray,
           coo: Union[Point, np.ndarray, Iterable]) -> Union[Point, np.ndarray]:
    """Converts voxel coordinates to millimeter coordinates in RAS orientation.

    Uses the provided affine transformation matrix (typically from a NIfTI header)
    to convert coordinates from voxel space to millimeter space.
    NOTE: Assumes orientation of point and volume are equal

    Args:
        affine: 4x4 transformation affine matrix (voxel-to-world).
        coo: Coordinate input, can be a Point object, NumPy array, or Iterable.

    Returns:
        Union[Point, np.ndarray]: If input `coo` is a Point, returns a new Point object
                                  in 'MM' units. Otherwise, returns a NumPy array
                                  representing the coordinate in millimeters [x, y, z, 1].

    Raises:
        ValueError: If the input `coo` is a Point and its orientation does not
                    match the orientation derived from the affine matrix.
    """
    if isinstance(coo, Point):
        volume_ori = "".join(nb.aff2axcodes(affine))
        if volume_ori != coo.orientation:
            raise ValueError(f"[vox2mm] Orientation mismatch between vol {nb.aff2axcodes(affine)} and coordinate {coo.orientation}")
        return coo.mult(affine, units='MM', orientation='RAS')
    else:
        c = coo_to_nparray(coo)
        return np.matmul(affine, c)


def mm2vox(inv_affine: np.ndarray,
           coo: Union[Point, np.ndarray, Iterable]) -> Union[Point, np.ndarray]:
    """Converts millimeter coordinates to voxel coordinates.

    Uses the provided inverse affine transformation matrix to convert coordinates
    from millimeter space back to voxel space. Using the inverse affine avoids
    recalculating it on every call. ONLY accepts RAS orientation. Alwasy outputs the
    coordinate in the source_volume orientation.

    Args:
        inv_affine: 4x4 inverse transformation affine matrix (world-to-voxel).
                    Calculated via `numpy.linalg.inv(affine)`.
        coo: Coordinate input, can be a Point object, NumPy array, or Iterable. ONLY accepts RAS orientation.

    Returns:
        Union[Point, np.ndarray]: If input `coo` is a Point, returns a new Point object
                                  in 'VOX' units. Otherwise, returns a NumPy array
                                  representing the coordinate in voxels [i, j, k, 1].
    Raises:
        ValueError: If the input `coo` is a Point and its orientation does not
                    match the orientation derived from the invaffine matrix.
    """
    if isinstance(coo, Point):
        volume_ori = "".join(nb.aff2axcodes(inv_affine))
        if coo.orientation != 'RAS':
            raise ValueError(f"[mm2vox] Coordinate is not in RAS orientation. Use of this function might be faulty")
        return coo.mult(inv_affine, units='VOX', orientation=volume_ori)
    else:
        c = coo_to_nparray(coo)
        return np.matmul(inv_affine, c)
    
def mm2vox_ras(inv_affine: np.ndarray,
           coo: Point,
           vol_dim) -> Point:
    """Converts millimeter coordinates to voxel coordinates in RAS orientation.

    Uses the provided inverse affine transformation matrix to convert coordinates
    from millimeter space back to voxel space. ONLY accepts RAS orientation as input. Alwasy outputs the
    coordinate in the RAS orientation regardless of source_volume orientation.

    Args:
        inv_affine: 4x4 inverse transformation affine matrix (world-to-voxel).
                    Calculated via `numpy.linalg.inv(affine)`.
        coo: Coordinate input, can be a Point object, NumPy array, or Iterable. ONLY accepts RAS orientation.
        vol_dim: Dimensions of the volume in [dim_x, dim_y, dim_z] format.

    Returns:
        Union[Point, np.ndarray]: If input `coo` is a Point, returns a new Point object
                                  in 'VOX' units. Otherwise, returns a NumPy array
                                  representing the coordinate in voxels [i, j, k, 1].
    Raises:
        ValueError: If the input `coo` is a Point and its orientation does not
                    match the orientation derived from the invaffine matrix.
    """
    
    volume_ori = "".join(nb.aff2axcodes(inv_affine))
    if coo.orientation != 'RAS':
        raise ValueError(f"[mm2vox] Coordinate is not in RAS orientation. Use of this function might be faulty")
    vox_coo = coo.mult(inv_affine, units='VOX', orientation=volume_ori)
    ras_vox_coo = _correct_coordinate_for_vol_orientation('RAS', vox_coo, 'source_vol', vol_dim)
    return ras_vox_coo
    


def coo_to_nparray(coordinate: Union[Point, np.ndarray, Iterable, int, float],
                   y: Union[int, float] = None,
                   z: Union[int, float] = None) -> np.ndarray:
    """Converts various coordinate representations to a homogeneous NumPy array.

    Handles input coordinates provided as Point objects, NumPy arrays, Iterables
    (like lists or tuples), or individual x, y, z values.

    Args:
        coordinate: The coordinate input. Can be a Point, ndarray, Iterable,
                    or the x-coordinate value (if y and z are also provided).
        y: The y-coordinate value. Only used if `coordinate` is the x-value.
        z: The z-coordinate value. Only used if `coordinate` is the x-value.

    Returns:
        np.ndarray: A 1D NumPy array representing the coordinate in homogeneous
                    form [x, y, z, 1] or [i, j, k, 1].

    Raises:
        ValueError: If the input coordinate format is unsupported or ambiguous.
    """
    if isinstance(coordinate, Point):
        coo_array = coordinate.coo_array()
    elif isinstance(coordinate, Iterable):
        coo_array = np.array(coordinate)
    elif isinstance(coordinate, np.ndarray):
        coo_array = coordinate
    elif isinstance(coordinate, (int, float)) & (y is not None) & (z is not None):
        coo_array = np.array([coordinate, y, z, 1])
    else:
        raise ValueError(f"unsupported coordinate format: {type(coordinate)}")

    if coo_array.shape[0] != 4:
        coo_array = np.append(coo_array, 1)

    return coo_array


def get_point_obj(coordinate: Union[Point, np.ndarray, Iterable],
                  name: str = 'Point',
                  units: str = 'VOX',
                  orientation: str = 'LPS',
                  space: str = 'PAT') -> Point:
    """Ensures a coordinate is represented as a Point object with specified attributes.

    If the input `coordinate` is already a Point object, its attributes (units,
    orientation, space) are updated. Otherwise, the input coordinate (ndarray,
    Iterable) is converted into a new Point object with the given attributes.

    Args:
        coordinate: The coordinate input, can be a Point object, NumPy ndarray,
                    or any Iterable.
        name: The name to assign to the Point object. Defaults to 'Point'.
        units: The units of the coordinate ('VOX', 'MM'). Defaults to 'VOX'.
        orientation: The orientation system ('LPS', 'RAS', 'RPI'). Defaults to 'LPS'.
        space: The coordinate space ('IMAGE', 'PAT', 'MNI'). Defaults to 'PAT'.

    Returns:
        Point: A Point object representing the coordinate with the specified attributes.
    """
    if isinstance(coordinate, Point):
        # Update attributes if it's already a Point object
       # coordinate.name = name # Also update name if provided
        coordinate.units = units
        coordinate.orientation = orientation
        coordinate.space = space
        return coordinate
    else:
        c = coo_to_nparray(coordinate)
        return Point(name, c[0], c[1], c[2], units, orientation, space)


def _correct_coordinate_for_vol_orientation(source_vol_ori: str, coo: Point, ori_truth: Literal['source_vol', 'coordinate'], dim = None) -> Point:
    """Corrects coordinates between different orientation systems (e.g., RAS to LPS).

    This function adjusts the coordinate values of a Point object based on the
    difference between its current orientation (`coo.orientation`) and its volume's
    orientation (`source_vol_ori`).

    - For millimeter ('MM') units: Inverts the coordinate value along axes where
      orientations differ.
    - For voxel ('VOX') units: Subtracts the coordinate value from the maximum
      dimension size along axes where orientations differ. Requires `dim`.

    Args:
        source_vol_ori: The source volume orientation system as a 3-character string (e.g., "RAS", "LPS").
        coo: The Point object whose coordinates need correction.
        ori_truth: Specifies which orientation ('source_vol' or 'coordinate') the
                   output Point object should adopt. Not sure if usefull.
        dim: A list or array containing the dimensions [dim_x, dim_y, dim_z] of the
             volume. Required only if `coo.units` is 'VOX'. Defaults to None.

    Returns:
        Point: A new Point object with corrected coordinates and the orientation
                    specified by `ori_truth`.          
    Raises:
        ValueError: If if `coo.units` is 'VOX' but `dim` is not provided.    
    """
    # dim = dim if dim is not None else [] # Keep original logic for now
    coordinate_ori = coo.orientation
    is_mm_unit = (coo.units == 'MM')

    if not is_mm_unit and dim is None:
        # Return False if voxel units are used without valid dimensions
        raise ValueError(f"No dimensions provided for volume and VOX coo: {coo}")

    indices = coo.coo_array().copy() # Use copy to avoid modifying original

    # Process each dimension (x, y, z) - apply corrections where orientations differ
    for i in range(3):
        if source_vol_ori[i] != coordinate_ori[i]:
            indices[i] = -indices[i] if is_mm_unit else dim[i] - indices[i] 

    output_orientation = source_vol_ori if ori_truth == 'source_vol' else coordinate_ori

    return Point(coo.name, indices[0], indices[1], indices[2],
                 units=coo.units, orientation=output_orientation, space=coo.space)


def _get_orientation_corrected_point(vol: nb.Nifti1Image, coordinate: Point, output_type: Union[Literal['VOX', 'MM'], None]= None, debug: bool = False) -> Point:
    """Corrects a Point's coordinates to match the orientation of a NIfTI volume.

    This function ensures a Point object's coordinates are consistent with the
    orientation defined in a NIfTI volume's header. It handles the necessary
    transformations whether the point is initially in 'MM' or 'VOX' units.
    The final corrected point will be in 'VOX' units relative to the volume's grid.

    It uses `_correct_coordinate_for_orientation` internally for the core logic.

    Args:
        vol: The reference NIfTI volume (nibabel.Nifti1Image) whose orientation
             should be matched.
        coordinate: The Point object to be orientation-corrected.
        output_type: The units of the output Point object. If None, defaults to the units of the input Point.
        debug: If True, prints details about the conversion process. Defaults to False.

    Returns:
        Point: A new Point object representing the orientation-corrected coordinates
               in 'VOX' units, matching the volume's orientation. Returns the input
               coordinate if correction fails (e.g., missing dimensions for VOX).

    """
    vol_orientation = "".join(nb.aff2axcodes(vol.affine))

    if output_type is None:
        output_type = coordinate.units

    dim = vol.header.get_data_shape() # Use get_data_shape() for dimensions

    temp_corrected_coo = _correct_coordinate_for_vol_orientation(vol_orientation, coordinate, 'source_vol', dim)

    # If the original coordinate was in MM, convert the orientation-corrected MM point to VOX
    if coordinate.units == 'MM' and output_type == 'VOX':
        # Use the inverse affine of the volume to convert the MM point (automatically aligned with vol orientation) as VOX
        # NOT using the temp_corrected_coo here, as the use of the affine already implies the correct orientation
        inv_affine = lin.inv(vol.affine)
        final_corrected_coo =  mm2vox(inv_affine, coordinate)
    elif coordinate.units == 'VOX' and output_type == 'MM':
        # Correct orientation first, keeping original units
        # The output point from _correct_coordinate_for_orientation will have the vol_orientation
        final_corrected_coo = vox2mm(vol.affine, temp_corrected_coo)
    else:
        final_corrected_coo = temp_corrected_coo # Treat as VOX

    if debug:
        print(f"Original: {coordinate} (Orientation: {coordinate.orientation}, Units: {coordinate.units})")
        print(f"Target Vol Orientation: {vol_orientation}")
        print(f"Corrected: {final_corrected_coo} (Orientation: {final_corrected_coo.orientation}, Units: {final_corrected_coo.units})")

    return final_corrected_coo


def warpCoordinate(coordinate: Point, df_data: Union[nb.Nifti1Image, np.ndarray[np.floating]], source_vol: nb.Nifti1Image) -> Union[np.ndarray, None]:
    """Warps a single coordinate using a deformation field NIfTI image.

    Transforms a coordinate from the source volume's space to the target space
    defined by the deformation field. The input coordinate must be in patient ('PAT')
    space. It is first orientation-corrected to match the `source_vol` voxel grid,
    then the corresponding displacement vector is looked up in the `df_data`.

    Note: Assumes the deformation field maps to a target space (e.g., MNI) in
    millimeter ('MM') units and 'RAS' orientation, based on common usage with
    tools like SPM.

    Args:
        coordinate: The Point object to warp. Must be in 'PAT' space. Can be in
                    'MM' or 'VOX' units initially.
        df_data: The deformation field loaded as a nibabel.Nifti1Image or the loaded data array as supplied by warCoordinas function.
                 The data array contains displacement vectors.
        source_vol: The source NIfTI volume (nibabel.Nifti1Image). Used for orientation
                    correction.

    Returns:
        np.ndarray: A NumPy array representing the warped coordinate in the target
                    space (typically MNI), 'MM' units, and 'RAS' orientation.
                    Returns None if the coordinate falls outside the bounds of the
                    deformation field after orientation correction.

    Raises:
        ValueError: If the input `coordinate` is not in 'PAT' space.
    """
    if coordinate.space != 'PAT':
        raise ValueError(f"[warpCoordinate] Input point {coordinate} must be in 'PAT' space, but is in '{coordinate.space}' space.")

    # Correct the coordinate's orientation and ensure it's in VOX units
    # relative to the source volume for indexing the deformation field.
    # DEPRICATED in a way. Corrections are localised to the Brainlab_decoder extract_points_from_dicom function and the _stealth_lps_to_voxel function.
    # still usefull for the output conversion to allow both MM and voxel input
    corrected_point_vox = _get_orientation_corrected_point(source_vol, coordinate, output_type='VOX', debug=False) # Set debug as needed

    # Get integer voxel indices for lookup
    # Ensure we only take the first 3 elements (i, j, k)
    pos = np.round(corrected_point_vox.coo_array()[:3]).astype(int)

    # Check bounds before indexing
    df_shape = df_data.shape[:3] # Get spatial dimensions of deformation field
    if np.any(pos < 0) or np.any(pos >= df_shape):
        print(f"Warning: Coordinate {coordinate} maps to voxel {pos}, which is outside the deformation field bounds {df_shape}. Skipping.")
        return None

    if isinstance(df_data, nibabel.Nifti1Image):
        loaded_df_data = df_data.get_fdata(dtype=np.float32) # Load data as needed
    else:
        loaded_df_data = df_data

    # Look up the displacement vector in the deformation field
    # The result is typically the target coordinate in MM, RAS space (e.g., MNI)
    try:
        # df_data shape is often (X, Y, Z, 1, 3) for SPM y_*.nii files
        # Access the vector data correctly
        if loaded_df_data.ndim == 5 and loaded_df_data.shape[3] == 1:
             warped_coo_mm_ras = loaded_df_data[pos[0], pos[1], pos[2], 0, :]
        elif loaded_df_data.ndim == 4: # Assuming shape (X, Y, Z, 3)
             warped_coo_mm_ras = loaded_df_data[pos[0], pos[1], pos[2], :]
        else:
             raise IndexError(f"Unexpected deformation field data shape: {loaded_df_data.shape}")
        return warped_coo_mm_ras
    except IndexError:
        return None


def warpCoordinates(coordinates: list[Point],
                    df_path_or_img: Union[str, nibabel.Nifti1Image],
                    input_vol_path_or_img: Union[str, nibabel.Nifti1Image],
                    output_vol_path_or_img: Union[str, nibabel.Nifti1Image] = None,
                    convert_output_to_vox: bool = False) -> list[Point]:
    """Warps a list of coordinates using a deformation field.

    Applies the `warpCoordinate` function to each Point in the input list.
    Handles loading of NIfTI files if paths are provided. Optionally converts
    the output coordinates (which are initially in 'MM', 'RAS', target space)
    to voxel units relative to a specified output volume.

    Args:
        coordinates: A list of Point objects to be warped. All points must be
                     in 'PAT' space.
        df_path_or_img: Path to the deformation field NIfTI file (e.g., 'y_*.nii')
                        or a loaded nibabel.Nifti1Image object.
        input_vol_path_or_img: Path to the source NIfTI volume or a loaded
                               nibabel.Nifti1Image object.
        output_vol_path_or_img: Optional. Path to the target NIfTI volume or a
                                loaded nibabel.Nifti1Image object. Required only if
                                `convert_output_to_vox` is True. Defaults to None.
        convert_output_to_vox: If True, converts the warped coordinates (which are
                               in 'MM', 'RAS', target space) to 'VOX' units relative
                               to the `output_vol`. Defaults to False.

    Returns:
        list[Point]: A list of Point objects representing the warped coordinates.
                     Output points are in the target space (e.g., 'MNI'), 'RAS'
                     orientation. Units are 'MM' unless `convert_output_to_vox`
                     is True, in which case they are 'VOX'. Points that could
                     not be warped (e.g., outside the deformation field) will
                     have NaN coordinates.

    Raises:
        ValueError: If any of the required NIfTI files (deformation field, input
                    volume, or output volume if `convert_output_to_vox` is True)
                    cannot be loaded or are invalid.
        TypeError: If input paths/objects are not of the expected types.
    """
    # --- Load NIfTI files if paths are provided ---
    try:
        if isinstance(df_path_or_img, str):
            df_img = nb.load(df_path_or_img)
        elif isinstance(df_path_or_img, nibabel.Nifti1Image):
            df_img = df_path_or_img
        else:
            raise TypeError("df_path_or_img must be a string path or Nifti1Image object.")
    except Exception as e:
        raise ValueError(f"[warpCoordinates] Failed to load deformation field '{df_path_or_img}': {e}")

    try:
        if isinstance(input_vol_path_or_img, str):
            input_vol = nb.load(input_vol_path_or_img)
        elif isinstance(input_vol_path_or_img, nibabel.Nifti1Image):
            input_vol = input_vol_path_or_img
        else:
            raise TypeError("input_vol_path_or_img must be a string path or Nifti1Image object.")
    except Exception as e:
        raise ValueError(f"[warpCoordinates] Failed to load input volume '{input_vol_path_or_img}': {e}")

    output_vol = None
    inv_output_affine = None
    if convert_output_to_vox:
        if output_vol_path_or_img is None:
            raise ValueError("[warpCoordinates] output_vol must be provided when convert_output_to_vox is True.")
        try:
            if isinstance(output_vol_path_or_img, str):
                output_vol = nb.load(output_vol_path_or_img)
            elif isinstance(output_vol_path_or_img, nibabel.Nifti1Image):
                output_vol = output_vol_path_or_img
            else:
                 raise TypeError("output_vol_path_or_img must be a string path or Nifti1Image object.")
            inv_output_affine = lin.inv(output_vol.affine)
        except Exception as e:
            raise ValueError(f"[warpCoordinates] Failed to load or process output volume '{output_vol_path_or_img}': {e}")

    # --- Assert matching orientation of source volume and df ---
    if not nb.aff2axcodes(df_img.affine) == nb.aff2axcodes(input_vol.affine):
        raise ValueError(f"[warpCoordinates] Deformation field and source volume orientations do not match: {nb.aff2axcodes(df_img.affine)} vs {nb.aff2axcodes(input_vol.affine)}")

    # --- Process each coordinate ---
    results = []
    # Pre-load df_data if possible to avoid reloading in loop (if memory allows)
    df_data = df_img.get_fdata(dtype=np.float32) # Consider memory implications

    for coo in coordinates:
        # Ensure input coordinate is a Point object
        if not isinstance(coo, Point):
             print(f"Warning: Skipping non-Point object in input list: {coo}")
             continue

        # Warp the individual coordinate
        # Pass the loaded df_img object to warpCoordinate
        warped_coo_mm_ras = warpCoordinate(coo, df_data, input_vol) # Pass df_img, not df_data, 

        output_units = 'MM'
        output_space = 'MNI' # Assuming target space is MNI
        output_orientation = 'RAS' # Assuming target orientation is RAS

        if warped_coo_mm_ras is not None and not np.isnan(warped_coo_mm_ras).any():
            final_coo_data = warped_coo_mm_ras
            if convert_output_to_vox:
                # Convert the MM RAS coordinate to VOX using the output volume's inverse affine
                # Create a temporary Point object for mm2vox
                temp_point_mm = get_point_obj(warped_coo_mm_ras, name=coo.name, units='MM', orientation='RAS', space=output_space)
                final_coo_data_vox = mm2vox(inv_output_affine, temp_point_mm) # mm2vox returns a Point or ndarray
                # Extract numerical data and round
                if isinstance(final_coo_data_vox, Point):
                     final_coo_data = np.round(final_coo_data_vox.coo_array()[:3]).astype(int)
                else: # Assuming ndarray
                     final_coo_data = np.round(final_coo_data_vox[:3]).astype(int)
                output_units = 'VOX'
            else:
                # Round the MM coordinates if not converting to VOX
                final_coo_data = np.round(warped_coo_mm_ras, 2)

            # Create the final Point object
            warped_point = get_point_obj(final_coo_data, coo.name, output_units, output_orientation, output_space)

        else:
            # Handle cases where warping failed or resulted in NaN
            # Create a Point with NaN coordinates but correct attributes
            nan_coords = np.array([np.nan, np.nan, np.nan])
            warped_point = get_point_obj(nan_coords, coo.name, output_units, output_orientation, output_space)

        results.append(warped_point)

    return results
