import bz2,importlib.util,json,tempfile,unittest,zipfile
from pathlib import Path
spec=importlib.util.spec_from_file_location('import_novetus',Path(__file__).resolve().parents[1]/'tools/import-novetus.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
XML=b'<roblox version="4"><Item class="Workspace"/></roblox>'
BINARY=b'<roblox!\x89\xff\r\n\x1a\n\0\xff\xfe\x80\0'
class NovetusImportTests(unittest.TestCase):
 def test_all_variants_binary_and_bom_with_stable_ids(self):
  with tempfile.TemporaryDirectory()as folder:
   root=Path(folder);(root/'site/data').mkdir(parents=True);(root/'server/native').mkdir(parents=True)
   (root/'site/data/maps.json').write_text(json.dumps({'maps':[{'id':'2008m-crossroads','name':'Crossroads','year':2008,'era':'2008M','visits':987,'thumb':True}]}))
   (root/'server/native/places.json').write_text(json.dumps({'format':1,'places':{'2008m-crossroads':{'id':42,'file':'old.rbxl'}}}))
   pack=root/'pack.zip'
   with zipfile.ZipFile(pack,'w')as z:
    z.writestr('repo/maps/2008/2008M/2008M - Crossroads.rbxl.bz2',bz2.compress(XML))
    z.writestr('repo/maps/2008/2008M/2008M - Crossroads_desc.txt','Original description')
    z.writestr('repo/legacy/Maps released by year/2008/2008 - Crossroads.rbxl.bz2',bz2.compress(XML))
    z.writestr('repo/maps/Dev - Binary.rbxl.bz2',bz2.compress(BINARY))
    z.writestr('repo/maps/2017/2017 - BOM.rbxl.bz2',bz2.compress(b'\xef\xbb\xbf<?xml version="1.0"?>'+XML))
   first=module.import_pack(root,pack);self.assertEqual(first['entries'],4);self.assertEqual(first['formats'],{'xml':3,'binary':1});self.assertEqual(first['unavailableCatalogIds'],[])
   ids={m['id']:m['nativeId']for m in first['maps']};self.assertEqual(ids['2008m-crossroads'],42)
   second=module.import_pack(root,pack);self.assertEqual(ids,{m['id']:m['nativeId']for m in second['maps']})
   catalog=json.loads((root/'site/data/maps.json').read_text())['maps'];self.assertEqual(len(catalog),4)
   crossroads=next(m for m in catalog if m['id']=='2008m-crossroads');self.assertEqual(crossroads['visits'],987);self.assertTrue(crossroads['thumb']);self.assertEqual(crossroads['description'],'Original description')
   registry=json.loads((root/'server/native/places.json').read_text())['places'];binary=next(m for m in second['maps']if m['format']=='binary');self.assertEqual((root/'server/native/maps'/registry[binary['id']]['file']).read_bytes(),BINARY)
 def test_same_stem_in_distinct_folders_does_not_merge_places(self):
  with tempfile.TemporaryDirectory() as folder:
   root=Path(folder);(root/'site/data').mkdir(parents=True);(root/'server/native').mkdir(parents=True)
   (root/'site/data/maps.json').write_text(json.dumps({'maps':[{'id':'2015-test','name':'Original','visits':55}]}))
   (root/'server/native/places.json').write_text(json.dumps({'format':1,'places':{'2015-test':{'id':7,'file':'old.rbxl'}}}))
   archive=root/'pack.zip'
   with zipfile.ZipFile(archive,'w') as z:
    z.writestr('repo/maps/2015/2015 - Test.rbxl.bz2',bz2.compress(XML))
    z.writestr('repo/maps/2016/2015 - Test.rbxl.bz2',bz2.compress(XML.replace(b'Workspace',b'Players')))
   result=module.import_pack(root,archive)
   self.assertEqual(result['entries'],2)
   self.assertEqual(len(set(r['id'] for r in result['maps'])),2)
   self.assertEqual(len(set(r['nativeId'] for r in result['maps'])),2)
   self.assertEqual(next(r for r in result['maps'] if r['id']=='2015-test')['nativeId'],7)
   self.assertEqual(len(json.loads((root/'site/data/maps.json').read_text())['maps']),2)
   again=module.import_pack(root,archive)
   self.assertEqual([(r['id'],r['nativeId']) for r in result['maps']],[(r['id'],r['nativeId']) for r in again['maps']])
 def test_maps_only_pack_keeps_maps_root(self):
  with tempfile.TemporaryDirectory() as folder:
   root=Path(folder);(root/'site/data').mkdir(parents=True);(root/'server/native').mkdir(parents=True)
   (root/'site/data/maps.json').write_text(json.dumps({'maps':[]}))
   archive=root/'modern-only.zip'
   with zipfile.ZipFile(archive,'w') as z:
    z.writestr('maps/2017/2017 - Modern.rbxl.bz2',bz2.compress(XML))
   result=module.import_pack(root,archive)
   self.assertEqual(result['entries'],1)
   self.assertEqual(result['formats'],{'xml':1})
 def test_archive_traversal_is_rejected(self):
  with tempfile.TemporaryDirectory()as folder:
   file=Path(folder)/'bad.zip'
   with zipfile.ZipFile(file,'w')as z:z.writestr('../outside','bad')
   with self.assertRaises(ValueError):module.Pack(file)
if __name__=='__main__':unittest.main()
