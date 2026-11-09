#!/usr/bin/env python3
"""Run a bounded isolated native RCC script probe, using only a loopback fixture.

No production configuration, database, API keys or deployed client are used.
With --place, execute that archived place in the native server for a short
observation window. This is server evidence, never proof of browser gameplay.
"""
import argparse
import hashlib
import http.server
import json
import os
import re
import socket
import subprocess
import threading
import time
import urllib.error
import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
from pathlib import Path
from xml.sax.saxutils import escape

def unused_port():
    with socket.socket() as server:
        server.bind(('127.0.0.1',0));return server.getsockname()[1]

def fixture():
    root=ET.Element('roblox',version='4')
    workspace=ET.SubElement(root,'Item',{'class':'Workspace','referent':'RBX0'})
    for name,source,disabled in [('ProbeSuccess','local value=Instance.new("StringValue"); value.Name="RuntimeSentinel"; value.Value="native Lua executed"; value.Parent=workspace',False),
        ('ProbeDisabled','Instance.new("BoolValue",workspace).Name="DisabledSentinel"',True),
        ('ProbeSignalWait','local e=Instance.new("BindableEvent"); coroutine.wrap(function() local value=e.Event:Wait(); local s=Instance.new("StringValue",workspace); s.Name="SignalWaitSentinel"; s.Value=value end)(); e:Fire("native signal resumed"); print("redaction probe isolated-runtime-probe isolated-runtime-probe-signing-key")',False),
        ('ProbeDetachedTemplate','local source=Instance.new("Model"); source.Name="OriginalDetachedTemplate"; local holder=Instance.new("ObjectValue"); holder.Name="DetachedTemplateHolder"; holder.Value=source:Clone(); holder.Parent=workspace; source:Destroy(); script:Destroy()',False),
        ('ProbeTemplateAncestry','''local result=Instance.new("StringValue",workspace);result.Name="TemplateAncestrySentinel"
local holder=Instance.new("ObjectValue",workspace)
holder.Value=Instance.new("Model");holder.Value.Name="ReparentedTemplate"
local target=holder.Value;target.Parent=workspace;target.Parent=nil
assert(holder.Value==target,"Reparenting lost the template")
holder.Parent=target;target.Parent=workspace
assert(holder.Value==target,"Ancestor reference changed")
holder.Value=game;assert(holder.Value==game,"Root reference changed")
holder.Value=holder;assert(holder.Value==holder,"Self reference changed")
holder.Value=nil;assert(holder.Value==nil,"Clearing failed")
target:Destroy();result.Value="reparent ancestor root self clear passed"''',False),
        ('ProbeTemplateRelease','''local watchers={}
for _,mode in pairs({"clear","unroot","ancestor"}) do
 local holder=Instance.new("ObjectValue",workspace)
 local target=Instance.new("Model");holder.Value=target
 local watcher=Instance.new("ObjectValue");watcher.Value=target
 watchers[mode]=watcher
 if mode=="clear" then holder.Value=nil
 elseif mode=="unroot" then holder.Parent=nil
 else holder.Parent=target end
end
local probe=Instance.new("BindableFunction",workspace);probe.Name="TemplateReleaseProbe"
probe.OnInvoke=function()
 local released={};for name,watcher in pairs(watchers) do released[name]=watcher.Value==nil end
 return game:GetService("HttpService"):JSONEncode(released)
end''',False),
        ('ProbeSyntax','local = invalid',False),('ProbeRuntime','error("intentional probe runtime failure")',False)]:
        script=ET.SubElement(workspace,'Item',{'class':'Script','referent':'RBX'+name})
        props=ET.SubElement(script,'Properties')
        ET.SubElement(props,'string',name='Name').text=name
        ET.SubElement(props,'bool',name='Disabled').text=str(disabled).lower()
        ET.SubElement(props,'ProtectedString',name='Source').text=source
    return ET.tostring(root,encoding='utf8')

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--rcc',type=Path,required=True)
    p.add_argument('--output',type=Path,required=True)
    p.add_argument('--place',type=Path)
    p.add_argument('--place-id',type=int,default=999999)
    p.add_argument('--resource',type=Path,help='Optional genuine WAV used only to probe native archive HTTP fallback, not playback')
    p.add_argument('--seconds',type=int,default=2,choices=range(1,11))
    p.add_argument('--gameserver-port-conflict',action='store_true',help='Run the real bootstrap against an occupied UDP port; require an attributed shutdown')
    a=p.parse_args();binary=a.rcc.resolve(strict=True);a.output.mkdir(parents=True,exist_ok=True)
    if not 0<a.place_id<2147483647:raise ValueError('Invalid native place ID')
    payload=a.place.read_bytes() if a.place else fixture()
    resource=a.resource.read_bytes() if a.resource else None
    if resource is not None and not 0<len(resource)<=64*1024*1024:raise ValueError('Resource exceeds probe size limits')
    if not 0<len(payload)<=128*1024*1024:raise ValueError('Place size outside limits')
    requests=[]
    class Handler(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            # Fixed handler: no requested path ever becomes a filesystem path.
            place_request=self.path in ('/native/asset/?id='+str(a.place_id),'/native/asset?id='+str(a.place_id))
            parsed=urllib.parse.urlparse(self.path)
            requested=urllib.parse.parse_qs(parsed.query).get('path',[''])[0]
            resource_request=resource is not None and parsed.path=='/native/archive-content' and requested.casefold()=='sounds/rocket whoosh 01.wav'
            ok=place_request or resource_request
            data=payload if place_request else resource if resource_request else b''
            if len(requests)<1000:requests.append({'path':self.path[:512],'status':200 if ok else 404,'sha256':hashlib.sha256(data).hexdigest() if ok else None})
            self.send_response(200 if ok else 404);self.send_header('Content-Type','application/octet-stream')
            self.send_header('Content-Length',str(len(data)));self.end_headers()
            if ok:self.wfile.write(data)
        def log_message(self,*args):pass
        def do_POST(self):
            size=int(self.headers.get('Content-Length','0'))
            ok=0<=size<=65536 and self.path in ('/native/internal/gameserver/heartbeat','/native/internal/gameserver/shutdown') and self.headers.get('AccessKey')=='isolated-runtime-probe'
            if 0<=size<=65536:self.rfile.read(size)
            if len(requests)<1000:requests.append({'path':self.path[:512],'status':200 if ok else 404,'method':'POST'})
            self.send_response(200 if ok else 404);self.send_header('Content-Length','2');self.end_headers();self.wfile.write(b'{}')
    server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler)
    threading.Thread(target=server.serve_forever,daemon=True).start()
    soap_port,network_port=unused_port(),unused_port()
    occupied=None
    if a.gameserver_port_conflict:
        occupied=socket.socket(socket.AF_INET,socket.SOCK_DGRAM)
        occupied.bind(('127.0.0.1',network_port))
    base='http://127.0.0.1:'+str(server.server_port)+'/native'
    # Dummy credentials are deliberately unrelated to the user's credentials.
    env={**os.environ,'EGL_PLATFORM':'surfaceless','RBX_ACCESS_KEY':'isolated-runtime-probe',
         'RBX_SECRET_KEY':'isolated-runtime-probe-signing-key','RBX_INTERNAL_BASE_URL':base}
    log_file=a.output/'rcc.log'
    script='''settings().Lua.AreScriptStartsReported=true
game:SetPlaceID(PLACE_ID,false)
local sc=game:GetService("ScriptContext")
sc.ScriptsDisabled=true
local errors={}
_G.__2x2ProbeErrors=errors
sc.Error:connect(function(message,stack,source)
 if #errors<100 then table.insert(errors,{message=tostring(message),stack=tostring(stack),path=source and source:GetFullName() or "<unknown>"}) end
end)
game:GetService("ContentProvider"):SetBaseUrl("BASE/")
game:Load("BASE/asset/?id=PLACE_ID")
game:GetService("NetworkServer"):Start(PORT)
sc.ScriptsDisabled=false
game:GetService("RunService"):Run()
RESOURCE_PROBE
'''.replace('BASE',base).replace('PORT',str(network_port)).replace('PLACE_ID',str(a.place_id))
    # The archived file has an uppercase R. The lowercase reference exercises
    # the missing packaged-path fallback on the case-sensitive Linux runtime.
    script=script.replace('RESOURCE_PROBE','game:GetService("ContentProvider"):Preload("rbxasset://sounds/rocket whoosh 01.wav")' if resource is not None else '')
    if a.gameserver_port_conflict:
        bootstrap=(Path(__file__).resolve().parents[1]/'services/arbiter/resources/scripts/GameServer.lua').read_text()
        if ']====]' in bootstrap:raise ValueError('Unexpected trusted bootstrap delimiter')
        script='local bootstrap=assert(loadstring([====['+bootstrap+']====], "GameServerStartupFixture")); bootstrap('+str(a.place_id)+','+str(network_port)+','+json.dumps(base)+')'
    body='<OpenJob xmlns="http://roblox.com/"><job><id>isolated-probe</id><expirationInSeconds>20</expirationInSeconds><category>0</category><cores>1</cores></job><script><name>IsolatedRuntimeProbe</name><script>'+escape(script)+'</script><arguments/></script></OpenJob>'
    envelope=('<?xml version="1.0"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body>'+body+'</soap:Body></soap:Envelope>').encode()
    with log_file.open('wb') as output:
        child=subprocess.Popen([str(binary),'-Port',str(soap_port),'-BaseUrl:'+base],cwd=binary.parent,env=env,stdout=output,stderr=subprocess.STDOUT)
        try:
            deadline=time.monotonic()+45
            while True:
                if child.poll() is not None:raise RuntimeError('RCC exited before SOAP startup; inspect rcc.log')
                try:
                    with socket.create_connection(('127.0.0.1',soap_port),timeout=.2):break
                except OSError:
                    if time.monotonic()>deadline:raise TimeoutError('RCC SOAP startup timed out')
                    time.sleep(.1)
            request=urllib.request.Request('http://127.0.0.1:'+str(soap_port)+'/',data=envelope,
                headers={'Content-Type':'text/xml; charset=utf-8','SOAPAction':'"http://roblox.com/OpenJob"'})
            try:
                with urllib.request.urlopen(request,timeout=20) as response:reply=response.read(2*1024*1024)
            except urllib.error.HTTPError as error:
                reply=error.read(2*1024*1024);(a.output/'soap-response.xml').write_bytes(reply)
                raise RuntimeError('RCC SOAP fault; inspect soap-response.xml') from error
            (a.output/'soap-response.xml').write_bytes(reply)
            # OpenJob bootstraps asynchronously when code yields. Observe from
            # a separate, non-yielding Execute call after native scheduling.
            time.sleep(a.seconds+.25)
            observe='local s=workspace:FindFirstChild("RuntimeSentinel"); local signal=workspace:FindFirstChild("SignalWaitSentinel"); local holder=workspace:FindFirstChild("DetachedTemplateHolder"); local target=holder and holder.Value; local ancestry=workspace:FindFirstChild("TemplateAncestrySentinel"); return game:GetService("HttpService"):JSONEncode({sentinel=s and s.Value or "",signalWait=signal and signal.Value or "",detachedTemplate=target and target.Name or "",templateAncestry=ancestry and ancestry.Value or "",disabledRan=workspace:FindFirstChild("DisabledSentinel")~=nil,errors=_G.__2x2ProbeErrors or {}})'
            observe='local probe=workspace:FindFirstChild("TemplateReleaseProbe"); local released=probe and game:GetService("HttpService"):JSONDecode(probe:Invoke()) or {}; '+observe.replace('templateAncestry=','templateReleased=released,templateAncestry=')
            execute='<Execute xmlns="http://roblox.com/"><jobID>isolated-probe</jobID><script><name>ObserveNativeRuntime</name><script>'+escape(observe)+'</script><arguments/></script></Execute>'
            execute_envelope=('<?xml version="1.0"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body>'+execute+'</soap:Body></soap:Envelope>').encode()
            request=urllib.request.Request('http://127.0.0.1:'+str(soap_port)+'/',data=execute_envelope,
                headers={'Content-Type':'text/xml; charset=utf-8','SOAPAction':'"http://roblox.com/Execute"'})
            with urllib.request.urlopen(request,timeout=15) as response:reply=response.read(2*1024*1024)
            (a.output/'soap-observation.xml').write_bytes(reply)
            parsed=ET.fromstring(reply)
            values=[e.text for e in parsed.iter() if e.tag.rsplit('}',1)[-1]=='value' and e.text]
            report=next((json.loads(v) for v in values if v.startswith('{')),None)
            if report is None:raise RuntimeError('Native probe returned no report')
            result={'schemaVersion':1,'mode':'startup_failure_fixture' if a.gameserver_port_conflict else 'archived_place' if a.place else 'trusted_fixture',
                'placeId':a.place_id,'placeSha256':hashlib.sha256(payload).hexdigest(),'secondsObserved':a.seconds,'server':report,
                'requests':requests,'browserGameplay':'not_tested',
                'limitations':['Headless server without players.','Resource fixture serves only this place; missing metadata endpoints are explicit 404s.']}
            events=[{'phase':m[0],'placeId':int(m[1]),'context':m[2],'scriptPath':m[3]} for m in re.findall(
                r'\[2x2 lua\] phase=(\w+) place=(\d+) context=(\w+) script="([^"]*)"',log_file.read_text(errors='replace'))]
            result['nativeLifecycle']=events
            if not a.place:
                native_log=log_file.read_text(errors='replace')
                assert env['RBX_ACCESS_KEY'] not in native_log,'RCC leaked its test access key'
                assert env['RBX_SECRET_KEY'] not in native_log,'RCC leaked its test signing key'
                if not a.gameserver_port_conflict:
                    assert 'redaction probe <redacted> <redacted>' in native_log,'Redacted diagnostic was suppressed or not sanitized'
            if resource is not None:
                delivered=any(r['status']==200 and r['path'].startswith('/native/archive-content?') for r in requests)
                result['archiveHttpFallback']={'observed':delivered,'resourceSha256':hashlib.sha256(resource).hexdigest(),'audioPlayback':'not_tested'}
                assert delivered,'Native archive HTTP fallback was not observed'
            if a.gameserver_port_conflict:
                failed='NetworkServer start failed:' in log_file.read_text(errors='replace')
                shutdown=any(r['path']=='/native/internal/gameserver/shutdown' and r['status']==200 for r in requests)
                heartbeat=any(r['path']=='/native/internal/gameserver/heartbeat' and r['status']==200 for r in requests)
                result['networkStartup']={'failureLogged':failed,'shutdownReported':shutdown,'advertisedReady':heartbeat}
                assert failed and shutdown and not heartbeat,result['networkStartup']
            elif not a.place:
                assert report['sentinel']=='native Lua executed',report
                assert report['signalWait']=='native signal resumed',report
                assert report['detachedTemplate']=='OriginalDetachedTemplate',report
                assert report['templateAncestry']=='reparent ancestor root self clear passed',report
                assert report['templateReleased']=={'clear':True,'unroot':True,'ancestor':True},report
                assert not report['disabledRan'],report
                assert len(report['errors'])>=2,report
            (a.output/'report.json').write_text(json.dumps(result,indent=2)+'\n')
            print(json.dumps({'output':str(a.output),'mode':result['mode'],'errors':len(report['errors']),'sentinel':report['sentinel']}))
        finally:
            (a.output/'requests.json').write_text(json.dumps(requests,indent=2)+'\n')
            child.terminate()
            try:child.wait(timeout=5)
            except subprocess.TimeoutExpired:child.kill();child.wait()
            server.shutdown();server.server_close()
            if occupied:occupied.close()

if __name__=='__main__':main()
