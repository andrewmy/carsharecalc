from __future__ import annotations

import argparse
import struct
import zlib
from pathlib import Path


PNG_SIG = b"\x89PNG\r\n\x1a\n"


def _crc32(data: bytes) -> int:
    return zlib.crc32(data) & 0xFFFFFFFF


def _png_chunk(tag: bytes, payload: bytes) -> bytes:
    return struct.pack(">I", len(payload)) + tag + payload + struct.pack(">I", _crc32(tag + payload))


def read_png_rgba(path: Path) -> list[list[tuple[int, int, int, int]]]:
    b = path.read_bytes()
    if not b.startswith(PNG_SIG):
        raise ValueError(f"{path} is not a PNG (missing signature)")

    off = len(PNG_SIG)
    w = h = None
    bit_depth = color_type = interlace = None
    idat = bytearray()

    while off + 8 <= len(b):
        ln = struct.unpack(">I", b[off : off + 4])[0]
        tag = b[off + 4 : off + 8]
        payload = b[off + 8 : off + 8 + ln]
        off += 12 + ln

        if tag == b"IHDR":
            w, h, bit_depth, color_type, _cm, _fm, interlace = struct.unpack(">IIBBBBB", payload)
        elif tag == b"IDAT":
            idat += payload
        elif tag == b"IEND":
            break

    if w is None or h is None:
        raise ValueError(f"{path}: missing IHDR")
    if bit_depth != 8 or color_type not in (2, 6):
        raise ValueError(
            f"{path}: only 8-bit RGB/RGBA PNGs are supported (got bit_depth={bit_depth}, color_type={color_type})"
        )
    if interlace != 0:
        raise ValueError(f"{path}: interlaced PNGs are not supported")

    src_bpp = 4 if color_type == 6 else 3
    raw = zlib.decompress(bytes(idat))
    stride = 1 + w * src_bpp
    expected = stride * h
    if len(raw) != expected:
        raise ValueError(f"{path}: unexpected decompressed size (got {len(raw)}, expected {expected})")

    def paeth(a: int, b: int, c: int) -> int:
        p = a + b - c
        pa = abs(p - a)
        pb = abs(p - b)
        pc = abs(p - c)
        if pa <= pb and pa <= pc:
            return a
        if pb <= pc:
            return b
        return c

    out: list[list[tuple[int, int, int, int]]] = []
    prev = bytearray(w * 4)

    for y in range(h):
        row = bytearray(raw[y * stride : (y + 1) * stride])
        filt = row[0]
        data = row[1:]

        if filt == 0:
            pass
        elif filt == 1:  # Sub
            for i in range(len(data)):
                left = data[i - src_bpp] if i >= src_bpp else 0
                data[i] = (data[i] + left) & 0xFF
        elif filt == 2:  # Up
            for i in range(len(data)):
                data[i] = (data[i] + prev[i]) & 0xFF
        elif filt == 3:  # Average
            for i in range(len(data)):
                left = data[i - src_bpp] if i >= src_bpp else 0
                up = prev[i]
                data[i] = (data[i] + ((left + up) // 2)) & 0xFF
        elif filt == 4:  # Paeth
            for i in range(len(data)):
                left = data[i - src_bpp] if i >= src_bpp else 0
                up = prev[i]
                up_left = prev[i - src_bpp] if i >= src_bpp else 0
                data[i] = (data[i] + paeth(left, up, up_left)) & 0xFF
        else:
            raise ValueError(f"{path}: unsupported PNG filter type {filt} on row {y}")

        pixels: list[tuple[int, int, int, int]] = []
        for x in range(w):
            i = x * src_bpp
            r, g, b = data[i], data[i + 1], data[i + 2]
            a = data[i + 3] if src_bpp == 4 else 255
            pixels.append((r, g, b, a))
        out.append(pixels)
        prev = data

    return out


def write_png(path: Path, img: list[list[tuple[int, int, int, int]]]) -> None:
    h = len(img)
    w = len(img[0])
    raw = bytearray()
    for y in range(h):
        raw.append(0)  # filter type 0
        for x in range(w):
            r, g, b, a = img[y][x]
            raw += bytes((r, g, b, a))
    compressed = zlib.compress(bytes(raw), level=9)

    signature = PNG_SIG
    ihdr = struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)  # 8-bit RGBA
    data = signature + _png_chunk(b"IHDR", ihdr) + _png_chunk(b"IDAT", compressed) + _png_chunk(b"IEND", b"")
    path.write_bytes(data)


def crop_center_square(img: list[list[tuple[int, int, int, int]]]) -> list[list[tuple[int, int, int, int]]]:
    h = len(img)
    w = len(img[0])
    if w == h:
        return img
    s = min(w, h)
    x0 = (w - s) // 2
    y0 = (h - s) // 2
    return [row[x0 : x0 + s] for row in img[y0 : y0 + s]]


def resample_square(img: list[list[tuple[int, int, int, int]]], out_size: int) -> list[list[tuple[int, int, int, int]]]:
    src_h = len(img)
    src_w = len(img[0])
    if src_w != src_h:
        raise ValueError("resample_square expects a square image")
    if out_size == src_w:
        return img

    # Downsample: simple box average (fast enough for our sizes).
    if out_size < src_w:
        sx = src_w / out_size
        sy = src_h / out_size
        out = [[(0, 0, 0, 0) for _ in range(out_size)] for __ in range(out_size)]
        for oy in range(out_size):
            for ox in range(out_size):
                x0 = int(ox * sx)
                y0 = int(oy * sy)
                x1 = int((ox + 1) * sx)
                y1 = int((oy + 1) * sy)
                if x1 <= x0:
                    x1 = x0 + 1
                if y1 <= y0:
                    y1 = y0 + 1

                pr = pg = pb = pa = 0.0
                n = 0
                for y in range(y0, y1):
                    for x in range(x0, x1):
                        r, g, b, a = img[y][x]
                        af = a / 255.0
                        pr += r * af
                        pg += g * af
                        pb += b * af
                        pa += af
                        n += 1
                if n == 0:
                    out[oy][ox] = (0, 0, 0, 0)
                    continue
                pa /= n
                if pa <= 1e-6:
                    out[oy][ox] = (0, 0, 0, 0)
                    continue
                r = int((pr / n) / pa + 0.5)
                g = int((pg / n) / pa + 0.5)
                b = int((pb / n) / pa + 0.5)
                a = int(pa * 255 + 0.5)
                out[oy][ox] = (r, g, b, a)
        return out

    # Upsample: bilinear.
    scale = (src_w - 1) / max(1, (out_size - 1))
    out = [[(0, 0, 0, 0) for _ in range(out_size)] for __ in range(out_size)]
    for oy in range(out_size):
        fy = oy * scale
        y0 = int(fy)
        y1 = min(src_w - 1, y0 + 1)
        ty = fy - y0
        for ox in range(out_size):
            fx = ox * scale
            x0 = int(fx)
            x1 = min(src_w - 1, x0 + 1)
            tx = fx - x0

            def p(x: int, y: int) -> tuple[float, float, float, float]:
                r, g, b, a = img[y][x]
                af = a / 255.0
                return (r * af, g * af, b * af, af)

            r00, g00, b00, a00 = p(x0, y0)
            r10, g10, b10, a10 = p(x1, y0)
            r01, g01, b01, a01 = p(x0, y1)
            r11, g11, b11, a11 = p(x1, y1)

            def lerp(a: float, b: float, t: float) -> float:
                return a + (b - a) * t

            r0 = lerp(r00, r10, tx)
            r1 = lerp(r01, r11, tx)
            g0 = lerp(g00, g10, tx)
            g1 = lerp(g01, g11, tx)
            b0 = lerp(b00, b10, tx)
            b1 = lerp(b01, b11, tx)
            a0 = lerp(a00, a10, tx)
            a1 = lerp(a01, a11, tx)

            rr = lerp(r0, r1, ty)
            gg = lerp(g0, g1, ty)
            bb = lerp(b0, b1, ty)
            aa = lerp(a0, a1, ty)

            if aa <= 1e-6:
                out[oy][ox] = (0, 0, 0, 0)
            else:
                out[oy][ox] = (
                    int(rr / aa + 0.5),
                    int(gg / aa + 0.5),
                    int(bb / aa + 0.5),
                    int(aa * 255 + 0.5),
                )
    return out


def to_ico_bmp(img: list[list[tuple[int, int, int, int]]]) -> bytes:
    # 32-bit BGRA bottom-up + 1-bit AND mask
    h = len(img)
    w = len(img[0])
    header = struct.pack(
        "<IIIHHIIIIII",
        40,  # biSize
        w,  # biWidth
        h * 2,  # biHeight (incl AND mask)
        1,  # biPlanes
        32,  # biBitCount
        0,  # biCompression (BI_RGB)
        w * h * 4,  # biSizeImage
        0,
        0,
        0,
        0,
    )

    px = bytearray()
    for y in range(h - 1, -1, -1):
        for x in range(w):
            r, g, b, a = img[y][x]
            px += bytes((b, g, r, a))

    row_bytes = ((w + 31) // 32) * 4
    mask = bytearray()
    for y in range(h - 1, -1, -1):
        bits = 0
        bitcount = 0
        row = bytearray()
        for x in range(w):
            a = img[y][x][3]
            bit = 1 if a == 0 else 0
            bits = (bits << 1) | bit
            bitcount += 1
            if bitcount == 8:
                row.append(bits & 0xFF)
                bits = 0
                bitcount = 0
        if bitcount:
            bits <<= (8 - bitcount)
            row.append(bits & 0xFF)
        row.extend(b"\x00" * (row_bytes - len(row)))
        mask += row

    return header + px + mask


def build_ico(images: list[tuple[int, int, bytes]]) -> bytes:
    # images: list of (w,h,bytes)
    count = len(images)
    out = bytearray(struct.pack("<HHH", 0, 1, count))
    offset = 6 + 16 * count

    entries = bytearray()
    blobs: list[bytes] = []
    for w, h, data in images:
        entries += struct.pack(
            "<BBBBHHII",
            0 if w == 256 else w,
            0 if h == 256 else h,
            0,
            0,
            1,
            32,
            len(data),
            offset,
        )
        blobs.append(data)
        offset += len(data)

    out += entries
    for data in blobs:
        out += data
    return bytes(out)


def main() -> None:
    ap = argparse.ArgumentParser(description="Generate favicon + PWA/mobile icon assets from a source PNG.")
    ap.add_argument(
        "source_png",
        type=Path,
        help="Path to an 8-bit RGBA PNG (will be center-cropped to square).",
    )
    ap.add_argument(
        "--out-dir",
        type=Path,
        default=Path("web"),
        help="Output directory (default: web/).",
    )
    args = ap.parse_args()

    src = read_png_rgba(args.source_png)
    src = crop_center_square(src)

    out_dir: Path = args.out_dir
    out_dir.mkdir(parents=True, exist_ok=True)

    img16 = resample_square(src, 16)
    img32 = resample_square(src, 32)
    img180 = resample_square(src, 180)
    img192 = resample_square(src, 192)
    img512 = resample_square(src, 512)

    (out_dir / "favicon.ico").write_bytes(build_ico([(16, 16, to_ico_bmp(img16)), (32, 32, to_ico_bmp(img32))]))
    write_png(out_dir / "favicon-32.png", img32)
    write_png(out_dir / "apple-touch-icon.png", img180)
    write_png(out_dir / "icon-192.png", img192)
    write_png(out_dir / "icon-512.png", img512)

    print("Wrote:", out_dir / "favicon.ico")
    print("Wrote:", out_dir / "favicon-32.png")
    print("Wrote:", out_dir / "apple-touch-icon.png")
    print("Wrote:", out_dir / "icon-192.png")
    print("Wrote:", out_dir / "icon-512.png")


if __name__ == "__main__":
    main()
