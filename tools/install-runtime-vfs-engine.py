#!/usr/bin/env python3
"""Install only audited native files after matching exact baseline hashes.

Dry run by default. Existing native build outputs are copied into the backup
before source changes. Never touches deployed site/native-client or databases.
"""
import argparse
import hashlib
import json
import shutil
from pathlib import Path

FILES = {
    'Network/Player.cpp':'274b3c72b9401e8177e76f7087c1f0e8e3153a92a6a65b12eede1b6afc8090bc',
    'Network/raknet/Source/GetTime.cpp':'2f490ed83467088b1bef15c4fe67bd790256103e6ff2471e178c4b8f6f07f59c',
    'UniversalClient/FunctionMarshaller.cpp':'e8c3bff74719b8c51b9deab4d7a65045677cbd45bbfbfca681b62a4a950200ef',
    'UniversalClient/FunctionMarshaller.h':'f8284f3bd2c2c9c095b8e5c722754baba3749588b3888faa026ff288193716dd',
    'App/v8datamodel/Value.cpp':'7eee041b19b90d7b173e4a268510b1d57926353639990237f1a8968eb95f2456',
    'App/include/v8datamodel/Value.h':'d23b0a89c0c040944dff66e96dfab879cea200a31387d5ae8567400a1f17f359',
    'App/util/Sound.cpp':'111e9abb97ee869a33fd308eda23ba2b9e8cc965e620fdb117ff6bf804af306b',
    'App/include/util/Sound.h':'2cadd6d2e5a6146b00505437938c4da1b4627d328246f9649641a8b9d5add9d3',
    'UniversalClient/UserInput.h':'1a242619aebbf8fb3c7e36ba89e64d5becdfc862061a3999c3681237f198b8d9',
    'UniversalClient/UserInput.cpp':('4ddb66c6b7c64da6375fd8c51ff5807369759326830e876c5ad8108303940361',
                                    'de970e2e72d6298a4083c09ad38460dc117bab244da486b3802db415177b3dee'),
    'App/script/LuaSignalBridge.cpp':'ad6aa003fe2466ac356ef182e8ab28e4fe1fd1d5c2af5351b94b90691a4c86de',
    'ClientShared/RobloxServicesTools.cpp':('8caf73deaa3f54375266d74dde19dd3f3acd5a4abfb768a7cdc4930fb51081fd',
                                          'f9d3ad5e7831d90ec37e4ec3bd31c8bebc7a8423f31ec84b03ae920497cc513e'),
    'App/util/ContentProvider.cpp':'3ec71e07c44b320f144b37269458fc440e181e2f9b585fc1376ca4c80d9e6feb',
    'App/script/ScriptContext.cpp':('5a63eab0c3d5865ac0e2112e0728e3d671c1fb3f51980a8dc7071bc808204a56',
                                  '6b1045039b736bd276df1a1b62605529392ff8e2cb8e97ce5e45d2b78bb26215'),
    'RCCService/RCCService.cpp':('3a3590fc6cbb1d0075ed00a2ac5547c72d7458d0af9f80f3a7af059d38bd933a',
                                '103f29836a26e27dc257c64d1f0b56b47347bf6b6ddad7903c3ce6979719c4cf',
                                'dab10750c893180d3cfa061bc05c7fd10bdb558949becc9d93ae758f518de43a',
                                '8561625840f36d7ad95a8a8ba1d6c5e21bfb71ba6e6f3740f32dd182eef49bf4'),
}

def sha(file):return hashlib.sha256(file.read_bytes()).hexdigest()

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--engine',type=Path,required=True)
    p.add_argument('--source',type=Path,default=Path(__file__).resolve().parents[1]/'services/engine')
    p.add_argument('--backup',type=Path,required=True)
    p.add_argument('--apply',action='store_true')
    a=p.parse_args();engine=a.engine.resolve(strict=True);source=a.source.resolve(strict=True)
    changes=[]
    for relative,expected in FILES.items():
        old=engine/relative;new=source/relative
        current=sha(old);target=sha(new)
        if current==target:continue
        if current not in expected:raise ValueError('Unreviewed native source changes: '+relative)
        changes.append({'relativePath':relative,'before':current,'after':target})
    print(json.dumps({'apply':a.apply,'changes':changes}))
    if not a.apply or not changes:return
    backup=a.backup.resolve()
    backup.mkdir(parents=True,exist_ok=False)
    records=[]
    # Complete rollback bytes first; source replacement happens only afterward.
    for relative in FILES:
        file=engine/relative;destination=backup/'source'/relative
        destination.parent.mkdir(parents=True,exist_ok=True)
        shutil.copy2(file,destination)
        records.append({'path':str(file),'backup':str(destination),'sha256':sha(file)})
    for build,executable in [('emscripten-release','UniversalClient'),('linux-rcc-release','RCCService')]:
        folder=engine/'build'/build/executable
        for file in sorted(folder.glob(executable+'*')):
            if not file.is_file():continue
            destination=backup/'build'/build/executable/file.name
            destination.parent.mkdir(parents=True,exist_ok=True)
            shutil.copy2(file,destination)
            if sha(file)!=sha(destination):raise ValueError('Build backup checksum mismatch')
            records.append({'path':str(file),'backup':str(destination),'sha256':sha(file)})
    (backup/'manifest.json').write_text(json.dumps({'files':records,'changes':changes},indent=2)+'\n')
    for change in changes:
        relative=change['relativePath']
        # Refuse a concurrent source modification after the preflight.
        if sha(engine/relative)!=change['before']:raise ValueError('Native source changed during backup')
    for change in changes:
        relative=change['relativePath']
        shutil.copy2(source/relative,engine/relative)
        if sha(engine/relative)!=change['after']:raise ValueError('Installed source checksum mismatch')
    print('Backed up and installed audited source files: '+str(backup))

if __name__=='__main__':main()
