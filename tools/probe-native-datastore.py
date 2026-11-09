#!/usr/bin/env python3
"""Verify the real RCC DataStore APIs in a marked, disposable loopback job.

Creates a fixed diagnostic Script and result value, using a unique test store.
Does not change original gameplay scripts, credentials, maps or player input.
"""
import argparse,json,re,sqlite3,time,urllib.request,uuid
import xml.etree.ElementTree as ET
from pathlib import Path
from xml.sax.saxutils import escape

SOURCE='''local result=workspace:FindFirstChild("RESULT_NAME")
local ok,report=pcall(function()
 local service=game:GetService("DataStoreService")
 local store=service:GetDataStore("STORE_NAME","validation")
 assert(store:GetAsync("missing")==nil,"Missing keys must return nil")
 store:SetAsync("object",{score=7,label="original native data"})
 local object=store:GetAsync("object");assert(object.score==7 and object.label=="original native data")
 local count=store:IncrementAsync("count",3);assert(count==3,"IncrementAsync failed")
 local updated=store:UpdateAsync("updated",function(old) return (old or 0)+4 end)
 assert(updated==4,"UpdateAsync failed")
 local ordered=service:GetOrderedDataStore("STORE_NAME","validation")
 ordered:SetAsync("low",2);ordered:SetAsync("high",9)
 local pages=ordered:GetSortedAsync(false,1)
 local first=pages:GetCurrentPage();assert(first[1].key=="high" and first[1].value==9)
 assert(not pages.IsFinished,"First ordered page incorrectly finished")
 pages:AdvanceToNextPageAsync()
 local second=pages:GetCurrentPage();assert(second[1].key=="low" and second[1].value==2 and pages.IsFinished)
 return {missingIsNil=true,objectRoundTrip=true,increment=count,updated=updated,orderedFirst=first[1],orderedSecond=second[1]}
end)
result.Value=game:GetService("HttpService"):JSONEncode({ok=ok,result=ok and report or nil,error=not ok and tostring(report) or nil})
script:Destroy()
'''

def execute(port,job,code):
 body='<Execute xmlns="http://roblox.com/"><jobID>'+escape(job)+'</jobID><script><name>NativePersistenceValidation</name><script>'+escape(code)+'</script><arguments/></script></Execute>'
 envelope=('<?xml version="1.0"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body>'+body+'</soap:Body></soap:Envelope>').encode()
 request=urllib.request.Request('http://127.0.0.1:'+str(port)+'/',data=envelope,headers={'Content-Type':'text/xml; charset=utf-8','SOAPAction':'"http://roblox.com/Execute"'})
 with urllib.request.urlopen(request,timeout=10) as response:xml=ET.fromstring(response.read(2*1024*1024))
 return [element.text for element in xml.iter() if element.tag.rsplit('}',1)[-1]=='value' and element.text]

def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--stage',type=Path,required=True);p.add_argument('--port',type=int,required=True);p.add_argument('--job',required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args()
 root=Path(__file__).resolve().parents[1];stage=a.stage.resolve(strict=True)
 if not stage.is_relative_to(root/'work') or not 1024<a.port<65536 or not re.fullmatch('[A-Za-z0-9-]{1,100}',a.job):raise ValueError('Invalid isolated test target')
 if json.loads((stage/'validation-marker.json').read_text())['type']!='isolated-native-validation':raise ValueError('Not a marked isolated native fixture')
 db=sqlite3.connect('file:'+str(stage/'server/data/2x2.db')+'?mode=ro',uri=True)
 job=db.execute('SELECT place_id,closed FROM native_jobs WHERE job_id=?',(a.job,)).fetchone()
 if not job or job[1]:raise ValueError('The test job is not active in this fixture')
 token=uuid.uuid4().hex;name='__2x2DataStoreProbe_'+token;store='2x2probe_'+token
 source=SOURCE.replace('RESULT_NAME',name).replace('STORE_NAME',store)
 code='local result=Instance.new("StringValue",workspace);result.Name="'+name+'";result.Value="running";local probe=Instance.new("Script");probe.Name="NativePersistenceProbe";probe.Source=[====['+source+']====];probe.Parent=workspace;return "installed"'
 assert 'installed' in execute(a.port,a.job,code)
 deadline=time.monotonic()+75;report=None
 while time.monotonic()<deadline:
  values=execute(a.port,a.job,'local result=workspace:FindFirstChild("'+name+'");return result and result.Value or "missing"')
  text=next((value for value in values if value.startswith('{')),None)
  if text:report=json.loads(text);break
  time.sleep(0.2)
 if report is None:raise TimeoutError('Native persistence diagnostic did not finish within 75 seconds')
 rows=db.execute('SELECT place_id,store_type,entry_key,value FROM native_datastore_values WHERE store_name=? ORDER BY store_type,entry_key',(store,)).fetchall();db.close()
 report.update({'jobId':a.job,'placeId':job[0],'store':store,'persistedEntries':[{'placeId':row[0],'type':row[1],'key':row[2],'value':json.loads(row[3])} for row in rows]})
 a.output.parent.mkdir(parents=True,exist_ok=True)
 with a.output.open('x') as output:json.dump(report,output,indent=2);output.write('\n')
 print(json.dumps(report));assert report['ok'] and len(rows)==5,report

if __name__=='__main__':main()
