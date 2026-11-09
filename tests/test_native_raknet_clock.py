import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]

@unittest.skipUnless(os.name == 'posix' and shutil.which('c++'), 'Requires a POSIX C++ compiler')
class NativeRaknetClock(unittest.TestCase):
    def test_wall_clock_changes_do_not_change_network_deadlines(self):
        import resource
        def no_core():
            resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
        with tempfile.TemporaryDirectory(prefix='2x2-raknet-clock-') as temporary:
            output = Path(temporary) / 'clock'
            source = ROOT / 'services/engine/Network/raknet/Source'
            subprocess.run(['c++', '-std=c++17', '-O2', '-pthread', '-I' + str(source),
                            str(ROOT / 'tests/native-raknet-clock.cpp'), str(source / 'GetTime.cpp'),
                            '-o', str(output)], check=True, capture_output=True, timeout=30)
            subprocess.run([str(output)], check=True, capture_output=True, timeout=15, preexec_fn=no_core)

if __name__ == '__main__':
    unittest.main()
