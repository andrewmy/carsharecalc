import unittest

from scripts.import_options import (
    duration_to_minutes,
    parse_carguru_options_from_rate_short,
    parse_citybee_options_from_cenas,
    parse_int,
    parse_money,
    slugify,
)


class TestImportOptions(unittest.TestCase):
    def test_slugify(self) -> None:
        self.assertEqual(slugify(" Standard Rate "), "standard_rate")
        self.assertEqual(slugify(""), "x")

    def test_parse_money_common_formats(self) -> None:
        self.assertEqual(parse_money("€ 1 010"), "1010")
        self.assertEqual(parse_money("1.010 €"), "1010")
        self.assertEqual(parse_money("1,50"), "1.50")
        self.assertEqual(parse_money("0.280"), "0.280")
        self.assertEqual(parse_money(None), "")
        self.assertEqual(parse_money(""), "")

    def test_parse_int_common_formats(self) -> None:
        self.assertEqual(parse_int("1 010"), "1010")
        self.assertEqual(parse_int("1.010"), "1010")
        self.assertEqual(parse_int(None), "")
        self.assertEqual(parse_int(""), "")

    def test_duration_to_minutes(self) -> None:
        self.assertEqual(duration_to_minutes("1h"), 60)
        self.assertEqual(duration_to_minutes("3d"), 3 * 1440)
        self.assertEqual(duration_to_minutes(" 14d "), 14 * 1440)
        with self.assertRaises(ValueError):
            duration_to_minutes("90m")

    def test_parse_citybee_options_from_cenas(self) -> None:
        html = """
        <select class="js-car-chooser">
          <option
            value="123"
            data-category="A"
            data-km="0,28"
            data-min="0,15"
            data-hour="5"
            data-day="25"
            data-min-fee="2"
            data-trip-fee="1"
          >VW Polo</option>
        </select>
        """
        options, vehicle_ids = parse_citybee_options_from_cenas(html)
        self.assertIn("citybee_123", vehicle_ids)

        option_ids = {o.option_id for o in options}
        self.assertIn("citybee_123_payg", option_ids)
        self.assertIn("citybee_123_1h", option_ids)
        self.assertIn("citybee_123_1d", option_ids)

        payg = next(o for o in options if o.option_id == "citybee_123_payg")
        self.assertEqual(payg.option_type, "PAYG")
        self.assertEqual(payg.km_rate_eur, "0.28")
        self.assertEqual(payg.drive_day_min_rate_eur, "0.15")
        self.assertEqual(payg.min_total_eur, "2")
        self.assertEqual(payg.trip_fee_eur, "1")

    def test_parse_carguru_options_from_rate_short(self) -> None:
        obj = {
            "result": [
                {
                    "id": 7,
                    "title": "VW Polo",
                    "rates": [
                        {
                            "title": "Standard",
                            "costDayDrivingMovement": "0,20",
                            "costNightDrivingMovement": "0,30",
                            "costDayParking": "0,10",
                            "costNightParking": "0,15",
                            "costDayAdditionalMileage": "0,25",
                            "fixedFreeMileage": "1 000",
                            "costService": "1",
                            "costReservation": "0",
                            "costStart": "2",
                            "costDayMin": "2",
                            "costNightMin": "3",
                            "period": [{"time": "1h", "cost": "5"}, {"time": "3d", "cost": "99"}],
                        }
                    ],
                }
            ]
        }
        options, vehicle_ids = parse_carguru_options_from_rate_short(obj)
        self.assertEqual(vehicle_ids, {"carguru_7"})

        payg = next(o for o in options if o.option_id.endswith("_payg"))
        self.assertEqual(payg.provider_id, "carguru")
        self.assertEqual(payg.vehicle_id, "carguru_7")
        self.assertEqual(payg.option_type, "PAYG")
        self.assertEqual(payg.min_total_eur, "3")
        self.assertEqual(payg.included_km, "1000")

        package_ids = sorted(o.option_id for o in options if o.option_type == "PACKAGE")
        self.assertTrue(any("_1h" in oid for oid in package_ids))
        self.assertTrue(any("_3d" in oid for oid in package_ids))

