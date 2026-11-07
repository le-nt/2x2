"""Focused regression coverage for opt-in native map preparation."""
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

FILE = Path(__file__).resolve().parents[1] / 'tools' / 'prepare-runtime-place.py'
spec = importlib.util.spec_from_file_location('native_runtime_prep', FILE)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

def place_with_empty_script(tool='LinkedSword', script='SwordScript'):
    return (f'<roblox version="4"><Item class="Workspace"><Properties>'
            f'<string name="Name">Workspace</string></Properties>'
            f'<Item class="Tool"><Properties><string name="Name">{tool}</string></Properties>'
            f'<Item class="Script"><Properties><string name="Name">{script}</string>'
            f'<ProtectedString name="Source"></ProtectedString>'
            f'</Properties></Item></Item></Item></roblox>').encode()

class RuntimePlacePrepTests(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.root = Path(tmp.name)
        self.maps = self.root / 'server/native/maps'
        self.maps.mkdir(parents=True)
        registry = {
            'format': 1,
            'places': {
                '2008m-crossroads': {'id': 1, 'file': 'crossroads.rbxl'},
                'test-tools': {'id': 2, 'file': 'test-tools.rbxl'},
                'other-place': {'id': 3, 'file': 'other-place.rbxl'},
            }
        }
        self.registry_file = self.root / 'server/native/places.json'
        self.registry_file.write_text(json.dumps(registry))
        self.source = place_with_empty_script()
        (self.maps / 'test-tools.rbxl').write_bytes(self.source)
        (self.maps / 'other-place.rbxl').write_bytes(self.source)
        (self.maps / 'crossroads.rbxl').write_bytes(self.source)
        self.templates = json.loads((FILE.parent / 'crossroads-tool-sources.json').read_text())

    def test_selective_build_creates_copy_without_mutating_source_or_registry(self):
        tool, scripts = next((k, v) for k, v in self.templates.items() if v)
        script = next(iter(scripts))
        self.source = place_with_empty_script(tool, script)
        (self.maps / 'test-tools.rbxl').write_bytes(self.source)
        original_registry = self.registry_file.read_bytes()
        result = module.run(self.root, only='test-tools')
        self.assertEqual(result['counts']['repaired_places'], 1)
        self.assertEqual(result['counts']['restored_crossroads_template'], 1)
        out = self.maps / '2x2-runtime-ready/test-tools.rbxl'
        self.assertIn(scripts[script].encode(), out.read_bytes())
        self.assertEqual((self.maps / 'test-tools.rbxl').read_bytes(), self.source)
        self.assertEqual(self.registry_file.read_bytes(), original_registry)
        self.assertFalse((self.maps / '2x2-runtime-ready/other-place.rbxl').exists())
        self.assertFalse((self.maps / '2x2-runtime-ready/2008m-crossroads.rbxl').exists())

    def test_unknown_place_is_rejected(self):
        with self.assertRaises(ValueError):
            module.run(self.root, only='nonexistent')

    def test_crossroads_is_protected(self):
        result = module.run(self.root, only='2008m-crossroads')
        self.assertEqual(result['counts']['protected_crossroads'], 1)
        self.assertFalse((self.maps / '2x2-runtime-ready/2008m-crossroads.rbxl').exists())

if __name__ == '__main__':
    unittest.main()
