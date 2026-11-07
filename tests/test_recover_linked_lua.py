"""Offline checks for exact Novetus linked-source recovery."""
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[1] / 'tools' / 'recover-linked-lua.py'
spec = importlib.util.spec_from_file_location('recover_linked_lua', SCRIPT)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

class LinkedSourceRecoveryTests(unittest.TestCase):
    def test_only_explicit_linked_source_ids_are_found(self):
        blob = (b'<roblox><Item class="Script"><Properties>'
                b'<Content name="LinkedSource"><url>http://www.roblox.com/asset/?id=1014476</url></Content>'
                b'<ProtectedString name="Source">print(777777)</ProtectedString>'
                b'</Properties></Item></roblox>')
        self.assertEqual(mod.linked_ids(blob), {'1014476'})

    def test_scans_registered_xml_without_touching_other_files(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            maps = root/'server/native/maps'
            maps.mkdir(parents=True)
            (maps/'one.rbxl').write_bytes(b'<roblox><Content name="LinkedSource"><url>rbxassetid://1014476</url></Content></roblox>')
            (maps/'two.rbxl').write_bytes(b'<roblox><Content name="LinkedSource"><url>rbxassetid://2222</url></Content></roblox>')
            (root/'server/native/places.json').write_text(json.dumps({'places':{
                'one':{'file':'one.rbxl'}, 'two':{'file':'two.rbxl'}}}))
            found,count=mod.gather(root,'one')
            self.assertEqual(count,1)
            self.assertEqual(found,{'1014476':{'one'}})

    def test_download_requires_verified_github_blob(self):
        with tempfile.TemporaryDirectory() as temp:
            cache=Path(temp)
            payload=b'print("hello")\n'
            source={'path':'scripts/123.lua','sha':mod.asset.github_blob_sha(payload),
                    'bytes':len(payload)}
            with patch.object(mod.asset,'read_url',return_value=payload):
                ident,status,error=mod.download_one(('123',source),cache)
            self.assertEqual((ident,status,error),('123','downloaded',''))
            self.assertEqual((cache/'123.lua').read_bytes(),payload)
            with patch.object(mod.asset,'read_url',return_value=b'WRONG'):
                _,status,_=mod.download_one(('456',source),cache)
            self.assertEqual(status,'failed')

if __name__=='__main__':
    unittest.main()
