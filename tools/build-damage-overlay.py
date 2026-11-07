#!/usr/bin/env python3
"""Build an original, transparent red vignette for legacy hurt-overlay ID 34854607.

No download or image dependencies. Existing asset files are never overwritten.
"""
import argparse
import binascii
import struct
import zlib
from pathlib import Path


def overlay_png(size=256):
    def chunk(kind,data):
        return struct.pack('>I',len(data))+kind+data+struct.pack('>I',binascii.crc32(kind+data)&0xffffffff)
    rows=bytearray()
    for y in range(size):
        rows.append(0)  # PNG scanline filter: none
        for x in range(size):
            edge=max(abs(2*x/(size-1)-1),abs(2*y/(size-1)-1))
            alpha=round(210*max(0,(edge-.45)/.55)**2)
            rows.extend((220,0,0,alpha))
    header=struct.pack('>IIBBBBB',size,size,8,6,0,0,0)
    return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',header)+chunk(b'IDAT',zlib.compress(rows,9))+chunk(b'IEND',b'')


if __name__=='__main__':
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[1])
    args=ap.parse_args()
    target=args.root/'server/native/asset-library/34854607.png'
    target.parent.mkdir(parents=True,exist_ok=True)
    with target.open('xb') as stream:
        stream.write(overlay_png())
    print(target)
