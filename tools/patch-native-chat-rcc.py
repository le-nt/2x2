#!/usr/bin/env python3
"""Apply only the two chat URL fixes to a separate engine checkout; never build WASM."""
import argparse
import datetime
import re
import shutil
from pathlib import Path


def patch(engine):
    reference=Path(__file__).resolve().parents[1]/'services/engine/ClientShared/RobloxServicesTools.cpp'
    target=Path(engine).expanduser().resolve(strict=True)/'ClientShared/RobloxServicesTools.cpp'
    source=reference.read_text(encoding='utf-8')
    original=target.read_text(encoding='utf-8');updated=original
    fallbacks={
        'GetPlayerGameDataUrl':'return BuildGenericApiUrl(baseurl, "", format_string("api/game/players/%d", userId), key);',
        'GetWebChatFilterURL':'return BuildGenericApiUrl(baseUrl, "", "api/moderation/filtertext", key);',
    }
    for name,fallback in fallbacks.items():
        pattern=re.compile(r'(^std::string '+name+r'\([^\n]*\)\s*\n\{\n)(.*?)(^\})',re.M|re.S)
        wanted=pattern.search(source);found=pattern.search(updated)
        if not wanted or not found:
            raise ValueError('Expected function not found: '+name)
        if found.group(2)==wanted.group(2):continue
        if found.group(2).strip()!=fallback:
            raise ValueError('Existing custom changes in '+name+'; compare manually. No files changed.')
        updated=updated[:found.start(2)]+wanted.group(2)+updated[found.end(2):]
    if '#include <cstdlib>' not in updated:
        anchor='#include <sstream>'
        if updated.count(anchor)!=1:raise ValueError('Expected include anchor missing. No files changed.')
        updated=updated.replace(anchor,anchor+'\n#include <cstdlib>')
    if updated==original:
        print('Chat URL patch is already installed.');return
    stamp=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d-%H%M%S-%f')
    backup=target.with_name(target.name+'.before-native-chat-'+stamp)
    shutil.copy2(target,backup)
    temporary=target.with_name(target.name+'.native-chat-tmp')
    try:
        temporary.write_text(updated,encoding='utf-8')
        temporary.replace(target)
    finally:
        temporary.unlink(missing_ok=True)
    print('Patched:',target)
    print('Backup:',backup)


if __name__=='__main__':
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--engine',type=Path,required=True,help='Existing engine checkout, e.g. ~/2x2-build/engine')
    args=ap.parse_args()
    patch(args.engine)
