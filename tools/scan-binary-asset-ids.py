#!/usr/bin/env python3
"""Expose binary-RBXL asset IDs as JSON for the Node seeder (read-only)."""
import json
import sys
from pathlib import Path
from rbxl_binary_inventory import inspect_binary, BinaryFormatError

if __name__ == '__main__':
    if len(sys.argv) != 2:
        print('Usage: scan-binary-asset-ids.py FILE',file=sys.stderr)
        raise SystemExit(2)
    file=Path(sys.argv[1]).resolve(strict=True)
    if not file.is_file() or file.stat().st_size>128*1024*1024:
        print('Invalid map file',file=sys.stderr)
        raise SystemExit(2)
    try:
        result=inspect_binary(file)
        print(json.dumps({'ids':result['assetIds'],
                          'unsupportedProperties':result['unsupportedBinaryProperties'],
                          'binaryInstanceCount':result['binaryInstanceCount']}))
    except (BinaryFormatError, ValueError, OSError) as exc:
        print(str(exc)[:240],file=sys.stderr)
        raise SystemExit(1)
