#!/usr/bin/env python3
"""Copy only reviewed source/assets from Git, backing up replaced local files.

Does not switch branches, change the index, delete files or rebuild a client.
"""
import argparse
import datetime
import shutil
import subprocess
from pathlib import Path, PurePosixPath

BASE='745be7dce316754d0d84a40f2b9c3a7292d12da3'
PREFIXES=('site/js/','site/css/','site/img/ads/','server/lib/','tests/','tools/','docs/')
EXACT={'server/server.mjs','services/engine/ClientShared/RobloxServicesTools.cpp',
       'server/native/asset-library/34854607.png'}


def allowed(name):
    path=PurePosixPath(name)
    return (not path.is_absolute() and '..' not in path.parts and '\\' not in name
            and path.suffix.lower() not in {'.wasm','.data'}
            and (name in EXACT or name.startswith(PREFIXES)))


def apply(root,ref):
    root=Path(root).resolve(strict=True)
    def git(*args):
        return subprocess.run(['git','-C',str(root),*args],check=True,stdout=subprocess.PIPE).stdout
    checkout=Path(git('rev-parse','--show-toplevel').decode('utf-8').strip()).resolve()
    if checkout!=root:raise ValueError('--root must be the Git checkout root.')
    commit=git('rev-parse','--verify',ref+'^{commit}').decode('ascii').strip()
    names=git('diff','--name-only','-z','--diff-filter=AM',BASE,commit).decode('utf-8').split('\0')
    selected=[name for name in names if name and allowed(name)]
    if not selected:raise ValueError('No reviewed update files found.')
    # Read and validate every source/destination before replacing anything.
    pending=[]
    for name in selected:
        target=root.joinpath(*PurePosixPath(name).parts)
        if target.is_symlink() or not target.resolve().is_relative_to(root):
            raise ValueError('Refusing unsafe destination: '+name)
        if target.exists() and not target.is_file():raise ValueError('Not a file: '+name)
        mode=git('ls-tree',commit,'--',name).decode('utf-8').split(' ',1)[0]
        if mode not in {'100644','100755'}:raise ValueError('Not a regular source file: '+name)
        data=git('show',commit+':'+name)
        if not target.exists() or target.read_bytes()!=data:pending.append((name,target,data))
    if not pending:
        print('This update is already installed.');return
    stamp=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d-%H%M%S-%f')
    backup=root/('backup-reviewed-update-'+stamp)
    for name,target,data in pending:
        if target.exists():
            old=backup.joinpath(*PurePosixPath(name).parts)
            old.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(target,old)
        target.parent.mkdir(parents=True,exist_ok=True)
        target.write_bytes(data)
    print('Installed',len(pending),'updated files from',commit[:12])
    print('Previous versions:',backup)
    print('WASM, client bundles, maps, config, database and all other files were left alone.')
    print('Restart the Node website server. Native chat still needs the separate RCC-only update.')


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root',type=Path,required=True)
    parser.add_argument('--ref',required=True)
    args=parser.parse_args()
    apply(args.root,args.ref)
