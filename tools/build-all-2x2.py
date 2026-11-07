#!/usr/bin/env python3
"""One-command 2x2 dependency recovery and cached place preparation.

Never modifies browser launcher, Crossroads, or original map bytes.
"""
import argparse
import json
import subprocess
import sys
from pathlib import Path

HERE=Path(__file__).resolve().parent

def main():
    p=argparse.ArgumentParser()
    p.add_argument('--root',type=Path,default=Path(r'C:\RBXBanland'))
    p.add_argument('--origin',default='https://2x2.lentanyl.com')
    p.add_argument('--workers',type=int,default=4)
    p.add_argument('--activate',action='store_true',help='Activate prepared copies in the native registry')
    p.add_argument('--skip-download',action='store_true')
    p.add_argument('--skip-server-route',action='store_true')
    p.add_argument('--skip-conversion',action='store_true')
    args=p.parse_args()
    root=args.root.resolve(strict=True)
    if not args.origin.startswith('https://') or any(x in args.origin for x in ('?', '#', '{', '}')):
        p.error('--origin must be the public HTTPS origin')
    if not 1<=args.workers<=8:p.error('--workers 1..8')
    def invoke(command):
        print('\n[2x2] Running:', ' '.join(str(s) for s in command),flush=True)
        subprocess.run([sys.executable,str(HERE/command[0]),*map(str,command[1:])],check=True,cwd=root)
    if not args.skip_server_route:
        invoke(['install-asset-route.py','--root',root])
    if not args.skip_download:
        invoke(['bulk-compat.py','--root',root,'--assets-only','--workers',args.workers])
    if not args.skip_conversion:
        # The standalone converter writes copies first. It does not activate yet;
        # later script repair can read these copies after one deliberate activation.
        invoke(['bulk-compat.py','--root',root,'--places-only','--asset-template',args.origin.rstrip('/')+'/api/asset?id={id}', *(['--activate'] if args.activate else [])])
    invoke(['prepare-runtime-place.py','--root',root,*(['--activate'] if args.activate else [])])
    print('\n[2x2] Completed. Review server/native/asset-recovery reports.',flush=True)
    return 0

if __name__=='__main__':
    try:raise SystemExit(main())
    except subprocess.CalledProcessError as e:
        print(f'ERROR: failed stage (exit {e.returncode}); prior stages may have completed. Read reports before rerunning.',file=sys.stderr)
        raise SystemExit(e.returncode)
