#!/usr/bin/env python3
"""Prepare cached launchable XML map copies from original 2x2 places.

Restores empty script bodies only from their *exact* LinkedSource asset id, or
from an exact known Crossroads Tool/Script template. Never executes Lua.
"""
import argparse
import datetime
import hashlib
import importlib.util
import json
import os
import re
import shutil
import tempfile
import xml.etree.ElementTree as ET
from collections import Counter
from pathlib import Path

ID = re.compile(r'^[1-9][0-9]{0,15}$')
ASSET_REF = re.compile(r'(?:rbxassetid://|[?&](?:id|assetId)=)([1-9][0-9]{0,15})',re.I)
MAX_MAP = 200*1024*1024

def sha(b): return hashlib.sha256(b).hexdigest()
def atomic(path,payload):
    path.parent.mkdir(parents=True,exist_ok=True)
    with tempfile.NamedTemporaryFile('wb',dir=path.parent,delete=False) as f:
        f.write(payload);name=Path(f.name)
    os.replace(name,path)

def get_name(item):
    p=item.find('Properties')
    return p.findtext("string[@name='Name']",default='') if p is not None else ''

def linked_id(item):
    props=item.find('Properties')
    if props is None:return None
    for prop in props:
        if prop.get('name')=='LinkedSource':
            for value in prop.iter():
                if value.text:
                    m=ASSET_REF.search(value.text)
                    if m:return m.group(1)
    return None

def load_lua(luadir,aid):
    if not aid or not ID.fullmatch(aid):return None
    file=luadir/(aid+'.lua')
    if not file.is_file() or file.is_symlink() or file.stat().st_size>2_000_000:return None
    try:s=file.read_text('utf-8-sig')
    except (OSError,UnicodeError):return None
    if not s.strip() or '\x00' in s:return None
    return s

def clear_linked(props):
    for el in props:
        if el.get('name')=='LinkedSource':
            el.clear();el.tag='Content';el.set('name','LinkedSource');ET.SubElement(el,'null')

def repair_scripts(payload,templates,luadir):
    # XML recovery is used only in generated copies; original input remains intact.
    source=payload
    invalid=re.compile(rb'&#(x[0-9A-Fa-f]+|\d+);')
    def fix(m):
        try:
            s=m.group(1);n=int(s[1:],16) if s.startswith(b'x') else int(s)
            if n in (9,10,13) or (32<=n<=0x10ffff and not 0xd800<=n<=0xdfff and n not in (0xfffe,0xffff)):
                return m.group(0)
        except ValueError:pass
        return b'&#xFFFD;'
    source=invalid.sub(fix,source)
    tree=ET.fromstring(source)
    stats=Counter();records=[]
    def visit(item,tool=None):
        if item.tag!='Item':return
        kind=item.get('class','')
        if kind=='Tool':tool=get_name(item)
        if kind in ('Script','LocalScript','ModuleScript'):
            props=item.find('Properties')
            if props is not None:
                slots=[el for el in props if el.get('name')=='Source']
                if any((x.text or '').strip() for x in slots):
                    stats['nonempty_preserved']+=1
                elif not slots or len(slots)==1:
                    ref=linked_id(item)
                    source_text=load_lua(luadir,ref)
                    method='linked_id' if source_text is not None else None
                    if not source_text and tool:
                        source_text=templates.get(tool,{}).get(get_name(item))
                        if source_text:method='crossroads_template'
                    if source_text:
                        slot=slots[0] if slots else ET.SubElement(props,'ProtectedString',{'name':'Source'})
                        slot.tag='ProtectedString';slot.text=source_text
                        clear_linked(props)
                        stats['restored_'+method]+=1
                        records.append({'tool':tool,'script':get_name(item),'class':kind,'via':method,'linkedId':ref})
                    else:stats['empty_unresolved']+=1
        for child in item:
            if child.tag=='Item':visit(child,tool)
    for child in tree:
        if child.tag=='Item':visit(child)
    if not records:return None,dict(stats),records
    output=ET.tostring(tree,encoding='utf-8',short_empty_elements=False)
    ET.fromstring(output)
    return output,dict(stats),records

def run(root,activate=False):
    maps=root/'server/native/maps'; registry_file=root/'server/native/places.json'
    reg=json.loads(registry_file.read_text('utf-8'))
    if not isinstance(reg.get('places'),dict):raise ValueError('No places in native registry')
    scriptdir=root/'server/native/asset-recovery/scripts'
    templates=json.loads((Path(__file__).parent/'crossroads-tool-sources.json').read_text('utf-8'))
    out=maps/'2x2-runtime-ready';out.mkdir(parents=True,exist_ok=True)
    report=[];totals=Counter();updates={}
    for place,entry in sorted(reg['places'].items()):
        if 'crossroads' in place.lower():totals['protected_crossroads']+=1;continue
        rel=entry.get('file','')
        if not isinstance(rel,str) or not rel.lower().endswith('.rbxl'):continue
        source=maps/rel
        if not source.is_file() or source.is_symlink() or not source.resolve().is_relative_to(maps.resolve()):
            totals['missing_map']+=1;continue
        if source.stat().st_size>MAX_MAP:totals['oversized']+=1;continue
        blob=source.read_bytes()
        if b'<roblox' not in blob[:4096]:totals['binary_skipped']+=1;continue
        try:
            converted,stats,records=repair_scripts(blob,templates,scriptdir)
            totals.update(stats)
            if not converted:
                totals['unmodified_places']+=1;continue
            dest=out/(place+'.rbxl')
            # Refuse to overwrite unrecognized existing output.
            if dest.exists() and sha(dest.read_bytes())!=sha(converted):
                # Existing generated copies are replaceable only if a prior record owns it.
                marker=out/(place+'.source.json')
                if not marker.is_file() or json.loads(marker.read_text('utf-8')).get('sourceFile')!=rel:
                    totals['output_conflict']+=1;continue
            atomic(dest,converted)
            atomic(out/(place+'.source.json'),json.dumps({'sourceFile':rel,'sourceSha256':sha(blob),'outputSha256':sha(converted)},indent=2).encode())
            updates[place]={'file':'2x2-runtime-ready/'+place+'.rbxl','sha256':sha(converted)}
            totals['repaired_places']+=1
            report.append({'place':place,'repairs':records,'stats':stats})
        except (OSError,ValueError,ET.ParseError) as e:
            totals['errors']+=1;report.append({'place':place,'error':str(e)[:200]})
    backup=None
    if activate and updates:
        directory=root/'server/native/asset-recovery/registry-backups';directory.mkdir(parents=True,exist_ok=True)
        backup=directory/('before-runtime-place-'+datetime.datetime.now().strftime('%Y%m%d-%H%M%S-%f')+'.json')
        shutil.copy2(registry_file,backup)
        for pid,new in updates.items():reg['places'][pid].update(new)
        atomic(registry_file,(json.dumps(reg,indent=2,ensure_ascii=False)+'\n').encode())
        totals['activated_places']=len(updates)
    destination=root/'server/native/asset-recovery/runtime-script-repair.json'
    atomic(destination,json.dumps({'counts':dict(totals),'backup':str(backup) if backup else None,'places':report},indent=2).encode())
    return {'counts':dict(totals),'report':str(destination),'registryBackup':str(backup) if backup else None}

if __name__=='__main__':
    a=argparse.ArgumentParser();a.add_argument('--root',type=Path,required=True);a.add_argument('--activate',action='store_true');args=a.parse_args()
    print(json.dumps(run(args.root.resolve(strict=True),args.activate),indent=2))
