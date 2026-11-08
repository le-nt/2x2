#!/usr/bin/env python3
"""Bounded static place analysis. Never executes Lua or changes original bytes."""
import hashlib
import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from rbxl_binary_inventory import inspect_binary, MAGIC, ASSET_RE

MAX_BYTES = 128 * 1024 * 1024
SCRIPT_CLASSES = {'Script', 'LocalScript', 'ModuleScript'}
RESOURCE_RE = re.compile(r'h?rbxasset://[^\x00-\x1f<>"\x27\r\n]{1,1024}', re.I)

def analyze_place(file):
    file = Path(file)
    if not file.is_file() or not 0 < file.stat().st_size <= MAX_BYTES:
        raise ValueError('Place must be nonempty and <=128 MiB')
    data = file.read_bytes()
    original_hash = hashlib.sha256(data).hexdigest()
    if data.startswith(MAGIC):
        result = inspect_binary(file)
        return {**result, 'format':'binary', 'sha256':original_hash,
                'valid':True, 'coverage':'binary_string_properties_partial',
                'gameplayStatus':'not_tested'}
    # External/internal entities are unnecessary for historical Roblox XML.
    if re.search(br'<!\s*(?:DOCTYPE|ENTITY)\b', data, re.I):
        raise ValueError('DTD/entity declarations are not supported')
    try:
        root = ET.fromstring(data)
    except ET.ParseError as error:
        raise ValueError('Invalid Roblox XML: '+str(error)) from error
    if root.tag != 'roblox':
        raise ValueError('XML root must be roblox')
    scripts, resources, ids, stack = [], set(), set(), [(root, [], 0)]
    instances = 0
    while stack:
        node, ancestry, depth = stack.pop()
        if depth > 256:
            raise ValueError('XML hierarchy depth exceeds limit')
        chain = ancestry
        if node.tag == 'Item':
            instances += 1
            if instances > 2_000_000:
                raise ValueError('Instance count exceeds limit')
            kind = node.get('class', '')
            props = node.find('Properties')
            values = {p.get('name'):''.join(p.itertext()) for p in props} if props is not None else {}
            chain = ancestry + [values.get('Name') or kind]
            if kind in SCRIPT_CLASSES:
                source = values.get('Source', '')
                scripts.append({'class':kind, 'path':'/'.join(chain), 'disabled':values.get('Disabled','false').strip().lower() == 'true',
                    'sourcePresent':bool(source.strip()), 'sourceBytes':len(source.encode('utf8')),
                    'sourceSha256':hashlib.sha256(source.encode('utf8')).hexdigest(),
                    'linkedSource':values.get('LinkedSource') or None,
                    'compileStatus':'not_tested', 'startStatus':'not_tested', 'runtimeStatus':'not_tested'})
        # Scan decoded values including XML entities and all string properties.
        if node.text:
            ids.update(ASSET_RE.findall(node.text))
            resources.update(m.rstrip() for m in RESOURCE_RE.findall(node.text))
        for child in reversed(list(node)):
            stack.append((child,chain,depth+1))
    return {'format':'xml', 'valid':True, 'coverage':'xml_properties_and_literal_references',
            'sha256':original_hash, 'instanceCount':instances, 'scripts':scripts,
            'assetIds':sorted(ids,key=lambda x:(len(x),x)), 'resourceReferences':sorted(resources),
            'gameplayStatus':'not_tested', 'limitations':['Computed Lua references require runtime observation; Lua was not executed.']}

if __name__ == '__main__':
    try:
        if len(sys.argv) != 2:
            raise ValueError('Usage: analyze-place.py FILE')
        print(json.dumps(analyze_place(sys.argv[1])))
    except (ValueError, OSError, ET.ParseError) as error:
        print(str(error)[:240],file=sys.stderr)
        raise SystemExit(1)
