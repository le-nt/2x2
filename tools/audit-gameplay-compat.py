#!/usr/bin/env python3
"""Read-only per-place tool, script, and asset triage for imported maps.

Uses local manifests; does not claim that embedded code executes successfully.
No map rewriting, client patching, or external downloads.
"""
import argparse
import csv
import json
import re
from collections import Counter
from pathlib import Path

VALID={'inventoried','inventoried_with_xml_recovery','inventoried_binary'}
TOOL_CLASSES={'Tool','HopperBin'}
ID=re.compile(r'^[a-zA-Z0-9][a-zA-Z0-9_-]{0,150}$')
MODERN_CLASSES={'Terrain','MeshPart','UnionOperation','Folder','ParticleEmitter',
                'ViewportFrame','SurfaceAppearance','ProximityPrompt','TextChatService',
                'Beam','Trail','Attachment','SkinnedMeshPart','VideoFrame'}
EXTENSIONS=('.rbxm','.rbxmx','.mesh','.png','.jpg','.jpeg','.dds','.wav','.mp3','.ogg','.txt','.lua')

def local_asset(root,ident,extensions=EXTENSIONS):
    if not re.fullmatch(r'[1-9][0-9]{0,15}',str(ident)):
        return False
    roots=((root/'server/native/asset-library',''),(root/'site/data/scenes/assets','assets_'),
           (root/'server/native/asset-recovery/scripts',''))
    for directory,prefix in roots:
        for ext in extensions:
            file=directory/(prefix+str(ident)+ext)
            if not file.is_symlink() and file.is_file() and 0<file.stat().st_size<=64*1024*1024:
                return True
    return False

def local_lua(root,ident):
    # A texture or mesh with the same ID cannot satisfy a LinkedSource request.
    return local_asset(root,ident,('.lua','.txt'))

def audit_one(root,manifest):
    classes=manifest.get('classCounts') or {}
    modern={name:count for name,count in classes.items() if name in MODERN_CLASSES and count}
    scripts=manifest.get('scripts') or []
    tools=manifest.get('tools') or []
    assetids=manifest.get('assetIds') or []
    unsupported=manifest.get('unsupportedBinaryProperties') or []
    unknown_classes={p.split('.',1)[0] for p in unsupported if '.Source(type ' in p}
    def unknown_source(script):
        return not script.get('sourcePresent') and script.get('class') in unknown_classes
    resolved={ident for ident in assetids if local_asset(root,ident)}
    tools_info=[]
    for tool in tools:
        path=tool.get('path') or ''
        owned=[s for s in scripts if (s.get('path') or '').startswith(path+'/')]
        missing=[s for s in owned if not s.get('sourcePresent') and not unknown_source(s)]
        unknown=[s for s in owned if unknown_source(s)]
        linked=sum(bool(s.get('linkedSourceId')) for s in missing)
        missingids=[s.get('linkedSourceId') for s in missing if s.get('linkedSourceId') and not local_lua(root,s['linkedSourceId'])]
        no_handle=(tool.get('class')=='Tool' and tool.get('requiresHandle') is not False and tool.get('hasHandle') is False)
        issues=[]
        if no_handle:issues.append('required_handle_missing')
        if not owned:issues.append('no_embedded_scripts')
        if missing:issues.append('empty_script_sources')
        if unknown:issues.append('source_not_decoded')
        if missingids:issues.append('missing_linked_lua')
        tools_info.append({
            'path':path,'class':tool.get('class'),
            'hasHandle':tool.get('hasHandle'),
            'requiresHandle':tool.get('requiresHandle'),
            'embeddedScripts':len(owned),'emptySources':len(missing),
            'unknownSources':len(unknown),
            'linkedSourceReferences':linked,'missingLinkedLua':len(missingids),
            'issues':issues
        })
    scripts_unknown=[s for s in scripts if unknown_source(s)]
    scripts_empty=[s for s in scripts if not s.get('sourcePresent') and not unknown_source(s)]
    not_cached=[s for s in scripts_empty if s.get('linkedSourceId') and not local_lua(root,s['linkedSourceId'])]
    issues=Counter(issue for tool in tools_info for issue in tool['issues'])
    return {
      'id':manifest['id'],'status':manifest.get('status'),
      'tools':tools_info,
      'modernInstanceClasses':modern,
      'unsupportedBinaryProperties':manifest.get('unsupportedBinaryProperties') or [],
      'counts':{'tools':len(tools_info),'scripts':len(scripts),
                'embeddedSources':len(scripts)-len(scripts_empty)-len(scripts_unknown),
                'unknownSources':len(scripts_unknown),
                'emptySources':len(scripts_empty),
                'unavailableLinkedLua':len(not_cached),
                'assetReferences':len(assetids),'cachedAssets':len(resolved),
                'missingAssets':len(assetids)-len(resolved),
                'toolIssues':dict(issues),'modernClassInstances':sum(modern.values())},
      'warnings':[
       'Code presence, Handle shape and cached assets do not prove client execution, physics, hit detection or network replication.',
       *(['Unsupported binary properties were not decoded; affected source and asset inventory may be incomplete.']
         if manifest.get('unsupportedBinaryProperties') else [])
      ]
    }

def run(root,place=None,write=False):
    root=Path(root).resolve(strict=True)
    registry=json.loads((root/'server/native/places.json').read_text('utf-8'))['places']
    if place and (not ID.fullmatch(place) or place not in registry):
        raise ValueError('Unknown registered place ID')
    manifests=root/'server/native/place-manifests'
    targets=[place] if place else sorted(registry)
    results=[];totals=Counter(registered_places=len(targets),audited_places=0,
                             missing_manifest=0,unscannable_manifest=0)
    statuses=Counter();skipped=[]
    for ident in targets:
        file=manifests/(ident+'.json')
        if not file.is_file():
            totals['missing_manifest']+=1
            skipped.append({'id':ident,'reason':'missing_manifest','status':None})
            continue
        manifest=json.loads(file.read_text('utf-8'))
        if manifest.get('id')!=ident:
            raise ValueError('Manifest identity mismatch: '+ident)
        status=manifest.get('status')
        statuses[status or 'missing_status']+=1
        if status not in VALID:
            totals['unscannable_manifest']+=1
            skipped.append({'id':ident,'reason':'unscannable_manifest','status':status})
            continue
        item=audit_one(root,manifest)
        results.append(item)
        totals['audited_places']+=1
        for field in ('tools','scripts','embeddedSources','emptySources','unknownSources','unavailableLinkedLua','assetReferences','cachedAssets','missingAssets','modernClassInstances'):
            totals[field]+=item['counts'][field]
        for issue,count in item['counts']['toolIssues'].items():
            totals[issue]+=count
    results.sort(key=lambda row:(
       -(row['counts']['emptySources']+row['counts']['missingAssets']+row['counts']['modernClassInstances']+sum(row['counts']['toolIssues'].values())),
       row['id']))
    report={'schemaVersion':1,'counts':dict(totals),
            'limitations':'Static inventory only; does not verify live chat, damage, tool activation or engine API compatibility.',
            'manifestStatusCounts':dict(statuses),'skippedPlaces':skipped,
            'places':results}
    if write:
        out=root/'server/native/asset-recovery'
        out.mkdir(parents=True,exist_ok=True)
        (out/'compatibility-audit.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
        with (out/'compatibility-audit.csv').open('w',newline='',encoding='utf-8') as handle:
            fields=['id','status','tools','scripts','emptySources','unknownSources','unavailableLinkedLua','missingAssets','cachedAssets','modernClassInstances','toolIssues']
            writer=csv.DictWriter(handle,fieldnames=fields);writer.writeheader()
            for row in results:
                counts=row['counts']
                writer.writerow({'id':row['id'],'status':row['status'],**{field:counts.get(field,0) for field in fields[2:-1]},'toolIssues':json.dumps(counts['toolIssues'],sort_keys=True)})
    return report

if __name__=='__main__':
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[1])
    ap.add_argument('--place',help='Single registered game ID')
    ap.add_argument('--write',action='store_true',help='Save JSON/CSV results; never modify maps')
    args=ap.parse_args()
    report=run(args.root,args.place,args.write)
    print(json.dumps({'counts':report['counts'],'manifestStatusCounts':report['manifestStatusCounts'],
                      'skippedPlaces':report['skippedPlaces'],'examples':report['places'][:8]},indent=2))
