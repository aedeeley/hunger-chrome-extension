"""Generate the small toolbar monogram using only the Python standard library."""
from pathlib import Path
import struct
import zlib

root = Path(__file__).resolve().parent.parent / "icons"
root.mkdir(exist_ok=True)

def chunk(name, data):
    return struct.pack(">I", len(data)) + name + data + struct.pack(">I", zlib.crc32(name + data))

for size in (16, 32, 48, 128):
    scale = 4
    pixels = bytearray()
    for y in range(size):
        pixels.append(0)
        for x in range(size):
            samples = []
            for sy in range(scale):
                for sx in range(scale):
                    u, v = (x + (sx + .5) / scale) / size, (y + (sy + .5) / scale) / size
                    dx, dy = max(.19 - u, 0, u - .81), max(.19 - v, 0, v - .81)
                    if dx * dx + dy * dy > .18 ** 2:
                        samples.append((0, 0, 0, 0))
                    elif (.28 < u < .40 and .22 < v < .77) or (.60 < u < .72 and .48 < v < .77) or (.36 < u < .65 and .43 < v < .55):
                        samples.append((247, 248, 242, 255))
                    else:
                        samples.append((60, 99, 75, 255))
            pixels.extend(round(sum(p[i] for p in samples) / len(samples)) for i in range(4))
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(bytes(pixels))) + chunk(b"IEND", b"")
    (root / f"icon{size}.png").write_bytes(png)
print("Generated 16, 32, 48, and 128 pixel extension icons.")
