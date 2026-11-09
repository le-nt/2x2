#!/usr/bin/env python3
"""Create an isolated native browser validation stack, never a production install.

Run in Linux/WSL. Existing archive directories are read through symlinks; only
four small place files and the compiled browser bundle are staged. Credentials
are generated for this disposable stack and are never printed.
"""
import argparse
import hashlib
import json
import secrets
import shutil
from pathlib import Path

def sha(file):
    digest=hashlib.sha256()
    with file.open('rb') as stream:
        for data in iter(lambda:stream.read(1024*1024),b''):digest.update(data)
    return digest.hexdigest()

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[1])
    p.add_argument('--archives',type=Path,required=True)
    p.add_argument('--client-build',type=Path,required=True)
    p.add_argument('--output',type=Path,required=True)
    p.add_argument('--port',type=int,default=18190)
    p.add_argument('--arbiter-port',type=int,default=18191)
    a=p.parse_args();repo=a.root.resolve(strict=True);archives=a.archives.resolve(strict=True);output=a.output.resolve()
    if output.exists():raise ValueError('Choose a new empty output directory; existing validation state is preserved')
    if not output.is_relative_to(repo/'work'):raise ValueError('Validation output must be inside this checkout/work')
    if not 1024<a.port<65535 or not 1024<a.arbiter_port<65535 or a.port==a.arbiter_port:raise ValueError('Invalid validation ports')
    build=a.client_build.resolve(strict=True)
    for name in ['UniversalClient.js','UniversalClient.wasm','UniversalClient.data']:
        if not (build/name).is_file():raise ValueError('Missing built client '+name)
    if (build/'UniversalClient.wasm').open('rb').read(8)!=b'\0asm\x01\0\0\0':raise ValueError('Invalid WebAssembly header')
    source_registry=json.loads((archives/'server/native/places.json').read_text())
    selected={key:value for key,value in source_registry['places'].items() if value['id'] in {1,6,205,277}}
    if len(selected)!=4:raise ValueError('Mandatory native place IDs are not all registered')
    output.mkdir(parents=True)
    server=output/'server';server.mkdir()
    for name in ['server.mjs','catalog.json','schema.sql']:
        if (repo/'server'/name).is_file():shutil.copy2(repo/'server'/name,server/name)
    shutil.copytree(repo/'server/lib',server/'lib',ignore=shutil.ignore_patterns('*.bak','*~','__pycache__'))
    tools=output/'tools';tools.mkdir()
    for file in (repo/'tools').iterdir():
        if file.suffix in {'.py','.mjs'}:shutil.copy2(file,tools/file.name)
    shutil.copy2(repo/'tools/crossroads-tool-sources.json',tools/'crossroads-tool-sources.json')
    site=output/'site';(site/'data').mkdir(parents=True);(site/'js').mkdir()
    for name in ['native-test.html','native-test.css','index.html']:
        if (repo/'site'/name).is_file():shutil.copy2(repo/'site'/name,site/name)
    for file in (repo/'site/js').glob('*.js'):shutil.copy2(file,site/'js'/file.name)
    shutil.copy2(repo/'site/data/maps.json',site/'data/maps.json')
    staged_maps=server/'native/maps';staged_maps.mkdir(parents=True)
    map_base=(archives/'server/native/maps').resolve(strict=True)
    for key,entry in selected.items():
        source=(map_base/entry['file']).resolve(strict=True)
        if not source.is_relative_to(map_base):raise ValueError('Map escapes source root')
        destination=staged_maps/entry['file'];destination.parent.mkdir(parents=True,exist_ok=True)
        shutil.copy2(source,destination)
        if sha(source)!=sha(destination):raise ValueError('Map staging checksum mismatch')
    (server/'native/places.json').write_text(json.dumps({'format':1,'places':selected},indent=2)+'\n')
    links={
        'clients/shareddata':archives/'clients/shareddata',
        'server/native/asset-library':archives/'server/native/asset-library',
        'server/native/asset-seed':archives/'server/native/asset-seed',
        'server/native/asset-recovery/scripts':archives/'server/native/asset-recovery/scripts',
        'site/native-legacy-assets':archives/'site/native-legacy-assets',
        'site/img/catalog/faces':archives/'site/img/catalog/faces',
    }
    for relative,source in links.items():
        if source.is_dir():
            destination=output/relative;destination.parent.mkdir(parents=True,exist_ok=True)
            destination.symlink_to(source.resolve(),target_is_directory=True)
    client=site/'native-client';client.mkdir();files={}
    for name in ['UniversalClient.js','UniversalClient.wasm','UniversalClient.data']:
        shutil.copy2(build/name,client/name)
        digest=sha(client/name)
        if digest!=sha(build/name):raise ValueError('Client staging checksum mismatch')
        files[name]={'path':name,'sha256':digest,'bytes':(client/name).stat().st_size}
    (client/'manifest.json').write_text(json.dumps({'format':1,'entry':'UniversalClient.js','files':files},indent=2)+'\n')
    key=secrets.token_hex(32);signing=secrets.token_hex(32)
    base='http://127.0.0.1:'+str(a.port)
    cfg={'accessToken':'isolated-native-validation','secret':secrets.token_hex(32),
         'native':{'accessKey':key,'signingKey':signing,'publicOrigin':base,'arbiterOrigin':'http://127.0.0.1:'+str(a.arbiter_port),'maxJobs':4}}
    (server/'config.json').write_text(json.dumps(cfg,indent=2)+'\n')
    arbiter={'access_key':key,'signing_key':signing,'base_url':base+'/native','tls':None,
             'server':{'port':a.arbiter_port,'soap_port_range':{'start':18200,'end':18220},'network_server_port_range':{'start':18230,'end':18250}}}
    (output/'arbiter-config.json').write_text(json.dumps(arbiter,indent=2)+'\n')
    # This page uses a disposable fixture account through the actual login API.
    # It contains no production password, worker key, signing key or Cloud key.
    login='''<!doctype html><title>Isolated native validation</title><p id="status">Signing into disposable validation account...</p><script>
    (async()=>{await fetch('/?key=isolated-native-validation');
    const response=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'PreservationProbe',password:'Isolated_probe_password_2026!'})});
    if(!response.ok)throw Error('Validation login failed: '+response.status);
    location.replace('/native-test.html?id='+encodeURIComponent(new URLSearchParams(location.search).get('id')||'2008m-crossroads'));
    })().catch(error=>document.getElementById('status').textContent=error.message);</script>'''
    (site/'validation.html').write_text(login)
    (site/'validation-peer.html').write_text(login.replace('PreservationProbe','PreservationPeer').replace('Isolated_probe_password_2026!','Isolated_peer_password_2026!'))
    (output/'validation-marker.json').write_text(json.dumps({'schemaVersion':1,'type':'isolated-native-validation','sourceRoot':str(repo),'archiveRoot':str(archives),'publicOrigin':base,'placeIds':[e['id'] for e in selected.values()]},indent=2)+'\n')
    print(json.dumps({'stage':str(output),'publicOrigin':base,'places':len(selected),'clientFiles':files}))

if __name__=='__main__':main()
