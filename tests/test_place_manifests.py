import hashlib, importlib.util, json, tempfile, unittest
from pathlib import Path
SCRIPT = Path(__file__).resolve().parents[1]/'tools/build-place-manifests.py'
spec = importlib.util.spec_from_file_location('place_manifests', SCRIPT)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
XML = b'''<roblox version="4"><Item class="Workspace"><Properties><string name="Name">Workspace</string></Properties><Item class="Tool" referent="T1"><Properties><string name="Name">Sword</string></Properties><Item class="Script" referent="S1"><Properties><string name="Name">Damage</string><ProtectedString name="Source">print(&quot;hi&quot;)</ProtectedString></Properties></Item></Item><Item class="LocalScript"><Properties><string name="Name">Client</string><ProtectedString name="Source">hello</ProtectedString></Properties></Item><Item class="Part"><Properties><Content name="Texture"><url>rbxassetid://12345</url></Content></Properties></Item></Item></roblox>'''
class ScannerTests(unittest.TestCase):
 def test_hierarchy_and_no_script_contents(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d); (root/'server/native/maps').mkdir(parents=True);(root/'site/data').mkdir(parents=True)
   digest=hashlib.sha256(XML).hexdigest();(root/'server/native/maps'/f'{digest}.rbxl').write_bytes(XML)
   (root/'server/native/places.json').write_text(json.dumps({'places':{'sample':{'id':1,'file':f'{digest}.rbxl','sha256':digest}}}))
   (root/'site/data/maps.json').write_text(json.dumps({'maps':[{'id':'sample','name':'Test'}]}))
   result=m.build(root)
   self.assertEqual(result['statuses'],{'inventoried':1})
   manifest=json.loads((root/'server/native/place-manifests/sample.json').read_text())
   self.assertEqual(manifest['toolCount'],1)
   self.assertEqual(manifest['scriptCount'],2)
   self.assertEqual(manifest['scripts'][0]['containerTool'],'Sword')
   self.assertEqual(manifest['assetIds'],['12345'])
   self.assertNotIn('print',json.dumps(manifest))
   self.assertFalse(manifest['scriptsExecutable'])
 def test_binary_and_mismatched_hash(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/'x.rbxl';p.write_bytes(b'<roblox!\x89\xff\r\n\x1a\nother')
   self.assertEqual(m.inspect_place(p)['status'],'binary_needs_decoder')
   self.assertEqual(m.inspect_place(p,'a'*64)['status'],'hash_mismatch')
 def test_xml_error_has_safe_position(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/'bad.rbxl';p.write_bytes(b'<roblox><Item></roblox>')
   result=m.inspect_place(p)
   self.assertEqual(result['status'],'xml_parse_error')
   self.assertEqual(result['parseLine'],1)
   self.assertIsInstance(result['parseColumn'],int)
   self.assertNotIn('<roblox>',json.dumps(result))
 def test_invalid_file_ignored(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);(root/'server/native').mkdir(parents=True);(root/'site/data').mkdir(parents=True)
   (root/'server/native/places.json').write_text(json.dumps({'places':{'bad':{'id':3,'file':'../bad.rbxl'}}}))
   (root/'site/data/maps.json').write_text(json.dumps({'maps':[{'id':'bad'}]}))
   self.assertEqual(m.build(root)['statuses'],{'invalid_filename':1})
if __name__=='__main__':unittest.main()
