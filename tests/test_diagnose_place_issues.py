import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1]/'tools/diagnose-place-issues.py'
spec=importlib.util.spec_from_file_location('diagnose_place_issues',SCRIPT)
m=importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

class DiagnosisTests(unittest.TestCase):
    def test_issue_report_and_no_lua_source(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d)
            (root/'server/native/place-manifests').mkdir(parents=True)
            (root/'site/data').mkdir(parents=True)
            (root/'server/native/places.json').write_text(json.dumps({'places':{
                'broken':{'id':1,'file':'broken.rbxl','source':{'format':'xml'}},
                'fine':{'id':2,'file':'fine.rbxl'},
            }}))
            (root/'site/data/maps.json').write_text(json.dumps({'maps':[
                {'id':'broken','name':'Broken'}, {'id':'fine','name':'Fine'}]}))
            (root/'site/data/place-capabilities.json').write_text(json.dumps({'places':[
                {'id':'broken','status':'xml_parse_error'}, {'id':'fine','status':'inventoried'}]}))
            (root/'server/native/place-manifests/broken.json').write_text(json.dumps({
                'parseMessage':'not well-formed','parseLine':5,'parseColumn':8,
                'scripts':[{'source':'private Lua'}]}))
            out=root/'issues.json'
            report=m.run(root,out)
            self.assertEqual(report['totalReported'],1)
            self.assertEqual(report['places'][0]['parseLine'],5)
            self.assertNotIn('private Lua',out.read_text())
            self.assertEqual(m.run(root,all_places=True)['totalReported'],2)

if __name__=='__main__': unittest.main()
