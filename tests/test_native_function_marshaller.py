"""Exercise the actual Emscripten marshaller branch with native C++ threads."""
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]

@unittest.skipUnless(os.name == 'posix' and shutil.which('c++'), 'Requires a POSIX C++ compiler')
class NativeFunctionMarshaller(unittest.TestCase):
    def test_concurrent_producers_and_nested_jobs(self):
        with tempfile.TemporaryDirectory(prefix='2x2-marshaller-') as temporary:
            output = Path(temporary) / 'marshaller'
            source = ROOT / 'services/engine/UniversalClient'
            subprocess.run(['c++', '-std=c++17', '-O2', '-pthread', '-DEMSCRIPTEN',
                            '-I' + str(source), str(ROOT / 'tests/native-function-marshaller.cpp'),
                            str(source / 'FunctionMarshaller.cpp'), '-o', str(output)],
                           check=True, capture_output=True, timeout=30)
            subprocess.run([str(output)], check=True, capture_output=True, timeout=15)

if __name__ == '__main__':
    unittest.main()
