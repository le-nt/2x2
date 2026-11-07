import importlib.util, tempfile, unittest, hashlib
from pathlib import Path
S = Path(__file__).resolve().parents[1] / 'tools' / 'build-place-manifests.py'
spec = importlib.util.spec_from_file_location('scanner', S)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

class RecoveryTests(unittest.TestCase):
    def test_invalid_references_recover_without_touching_file(self):
        data = b'<roblox><Item class="Script"><Properties><string name="Name">Hi&#x0;!</string><ProtectedString name="Source">print(1)&#11;</ProtectedString></Properties></Item></roblox>'
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'test.rbxl'; p.write_bytes(data)
            result=m.inspect_place(p, hashlib.sha256(data).hexdigest())
            self.assertEqual(result['status'], 'inventoried_with_xml_recovery')
            self.assertEqual(result['invalidCharacterReferencesReplaced'], 2)
            self.assertEqual(len(result['scripts']), 1)
            self.assertEqual(p.read_bytes(), data)
    def test_valid_references_unchanged(self):
        x,n=m._repair_numeric_refs(b'&#x9; &#10; &#x1F600; &#xD800; &#0;')
        self.assertEqual(n,2)
        self.assertEqual(x,b'&#x9; &#10; &#x1F600; &#xFFFD; &#xFFFD;')
    def test_bad_structure_still_fails(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'a.rbxl';p.write_bytes(b'<roblox><broken>&#0;</roblox>')
            self.assertEqual(m.inspect_place(p)['status'],'xml_parse_error')
if __name__=='__main__': unittest.main()
