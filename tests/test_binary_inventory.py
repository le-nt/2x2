import importlib.util
import struct
import tempfile
import unittest
from pathlib import Path

MODULE = Path(__file__).resolve().parents[1] / 'tools' / 'rbxl_binary_inventory.py'
spec = importlib.util.spec_from_file_location('rbxl_binary_inventory', MODULE)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

def u32(n): return struct.pack('<I', n)
def i32(n): return struct.pack('<i', n)
def st(s):
    raw = s.encode('utf8'); return u32(len(raw)) + raw

def refs(vals):
    arr=[]; prev=0
    for v in vals:
        n=v-prev; prev=v
        arr.append(((n << 1) ^ (n >> 31)) & 0xffffffff)
    return b''.join(bytes((n >> (24 - 8*j)) & 255 for n in arr) for j in range(4))

def chunk(tag, payload): return tag + u32(0) + u32(len(payload)) + b'\0'*4 + payload

def instance(cid, name, ids):
    return chunk(b'INST', i32(cid)+st(name)+b'\0'+u32(len(ids))+refs(ids))
def prop(cid, name, values):
    return chunk(b'PROP', i32(cid)+st(name)+b'\x01'+b''.join(st(v) for v in values))

def fixture():
    data=m.MAGIC+b'\0\0'+u32(3)+u32(3)+b'\0'*8
    data+=instance(0,'Folder',[1])+instance(1,'Tool',[2])+instance(2,'Script',[3])
    data+=prop(0,'Name',['Workspace'])+prop(1,'Name',['MagicWand'])+prop(2,'Name',['DoThing'])
    data+=prop(2,'Source',['print("hello")'])
    data+=prop(1,'TextureId',['rbxassetid://12345'])
    data+=chunk(b'PRNT',b'\0'+u32(3)+refs([1,2,3])+refs([-1,1,2]))
    return data+chunk(b'END.',b'</roblox>')

class Tests(unittest.TestCase):
    def test_tool_script_asset_hierarchy(self):
        with tempfile.TemporaryDirectory() as t:
            p=Path(t)/'map.rbxl';p.write_bytes(fixture())
            result=m.inspect_binary(p)
        self.assertEqual(result['binaryInstanceCount'],3)
        self.assertEqual(result['classCounts'],{'Folder':1,'Tool':1,'Script':1})
        self.assertEqual(result['tools'][0]['path'],'Workspace/MagicWand')
        self.assertEqual(result['scripts'][0]['containerTool'],'MagicWand')
        self.assertEqual(result['scripts'][0]['path'],'Workspace/MagicWand/DoThing')
        self.assertEqual(result['assetIds'],['12345'])
        self.assertTrue(result['scripts'][0]['sourcePresent'])
        self.assertNotIn('print(',str(result))
    def test_linked_source_is_available_to_gameplay_audit(self):
        data=fixture()
        end=chunk(b'END.',b'</roblox>')
        data=data[:-len(end)]+prop(2,'LinkedSource',['https://assetdelivery.roblox.com/v1/asset?version=1&id=98765'])+end
        with tempfile.TemporaryDirectory() as t:
            p=Path(t)/'map.rbxl';p.write_bytes(data)
            result=m.inspect_binary(p)
        self.assertEqual(result['scripts'][0]['linkedSourceId'],'98765')
        self.assertIn('98765',result['assetIds'])
    def test_lz4_simple_literal(self):
        self.assertEqual(m.lz4_block(b'\x50hello',5),b'hello')
    def test_truncated_file_fails(self):
        with tempfile.TemporaryDirectory() as t:
            p=Path(t)/'map.rbxl';p.write_bytes(fixture()[:-10])
            with self.assertRaises(m.BinaryFormatError):m.inspect_binary(p)
    def test_bad_lz4_offset_fails(self):
        with self.assertRaises(m.BinaryFormatError):m.lz4_block(b'\x00\x01\x00',4)

if __name__=='__main__': unittest.main()
