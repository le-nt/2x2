import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / 'tools/stage-browser-validation.py'

@unittest.skipUnless(os.name == 'posix', 'Browser staging runs in Linux/WSL')
class BrowserValidationIsolation(unittest.TestCase):
    def test_writable_seed_is_independent_and_existing_stage_is_preserved(self):
        with tempfile.TemporaryDirectory(prefix='2x2-stage-test-') as temporary:
            base=Path(temporary)
            repo=base/'repo';archives=base/'archives';bundle=base/'bundle';stage=repo/'work/stack'
            for folder in [repo/'server/lib',repo/'tools',repo/'site/data',archives/'server/native/maps',archives/'server/native/asset-seed',bundle]:
                folder.mkdir(parents=True)
            (repo/'tools/crossroads-tool-sources.json').write_text('{}')
            (repo/'site/data/maps.json').write_text('{"maps":[]}')
            places={}
            for native_id in [1,6,205,277]:
                name=str(native_id)+'.rbxl';(archives/'server/native/maps'/name).write_bytes(b'<roblox version="4"/>')
                places[str(native_id)]={'id':native_id,'file':name,'name':'Fixture'}
            (archives/'server/native/places.json').write_text(json.dumps({'places':places}))
            original=archives/'server/native/asset-seed/12345'
            original.write_bytes(b'original archive bytes')
            (archives/'server/data').mkdir();database=archives/'server/data/2x2.db';database.write_bytes(b'original database sentinel')
            for name in ['UniversalClient.js','UniversalClient.data']:(bundle/name).write_bytes(b'fixture bundle')
            (bundle/'UniversalClient.wasm').write_bytes(b'\0asm\x01\0\0\0')
            command=[sys.executable,str(SCRIPT),'--root',str(repo),'--archives',str(archives),'--client-build',str(bundle),'--output',str(stage)]
            invalid=subprocess.run(command+['--soap-port-start','18190'],text=True,capture_output=True,timeout=20)
            self.assertNotEqual(invalid.returncode,0)
            self.assertFalse(stage.exists())
            run=subprocess.run(command,text=True,capture_output=True,timeout=20)
            self.assertEqual(run.returncode,0,run.stderr)
            seed=stage/'server/native/asset-seed'
            self.assertFalse(seed.is_symlink())
            self.assertEqual((seed/'12345').read_bytes(),original.read_bytes())
            (seed/'12345').write_bytes(b'changed only in test stack')
            (seed/'67890').write_bytes(b'new isolated download')
            self.assertEqual(original.read_bytes(),b'original archive bytes')
            self.assertFalse((original.parent/'67890').exists())
            self.assertEqual(database.read_bytes(),b'original database sentinel')
            config=json.loads((stage/'server/config.json').read_text())
            self.assertNotIn(config['native']['accessKey'],run.stdout)
            self.assertNotIn(config['native']['signingKey'],run.stdout)
            repeat=subprocess.run(command,text=True,capture_output=True,timeout=20)
            self.assertNotEqual(repeat.returncode,0)
            self.assertEqual((seed/'12345').read_bytes(),b'changed only in test stack')

if __name__=='__main__':unittest.main()
