"""Read-only partial RBXL v0 inventory decoder. No Lua execution, no map modification.

Recognizes INST/PROP/PRNT chunks. Only string-like PROP values are decoded;
unsupported PROP types do not invalidate the class and hierarchy inventory.
Limits chunk expansion and instance counts for resilience to malformed files.
"""
import hashlib
import re
import struct
from collections import Counter
from pathlib import Path

MAGIC = b'<roblox!\x89\xff\r\n\x1a\n'
MAX_INSTANCES = 2_000_000
MAX_CHUNK = 128 * 1024 * 1024
MAX_STRING = 16 * 1024 * 1024
SCRIPT_CLASSES = {'Script', 'LocalScript', 'ModuleScript'}
TOOL_CLASSES = {'Tool', 'HopperBin'}
ASSET_PROPERTIES = {'Texture', 'TextureID', 'TextureId', 'MeshId', 'MeshID', 'SoundId', 'SoundID',
                    'AnimationId', 'ShirtTemplate', 'PantsTemplate', 'Graphic', 'LinkedSource'}
ASSET_RE = re.compile(r'(?:rbxassetid://|https?://(?:www\.)?roblox\.com/asset/?\?[^\s\"\x27<>]{0,256}?\bid=|https?://assetdelivery\.roblox\.com/v[12]/asset/?\?[^\s\"\x27<>]{0,256}?\bid=|https?://(?:www\.)?projectpizza\.net/(?:api/)?asset/?\?[^\s\"\x27<>]{0,256}?\bid=|h?rbxasset://(?:\.\./|\./)*shareddata/(?:SBCR|assets)/)([1-9][0-9]{0,15})(?!\d)', re.I)

class BinaryFormatError(ValueError):
    pass

class Reader:
    def __init__(self, data):
        self.data = data
        self.pos = 0
    def take(self, n):
        if n < 0 or self.pos + n > len(self.data):
            raise BinaryFormatError('Truncated binary chunk')
        out = self.data[self.pos:self.pos+n]
        self.pos += n
        return out
    def u8(self):
        return self.take(1)[0]
    def u32(self):
        return struct.unpack('<I', self.take(4))[0]
    def i32(self):
        return struct.unpack('<i', self.take(4))[0]
    def string(self):
        size = self.u32()
        if size > MAX_STRING:
            raise BinaryFormatError('String exceeds safety limit')
        return self.take(size).decode('utf-8', 'replace')
    def refs(self, count):
        if count > MAX_INSTANCES:
            raise BinaryFormatError('Too many references')
        raw = self.take(count * 4)
        values = [0] * count
        for i in range(count):
            # Roblox arrays are byte-plane interleaved, big-endian integers within planes.
            value = (raw[i] << 24) | (raw[count+i] << 16) | (raw[2*count+i] << 8) | raw[3*count+i]
            delta = (value >> 1) ^ -(value & 1)
            values[i] = delta + (values[i-1] if i else 0)
        return values


def lz4_block(src, expected):
    if expected > MAX_CHUNK:
        raise BinaryFormatError('Decompressed chunk exceeds safety limit')
    out = bytearray()
    i = 0
    while i < len(src):
        token = src[i]; i += 1
        lit = token >> 4
        if lit == 15:
            while True:
                if i >= len(src): raise BinaryFormatError('Truncated LZ4 literal length')
                b = src[i]; i += 1; lit += b
                if b != 255: break
        if i + lit > len(src) or len(out) + lit > expected:
            raise BinaryFormatError('Invalid LZ4 literal length')
        out.extend(src[i:i+lit]); i += lit
        if i == len(src): break
        if i+2 > len(src): raise BinaryFormatError('Truncated LZ4 offset')
        offset = src[i] | (src[i+1] << 8); i += 2
        if not offset or offset > len(out): raise BinaryFormatError('Invalid LZ4 back reference')
        match = (token & 15) + 4
        if (token & 15) == 15:
            while True:
                if i >= len(src): raise BinaryFormatError('Truncated LZ4 match length')
                b = src[i]; i += 1; match += b
                if b != 255: break
        if len(out) + match > expected: raise BinaryFormatError('Oversized LZ4 match')
        for _ in range(match):
            out.append(out[-offset])
    if len(out) != expected:
        raise BinaryFormatError('LZ4 uncompressed length mismatch')
    return bytes(out)


def inspect_binary(path):
    classes = {}
    instances = {}
    parent = {}
    names = {}
    source_info = {}
    assets = set()
    unsupported = set()
    linked_sources = {}
    with Path(path).open('rb') as f:
        if f.read(len(MAGIC)) != MAGIC:
            raise BinaryFormatError('Not a binary Roblox file')
        if f.read(2) != b'\x00\x00':
            raise BinaryFormatError('Unsupported binary Roblox version')
        header = f.read(16)
        if len(header) != 16: raise BinaryFormatError('Truncated RBXL header')
        class_count, instance_count = struct.unpack_from('<II', header)
        if class_count > 100_000 or instance_count > MAX_INSTANCES:
            raise BinaryFormatError('Header count exceeds safety limit')
        ended = False
        while True:
            h = f.read(16)
            if not h: break
            if len(h) != 16: raise BinaryFormatError('Truncated chunk header')
            tag = h[:4]
            compressed, expanded = struct.unpack_from('<II', h, 4)
            if max(compressed, expanded) > MAX_CHUNK:
                raise BinaryFormatError('Chunk exceeds safety limit')
            payload = f.read(compressed or expanded)
            if len(payload) != (compressed or expanded):
                raise BinaryFormatError('Truncated chunk payload')
            if tag == b'END.':
                ended = True
                break
            if tag not in (b'INST', b'PROP', b'PRNT'):
                continue
            data = lz4_block(payload, expanded) if compressed else payload
            r = Reader(data)
            if tag == b'INST':
                cid = r.i32(); cname = r.string(); service = r.u8(); count = r.u32()
                ids = r.refs(count)
                if service: r.take(count)
                if cid in classes or any(ref in instances for ref in ids):
                    raise BinaryFormatError('Duplicate instance/class identifiers')
                classes[cid] = (cname, ids)
                for ref in ids: instances[ref] = cname
            elif tag == b'PROP':
                cid = r.i32(); pname = r.string(); typ = r.u8()
                if cid not in classes: raise BinaryFormatError('PROP before matching INST')
                cname, ids = classes[cid]
                if typ != 1:
                    if pname in ({'Name', 'Source'} | ASSET_PROPERTIES):
                        unsupported.add(cname+'.'+pname+'(type '+str(typ)+')')
                    continue
                if pname not in ({'Name', 'Source'} | ASSET_PROPERTIES):
                    continue
                # PROP string values use consecutive length-prefixed strings.
                for ref in ids:
                    val = r.string()
                    # Scan every decoded string property that may contain asset IDs,
                    # including Source strings embedded in Scripts/LocalScripts.
                    if pname != 'Name':
                        assets.update(ASSET_RE.findall(val))
                    if pname == 'Name': names[ref] = val
                    elif pname == 'Source' and cname in SCRIPT_CLASSES:
                        encoded = val.encode('utf-8')
                        source_info[ref] = {'sourcePresent': bool(val),
                            'sourceSha256': hashlib.sha256(encoded).hexdigest() if val else None,
                            'sourceBytes': len(encoded)}
                    elif pname in ASSET_PROPERTIES:
                        assets.update(ASSET_RE.findall(val))
                        if pname == 'LinkedSource' and cname in SCRIPT_CLASSES:
                            linked = ASSET_RE.search(val)
                            linked_sources[ref] = linked.group(1) if linked else None
            elif tag == b'PRNT':
                r.u8(); count = r.u32()
                children = r.refs(count); parents = r.refs(count)
                parent.update(zip(children, parents))
        if not ended: raise BinaryFormatError('Missing END chunk')
    def ancestry(ref):
        chain=[]; seen=set()
        while ref in instances:
            if ref in seen or len(chain)>128: raise BinaryFormatError('Cyclic or excessive hierarchy depth')
            seen.add(ref)
            kind = instances[ref]
            chain.append((kind, names.get(ref) or kind))
            ref = parent.get(ref, -1)
        return list(reversed(chain))
    scripts=[]; tools=[]
    for ref, kind in instances.items():
        if kind not in SCRIPT_CLASSES | TOOL_CLASSES: continue
        chain = ancestry(ref)
        item={'class':kind, 'path':'/'.join(n for _,n in chain), 'referent':str(ref)}
        if kind in TOOL_CLASSES:
            tools.append(item)
        else:
            item.update(source_info.get(ref, {'sourcePresent':False,'sourceSha256':None,'sourceBytes':0}))
            item['linkedSourceId'] = linked_sources.get(ref)
            item['containerTool'] = next((n for k,n in reversed(chain[:-1]) if k in TOOL_CLASSES),None)
            scripts.append(item)
    return {'scripts':scripts, 'tools':tools, 'assetIds':sorted(assets, key=lambda x:(len(x),x)),
            'classCounts':dict(Counter(instances.values())),
            'unsupportedBinaryProperties':sorted(unsupported), 'binaryInstanceCount':len(instances)}
