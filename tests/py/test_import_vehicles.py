import unittest

from scripts.import_vehicles import parse_carguru_vehicles_from_rate_short, parse_citybee_vehicles_from_cenas, slugify


class TestImportVehicles(unittest.TestCase):
    def test_slugify(self) -> None:
        self.assertEqual(slugify(" VW ID.4 "), "vw_id_4")
        self.assertEqual(slugify(""), "vehicle")

    def test_parse_citybee_vehicles_from_cenas(self) -> None:
        html = """
        <html>
          <select class="js-car-chooser">
            <option value="123" data-category="A">VW Polo</option>
            <option value="123" data-category="A">VW Polo</option>
            <option value="456" data-category="B">BMW X1</option>
          </select>
        </html>
        """
        vehicles = sorted(parse_citybee_vehicles_from_cenas(html), key=lambda v: v.vehicle_id)
        self.assertEqual([v.vehicle_id for v in vehicles], ["citybee_123", "citybee_456"])
        self.assertEqual(vehicles[0].provider_id, "citybee")
        self.assertEqual(vehicles[0].vehicle_name, "VW Polo")
        self.assertEqual(vehicles[0].vehicle_class, "A")

    def test_parse_citybee_vehicles_missing_select(self) -> None:
        with self.assertRaises(RuntimeError):
            parse_citybee_vehicles_from_cenas("<html></html>")

    def test_parse_carguru_vehicles_from_rate_short(self) -> None:
        obj = {"result": [{"id": 1, "title": "VW Polo"}, {"id": 2, "title": "BMW X1"}]}
        vehicles = sorted(parse_carguru_vehicles_from_rate_short(obj), key=lambda v: v.vehicle_id)
        self.assertEqual([v.vehicle_id for v in vehicles], ["carguru_1", "carguru_2"])
        self.assertEqual([v.vehicle_name for v in vehicles], ["VW Polo", "BMW X1"])

    def test_parse_carguru_vehicles_bad_shape(self) -> None:
        with self.assertRaises(RuntimeError):
            parse_carguru_vehicles_from_rate_short({"nope": []})

