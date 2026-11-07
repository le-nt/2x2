"""Regression checks for handle/link inventory and read-only audit."""
import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools'))
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

    def test_image_does_not_resolve_linked_lua(self):
        self.file.write_text(xml(True))
        cache=self.root/'server/native/asset-library';cache.mkdir(parents=True)
        (cache/'123456.png').write_bytes(b'image')
        detail=manifest.inspect_xml(self.file)
        result=audit.audit_one(self.root,{'id':'sample','status':'inventoried',**detail})
        self.assertEqual(result['counts']['cachedAssets'],1)
        self.assertEqual(result['counts']['unavailableLinkedLua'],1)
        (cache/'123456.lua').write_text('print("linked")')
        result=audit.audit_one(self.root,{'id':'sample','status':'inventoried',**detail})
        self.assertEqual(result['counts']['unavailableLinkedLua'],0)

    def test_binary_manifests_are_audited_and_every_place_is_accounted_for(self):
        folder=self.root/'server/native/place-manifests';folder.mkdir()
        records={name:{'id':i+1} for i,name in enumerate(('binary','xml','broken','missing'))}
        (folder.parent/'places.json').write_text(json.dumps({'places':records}))
        for ident,status in [('binary','inventoried_binary'),('xml','inventoried'),('broken','binary_decode_error')]:
            (folder/(ident+'.json')).write_text(json.dumps({'id':ident,'status':status,
                'scripts':[{'path':'Workspace/Script','sourcePresent':True}],
                'unsupportedBinaryProperties':['Script.Source(type 29)'] if ident=='binary' else []}))
        before={p:p.read_bytes() for p in folder.iterdir()}
        result=audit.run(self.root,write=True)
        self.assertEqual(result['counts']['registered_places'],4)
        self.assertEqual(result['counts']['audited_places'],2)
        self.assertEqual(result['counts']['scripts'],2)
        self.assertEqual(result['counts']['missing_manifest'],1)
        self.assertEqual(result['counts']['unscannable_manifest'],1)
        self.assertEqual(result['manifestStatusCounts']['inventoried_binary'],1)
        self.assertEqual({r['id'] for r in result['skippedPlaces']},{'broken','missing'})
        binary=next(p for p in result['places'] if p['id']=='binary')
        self.assertIn('not decoded',binary['warnings'][1])
        self.assertEqual(before,{p:p.read_bytes() for p in folder.iterdir()})
        self.assertEqual(json.loads((folder.parent/'asset-recovery/compatibility-audit.json').read_text()),result)

    def test_undecoded_source_is_unknown_instead_of_empty(self):
        result=audit.audit_one(self.root,{'id':'partial','status':'inventoried_binary',
            'unsupportedBinaryProperties':['Script.Source(type 29)'],
            'scripts':[{'class':'Script','path':'Workspace/Tool/Fire','sourcePresent':False}],
            'tools':[{'class':'Tool','path':'Workspace/Tool'}]})
        self.assertEqual(result['counts']['unknownSources'],1)
        self.assertEqual(result['counts']['emptySources'],0)
        self.assertEqual(result['counts']['embeddedSources'],0)
        self.assertIn('source_not_decoded',result['tools'][0]['issues'])

if __name__=='__main__':
    unittest.main()
