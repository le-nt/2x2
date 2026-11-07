import importlib.util,json,tempfile,unittest
from pathlib import Path
P=Path(__file__).resolve().parents[1]/'tools/asset-cache-manager.py'
s=importlib.util.spec_from_file_location('cache_manager',P);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
class TestAssetCache(unittest.TestCase):
 def setUp(self):
  t=tempfile.TemporaryDirectory();self.addCleanup(t.cleanup);self.root=Path(t.name)
  p=self.root/'server/native/compat-prepared';p.mkdir(parents=True)
  for id,missing in [('a',['123','456']),('b',['123'])]:
   (p/(id+'.json')).write_text(json.dumps({'placeId':id,'prepared':True,'assets':{'missing':[{'id':x} for x in missing], 'resolved':[]}}))
 def test_dedup_and_ranking(self):
  r=m.summarize(self.root);self.assertEqual(r['missingReferences'],3);self.assertEqual(r['uniqueMissingIds'],2);self.assertEqual(r['assets'][0]['id'],'123');self.assertEqual(r['assets'][0]['placesNeeding'],2)
 def test_binary_skipped(self):
  p=self.root/'server/native/compat-prepared/c.json';p.write_text(json.dumps({'placeId':'c','prepared':False,'assets':{'missing':[{'id':'789'}]}}))
  self.assertEqual(m.summarize(self.root)['uniqueMissingIds'],2)
 def test_export(self):
  m.save_rollup(self.root,m.summarize(self.root));self.assertTrue((self.root/'server/native/asset-recovery/missing-assets.csv').exists())
 def test_import_dry_run_and_apply(self):
  folder=self.root/'recovered';folder.mkdir();(folder/'123.mesh').write_bytes(b'1234')
  self.assertEqual(m.import_dir(self.root,folder)['imported'],1)
  self.assertFalse((self.root/'server/native/asset-library/123.mesh').exists())
  self.assertEqual(m.import_dir(self.root,folder,False)['imported'],1)
  self.assertEqual(m.import_dir(self.root,folder,False)['alreadyPresent'],1)
 def test_conflict_preserves_cache(self):
  folder=self.root/'recovered';folder.mkdir();(folder/'123.png').write_bytes(b'new')
  dest=self.root/'server/native/asset-library/123.png';dest.parent.mkdir(parents=True);dest.write_bytes(b'old')
  self.assertEqual(m.import_dir(self.root,folder,False)['nameConflicts'],1);self.assertEqual(dest.read_bytes(),b'old')
 def test_rejects_bad_names(self):
  folder=self.root/'recovered';folder.mkdir();(folder/'../../foo.txt').name
  (folder/'evil.js').write_text('hi');(folder/'0.png').write_bytes(b'a')
  self.assertEqual(m.import_dir(self.root,folder)['rejected'],2)
if __name__=='__main__':unittest.main()
