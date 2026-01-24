import tempfile
import unittest
from pathlib import Path

from scripts.generate_favicon import crop_center_square, read_png_rgba, trim_uniform_border, write_png


class TestGenerateFavicon(unittest.TestCase):
    def test_write_read_png_roundtrip(self) -> None:
        img = [
            [(255, 0, 0, 255), (0, 255, 0, 255)],
            [(0, 0, 255, 255), (255, 255, 0, 128)],
        ]
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "x.png"
            write_png(p, img)
            got = read_png_rgba(p)
        self.assertEqual(got, img)

    def test_crop_center_square(self) -> None:
        img = [[(x, y, 0, 255) for x in range(3)] for y in range(5)]  # 5x3
        cropped = crop_center_square(img)
        self.assertEqual(len(cropped), 3)
        self.assertEqual(len(cropped[0]), 3)
        # Center crop picks rows 1..3 for 5x3.
        self.assertEqual(cropped[0][0], (0, 1, 0, 255))

    def test_trim_uniform_border(self) -> None:
        bg = (255, 255, 255, 255)
        fg = (0, 0, 0, 255)
        img = [[bg for _ in range(5)] for _ in range(5)]
        for y in range(1, 4):
            for x in range(1, 4):
                img[y][x] = fg
        trimmed = trim_uniform_border(img, tol=0)
        self.assertEqual(len(trimmed), 3)
        self.assertEqual(len(trimmed[0]), 3)
        self.assertEqual(trimmed[1][1], fg)

