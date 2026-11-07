import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

P=Path(__file__).resolve().parents[1]/'tools'/'prepare-place-compat.py'
spec=importlib.util.spec_from_file_location('prep',P)
prep=importlib.util.module_from_spec(spec);spec.loader.exec_module(prep)

class PrepareTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
        self.root=Path(self.tmp.name)
        self.registry=self.root/'server/native/places.json'
        self.registry.parent.mkdir(parents=True)
        self.registry.write_text(json.dumps({'places':{'2008m-crossroads':{'id':1,'file':'ab.rbxl','sha256':'abc'}}}))
        self.manifest=self.root/'server/native/place-manifests/2008m-crossroads.json'
        self.manifest.parent.mkdir(parents=True)
        self.manifest.write_text(json.dumps({'id':'2008m-crossroads','status':'inventoried','assetIds':['123','456'],
            'scripts':[{'class':'Script','containerTool':'Sword'}],'tools':[{'class':'Tool'}]}))
        p=self.root/'server/native/asset-library';p.mkdir(parents=True);(p/'123.mesh').write_bytes(b'hello')
    def test_preflight_dry_run_has_no_outputs(self):
        summary,rows=prep.build(self.root,place='2008m-crossroads')
        self.assertEqual(summary['assetsMissing'],1)
        self.assertEqual(summary['assetsResolved'],1)
        self.assertFalse((self.root/'server/native/compat-prepared').exists())
        self.assertEqual(rows[0]['tools']['withEmbeddedScripts'],1)
    def test_write_only_reports(self):
        prep.build(self.root,write=True)
        self.assertTrue((self.root/'server/native/compat-prepared/index.json').exists())
        self.assertFalse((self.root/'server/native/maps').exists())
    def test_unknown_place_rejected(self):
        with self.assertRaises(ValueError):prep.build(self.root,place='../oops')
    def test_symlink_escape_not_resolved(self):
        outside=self.root/'outside.png';outside.write_bytes(b'X')
        library=self.root/'server/native/asset-library';(library/'456.png').symlink_to(outside)
        self.assertIsNone(prep.find_asset(self.root,'456'))
    def test_binary_inventory_not_marked_prepared(self):
        m=json.loads(self.manifest.read_text());m['status']='binary_decode_error';self.manifest.write_text(json.dumps(m))
        _,rows=prep.build(self.root)
        self.assertFalse(rows[0]['prepared']);self.assertEqual(rows[0]['assets']['resolved'],[])

if __name__=='__main__':unittest.main()
