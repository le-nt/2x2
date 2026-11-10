import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]

@unittest.skipUnless(os.name == 'posix' and shutil.which('c++'), 'Requires a POSIX C++ compiler')
class NativeFormat(unittest.TestCase):
    def test_long_urls_and_reusable_argument_lists(self):
        with tempfile.TemporaryDirectory(prefix='2x2-format-') as temporary:
            output = Path(temporary) / 'format'
            engine = ROOT / 'services/engine'
            run = subprocess.run(['c++', '-std=c++17', '-O2', '-I' + str(engine/'Base/include'),
                                  '-I' + str(engine/'Log/include'), str(ROOT/'tests/native-format.cpp'),
                                  str(engine/'Base/RbxFormat.cpp'), '-o', str(output)],
                                 capture_output=True, text=True, timeout=30)
            self.assertEqual(run.returncode, 0, run.stderr)
            subprocess.run([str(output)], check=True, capture_output=True, timeout=15)

if __name__ == '__main__':
    unittest.main()
