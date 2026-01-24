import unittest

from scripts.bolt_clone_tier import normalize_snowboard_fit, normalize_vehicle_id, replace_as_of


class TestBoltCloneTier(unittest.TestCase):
    def test_normalize_vehicle_id(self) -> None:
        self.assertEqual(normalize_vehicle_id("bolt_vw_id4"), "bolt_vw_id4")
        with self.assertRaises(ValueError):
            normalize_vehicle_id("Bolt VW ID.4")

    def test_normalize_snowboard_fit(self) -> None:
        self.assertEqual(normalize_snowboard_fit(""), "")
        self.assertEqual(normalize_snowboard_fit(" 0 "), "0")
        self.assertEqual(normalize_snowboard_fit("1"), "1")
        self.assertEqual(normalize_snowboard_fit("2"), "2")
        with self.assertRaises(ValueError):
            normalize_snowboard_fit("3")

    def test_replace_as_of(self) -> None:
        self.assertEqual(replace_as_of("", "2026-01-24"), "as seen in-app on 2026-01-24")
        self.assertEqual(
            replace_as_of("foo; as seen in-app on 2025-01-01", "2026-01-24"),
            "foo; as seen in-app on 2026-01-24",
        )
        self.assertEqual(
            replace_as_of("foo", "2026-01-24"),
            "foo; as seen in-app on 2026-01-24",
        )
