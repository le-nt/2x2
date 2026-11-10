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
        end=chunk(b'END\0',b'</roblox>')
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

    def test_comment_only_export_is_not_reported_as_gameplay_code(self):
        for source in ['-- Decompiling is disabled', '-- Server scripts can NOT be decompiled\n', '\ufeff --[=[placeholder\ncontent]=] \n-- next comment']:
            xml=('<roblox><Item class="Script"><Properties><ProtectedString name="Source"><![CDATA['+source+']]></ProtectedString></Properties></Item></roblox>').encode()
            result=self.analyze(xml)
            self.assertEqual(result['scripts'][0]['sourceStatus'],'comments_only')
            self.assertEqual(result['scriptSourceCoverage']['status'],'no_code_in_archive')
            self.assertTrue(result['valid'],'A preserved scene is still a valid import')
            end=chunk(b'END\0',b'</roblox>')
            binary=self.analyze(fixture()[:-len(end)]+prop(2,'Source',[source])+end)
            self.assertEqual(binary['scriptSourceCoverage']['commentOnly'],1)
            self.assertEqual(binary['scriptSourceCoverage']['withCode'],0)

    def test_comment_classification_does_not_strip_strings_or_code_after_comments(self):
        for source in ['print("-- placeholder")','--[==[comment]==]\nerror("scanner must never run me")','return "-- Decompiling is disabled"']:
            result=analyzer.classify_script_source(source)
            self.assertEqual(result,'code_present_unverified')
        self.assertEqual(analyzer.classify_script_source('--[[unclosed'),'unknown_unclosed_comment')
        self.assertEqual(analyzer.classify_script_source(' \n\t'),'empty')

    def test_external_sources_are_not_mistaken_for_a_comment_only_complete_archive(self):
        result=self.analyze(b'<roblox><Item class="Script"><Properties><string name="LinkedSource">rbxassetid://12345</string></Properties></Item></roblox>')
        self.assertEqual(result['scriptSourceCoverage']['status'],'external_sources_required')
        self.assertEqual(result['scriptSourceCoverage']['linkedSourceReferences'],1)

    def test_version_pins_survive_xml_entities_and_binary_string_properties(self):
        urls='https://www.roblox.com/asset?id=12345&amp;version=2 https://assetdelivery.roblox.com/v1/assetId/12345/version/3'
        xml=('<roblox><Item class="Decal"><Properties><string name="Name">'+urls+'</string></Properties></Item></roblox>').encode()
        result=self.analyze(xml)
        self.assertEqual(result['versionedReferences'],[{'id':'12345','version':2},{'id':'12345','version':3}])
        end=chunk(b'END\0',b'</roblox>')
        binary=self.analyze(fixture()[:-len(end)]+prop(2,'Source',[urls])+end)
        self.assertEqual(binary['versionedReferences'],result['versionedReferences'])

if __name__=='__main__':unittest.main()
