import math
import unittest

import numpy as np
from rasterio.io import MemoryFile
from rasterio.transform import from_origin

from scripts.extract_dem_profiles import (
    MOON_RADIUS_M,
    _sample_projected,
    destination_points,
    line_of_sight_elevation_deg,
)


class DemProfileGeometryTests(unittest.TestCase):
    def test_destination_point_moves_east_from_equator(self):
        latitude, longitude = destination_points(0.0, 0.0, 90.0, [1000.0])

        self.assertAlmostEqual(latitude[0], 0.0, places=6)
        self.assertGreater(longitude[0], 0.0)

    def test_destination_points_supports_batched_azimuths(self):
        latitudes, longitudes = destination_points(
            0.0, 0.0, [0.0, 90.0], [1000.0, 2000.0]
        )

        self.assertEqual(latitudes.shape, (2, 2))
        self.assertEqual(longitudes.shape, (2, 2))
        self.assertGreater(latitudes[0, 0], 0.0)
        self.assertGreater(longitudes[1, 0], 0.0)

    def test_same_height_terrain_dips_below_surface_horizon_with_distance(self):
        elevation = line_of_sight_elevation_deg(
            terrain_height_m=0.0,
            observer_radius_m=MOON_RADIUS_M,
            distance_m=1000.0,
        )

        self.assertLess(elevation, 0.0)

    def test_projected_dem_sampling_interpolates_between_pixel_centers(self):
        pixels = np.array([[0.0, 10.0], [20.0, 30.0]], dtype=np.float32)
        with MemoryFile() as memory_file:
            with memory_file.open(
                driver="GTiff",
                height=2,
                width=2,
                count=1,
                dtype="float32",
                transform=from_origin(0.0, 2.0, 1.0, 1.0),
            ) as dataset:
                dataset.write(pixels, 1)

                sampled = _sample_projected(dataset, [1.0], [1.0])

        self.assertAlmostEqual(sampled[0], 15.0)
