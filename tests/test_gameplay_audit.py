"""Regression checks for handle/link inventory and read-only audit."""
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
def load(name,file):
    spec=importlib.util.spec_from_file_location(name,ROOT/'tools'/file)
    obj=importlib.util.module_from_spec(spec);spec.loader.exec_module(obj)
    return obj
manifest=load('build_place_manifest_checks','build-place-manifests.py')
audit=load('audit_gameplay_checks','audit-gameplay-compat.py')

def xml(tool_has_handle):
    handle=('''<Item class="Part"><Properties><string name="Name">Handle</string></Properties></Item>'''
            if tool_has_handle else '')
    return ('''<roblox version="4"><Item class="Workspace"><Properties><string name="Name">Workspace</string></Properties>
    <Item class="Tool"><Properties><string name="Name">Paintball</string><bool name="RequiresHandle">true</bool></Properties>'''
    +handle+'''<Item class="Script"><Properties><string name="Name">Fire</string>
    <ProtectedString name="Source"></ProtectedString>
    <Content name="LinkedSource"><url>http://www.roblox.com/asset/?id=123456</url></Content>
    <Content name="SoundId"><url>https://assetdelivery.roblox.com/v1/asset?id=78910</url></Content>
    </Properties></Item></Item></Item></roblox>''')

class CompatibilityAuditTests(unittest.TestCase):
    def setUp(self):
        tmp=tempfile.TemporaryDirectory();self.addCleanup(tmp.cleanup)
        self.root=Path(tmp.name)
        folder=self.root/'server/native/maps';folder.mkdir(parents=True)
        self.file=folder/'sample.rbxl'

    def test_handle_and_nested_linked_source(self):
        self.file.write_text(xml(True))
        result=manifest.inspect_xml(self.file)
        self.assertEqual(result['tools'][0]['hasHandle'],True)
        self.assertEqual(result['tools'][0]['requiresHandle'],True)
        self.assertEqual(result['scripts'][0]['linkedSourceId'],'123456')
        self.assertFalse(result['scripts'][0]['sourcePresent'])
        self.assertIn('78910',result['assetIds'])
        self.assertIn('123456',result['assetIds'])

    def test_missing_handle_reported_without_modification(self):
        self.file.write_text(xml(False))
        details=manifest.inspect_xml(self.file)
        enriched={'id':'sample','status':'inventoried',**details}
        before=self.file.read_bytes()
        report=audit.audit_one(self.root,enriched)
        self.assertIn('required_handle_missing',report['tools'][0]['issues'])
        self.assertEqual(report['counts']['emptySources'],1)
        self.assertEqual(report['counts']['unavailableLinkedLua'],1)
        self.assertEqual(report['counts']['missingAssets'],2)
        self.assertEqual(self.file.read_bytes(),before)

    def test_cache_resolves_asset_id_without_overwrite(self):
        self.file.write_text(xml(True))
        cache=self.root/'server/native/asset-library';cache.mkdir(parents=True)
        (cache/'78910.ogg').write_bytes(b'OggS-data')
        detail=manifest.inspect_xml(self.file)
        result=audit.audit_one(self.root,{'id':'sample','status':'inventoried',**detail})
        self.assertEqual(result['counts']['cachedAssets'],1)
        self.assertEqual(result['counts']['missingAssets'],1)

if __name__=='__main__':
    unittest.main()
