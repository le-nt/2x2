#!/usr/bin/env python3
"""Recover matching Novetus assets into a staging cache (never alter the game runtime).

Uses the public Novetus assetdelivery repository and verifies every fetched file
against the blob SHA-1 supplied by GitHub's repository tree API.
"""
import argparse
import hashlib
import json
import os
import re
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter
from pathlib import Path

REPOSITORY = 'Novetus/novetus-assetdelivery'
REVISION = 'main'
TREE_URL = f'https://api.github.com/repos/{REPOSITORY}/git/trees/{REVISION}?recursive=1'
RAW_BASE = f'https://raw.githubusercontent.com/{REPOSITORY}/{REVISION}/'
ID_RE = re.compile(r'[1-9][0-9]{0,15}\Z')
ALLOWED_CATEGORIES = ('assets', 'fonts', 'textures', 'sounds', 'music', 'models', 'animations', 'scripts', 'sky')
UPSTREAM_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.dds', '.wav', '.mp3', '.ogg', '.mesh', '.rbxm', '.rbxmx', '.lua', '.txt'}
MAX_BYTES = 64 * 1024 * 1024
MAX_TREE_BYTES = 5 * 1024 * 1024
UA = '2x2-NOVETUS-ASSET-RECOVERY/1.0 (read-only upstream; local staging)'


def validate_id(value):
    return isinstance(value, str) and ID_RE.fullmatch(value) is not None


def safe_source_path(path, ident):
    if not isinstance(path, str) or path.startswith('/') or '\\' in path:
        return False
    pieces = path.split('/')
    if len(pieces) != 2 or pieces[0] not in ALLOWED_CATEGORIES or any(p in ('', '.', '..') for p in pieces):
        return False
    file = pieces[1]
    return file == ident or (file.split('.')[0] == ident and Path(file).suffix.lower() in UPSTREAM_EXTENSIONS)


def read_url(url, limit, opener=urllib.request.urlopen):
    # GitHub's tree API serves JSON; octet-stream negotiation can produce HTTP 415.
    is_api = urllib.parse.urlsplit(url).hostname == 'api.github.com'
    headers = {'User-Agent': UA, 'Accept': 'application/vnd.github+json' if is_api else 'application/octet-stream'}
    if is_api:
        headers['X-GitHub-Api-Version'] = '2022-11-28'
    request = urllib.request.Request(url, headers=headers)
    try:
        reply_context = opener(request, timeout=35)
    except urllib.error.HTTPError as error:
        if error.code == 415 and is_api:
            raise ValueError('GitHub tree API rejected the request (HTTP 415); check API access or a proxy that alters headers') from error
        raise
    with reply_context as reply:
        status = getattr(reply, 'status', 200)
        if status != 200:
            raise ValueError(f'HTTP {status} for {url}')
        size = reply.headers.get('Content-Length') if hasattr(reply, 'headers') else None
        if size is not None and int(size) > limit:
            raise ValueError('Response exceeds size limit')
        content = reply.read(limit + 1)
        if not content or len(content) > limit:
            raise ValueError('Empty or oversized response')
        return content


def github_blob_sha(payload):
    return hashlib.sha1(b'blob ' + str(len(payload)).encode('ascii') + b'\x00' + payload).hexdigest()


def classify(payload, upstream_path):
    """Return a supported cache extension, or None if unknown/unsafe.

    Type is determined from payload magic, NOT the supplied filename. A few
    common text formats are deliberately excluded to avoid storing error pages.
    """
    if payload.startswith(b'\x89PNG\r\n\x1a\n'):
        return '.png'
    if payload[:3] == b'\xff\xd8\xff':
        return '.jpg'
    if payload.startswith(b'DDS '):
        return '.dds'
    if payload.startswith(b'RIFF') and payload[8:12] == b'WAVE':
        return '.wav'
    if payload.startswith(b'OggS'):
        return '.ogg'
    if payload.startswith(b'ID3') or (len(payload) > 2 and payload[0] == 0xff and (payload[1] & 0xe0) == 0xe0):
        return '.mp3'
    if payload.startswith(b'<roblox!'):
        return '.rbxm'
    head = payload[:512].lstrip(b'\xef\xbb\xbf\x00\x20\t\r\n')
    if re.match(rb'version\s+\d+\.\d+\b', head):
        return '.mesh'
    if (head.startswith(b'<?xml') or head.startswith(b'<roblox')) and b'<roblox' in payload[:4096]:
        return '.rbxmx'
    # No auto-accept for HTML, JSON, arbitrary binary, executable, or text.
    # Lua is not automatically considered a runtime-ready asset: it would need
    # a separate script compatibility pass and context-aware installation.
    return None


def normalize_tree(tree):
    if not isinstance(tree, dict) or tree.get('truncated') is not False or not isinstance(tree.get('tree'), list):
        raise ValueError('GitHub tree response missing, invalid, or truncated')
    by_id = {}
    for row in tree['tree']:
        if not isinstance(row, dict) or row.get('type') != 'blob':
            continue
        path, sha, size = row.get('path'), row.get('sha'), row.get('size')
        if not isinstance(path, str) or not isinstance(sha, str) or not re.fullmatch(r'[0-9a-f]{40}', sha):
            continue
        name = path.split('/')[-1].split('.')[0]
        if not validate_id(name) or not safe_source_path(path, name):
            continue
        if not isinstance(size, int) or size < 1 or size > MAX_BYTES:
            continue
        by_id.setdefault(name, []).append({'path': path, 'sha': sha, 'bytes': size})
    priority = {'assets': 0, 'textures': 1, 'fonts': 2, 'sounds': 3, 'models': 4, 'sky': 5, 'animations': 6, 'scripts': 7, 'music': 8}
    for entries in by_id.values():
        entries.sort(key=lambda x: (priority[x['path'].split('/')[0]], x['path']))
    return by_id


def load_missing(root):
    p = root / 'server/native/asset-recovery/missing-assets.json'
    doc = json.loads(p.read_text(encoding='utf-8'))
    rows = doc.get('assets')
    if not isinstance(rows, list):
        raise ValueError('missing-assets.json has no assets array')
    selected = []
    seen = set()
    for row in rows:
        ident = row.get('id') if isinstance(row, dict) else None
        if not validate_id(ident):
            raise ValueError('Unsafe asset ID in missing-assets report')
        if ident not in seen:
            seen.add(ident)
            selected.append((ident, int(row.get('placesNeeding') or 0)))
    selected.sort(key=lambda x: (-x[1], int(x[0])))
    return selected


def load_tree(root, refresh=False, fetch=read_url):
    location = root / 'server/native/asset-recovery/novetus-github-tree.json'
    if location.is_file() and not refresh:
        cached = json.loads(location.read_text(encoding='utf-8'))
        return normalize_tree(cached), location
    payload = fetch(TREE_URL, MAX_TREE_BYTES)
    tree = json.loads(payload.decode('utf-8'))
    by_id = normalize_tree(tree)
    location.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile('w', dir=location.parent, encoding='utf-8', suffix='.tmp', delete=False) as tmp:
        json.dump(tree, tmp, separators=(',', ':'))
        temporary = Path(tmp.name)
    os.replace(temporary, location)
    return by_id, location


def resolve_plan(missing, index, limit):
    matches = [{'id': ident, 'placesNeeding': places, 'sources': index[ident]}
               for ident, places in missing if ident in index]
    unmatched = [ident for ident, _ in missing if ident not in index]
    return matches[:limit] if limit else matches, unmatched, len(matches)


def download_batch(root, matches, fetch=read_url, sleep=time.sleep, delay=0.15):
    staging = root / 'server/native/asset-recovery/novetus-staging'
    staging.mkdir(parents=True, exist_ok=True)
    stats = Counter()
    detail = []
    for row in matches:
        ident = row['id']
        # A locally recovered file is never overwritten by untrusted upstream content.
        if any(staging.glob(ident + '.*')):
            stats['alreadyStaged'] += 1
            continue
        result = {'id': ident, 'placesNeeding': row['placesNeeding'], 'outcome': 'not_downloaded'}
        for source in row['sources']:
            path = source['path']
            if not safe_source_path(path, ident):
                continue
            url = RAW_BASE + urllib.parse.quote(path, safe='/')
            try:
                payload = fetch(url, MAX_BYTES)
                if len(payload) != source['bytes'] or github_blob_sha(payload) != source['sha']:
                    raise ValueError('Git blob SHA/size verification failed')
                if payload.startswith(b'version https://git-lfs.github.com/spec/v1'):
                    raise ValueError('Git LFS pointer is not an asset')
                ext = classify(payload, path)
                if ext is None:
                    result['outcome'] = 'unsupported_format'
                    result['source'] = path
                    stats['unsupportedFiles'] += 1
                    # Do not stage unknown bytes or publish them to the runtime.
                    continue
                dest = staging / (ident + ext)
                try:
                    with dest.open('xb') as f:
                        f.write(payload)
                except FileExistsError:
                    stats['alreadyStaged'] += 1
                    result['outcome'] = 'already_staged'
                    break
                result.update({'outcome': 'staged', 'source': path, 'file': dest.name,
                               'bytes': len(payload), 'sha256': hashlib.sha256(payload).hexdigest()})
                stats['staged'] += 1
                break
            except (OSError, urllib.error.URLError, ValueError) as error:
                result.update({'outcome': 'download_or_verify_error', 'source': path, 'error': str(error)[:240]})
                stats['errors'] += 1
            finally:
                if delay > 0:
                    sleep(delay)
        detail.append(result)
    report = {'schemaVersion': 1, 'repository': REPOSITORY, 'revision': REVISION,
              'note': 'Staging only; unknown formats skipped. No game startup or place files modified.',
              'counts': dict(stats), 'results': detail}
    out = staging.parent / 'novetus-download-report.json'
    with tempfile.NamedTemporaryFile('w', encoding='utf-8', dir=out.parent, suffix='.tmp', delete=False) as temp:
        json.dump(report, temp, indent=2)
        tmp = Path(temp.name)
    os.replace(tmp, out)
    return report, out


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--plan', action='store_true', help='Compare missing IDs with Novetus GitHub tree (default)')
    parser.add_argument('--fetch', action='store_true', help='Download a LIMITED batch into staging, never into live game cache')
    parser.add_argument('--limit', type=int, default=25, help='Maximum matching IDs to fetch, default 25; 0 for plan only, not fetch')
    parser.add_argument('--refresh-index', action='store_true', help='Refresh the cached GitHub repository tree')
    parser.add_argument('--id', action='append', default=[], help='Only use this numeric asset ID; repeatable')
    args = parser.parse_args(argv)
    try:
        if args.limit < 0 or args.limit > 250:
            raise ValueError('Limit must be between 0 and 250')
        if args.fetch and args.limit == 0:
            raise ValueError('--fetch needs --limit 1..250')
        if args.id and any(not validate_id(i) for i in args.id):
            raise ValueError('Invalid --id value')
        root = args.root.resolve(strict=True)
        missing = load_missing(root)
        if args.id:
            wanted = set(args.id)
            missing = [r for r in missing if r[0] in wanted]
            for ident in args.id:
                if ident not in {x[0] for x in missing}:
                    missing.append((ident, 0))
        index, index_path = load_tree(root, args.refresh_index)
        matches, unmatched, all_matches = resolve_plan(missing, index, args.limit if args.fetch else 0)
        summary = {'mode': 'fetch' if args.fetch else 'plan', 'missingIdsConsidered': len(missing),
                   'matchesInNovetus': all_matches, 'notInNovetus': len(unmatched),
                   'selectedForFetch': len(matches) if args.fetch else 0,
                   'topMatches': [{'id': x['id'], 'placesNeeding': x['placesNeeding'],
                                   'candidateFiles': len(x['sources'])} for x in matches[:15]],
                   'index': str(index_path)}
        print(json.dumps(summary, indent=2))
        if args.fetch:
            report, where = download_batch(root, matches)
            print(json.dumps({'downloadReport': str(where), 'staging': str(where.parent/'novetus-staging'),
                              'counts': report['counts']}, indent=2))
        return 0
    except (OSError, ValueError, json.JSONDecodeError, urllib.error.URLError) as error:
        print('ERROR:', error, file=sys.stderr)
        return 1

if __name__ == '__main__':
    raise SystemExit(main())
