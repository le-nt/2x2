#!/usr/bin/env python3
"""Read-only 2x2 XML place script inventory. Never executes Lua or alters maps."""
import argparse, collections, json, xml.etree.ElementTree as ET
from pathlib import Path
p=argparse.ArgumentParser()
p.add_argument('--root',type=Path,default=Path('D:/RBXBanland'))
p.add_argument('--place',action='append',default=['2009e-the-undead-coming-v1-3','legacy-rise-of-the-killbots-sword-fights-on-the-heights-iv'])
a=p.parse_args()
root=a.root.resolve(strict=True)
registry=json.loads((root/'server/native/places.json').read_text('utf8')).get('places',{})
for place in dict.fromkeys(a.place):
 info=registry.get(place)
 if not info:
  print(json.dumps({'place':place,'error':'not registered'}));continue
 rel=info.get('file')
 file=(root/'server/native/maps'/rel).resolve()
 if not file.is_relative_to((root/'server/native/maps').resolve()) or not file.is_file():
  print(json.dumps({'place':place,'error':'map file missing'}));continue
 if file.stat().st_size>200*1024*1024:
  print(json.dumps({'place':place,'error':'map too large'}));continue
 with file.open('rb') as f:header=f.read(4096)
 if b'<roblox' not in header:
  print(json.dumps({'place':place,'error':'binary map; XML script audit not applicable'}));continue
 count=collections.Counter()
 empty=[]
 try:
  # Streaming parse avoids keeping the entire place in memory.
  for event,el in ET.iterparse(file,events=('end',)):
   if el.tag=='Item' and el.attrib.get('class') in {'Script','LocalScript','ModuleScript'}:
    kind=el.attrib['class']; count[kind]+=1
    props=el.find('Properties')
    source=None;linked=''
    if props is not None:
     for ch in props:
      if ch.get('name')=='Source':source=''.join(ch.itertext()).strip()
      if ch.get('name')=='LinkedSource':linked=''.join(ch.itertext()).strip()
     disabled=props.find("bool[@name='Disabled']")
     if disabled is not None and disabled.text=='true':count['disabled']+=1
    if source:count['source_present']+=1
    else:
     count['source_empty']+=1
     if linked:count['empty_with_linked_source']+=1
     if len(empty)<25:
      name=props.findtext("string[@name='Name']",default='') if props is not None else ''
      empty.append({'name':name,'class':kind,'linkedSourcePresent':bool(linked)})
    el.clear()
 except ET.ParseError as e:
  print(json.dumps({'place':place,'error':'XML parse failed: '+str(e)}));continue
 print(json.dumps({'place':place,'file':str(file),'scriptCounts':dict(count),'emptySamples':empty},indent=2))
