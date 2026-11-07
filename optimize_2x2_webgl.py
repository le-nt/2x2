#!/usr/bin/env python3
"""Reversible BoxedWine WebGL bufferData shim optimization for RBXBanland.

Usage: python3 optimize_2x2_webgl.py /path/to/RBXBanland
       python3 optimize_2x2_webgl.py /path/to/RBXBanland --restore

Does not change engine binaries or alter rendering results. Conservatively patches
only the expected wrapper and makes one backup per source before the first edit.
"""
from pathlib import Path
import argparse
import re
import sys

OLD_START = '        (function() {\n          function patchBufferData(contextPrototype) {'
OLD_END = '        })();'
STAMP = '/* RBX2X2_BUFFERDATA_SINGLE_COPY_V1 */'

REPLACEMENT = '''        /* RBX2X2_BUFFERDATA_SINGLE_COPY_V1 */
        (function() {
          // Keep the original 256-byte BoxedWine overrun padding workaround.
          // Previously copyBytes() cloned the source, then padded.set() copied it
          // again. This uses a zero-copy source view and one copy into the padded
          // upload buffer. It does not modify the supplied source data.
          function patchBufferData(contextPrototype) {
            if (!contextPrototype || contextPrototype.__boxedwineBufferDataPadding) return;
            contextPrototype.__boxedwineBufferDataPadding = true;

            function bytesView(src, start, length) {
              let bytes;
              if (src instanceof ArrayBuffer) {
                bytes = new Uint8Array(src);
              } else if (ArrayBuffer.isView(src)) {
                bytes = new Uint8Array(src.buffer, src.byteOffset, src.byteLength);
              } else if (src && typeof src.length === "number") {
                bytes = Uint8Array.from(src);
              } else {
                return null;
              }
              const offset = start || 0;
              const end = typeof length === "number" ? offset + length : bytes.length;
              // subarray() constructs a view; unlike slice() it does not copy.
              return bytes.subarray(offset, end);
            }

            const originalBufferData = contextPrototype.bufferData;
            contextPrototype.bufferData = function(target, srcOrSize, usage, srcOffset, length) {
              if (target !== this.ARRAY_BUFFER) {
                return originalBufferData.apply(this, arguments);
              }
              if (arguments.length === 5 && srcOrSize && typeof srcOffset === "number" && typeof length === "number") {
                const source = bytesView(srcOrSize, srcOffset, length);
                if (source) {
                  const padded = new Uint8Array(length + 256);
                  padded.set(source);
                  return originalBufferData.call(this, target, padded, usage);
                }
              }
              if (arguments.length === 3 && srcOrSize && typeof srcOrSize !== "number") {
                const source = bytesView(srcOrSize);
                if (source) {
                  const padded = new Uint8Array(source.length + 256);
                  padded.set(source);
                  return originalBufferData.call(this, target, padded, usage);
                }
              }
              if (arguments.length === 3 && typeof srcOrSize === "number" && srcOrSize > 0) {
                return originalBufferData.call(this, target, srcOrSize + 256, usage);
              }
              return originalBufferData.apply(this, arguments);
            };
          }
          patchBufferData(window.WebGLRenderingContext && window.WebGLRenderingContext.prototype);
          patchBufferData(window.WebGL2RenderingContext && window.WebGL2RenderingContext.prototype);
        })();'''


def patch(text: str) -> str:
    if STAMP in text:
        return text
    start = text.find(OLD_START)
    if start < 0:
        raise ValueError('Expected WebGL bufferData wrapper not found; refusing to patch')
    end = text.find(OLD_END, start)
    if end < 0:
        raise ValueError('WebGL bufferData wrapper terminator missing')
    end += len(OLD_END)
    original = text[start:end]
    required = ['function copyBytes(', 'contextPrototype.bufferData = function(', 'var extraPadding = 256;', 'patchBufferData(window.WebGL2RenderingContext']
    if any(part not in original for part in required):
        raise ValueError('Wrapper differs from inspected GitHub source; refusing to patch')
    return text[:start] + REPLACEMENT + text[end:]


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('repo', nargs='?', default='.', help='RBXBanland repository root')
    ap.add_argument('--restore', action='store_true')
    args = ap.parse_args()
    root = Path(args.repo)
    names = ['site/emu/boxedwine-shell.js', 'site/emu-mt/boxedwine-shell.js', 'site/emu-prof/boxedwine-shell.js']
    targets = [root / n for n in names]
    for p in targets:
        if not p.is_file():
            print('ERROR: missing', p, file=sys.stderr)
            return 1
    if args.restore:
        for p in targets:
            backup = p.with_name(p.name + '.before-single-copy')
            if backup.is_file():
                p.write_bytes(backup.read_bytes())
                print('Restored:', p)
            else:
                print('No backup:', p)
        return 0

    edits = []
    for p in targets:
        source = p.read_text(encoding='utf8')
        modified = patch(source)
        edits.append((p, source, modified))
    for p, source, modified in edits:
        if modified == source:
            print('Already optimized:', p)
            continue
        backup = p.with_name(p.name + '.before-single-copy')
        if backup.exists() and backup.read_text(encoding='utf8') != source:
            raise RuntimeError(f'Existing backup differs from current source: {backup}. Refusing overwrite.')
        if not backup.exists():
            backup.write_text(source, encoding='utf8')
        p.write_text(modified, encoding='utf8')
        print('Optimized:', p)
    print('Done. Hard-refresh browser to retest. No BoxedWine rebuild required.')
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
