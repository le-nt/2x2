import sys
import importlib.util
import tempfile
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
spec=importlib.util.spec_from_file_location('analyze_place',Path(__file__).resolve().parents[1]/'tools/analyze-place.py')
analyzer=importlib.util.module_from_spec(spec);spec.loader.exec_module(analyzer)
analyze_place=analyzer.analyze_place
from test_binary_inventory import fixture, prop, chunk

class PlaceAnalysisTests(unittest.TestCase):
    def analyze(self, data):
        with tempfile.TemporaryDirectory() as directory:
            file=Path(directory)/'map.rbxl';file.write_bytes(data)
            return analyze_place(file)

    def test_xml_decodes_properties_and_preserves_script_identity(self):
        result=self.analyze(b'''<roblox><Item class="Workspace"><Properties><string name="Name">Workspace</string></Properties>
        <Item class="Script"><Properties><string name="Name">WaveSpawner</string><bool name="Disabled">true</bool>
        <ProtectedString name="Source"><![CDATA[local mesh="rbxassetid://12345"]]></ProtectedString>
        <string name="CustomReference">rbxasset://sounds/Rocket whoosh 01.wav</string></Properties></Item></Item></roblox>''')
        self.assertEqual(result['assetIds'],['12345'])
        self.assertIn('rbxasset://sounds/Rocket whoosh 01.wav',result['resourceReferences'])
        script=result['scripts'][0]
        self.assertEqual(script['path'],'Workspace/WaveSpawner')
        self.assertTrue(script['disabled']);self.assertTrue(script['sourcePresent'])
        self.assertEqual(script['startStatus'],'not_tested')
        self.assertNotIn('local mesh',str(result))

    def test_binary_scans_unknown_string_properties_without_claiming_full_decode(self):
        end=chunk(b'END.',b'</roblox>')
        data=fixture()[:-len(end)]+prop(1,'ArbitraryString',['rbxassetid://54321'])+prop(1,'Other',['rbxasset://fonts/Teapot.mesh'])+end
        result=self.analyze(data)
        self.assertIn('54321',result['assetIds'])
        self.assertIn('rbxasset://fonts/Teapot.mesh',result['resourceReferences'])
        self.assertEqual(result['coverage'],'binary_string_properties_partial')

    def test_malformed_and_entity_xml_are_rejected(self):
        for data in [b'<roblox><Item>', b'<html/>', b'<!DOCTYPE roblox [<!ENTITY x "test">]><roblox>&x;</roblox>']:
            with self.assertRaises(ValueError):self.analyze(data)

    def test_invalid_binary_never_looks_analyzed(self):
        with self.assertRaises(ValueError):self.analyze(fixture()[:-15])

if __name__=='__main__':unittest.main()
