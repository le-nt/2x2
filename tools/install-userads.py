#!/usr/bin/env python3
"""Install original Roblox ad archive by measured image dimensions.

Usage: py tools/install-userads.py --root C:\\RBXBanland --archive C:\\path\\archive.zip
"""
import argparse
import hashlib
import re
import struct
import zipfile
from collections import Counter
from pathlib import Path

PNG_MAGIC = b'\x89PNG\r\n\x1a\n'
CATEGORIES = {(160, 600): 'skyscraper', (728, 90): 'banner', (727, 90): 'banner',
              (300, 250): 'rectangle', (800, 600): 'feature'}


def clean_name(name):
    stem = Path(name).stem
    return re.sub(r'[^a-zA-Z0-9_-]+', '-', stem).strip('-').lower()[:64] or 'archived-ad'


def install(root, archive):
    dest = root / 'site' / 'img' / 'userads'
    counts = Counter()
    seen_hashes = set()
    with zipfile.ZipFile(archive) as source:
        for entry in source.infolist():
            if entry.is_dir() or not entry.filename.lower().endswith('.png'):
                continue
            if entry.file_size > 16 * 1024 * 1024:
                print(f'[skip] Too large: {entry.filename}')
                continue
            content = source.read(entry)
            if content[:8] != PNG_MAGIC or len(content) < 24:
                print(f'[skip] Invalid PNG: {entry.filename}')
                continue
            dims = struct.unpack('>II', content[16:24])
            category = CATEGORIES.get(dims)
            if not category:
                print(f'[skip] Unsupported ad dimensions {dims}: {entry.filename}')
                continue
            digest = hashlib.sha256(content).hexdigest()
            if digest in seen_hashes:
                print(f'[skip] Duplicate image: {entry.filename}')
                continue
            seen_hashes.add(digest)
            folder = dest / category
            folder.mkdir(parents=True, exist_ok=True)
            filename = f'{clean_name(entry.filename)}-{digest[:10]}.png'
            target = folder / filename
            if not target.exists():
                target.write_bytes(content)
            counts[category] += 1
    print('Imported original Roblox advertisements into:', dest)
    for category in ('skyscraper', 'banner', 'rectangle', 'feature'):
        print(f'  {category}: {counts[category]}')
    print('Existing site/img/ads content and native-client files were not changed.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, required=True, help='2x2 checkout')
    parser.add_argument('--archive', type=Path, required=True, help='Original archive')
    args = parser.parse_args()
    if not (args.root / 'site' / 'img').is_dir():
        parser.error(f'Not a 2x2 checkout: {args.root}')
    if not args.archive.is_file():
        parser.error(f'Archive not found: {args.archive}')
    install(args.root, args.archive)


if __name__ == '__main__':
    main()
