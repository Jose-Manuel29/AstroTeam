import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from app.horizons import HorizonsError, build_site_timeline, parse_observer_result
from scripts.sync_horizons import generate_rows, summarize_site_visibility


class HorizonsParsingTests(unittest.TestCase):
    def test_parses_observer_csv_with_range_light_time_and_phase(self):
        result = """header
$$SOE
 2026-Nov-15 00:00,*, , 229.590000, -4.870000, 405696.400000, 0.0000, 0.02255000, 52.0300,
$$EOE
footer
"""
        rows = parse_observer_result(result, include_range=True)

        self.assertEqual(
            rows[0]["timestamp"],
            datetime(2026, 11, 15, tzinfo=timezone.utc),
        )
        self.assertEqual(rows[0]["azimuth_deg"], 229.59)
        self.assertEqual(rows[0]["distance_km"], 405696.4)
        self.assertEqual(rows[0]["one_way_light_time_minutes"], 0.02255)
        self.assertEqual(rows[0]["phase_angle_deg"], 52.03)

    def test_rejects_response_without_ephemeris_markers(self):
        with self.assertRaises(HorizonsError):
            parse_observer_result("No table returned", include_range=False)


class TerrainTimelineTests(unittest.TestCase):
    def test_builds_visibility_and_latency_from_profile_and_horizons_rows(self):
        timestamp = datetime(2026, 11, 15, tzinfo=timezone.utc)
        sun_rows = [
            {
                "timestamp": timestamp,
                "azimuth_deg": 10.0,
                "elevation_deg": 2.0,
                "distance_km": 149_597_870.7,
            }
        ]
        earth_rows = [
            {
                "timestamp": timestamp,
                "azimuth_deg": 20.0,
                "elevation_deg": 0.5,
                "distance_km": 405696.4,
                "one_way_light_time_minutes": 405696.4 / 299792.458 / 60.0,
                "phase_angle_deg": 52.03,
            }
        ]
        profile = [
            {"azimuth": 0.0, "elevation_deg": 1.0},
            {"azimuth": 90.0, "elevation_deg": 0.0},
            {"azimuth": 180.0, "elevation_deg": 0.0},
            {"azimuth": 270.0, "elevation_deg": 0.0},
        ]

        rows = build_site_timeline("sample", sun_rows, earth_rows, profile, 0.0)

        self.assertTrue(rows[0]["sol_estado_luz"])
        self.assertTrue(rows[0]["sol_parte_visible"])
        self.assertTrue(rows[0]["sol_disco_completo_visible"])
        self.assertFalse(rows[0]["linea_vista_directa"])
        self.assertTrue(rows[0]["tierra_parte_visible"])
        self.assertFalse(rows[0]["tierra_disco_completo_visible"])
        self.assertAlmostEqual(rows[0]["latencia_seg"], 405696.4 / 299792.458)
        self.assertEqual(rows[0]["tierra_elevacion"], 0.5)

    def test_rejects_mismatched_target_timestamps(self):
        sun_rows = [
            {
                "timestamp": datetime(2026, 11, 15, tzinfo=timezone.utc),
                "azimuth_deg": 0.0,
                "elevation_deg": 1.0,
            }
        ]
        earth_rows = [
            {
                "timestamp": datetime(2026, 11, 15, 1, tzinfo=timezone.utc),
                "azimuth_deg": 0.0,
                "elevation_deg": 1.0,
                "distance_km": 405696.4,
                "one_way_light_time_minutes": 0.0225,
                "phase_angle_deg": 52.03,
            }
        ]
        with self.assertRaises(HorizonsError):
            build_site_timeline("sample", sun_rows, earth_rows, [], 0.0)


class HorizonsSyncTests(unittest.TestCase):
    def test_thirty_day_sync_requests_exactly_720_hourly_points(self):
        start = datetime(2026, 11, 15, tzinfo=timezone.utc)
        sun_rows = []
        earth_rows = []
        for hour in range(720):
            timestamp = start + timedelta(hours=hour)
            sun_rows.append(
                {
                    "timestamp": timestamp,
                    "azimuth_deg": 0.0,
                    "elevation_deg": 2.0,
                    "distance_km": 149_597_870.7,
                }
            )
            earth_rows.append(
                {
                    "timestamp": timestamp,
                    "azimuth_deg": 0.0,
                    "elevation_deg": 2.0,
                    "distance_km": 405696.4,
                    "one_way_light_time_minutes": 405696.4 / 299792.458 / 60.0,
                    "phase_angle_deg": 52.03,
                }
            )
        site = {
            "id": "sample",
            "longitud": 0.0,
            "latitud": -89.9,
            "altitud_km": 0.0,
            "default_horizon_elevation_deg": 0.0,
            "horizon_profile": [
                {"azimuth": 0.0, "elevation_deg": 0.0},
                {"azimuth": 90.0, "elevation_deg": 0.0},
                {"azimuth": 180.0, "elevation_deg": 0.0},
                {"azimuth": 270.0, "elevation_deg": 0.0},
            ],
        }

        with patch(
            "scripts.sync_horizons.fetch_observer_ephemeris",
            side_effect=[sun_rows, earth_rows],
        ) as fetch:
            rows = generate_rows([site], start, 30)

        self.assertEqual(len(rows), 720)
        self.assertEqual(
            fetch.call_args_list[0].args[5],
            start + timedelta(hours=719),
        )
        self.assertTrue(fetch.call_args_list[0].kwargs["include_range"])
        self.assertTrue(fetch.call_args_list[1].kwargs["include_range"])

    def test_summarizes_visibility_percentages_per_site(self):
        rows = [
            {"site_id": "site-a", "sol_estado_luz": True, "linea_vista_directa": False},
            {"site_id": "site-a", "sol_estado_luz": False, "linea_vista_directa": True},
            {"site_id": "site-a", "sol_estado_luz": True, "linea_vista_directa": True},
            {"site_id": "site-b", "sol_estado_luz": False, "linea_vista_directa": False},
        ]

        self.assertEqual(
            summarize_site_visibility(rows),
            [
                {
                    "id": "site-a",
                    "pct_luz_solar": 66.67,
                    "pct_vista_tierra": 66.67,
                },
                {
                    "id": "site-b",
                    "pct_luz_solar": 0.0,
                    "pct_vista_tierra": 0.0,
                },
            ],
        )


if __name__ == "__main__":
    unittest.main()
