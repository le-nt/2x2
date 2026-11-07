#!/usr/bin/env python3
"""Install the gated /api/asset cache endpoint into 2x2's Node server.

Idempotent; refuses to patch unknown layouts. Makes a timestamped backup.
Does not touch native-test.js, the native browser client, or its worker.
"""
import argparse
import datetime
import json
import shutil
from pathlib import Path

IMPORT='import { createAssetResolver } from "./lib/asset-resolver.mjs";'
INSTANCE='const assetResolver = createAssetResolver({serverDir:here,siteDir:root});'
ROUTE='  if (urlPath === "/api/asset") return assetResolver.handle(req,res,url);\n'
WORKER='  if (urlPath === "/api/asset" && cfg.native?.accessKey && req.headers.accesskey === cfg.native.accessKey) return assetResolver.handle(req,res,url);\n'

def install(root):
    file=root/'server/server.mjs'
    code=file.read_text('utf-8')
    if 'assetResolver.handle(req' in code and 'createAssetResolver' in code:
        return {'status':'already_installed'}
    marker='  // ---- API ----'
    anchor='import { createNative } from "./lib/native.mjs";'
    native='const native = createNative('
    if code.count(anchor)!=1 or code.count(marker)!=1 or code.count(native)!=1 or code.count('  // ---- Gate ----')!=1:
        raise ValueError('server.mjs differs from known layout; no modifications made')
    if 'createAssetResolver' not in code:
        code=code.replace(anchor,anchor+'\n'+IMPORT,1)
    # Inject after the complete createNative line, not inside its argument object.
    lines=code.splitlines(keepends=True)
    n=[i for i,line in enumerate(lines) if line.startswith(native)]
    if len(n)!=1 or not lines[n[0]].rstrip().endswith(');'):
        raise ValueError('Native initialization is not one line; no modifications made')
    lines.insert(n[0]+1,INSTANCE+'\n')
    code=''.join(lines)
    code=code.replace('  // ---- Gate ----',WORKER+'  // ---- Gate ----',1)
    code=code.replace(marker,ROUTE+marker,1)
    backup=root/'server/backups'/('server-before-assets-'+datetime.datetime.now().strftime('%Y%m%d-%H%M%S-%f')+'.mjs')
    backup.parent.mkdir(parents=True,exist_ok=True)
    shutil.copy2(file,backup)
    file.write_text(code,'utf-8')
    return {'status':'installed','backup':str(backup)}

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--root',type=Path,required=True);a=p.parse_args()
    print(json.dumps(install(a.root.resolve(strict=True)),indent=2))
