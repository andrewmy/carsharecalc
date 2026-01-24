import unittest

from scripts.snowboard_queue import Vehicle


class TestSnowboardQueue(unittest.TestCase):
    def test_snowboard_fit(self) -> None:
        self.assertIs(Vehicle("", "", "", "", "", "").snowboard_fit, None)
        self.assertIs(Vehicle("", "", "", "", "0", "").snowboard_fit, 0)
        self.assertIs(Vehicle("", "", "", "", "1", "").snowboard_fit, 1)
        self.assertIs(Vehicle("", "", "", "", "2", "").snowboard_fit, 2)
        self.assertIs(Vehicle("", "", "", "", "maybe", "").snowboard_fit, None)

    def test_snowboard_fit_is_invalid(self) -> None:
        self.assertFalse(Vehicle("", "", "", "", "", "").snowboard_fit_is_invalid)
        self.assertFalse(Vehicle("", "", "", "", "0", "").snowboard_fit_is_invalid)
        self.assertFalse(Vehicle("", "", "", "", "1", "").snowboard_fit_is_invalid)
        self.assertFalse(Vehicle("", "", "", "", "2", "").snowboard_fit_is_invalid)
        self.assertTrue(Vehicle("", "", "", "", "TRUE", "").snowboard_fit_is_invalid)
        self.assertTrue(Vehicle("", "", "", "", "3", "").snowboard_fit_is_invalid)
