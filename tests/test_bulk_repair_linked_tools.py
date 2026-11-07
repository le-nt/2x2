import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

P = Path(__file__).resolve().parents[1] / 'tools' / 'bulk-repair-linked-tools.py'
spec = importlib.util.spec_from_file_location('bulk_repair', P)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


def tool(name, empty=True):
    return f'''<Item class="Tool"><Properties><string name="Name">{name}</string></Properties>
    <Item class="Script"><Properties><string name="Name">PlantBomb</string><ProtectedString name="Source">{'' if empty else 'print(123)'}</ProtectedString><Content name="LinkedSource"><url>http://old</url></Content></Properties></Item>
    </Item>'''


class RepairTests(unittest.TestCase):
    def setUp(self):
        self.sources={'LinkedTimebomb':{'PlantBomb':'print("restored")'}}

    def test_exact_match(self):
        data=f'<roblox>{tool("LinkedTimebomb")}</roblox>'.encode()
        out, fixes, _ = mod.repaired_tree(data,self.sources)
        self.assertEqual(len(fixes),1)
        self.assertIn(b'print("restored")',out)
        self.assertIn(b'<null></null>',out)

    def test_preserves_existing(self):
        data=f'<roblox>{tool("LinkedTimebomb",False)}</roblox>'.encode()
        out, fixes, skip=mod.repaired_tree(data,self.sources)
        self.assertIsNone(out)
        self.assertEqual(skip['workingSourcePreserved'],1)

    def test_does_not_fill_wrong_tool(self):
        data=f'<roblox>{tool("SomeOtherTool")}</roblox>'.encode()
        out, fixes, _=mod.repaired_tree(data,self.sources)
        self.assertIsNone(out)

    def test_non_destructive_activation(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d)
            maps=root/'server/native/maps';maps.mkdir(parents=True)
            original=f'<roblox>{tool("LinkedTimebomb")}</roblox>'.encode()
            (maps/'sample.rbxl').write_bytes(original)
            registry={'places':{'sample':{'file':'sample.rbxl','sha256':'old'},'2008m-crossroads':{'file':'crossroads.rbxl'}}}
            (maps.parent/'places.json').write_text(json.dumps(registry))
            (root/'tools').mkdir()
            (root/'tools/crossroads-tool-sources.json').write_text(json.dumps(self.sources))
            # The module reads its own templates, which include LinkedTimebomb/PlantBomb.
            report=mod.run(root,True)
            self.assertEqual(report['counts']['scripts_restored'],1)
            self.assertEqual((maps/'sample.rbxl').read_bytes(),original)
            self.assertTrue(Path(report['registryBackup']).exists())
            updated=json.loads((maps.parent/'places.json').read_text())
            self.assertEqual(updated['places']['2008m-crossroads'],registry['places']['2008m-crossroads'])
            self.assertTrue((maps/updated['places']['sample']['file']).exists())


if __name__=='__main__':unittest.main()
