import hashlib
import importlib.util
import json
import tempfile
from io import BytesIO
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / 'tools' / 'import-novetus-assets.py'
spec = importlib.util.spec_from_file_location('novetus_import', SCRIPT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class NovetusImportTests(unittest.TestCase):
    def test_http_accept_headers_for_tree_and_raw(self):
        seen = []
        class Response(BytesIO):
            status = 200
            headers = {}
        def opener(request, timeout):
            seen.append(request)
            return Response(b'{}')
        self.assertEqual(module.read_url(module.TREE_URL, 1024, opener), b'{}')
        self.assertEqual(module.read_url(module.RAW_BASE + 'assets/1014476', 1024, opener), b'{}')
        self.assertEqual(seen[0].get_header('Accept'), 'application/vnd.github+json')
        self.assertEqual(seen[0].get_header('X-github-api-version'), '2022-11-28')
        self.assertEqual(seen[1].get_header('Accept'), 'application/octet-stream')

    def test_tree_filters_unsafe_and_sizes(self):
        ok = b'\x89PNG\r\n\x1a\n' + b'fake'
        blob = module.github_blob_sha(ok)
        tree = {'truncated': False, 'tree': [
            {'path': 'assets/1014476', 'type': 'blob', 'sha': blob, 'size': len(ok)},
            {'path': 'assets/../1014476', 'type': 'blob', 'sha': blob, 'size': len(ok)},
            {'path': 'assets/1014476.exe', 'type': 'blob', 'sha': blob, 'size': len(ok)},
            {'path': 'assets/1014476', 'type': 'tree', 'sha': blob, 'size': len(ok)},
        ]}
        index = module.normalize_tree(tree)
        self.assertEqual(len(index['1014476']), 1)

    def test_truncated_tree_rejected(self):
        with self.assertRaises(ValueError):
            module.normalize_tree({'truncated': True, 'tree': []})

    def test_detect_real_formats_not_filename(self):
        self.assertEqual(module.classify(b'\x89PNG\r\n\x1a\nabcdef', 'assets/1014476'), '.png')
        self.assertEqual(module.classify(b'version 1.00\n0\n', 'assets/1014476'), '.mesh')
        self.assertEqual(module.classify(b'<!doctype html><html>Error</html>', 'assets/1014476'), None)
        self.assertEqual(module.classify(b'\x7fELFbad', 'assets/1014476'), None)
        self.assertIsNone(module.classify(b'local x = require(4)', 'scripts/1014476.lua'))

    def test_download_stages_and_sha_checks(self):
        data = b'\x89PNG\r\n\x1a\nFAKE_FILE'
        sha = module.github_blob_sha(data)
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            row = {'id': '1014476', 'placesNeeding': 42, 'sources': [{'path': 'assets/1014476', 'sha': sha, 'bytes': len(data)}]}
            report, path = module.download_batch(root, [row], fetch=lambda u, n: data, delay=0)
            self.assertEqual(report['counts']['staged'], 1)
            self.assertEqual((root/'server/native/asset-recovery/novetus-staging/1014476.png').read_bytes(), data)
            self.assertTrue(path.exists())
            report2, _ = module.download_batch(root, [row], fetch=lambda u, n: (_ for _ in ()).throw(AssertionError('redownload')), delay=0)
            self.assertEqual(report2['counts']['alreadyStaged'], 1)

    def test_bad_sha_never_stages(self):
        data = b'\x89PNG\r\n\x1a\nFAKE_FILE'
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            row = {'id': '1014476', 'placesNeeding': 1, 'sources': [{'path': 'assets/1014476', 'sha': '0'*40, 'bytes': len(data)}]}
            report, _ = module.download_batch(root, [row], fetch=lambda u, n: data, delay=0)
            self.assertEqual(report['counts']['errors'], 1)
            self.assertFalse((root/'server/native/asset-recovery/novetus-staging/1014476.png').exists())

    def test_missing_priority_and_dedup(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp)/'server/native/asset-recovery/missing-assets.json'
            path.parent.mkdir(parents=True)
            path.write_text(json.dumps({'assets': [{'id':'5','placesNeeding':1},{'id':'3','placesNeeding':10},{'id':'3','placesNeeding':10}]}))
            self.assertEqual(module.load_missing(Path(temp)), [('3',10), ('5',1)])

if __name__ == '__main__':
    unittest.main()
