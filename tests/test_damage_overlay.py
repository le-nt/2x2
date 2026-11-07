import importlib.util
import struct
import unittest
import zlib
from pathlib import Path

spec=importlib.util.spec_from_file_location('overlay',Path(__file__).resolve().parents[1]/'tools/build-damage-overlay.py')
overlay=importlib.util.module_from_spec(spec);spec.loader.exec_module(overlay)

class OverlayTests(unittest.TestCase):
    def test_checked_in_overlay_is_reproducible_and_transparent_in_the_center(self):
        file=Path(__file__).resolve().parents[1]/'server/native/asset-library/34854607.png'
        data=file.read_bytes()
        self.assertEqual(data,overlay.overlay_png())
        self.assertEqual(data[:8],b'\x89PNG\r\n\x1a\n')
        pos=8;packed=b''
        while pos<len(data):
            size=struct.unpack('>I',data[pos:pos+4])[0]
            if data[pos+4:pos+8]==b'IDAT':packed+=data[pos+8:pos+8+size]
            pos+=12+size
        pixels=zlib.decompress(packed)
        alpha=lambda x,y:pixels[y*(256*4+1)+1+x*4+3]
        self.assertEqual(alpha(128,128),0)
        self.assertGreater(alpha(0,128),150)

if __name__=='__main__':unittest.main()
