#!/usr/bin/env python3
"""Inventory native imported places and their embedded tools/scripts without executing code.

Run against the actual original project directory, not the flattened source export.
"""
import argparse
import hashlib
import json
import os
import re
import tempfile
import xml.etree.ElementTree as ET
from collections import Counter
from pathlib import Path
from rbxl_binary_inventory import inspect_binary, BinaryFormatError

SCRIPT_CLASSES = {'Script', 'LocalScript', 'ModuleScript'}
TOOL_CLASSES = {'Tool', 'HopperBin'}
MAX_BYTES = 256 * 1024 * 1024
ASSET_PATTERN = re.compile(r'(?:rbxassetid://|https?://(?:www\.)?roblox\.com/asset/\?(?:[^#]*?&)?id=|https?://assetdelivery\.roblox\.com/v1/asset\?(?:[^#]*?&)?id=)([1-9][0-9]{0,15})(?!\d)', re.I)
SAFE_FILE = re.compile(r'(?:[a-f0-9]{64}|[a-z0-9-]+)\.rbxl\Z')


def atomic_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=path.name+'.', suffix='.tmp', dir=path.parent)
    try:
        with os.fdopen(fd, 'w', encoding='utf8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            f.write('\n')
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)


def property_text(props, name):
    if props is None:
        return ''
    for field in props:
        if field.get('name') == name:
            return ''.join(field.itertext()) if name == 'LinkedSource' else (field.text or '')
    return ''


def inspect_xml(path):
    """Parse trusted local XML map as data; never execute embedded script content."""
    scripts, tools, assets = [], [], set()
    handles = set()
    classes = Counter()
    ancestry = []
    for event, element in ET.iterparse(path, events=('start', 'end')):
        if event == 'start':
            if element.tag == 'Item':
                ancestry.append({'class': element.get('class', ''), 'name': '', 'referent': element.get('referent', '')})
            continue
        if element.tag == 'Properties' and ancestry:
            ancestry[-1]['name'] = property_text(element, 'Name') or ancestry[-1]['class']
        if element.tag == 'Item':
            current = ancestry[-1]
            props = element.find('Properties')
            current['name'] = property_text(props, 'Name') or current['class']
            item_path = '/'.join(x['name'] or x['class'] for x in ancestry)
            kind = current['class']
            classes[kind] += 1
            if kind in SCRIPT_CLASSES:
                source = property_text(props, 'Source')
                linked = ASSET_PATTERN.search(property_text(props, 'LinkedSource'))
                scripts.append({
                    'class': kind, 'path': item_path,
                    'referent': current['referent'],
                    'sourcePresent': bool(source),
                    'sourceSha256': hashlib.sha256(source.encode('utf-8')).hexdigest() if source else None,
                    'sourceBytes': len(source.encode('utf-8')),
                    'linkedSourceId': linked.group(1) if linked else None,
                    'containerTool': next((x['name'] for x in reversed(ancestry[:-1]) if x['class'] in TOOL_CLASSES), None),
                })
            if kind in {'Part','MeshPart','UnionOperation','WedgePart','TrussPart','CornerWedgePart'} and current['name'] == 'Handle':
                parent_tool = next(('/'.join(x['name'] or x['class'] for x in ancestry[:i+1]) for i in range(len(ancestry)-2,-1,-1) if ancestry[i]['class'] == 'Tool'), None)
                if parent_tool: handles.add(parent_tool)
            if kind in TOOL_CLASSES:
                tools.append({'class': kind, 'path': item_path, 'referent': current['referent'],
                              'hasHandle': item_path in handles if kind == 'Tool' else None,
                              'requiresHandle': property_text(props, 'RequiresHandle') != 'false' if kind == 'Tool' else None})
            # Read content property values of this item only, not all descendants.
            if props is not None:
                for field in props:
                    if field.get('name') in {'Texture', 'TextureID', 'MeshId', 'SoundId', 'AnimationId', 'ShirtTemplate', 'PantsTemplate', 'Graphic', 'LinkedSource'}:
                        for asset in ASSET_PATTERN.findall(''.join(field.itertext())):
                            assets.add(asset)
            ancestry.pop()
            element.clear()
    return {'scripts': scripts, 'tools': tools, 'assetIds': sorted(assets, key=lambda x: (len(x), x)), 'classCounts': dict(classes)}


# XML 1.0 permits only these character ranges inside numeric references.
# The input map is never changed; this is used only after strict parsing fails.
NUMERIC_REF = re.compile(rb'&#(?:[xX][0-9a-fA-F]+|[0-9]+);')

def _valid_xml_codepoint(n):
    return n in (9, 10, 13) or (32 <= n <= 0xD7FF) or (0xE000 <= n <= 0xFFFD) or (0x10000 <= n <= 0x10FFFF)

def _repair_numeric_refs(line):
    count = 0
    def replace(match):
        nonlocal count
        value = match.group(0)[2:-1]
        try:
            n = int(value[1:], 16) if value[:1].lower() == b'x' else int(value, 10)
        except ValueError:
            return match.group(0)
        if _valid_xml_codepoint(n):
            return match.group(0)
        count += 1
        return b'&#xFFFD;'
    return NUMERIC_REF.sub(replace, line), count

def inspect_xml_with_recovery(path):
    # Only invoked after a failed strict parse; uses a temporary, disk-backed
    # sanitized copy to avoid loading multi-megabyte maps into RAM.
    fixes = 0
    with tempfile.TemporaryFile(mode='w+b') as temporary, path.open('rb') as source:
        for line in source:
            repaired, count = _repair_numeric_refs(line)
            fixes += count
            temporary.write(repaired)
        if not fixes:
            return None
        temporary.seek(0)
        details = inspect_xml(temporary)
    return details, fixes

def inspect_place(path, expected_hash=None):
    size = path.stat().st_size
    if size > MAX_BYTES:
        return {'status': 'too_large', 'bytes': size, 'scripts': [], 'tools': [], 'assetIds': []}
    with path.open('rb') as f:
        header = f.read(64)
    digest = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(1024*1024), b''):
            digest.update(chunk)
    hash_value = digest.hexdigest()
    if expected_hash and hash_value.lower() != expected_hash.lower():
        return {'status': 'hash_mismatch', 'bytes': size, 'sha256': hash_value, 'scripts': [], 'tools': [], 'assetIds': []}
    if header.startswith(b'<roblox!\x89\xff\r\n\x1a\n'):
        try:
            result = inspect_binary(path)
            return {'status': 'inventoried_binary', 'bytes': size, 'sha256': hash_value, **result}
        except (BinaryFormatError, OSError, UnicodeError) as e:
            return {'status': 'binary_decode_error', 'bytes': size, 'sha256': hash_value,
                    'error': str(e)[:300], 'scripts': [], 'tools': [], 'assetIds': []}
    try:
        result = inspect_xml(path)
        return {'status': 'inventoried', 'bytes': size, 'sha256': hash_value, **result}
    except (ET.ParseError, UnicodeError, ValueError, OSError) as e:
        try:
            recovered = inspect_xml_with_recovery(path)
            if recovered is not None:
                details, fixes = recovered
                return {'status': 'inventoried_with_xml_recovery', 'bytes': size, 'sha256': hash_value,
                        'invalidCharacterReferencesReplaced': fixes, **details}
        except (ET.ParseError, UnicodeError, ValueError, OSError):
            pass
        return {'status': 'xml_parse_error', 'bytes': size, 'sha256': hash_value, 'error': type(e).__name__, 'scripts': [], 'tools': [], 'assetIds': []}


def build(root, limit=None):
    root = Path(root).resolve()
    registry = json.loads((root/'server/native/places.json').read_text(encoding='utf8'))['places']
    catalog_file = root/'site/data/maps.json'
    catalog = json.loads(catalog_file.read_text(encoding='utf8'))
    catalog_rows = {r['id']: r for r in catalog['maps']}
    storage = root/'server/native/maps'
    manifest_dir = root/'server/native/place-manifests'
    summary = []
    counts = Counter()
    items = sorted(registry.items(), key=lambda x: x[0])
    if limit is not None:
        items = items[:limit]
    for i, (place_id, record) in enumerate(items, 1):
        if not re.fullmatch(r'[a-zA-Z0-9][a-zA-Z0-9_-]{0,150}', place_id):
            raise ValueError('Unsafe place ID in registry')
        file = record.get('file')
        if not isinstance(file, str) or not SAFE_FILE.fullmatch(file) or '/' in file or '\\' in file:
            details = {'status':'invalid_filename', 'scripts':[], 'tools':[], 'assetIds':[]}
        else:
            filename = storage / file
            details = inspect_place(filename, record.get('sha256')) if filename.is_file() else {'status':'missing_file', 'scripts':[], 'tools':[], 'assetIds':[]}
        status = details['status']
        counts[status] += 1
        public = {
            'id': place_id, 'name': catalog_rows.get(place_id, {}).get('name', record.get('name', place_id)),
            'year': catalog_rows.get(place_id, {}).get('year'),
            'nativeId': record.get('id'), 'status':status,
            'format': 'binary' if status.startswith(('inventoried_binary', 'binary_decode_error')) else record.get('source',{}).get('format', 'unknown'),
            'scriptCount':len(details['scripts']), 'toolCount':len(details['tools']),
            'invalidCharacterReferencesReplaced': details.get('invalidCharacterReferencesReplaced', 0),
            'assetReferenceCount':len(details['assetIds']),
            'unsupportedBinaryPropertyCount':len(details.get('unsupportedBinaryProperties', [])),
            'hasServerScripts':any(x['class']=='Script' for x in details['scripts']),
            'hasLocalScripts':any(x['class']=='LocalScript' for x in details['scripts']),
            'hasModuleScripts':any(x['class']=='ModuleScript' for x in details['scripts']),
            # This scanner does not prove runtime execution.
            'scriptsExecutable':False,
        }
        manifest = {**public, 'sha256':details.get('sha256'), 'bytes':details.get('bytes'),
                    'scripts':details['scripts'], 'tools':details['tools'], 'assetIds':details['assetIds'],
                    'classCounts':details.get('classCounts', {}),
                    'unsupportedBinaryProperties':details.get('unsupportedBinaryProperties', []),
                    'binaryInstanceCount':details.get('binaryInstanceCount'), 'decodeError': details.get('error')}
        atomic_json(manifest_dir/(place_id+'.json'), manifest)
        summary.append(public)
        if i%25==0:
            print(f'Inventoried {i}/{len(items)} places', flush=True)
    out={'schemaVersion':1, 'total':len(summary), 'statuses':dict(counts), 'places':summary,
         'note':'Inventory only: script presence does not mean script execution is implemented.'}
    atomic_json(root/'site/data/place-capabilities.json', out)
    atomic_json(root/'server/native/place-manifest-index.json', out)
    return out


def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[1])
    ap.add_argument('--limit',type=int,default=None,help='Scan only first N places during testing')
    args=ap.parse_args()
    result=build(args.root,args.limit)
    print('Done:',result['total'],'places;',result['statuses'])
    print('Website metadata: site/data/place-capabilities.json')
    print('Detailed manifests: server/native/place-manifests/')

if __name__=='__main__': main()
