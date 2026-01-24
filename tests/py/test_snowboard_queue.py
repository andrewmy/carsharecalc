import unittest

from scripts.snowboard_queue import Vehicle


class TestSnowboardQueue(unittest.TestCase):
    def test_snowboard_ok(self) -> None:
        self.assertIs(Vehicle("", "", "", "", "", "").snowboard_ok, None)
        self.assertIs(Vehicle("", "", "", "", "TRUE", "").snowboard_ok, True)
        self.assertIs(Vehicle("", "", "", "", "FALSE", "").snowboard_ok, False)
        self.assertIs(Vehicle("", "", "", "", "maybe", "").snowboard_ok, None)

    def test_snowboard_ok_is_invalid(self) -> None:
        self.assertFalse(Vehicle("", "", "", "", "", "").snowboard_ok_is_invalid)
        self.assertFalse(Vehicle("", "", "", "", "TRUE", "").snowboard_ok_is_invalid)
        self.assertFalse(Vehicle("", "", "", "", "false", "").snowboard_ok_is_invalid)
        self.assertTrue(Vehicle("", "", "", "", "yes", "").snowboard_ok_is_invalid)

